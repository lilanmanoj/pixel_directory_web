import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser, Permissions } from '../common/decorators.js';
import type { AuthUser } from '../common/decorators.js';
import { P } from '../common/permissions.js';
import { ParseObjectIdPipe } from '../common/utils.js';
import { PaymentsService } from './payments.service.js';

class CheckoutDto {
  @IsMongoId() brandId: string;
  @IsMongoId() cardSizeId: string;
}

class ConfirmDto {
  @IsOptional() @IsString() @MaxLength(30) cardNumber?: string;
}

@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('payments/checkout')
  @Permissions(P.PAYMENTS_CREATE)
  checkout(@Body() dto: CheckoutDto, @CurrentUser() user: AuthUser) {
    return this.payments.checkout(user.id, dto.brandId, dto.cardSizeId);
  }

  @Get('payments/:id')
  @Permissions(P.PAYMENTS_CREATE)
  get(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.payments.getForUser(id, user.id);
  }

  @Post('payments/:id/confirm')
  @HttpCode(200)
  @Permissions(P.PAYMENTS_CREATE)
  confirm(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: ConfirmDto, @CurrentUser() user: AuthUser) {
    return this.payments.confirmMock(id, user.id, dto.cardNumber ?? '');
  }

  @Post('payments/:id/cancel')
  @HttpCode(200)
  @Permissions(P.PAYMENTS_CREATE)
  cancel(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.payments.cancel(id, user.id);
  }

  @Get('my/payments')
  mine(@CurrentUser() user: AuthUser) {
    return this.payments.listForUser(user.id);
  }

  @Get('admin/payments')
  @Permissions(P.PAYMENTS_VIEW)
  all(@Query('status') status?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.payments.listAll({ status, page, limit });
  }
}
