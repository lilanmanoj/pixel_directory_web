import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, Permissions, Public } from '../common/decorators.js';
import type { AuthUser } from '../common/decorators.js';
import { P } from '../common/permissions.js';
import { ParseObjectIdPipe } from '../common/utils.js';
import { AdminBrandDto, BrandContentDto } from './brand.dto.js';
import { BrandsService } from './brands.service.js';

@Controller('public/brands')
@Public()
export class PublicBrandsController {
  constructor(private readonly brands: BrandsService) {}

  @Get()
  feed(@Query('q') q?: string, @Query('page') page?: string, @Query('limit') limit?: string, @Query('seed') seed?: string) {
    return this.brands.publicFeed({ q, page, limit, seed });
  }

  @Get(':idOrSlug')
  detail(@Param('idOrSlug') idOrSlug: string) {
    return this.brands.publicDetail(idOrSlug);
  }

  @Post(':id/click')
  @HttpCode(200)
  click(@Param('id', ParseObjectIdPipe) id: string, @Headers('referer') referrer?: string) {
    return this.brands.recordClick(id, referrer);
  }
}

@Controller('admin')
export class AdminBrandsController {
  constructor(private readonly brands: BrandsService) {}

  @Get('brands')
  @Permissions(P.BRANDS_READ)
  list(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('size') size?: string,
    @Query('owner') owner?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.brands.adminList({ q, status, size, owner, sort, page, limit });
  }

  @Get('brands/:id')
  @Permissions(P.BRANDS_READ)
  get(@Param('id', ParseObjectIdPipe) id: string) {
    return this.brands.getFull(id);
  }

  @Post('brands')
  @Permissions(P.BRANDS_CREATE)
  create(@Body() dto: AdminBrandDto, @CurrentUser() user: AuthUser) {
    return this.brands.create(dto, user);
  }

  /** Field-level permissions (update / status / resize / assign) are checked in the service. */
  @Patch('brands/:id')
  @Permissions(P.BRANDS_READ)
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: AdminBrandDto, @CurrentUser() user: AuthUser) {
    return this.brands.adminUpdate(id, dto, user);
  }

  @Delete('brands/:id')
  @Permissions(P.BRANDS_DELETE)
  remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.brands.softDelete(id);
  }

  @Get('brands/:id/metrics')
  @Permissions(P.METRICS_VIEW)
  metrics(@Param('id', ParseObjectIdPipe) id: string, @Query('days') days?: string) {
    return this.brands.brandMetrics(id, Number(days) || 30);
  }

  @Get('metrics/summary')
  @Permissions(P.METRICS_VIEW)
  summary(@Query('days') days?: string) {
    return this.brands.summary(Number(days) || 30);
  }
}

/** Brands allocated to the signed-in user. */
@Controller('my/brands')
export class MyBrandsController {
  constructor(private readonly brands: BrandsService) {}

  @Get()
  @Permissions(P.OWN_BRANDS_READ)
  list(@CurrentUser() user: AuthUser) {
    return this.brands.listOwned(user.id);
  }

  @Get(':id')
  @Permissions(P.OWN_BRANDS_READ)
  get(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.brands.getOwned(id, user.id);
  }

  @Patch(':id')
  @Permissions(P.OWN_BRANDS_UPDATE)
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: BrandContentDto, @CurrentUser() user: AuthUser) {
    return this.brands.updateOwned(id, user.id, dto);
  }

  @Get(':id/metrics')
  @Permissions(P.OWN_BRANDS_METRICS)
  async metrics(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: AuthUser, @Query('days') days?: string) {
    await this.brands.assertOwner(id, user.id);
    return this.brands.brandMetrics(id, Number(days) || 30);
  }
}
