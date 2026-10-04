import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { Types } from 'mongoose';

export const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'brand';

@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!Types.ObjectId.isValid(value)) throw new BadRequestException('Invalid id');
    return value;
  }
}

export interface Paged<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export function paging(page?: string | number, limit?: string | number, maxLimit = 100) {
  const p = Math.max(1, Math.floor(Number(page) || 1));
  const l = Math.min(maxLimit, Math.max(1, Math.floor(Number(limit) || 20)));
  return { page: p, limit: l, skip: (p - 1) * l };
}

export const paged = <T>(items: T[], total: number, page: number, limit: number): Paged<T> => ({
  items,
  page,
  limit,
  total,
  hasMore: page * limit < total,
});
