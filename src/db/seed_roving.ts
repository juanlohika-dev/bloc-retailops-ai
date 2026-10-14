import { libSqlClient } from './client.js';

async function seedRoving() {
  const existing = await libSqlClient.execute("SELECT id FROM users WHERE id = 'usr-marco-ph'");
  if (existing.rows.length === 0) {
    const storesArr = JSON.stringify(['store-sm-mega', 'store-rob-galler', 'store-sm-aura', 'store-glorietta', 'store-greenbelt', 'store-trinoma', 'store-sm-north', 'store-atc']);
    await libSqlClient.execute({
      sql: `INSERT INTO users (id, workspace_id, name, email, phone, role, preferred_language, timezone, employment_type, assigned_store_ids, active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      args: ['usr-marco-ph', 'ws-japac-retail', 'Marco Diaz', 'marco.diaz@retailops.ai', '+63 917 888 7766', 'promoter', 'tl-PH', 'Asia/Manila', 'roving', storesArr, Date.now()],
    });
    console.log('Seeded roving promoter Marco Diaz');
  } else {
    console.log('Marco Diaz already exists');
  }
}

seedRoving().catch(console.error);
