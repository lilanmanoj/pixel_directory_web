'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  roleId: string | null;
  roleName: string | null;
  permissions: string[];
}

interface AuthState {
  user: SessionUser | null;
  loading: boolean;
  setUser: (user: SessionUser | null) => void;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  can: (permission: string) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setUser((await api.get<{ user: SessionUser | null }>('/auth/me')).user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await api.post('/auth/signout');
    setUser(null);
  }, []);

  const can = useCallback(
    (permission: string) => !!user && (user.permissions.includes('*') || user.permissions.includes(permission)),
    [user],
  );

  return (
    <AuthContext.Provider value={{ user, loading, setUser, refresh, signOut, can }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** Admin-area sections and the permission that reveals each. */
export const ADMIN_SECTIONS = [
  { href: '/admin', label: 'Overview', permission: 'metrics.view' },
  { href: '/admin/brands', label: 'Brands', permission: 'brands.read' },
  { href: '/admin/card-sizes', label: 'Card sizes & prices', permission: 'card-sizes.manage' },
  { href: '/admin/metadata-fields', label: 'Metadata fields', permission: 'metadata-fields.manage' },
  { href: '/admin/users', label: 'Users', permission: 'users.manage' },
  { href: '/admin/roles', label: 'Roles & permissions', permission: 'roles.manage' },
  { href: '/admin/payments', label: 'Payments', permission: 'payments.view' },
] as const;
