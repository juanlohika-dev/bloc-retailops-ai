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

    console.log('[DB Schema] Surveys, Roving Visits, and User columns verified and active.');
  } catch (err) {
    console.warn('[DB Schema] Schema verification notice:', err);
  }
}

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].endsWith('ensure_schema.ts')) {
  ensureTablesAndColumns().catch(console.error);
}
