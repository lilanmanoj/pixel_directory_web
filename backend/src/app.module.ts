import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthController } from './auth/auth.controller.js';
import { AdminBrandsController, MyBrandsController, PublicBrandsController } from './brands/brands.controller.js';
import { BrandsService } from './brands/brands.service.js';
import { CardSizesController } from './card-sizes/card-sizes.controller.js';
import { AuthGuard } from './common/auth.guard.js';
import { HealthController } from './health.controller.js';
import { config } from './config.js';
import { MetadataFieldsController } from './metadata-fields/metadata-fields.controller.js';
import { PaymentsController } from './payments/payments.controller.js';
import { PaymentsService } from './payments/payments.service.js';
import { PermissionsController, RolesController } from './roles/roles.controller.js';
import { DatabaseModule } from './schemas/database.module.js';
import { SeedService } from './seed/seed.service.js';
import { UploadsController } from './uploads/uploads.controller.js';
import { UsersController } from './users/users.controller.js';

@Module({
  imports: [
    MongooseModule.forRoot(config.mongoUri),
    DatabaseModule,
    JwtModule.register({ global: true, secret: config.jwtSecret, signOptions: { expiresIn: config.jwtExpiresInSeconds } }),
  ],
  controllers: [
    HealthController,
    AuthController,
    UsersController,
    RolesController,
    PermissionsController,
    CardSizesController,
    MetadataFieldsController,
    PublicBrandsController,
    AdminBrandsController,
    MyBrandsController,
    PaymentsController,
    UploadsController,
  ],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }, BrandsService, PaymentsService, SeedService],
})
export class AppModule {}
