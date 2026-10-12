import { db } from './client';
import { workspaces, users, stores, products, shifts, blocks } from './schema';

export async function seedDatabase() {
  console.log('🌱 Seeding Project BLOC Turso Database...');

  // 1. Workspace
  const workspaceId = 'ws-japac-retail';
  await db.insert(workspaces).values({
    id: workspaceId,
    name: 'JAPAC Retail Operations',
    baseCurrency: 'SGD',
    driveFolderId: 'drive-folder-bloc-media-vault',
    sheetSyncId: 'sheets-japac-ops-sync-id',
    createdAt: new Date(),
  }).onConflictDoNothing();

  // 2. Users (Promoters & Supervisors)
  await db.insert(users).values([
    {
      id: 'usr-sarah-sg',
      workspaceId,
      name: 'Sarah Tan',
      email: 'sarah.tan@retailops.ai',
      phone: '+65 9123 4567',
      role: 'promoter',
      preferredLanguage: 'en-SG',
      timezone: 'Asia/Singapore',
      createdAt: new Date(),
    },
    {
      id: 'usr-liza-ph',
      workspaceId,
      name: 'Liza Santos',
      email: 'liza.santos@retailops.ai',
      phone: '+63 917 555 1234',
      role: 'promoter',
      preferredLanguage: 'tl-PH', // Tagalog
      timezone: 'Asia/Manila',
      createdAt: new Date(),
    },
    {
      id: 'usr-lester-lead',
      workspaceId,
      name: 'Lester Alarcon',
      email: 'lester.alarcon@retailops.ai',
      phone: '+63 918 888 9999',
      role: 'supervisor',
      preferredLanguage: 'en',
      timezone: 'Asia/Manila',
      createdAt: new Date(),
    },
  ]).onConflictDoNothing();

  // 3. Stores
  await db.insert(stores).values([
    {
      id: 'store-fp-vivo',
      workspaceId,
      storeCode: 'FP-VIVO-01',
      name: 'FairPrice Xtra VivoCity',
      chain: 'FairPrice',
      country: 'SG',
      city: 'Singapore',
      latitude: 1.2644,
      longitude: 103.8222,
      geofenceRadiusMeters: 150,
      dailyTargetDefault: 1200,
      currency: 'SGD',
    },
    {
      id: 'store-sm-mega',
      workspaceId,
      storeCode: 'SM-MEGA-01',
      name: 'SM Megamall Cyberzone',
      chain: 'SM Supermalls',
      country: 'PH',
      city: 'Mandaluyong, Metro Manila',
      latitude: 14.5842,
      longitude: 121.0567,
      geofenceRadiusMeters: 200,
      dailyTargetDefault: 25000,
      currency: 'PHP',
    },
  ]).onConflictDoNothing();

  // 4. Products (Focus Promo SKUs + Catalog Items)
  await db.insert(products).values([
    {
      id: 'prod-bundle-a',
      workspaceId,
      skuCode: 'BUNDLE-PROMO-A',
      barcode: '8806091234567',
      name: 'Family Breakfast Bundle A',
      category: 'FMCG',
      unitPrice: 499,
      currency: 'PHP',
      commissionPerUnit: 25,
      isFocusPromo: true, // Pinned to Fast-Sale Stepper
      displayOrder: 1,
    },
    {
      id: 'prod-oled-55',
      workspaceId,
      skuCode: 'OLED-55-4K',
      barcode: '8806097654321',
      name: '55" 4K OLED HDR Smart TV',
      category: 'Consumer Electronics',
      unitPrice: 1299,
      currency: 'SGD',
      commissionPerUnit: 40,
      isFocusPromo: true,
      displayOrder: 2,
    },
    {
      id: 'prod-soundbar-31',
      workspaceId,
      skuCode: 'SNDBAR-31-CH',
      barcode: '8806099988776',
      name: 'Wireless 3.1ch Soundbar System',
      category: 'Audio',
      unitPrice: 349,
      currency: 'SGD',
      commissionPerUnit: 15,
      isFocusPromo: true,
      displayOrder: 3,
    },
  ]).onConflictDoNothing();

  console.log('✅ Database seeded successfully with demo stores, promoters, and focus SKUs!');
}
