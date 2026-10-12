import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { PaxAgent } from '../agents/pax/index.js';
import { VeraAgent } from '../agents/vera/index.js';
import { NexusAgent } from '../agents/nexus/index.js';
import { db } from '../db/client.js';
import { users, stores, storeAssignments, products, shifts, chatMessages, salesTransactions } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json({ limit: '15mb' }));

// Serve frontend static files
const webDir = path.join(__dirname, '..', 'web');
app.use(express.static(webDir));

// ----------------------------------------------------
// 1. GET USER & SHIFT STATE
// ----------------------------------------------------
app.get('/api/user/:userId/state', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = (await db.select().from(users).where(eq(users.id, userId)))[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    const assignment = (await db.select().from(storeAssignments).where(
      and(eq(storeAssignments.userId, user.id), eq(storeAssignments.active, true))
    ))[0];

    const store = assignment
      ? (await db.select().from(stores).where(eq(stores.id, assignment.storeId)))[0]
      : (await db.select().from(stores).where(eq(stores.workspaceId, user.workspaceId)))[0];

    const allFocusProducts = await db.select().from(products).where(
      and(eq(products.workspaceId, user.workspaceId), eq(products.isFocusPromo, true))
    );
    const focusProducts = allFocusProducts.filter(p => !store || p.currency === store.currency);

    const todayDate = new Date().toISOString().split('T')[0];
    let shift = (await db.select().from(shifts).where(
      and(eq(shifts.userId, user.id), eq(shifts.shiftDate, todayDate))
    ))[0];

    // Compute current sales total for shift
    let currentShiftTotal = 0;
    if (shift) {
      const allSales = await db.select().from(salesTransactions).where(eq(salesTransactions.shiftId, shift.id));
      currentShiftTotal = allSales.reduce((acc, tx) => acc + tx.totalAmount, 0);
    }

    const messages = await db.select().from(chatMessages).where(eq(chatMessages.userId, user.id));

    res.json({
      user,
      store,
      shift,
      focusProducts,
      currentShiftTotal,
      targetAmount: shift ? shift.targetAmount : (store?.dailyTargetDefault || 15000),
      currency: store?.currency || 'PHP',
      messages,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 2. TRIGGER MORNING MISSION BRIEFING (PAX)
// ----------------------------------------------------
app.post('/api/pax/briefing', async (req, res) => {
  try {
    const { userId } = req.body;
    const result = await PaxAgent.getMorningBriefing(userId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 3. CONVERSATIONAL CHAT (PAX)
// ----------------------------------------------------
app.post('/api/pax/chat', async (req, res) => {
  try {
    const { userId, message } = req.body;
    const result = await PaxAgent.handleChat(userId, message);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 4. 3-SECOND FAST-SALE LOGGING
// ----------------------------------------------------
app.post('/api/sales/fast-sale', async (req, res) => {
  try {
    const { userId, storeId, items } = req.body;
    const result = await PaxAgent.recordFastSale(userId, storeId, items);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 5. VERA MULTIMODAL SHELF AUDIT
// ----------------------------------------------------
app.post('/api/audit/shelf', async (req, res) => {
  try {
    const { userId, storeId, imageBase64, mimeType } = req.body;
    const result = await VeraAgent.auditShelf(userId, storeId, imageBase64, mimeType);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 6. NEXUS SUPERVISOR DASHBOARD
// ----------------------------------------------------
app.get('/api/supervisor/dashboard', async (req, res) => {
  try {
    const result = await NexusAgent.getSupervisorDashboard();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Fallback to PWA
app.use((req, res) => {
  res.sendFile(path.join(webDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Project BLOC Server running on http://localhost:${PORT}`);
});
