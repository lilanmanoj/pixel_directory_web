const env = process.env;

const bool = (value: string | undefined, fallback: boolean) =>
  value === undefined ? fallback : ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());

export const config = {
  port: Number(env.PORT ?? 4000),
  mongoUri: env.MONGODB_URI ?? 'mongodb://localhost:27017/pixel_directory',
  jwtSecret: env.JWT_SECRET ?? 'dev-only-change-me',
  jwtExpiresInSeconds: Number(env.JWT_EXPIRES_IN_SECONDS ?? 60 * 60 * 24 * 7),
  cookieName: env.AUTH_COOKIE_NAME ?? 'pd_token',
  cookieSecure: bool(env.COOKIE_SECURE, false),
  corsOrigins: (env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  uploadDir: env.UPLOAD_DIR ?? './uploads',
  maxUploadBytes: Number(env.MAX_UPLOAD_MB ?? 5) * 1024 * 1024,
  paymentProvider: env.PAYMENT_PROVIDER ?? 'mock',
  currency: env.CURRENCY ?? 'USD',
  seed: {
    onStart: bool(env.SEED_ON_START, true),
    demoData: bool(env.SEED_DEMO_DATA, false),
    adminName: env.ADMIN_NAME ?? 'Administrator',
    adminEmail: (env.ADMIN_EMAIL ?? 'admin@pixel.local').toLowerCase(),
    adminPassword: env.ADMIN_PASSWORD ?? 'Admin@12345',
  },
};

if (env.NODE_ENV === 'production' && config.jwtSecret === 'dev-only-change-me') {
  throw new Error('JWT_SECRET must be set in production');
}
