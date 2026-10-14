import { db } from './client.js';
import { workspaces, users, stores, storeAssignments, products, shifts, shelfAudits, paymentMethods, paymentTerms, aiGovernanceConfigs } from './schema.js';
import { ensureTablesAndColumns } from './ensure_schema.js';

export async function seedDatabase() {
  console.log('🌱 Seeding Project BLOC Database with registered master entries...');
  await ensureTablesAndColumns();

  // 1. Workspace
  const workspaceId = 'ws-japac-retail';
  await db.insert(workspaces).values({
    id: workspaceId,
    slug: 'japac-retail',
    name: 'JAPAC Retail Operations',
    baseCurrency: 'SGD',
    driveFolderId: 'drive-folder-bloc-media-vault',
    sheetSyncId: 'sheets-japac-ops-sync-id',
    createdAt: new Date(),
  } as any).onConflictDoNothing();

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
  ] as any).onConflictDoNothing();

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
  ] as any).onConflictDoNothing();

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
    {
      id: 'prod-smart-tv-43',
      workspaceId,
      skuCode: 'SMART-43-UHD',
      barcode: '8806093322114',
      name: '43" UHD 4K Smart Display',
      category: 'Consumer Electronics',
      unitPrice: 14990,
      currency: 'PHP',
      commissionPerUnit: 350,
      isFocusPromo: true,
      displayOrder: 2,
    },
  ] as any).onConflictDoNothing();

  // 5. Store Assignments (Roster)
  await db.insert(storeAssignments).values([
    {
      id: 'assign-sarah-vivo',
      workspaceId,
      userId: 'usr-sarah-sg',
      storeId: 'store-fp-vivo',
      assignedTarget: 1200,
      active: true,
    },
    {
      id: 'assign-liza-mega',
      workspaceId,
      userId: 'usr-liza-ph',
      storeId: 'store-sm-mega',
      assignedTarget: 25000,
      active: true,
    },
  ] as any).onConflictDoNothing();

  // 6. Active Shifts
  const todayDate = new Date().toISOString().split('T')[0];
  await db.insert(shifts).values([
    {
      id: 'shift-sarah-seed',
      userId: 'usr-sarah-sg',
      storeId: 'store-fp-vivo',
      shiftDate: todayDate,
      clockInTime: new Date(),
      gpsVerified: true,
      targetAmount: 1200,
      currency: 'SGD',
      status: 'active',
    },
    {
      id: 'shift-liza-seed',
      userId: 'usr-liza-ph',
      storeId: 'store-sm-mega',
      shiftDate: todayDate,
      clockInTime: new Date(),
      gpsVerified: true,
      targetAmount: 25000,
      currency: 'PHP',
      status: 'active',
    },
  ] as any).onConflictDoNothing();

  // 7. Initial Seed Shelf Audits
  await db.insert(shelfAudits).values([
    {
      id: 'audit-fp-vivo-01',
      shiftId: 'shift-sarah-seed',
      userId: 'usr-sarah-sg',
      storeId: 'store-fp-vivo',
      driveImageId: 'drive-vivo-shelf-01',
      complianceScore: 95,
      shareOfShelfPct: 42,
      detectedIssues: ['Minor spacing gap on shelf 3'],
      geminiVerdict: 'Near-perfect endcap execution aligned with Q4 retail planogram.',
      timestamp: new Date(Date.now() - 3600000 * 2),
    },
    {
      id: 'audit-sm-mega-01',
      shiftId: 'shift-liza-seed',
      userId: 'usr-liza-ph',
      storeId: 'store-sm-mega',
      driveImageId: 'drive-mega-shelf-01',
      complianceScore: 92,
      shareOfShelfPct: 38,
      detectedIssues: ['1 missing shelf price tag on row 2', 'Competitor product proximity alert'],
      geminiVerdict: 'Compliant display; recommend placing promo wobbler on row 1.',
      timestamp: new Date(Date.now() - 3600000 * 4),
    },
  ] as any).onConflictDoNothing();

  console.log('✅ Database seeded successfully with demo stores, promoters, focus SKUs, and audits!');
}

seedDatabase().then(() => process.exit(0)).catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
