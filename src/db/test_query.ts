import 'dotenv/config';
import { db } from './client.js';
import { stores, products, users } from './schema.js';

async function main() {
  const allStores = await db.select().from(stores);
  const allProducts = await db.select().from(products);
  const allUsers = await db.select().from(users);

  console.log('🎉 LIVE TURSO DATABASE CONNECTION VERIFIED!');
  console.log('🏬 Stores in Turso:', allStores.map(s => `${s.name} (${s.country})`));
  console.log('📦 Focus SKUs in Turso:', allProducts.map(p => `${p.name} - ${p.currency} ${p.unitPrice}`));
  console.log('👥 Users in Turso:', allUsers.map(u => `${u.name} (${u.role})`));
}

main().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
