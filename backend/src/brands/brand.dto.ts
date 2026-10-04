import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { METADATA_FIELD_TYPES } from '../schemas/index.js';

/** http(s) URLs or files served from our own /uploads — never javascript: or data: URLs. */
const MEDIA_URL = /^(https?:\/\/\S+|\/uploads\/[\w.-]+)$/;
const WEB_URL = /^https?:\/\/\S+$/;
const allowEmpty = (_: unknown, v: unknown) => v !== '';

export class MetadataValueDto {
  @IsOptional() @IsString() @MaxLength(40) key?: string | null;
  @IsString() @MinLength(1) @MaxLength(60) label: string;
  @IsOptional() @IsIn(METADATA_FIELD_TYPES) type?: string;
  @IsString() @MaxLength(2000) value: string;
}

/** Content an allocated owner may change. Admins can change these too. */
export class BrandContentDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(140) tagline?: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @ValidateIf(allowEmpty) @Matches(MEDIA_URL, { message: 'logoUrl must be an http(s) or uploaded image URL' })
  logoUrl?: string;
  @IsOptional() @ValidateIf(allowEmpty) @Matches(MEDIA_URL, { message: 'bannerUrl must be an http(s) or uploaded image URL' })
  bannerUrl?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(12) @Matches(MEDIA_URL, { each: true, message: 'images must be image URLs' })
  images?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(6) @IsString({ each: true }) @Matches(/^[+\d][\d\s()-]{3,24}$/, { each: true, message: 'contactNumbers must be phone numbers' })
  contactNumbers?: string[];
  @IsOptional() @ValidateIf(allowEmpty) @IsEmail() email?: string;
  @IsOptional() @ValidateIf(allowEmpty) @Matches(WEB_URL, { message: 'website must start with http:// or https://' })
  website?: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(12) @IsString({ each: true }) @MaxLength(30, { each: true }) tags?: string[];
  @IsOptional() @Matches(/^#[0-9a-fA-F]{6}$/) accentColor?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => MetadataValueDto)
  metadata?: MetadataValueDto[];
}

export class AdminBrandDto extends BrandContentDto {
  @IsOptional() @IsMongoId() cardSizeId?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsMongoId({ each: true }) ownerIds?: string[];
}
