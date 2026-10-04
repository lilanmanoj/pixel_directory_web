import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { paged, paging } from '../common/utils.js';
import { config } from '../config.js';
import { Brand, CardSize, Payment } from '../schemas/index.js';

/**
 * A payment provider turns a pending Payment into somewhere the user can pay.
 * Only the `mock` provider ships; a real gateway (Stripe, PayHere, …) would
 * implement this and confirm payments from its webhook via `markPaid`.
 */
interface PaymentProvider {
  name: string;
  startCheckout(payment: { id: string }): Promise<{ providerRef: string; checkoutUrl: string }>;
}

const mockProvider: PaymentProvider = {
  name: 'mock',
  async startCheckout(payment) {
    return { providerRef: `mock_${payment.id}`, checkoutUrl: `/dashboard/checkout/${payment.id}` };
  },
};

/** Card number the mock gateway always declines, for testing the failure path. */
export const MOCK_DECLINE_CARD = '4000000000000002';

@Injectable()
export class PaymentsService {
  private readonly provider: PaymentProvider;

  constructor(
    @InjectModel(Payment.name) private readonly payments: Model<Payment>,
    @InjectModel(Brand.name) private readonly brands: Model<Brand>,
    @InjectModel(CardSize.name) private readonly sizes: Model<CardSize>,
  ) {
    if (config.paymentProvider !== 'mock') {
      throw new Error(`Unsupported PAYMENT_PROVIDER "${config.paymentProvider}" (only "mock" is implemented)`);
    }
    this.provider = mockProvider;
  }

  /**
   * Starts a size change for an owner. The owner pays the price difference
   * between tiers; moving to an equal or cheaper tier is applied immediately.
   */
  async checkout(userId: string, brandId: string, cardSizeId: string) {
    const brand = await this.brands.findOne({ _id: brandId, owners: userId, deletedAt: null });
    if (!brand) throw new NotFoundException('Brand not found');
    const [from, to] = await Promise.all([
      this.sizes.findById(brand.cardSize).lean(),
      this.sizes.findOne({ _id: cardSizeId, active: true }).lean(),
    ]);
    if (!to) throw new BadRequestException('That card size is not available');
    if (String(to._id) === String(brand.cardSize)) throw new BadRequestException('The brand already uses this size');

    const amount = Math.max(0, Math.round(((to.price ?? 0) - (from?.price ?? 0)) * 100) / 100);
    if (amount === 0) {
      brand.cardSize = to._id;
      await brand.save();
      return { status: 'applied' as const, amount: 0, currency: config.currency };
    }

    // Reuse an open checkout for the same change instead of piling up pending payments.
    const existing = await this.payments
      .findOne({ brand: brand._id, user: userId, toSize: to._id, status: 'pending' })
      .lean();
    const payment =
      existing ??
      (await this.payments.create({
        brand: brand._id,
        user: userId,
        fromSize: brand.cardSize,
        toSize: to._id,
        amount,
        currency: config.currency,
        provider: this.provider.name,
      }));
    const { providerRef, checkoutUrl } = await this.provider.startCheckout({ id: String(payment._id) });
    if (!existing) await this.payments.updateOne({ _id: payment._id }, { providerRef });
    return { status: 'pending' as const, paymentId: String(payment._id), amount, currency: config.currency, checkoutUrl };
  }

  async getForUser(id: string, userId: string) {
    const payment = await this.payments
      .findOne({ _id: id, user: userId })
      .populate('brand', 'name slug logoUrl accentColor')
      .populate('fromSize toSize', 'name key colSpan rowSpan price')
      .lean();
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  /** Mock gateway confirmation. A real provider would call markPaid from its webhook. */
  async confirmMock(id: string, userId: string, cardNumber: string) {
    const payment = await this.payments.findOne({ _id: id, user: userId, status: 'pending' });
    if (!payment) throw new BadRequestException('This payment is not awaiting confirmation');
    if (cardNumber.replace(/\s/g, '') === MOCK_DECLINE_CARD) {
      payment.status = 'failed';
      await payment.save();
      throw new BadRequestException('Card declined (mock gateway)');
    }
    await this.markPaid(id);
    return this.getForUser(id, userId);
  }

  async cancel(id: string, userId: string) {
    const res = await this.payments.updateOne({ _id: id, user: userId, status: 'pending' }, { status: 'cancelled' });
    if (!res.matchedCount) throw new BadRequestException('This payment cannot be cancelled');
    return { ok: true };
  }

  /** Atomically flips pending → paid, then applies the purchased size. */
  async markPaid(id: string) {
    const payment = await this.payments.findOneAndUpdate(
      { _id: id, status: 'pending' },
      { status: 'paid', paidAt: new Date() },
      { returnDocument: 'after' },
    );
    if (!payment) return;
    await this.brands.updateOne({ _id: payment.brand }, { cardSize: payment.toSize });
  }

  listForUser(userId: string) {
    return this.payments
      .find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('brand', 'name')
      .populate('fromSize toSize', 'name')
      .lean();
  }

  async listAll(params: { status?: string; page?: string; limit?: string }) {
    const { page, limit, skip } = paging(params.page, params.limit);
    const filter = params.status ? { status: params.status } : {};
    const [items, total, revenue] = await Promise.all([
      this.payments
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('brand', 'name')
        .populate('user', 'name email')
        .populate('fromSize toSize', 'name')
        .lean(),
      this.payments.countDocuments(filter),
      this.payments.aggregate<{ total: number }>([
        { $match: { status: 'paid' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);
    return { ...paged(items, total, page, limit), revenue: revenue[0]?.total ?? 0, currency: config.currency };
  }
}
