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
              VALUES ('usr-marco-ph', ?, 'Marco Diaz', 'marco.diaz@retailops.ai', '+63 917 888 7766', 'promoter', 'tl-PH', 'Asia/Manila', 1, 'roving', ?, ?)`,
        args: [wsId, JSON.stringify(manilaStores.map(s => s.id)), Date.now()],
      });
    }

    console.log('[DB Schema] Master Schema & Seeded Tables (Surveys, Payment Methods, Payment Terms, Governance, Stores) verified in DB.');
  } catch (err) {
    console.warn('[DB Schema] Schema verification notice:', err);
  }
}

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].endsWith('ensure_schema.ts')) {
  ensureTablesAndColumns().catch(console.error);
}
