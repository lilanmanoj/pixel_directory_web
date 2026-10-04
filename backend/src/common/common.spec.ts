import { hasPermission, P, WILDCARD } from './permissions.js';
import { escapeRegex, paged, paging, slugify } from './utils.js';

describe('hasPermission', () => {
  it('grants listed permissions only', () => {
    expect(hasPermission([P.BRANDS_READ], P.BRANDS_READ)).toBe(true);
    expect(hasPermission([P.BRANDS_READ], P.BRANDS_UPDATE)).toBe(false);
    expect(hasPermission([], P.BRANDS_READ)).toBe(false);
  });

  it('treats the wildcard as every permission', () => {
    expect(hasPermission([WILDCARD], P.ROLES_MANAGE)).toBe(true);
  });
});

describe('slugify', () => {
  it('produces url-safe slugs', () => {
    expect(slugify('Petal & Stem')).toBe('petal-stem');
    expect(slugify('  Café Crème!! ')).toBe('cafe-creme');
    expect(slugify('***')).toBe('brand');
  });
});

describe('escapeRegex', () => {
  it('neutralises regex metacharacters', () => {
    const rx = new RegExp(escapeRegex('a.b*(c)'));
    expect(rx.test('a.b*(c)')).toBe(true);
    expect(rx.test('axbbb(c)')).toBe(false);
  });
});

describe('paging', () => {
  it('clamps page and limit', () => {
    expect(paging('0', '1000', 60)).toEqual({ page: 1, limit: 60, skip: 0 });
    expect(paging('3', '10')).toEqual({ page: 3, limit: 10, skip: 20 });
    expect(paging(undefined, 'abc')).toEqual({ page: 1, limit: 20, skip: 0 });
  });

  it('reports whether more pages exist', () => {
    expect(paged([1, 2], 5, 1, 2).hasMore).toBe(true);
    expect(paged([5], 5, 3, 2).hasMore).toBe(false);
  });
});
