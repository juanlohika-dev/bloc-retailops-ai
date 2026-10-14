import { libSqlClient } from './client.js';

export async function ensureTablesAndColumns() {
  try {
    // 1. Surveys
    await libSqlClient.execute(`
      CREATE TABLE IF NOT EXISTS surveys (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        survey_type TEXT NOT NULL DEFAULT 'internal_field',
        status TEXT NOT NULL DEFAULT 'active',
        target_roles TEXT,
        target_store_ids TEXT,
        target_org_node_ids TEXT,
        valid_from INTEGER,
        valid_until INTEGER,
        questions TEXT NOT NULL,
        created_by_user_id TEXT,
        ai_agent_dispatched INTEGER DEFAULT 0,
        metadata TEXT,
        created_at INTEGER NOT NULL
      );
    `);

    // 2. Survey Submissions
    await libSqlClient.execute(`
      CREATE TABLE IF NOT EXISTS survey_submissions (
        id TEXT PRIMARY KEY,
        survey_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        submitted_by_user_id TEXT,
        store_id TEXT,
        respondent_type TEXT NOT NULL DEFAULT 'field_staff',
        respondent_name TEXT,
        respondent_contact TEXT,
        answers TEXT NOT NULL,
        submitted_at INTEGER NOT NULL,
        metadata TEXT
      );
    `);

    // 3. Roving Store Visits
    await libSqlClient.execute(`
      CREATE TABLE IF NOT EXISTS roving_store_visits (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        store_id TEXT NOT NULL,
        visit_date TEXT NOT NULL,
        sequence_order INTEGER NOT NULL DEFAULT 1,
        scheduled_time TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        check_in_time INTEGER,
        check_out_time INTEGER,
        check_in_lat REAL,
        check_in_lng REAL,
        gps_verified INTEGER DEFAULT 1,
        notes TEXT,
        created_at INTEGER NOT NULL
      );
    `);

    // 4. Columns on users
    try {
      await libSqlClient.execute(`ALTER TABLE users ADD COLUMN employment_type TEXT DEFAULT 'stationary';`);
    } catch (e) {}
    try {
      await libSqlClient.execute(`ALTER TABLE users ADD COLUMN assigned_store_ids TEXT;`);
    } catch (e) {}
    try {
      await libSqlClient.execute(`ALTER TABLE agent_tasks ADD COLUMN is_required_for_clockout INTEGER DEFAULT 0;`);
    } catch (e) {}

    // 5. Payment Methods Table
    await libSqlClient.execute(`
      CREATE TABLE IF NOT EXISTS payment_methods (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        code TEXT NOT NULL,
        label TEXT NOT NULL,
        category TEXT DEFAULT 'cash',
        enabled INTEGER DEFAULT 1,
        requires_approval INTEGER DEFAULT 0,
        allowed_terms TEXT,
        display_order INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
      );
    `);

    // 6. Payment Terms Table
    await libSqlClient.execute(`
      CREATE TABLE IF NOT EXISTS payment_terms (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        code TEXT NOT NULL,
        label TEXT NOT NULL,
        months INTEGER DEFAULT 0,
        interest_rate REAL DEFAULT 0,
        enabled INTEGER DEFAULT 1,
        display_order INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
      );
    `);

    // 7. AI Governance Policies Table
    await libSqlClient.execute(`
      CREATE TABLE IF NOT EXISTS ai_governance_configs (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL UNIQUE,
        enabled INTEGER DEFAULT 1,
        require_supervisor_sign_off_on_config INTEGER DEFAULT 1,
        auto_audit_all_ai_actions INTEGER DEFAULT 1,
        max_config_changes_per_hour INTEGER DEFAULT 20,
        risk_threshold TEXT DEFAULT 'high',
        allowed_roles TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // Auto-seed registered master entries into database for all active workspaces
    const wsResult = await libSqlClient.execute(`SELECT id FROM workspaces;`);
    const workspacesList = wsResult.rows || [];

    for (const wsRow of workspacesList) {
      const wsId = String(wsRow.id);

      // Seed Payment Methods if empty in DB
      const pmCheck = await libSqlClient.execute({
        sql: `SELECT COUNT(*) as count FROM payment_methods WHERE workspace_id = ?`,
        args: [wsId],
      });
      if (Number(pmCheck.rows[0]?.count || 0) === 0) {
        const defaultMethods = [
          { code: 'cash', label: 'Cash', category: 'cash', approval: 0, terms: JSON.stringify(['straight']), order: 1 },
          { code: 'credit_card', label: 'Credit Card', category: 'card', approval: 1, terms: JSON.stringify(['straight', '3_months', '6_months', '12_months', '24_months']), order: 2 },
          { code: 'home_credit', label: 'Home Credit Installment', category: 'financing', approval: 1, terms: JSON.stringify(['6_months', '9_months', '12_months', '18_months', '24_months']), order: 3 },
          { code: 'e_wallet', label: 'E-Wallet (GCash / Maya / GrabPay)', category: 'ewallet', approval: 0, terms: JSON.stringify(['straight']), order: 4 },
          { code: 'bnpl', label: 'BNPL (Atome / SPayLater)', category: 'bnpl', approval: 1, terms: JSON.stringify(['straight', '3_months', '6_months']), order: 5 },
        ];
        for (const m of defaultMethods) {
          await libSqlClient.execute({
            sql: `INSERT INTO payment_methods (id, workspace_id, code, label, category, enabled, requires_approval, allowed_terms, display_order, created_at)
                  VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
            args: [`pm-${m.code}-${wsId}`, wsId, m.code, m.label, m.category, m.approval, m.terms, m.order, Date.now()],
          });
        }
      }

      // Seed Payment Terms if empty in DB
      const ptCheck = await libSqlClient.execute({
        sql: `SELECT COUNT(*) as count FROM payment_terms WHERE workspace_id = ?`,
        args: [wsId],
      });
      if (Number(ptCheck.rows[0]?.count || 0) === 0) {
        const defaultTerms = [
          { code: 'straight', label: 'Straight Payment', months: 0, rate: 0, order: 1 },
          { code: '3_months', label: '3 Months (0% Interest)', months: 3, rate: 0, order: 2 },
          { code: '6_months', label: '6 Months (0% Interest)', months: 6, rate: 0, order: 3 },
          { code: '9_months', label: '9 Months Financing', months: 9, rate: 0.02, order: 4 },
          { code: '12_months', label: '12 Months (0% Interest)', months: 12, rate: 0, order: 5 },
          { code: '18_months', label: '18 Months Financing', months: 18, rate: 0.03, order: 6 },
          { code: '24_months', label: '24 Months Financing', months: 24, rate: 0.035, order: 7 },
        ];
        for (const t of defaultTerms) {
          await libSqlClient.execute({
            sql: `INSERT INTO payment_terms (id, workspace_id, code, label, months, interest_rate, enabled, display_order, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
            args: [`term-${t.code}-${wsId}`, wsId, t.code, t.label, t.months, t.rate, t.order, Date.now()],
          });
        }
      }

      // Seed AI Governance Policy if empty in DB
      const govCheck = await libSqlClient.execute({
        sql: `SELECT COUNT(*) as count FROM ai_governance_configs WHERE workspace_id = ?`,
        args: [wsId],
      });
      if (Number(govCheck.rows[0]?.count || 0) === 0) {
        const defaultRoles = JSON.stringify({
          super_admin: { canQuery: true, canConfigure: true, requiresApproval: false, approvalThreshold: 'none', description: 'Full access to query system and execute administrative configurations' },
          company_admin: { canQuery: true, canConfigure: true, requiresApproval: true, approvalThreshold: 'self_sign', description: 'Can query and configure with recorded approval signature' },
          supervisor: { canQuery: true, canConfigure: false, requiresApproval: false, approvalThreshold: 'read_only', description: 'Read-only analytics, store 360, task dispatch; cannot modify system configuration' },
          promoter: { canQuery: false, canConfigure: false, requiresApproval: false, approvalThreshold: 'blocked', description: 'Blocked from administrative copilot; frontline Pax access only' },
        });

        await libSqlClient.execute({
          sql: `INSERT INTO ai_governance_configs (id, workspace_id, enabled, require_supervisor_sign_off_on_config, auto_audit_all_ai_actions, max_config_changes_per_hour, risk_threshold, allowed_roles, updated_at)
                VALUES (?, ?, 1, 1, 1, 20, 'high', ?, ?)`,
          args: [`gov-${wsId}`, wsId, defaultRoles, Date.now()],
        });
      }

      // Seed Manila Network Stores if missing in DB
      const manilaStores = [
        { id: 'store-sm-mega', storeCode: 'SM-MEGA-01', name: 'SM Megamall Cyberzone', chain: 'SM Supermalls', country: 'PH', city: 'Mandaluyong, Metro Manila', lat: 14.5842, lng: 121.0567, radius: 200, target: 25000, cur: 'PHP' },
        { id: 'store-rob-galler', storeCode: 'ROB-GAL-02', name: 'Robinsons Galleria EDSA', chain: 'Robinsons Malls', country: 'PH', city: 'Quezon City, Metro Manila', lat: 14.5904, lng: 121.0594, radius: 180, target: 20000, cur: 'PHP' },
        { id: 'store-sm-aura', storeCode: 'SM-AURA-03', name: 'SM Aura Premier Tech Hub', chain: 'SM Supermalls', country: 'PH', city: 'Taguig, Bonifacio Global City', lat: 14.5469, lng: 121.0543, radius: 150, target: 28000, cur: 'PHP' },
        { id: 'store-glorietta', storeCode: 'GLO-04-01', name: 'Glorietta 4 Flagship Experience', chain: 'Ayala Malls', country: 'PH', city: 'Makati CBD, Metro Manila', lat: 14.5524, lng: 121.0258, radius: 160, target: 32000, cur: 'PHP' },
        { id: 'store-greenbelt', storeCode: 'GB-05-02', name: 'Greenbelt 5 Premium Boutique', chain: 'Ayala Malls', country: 'PH', city: 'Makati CBD, Metro Manila', lat: 14.5518, lng: 121.0205, radius: 150, target: 22000, cur: 'PHP' },
        { id: 'store-trinoma', storeCode: 'TRI-06-01', name: 'TriNoma Central Department Store', chain: 'Ayala Malls', country: 'PH', city: 'Quezon City, Metro Manila', lat: 14.6534, lng: 121.0335, radius: 200, target: 24000, cur: 'PHP' },
        { id: 'store-sm-north', storeCode: 'SM-NO-07', name: 'SM North EDSA Annex Cyberzone', chain: 'SM Supermalls', country: 'PH', city: 'Quezon City, Metro Manila', lat: 14.6565, lng: 121.0290, radius: 220, target: 30000, cur: 'PHP' },
        { id: 'store-atc', storeCode: 'ATC-08-01', name: 'Alabang Town Center Commerce Hub', chain: 'Ayala Malls', country: 'PH', city: 'Muntinlupa, Metro Manila', lat: 14.4239, lng: 121.0298, radius: 180, target: 18000, cur: 'PHP' },
      ];

      for (const s of manilaStores) {
        await libSqlClient.execute({
          sql: `INSERT OR IGNORE INTO stores (id, workspace_id, store_code, name, chain, country, city, latitude, longitude, geofence_radius_meters, daily_target_default, currency, active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          args: [s.id, wsId, s.storeCode, s.name, s.chain, s.country, s.city, s.lat, s.lng, s.radius, s.target, s.cur],
        });
      }

      // Seed Roving Merchandiser user if missing
      await libSqlClient.execute({
        sql: `INSERT OR IGNORE INTO users (id, workspace_id, name, email, phone, role, preferred_language, timezone, active, employment_type, assigned_store_ids, created_at)
              VALUES ('usr-marco-ph', ?, 'Marco Diaz', 'marco.diaz@retailops.ai', '+63 917 888 7766', 'promoter', 'fil', 'Asia/Manila', 1, 'roving', ?, ?)`,
        args: [wsId, JSON.stringify(manilaStores.map(s => s.id)), Date.now()],
      });

      // Seed Multi-Lingual Regional Personas (Malaysia, Vietnam, India)
      await libSqlClient.execute({
        sql: `INSERT OR IGNORE INTO users (id, workspace_id, name, email, phone, role, preferred_language, timezone, active, employment_type, assigned_store_ids, created_at)
              VALUES ('usr-ahmad-my', ?, 'Ahmad Razak', 'ahmad.razak@retailops.ai', '+60 12 345 6789', 'promoter', 'ms', 'Asia/Kuala_Lumpur', 1, 'stationary', '[]', ?)`,
        args: [wsId, Date.now()],
      });
      await libSqlClient.execute({
        sql: `INSERT OR IGNORE INTO users (id, workspace_id, name, email, phone, role, preferred_language, timezone, active, employment_type, assigned_store_ids, created_at)
              VALUES ('usr-nguyen-vn', ?, 'Nguyen Van Minh', 'nguyen.minh@retailops.ai', '+84 90 123 4567', 'promoter', 'vi', 'Asia/Ho_Chi_Minh', 1, 'stationary', '[]', ?)`,
        args: [wsId, Date.now()],
      });
      await libSqlClient.execute({
        sql: `INSERT OR IGNORE INTO users (id, workspace_id, name, email, phone, role, preferred_language, timezone, active, employment_type, assigned_store_ids, created_at)
              VALUES ('usr-priya-in', ?, 'Priya Sharma', 'priya.sharma@retailops.ai', '+91 98 7654 3210', 'promoter', 'ur', 'Asia/Kolkata', 1, 'stationary', '[]', ?)`,
        args: [wsId, Date.now()],
      });
    }

    // 6. Supported Languages Table (Database-Driven Master Taxonomy)
    await libSqlClient.execute(`
      CREATE TABLE IF NOT EXISTS supported_languages (
        code TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        native_name TEXT NOT NULL,
        region TEXT NOT NULL,
        flag_emoji TEXT NOT NULL,
        is_default INTEGER DEFAULT 0,
        active INTEGER DEFAULT 1,
        display_order INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL
      );
    `);

    // Seed Supported Languages (English, Filipino, Bahasa Melayu, Tiếng Việt, Urdu, Hindi)
    const masterLanguages = [
      { code: 'en', name: 'English', nativeName: 'English', region: 'Global', flagEmoji: '🌐', isDefault: 1, order: 1 },
      { code: 'fil', name: 'Filipino', nativeName: 'Wikang Filipino', region: 'Philippines', flagEmoji: '🇵🇭', isDefault: 0, order: 2 },
      { code: 'ms', name: 'Bahasa Melayu', nativeName: 'Bahasa Melayu', region: 'Malaysia', flagEmoji: '🇲🇾', isDefault: 0, order: 3 },
      { code: 'vi', name: 'Tiếng Việt', nativeName: 'Tiếng Việt', region: 'Vietnam', flagEmoji: '🇻🇳', isDefault: 0, order: 4 },
      { code: 'ur', name: 'Urdu', nativeName: 'اردو', region: 'South Asia / India', flagEmoji: '🇵🇰 / 🇮🇳', isDefault: 0, order: 5 },
      { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', region: 'India', flagEmoji: '🇮🇳', isDefault: 0, order: 6 },
    ];

    for (const lang of masterLanguages) {
      await libSqlClient.execute({
        sql: `INSERT OR IGNORE INTO supported_languages (code, name, native_name, region, flag_emoji, is_default, active, display_order, created_at)
              VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        args: [lang.code, lang.name, lang.nativeName, lang.region, lang.flagEmoji, lang.isDefault, lang.order, Date.now()],
      });
    }

    // Normalize legacy user language codes to standard master codes
    try {
      await libSqlClient.execute(`UPDATE users SET preferred_language = 'fil' WHERE preferred_language IN ('tl-PH', 'tl', 'fil-PH');`);
      await libSqlClient.execute(`UPDATE users SET preferred_language = 'en' WHERE preferred_language IN ('en-SG', 'en-US', 'en-GB');`);
      await libSqlClient.execute(`UPDATE users SET preferred_language = 'ms' WHERE preferred_language IN ('ms-MY');`);
      await libSqlClient.execute(`UPDATE users SET preferred_language = 'vi' WHERE preferred_language IN ('vi-VN');`);
    } catch (normErr) {}

    // 28. Module Field Definitions (Dynamic Field Engine)
    await libSqlClient.execute(`
      CREATE TABLE IF NOT EXISTS module_field_definitions (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        module TEXT NOT NULL,
        field_key TEXT NOT NULL,
        field_label TEXT NOT NULL,
        field_type TEXT NOT NULL,
        is_standard INTEGER DEFAULT 0,
        is_required INTEGER DEFAULT 0,
        options TEXT,
        default_value TEXT,
        placeholder TEXT,
        display_order INTEGER DEFAULT 0,
        active INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL
      );
    `);

    // Ensure custom_fields column exists on sales_transactions
    try {
      await libSqlClient.execute(`ALTER TABLE sales_transactions ADD COLUMN custom_fields TEXT;`);
    } catch (e) {}

    // Seed master field definitions for ws-alpha
    const defaultModuleFields = [
      // SALES
      { id: 'fld-sales-store', ws: 'ws-alpha', mod: 'sales', key: 'store_id', label: 'Store Branch', type: 'select', isStd: 1, req: 1, opts: null, ph: 'Select Store', order: 1 },
      { id: 'fld-sales-items', ws: 'ws-alpha', mod: 'sales', key: 'items', label: 'SKU Items & Quantity', type: 'stepper', isStd: 1, req: 1, opts: null, ph: null, order: 2 },
      { id: 'fld-sales-paymethod', ws: 'ws-alpha', mod: 'sales', key: 'payment_method', label: 'Payment Method', type: 'select', isStd: 1, req: 1, opts: null, ph: null, order: 3 },
      { id: 'fld-sales-payterms', ws: 'ws-alpha', mod: 'sales', key: 'payment_terms', label: 'Financing Terms', type: 'select', isStd: 1, req: 1, opts: null, ph: null, order: 4 },
      { id: 'fld-sales-authcode', ws: 'ws-alpha', mod: 'sales', key: 'approval_code', label: 'Payment Auth Reference', type: 'text', isStd: 1, req: 0, opts: null, ph: 'AUTH-123456', order: 5 },
      { id: 'fld-sales-custphone', ws: 'ws-alpha', mod: 'sales', key: 'customer_phone', label: 'Customer Mobile / Loyalty #', type: 'text', isStd: 0, req: 0, opts: null, ph: '+63 9XX XXX XXXX', order: 10 },
      { id: 'fld-sales-serial', ws: 'ws-alpha', mod: 'sales', key: 'serial_number', label: 'Serial / IMEI Number', type: 'text', isStd: 0, req: 0, opts: null, ph: 'SN-88291039', order: 11 },
      { id: 'fld-sales-warranty', ws: 'ws-alpha', mod: 'sales', key: 'extended_warranty', label: 'Extended Warranty Protection', type: 'select', isStd: 0, req: 0, opts: JSON.stringify(['None', '1-Year Extended (₱999)', '2-Year Care+ Screen & Liquid (₱1,899)']), ph: 'Choose Protection Pack', order: 12 },
      { id: 'fld-sales-gift', ws: 'ws-alpha', mod: 'sales', key: 'promo_gift_included', label: 'Promotional Freebie Issued', type: 'checkbox', isStd: 0, req: 0, opts: null, ph: null, order: 13 },
      
      // STORES
      { id: 'fld-store-code', ws: 'ws-alpha', mod: 'stores', key: 'store_code', label: 'Store Code', type: 'text', isStd: 1, req: 1, opts: null, ph: 'PH-NCR-001', order: 1 },
      { id: 'fld-store-name', ws: 'ws-alpha', mod: 'stores', key: 'name', label: 'Store Name', type: 'text', isStd: 1, req: 1, opts: null, ph: 'SM Megamall', order: 2 },
      { id: 'fld-store-chain', ws: 'ws-alpha', mod: 'stores', key: 'chain', label: 'Retail Chain', type: 'text', isStd: 1, req: 1, opts: null, ph: 'SM Cyberzone', order: 3 },
      { id: 'fld-store-country', ws: 'ws-alpha', mod: 'stores', key: 'country', label: 'Country / Jurisdiction', type: 'select', isStd: 1, req: 1, opts: JSON.stringify(['Philippines', 'Singapore', 'Malaysia', 'Vietnam']), ph: null, order: 4 },
      { id: 'fld-store-floor', ws: 'ws-alpha', mod: 'stores', key: 'mall_floor', label: 'Mall Floor & Unit Location', type: 'text', isStd: 0, req: 0, opts: null, ph: '4th Floor Cyberzone Unit 402', order: 10 },
      { id: 'fld-store-format', ws: 'ws-alpha', mod: 'stores', key: 'store_format', label: 'Store Format Tier', type: 'select', isStd: 0, req: 0, opts: JSON.stringify(['Flagship Experience Store', 'Standard Concept Shop', 'Mall Kiosk', 'High-Street Partner']), ph: null, order: 11 },
      { id: 'fld-store-posid', ws: 'ws-alpha', mod: 'stores', key: 'pos_terminal_id', label: 'Partner POS Terminal ID', type: 'text', isStd: 0, req: 0, opts: null, ph: 'POS-NCR-092', order: 12 },

      // PRODUCTS
      { id: 'fld-prod-sku', ws: 'ws-alpha', mod: 'products', key: 'sku_code', label: 'SKU Code', type: 'text', isStd: 1, req: 1, opts: null, ph: 'PROD-ULTRA', order: 1 },
      { id: 'fld-prod-name', ws: 'ws-alpha', mod: 'products', key: 'name', label: 'Product Title', type: 'text', isStd: 1, req: 1, opts: null, ph: 'Galaxy S25 Ultra', order: 2 },
      { id: 'fld-prod-category', ws: 'ws-alpha', mod: 'products', key: 'category', label: 'Product Category', type: 'select', isStd: 1, req: 1, opts: JSON.stringify(['Smartphones', 'Tablets', 'Wearables', 'Televisions', 'Accessories']), ph: null, order: 3 },
      { id: 'fld-prod-price', ws: 'ws-alpha', mod: 'products', key: 'unit_price', label: 'Retail Price (₱)', type: 'currency', isStd: 1, req: 1, opts: null, ph: '₱0.00', order: 4 },
      { id: 'fld-prod-tier', ws: 'ws-alpha', mod: 'products', key: 'brand_tier', label: 'Brand Lineup Tier', type: 'select', isStd: 0, req: 0, opts: JSON.stringify(['Galaxy Ultra Tier', 'Premium Foldable', 'Mid-Range A-Series', 'Essential Series']), ph: null, order: 10 },
      { id: 'fld-prod-map', ws: 'ws-alpha', mod: 'products', key: 'min_advertised_price', label: 'MAP Price Floor (₱)', type: 'currency', isStd: 0, req: 0, opts: null, ph: '₱0.00', order: 11 },
      { id: 'fld-prod-bundle', ws: 'ws-alpha', mod: 'products', key: 'bundle_eligible', label: 'Eligible for Multi-SKU Bundle', type: 'checkbox', isStd: 0, req: 0, opts: null, ph: null, order: 12 },

      // USERS
      { id: 'fld-user-name', ws: 'ws-alpha', mod: 'users', key: 'name', label: 'Full Name', type: 'text', isStd: 1, req: 1, opts: null, ph: 'Juan Dela Cruz', order: 1 },
      { id: 'fld-user-email', ws: 'ws-alpha', mod: 'users', key: 'email', label: 'Work Email', type: 'text', isStd: 1, req: 1, opts: null, ph: 'user@company.com', order: 2 },
      { id: 'fld-user-role', ws: 'ws-alpha', mod: 'users', key: 'role', label: 'System Persona / Role', type: 'select', isStd: 1, req: 1, opts: JSON.stringify(['promoter', 'supervisor', 'store_manager', 'merchandiser', 'company_admin']), ph: null, order: 3 },
      { id: 'fld-user-govid', ws: 'ws-alpha', mod: 'users', key: 'government_id', label: 'Government / Tax ID (TIN)', type: 'text', isStd: 0, req: 0, opts: null, ph: 'XXX-XXX-XXX', order: 10 },
      { id: 'fld-user-emergency', ws: 'ws-alpha', mod: 'users', key: 'emergency_contact', label: 'Emergency Contact Person & Phone', type: 'text', isStd: 0, req: 0, opts: null, ph: 'Name (+63 9XX XXX XXXX)', order: 11 },

      // TASKS
      { id: 'fld-task-title', ws: 'ws-alpha', mod: 'tasks', key: 'title', label: 'Task Title', type: 'text', isStd: 1, req: 1, opts: null, ph: 'Planogram Compliance Audit', order: 1 },
      { id: 'fld-task-agent', ws: 'ws-alpha', mod: 'tasks', key: 'agent_id', label: 'Dispatching AI Agent', type: 'select', isStd: 1, req: 1, opts: JSON.stringify(['agent-vera', 'agent-pax', 'agent-nexus']), ph: null, order: 2 },
      { id: 'fld-task-priority', ws: 'ws-alpha', mod: 'tasks', key: 'priority', label: 'Operational Priority', type: 'select', isStd: 0, req: 0, opts: JSON.stringify(['High (Immediate)', 'Medium (Shift Window)', 'Normal (End of Day)']), ph: null, order: 10 },
      { id: 'fld-task-photo', ws: 'ws-alpha', mod: 'tasks', key: 'photo_mandatory', label: 'Mandatory Optical Photo Proof', type: 'checkbox', isStd: 0, req: 0, opts: null, ph: null, order: 11 },

      // SHELF AUDITS
      { id: 'fld-shelf-score', ws: 'ws-alpha', mod: 'shelf_audits', key: 'compliance_score', label: 'Compliance Score (%)', type: 'number', isStd: 1, req: 1, opts: null, ph: '100', order: 1 },
      { id: 'fld-shelf-sos', ws: 'ws-alpha', mod: 'shelf_audits', key: 'share_of_shelf_pct', label: 'Share of Shelf (%)', type: 'number', isStd: 1, req: 1, opts: null, ph: '40', order: 2 },
      { id: 'fld-shelf-endcap', ws: 'ws-alpha', mod: 'shelf_audits', key: 'endcap_location', label: 'Endcap Gondola Location', type: 'text', isStd: 0, req: 0, opts: null, ph: 'Aisle 3 Front Endcap', order: 10 },
      { id: 'fld-shelf-pop', ws: 'ws-alpha', mod: 'shelf_audits', key: 'pop_material_installed', label: 'POSM / Promo Banner Present', type: 'checkbox', isStd: 0, req: 0, opts: null, ph: null, order: 11 },
    ];

    const allWsForFields = await libSqlClient.execute('SELECT id FROM workspaces;');
    const workspaceIds = (allWsForFields.rows || []).map(r => String(r.id));
    if (!workspaceIds.includes('ws-alpha')) workspaceIds.push('ws-alpha');
    if (!workspaceIds.includes('ws-japac-retail')) workspaceIds.push('ws-japac-retail');

    for (const targetWs of workspaceIds) {
      for (const f of defaultModuleFields) {
        const fieldId = `fld-${targetWs}-${f.mod}-${f.key}`;
        await libSqlClient.execute({
          sql: `INSERT OR IGNORE INTO module_field_definitions (id, workspace_id, module, field_key, field_label, field_type, is_standard, is_required, options, placeholder, display_order, active, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
          args: [fieldId, targetWs, f.mod, f.key, f.label, f.type, f.isStd, f.req, f.opts, f.ph, f.order, Date.now()],
        });
      }
    }

    console.log('[DB Schema] Master Schema & Seeded Tables (Surveys, Payment Methods, Payment Terms, Governance, Stores, Supported Languages, Dynamic Module Fields) verified in DB.');
  } catch (err) {
    console.warn('[DB Schema] Schema verification notice:', err);
  }
}

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].endsWith('ensure_schema.ts')) {
  ensureTablesAndColumns().catch(console.error);
}
