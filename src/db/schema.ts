import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// ==========================================
// 1. WORKSPACES / COMPANIES (Multi-Tenant B2B SaaS)
// ==========================================
export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),                         // e.g. "unilever-ph", "sony-sg"
  name: text('name').notNull(),                                 // "Unilever Philippines", "Sony Singapore"
  status: text('status').notNull().default('active'),           // 'active' | 'trial' | 'suspended'
  subscriptionTier: text('subscription_tier').default('growth'),// 'starter' | 'growth' | 'enterprise'
  baseCurrency: text('base_currency').notNull().default('SGD'), // SGD, PHP, JPY, MYR, USD
  driveFolderId: text('drive_folder_id').notNull(),               // Root 5TB Media Vault Folder ID
  sheetSyncId: text('sheet_sync_id').notNull(),                 // Bidirectional Operations Google Sheet ID
  settings: text('settings', { mode: 'json' }),                 // Company-wide config (working hours, AI parameters)
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// ==========================================
// 2. USERS & STAFF (Role-Based Access Control)
// ==========================================
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  phone: text('phone'),
  role: text('role').notNull().default('promoter'),              // 'super_admin' | 'company_admin' | 'supervisor' | 'promoter'
  preferredLanguage: text('preferred_language').default('en-SG'), // 'tl-PH' (Tagalog), 'en-SG', 'ms-MY', 'ja-JP'
  timezone: text('timezone').default('Asia/Singapore'),
  active: integer('active', { mode: 'boolean' }).default(true),
  avatarUrl: text('avatar_url'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// ==========================================
// 3. RETAIL STORES & GEOLOCATION
// ==========================================
export const stores = sqliteTable('stores', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  storeCode: text('store_code').notNull().unique(),             // e.g. "SM-MEGA-01", "FP-VIVO-02"
  name: text('name').notNull(),                                 // e.g. "SM Megamall Branch", "FairPrice VivoCity"
  chain: text('chain').notNull(),                               // "SM Supermalls", "FairPrice", "Robinsons"
  country: text('country').notNull(),                           // "PH", "SG", "MY"
  city: text('city').notNull(),
  address: text('address'),
  latitude: real('latitude'),
  longitude: real('longitude'),
  geofenceRadiusMeters: integer('geofence_radius_meters').default(150), // For GPS attendance verification
  dailyTargetDefault: real('daily_target_default').default(1000),
  currency: text('currency').notNull().default('SGD'),
  active: integer('active', { mode: 'boolean' }).default(true),
});

// ==========================================
// 4. STORE ASSIGNMENTS (Roster & Scheduling)
// ==========================================
export const storeAssignments = sqliteTable('store_assignments', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  userId: text('user_id').notNull().references(() => users.id),
  storeId: text('store_id').notNull().references(() => stores.id),
  dayOfWeek: integer('day_of_week'),                            // 0 = Sunday, 1 = Monday, ... 6 = Saturday (null = daily)
  assignedTarget: real('assigned_target'),                      // Override daily target for this rep
  active: integer('active', { mode: 'boolean' }).default(true),
});

// ==========================================
// 5. PRODUCT CATALOG & BARCODE INVENTORY
// ==========================================
export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  skuCode: text('sku_code').notNull().unique(),                 // e.g. "OLED-55-B4", "BUNDLE-PROMO-A"
  barcode: text('barcode').unique(),                            // EAN-13 / UPC / QR code string for camera scan
  name: text('name').notNull(),                                 // "55-inch 4K OLED TV", "Breakfast Bundle A"
  category: text('category').notNull(),                         // "Consumer Electronics", "FMCG", "Beauty"
  unitPrice: real('unit_price').notNull(),
  currency: text('currency').notNull().default('SGD'),
  commissionPerUnit: real('commission_per_unit').default(0),
  isFocusPromo: integer('is_focus_promo', { mode: 'boolean' }).default(false), // Pinned to Fast-Sale Quick Stepper
  displayOrder: integer('display_order').default(0),
  active: integer('active', { mode: 'boolean' }).default(true),
});

// ==========================================
// 6. PROMOTIONS & BUNDLE CAMPAIGNS
// ==========================================
export const promotions = sqliteTable('promotions', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  promoCode: text('promo_code').notNull(),                      // e.g. "WEEKEND-FLASH-30", "BUNDLE-A-PROMO"
  title: text('title').notNull(),                               // "Weekend Flash Sale 10% Off"
  description: text('description'),
  discountType: text('discount_type').notNull().default('percentage'), // 'percentage' | 'fixed_amount' | 'bundle'
  discountValue: real('discount_value').default(0),
  bundleSkus: text('bundle_skus', { mode: 'json' }),            // Array of SKU IDs included in the bundle
  bonusCommission: real('bonus_commission').default(0),         // Extra incentive for promoter per sale
  startDate: text('start_date').notNull(),                      // YYYY-MM-DD
  endDate: text('end_date').notNull(),                          // YYYY-MM-DD
  active: integer('active', { mode: 'boolean' }).default(true),
});

// ==========================================
// 7. DAILY SHIFTS & GPS ATTENDANCE
// ==========================================
export const shifts = sqliteTable('shifts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  storeId: text('store_id').notNull().references(() => stores.id),
  shiftDate: text('shift_date').notNull(),                      // YYYY-MM-DD
  clockInTime: integer('clock_in_time', { mode: 'timestamp' }).notNull(),
  clockOutTime: integer('clock_out_time', { mode: 'timestamp' }),
  gpsVerified: integer('gps_verified', { mode: 'boolean' }).default(true),
  targetAmount: real('target_amount').notNull(),
  currency: text('currency').notNull(),
  status: text('status').notNull().default('active'),           // 'active' | 'completed' | 'absent'
});

// ==========================================
// 8. FAST-SALE TRANSACTIONS (Auditable Sell-Out)
// ==========================================
export const salesTransactions = sqliteTable('sales_transactions', {
  id: text('id').primaryKey(),
  shiftId: text('shift_id').notNull().references(() => shifts.id),
  userId: text('user_id').notNull().references(() => users.id),
  storeId: text('store_id').notNull().references(() => stores.id),
  productId: text('product_id').notNull().references(() => products.id),
  promotionId: text('promotion_id').references(() => promotions.id),
  quantity: integer('quantity').notNull(),
  unitPrice: real('unit_price').notNull(),
  totalAmount: real('total_amount').notNull(),
  currency: text('currency').notNull(),
  commissionEarned: real('commission_earned').default(0),
  captureMode: text('capture_mode').notNull().default('stepper'), // 'stepper' | 'barcode_cam' | 'receipt_ocr'
  receiptDriveId: text('receipt_drive_id'),                     // Pointer to Google Drive photo if receipt attached
  syncedToErp: integer('synced_to_erp', { mode: 'boolean' }).default(false),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
});

// ==========================================
// 9. VERA SHELF AUDITS (Multimodal Computer Vision)
// ==========================================
export const shelfAudits = sqliteTable('shelf_audits', {
  id: text('id').primaryKey(),
  shiftId: text('shift_id').notNull().references(() => shifts.id),
  userId: text('user_id').notNull().references(() => users.id),
  storeId: text('store_id').notNull().references(() => stores.id),
  driveImageId: text('drive_image_id').notNull(),               // Byte stream pulled by Vertex AI from Drive
  complianceScore: real('compliance_score').notNull(),          // e.g. 92.5 (%)
  shareOfShelfPct: real('share_of_shelf_pct').notNull(),         // e.g. 38.0 (%)
  detectedIssues: text('detected_issues', { mode: 'json' }),    // Array of issues e.g. ["Missing tag: row 2"]
  geminiVerdict: text('gemini_verdict'),                        // Gemini 2.5 Pro assessment summary
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
});

// ==========================================
// 10. COMPOSABLE ATOMIC BLOCKS (Notion-Style Dynamic Data)
// ==========================================
export const blocks = sqliteTable('blocks', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull(),                         // User, Store, Shift, or Company ID
  blockType: text('block_type').notNull(),                      // 'metric_sales', 'shelf_photo', 'competitor_intel'
  key: text('key').notNull(),                                   // e.g. "revenue", "competitor_promo"
  value: text('value', { mode: 'json' }).notNull(),             // e.g. { amount: 1497, currency: "PHP" }
  driveFileId: text('drive_file_id'),                           // Google Drive pointer for media
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// ==========================================
// 11. FRONTLINE CHAT STREAM (Pax Conversation History)
// ==========================================
export const chatMessages = sqliteTable('chat_messages', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  shiftId: text('shift_id').references(() => shifts.id),
  sender: text('sender').notNull(),                             // 'user' | 'pax' | 'nexus'
  message: text('message').notNull(),
  originalLanguage: text('original_language').default('en'),    // 'tl', 'en', 'ms'
  englishTranslation: text('english_translation'),              // Auto-translated for executive reporting
  interactiveCardType: text('interactive_card_type'),          // 'fast_sale_card', 'audit_card', 'target_summary'
  metadata: text('metadata', { mode: 'json' }),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
});
