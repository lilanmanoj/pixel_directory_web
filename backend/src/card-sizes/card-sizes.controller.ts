import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Model } from 'mongoose';
import { Permissions, Public } from '../common/decorators.js';
import { P } from '../common/permissions.js';
import { ParseObjectIdPipe } from '../common/utils.js';
import { config } from '../config.js';
import { Brand, CardSize } from '../schemas/index.js';

class CardSizeDto {
  @IsString() @MinLength(2) @MaxLength(40) name: string;
  @IsString() @Matches(/^[a-z0-9-]{2,30}$/) key: string;
  @IsInt() @Min(1) @Max(4) colSpan: number;
  @IsInt() @Min(1) @Max(4) rowSpan: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) price: number;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

class UpdateCardSizeDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(40) name?: string;
  @IsOptional() @IsInt() @Min(1) @Max(4) colSpan?: number;
  @IsOptional() @IsInt() @Min(1) @Max(4) rowSpan?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) price?: number;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

@Controller()
export class CardSizesController {
  constructor(
    @InjectModel(CardSize.name) private readonly sizes: Model<CardSize>,
    @InjectModel(Brand.name) private readonly brands: Model<Brand>,
  ) {}

  /** Active tiers with prices — shown to owners choosing an upgrade. */
  @Public()
  @Get('card-sizes')
  async listActive() {
    const items = await this.sizes.find({ active: true }).sort({ sortOrder: 1, price: 1 }).lean();
    return { currency: config.currency, items };
  }

  @Get('admin/card-sizes')
  @Permissions(P.CARD_SIZES_MANAGE)
  async listAll() {
    const items = await this.sizes.find().sort({ sortOrder: 1, price: 1 }).lean();
    const usage = await this.brands.aggregate<{ _id: unknown; n: number }>([
      { $match: { deletedAt: null } },
      { $group: { _id: '$cardSize', n: { $sum: 1 } } },
    ]);
    const byId = new Map(usage.map((u) => [String(u._id), u.n]));
    return { currency: config.currency, items: items.map((s) => ({ ...s, brandCount: byId.get(String(s._id)) ?? 0 })) };
  }

  @Post('admin/card-sizes')
  @Permissions(P.CARD_SIZES_MANAGE)
  async create(@Body() dto: CardSizeDto) {
    if (await this.sizes.exists({ key: dto.key })) throw new ConflictException('Key already exists');
    return (await this.sizes.create(dto)).toObject();
  }

  @Patch('admin/card-sizes/:id')
  @Permissions(P.CARD_SIZES_MANAGE)
  async update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateCardSizeDto) {
    const size = await this.sizes.findByIdAndUpdate(id, dto, { returnDocument: 'after' }).lean();
    if (!size) throw new NotFoundException('Card size not found');
    return size;
  }

  @Delete('admin/card-sizes/:id')
  @Permissions(P.CARD_SIZES_MANAGE)
  async remove(@Param('id', ParseObjectIdPipe) id: string) {
    if (await this.brands.exists({ cardSize: id, deletedAt: null })) {
      throw new BadRequestException('Brands still use this size — deactivate it instead, or move them first');
    }
    const res = await this.sizes.deleteOne({ _id: id });
    if (!res.deletedCount) throw new NotFoundException('Card size not found');
    return { ok: true };
  }
}
