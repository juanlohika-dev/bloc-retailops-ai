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
  paymentMethod: text('payment_method').default('cash'),       // 'cash' | 'credit_card' | 'home_credit' | 'e_wallet' | 'bnpl'
  paymentTerms: text('payment_terms').default('straight'),     // 'straight' | '3_months' | '6_months' | '12_months' | '24_months'
  approvalCode: text('approval_code'),                          // Card/Financing authorization reference
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

// ==========================================
// 12. USER INVITATIONS & ONBOARDING (RBAC)
// ==========================================
export const userInvitations = sqliteTable('user_invitations', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  email: text('email').notNull(),
  role: text('role').notNull().default('promoter'),              // 'company_admin' | 'supervisor' | 'promoter'
  token: text('token').notNull().unique(),                      // Secure onboarding token
  assignedStoreIds: text('assigned_store_ids', { mode: 'json' }), // Optional pre-assigned store routes
  invitedBy: text('invited_by').notNull().references(() => users.id),
  status: text('status').notNull().default('pending'),           // 'pending' | 'accepted' | 'expired' | 'revoked'
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// ==========================================
// 13. AUDIT LOGS (Compliance & Security Governance)
// ==========================================
export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  actorId: text('actor_id').references(() => users.id),          // User who performed the action
  action: text('action').notNull(),                              // e.g. "user.invite", "role.change", "store.create", "sale.void"
  resourceType: text('resource_type').notNull(),                 // "user", "store", "product", "promotion", "shift"
  resourceId: text('resource_id'),
  details: text('details', { mode: 'json' }),                    // Diff / metadata before & after
  module: text('module').notNull().default('general'),           // 'sales' | 'products' | 'stores' | 'agents' | 'tasks' | 'users' | 'config' | 'ai_governance'
  approvalStatus: text('approval_status').default('approved'),   // 'approved' | 'pending' | 'auto_approved'
  approvedBy: text('approved_by'),                               // Approver name / role signature
  aiAgentId: text('ai_agent_id'),                                // ID of AI Agent assisting or executing
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
});

// ==========================================
// 14. API KEYS (Enterprise Integrations & POS Webhooks)
// ==========================================
export const apiKeys = sqliteTable('api_keys', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  name: text('name').notNull(),                                 // e.g. "SAP ERP Sync Connector", "Cashier Webhook"
  keyHash: text('key_hash').notNull().unique(),                 // SHA-256 hashed secret
  prefix: text('prefix').notNull(),                             // Public prefix e.g. "bloc_live_..."
  scopes: text('scopes', { mode: 'json' }).notNull(),            // Array of scopes e.g. ["sales:write", "stores:read"]
  lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  active: integer('active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// ==========================================
// 15. AI AGENT REGISTRY
// ==========================================
export const agentRegistry = sqliteTable('agent_registry', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  name: text('name').notNull(),                                 // e.g. "Pax", "Vera", "Nexus"
  role: text('role').notNull(),                                 // "Frontline Conversational Copilot", "Computer Vision Auditor"
  avatar: text('avatar').default('smart_toy'),
  model: text('model').notNull().default('gemini-2.5-flash'),    // 'gemini-2.5-flash' | 'gemini-2.5-pro'
  systemPrompt: text('system_prompt'),
  status: text('status').notNull().default('active'),           // 'active' | 'idle' | 'busy'
  active: integer('active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// ==========================================
// 16. AGENT SKILLS CATALOG & CONFIGURATION
// ==========================================
export const agentSkills = sqliteTable('agent_skills', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  agentId: text('agent_id').notNull().references(() => agentRegistry.id),
  name: text('name').notNull(),                                 // "Planogram Compliance & Shelf Alignment"
  code: text('code').notNull(),                                 // "planogram_audit", "stockout_alert", "shift_pacing"
  description: text('description').notNull(),
  triggerType: text('trigger_type').notNull().default('scheduled'), // 'scheduled' | 'event_driven' | 'on_demand'
  config: text('config', { mode: 'json' }),                     // Custom tolerance, prompts, parameters
  enabled: integer('enabled', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// ==========================================
// 17. AUTONOMOUS FIELD TASKS (Proactive Dispatch)
// ==========================================
export const agentTasks = sqliteTable('agent_tasks', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  agentId: text('agent_id').notNull().references(() => agentRegistry.id),
  skillId: text('skill_id').references(() => agentSkills.id),
  title: text('title').notNull(),                               // "11:00 AM Shelf #4 Endcap Audit"
  description: text('description'),
  targetScope: text('target_scope').notNull().default('all_stores'), // 'all_stores' | 'chain' | 'promoters'
  targetFilter: text('target_filter'),                          // e.g. "SM Supermalls"
  scheduleCron: text('schedule_cron'),                          // e.g. "0 11 * * *"
  followUpIntervalMins: integer('follow_up_interval_mins').default(30),
  escalationThresholdMins: integer('escalation_threshold_mins').default(60),
  status: text('status').notNull().default('active'),           // 'active' | 'paused' | 'completed'
  createdBy: text('created_by'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// ==========================================
// 18. AGENT FIELD CONTACT LOGS & COMPLIANCE
// ==========================================
export const agentFieldContacts = sqliteTable('agent_field_contacts', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  taskId: text('task_id').notNull().references(() => agentTasks.id),
  userId: text('user_id').notNull().references(() => users.id),
  storeId: text('store_id').notNull().references(() => stores.id),
  status: text('status').notNull().default('dispatched'),       // 'dispatched' | 'reminded' | 'submitted' | 'compliant' | 'non_compliant' | 'escalated'
  promptSent: text('prompt_sent').notNull(),
  responseReceived: text('response_received'),
  complianceScore: real('compliance_score'),
  auditImageId: text('audit_image_id'),
  escalated: integer('escalated', { mode: 'boolean' }).default(false),
  escalatedToUserId: text('escalated_to_user_id').references(() => users.id),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
});

// ==========================================
// 19. EXECUTIVE REPORTS & ANOMALY DIGESTS
// ==========================================
export const executiveReports = sqliteTable('executive_reports', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  title: text('title').notNull(),                               // "Weekly Planogram Compliance & OSA Digest"
  reportType: text('report_type').notNull(),                    // 'planogram_compliance' | 'stockout_risk' | 'sellout_performance'
  period: text('period').notNull(),                             // "Week 41, 2026"
  summary: text('summary').notNull(),                           // Executive synopsis written by Gemini
  keyFindings: text('key_findings', { mode: 'json' }),          // Array of bullet highlights
  metrics: text('metrics', { mode: 'json' }),                   // Numerical summary data
  generatedByAgentId: text('generated_by_agent_id').references(() => agentRegistry.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// ==========================================
// 20. CORPORATE ORG CHART TOPOLOGY
// ==========================================
export const orgNodes = sqliteTable('org_nodes', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  parentId: text('parent_id'),
  title: text('title').notNull(),                               // e.g. "JAPAC HQ", "Philippines Territory", "Metro Manila Operations"
  nodeType: text('node_type').notNull().default('area'),        // 'hq' | 'region' | 'area' | 'store'
  leaderUserId: text('leader_user_id').references(() => users.id),
  memberCount: integer('member_count').default(0),
  metadata: text('metadata', { mode: 'json' }),
  displayOrder: integer('display_order').default(0),
});

