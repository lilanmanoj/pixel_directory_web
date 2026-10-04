import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import bcrypt from 'bcryptjs';
import { Model, Types } from 'mongoose';
import { P, SYSTEM_PERMISSIONS, WILDCARD } from '../common/permissions.js';
import { slugify } from '../common/utils.js';
import { config } from '../config.js';
import { Brand, CardSize, Click, MetadataField, Permission, Role, User } from '../schemas/index.js';

const DEFAULT_SIZES = [
  { key: 'small', name: 'Small', colSpan: 1, rowSpan: 1, price: 0, sortOrder: 1 },
  { key: 'wide', name: 'Wide', colSpan: 2, rowSpan: 1, price: 25, sortOrder: 2 },
  { key: 'tall', name: 'Tall', colSpan: 1, rowSpan: 2, price: 25, sortOrder: 3 },
  { key: 'large', name: 'Large', colSpan: 2, rowSpan: 2, price: 60, sortOrder: 4 },
];

const DEFAULT_FIELDS = [
  { key: 'opening_hours', label: 'Opening hours', type: 'text', sortOrder: 1 },
  { key: 'instagram', label: 'Instagram', type: 'url', sortOrder: 2 },
  { key: 'facebook', label: 'Facebook', type: 'url', sortOrder: 3 },
  { key: 'whatsapp', label: 'WhatsApp', type: 'phone', sortOrder: 4 },
];

const MEMBER_PERMISSIONS = [P.OWN_BRANDS_READ, P.OWN_BRANDS_UPDATE, P.OWN_BRANDS_METRICS, P.PAYMENTS_CREATE, P.UPLOADS_CREATE];

/**
 * Idempotent bootstrap: makes sure the built-in permissions, the admin and
 * member roles, the four default card sizes and an admin account exist.
 * Optionally (SEED_DEMO_DATA=true) fills an empty database with demo brands.
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly log = new Logger('Seed');

  constructor(
    @InjectModel(Permission.name) private readonly permissions: Model<Permission>,
    @InjectModel(Role.name) private readonly roles: Model<Role>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(CardSize.name) private readonly sizes: Model<CardSize>,
    @InjectModel(MetadataField.name) private readonly fields: Model<MetadataField>,
    @InjectModel(Brand.name) private readonly brands: Model<Brand>,
    @InjectModel(Click.name) private readonly clicks: Model<Click>,
  ) {}

  async onApplicationBootstrap() {
    if (!config.seed.onStart) return;
    await this.run();
  }

  async run() {
    for (const p of SYSTEM_PERMISSIONS) {
      await this.permissions.updateOne(
        { key: p.key },
        { $set: { group: p.group, description: p.description, isSystem: true } },
        { upsert: true },
      );
    }

    const admin = await this.ensureRole('Admin', {
      description: 'Full access to everything',
      permissions: [WILDCARD],
      isSystem: true,
    });
    await this.ensureRole('Member', {
      description: 'Default role for sign-ups: manage allocated brands and pay for upgrades',
      permissions: MEMBER_PERMISSIONS,
      isDefault: !(await this.roles.exists({ isDefault: true, deletedAt: null })),
    });

    if (!(await this.sizes.estimatedDocumentCount())) {
      await this.sizes.insertMany(DEFAULT_SIZES);
      this.log.log('Created default card sizes');
    }
    if (!(await this.fields.estimatedDocumentCount())) await this.fields.insertMany(DEFAULT_FIELDS);

    if (!(await this.users.exists({ role: admin._id }))) {
      const { adminEmail, adminName, adminPassword } = config.seed;
      const existing = await this.users.findOne({ email: adminEmail });
      if (existing) {
        existing.role = admin._id;
        await existing.save();
      } else {
        await this.users.create({
          name: adminName,
          email: adminEmail,
          passwordHash: await bcrypt.hash(adminPassword, 12),
          role: admin._id,
        });
      }
      this.log.log(`Admin account ready: ${adminEmail}`);
    }

    if (config.seed.demoData && !(await this.brands.estimatedDocumentCount())) await this.seedDemo();
  }

  private async ensureRole(name: string, data: Partial<Role>) {
    const role = await this.roles.findOne({ name, deletedAt: null });
    if (role) return role;
    return this.roles.create({ name, ...data });
  }

  private async seedDemo() {
    const sizes = await this.sizes.find().lean();
    const byKey = Object.fromEntries(sizes.map((s) => [s.key, s._id]));
    const member = await this.roles.findOne({ name: 'Member', deletedAt: null }).lean();
    const demoUser = await this.users.create({
      name: 'Demo Member',
      email: 'member@pixel.local',
      passwordHash: await bcrypt.hash('Member@12345', 12),
      role: member?._id ?? null,
    });

    const colors = ['#7c8cff', '#ff7ca8', '#3ec9a7', '#ffb547', '#58b4ff', '#b77cff', '#ff8a5c', '#5ddc7a'];
    const pattern = ['large', 'small', 'small', 'wide', 'tall', 'small', 'small', 'wide', 'small', 'tall', 'small', 'small'];
    const docs = DEMO_BRANDS.map(([name, tagline, tags], i) => {
      const slug = slugify(name);
      return {
        name,
        slug,
        tagline,
        description: `${tagline}. Demo listing: sign in as an admin to edit it, resize the card or upload real images.`,
        bannerUrl: i % 3 === 2 ? '' : `https://picsum.photos/seed/${slug}/900/900`,
        contactNumbers: ['+1 555 010 ' + String(1000 + i).slice(-4)],
        email: `hello@${slug}.example`,
        website: `https://${slug}.example`,
        address: `${10 + i} Glass Street, Crystal City`,
        tags: tags.split(','),
        accentColor: colors[i % colors.length],
        cardSize: byKey[pattern[i % pattern.length]] ?? sizes[0]._id,
        owners: i < 3 ? [demoUser._id] : [],
        metadata: [{ key: 'opening_hours', label: 'Opening hours', type: 'text', value: 'Mon–Sat 9:00–18:00' }],
        clickCount: 0,
      };
    });
    const created = await this.brands.insertMany(docs);

    // A month of synthetic clicks so the metrics screens have something to show.
    const now = Date.now();
    const clicks: { brand: Types.ObjectId; at: Date }[] = [];
    const counts = new Map<string, number>();
    for (const brand of created) {
      const n = Math.floor(Math.random() * 60);
      counts.set(String(brand._id), n);
      for (let k = 0; k < n; k++) clicks.push({ brand: brand._id, at: new Date(now - Math.random() * 30 * 864e5) });
    }
    if (clicks.length) await this.clicks.insertMany(clicks);
    await this.brands.bulkWrite(
      [...counts].map(([id, n]) => ({ updateOne: { filter: { _id: id }, update: { clickCount: n } } })),
    );
    this.log.log(`Seeded ${created.length} demo brands and demo user member@pixel.local`);
  }
}

const DEMO_BRANDS: [string, string, string][] = [
  ['Aurora Coffee Roasters', 'Small-batch beans roasted daily', 'coffee,cafe'],
  ['Nimbus Cloud Hosting', 'Fast, quiet, reliable servers', 'tech,hosting'],
  ['Petal & Stem', 'Fresh flowers delivered same day', 'flowers,gifts'],
  ['Summit Outdoor Gear', 'Built for the long trail', 'outdoor,sports'],
  ['Lumen Optics', 'Eyewear with a lifetime warranty', 'eyewear,fashion'],
  ['Harbor Fish Market', 'Caught this morning, on your table tonight', 'food,seafood'],
  ['Pixel Forge Studio', 'Brand identity and web design', 'design,agency'],
  ['Velvet Room Cinema', 'Indie films and craft popcorn', 'cinema,entertainment'],
  ['Greenline Bikes', 'E-bikes and repairs', 'bikes,transport'],
  ['Copper Kettle Bakery', 'Sourdough since 1998', 'bakery,food'],
  ['Atlas Language School', 'Speak confidently in 12 weeks', 'education,languages'],
  ['Northwind Yoga', 'Classes for every body', 'fitness,wellness'],
  ['Saffron Table', 'Modern Indian kitchen', 'restaurant,food'],
  ['Bright Paws Vet', 'Gentle care for pets', 'pets,health'],
  ['Mosaic Home Interiors', 'Spaces that feel like you', 'interiors,home'],
  ['Tidal Surf School', 'Lessons for all levels', 'surf,sports'],
  ['Quartz Legal', 'Plain-English legal advice', 'legal,services'],
  ['Ember Pizza Co.', 'Wood-fired, hand-stretched', 'pizza,food'],
  ['Orbit Electronics', 'Repairs while you wait', 'electronics,repair'],
  ['Willow Bookshop', 'New, used and rare books', 'books,shop'],
  ['Cobalt Car Wash', 'Spotless in 10 minutes', 'cars,services'],
  ['Hearth Candle Co.', 'Hand-poured soy candles', 'gifts,home'],
  ['Meridian Travel', 'Trips planned around you', 'travel,agency'],
  ['Fable Toys', 'Wooden toys that last', 'toys,kids'],
  ['Juniper Dental', 'Comfortable, modern dentistry', 'dental,health'],
  ['Granite Fitness', '24/7 strength gym', 'gym,fitness'],
  ['Lantern Tea House', 'Rare teas from small farms', 'tea,cafe'],
  ['Prism Print Shop', 'Posters, cards and merch', 'print,design'],
  ['Solstice Solar', 'Rooftop solar made simple', 'energy,home'],
  ['Maple & Main Barbers', 'Classic cuts, hot towel shaves', 'barber,beauty'],
  ['Cascade Plumbing', 'Same-day emergency call-outs', 'plumbing,services'],
  ['Indigo Art Supplies', 'Everything for makers', 'art,shop'],
  ['Kite Coworking', 'Desks, rooms and good coffee', 'workspace,business'],
  ['Basil Vegan Kitchen', 'Plant-based comfort food', 'vegan,restaurant'],
  ['Echo Music Lessons', 'Guitar, piano and voice', 'music,education'],
  ['Silverline Jewelers', 'Custom rings and repairs', 'jewelry,fashion'],
];
