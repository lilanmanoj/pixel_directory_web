import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import type { AuthUser } from '../common/decorators.js';
import { hasPermission, P } from '../common/permissions.js';
import { escapeRegex, paged, paging, slugify } from '../common/utils.js';
import { Brand, CardSize, Click, User } from '../schemas/index.js';
import { AdminBrandDto, BrandContentDto } from './brand.dto.js';

/** Fields never exposed on the public site. */
const PRIVATE_FIELDS = '-owners -createdBy -deletedAt -clickCount -active';
const SIZE_FIELDS = 'name key colSpan rowSpan';

@Injectable()
export class BrandsService {
  constructor(
    @InjectModel(Brand.name) private readonly brands: Model<Brand>,
    @InjectModel(CardSize.name) private readonly sizes: Model<CardSize>,
    @InjectModel(Click.name) private readonly clicks: Model<Click>,
    @InjectModel(User.name) private readonly users: Model<User>,
  ) {}

  // ------------------------------------------------------------------ public

  /**
   * Public feed. Without a query the order is a shuffle that stays stable for
   * one visit: the client sends a per-visit `seed` and we sort by a hash of
   * seed + id — so every visit gets a new mix, yet pages never repeat or skip.
   * With a query, matches on the name rank above matches elsewhere.
   */
  async publicFeed(params: { q?: string; page?: string; limit?: string; seed?: string }) {
    const { page, limit, skip } = paging(params.page, params.limit, 60);
    const match: Record<string, unknown> = { active: true, deletedAt: null };
    const q = params.q?.trim().slice(0, 100);
    const stages: PipelineStage[] = [];

    if (q) {
      const rx = { $regex: escapeRegex(q), $options: 'i' };
      match.$or = [{ name: rx }, { tagline: rx }, { description: rx }, { tags: rx }];
      stages.push(
        { $match: match },
        {
          $addFields: {
            _rank: {
              $cond: [{ $regexMatch: { input: '$name', regex: `^${escapeRegex(q)}`, options: 'i' } }, 0,
                { $cond: [{ $regexMatch: { input: '$name', regex: escapeRegex(q), options: 'i' } }, 1, 2] }],
            },
          },
        },
        { $sort: { _rank: 1, name: 1, _id: 1 } },
      );
    } else {
      const seed = String(Math.abs(Math.floor(Number(params.seed) || 0)) % 2 ** 30);
      stages.push(
        { $match: match },
        { $addFields: { _rank: { $toHashedIndexKey: { $concat: [seed, ':', { $toString: '$_id' }] } } } },
        { $sort: { _rank: 1, _id: 1 } },
      );
    }

    const [result] = await this.brands.aggregate<{ items: Record<string, unknown>[]; total: { n: number }[] }>([
      ...stages,
      {
        $facet: {
          items: [
            { $skip: skip },
            { $limit: limit },
            { $lookup: { from: 'card_sizes', localField: 'cardSize', foreignField: '_id', as: 'cardSize' } },
            { $unwind: '$cardSize' },
            {
              $project: {
                name: 1, slug: 1, tagline: 1, description: 1, logoUrl: 1, bannerUrl: 1, accentColor: 1, tags: 1,
                'cardSize._id': 1, 'cardSize.key': 1, 'cardSize.name': 1, 'cardSize.colSpan': 1, 'cardSize.rowSpan': 1,
              },
            },
          ],
          total: [{ $count: 'n' }],
        },
      },
    ]);
    return paged(result.items, result.total[0]?.n ?? 0, page, limit);
  }

  async publicDetail(idOrSlug: string) {
    const key = Types.ObjectId.isValid(idOrSlug) ? { _id: idOrSlug } : { slug: idOrSlug.toLowerCase() };
    const brand = await this.brands
      .findOne({ ...key, active: true, deletedAt: null })
      .select(PRIVATE_FIELDS)
      .populate('cardSize', SIZE_FIELDS)
      .lean();
    if (!brand) throw new NotFoundException('Brand not found');
    return brand;
  }

  async recordClick(id: string, referrer = '') {
    const res = await this.brands.updateOne({ _id: id, active: true, deletedAt: null }, { $inc: { clickCount: 1 } });
    if (!res.matchedCount) throw new NotFoundException('Brand not found');
    await this.clicks.create({ brand: id, referrer: referrer.slice(0, 300) });
    return { ok: true };
  }

  // ------------------------------------------------------------------- admin

  async adminList(params: { q?: string; status?: string; size?: string; owner?: string; page?: string; limit?: string; sort?: string }) {
    const { page, limit, skip } = paging(params.page, params.limit);
    const filter: Record<string, unknown> = { deletedAt: null };
    if (params.q) {
      const rx = { $regex: escapeRegex(params.q.trim()), $options: 'i' };
      filter.$or = [{ name: rx }, { slug: rx }, { tagline: rx }, { description: rx }];
    }
    if (params.status === 'active') filter.active = true;
    if (params.status === 'inactive') filter.active = false;
    if (params.size && Types.ObjectId.isValid(params.size)) filter.cardSize = params.size;
    if (params.owner && Types.ObjectId.isValid(params.owner)) filter.owners = params.owner;

    const sort: Record<string, 1 | -1> =
      params.sort === 'clicks' ? { clickCount: -1, _id: -1 } : params.sort === 'name' ? { name: 1 } : { createdAt: -1 };
    const [items, total] = await Promise.all([
      this.brands
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .select('name slug tagline logoUrl bannerUrl accentColor active clickCount cardSize owners createdAt')
        .populate('cardSize', SIZE_FIELDS + ' price')
        .populate('owners', 'name email')
        .lean(),
      this.brands.countDocuments(filter),
    ]);
    return paged(items, total, page, limit);
  }

  async getFull(id: string) {
    const brand = await this.brands
      .findOne({ _id: id, deletedAt: null })
      .populate('cardSize', SIZE_FIELDS + ' price')
      .populate('owners', 'name email')
      .lean();
    if (!brand) throw new NotFoundException('Brand not found');
    return brand;
  }

  async create(dto: AdminBrandDto, actor: AuthUser) {
    if (!dto.name?.trim()) throw new BadRequestException('name is required');
    if (!dto.cardSizeId) throw new BadRequestException('cardSizeId is required');
    if (dto.ownerIds?.length && !hasPermission(actor.permissions, P.BRANDS_ASSIGN)) {
      throw new ForbiddenException(`Missing permission: ${P.BRANDS_ASSIGN}`);
    }
    await this.assertSize(dto.cardSizeId);
    const { cardSizeId, ownerIds, ...content } = dto;
    const brand = await this.brands.create({
      ...this.cleanContent(content),
      slug: await this.uniqueSlug(dto.name),
      cardSize: cardSizeId,
      owners: await this.validOwners(ownerIds ?? []),
      createdBy: actor.id,
    });
    return this.getFull(String(brand._id));
  }

  /** Admin edit. Size, status and owner changes each need their own permission. */
  async adminUpdate(id: string, dto: AdminBrandDto, actor: AuthUser) {
    const brand = await this.brands.findOne({ _id: id, deletedAt: null });
    if (!brand) throw new NotFoundException('Brand not found');
    const need = (perm: string) => {
      if (!hasPermission(actor.permissions, perm)) throw new ForbiddenException(`Missing permission: ${perm}`);
    };
    const { cardSizeId, active, ownerIds, ...content } = dto;

    if (cardSizeId !== undefined && cardSizeId !== String(brand.cardSize)) {
      need(P.BRANDS_RESIZE);
      await this.assertSize(cardSizeId);
      brand.cardSize = new Types.ObjectId(cardSizeId);
    }
    if (active !== undefined && active !== brand.active) {
      need(P.BRANDS_STATUS);
      brand.active = active;
    }
    if (ownerIds !== undefined) {
      need(P.BRANDS_ASSIGN);
      brand.owners = await this.validOwners(ownerIds);
    }
    if (Object.keys(content).length) {
      need(P.BRANDS_UPDATE);
      brand.set(this.cleanContent(content));
    }
    await brand.save();
    return this.getFull(id);
  }

  async softDelete(id: string) {
    const res = await this.brands.updateOne({ _id: id, deletedAt: null }, { deletedAt: new Date(), active: false });
    if (!res.matchedCount) throw new NotFoundException('Brand not found');
    return { ok: true };
  }

  // ------------------------------------------------------------------ owners

  async listOwned(userId: string) {
    return this.brands
      .find({ owners: userId, deletedAt: null })
      .sort({ name: 1 })
      .select('name slug tagline logoUrl bannerUrl accentColor active clickCount cardSize')
      .populate('cardSize', SIZE_FIELDS + ' price')
      .lean();
  }

  async getOwned(id: string, userId: string) {
    const brand = await this.brands
      .findOne({ _id: id, owners: userId, deletedAt: null })
      .select('-owners -createdBy')
      .populate('cardSize', SIZE_FIELDS + ' price')
      .lean();
    if (!brand) throw new NotFoundException('Brand not found');
    return brand;
  }

  async updateOwned(id: string, userId: string, dto: BrandContentDto) {
    const res = await this.brands.updateOne(
      { _id: id, owners: userId, deletedAt: null },
      { $set: this.cleanContent(dto) },
      { runValidators: true },
    );
    if (!res.matchedCount) throw new NotFoundException('Brand not found');
    return this.getOwned(id, userId);
  }

  async assertOwner(id: string, userId: string) {
    if (!(await this.brands.exists({ _id: id, owners: userId, deletedAt: null }))) {
      throw new NotFoundException('Brand not found');
    }
  }

  // ----------------------------------------------------------------- metrics

  /** Daily clicks for the last `days` days (zero-filled, UTC dates). */
  async dailyClicks(days: number, brandId?: string) {
    const span = Math.min(365, Math.max(1, Math.floor(days) || 30));
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - (span - 1));

    const match: Record<string, unknown> = { at: { $gte: start } };
    if (brandId) match.brand = new Types.ObjectId(brandId);
    const rows = await this.clicks.aggregate<{ _id: string; n: number }>([
      { $match: match },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$at' } }, n: { $sum: 1 } } },
    ]);
    const byDay = new Map(rows.map((r) => [r._id, r.n]));
    return Array.from({ length: span }, (_, i) => {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      const date = d.toISOString().slice(0, 10);
      return { date, clicks: byDay.get(date) ?? 0 };
    });
  }

  async brandMetrics(id: string, days: number) {
    const brand = await this.brands.findOne({ _id: id, deletedAt: null }).select('name clickCount').lean();
    if (!brand) throw new NotFoundException('Brand not found');
    const daily = await this.dailyClicks(days, id);
    return {
      brand: { _id: brand._id, name: brand.name },
      totalClicks: brand.clickCount,
      periodClicks: daily.reduce((sum, d) => sum + d.clicks, 0),
      daily,
    };
  }

  async summary(days: number) {
    const [daily, top, counts] = await Promise.all([
      this.dailyClicks(days),
      this.brands
        .find({ deletedAt: null })
        .sort({ clickCount: -1 })
        .limit(10)
        .select('name slug clickCount active accentColor logoUrl')
        .lean(),
      this.brands.aggregate<{ _id: boolean; n: number; clicks: number }>([
        { $match: { deletedAt: null } },
        { $group: { _id: '$active', n: { $sum: 1 }, clicks: { $sum: '$clickCount' } } },
      ]),
    ]);
    const active = counts.find((c) => c._id === true);
    const inactive = counts.find((c) => c._id === false);
    return {
      brands: { active: active?.n ?? 0, inactive: inactive?.n ?? 0 },
      totalClicks: (active?.clicks ?? 0) + (inactive?.clicks ?? 0),
      periodClicks: daily.reduce((sum, d) => sum + d.clicks, 0),
      users: await this.users.countDocuments(),
      daily,
      top,
    };
  }

  // ----------------------------------------------------------------- helpers

  private cleanContent(dto: BrandContentDto): Record<string, unknown> {
    const out: Record<string, unknown> = { ...dto };
    if (dto.name) out.name = dto.name.trim();
    if (dto.tags) out.tags = [...new Set(dto.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
    if (dto.contactNumbers) out.contactNumbers = dto.contactNumbers.map((n) => n.trim()).filter(Boolean);
    if (dto.metadata) {
      out.metadata = dto.metadata
        .filter((m) => m.label.trim())
        .map((m) => ({ key: m.key || null, label: m.label.trim(), type: m.type ?? 'text', value: m.value.trim() }));
    }
    return out;
  }

  private async uniqueSlug(name: string) {
    const base = slugify(name);
    let slug = base;
    for (let i = 2; await this.brands.exists({ slug }); i++) slug = `${base}-${i}`;
    return slug;
  }

  private async assertSize(id: string) {
    if (!(await this.sizes.exists({ _id: id }))) throw new BadRequestException('Card size not found');
  }

  private async validOwners(ids: string[]) {
    const unique = [...new Set(ids)];
    const found = await this.users.countDocuments({ _id: { $in: unique } });
    if (found !== unique.length) throw new BadRequestException('One or more owners do not exist');
    return unique.map((id) => new Types.ObjectId(id));
  }
}
