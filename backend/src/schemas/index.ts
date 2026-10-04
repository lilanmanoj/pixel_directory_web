import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

const options = { timestamps: true, versionKey: false } as const;

// ---------------------------------------------------------------- Permission
@Schema({ ...options, collection: 'permissions' })
export class Permission {
  @Prop({ required: true, unique: true, trim: true }) key: string;
  @Prop({ default: 'Custom', trim: true }) group: string;
  @Prop({ default: '' }) description: string;
  /** Built-in keys the API enforces; they cannot be deleted or renamed. */
  @Prop({ default: false }) isSystem: boolean;
}
export const PermissionSchema = SchemaFactory.createForClass(Permission);

// ---------------------------------------------------------------------- Role
@Schema({ ...options, collection: 'roles' })
export class Role {
  @Prop({ required: true, trim: true }) name: string;
  @Prop({ default: '' }) description: string;
  @Prop({ type: [String], default: [] }) permissions: string[];
  /** System roles (admin) cannot be deleted or stripped of the wildcard. */
  @Prop({ default: false }) isSystem: boolean;
  /** Role given to new sign-ups. Exactly one role should hold it. */
  @Prop({ default: false }) isDefault: boolean;
  @Prop({ type: Date, default: null }) deletedAt: Date | null;
}
export type RoleDocument = HydratedDocument<Role>;
export const RoleSchema = SchemaFactory.createForClass(Role);
RoleSchema.index({ name: 1 }, { unique: true, partialFilterExpression: { deletedAt: null } });

// ---------------------------------------------------------------------- User
@Schema({ ...options, collection: 'users' })
export class User {
  @Prop({ required: true, trim: true }) name: string;
  @Prop({ required: true, unique: true, lowercase: true, trim: true }) email: string;
  @Prop({ required: true, select: false }) passwordHash: string;
  @Prop({ type: Types.ObjectId, ref: 'Role', default: null }) role: Types.ObjectId | null;
  @Prop({ default: true }) active: boolean;
  @Prop({ type: Date, default: null }) lastLoginAt: Date | null;
}
export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);

// ------------------------------------------------------------------ CardSize
@Schema({ ...options, collection: 'card_sizes' })
export class CardSize {
  @Prop({ required: true, trim: true }) name: string;
  @Prop({ required: true, unique: true, trim: true, lowercase: true }) key: string;
  @Prop({ required: true, min: 1, max: 4 }) colSpan: number;
  @Prop({ required: true, min: 1, max: 4 }) rowSpan: number;
  /** Price of this tier, in major currency units. */
  @Prop({ required: true, min: 0 }) price: number;
  @Prop({ default: 0 }) sortOrder: number;
  @Prop({ default: true }) active: boolean;
}
export type CardSizeDocument = HydratedDocument<CardSize>;
export const CardSizeSchema = SchemaFactory.createForClass(CardSize);

// ------------------------------------------------------------- MetadataField
export const METADATA_FIELD_TYPES = ['text', 'textarea', 'url', 'phone', 'email', 'number'] as const;

@Schema({ ...options, collection: 'metadata_fields' })
export class MetadataField {
  @Prop({ required: true, trim: true }) label: string;
  @Prop({ required: true, unique: true, trim: true, lowercase: true }) key: string;
  @Prop({ type: String, enum: METADATA_FIELD_TYPES, default: 'text' }) type: string;
  @Prop({ default: 0 }) sortOrder: number;
  @Prop({ default: true }) active: boolean;
}
export const MetadataFieldSchema = SchemaFactory.createForClass(MetadataField);

// --------------------------------------------------------------------- Brand
@Schema({ _id: false, versionKey: false })
export class MetadataValue {
  /** Set when the value belongs to a shared MetadataField; empty for brand-specific fields. */
  @Prop({ type: String, default: null }) key: string | null;
  @Prop({ required: true, trim: true }) label: string;
  @Prop({ default: 'text' }) type: string;
  @Prop({ default: '' }) value: string;
}
const MetadataValueSchema = SchemaFactory.createForClass(MetadataValue);

@Schema({ ...options, collection: 'brands' })
export class Brand {
  @Prop({ required: true, trim: true }) name: string;
  @Prop({ required: true, unique: true, trim: true, lowercase: true }) slug: string;
  @Prop({ default: '', trim: true }) tagline: string;
  @Prop({ default: '' }) description: string;
  @Prop({ default: '' }) logoUrl: string;
  @Prop({ default: '' }) bannerUrl: string;
  @Prop({ type: [String], default: [] }) images: string[];
  @Prop({ type: [String], default: [] }) contactNumbers: string[];
  @Prop({ default: '' }) email: string;
  @Prop({ default: '' }) website: string;
  @Prop({ default: '' }) address: string;
  @Prop({ type: [String], default: [] }) tags: string[];
  @Prop({ default: '#7c8cff' }) accentColor: string;
  @Prop({ type: Types.ObjectId, ref: 'CardSize', required: true }) cardSize: Types.ObjectId;
  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] }) owners: Types.ObjectId[];
  @Prop({ type: [MetadataValueSchema], default: [] }) metadata: MetadataValue[];
  @Prop({ default: true }) active: boolean;
  @Prop({ default: 0 }) clickCount: number;
  @Prop({ type: Types.ObjectId, ref: 'User', default: null }) createdBy: Types.ObjectId | null;
  @Prop({ type: Date, default: null }) deletedAt: Date | null;
}
export type BrandDocument = HydratedDocument<Brand>;
export const BrandSchema = SchemaFactory.createForClass(Brand);
BrandSchema.index({ active: 1, deletedAt: 1 });
BrandSchema.index({ owners: 1 });

// --------------------------------------------------------------------- Click
@Schema({ versionKey: false, collection: 'clicks' })
export class Click {
  @Prop({ type: Types.ObjectId, ref: 'Brand', required: true }) brand: Types.ObjectId;
  @Prop({ type: Date, default: () => new Date() }) at: Date;
  @Prop({ default: '' }) referrer: string;
}
export const ClickSchema = SchemaFactory.createForClass(Click);
ClickSchema.index({ brand: 1, at: -1 });
ClickSchema.index({ at: -1 });

// ------------------------------------------------------------------- Payment
export const PAYMENT_STATUSES = ['pending', 'paid', 'cancelled', 'failed'] as const;

@Schema({ ...options, collection: 'payments' })
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'Brand', required: true }) brand: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) user: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'CardSize', required: true }) fromSize: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'CardSize', required: true }) toSize: Types.ObjectId;
  @Prop({ required: true, min: 0 }) amount: number;
  @Prop({ required: true }) currency: string;
  @Prop({ type: String, enum: PAYMENT_STATUSES, default: 'pending' }) status: string;
  @Prop({ required: true }) provider: string;
  @Prop({ default: '' }) providerRef: string;
  @Prop({ type: Date, default: null }) paidAt: Date | null;
}
export type PaymentDocument = HydratedDocument<Payment>;
export const PaymentSchema = SchemaFactory.createForClass(Payment);
