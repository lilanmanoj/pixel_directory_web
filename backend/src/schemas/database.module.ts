import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Brand,
  BrandSchema,
  CardSize,
  CardSizeSchema,
  Click,
  ClickSchema,
  MetadataField,
  MetadataFieldSchema,
  Payment,
  PaymentSchema,
  Permission,
  PermissionSchema,
  Role,
  RoleSchema,
  User,
  UserSchema,
} from './index.js';

const models = MongooseModule.forFeature([
  { name: Permission.name, schema: PermissionSchema },
  { name: Role.name, schema: RoleSchema },
  { name: User.name, schema: UserSchema },
  { name: CardSize.name, schema: CardSizeSchema },
  { name: MetadataField.name, schema: MetadataFieldSchema },
  { name: Brand.name, schema: BrandSchema },
  { name: Click.name, schema: ClickSchema },
  { name: Payment.name, schema: PaymentSchema },
]);

/** Registers every model once so feature modules can inject any of them. */
@Global()
@Module({ imports: [models], exports: [models] })
export class DatabaseModule {}
