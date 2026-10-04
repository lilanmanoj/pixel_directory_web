export interface CardSize {
  _id: string;
  name: string;
  key: string;
  colSpan: number;
  rowSpan: number;
  price?: number;
  sortOrder?: number;
  active?: boolean;
  brandCount?: number;
}

export interface MetadataValue {
  key?: string | null;
  label: string;
  type?: string;
  value: string;
}

export interface MetadataField {
  _id: string;
  key: string;
  label: string;
  type: string;
  sortOrder: number;
  active: boolean;
}

export interface UserRef {
  _id: string;
  name: string;
  email: string;
}

export interface Brand {
  _id: string;
  name: string;
  slug: string;
  tagline?: string;
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  images?: string[];
  contactNumbers?: string[];
  email?: string;
  website?: string;
  address?: string;
  tags?: string[];
  accentColor?: string;
  cardSize: CardSize;
  metadata?: MetadataValue[];
  active?: boolean;
  clickCount?: number;
  owners?: UserRef[];
  createdAt?: string;
}

export interface Paged<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface Role {
  _id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  isDefault: boolean;
  deletedAt: string | null;
  userCount?: number;
}

export interface Permission {
  _id: string;
  key: string;
  group: string;
  description: string;
  isSystem: boolean;
}

export interface AdminUser {
  _id: string;
  name: string;
  email: string;
  active: boolean;
  role: { _id: string; name: string; deletedAt: string | null } | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface DailyPoint {
  date: string;
  clicks: number;
}

export interface BrandMetrics {
  brand: { _id: string; name: string };
  totalClicks: number;
  periodClicks: number;
  daily: DailyPoint[];
}

export interface Payment {
  _id: string;
  brand: { _id: string; name: string; logoUrl?: string; accentColor?: string } | null;
  user?: UserRef | null;
  fromSize: CardSize | null;
  toSize: CardSize | null;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'cancelled' | 'failed';
  provider: string;
  paidAt: string | null;
  createdAt: string;
}
