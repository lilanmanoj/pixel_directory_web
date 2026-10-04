import { Body, ConflictException, Controller, Delete, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Model } from 'mongoose';
import { Permissions } from '../common/decorators.js';
import { P } from '../common/permissions.js';
import { ParseObjectIdPipe } from '../common/utils.js';
import { METADATA_FIELD_TYPES, MetadataField } from '../schemas/index.js';

class MetadataFieldDto {
  @IsString() @MinLength(1) @MaxLength(60) label: string;
  @IsString() @Matches(/^[a-z0-9_-]{1,40}$/) key: string;
  @IsOptional() @IsIn(METADATA_FIELD_TYPES) type?: string;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

class UpdateMetadataFieldDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(60) label?: string;
  @IsOptional() @IsIn(METADATA_FIELD_TYPES) type?: string;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

/**
 * Shared metadata field definitions (e.g. "Opening hours", "Instagram").
 * Every brand form offers them; brands can also carry their own custom fields.
 */
@Controller()
export class MetadataFieldsController {
  constructor(@InjectModel(MetadataField.name) private readonly fields: Model<MetadataField>) {}

  @Get('metadata-fields')
  listActive() {
    return this.fields.find({ active: true }).sort({ sortOrder: 1, label: 1 }).lean();
  }

  @Get('admin/metadata-fields')
  @Permissions(P.METADATA_FIELDS_MANAGE)
  listAll() {
    return this.fields.find().sort({ sortOrder: 1, label: 1 }).lean();
  }

  @Post('admin/metadata-fields')
  @Permissions(P.METADATA_FIELDS_MANAGE)
  async create(@Body() dto: MetadataFieldDto) {
    if (await this.fields.exists({ key: dto.key })) throw new ConflictException('Key already exists');
    return (await this.fields.create(dto)).toObject();
  }

  @Patch('admin/metadata-fields/:id')
  @Permissions(P.METADATA_FIELDS_MANAGE)
  async update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateMetadataFieldDto) {
    const field = await this.fields.findByIdAndUpdate(id, dto, { returnDocument: 'after' }).lean();
    if (!field) throw new NotFoundException('Field not found');
    return field;
  }

  /** Values already stored on brands are kept (they become brand-specific fields). */
  @Delete('admin/metadata-fields/:id')
  @Permissions(P.METADATA_FIELDS_MANAGE)
  async remove(@Param('id', ParseObjectIdPipe) id: string) {
    const res = await this.fields.deleteOne({ _id: id });
    if (!res.deletedCount) throw new NotFoundException('Field not found');
    return { ok: true };
  }
}
