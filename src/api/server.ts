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
// 6. PRODUCT CATALOG & SKU SEARCH
// ----------------------------------------------------
app.get('/api/products', async (req, res) => {
  try {
    const { q, currency } = req.query as { q?: string; currency?: string };
    const allProducts = await db.select().from(products);
    let filtered = allProducts;
    if (currency) {
      filtered = filtered.filter(p => p.currency === currency);
    }
    if (q && q.trim()) {
      const term = q.trim().toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.skuCode.toLowerCase().includes(term) ||
        (p.barcode && p.barcode.toLowerCase().includes(term)) ||
        p.category.toLowerCase().includes(term)
      );
    }
    res.json(filtered);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 7. IN-MEMORY CHAT THREADS (PAX, PEERS, ORG-CHART GC)
// ----------------------------------------------------
interface ChatThread {
  id: string;
  type: 'agent' | 'direct' | 'group_org_chart';
  title: string;
  subtitle: string;
  avatar: string;
  badge?: string;
  isPinned?: boolean;
  isOrgManaged?: boolean;
  unreadCount: number;
  lastMessage: string;
  lastTime: string;
}

const threadMessages: Record<string, Array<{ id: string; sender: string; name: string; avatar?: string; text: string; time: string; isUser: boolean }>> = {
  'chat-lester': [
    { id: 'm1', sender: 'usr-lester-lead', name: 'Lester Alarcon', text: 'Good morning! Please make sure to complete your morning planogram audit by 11:00 AM.', time: '09:15 AM', isUser: false },
    { id: 'm2', sender: 'user', name: 'You', text: 'Noted sir Lester! Will take the shelf photo now.', time: '09:18 AM', isUser: true },
    { id: 'm3', sender: 'usr-lester-lead', name: 'Lester Alarcon', text: 'Great. Also focus on the promotional bundle packs today—we have weekend traffic coming in.', time: '09:20 AM', isUser: false },
  ],
  'chat-gc-store': [
    { id: 'gm1', sender: 'system', name: 'BLOC Ops Engine', text: '📋 [Org Chart Automation] Channel provisioned automatically for SM Megamall Floor Ops.', time: '08:00 AM', isUser: false },
    { id: 'gm2', sender: 'usr-lester-lead', name: 'Lester Alarcon', text: 'Team, daily quota for today is set at ₱25,000. Let us push the breakfast bundle!', time: '08:30 AM', isUser: false },
    { id: 'gm3', sender: 'usr-sarah-sg', name: 'Sarah Tan', text: 'Cheering for the Manila team from VivoCity SG! Let us beat yesterday’s numbers! 🔥', time: '09:05 AM', isUser: false },
  ],
  'chat-gc-region': [
    { id: 'rg1', sender: 'system', name: 'Nexus Engine', text: '📊 JAPAC Regional Morning Briefing synced. 2/2 stores currently reporting active sell-through.', time: '08:00 AM', isUser: false },
    { id: 'rg2', sender: 'usr-lester-lead', name: 'Lester Alarcon', text: 'WSS Google Sheets synchronization is active for all store promoters.', time: '09:30 AM', isUser: false },
  ],
};

app.get('/api/chats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const isSarah = userId === 'usr-sarah-sg';
    const storeName = isSarah ? 'FairPrice VivoCity' : 'SM Megamall';

    const threads: ChatThread[] = [
      {
        id: 'chat-pax',
        type: 'agent',
        title: 'Pax · Frontline Copilot',
        subtitle: 'Autonomous AI Orchestrator & Daily Guide',
        avatar: '🤖',
        badge: 'Verified AI Guide',
        isPinned: true,
        unreadCount: 0,
        lastMessage: '☀️ Shift active! Tap to record Fast-Sale or ask for daily tasks.',
        lastTime: 'Just now',
      },
      {
        id: 'chat-lester',
        type: 'direct',
        title: 'Lester Alarcon',
        subtitle: 'Regional Retail Supervisor · Online',
        avatar: '👨‍💼',
        badge: 'Supervisor',
        unreadCount: 1,
        lastMessage: 'Great. Also focus on the promotional bundle packs today...',
        lastTime: '09:20 AM',
      },
      {
        id: 'chat-gc-store',
        type: 'group_org_chart',
        title: `# ${storeName} Floor Ops`,
        subtitle: 'Auto-synced via Company Org Chart (6 members)',
        avatar: '🏬',
        badge: 'Org-Chart GC',
        isOrgManaged: true,
        unreadCount: 2,
        lastMessage: 'Sarah: Cheering for the team! Let us beat yesterday’s numbers!',
        lastTime: '09:05 AM',
      },
      {
        id: 'chat-gc-region',
        type: 'group_org_chart',
        title: '# JAPAC Retail Operations',
        subtitle: 'Enterprise HQ & Regional Promoters (24 members)',
        avatar: '🌏',
        badge: 'Org-Chart GC',
        isOrgManaged: true,
        unreadCount: 0,
        lastMessage: 'Nexus: JAPAC Regional Morning Briefing synced.',
        lastTime: '08:00 AM',
      },
    ];

    res.json(threads);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/chats/:chatId/messages', (req, res) => {
  const { chatId } = req.params;
  const list = threadMessages[chatId] || [];
  res.json(list);
});

app.post('/api/chats/:chatId/messages', (req, res) => {
  const { chatId } = req.params;
  const { text } = req.body;
  if (!threadMessages[chatId]) {
    threadMessages[chatId] = [];
  }
  const newMsg = {
    id: `m-${Date.now()}`,
    sender: 'user',
    name: 'You',
    text: text || '',
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    isUser: true,
  };
  threadMessages[chatId].push(newMsg);
  res.json(newMsg);
});

// ----------------------------------------------------
// 8. NEXUS SUPERVISOR DASHBOARD & ORG CHART
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
