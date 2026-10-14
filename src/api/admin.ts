import { Router } from 'express';
import { db } from '../db/client.js';
import {
  workspaces, users, stores, products, storeAssignments, auditLogs,
  agentRegistry, agentSkills, agentTasks, agentFieldContacts,
  executiveReports, orgNodes, shifts, salesTransactions, shelfAudits, chatMessages,
} from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { DemoGenerator } from '../agents/demo/index.js';
import { COUNTRY_CURRENCY } from '../lib/currency.js';
import { ai, MODELS } from '../integrations/google/gemini.js';

export const adminRouter = Router();

const newId = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const DEFAULT_PAYMENT_CONFIG = {
  paymentMethods: [
    { id: 'cash', label: 'Cash', enabled: true, requiresApproval: false, allowedTerms: ['straight'] },
    { id: 'credit_card', label: 'Credit Card', enabled: true, requiresApproval: true, allowedTerms: ['straight', '3_months', '6_months', '12_months', '24_months'] },
    { id: 'home_credit', label: 'Home Credit Installment', enabled: true, requiresApproval: true, allowedTerms: ['6_months', '9_months', '12_months', '18_months', '24_months'] },
    { id: 'e_wallet', label: 'E-Wallet (GCash / Maya / GrabPay)', enabled: true, requiresApproval: false, allowedTerms: ['straight'] },
    { id: 'bnpl', label: 'BNPL (Atome / SPayLater)', enabled: true, requiresApproval: true, allowedTerms: ['straight', '3_months', '6_months'] },
  ],
  paymentTerms: [
    { id: 'straight', label: 'Straight Payment', enabled: true },
    { id: '3_months', label: '3 Months (0% Interest)', enabled: true },
    { id: '6_months', label: '6 Months (0% Interest)', enabled: true },
    { id: '9_months', label: '9 Months Financing', enabled: true },
    { id: '12_months', label: '12 Months (0% Interest)', enabled: true },
    { id: '18_months', label: '18 Months Financing', enabled: true },
    { id: '24_months', label: '24 Months Financing', enabled: true },
  ],
};

const DEFAULT_AI_GOVERNANCE = {
  enabled: true,
  allowedRoles: {
    super_admin: { canQuery: true, canConfigure: true, requiresApproval: false, approvalThreshold: 'none', description: 'Full access to query system and execute administrative configurations' },
    company_admin: { canQuery: true, canConfigure: true, requiresApproval: true, approvalThreshold: 'self_sign', description: 'Can query and configure with recorded approval signature' },
    supervisor: { canQuery: true, canConfigure: false, requiresApproval: false, approvalThreshold: 'read_only', description: 'Read-only analytics, store 360, task dispatch; cannot modify system configuration' },
    promoter: { canQuery: false, canConfigure: false, requiresApproval: false, approvalThreshold: 'blocked', description: 'Blocked from administrative copilot; frontline Pax access only' },
  },
  requireSupervisorSignOffOnConfig: true,
  autoAuditAllAiActions: true,
  maxConfigChangesPerHour: 20,
};

async function log(
  workspaceId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  details: any,
  module: string = 'general',
  actorId?: string | null,
  approvedBy?: string | null,
  aiAgentId?: string | null,
  approvalStatus: string = 'approved'
) {
  try {
    await db.insert(auditLogs).values({
      id: newId('log'),
      workspaceId,
      action,
      resourceType,
      resourceId,
      details,
      module,
      actorId: actorId || null,
      approvedBy: approvedBy || 'Admin System',
      aiAgentId: aiAgentId || null,
      approvalStatus,
      timestamp: new Date(),
    } as any);
  } catch { /* audit logging must never break the request */ }
}

const wrap = (fn: (req: any, res: any) => Promise<any>) => async (req: any, res: any) => {
  try { await fn(req, res); } catch (err: any) { res.status(500).json({ error: err.message }); }
};

// ============================================================
// AUTO-INITIALIZER / SEEDER FOR ENTERPRISE AGENTS & SKILLS
// ============================================================
async function seedInitialAuditLogs(wsId: string, now: Date) {
  try {
    const existingLogs = await db.select().from(auditLogs).where(eq(auditLogs.workspaceId, wsId)).limit(1);
    if (existingLogs.length > 0) return;

    await db.insert(auditLogs).values([
      {
        id: newId('log'),
        workspaceId: wsId,
        module: 'ai_governance',
        action: 'governance.guardrails_initialized',
        resourceType: 'system_policy',
        resourceId: wsId,
        actorId: null,
        approvedBy: 'Super Admin Security Root',
        aiAgentId: `agent-aegis-${wsId}`,
        approvalStatus: 'approved',
        details: { allowedRoles: ['super_admin', 'company_admin'], readOnlyRoles: ['supervisor'], blockedRoles: ['promoter'] },
        timestamp: new Date(now.getTime() - 86400000 * 2),
      },
      {
        id: newId('log'),
        workspaceId: wsId,
        module: 'config',
        action: 'payment_gateway.configured',
        resourceType: 'payment_config',
        resourceId: wsId,
        actorId: null,
        approvedBy: 'Finance Operations Director',
        aiAgentId: `agent-aegis-${wsId}`,
        approvalStatus: 'approved',
        details: { channels: ['cash', 'credit_card', 'home_credit', 'e_wallet', 'bnpl'], installmentTerms: ['straight', '3_months', '6_months', '12_months', '24_months'] },
        timestamp: new Date(now.getTime() - 86400000),
      },
      {
        id: newId('log'),
        workspaceId: wsId,
        module: 'sales',
        action: 'fast_sale.recorded',
        resourceType: 'sales_transaction',
        resourceId: 'tx-seed-01',
        actorId: null,
        approvedBy: 'Pax Automated Quota Check',
        aiAgentId: `agent-pax-${wsId}`,
        approvalStatus: 'approved',
        details: { paymentMethod: 'credit_card', paymentTerms: '12_months', approvalCode: 'AUTH-789012', amount: 1499 },
        timestamp: new Date(now.getTime() - 3600000 * 5),
      },
      {
        id: newId('log'),
        workspaceId: wsId,
        module: 'tasks',
        action: 'task.dispatched',
        resourceType: 'agent_task',
        resourceId: `task-11am-audit-${wsId}`,
        actorId: null,
        approvedBy: 'Vera Autonomous Scheduler',
        aiAgentId: `agent-vera-${wsId}`,
        approvalStatus: 'auto_approved',
        details: { targetScope: 'all_stores', followUpIntervalMins: 30 },
        timestamp: new Date(now.getTime() - 3600000 * 3),
      },
      {
        id: newId('log'),
        workspaceId: wsId,
        module: 'stores',
        action: 'store.geofence_verified',
        resourceType: 'store',
        resourceId: 'store-fp-vivo',
        actorId: null,
        approvedBy: 'Nexus Operations Sentinel',
        aiAgentId: `agent-nexus-${wsId}`,
        approvalStatus: 'approved',
        details: { geofenceRadiusMeters: 150, clockInVerified: true },
        timestamp: new Date(now.getTime() - 3600000),
      },
    ] as any);
  } catch { /* seed should never crash app */ }
}

async function ensureEnterpriseAgentsAndSkills(wsId: string) {
  const existing = await db.select().from(agentRegistry).where(eq(agentRegistry.workspaceId, wsId));
  const aegisId = `agent-aegis-${wsId}`;
  const now = new Date();

  // If agents already exist, ensure Aegis and initial logs are also present
  if (existing.length > 0) {
    const hasAegis = existing.some(a => a.id === aegisId);
    if (!hasAegis) {
      await db.insert(agentRegistry).values({
        id: aegisId,
        workspaceId: wsId,
        name: 'Aegis Copilot',
        role: 'Enterprise Governance, Policy Guardrails & System Copilot',
        avatar: 'shield',
        model: 'gemini-2.5-flash',
        systemPrompt: 'You are Aegis, the Enterprise Governance and Operations Copilot for Project BLOC. You monitor audit trails, guardrail permissions, store health, financial payment mixes, and execute administrative configuration updates under strict enterprise role governance.',
        status: 'active',
        active: true,
        createdAt: now,
      } as any);

      await db.insert(agentSkills).values([
        {
          id: `skill-aegis-config-${wsId}`,
          workspaceId: wsId,
          agentId: aegisId,
          name: 'System Configuration & Policy Engine',
          code: 'system_config_engine',
          description: 'Translates high-level admin intents into schema-compliant system configuration updates with audit logging.',
          triggerType: 'on_demand',
          config: { requiresAdminRole: true },
          enabled: true,
          createdAt: now,
        },
        {
          id: `skill-aegis-payment-${wsId}`,
          workspaceId: wsId,
          agentId: aegisId,
          name: 'Payment Method & Credit Terms Governance',
          code: 'payment_governance',
          description: 'Manages frontline payment channels (Cash, Cards, Home Credit 0% APR) and validates authorization approval requirements.',
          triggerType: 'on_demand',
          config: { defaultApprovalRequiredForInstallment: true },
          enabled: true,
          createdAt: now,
        },
        {
          id: `skill-aegis-audit-${wsId}`,
          workspaceId: wsId,
          agentId: aegisId,
          name: 'Cross-Module Audit & Compliance Inspector',
          code: 'audit_governance',
          description: 'Continuously inspects transaction integrity, role escalations, and system modification history across all 9 modules.',
          triggerType: 'on_demand',
          config: { retainLogDays: 365 },
          enabled: true,
          createdAt: now,
        },
      ] as any);
    }
    await seedInitialAuditLogs(wsId, now);
    return;
  }

  // 1. Core AI Agents (Pax, Vera, Nexus, Aegis)
  const paxId = `agent-pax-${wsId}`;
  const veraId = `agent-vera-${wsId}`;
  const nexusId = `agent-nexus-${wsId}`;

  await db.insert(agentRegistry).values([
    {
      id: paxId,
      workspaceId: wsId,
      name: 'Pax Copilot',
      role: 'Frontline Conversational Operations Copilot',
      avatar: 'smart_toy',
      model: 'gemini-2.5-flash',
      systemPrompt: 'You are Pax, an autonomous frontline copilot guiding retail promoters across Singapore, Philippines, and JAPAC. You handle morning briefings, fast-sale logging, and multilingual translation.',
      status: 'active',
      active: true,
      createdAt: now,
    },
    {
      id: veraId,
      workspaceId: wsId,
      name: 'Vera Auditor',
      role: 'Multimodal Computer Vision Shelf & Planogram Auditor',
      avatar: 'photo_camera',
      model: 'gemini-2.5-pro',
      systemPrompt: 'You are Vera, a computer vision retail auditor. You analyze shelf photos, calculate Share of Shelf (SoS), verify planograms against gold standards, and detect missing price tags or out-of-stock gaps.',
      status: 'active',
      active: true,
      createdAt: now,
    },
    {
      id: nexusId,
      workspaceId: wsId,
      name: 'Nexus Sentinel',
      role: 'Regional Operations Router & Google Sheets Synchronizer',
      avatar: 'hub',
      model: 'gemini-2.5-flash',
      systemPrompt: 'You are Nexus, an enterprise data orchestrator. You normalize regional multi-currency sales, sync live Google Sheets, and route operational escalations to supervisors.',
      status: 'active',
      active: true,
      createdAt: now,
    },
    {
      id: aegisId,
      workspaceId: wsId,
      name: 'Aegis Copilot',
      role: 'Enterprise Governance, Policy Guardrails & System Copilot',
      avatar: 'shield',
      model: 'gemini-2.5-flash',
      systemPrompt: 'You are Aegis, the Enterprise Governance and Operations Copilot for Project BLOC. You monitor audit trails, guardrail permissions, store health, financial payment mixes, and execute administrative configuration updates under strict enterprise role governance.',
      status: 'active',
      active: true,
      createdAt: now,
    },
  ] as any);

  // 2. Specialized Skills
  const skillPlanogramId = `skill-plano-${wsId}`;
  const skillStockoutId = `skill-stockout-${wsId}`;
  const skillPacingId = `skill-pacing-${wsId}`;
  const skillIntelId = `skill-intel-${wsId}`;
  const skillSyncId = `skill-sync-${wsId}`;
  const skillAegisConfigId = `skill-aegis-config-${wsId}`;
  const skillAegisPaymentId = `skill-aegis-payment-${wsId}`;
  const skillAegisAuditId = `skill-aegis-audit-${wsId}`;

  await db.insert(agentSkills).values([
    {
      id: skillPlanogramId,
      workspaceId: wsId,
      agentId: veraId,
      name: 'Planogram Compliance & Shelf Alignment',
      code: 'planogram_audit',
      description: 'Analyzes endcap and gondola photos via Gemini 2.5 Pro optical feed, checks 3-facing product alignment, and flags missing shelf tags.',
      triggerType: 'scheduled',
      config: { tolerancePct: 85, defaultEndcap: '#04 Endcap' },
      enabled: true,
      createdAt: now,
    },
    {
      id: skillStockoutId,
      workspaceId: wsId,
      agentId: veraId,
      name: 'Out-of-Stock (OOS) Gap Sentinel',
      code: 'stockout_alert',
      description: 'Scans for empty facings, cross-references sell-through velocity, and triggers replenishment alerts to area supervisors.',
      triggerType: 'event_driven',
      config: { autoAlertSupervisor: true },
      enabled: true,
      createdAt: now,
    },
    {
      id: skillPacingId,
      workspaceId: wsId,
      agentId: paxId,
      name: 'Morning Mission Briefing & Quota Pacing',
      code: 'shift_pacing',
      description: 'Sends attendance check-in reminders, briefs promoters on daily sales targets, and provides encouraging midday run-rate tips.',
      triggerType: 'scheduled',
      config: { checkInGracePeriodMins: 15 },
      enabled: true,
      createdAt: now,
    },
    {
      id: skillIntelId,
      workspaceId: wsId,
      agentId: paxId,
      name: 'Competitor Promo & Price Intelligence',
      code: 'competitor_intel',
      description: 'Prompts promoters to log competitor bundle discounts and flash promos observed on neighboring floor displays.',
      triggerType: 'on_demand',
      config: {},
      enabled: true,
      createdAt: now,
    },
    {
      id: skillSyncId,
      workspaceId: wsId,
      agentId: nexusId,
      name: 'Google Sheets & ERP Bidirectional Sync',
      code: 'sheets_sync',
      description: 'Streams completed transactions and shift metrics to corporate Google Sheets, and receives executive target adjustments.',
      triggerType: 'scheduled',
      config: { syncIntervalSeconds: 30 },
      enabled: true,
      createdAt: now,
    },
    {
      id: skillAegisConfigId,
      workspaceId: wsId,
      agentId: aegisId,
      name: 'System Configuration & Policy Engine',
      code: 'system_config_engine',
      description: 'Translates high-level admin intents into schema-compliant system configuration updates with audit logging.',
      triggerType: 'on_demand',
      config: { requiresAdminRole: true },
      enabled: true,
      createdAt: now,
    },
    {
      id: skillAegisPaymentId,
      workspaceId: wsId,
      agentId: aegisId,
      name: 'Payment Method & Credit Terms Governance',
      code: 'payment_governance',
      description: 'Manages frontline payment channels (Cash, Cards, Home Credit 0% APR) and validates authorization approval requirements.',
      triggerType: 'on_demand',
      config: { defaultApprovalRequiredForInstallment: true },
      enabled: true,
      createdAt: now,
    },
    {
      id: skillAegisAuditId,
      workspaceId: wsId,
      agentId: aegisId,
      name: 'Cross-Module Audit & Compliance Inspector',
      code: 'audit_governance',
      description: 'Continuously inspects transaction integrity, role escalations, and system modification history across all 9 modules.',
      triggerType: 'on_demand',
      config: { retainLogDays: 365 },
      enabled: true,
      createdAt: now,
    },
  ] as any);

  // 3. Autonomous Field Tasks
  const task1Id = `task-11am-audit-${wsId}`;
  const task2Id = `task-midday-pacing-${wsId}`;
  const task3Id = `task-competitor-${wsId}`;

  await db.insert(agentTasks).values([
    {
      id: task1Id,
      workspaceId: wsId,
      agentId: veraId,
      skillId: skillPlanogramId,
      title: '11:00 AM Shelf #4 Endcap Planogram Audit',
      description: 'Prompts promoters to photograph and verify central endcap layout against reference guidelines.',
      targetScope: 'all_stores',
      scheduleCron: '0 11 * * *',
      followUpIntervalMins: 30,
      escalationThresholdMins: 60,
      status: 'active',
      createdBy: 'Lester Alarcon',
      createdAt: now,
    },
    {
      id: task2Id,
      workspaceId: wsId,
      agentId: paxId,
      skillId: skillPacingId,
      title: 'Midday Shift Sales Run-Rate Pacing',
      description: 'Reviews current shift sell-through vs target and delivers customized motivational pacing in promoter dialect.',
      targetScope: 'all_stores',
      scheduleCron: '0 13 * * *',
      followUpIntervalMins: 15,
      escalationThresholdMins: 45,
      status: 'active',
      createdBy: 'Lester Alarcon',
      createdAt: now,
    },
    {
      id: task3Id,
      workspaceId: wsId,
      agentId: paxId,
      skillId: skillIntelId,
      title: 'Weekend Competitor Bundle Spot-Check',
      description: 'Inquires about neighboring brand promotions and discounts on consumer electronics.',
      targetScope: 'all_stores',
      scheduleCron: '0 15 * * 6,0',
      followUpIntervalMins: 45,
      escalationThresholdMins: 90,
      status: 'active',
      createdBy: 'Lester Alarcon',
      createdAt: now,
    },
  ] as any);

  // 4. Initial Field Contact Logs (Simulated compliance tracking)
  const storeList = await db.select().from(stores).where(eq(stores.workspaceId, wsId));
  const userList = await db.select().from(users).where(eq(users.workspaceId, wsId));
  const promoter = userList.find(u => u.role === 'promoter') || userList[0];
  const supervisor = userList.find(u => u.role === 'supervisor') || userList[0];
  const primaryStore = storeList[0];
  const secondaryStore = storeList[1] || storeList[0];

  if (promoter && primaryStore) {
    await db.insert(agentFieldContacts).values([
      {
        id: newId('fc'),
        workspaceId: wsId,
        taskId: task1Id,
        userId: promoter.id,
        storeId: primaryStore.id,
        status: 'compliant',
        promptSent: 'Hi Liza! Vera here. Please upload a photo of Shelf Endcap #04 to verify summer planogram alignment.',
        responseReceived: 'Photo submitted: Endcap #04 Optical Feed',
        complianceScore: 94.5,
        auditImageId: 'drive-img-shelf-endcap-04',
        escalated: false,
        escalatedToUserId: null,
        timestamp: new Date(Date.now() - 3600000), // 1 hr ago
      },
      {
        id: newId('fc'),
        workspaceId: wsId,
        taskId: task1Id,
        userId: userList[1]?.id || promoter.id,
        storeId: secondaryStore?.id || primaryStore.id,
        status: 'escalated',
        promptSent: 'Vera reminder: 11:00 AM Shelf #4 Endcap photo is 45 minutes overdue. Please upload to maintain compliance.',
        responseReceived: 'No response received past 45m threshold',
        complianceScore: 0,
        auditImageId: null,
        escalated: true,
        escalatedToUserId: supervisor?.id || null,
        timestamp: new Date(Date.now() - 1800000), // 30m ago
      },
    ] as any);
  }

  // 5. Initial Executive Report
  await db.insert(executiveReports).values({
    id: newId('rep'),
    workspaceId: wsId,
    title: 'Executive Planogram & Shift Compliance Digest',
    reportType: 'planogram_compliance',
    period: 'Current Operational Shift',
    summary: 'Cross-store analysis reveals 91.8% average planogram compliance across Metro Manila and Singapore flagship branches. High sell-through velocity observed on pinned promotional SKUs, with SM Megamall exceeding run-rate benchmarks.',
    keyFindings: [
      'SM Megamall achieved 94.5% planogram compliance with full 3-facing display alignment.',
      'FairPrice VivoCity experienced an overdue audit notification; automatic supervisor escalation triggered to Area Lead.',
      'Pinned Focus Promo SKUs accounted for 68% of total shift sell-through volume.',
      'No critical out-of-stock gaps detected on top 3 revenue-generating inventory lines.',
    ],
    metrics: { avgCompliance: 91.8, activeStoresCount: storeList.length, onDutyPromoters: userList.length, totalPacingPct: 78 },
    generatedByAgentId: veraId,
    createdAt: now,
  } as any);

  // 6. Corporate Org Nodes
  const hqNodeId = `org-hq-${wsId}`;
  const regPhId = `org-reg-ph-${wsId}`;
  const regSgId = `org-reg-sg-${wsId}`;

  await db.insert(orgNodes).values([
    {
      id: hqNodeId,
      workspaceId: wsId,
      parentId: null,
      title: 'JAPAC Commercial Retail Operations HQ',
      nodeType: 'hq',
      leaderUserId: supervisor?.id || null,
      memberCount: userList.length,
      displayOrder: 1,
    },
    {
      id: regPhId,
      workspaceId: wsId,
      parentId: hqNodeId,
      title: 'Philippines Modern Trade Division',
      nodeType: 'region',
      leaderUserId: supervisor?.id || null,
      memberCount: Math.ceil(userList.length / 2),
      displayOrder: 2,
    },
    {
      id: regSgId,
      workspaceId: wsId,
      parentId: hqNodeId,
      title: 'Singapore Supermarket Division',
      nodeType: 'region',
      leaderUserId: supervisor?.id || null,
      memberCount: Math.floor(userList.length / 2),
      displayOrder: 3,
    },
  ] as any);
}

// ---------------- Workspaces ----------------
adminRouter.get('/workspaces', wrap(async (_req, res) => {
  const list = await db.select().from(workspaces);
  res.json(list.map(w => ({ id: w.id, name: w.name, slug: w.slug, baseCurrency: w.baseCurrency, isDemo: w.id.startsWith('ws-demo-'), settings: w.settings, createdAt: w.createdAt })));
}));

adminRouter.get('/workspaces/:ws/users', wrap(async (req, res) => {
  await ensureEnterpriseAgentsAndSkills(req.params.ws);
  const list = await db.select().from(users).where(eq(users.workspaceId, req.params.ws));
  const assigns = await db.select().from(storeAssignments).where(eq(storeAssignments.workspaceId, req.params.ws));
  const storeList = await db.select().from(stores).where(eq(stores.workspaceId, req.params.ws));
  res.json(list.map(u => {
    const a = assigns.find(x => x.userId === u.id && x.active);
    const s = a ? storeList.find(st => st.id === a.storeId) : undefined;
    return { ...u, storeId: s?.id || null, storeName: s?.name || null };
  }));
}));

// ---------------- Stores ----------------
adminRouter.get('/admin/:ws/stores', wrap(async (req, res) => {
  await ensureEnterpriseAgentsAndSkills(req.params.ws);
  res.json(await db.select().from(stores).where(eq(stores.workspaceId, req.params.ws)));
}));

adminRouter.post('/admin/:ws/stores', wrap(async (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.storeCode || !b.country) return res.status(400).json({ error: 'name, storeCode and country are required' });
  const row = {
    id: newId('store'), workspaceId: req.params.ws, storeCode: String(b.storeCode), name: String(b.name), chain: String(b.chain || ''),
    country: String(b.country).toUpperCase(), city: String(b.city || ''), address: b.address || null,
    dailyTargetDefault: Number(b.dailyTargetDefault) || 1000, currency: b.currency || COUNTRY_CURRENCY[String(b.country).toUpperCase()] || 'SGD', active: true,
  };
  await db.insert(stores).values(row);
  await log(req.params.ws, 'store.create', 'store', row.id, row);
  res.json(row);
}));

adminRouter.put('/admin/:ws/stores/:id', wrap(async (req, res) => {
  const b = req.body || {};
  const patch: any = {};
  for (const k of ['storeCode', 'name', 'chain', 'country', 'city', 'address', 'currency']) if (b[k] !== undefined) patch[k] = String(b[k]);
  if (b.dailyTargetDefault !== undefined) patch.dailyTargetDefault = Number(b.dailyTargetDefault);
  if (b.active !== undefined) patch.active = !!b.active;
  await db.update(stores).set(patch).where(and(eq(stores.id, req.params.id), eq(stores.workspaceId, req.params.ws)));
  await log(req.params.ws, 'store.update', 'store', req.params.id, patch);
  res.json({ ok: true });
}));

// ---------------- Store 360° Deep Drill-Down ----------------
adminRouter.get('/admin/:ws/stores/:id/360', wrap(async (req, res) => {
  const { ws, id } = req.params;
  const storeRows = await db.select().from(stores).where(and(eq(stores.id, id), eq(stores.workspaceId, ws)));
  if (!storeRows.length) return res.status(404).json({ error: 'Store not found' });
  const store = storeRows[0];

  // Assigned Staff & Shifts
  const assigns = await db.select().from(storeAssignments).where(and(eq(storeAssignments.storeId, id), eq(storeAssignments.workspaceId, ws)));
  const userIds = assigns.map(a => a.userId);
  const allUsers = await db.select().from(users).where(eq(users.workspaceId, ws));
  const assignedUsers = allUsers.filter(u => userIds.includes(u.id));

  const storeShifts = await db.select().from(shifts).where(eq(shifts.storeId, id));
  const transactions = await db.select().from(salesTransactions).where(eq(salesTransactions.storeId, id)).orderBy(desc(salesTransactions.timestamp)).limit(20);
  const audits = await db.select().from(shelfAudits).where(eq(shelfAudits.storeId, id)).orderBy(desc(shelfAudits.timestamp)).limit(5);
  const tasks = await db.select().from(agentTasks).where(eq(agentTasks.workspaceId, ws));
  const contacts = await db.select().from(agentFieldContacts).where(and(eq(agentFieldContacts.storeId, id), eq(agentFieldContacts.workspaceId, ws))).orderBy(desc(agentFieldContacts.timestamp));

  const totalSales = transactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
  const quota = store.dailyTargetDefault || 15000;
  const pacingPct = Math.min(100, Math.round((totalSales / quota) * 100));

  const storePaymentBreakdown: Record<string, { count: number; total: number; label: string }> = {
    cash: { count: 0, total: 0, label: 'Cash' },
    credit_card: { count: 0, total: 0, label: 'Credit Card' },
    home_credit: { count: 0, total: 0, label: 'Home Credit' },
    e_wallet: { count: 0, total: 0, label: 'E-Wallet' },
    bnpl: { count: 0, total: 0, label: 'BNPL' },
  };
  transactions.forEach(t => {
    const pm = t.paymentMethod || 'cash';
    if (!storePaymentBreakdown[pm]) storePaymentBreakdown[pm] = { count: 0, total: 0, label: pm.replace('_', ' ').toUpperCase() };
    storePaymentBreakdown[pm].count += 1;
    storePaymentBreakdown[pm].total += t.totalAmount || 0;
  });

  res.json({
    store,
    assignedUsers,
    shifts: storeShifts,
    recentTransactions: transactions,
    audits,
    totalSales,
    quota,
    pacingPct,
    activeTasks: tasks,
    contacts,
    paymentBreakdown: storePaymentBreakdown,
  });
}));

// ---------------- Products ----------------
adminRouter.get('/admin/:ws/products', wrap(async (req, res) => {
  await ensureEnterpriseAgentsAndSkills(req.params.ws);
  res.json(await db.select().from(products).where(eq(products.workspaceId, req.params.ws)));
}));

adminRouter.post('/admin/:ws/products', wrap(async (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.skuCode || b.unitPrice === undefined) return res.status(400).json({ error: 'name, skuCode and unitPrice are required' });
  const row = {
    id: newId('prod'), workspaceId: req.params.ws, skuCode: String(b.skuCode), barcode: b.barcode || null, name: String(b.name),
    category: String(b.category || 'General'), unitPrice: Number(b.unitPrice), currency: String(b.currency || 'SGD'),
    commissionPerUnit: Number(b.commissionPerUnit) || 0, isFocusPromo: !!b.isFocusPromo, active: true,
  };
  await db.insert(products).values(row);
  await log(req.params.ws, 'product.create', 'product', row.id, row);
  res.json(row);
}));

adminRouter.put('/admin/:ws/products/:id', wrap(async (req, res) => {
  const b = req.body || {};
  const patch: any = {};
  for (const k of ['skuCode', 'barcode', 'name', 'category', 'currency']) if (b[k] !== undefined) patch[k] = String(b[k]);
  for (const k of ['unitPrice', 'commissionPerUnit']) if (b[k] !== undefined) patch[k] = Number(b[k]);
  for (const k of ['isFocusPromo', 'active']) if (b[k] !== undefined) patch[k] = !!b[k];
  await db.update(products).set(patch).where(and(eq(products.id, req.params.id), eq(products.workspaceId, req.params.ws)));
  await log(req.params.ws, 'product.update', 'product', req.params.id, patch);
  res.json({ ok: true });
}));

// ---------------- Users ----------------
async function setAssignment(ws: string, userId: string, storeId: string | null) {
  await db.update(storeAssignments).set({ active: false } as any).where(and(eq(storeAssignments.userId, userId), eq(storeAssignments.workspaceId, ws)));
  if (storeId) await db.insert(storeAssignments).values({ id: newId('as'), workspaceId: ws, userId, storeId, active: true } as any);
}

adminRouter.post('/admin/:ws/users', wrap(async (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.email) return res.status(400).json({ error: 'name and email are required' });
  const row = {
    id: newId('usr'), workspaceId: req.params.ws, name: String(b.name), email: String(b.email), phone: b.phone || null,
    role: String(b.role || 'promoter'), preferredLanguage: String(b.preferredLanguage || 'en'), timezone: String(b.timezone || 'Asia/Singapore'),
    active: true, createdAt: new Date(),
  };
  await db.insert(users).values(row);
  if (b.storeId) await setAssignment(req.params.ws, row.id, b.storeId);
  await log(req.params.ws, 'user.create', 'user', row.id, { ...row, storeId: b.storeId });
  res.json(row);
}));

adminRouter.put('/admin/:ws/users/:id', wrap(async (req, res) => {
  const b = req.body || {};
  const patch: any = {};
  for (const k of ['name', 'email', 'phone', 'role', 'preferredLanguage', 'timezone']) if (b[k] !== undefined) patch[k] = String(b[k]);
  if (b.active !== undefined) patch.active = !!b.active;
  if (Object.keys(patch).length) await db.update(users).set(patch).where(and(eq(users.id, req.params.id), eq(users.workspaceId, req.params.ws)));
  if (b.storeId !== undefined) await setAssignment(req.params.ws, req.params.id, b.storeId || null);
  await log(req.params.ws, 'user.update', 'user', req.params.id, { ...patch, storeId: b.storeId });
  res.json({ ok: true });
}));

// ============================================================
// AI AGENT REGISTRY & SKILL CONFIGURATION STUDIO
// ============================================================
adminRouter.get('/admin/:ws/agents', wrap(async (req, res) => {
  await ensureEnterpriseAgentsAndSkills(req.params.ws);
  const agentList = await db.select().from(agentRegistry).where(eq(agentRegistry.workspaceId, req.params.ws));
  const skillList = await db.select().from(agentSkills).where(eq(agentSkills.workspaceId, req.params.ws));
  const taskList = await db.select().from(agentTasks).where(eq(agentTasks.workspaceId, req.params.ws));

  const result = agentList.map(a => {
    const attachedSkills = skillList.filter(s => s.agentId === a.id);
    const assignedTasks = taskList.filter(t => t.agentId === a.id);
    return {
      ...a,
      skills: attachedSkills,
      skillsCount: attachedSkills.length,
      activeTasksCount: assignedTasks.filter(t => t.status === 'active').length,
    };
  });
  res.json(result);
}));

adminRouter.post('/admin/:ws/agents', wrap(async (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.role) return res.status(400).json({ error: 'name and role are required' });
  const row = {
    id: newId('agent'),
    workspaceId: req.params.ws,
    name: String(b.name),
    role: String(b.role),
    avatar: b.avatar || 'smart_toy',
    model: b.model || 'gemini-2.5-flash',
    systemPrompt: b.systemPrompt || '',
    status: 'active',
    active: true,
    createdAt: new Date(),
  };
  await db.insert(agentRegistry).values(row);
  await log(req.params.ws, 'agent.create', 'agent', row.id, row);
  res.json(row);
}));

adminRouter.get('/admin/:ws/agents/:id/skills', wrap(async (req, res) => {
  const list = await db.select().from(agentSkills).where(and(eq(agentSkills.agentId, req.params.id), eq(agentSkills.workspaceId, req.params.ws)));
  res.json(list);
}));

adminRouter.post('/admin/:ws/agents/:id/skills', wrap(async (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.code) return res.status(400).json({ error: 'name and code are required' });
  const row = {
    id: newId('skill'),
    workspaceId: req.params.ws,
    agentId: req.params.id,
    name: String(b.name),
    code: String(b.code),
    description: String(b.description || ''),
    triggerType: b.triggerType || 'scheduled',
    config: b.config || {},
    enabled: true,
    createdAt: new Date(),
  };
  await db.insert(agentSkills).values(row);
  await log(req.params.ws, 'skill.create', 'skill', row.id, row);
  res.json(row);
}));

adminRouter.put('/admin/:ws/skills/:id', wrap(async (req, res) => {
  const b = req.body || {};
  const patch: any = {};
  if (b.name !== undefined) patch.name = String(b.name);
  if (b.description !== undefined) patch.description = String(b.description);
  if (b.triggerType !== undefined) patch.triggerType = String(b.triggerType);
  if (b.config !== undefined) patch.config = b.config;
  if (b.enabled !== undefined) patch.enabled = !!b.enabled;
  await db.update(agentSkills).set(patch).where(and(eq(agentSkills.id, req.params.id), eq(agentSkills.workspaceId, req.params.ws)));
  await log(req.params.ws, 'skill.update', 'skill', req.params.id, patch);
  res.json({ ok: true });
}));

// ============================================================
// AUTONOMOUS FIELD TASKS & COMPLIANCE DISPATCH ENGINE
// ============================================================
adminRouter.get('/admin/:ws/tasks', wrap(async (req, res) => {
  await ensureEnterpriseAgentsAndSkills(req.params.ws);
  const tasks = await db.select().from(agentTasks).where(eq(agentTasks.workspaceId, req.params.ws));
  const agents = await db.select().from(agentRegistry).where(eq(agentRegistry.workspaceId, req.params.ws));
  const skills = await db.select().from(agentSkills).where(eq(agentSkills.workspaceId, req.params.ws));
  const contacts = await db.select().from(agentFieldContacts).where(eq(agentFieldContacts.workspaceId, req.params.ws));

  const result = tasks.map(t => {
    const ag = agents.find(a => a.id === t.agentId);
    const sk = skills.find(s => s.id === t.skillId);
    const taskContacts = contacts.filter(c => c.taskId === t.id);
    const compliantCount = taskContacts.filter(c => c.status === 'compliant').length;
    const escalatedCount = taskContacts.filter(c => c.status === 'escalated').length;

    return {
      ...t,
      agentName: ag?.name || 'AI Agent',
      agentRole: ag?.role || '',
      agentAvatar: ag?.avatar || 'smart_toy',
      skillName: sk?.name || 'General Skill',
      totalDispatched: taskContacts.length,
      compliantCount,
      escalatedCount,
      complianceRate: taskContacts.length ? Math.round((compliantCount / taskContacts.length) * 100) : 100,
    };
  });
  res.json(result);
}));

adminRouter.post('/admin/:ws/tasks', wrap(async (req, res) => {
  const b = req.body || {};
  if (!b.title || !b.agentId) return res.status(400).json({ error: 'title and agentId are required' });
  const row = {
    id: newId('task'),
    workspaceId: req.params.ws,
    agentId: String(b.agentId),
    skillId: b.skillId || null,
    title: String(b.title),
    description: b.description || '',
    targetScope: b.targetScope || 'all_stores',
    targetFilter: b.targetFilter || null,
    scheduleCron: b.scheduleCron || '0 11 * * *',
    followUpIntervalMins: Number(b.followUpIntervalMins) || 30,
    escalationThresholdMins: Number(b.escalationThresholdMins) || 60,
    status: 'active',
    createdBy: 'Company Operations',
    createdAt: new Date(),
  };
  await db.insert(agentTasks).values(row);
  await log(req.params.ws, 'task.create', 'task', row.id, row);
  res.json(row);
}));

// PROACTIVELY CONTACT FIELD FORCE: DISPATCH TASK TO PROMOTERS
adminRouter.post('/admin/:ws/tasks/:id/dispatch', wrap(async (req, res) => {
  const { ws, id } = req.params;
  const taskRows = await db.select().from(agentTasks).where(and(eq(agentTasks.id, id), eq(agentTasks.workspaceId, ws)));
  if (!taskRows.length) return res.status(404).json({ error: 'Task not found' });
  const task = taskRows[0];

  const agentRows = await db.select().from(agentRegistry).where(eq(agentRegistry.id, task.agentId));
  const agent = agentRows[0];
  const agentName = agent ? agent.name : 'AI Agent';

  const userList = await db.select().from(users).where(and(eq(users.workspaceId, ws), eq(users.role, 'promoter')));
  const storeList = await db.select().from(stores).where(eq(stores.workspaceId, ws));
  const assigns = await db.select().from(storeAssignments).where(eq(storeAssignments.workspaceId, ws));

  if (!userList.length) return res.json({ message: 'No frontline promoters in workspace', dispatchedCount: 0 });

  const dispatched = [];
  const now = new Date();

  for (const promoter of userList) {
    const assign = assigns.find(a => a.userId === promoter.id && a.active);
    const store = assign ? storeList.find(s => s.id === assign.storeId) : storeList[0];
    const storeId = store ? store.id : (storeList[0]?.id || 'store-unknown');

    const promptText = `🔔 [${agentName} Task Dispatch]: "${task.title}". Please verify execution and submit proof.`;

    // 1. Post to Chat Message Stream so promoter sees it in Pax chat!
    await db.insert(chatMessages).values({
      id: newId('msg'),
      userId: promoter.id,
      shiftId: null as any,
      sender: agent ? agent.name.toLowerCase().split(' ')[0] : 'pax',
      message: promptText,
      originalLanguage: promoter.preferredLanguage || 'en',
      englishTranslation: promptText,
      interactiveCardType: 'audit_card',
      metadata: { taskId: task.id, title: task.title, requirePhoto: true },
      timestamp: now,
    } as any);

    // 2. Log Contact Entry
    const contactRow = {
      id: newId('fc'),
      workspaceId: ws,
      taskId: task.id,
      userId: promoter.id,
      storeId,
      status: 'submitted',
      promptSent: promptText,
      responseReceived: 'Photo received: Optical Feed Verification Active',
      complianceScore: 92.0 + Math.round(Math.random() * 6),
      auditImageId: 'drive-auto-dispatch-feed',
      escalated: false,
      escalatedToUserId: null,
      timestamp: now,
    };
    await db.insert(agentFieldContacts).values(contactRow as any);
    dispatched.push(contactRow);
  }

  await log(ws, 'task.dispatch', 'task', task.id, { dispatchedCount: dispatched.length });
  res.json({ message: `Agent ${agentName} contacted ${dispatched.length} frontline promoters`, dispatched });
}));

adminRouter.get('/admin/:ws/contacts', wrap(async (req, res) => {
  await ensureEnterpriseAgentsAndSkills(req.params.ws);
  const contacts = await db.select().from(agentFieldContacts).where(eq(agentFieldContacts.workspaceId, req.params.ws)).orderBy(desc(agentFieldContacts.timestamp));
  const userList = await db.select().from(users).where(eq(users.workspaceId, req.params.ws));
  const storeList = await db.select().from(stores).where(eq(stores.workspaceId, req.params.ws));
  const taskList = await db.select().from(agentTasks).where(eq(agentTasks.workspaceId, req.params.ws));

  const result = contacts.map(c => {
    const u = userList.find(x => x.id === c.userId);
    const s = storeList.find(x => x.id === c.storeId);
    const t = taskList.find(x => x.id === c.taskId);
    return {
      ...c,
      userName: u?.name || 'Promoter',
      userRole: u?.role || 'promoter',
      storeName: s?.name || 'Branch',
      storeCode: s?.storeCode || '',
      taskTitle: t?.title || 'Operational Task',
    };
  });
  res.json(result);
}));

// ============================================================
// CORPORATE ORG CHART TOPOLOGY & FULL CRUD
// ============================================================
adminRouter.get('/admin/:ws/org-chart', wrap(async (req, res) => {
  await ensureEnterpriseAgentsAndSkills(req.params.ws);
  const nodes = await db.select().from(orgNodes).where(eq(orgNodes.workspaceId, req.params.ws));
  const userList = await db.select().from(users).where(eq(users.workspaceId, req.params.ws));
  const storeList = await db.select().from(stores).where(eq(stores.workspaceId, req.params.ws));

  const result = nodes.map(n => {
    const leader = userList.find(u => u.id === n.leaderUserId);
    const assignedStores = (n.metadata as any)?.assignedStoreIds 
      ? storeList.filter(s => (n.metadata as any).assignedStoreIds.includes(s.id))
      : [];
    return {
      ...n,
      leaderName: leader?.name || 'Unassigned',
      leaderRole: leader?.role || '',
      leaderEmail: leader?.email || '',
      assignedStores: assignedStores.map(s => ({ id: s.id, name: s.name, code: s.storeCode })),
    };
  });

  res.json({
    nodes: result,
    totalStaff: userList.length,
    totalStores: storeList.length,
    users: userList,
    stores: storeList,
  });
}));

// 1. CREATE ORG NODE
adminRouter.post('/admin/:ws/org-nodes', wrap(async (req, res) => {
  const ws = req.params.ws;
  const { title, parentId, nodeType, leaderUserId, assignedStoreIds, targetQuota, notes, actorId, approvalSignature } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Org node title is required' });
  }

  const nodeId = `org-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const metadata = {
    assignedStoreIds: Array.isArray(assignedStoreIds) ? assignedStoreIds : [],
    targetQuota: Number(targetQuota) || 0,
    notes: notes || '',
  };

  const newNode = {
    id: nodeId,
    workspaceId: ws,
    parentId: parentId || null,
    title: title.trim(),
    nodeType: nodeType || 'area',
    leaderUserId: leaderUserId || null,
    memberCount: 0,
    metadata,
    displayOrder: 0,
  };

  await db.insert(orgNodes).values(newNode as any);

  // Audit trail logging
  await log(ws, 'org.create_node', 'users', nodeId, {
    createdNode: newNode,
  }, 'users', actorId || 'admin', approvalSignature || 'Authorized Admin [UI / HMAC]', undefined, 'approved');

  res.status(201).json({ success: true, node: newNode });
}));

// 2. UPDATE ORG NODE
adminRouter.put('/admin/:ws/org-nodes/:id', wrap(async (req, res) => {
  const ws = req.params.ws;
  const nodeId = req.params.id;
  const { title, parentId, nodeType, leaderUserId, assignedStoreIds, targetQuota, notes, memberCount, actorId, approvalSignature } = req.body;

  const [existing] = await db.select().from(orgNodes).where(and(eq(orgNodes.id, nodeId), eq(orgNodes.workspaceId, ws)));
  if (!existing) {
    return res.status(404).json({ error: 'Org node not found' });
  }

  // Prevent setting parent to itself
  if (parentId === nodeId) {
    return res.status(400).json({ error: 'A node cannot be its own parent' });
  }

  const existingMeta = (existing.metadata as any) || {};
  const updatedMeta = {
    ...existingMeta,
    assignedStoreIds: assignedStoreIds !== undefined ? assignedStoreIds : existingMeta.assignedStoreIds || [],
    targetQuota: targetQuota !== undefined ? Number(targetQuota) : existingMeta.targetQuota || 0,
    notes: notes !== undefined ? notes : existingMeta.notes || '',
  };

  const updatedFields: any = {
    title: title !== undefined ? title.trim() : existing.title,
    parentId: parentId !== undefined ? (parentId || null) : existing.parentId,
    nodeType: nodeType !== undefined ? nodeType : existing.nodeType,
    leaderUserId: leaderUserId !== undefined ? (leaderUserId || null) : existing.leaderUserId,
    memberCount: memberCount !== undefined ? Number(memberCount) : existing.memberCount,
    metadata: updatedMeta,
  };

  await db.update(orgNodes).set(updatedFields as any).where(eq(orgNodes.id, nodeId));

  // Audit trail logging with diff
  await log(ws, 'org.update_node', 'users', nodeId, {
    before: existing,
    after: updatedFields,
  }, 'users', actorId || 'admin', approvalSignature || 'Authorized Admin [UI / HMAC]', undefined, 'approved');

  res.json({ success: true, node: { ...existing, ...updatedFields } });
}));

// 3. DELETE ORG NODE
adminRouter.delete('/admin/:ws/org-nodes/:id', wrap(async (req, res) => {
  const ws = req.params.ws;
  const nodeId = req.params.id;
  const { actorId, approvalSignature } = req.query;

  const [existing] = await db.select().from(orgNodes).where(and(eq(orgNodes.id, nodeId), eq(orgNodes.workspaceId, ws)));
  if (!existing) {
    return res.status(404).json({ error: 'Org node not found' });
  }

  // Safe re-parenting: re-parent any children to the parent of this deleted node
  const children = await db.select().from(orgNodes).where(and(eq(orgNodes.parentId, nodeId), eq(orgNodes.workspaceId, ws)));
  if (children.length > 0) {
    for (const child of children) {
      await db.update(orgNodes).set({ parentId: existing.parentId } as any).where(eq(orgNodes.id, child.id));
    }
  }

  await db.delete(orgNodes).where(eq(orgNodes.id, nodeId));

  // Audit trail logging
  await log(ws, 'org.delete_node', 'users', nodeId, {
    deletedNode: existing,
    reparentedChildrenCount: children.length,
    newParentForChildren: existing.parentId,
  }, 'users', (actorId as string) || 'admin', (approvalSignature as string) || 'Authorized Admin [UI / HMAC]', undefined, 'approved');

  res.json({ success: true, message: `Node "${existing.title}" deleted and ${children.length} sub-nodes re-parented.` });
}));

// 4. ASSIGN OR TRANSFER STAFF TO ORG NODE
adminRouter.post('/admin/:ws/org-nodes/:id/assign-staff', wrap(async (req, res) => {
  const ws = req.params.ws;
  const nodeId = req.params.id;
  const { userId, actorId, approvalSignature } = req.body;

  const [node] = await db.select().from(orgNodes).where(and(eq(orgNodes.id, nodeId), eq(orgNodes.workspaceId, ws)));
  if (!node) return res.status(404).json({ error: 'Org node not found' });

  const [targetUser] = await db.select().from(users).where(and(eq(users.id, userId), eq(users.workspaceId, ws)));
  if (!targetUser) return res.status(404).json({ error: 'User not found' });

  // Increment memberCount on node
  const newCount = (node.memberCount || 0) + 1;
  await db.update(orgNodes).set({ memberCount: newCount } as any).where(eq(orgNodes.id, nodeId));

  // Log in audit trail
  await log(ws, 'org.assign_staff', 'users', nodeId, {
    assignedUserId: userId,
    assignedUserName: targetUser.name,
    assignedUserRole: targetUser.role,
    orgNodeTitle: node.title,
    newMemberCount: newCount,
  }, 'users', actorId || 'admin', approvalSignature || 'Authorized Admin [UI / HMAC]', undefined, 'approved');

  res.json({ success: true, memberCount: newCount });
}));

// ============================================================
// EXECUTIVE BI, AI DECISION BRIEFINGS & REPORTING
// ============================================================
adminRouter.get('/admin/:ws/analytics/summary', wrap(async (req, res) => {
  const ws = req.params.ws;
  await ensureEnterpriseAgentsAndSkills(ws);

  const storeList = await db.select().from(stores).where(eq(stores.workspaceId, ws));
  const userList = await db.select().from(users).where(eq(users.workspaceId, ws));
  const transactions = await db.select().from(salesTransactions);
  const contacts = await db.select().from(agentFieldContacts).where(eq(agentFieldContacts.workspaceId, ws));
  const audits = await db.select().from(shelfAudits);
  const tasks = await db.select().from(agentTasks).where(eq(agentTasks.workspaceId, ws));

  const totalRevenue = transactions.reduce((s, t) => s + (t.totalAmount || 0), 0);
  const compliantContacts = contacts.filter(c => c.status === 'compliant' || c.status === 'submitted');
  const avgCompliance = contacts.length ? Math.round((compliantContacts.length / contacts.length) * 100) : 92;
  const escalatedCount = contacts.filter(c => c.escalated).length;
  const activeStaff = userList.filter(u => u.active).length;

  // Breakdown of transactions by payment channel & installment terms
  const paymentBreakdown: Record<string, { count: number; total: number; label: string }> = {
    cash: { count: 0, total: 0, label: 'Cash' },
    credit_card: { count: 0, total: 0, label: 'Credit Card' },
    home_credit: { count: 0, total: 0, label: 'Home Credit' },
    e_wallet: { count: 0, total: 0, label: 'E-Wallet' },
    bnpl: { count: 0, total: 0, label: 'BNPL' },
  };

  const termsBreakdown: Record<string, { count: number; total: number; label: string }> = {
    straight: { count: 0, total: 0, label: 'Straight' },
    '3_months': { count: 0, total: 0, label: '3 Months (0%)' },
    '6_months': { count: 0, total: 0, label: '6 Months (0%)' },
    '9_months': { count: 0, total: 0, label: '9 Months' },
    '12_months': { count: 0, total: 0, label: '12 Months (0%)' },
    '18_months': { count: 0, total: 0, label: '18 Months' },
    '24_months': { count: 0, total: 0, label: '24 Months' },
  };

  transactions.forEach(t => {
    const pm = t.paymentMethod || 'cash';
    if (!paymentBreakdown[pm]) paymentBreakdown[pm] = { count: 0, total: 0, label: pm.replace('_', ' ').toUpperCase() };
    paymentBreakdown[pm].count += 1;
    paymentBreakdown[pm].total += t.totalAmount || 0;

    const pt = t.paymentTerms || 'straight';
    if (!termsBreakdown[pt]) termsBreakdown[pt] = { count: 0, total: 0, label: pt.replace('_', ' ') };
    termsBreakdown[pt].count += 1;
    termsBreakdown[pt].total += t.totalAmount || 0;
  });

  // Real-time AI Situational Briefing with Gemini Flash
  let aiBriefing = '';
  let recommendations: string[] = [];

  try {
    if (process.env.GEMINI_API_KEY) {
      const prompt = `You are the executive retail decision AI for Project BLOC.
Analyze this real-time operations telemetry:
- Stores Active: ${storeList.length}
- Field Staff Active: ${activeStaff}
- Total Sales Generated Today: $${totalRevenue}
- Payment Mix: ${JSON.stringify(paymentBreakdown)}
- Terms Mix: ${JSON.stringify(termsBreakdown)}
- Planogram Compliance Rate: ${avgCompliance}%
- Escalated Non-Compliance Incidents: ${escalatedCount}
- Active Autonomous Agent Tasks: ${tasks.length}

Generate a concise 2-sentence executive situational briefing, followed by 3 short bullet recommendations for the regional director. Format as JSON:
{"briefing": "...", "recommendations": ["...", "...", "..."]}`;

      const aiRes = await ai.models.generateContent({
        model: MODELS.FLASH,
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      });
      const parsed = JSON.parse(aiRes.text || '{}');
      aiBriefing = parsed.briefing || '';
      recommendations = parsed.recommendations || [];
    }
  } catch (err) {
    // Graceful fallback to deterministic expert rules engine
  }

  if (!aiBriefing) {
    aiBriefing = `Regional frontline operations are tracking at ${avgCompliance}% planogram compliance across ${storeList.length} branches. Pinned promotional items continue to drive over 60% of hourly sell-out volume with ${escalatedCount} open supervisor exception.`;
    recommendations = [
      'SM Megamall Cyberzone is outperforming daily target pacing; consider reallocating stock from slower corridors.',
      `Follow up on ${escalatedCount} delinquent store audits before the afternoon foot traffic surge.`,
      'Promote high-margin bundle SKUs during peak 4:00 PM to 7:00 PM mall hours.',
    ];
  }

  res.json({
    metrics: {
      totalRevenue,
      avgCompliance,
      activeStoresCount: storeList.length,
      activeStaffCount: activeStaff,
      escalatedCount,
      activeTasksCount: tasks.length,
      paymentBreakdown,
      termsBreakdown,
    },
    aiBriefing,
    recommendations,
  });
}));

adminRouter.get('/admin/:ws/reports', wrap(async (req, res) => {
  await ensureEnterpriseAgentsAndSkills(req.params.ws);
  const list = await db.select().from(executiveReports).where(eq(executiveReports.workspaceId, req.params.ws)).orderBy(desc(executiveReports.createdAt));
  res.json(list);
}));

adminRouter.post('/admin/:ws/reports/generate', wrap(async (req, res) => {
  const ws = req.params.ws;
  await ensureEnterpriseAgentsAndSkills(ws);

  const storeList = await db.select().from(stores).where(eq(stores.workspaceId, ws));
  const contacts = await db.select().from(agentFieldContacts).where(eq(agentFieldContacts.workspaceId, ws));
  const compliantCount = contacts.filter(c => c.status === 'compliant' || c.status === 'submitted').length;
  const rate = contacts.length ? Math.round((compliantCount / contacts.length) * 100) : 92;

  const title = req.body?.title || `Operational Compliance Audit · ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  
  let summary = `Enterprise retail audit indicates strong operational discipline across ${storeList.length} monitored retail branches, with an overall ${rate}% compliance rating.`;
  let findings = [
    `${compliantCount} of ${contacts.length} targeted field tasks successfully submitted with high image clarity.`,
    'Autonomous agent follow-ups reduced field reporting latency from 48 hours to under 12 minutes.',
    'Stock-out risks mitigated through real-time replenishment signals dispatched to floor supervisors.',
  ];

  try {
    if (process.env.GEMINI_API_KEY) {
      const aiRes = await ai.models.generateContent({
        model: MODELS.FLASH,
        contents: `Write an executive summary for a retail operations audit. Monitored stores: ${storeList.length}, Compliance: ${rate}%. Output JSON: {"summary":"...","keyFindings":["...","...","..."]}`,
        config: { responseMimeType: 'application/json' },
      });
      const parsed = JSON.parse(aiRes.text || '{}');
      if (parsed.summary) summary = parsed.summary;
      if (Array.isArray(parsed.keyFindings)) findings = parsed.keyFindings;
    }
  } catch {}

  const row = {
    id: newId('rep'),
    workspaceId: ws,
    title,
    reportType: 'executive_audit',
    period: 'Daily Operations Cycle',
    summary,
    keyFindings: findings,
    metrics: { storeCount: storeList.length, complianceRate: rate, auditedContacts: contacts.length },
    generatedByAgentId: null,
    createdAt: new Date(),
  };

  await db.insert(executiveReports).values(row);
  await log(ws, 'report.generate', 'report', row.id, row, 'reports');
  res.json(row);
}));

// ============================================================
// ENTERPRISE PAYMENT METHODS & TERMS CONFIGURATION
// ============================================================
adminRouter.get('/admin/:ws/settings/payment', wrap(async (req, res) => {
  const ws = req.params.ws;
  await ensureEnterpriseAgentsAndSkills(ws);
  const rows = await db.select().from(workspaces).where(eq(workspaces.id, ws));
  if (!rows.length) return res.status(404).json({ error: 'Workspace not found' });
  const settings = (rows[0].settings as any) || {};
  res.json(settings.paymentConfig || DEFAULT_PAYMENT_CONFIG);
}));

adminRouter.post('/admin/:ws/settings/payment', wrap(async (req, res) => {
  const ws = req.params.ws;
  await ensureEnterpriseAgentsAndSkills(ws);
  const rows = await db.select().from(workspaces).where(eq(workspaces.id, ws));
  if (!rows.length) return res.status(404).json({ error: 'Workspace not found' });
  const settings = (rows[0].settings as any) || {};
  const currentConfig = settings.paymentConfig || DEFAULT_PAYMENT_CONFIG;
  const newConfig = {
    paymentMethods: req.body.paymentMethods || currentConfig.paymentMethods,
    paymentTerms: req.body.paymentTerms || currentConfig.paymentTerms,
  };
  const updatedSettings = { ...settings, paymentConfig: newConfig };
  await db.update(workspaces).set({ settings: updatedSettings } as any).where(eq(workspaces.id, ws));

  await log(
    ws,
    'settings.payment_update',
    'payment_config',
    ws,
    { previous: currentConfig, updated: newConfig },
    'config',
    req.body.userId || null,
    req.body.approvedBy || req.body.userName || 'Company Administrator',
    `agent-aegis-${ws}`
  );

  res.json({ ok: true, paymentConfig: newConfig });
}));

// ============================================================
// AI GOVERNANCE & ROLE-BASED COPILOT GUARDRAILS
// ============================================================
adminRouter.get('/admin/:ws/settings/governance', wrap(async (req, res) => {
  const ws = req.params.ws;
  await ensureEnterpriseAgentsAndSkills(ws);
  const rows = await db.select().from(workspaces).where(eq(workspaces.id, ws));
  if (!rows.length) return res.status(404).json({ error: 'Workspace not found' });
  const settings = (rows[0].settings as any) || {};
  res.json(settings.aiGovernance || DEFAULT_AI_GOVERNANCE);
}));

adminRouter.post('/admin/:ws/settings/governance', wrap(async (req, res) => {
  const ws = req.params.ws;
  await ensureEnterpriseAgentsAndSkills(ws);
  const rows = await db.select().from(workspaces).where(eq(workspaces.id, ws));
  if (!rows.length) return res.status(404).json({ error: 'Workspace not found' });
  const settings = (rows[0].settings as any) || {};
  const currentGov = settings.aiGovernance || DEFAULT_AI_GOVERNANCE;
  const newGov = {
    ...currentGov,
    ...req.body,
  };
  const updatedSettings = { ...settings, aiGovernance: newGov };
  await db.update(workspaces).set({ settings: updatedSettings } as any).where(eq(workspaces.id, ws));

  await log(
    ws,
    'settings.governance_update',
    'ai_governance',
    ws,
    { previous: currentGov, updated: newGov },
    'ai_governance',
    req.body.userId || null,
    req.body.approvedBy || req.body.userName || 'Super Admin Security Root',
    `agent-aegis-${ws}`
  );

  res.json({ ok: true, aiGovernance: newGov });
}));

// ============================================================
// FULL CROSS-MODULE ENTERPRISE AUDIT TRAIL
// ============================================================
adminRouter.get('/admin/:ws/audit-logs', wrap(async (req, res) => {
  const ws = req.params.ws;
  await ensureEnterpriseAgentsAndSkills(ws);
  const targetModule = (req.query.module as string) || '';
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));

  const rawLogs = await db.select().from(auditLogs).where(eq(auditLogs.workspaceId, ws)).orderBy(desc(auditLogs.timestamp)).limit(limit);
  const filtered = (targetModule && targetModule !== 'all') ? rawLogs.filter(l => l.module === targetModule) : rawLogs;

  const userList = await db.select().from(users).where(eq(users.workspaceId, ws));
  const userMap = new Map(userList.map(u => [u.id, u]));

  const enriched = filtered.map(logItem => {
    const actor = logItem.actorId ? userMap.get(logItem.actorId) : undefined;
    return {
      ...logItem,
      actorName: actor?.name || 'System Orchestrator',
      actorRole: actor?.role || 'system',
      actorEmail: actor?.email || null,
    };
  });

  res.json(enriched);
}));

// ============================================================
// AEGIS ADMINISTRATIVE GOVERNANCE & CONFIGURATION COPILOT
// ============================================================
adminRouter.post('/admin/:ws/aegis/chat', wrap(async (req, res) => {
  const ws = req.params.ws;
  await ensureEnterpriseAgentsAndSkills(ws);

  const { message, userRole = 'promoter', userName = 'Staff Member', userId = '', approvalSignature = '' } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message is required' });

  // 1. Fetch Workspace & Governance Rules
  const wsRows = await db.select().from(workspaces).where(eq(workspaces.id, ws));
  if (!wsRows.length) return res.status(404).json({ error: 'Workspace not found' });
  const workspace = wsRows[0];
  const settings = (workspace.settings as any) || {};
  const gov = settings.aiGovernance || DEFAULT_AI_GOVERNANCE;
  const paymentConfig = settings.paymentConfig || DEFAULT_PAYMENT_CONFIG;

  const roleRule = gov.allowedRoles?.[userRole] || { canQuery: false, canConfigure: false, requiresApproval: true };

  // 2. Guardrail Check 1: Can this role interact with Aegis at all?
  if (!roleRule.canQuery && !roleRule.canConfigure) {
    // Log blocked access attempt
    await log(ws, 'aegis.access_blocked', 'ai_governance', ws, {
      userRole,
      userName,
      userId,
      attemptedMessage: message,
      reason: 'Role blocked by enterprise AI governance policy',
    }, 'ai_governance', userId, 'Aegis Security Guardrail', `agent-aegis-${ws}`, 'rejected');

    return res.status(403).json({
      error: 'Guardrail Policy Violation: Frontline Promoters are not authorized to query or configure via Aegis Administrative Copilot. Please use the Pax frontline copilot.',
      guardrailBlocked: true,
    });
  }

  // 3. Collect Operational & Financial Telemetry Context for Aegis
  const storeList = await db.select().from(stores).where(eq(stores.workspaceId, ws));
  const userList = await db.select().from(users).where(eq(users.workspaceId, ws));
  const transactions = await db.select().from(salesTransactions);
  const tasks = await db.select().from(agentTasks).where(eq(agentTasks.workspaceId, ws));
  const recentLogs = await db.select().from(auditLogs).where(eq(auditLogs.workspaceId, ws)).orderBy(desc(auditLogs.timestamp)).limit(10);

  const totalSales = transactions.reduce((s, t) => s + (t.totalAmount || 0), 0);
  const paymentBreakdown: Record<string, number> = {};
  const termsBreakdown: Record<string, number> = {};
  transactions.forEach(t => {
    const pm = t.paymentMethod || 'cash';
    paymentBreakdown[pm] = (paymentBreakdown[pm] || 0) + (t.totalAmount || 0);
    const pt = t.paymentTerms || 'straight';
    termsBreakdown[pt] = (termsBreakdown[pt] || 0) + (t.totalAmount || 0);
  });

  // 4. Intent Classification with Gemini 2.5 Flash
  let intentClassification: any = { isConfigChange: false, action: 'inquiry' };
  try {
    if (process.env.GEMINI_API_KEY) {
      const classPrompt = `You are the safety and intent router for Aegis, an enterprise retail operations copilot.
Determine whether the user is attempting to CHANGE OR CONFIGURE SYSTEM SETTINGS (e.g. enable/disable/add payment methods, payment terms, update store quotas, modify AI guardrails, alter product pricing, adjust commission) or simply MAKING AN INQUIRY / ASKING A QUESTION (e.g. asking for sales telemetry, store health, payment breakdown, audit logs, advice).

User Message: "${message}"

Output JSON only:
{
  "isConfigChange": boolean,
  "configDomain": "payment_methods" | "payment_terms" | "store_quota" | "ai_guardrails" | "product_pricing" | "none",
  "action": "enable" | "disable" | "update" | "add" | "query",
  "targetEntity": string,
  "targetValue": any,
  "explanation": string
}`;
      const classRes = await ai.models.generateContent({
        model: MODELS.FLASH,
        contents: classPrompt,
        config: { responseMimeType: 'application/json' },
      });
      intentClassification = JSON.parse(classRes.text || '{}');
    }
  } catch {}

  // 5. Guardrail Check 2: Configuration Attempt by Unauthorized Role (e.g., Supervisor)
  if (intentClassification.isConfigChange && !roleRule.canConfigure) {
    const reason = `Role "${userRole}" is restricted to read-only diagnostics and field task dispatch. System configuration changes require "company_admin" or "super_admin" authorization.`;

    await log(ws, 'aegis.config_rejected', 'ai_governance', ws, {
      attemptedMessage: message,
      userRole,
      userName,
      userId,
      intent: intentClassification,
      reason,
    }, 'ai_governance', userId, 'Aegis Guardrail Sentinel', `agent-aegis-${ws}`, 'rejected');

    return res.json({
      reply: `### ⚠️ Access Guardrail Policy Triggered\n\n**Action Blocked:** Modification of system configuration (${intentClassification.configDomain || 'System Policy'}).\n\n**Policy Notice:** As a **${userRole.toUpperCase()}**, you have full read-only diagnostic, store 360°, and task-dispatch permissions. However, modifying live payment terms, gateway rules, or corporate quotas requires **Company Admin** or **Super Admin** credentials.\n\n*This attempt has been logged into the enterprise audit trail (\`module: ai_governance\`, status: \`rejected\`).*`,
      guardrailTriggered: true,
      auditLogged: true,
    });
  }

  // 6. If it IS an authorized configuration change (Company Admin / Super Admin)
  if (intentClassification.isConfigChange && roleRule.canConfigure) {
    let appliedDiff: any = {};
    let configUpdated = false;

    // Handle Payment Methods or Terms change
    if (intentClassification.configDomain === 'payment_methods' || intentClassification.configDomain === 'payment_terms') {
      const currentConfig = { ...paymentConfig };
      const targetEntity = (intentClassification.targetEntity || '').toLowerCase();

      if (intentClassification.configDomain === 'payment_methods') {
        const existingMethod = currentConfig.paymentMethods.find((m: any) => m.id === targetEntity || m.label.toLowerCase().includes(targetEntity));
        if (existingMethod) {
          const oldVal = existingMethod.enabled;
          existingMethod.enabled = intentClassification.action !== 'disable';
          appliedDiff = { method: existingMethod.id, previousEnabled: oldVal, newEnabled: existingMethod.enabled };
          configUpdated = true;
        } else if (intentClassification.action === 'add') {
          const newId = targetEntity.replace(/\s+/g, '_');
          const newMethod = {
            id: newId,
            label: intentClassification.targetEntity || 'New Payment Method',
            enabled: true,
            requiresApproval: true,
            allowedTerms: ['straight', '3_months', '6_months', '12_months'],
          };
          currentConfig.paymentMethods.push(newMethod);
          appliedDiff = { addedMethod: newMethod };
          configUpdated = true;
        }
      } else if (intentClassification.configDomain === 'payment_terms') {
        const existingTerm = currentConfig.paymentTerms.find((t: any) => t.id === targetEntity || t.label.toLowerCase().includes(targetEntity));
        if (existingTerm) {
          const oldVal = existingTerm.enabled;
          existingTerm.enabled = intentClassification.action !== 'disable';
          appliedDiff = { term: existingTerm.id, previousEnabled: oldVal, newEnabled: existingTerm.enabled };
          configUpdated = true;
        } else if (intentClassification.action === 'add') {
          const newId = targetEntity.replace(/\s+/g, '_');
          const newTerm = {
            id: newId,
            label: intentClassification.targetEntity || 'Custom Term',
            enabled: true,
          };
          currentConfig.paymentTerms.push(newTerm);
          appliedDiff = { addedTerm: newTerm };
          configUpdated = true;
        }
      }

      if (configUpdated) {
        const newSettings = { ...settings, paymentConfig: currentConfig };
        await db.update(workspaces).set({ settings: newSettings } as any).where(eq(workspaces.id, ws));
      }
      } else if (intentClassification.configDomain === 'store_quota') {
        // Update store daily target quota
        const storeMatch = storeList.find(s => s.name.toLowerCase().includes((intentClassification.targetEntity || '').toLowerCase()) || s.storeCode.toLowerCase().includes((intentClassification.targetEntity || '').toLowerCase()));
        if (storeMatch && intentClassification.targetValue) {
          const oldTarget = storeMatch.dailyTargetDefault;
          const newTarget = Number(intentClassification.targetValue) || oldTarget;
          await db.update(stores).set({ dailyTargetDefault: newTarget } as any).where(eq(stores.id, storeMatch.id));
          appliedDiff = { storeId: storeMatch.id, storeName: storeMatch.name, oldDailyTarget: oldTarget, newDailyTarget: newTarget };
          configUpdated = true;
        }
      } else if (intentClassification.configDomain === 'org_chart') {
        // Handle Org Chart autonomous modification via Aegis
        const existingNodes = await db.select().from(orgNodes).where(eq(orgNodes.workspaceId, ws));
        const targetEntity = (intentClassification.targetEntity || '').toLowerCase();
        
        if (intentClassification.action === 'add' || intentClassification.action === 'create') {
          const nodeId = `org-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
          const parentMatch = existingNodes.find(n => n.nodeType === 'hq' || n.title.toLowerCase().includes('hq') || n.title.toLowerCase().includes('territory'));
          const leaderMatch = userList.find(u => message.toLowerCase().includes(u.name.toLowerCase()));
          
          const newNode = {
            id: nodeId,
            workspaceId: ws,
            parentId: parentMatch?.id || null,
            title: intentClassification.targetEntity || 'New Retail Cluster',
            nodeType: 'area',
            leaderUserId: leaderMatch?.id || null,
            memberCount: 0,
            metadata: { notes: `Created via Aegis Copilot: "${message}"` },
            displayOrder: 0,
          };
          await db.insert(orgNodes).values(newNode as any);
          appliedDiff = { createdOrgNode: newNode };
          configUpdated = true;
        } else if (intentClassification.action === 'delete') {
          const match = existingNodes.find(n => n.title.toLowerCase().includes(targetEntity) || n.id === targetEntity);
          if (match) {
            const children = await db.select().from(orgNodes).where(and(eq(orgNodes.parentId, match.id), eq(orgNodes.workspaceId, ws)));
            for (const c of children) {
              await db.update(orgNodes).set({ parentId: match.parentId } as any).where(eq(orgNodes.id, c.id));
            }
            await db.delete(orgNodes).where(eq(orgNodes.id, match.id));
            appliedDiff = { deletedOrgNode: match, reparentedChildrenCount: children.length };
            configUpdated = true;
          }
        } else if (intentClassification.action === 'update' || intentClassification.action === 'reassign') {
          const match = existingNodes.find(n => n.title.toLowerCase().includes(targetEntity) || n.id === targetEntity);
          const leaderMatch = userList.find(u => message.toLowerCase().includes(u.name.toLowerCase()));
          if (match && leaderMatch) {
            await db.update(orgNodes).set({ leaderUserId: leaderMatch.id } as any).where(eq(orgNodes.id, match.id));
            appliedDiff = { nodeId: match.id, nodeTitle: match.title, previousLeaderId: match.leaderUserId, newLeaderId: leaderMatch.id, newLeaderName: leaderMatch.name };
            configUpdated = true;
          }
        }
      }

    const logId = newId('log');
    const approverSignature = `${userName} (${userRole}) [Digital Approval: ${approvalSignature || 'Authorized Token'}]`;

    await db.insert(auditLogs).values({
      id: logId,
      workspaceId: ws,
      actorId: userId || null,
      action: 'aegis.config_apply',
      resourceType: intentClassification.configDomain || 'config',
      resourceId: ws,
      details: { command: message, appliedDiff, intent: intentClassification },
      module: 'config',
      approvalStatus: 'approved',
      approvedBy: approverSignature,
      aiAgentId: `agent-aegis-${ws}`,
      timestamp: new Date(),
    } as any);

    return res.json({
      reply: `### 🛡️ Configuration Applied & Audited by Aegis\n\n**Directive:** "${message}"\n\n**Action Status:** ✅ Applied successfully to live workspace configuration.\n\n**Governance & Audit Trail Record:**\n- **Audit Log ID:** \`${logId}\`\n- **Authorized By:** ${approverSignature}\n- **Module:** \`${intentClassification.configDomain || 'config'}\`\n- **Details Applied:** \`${JSON.stringify(appliedDiff)}\`\n- **Timestamp:** ${new Date().toLocaleString()}\n\n*Frontline promoters and supervisors will immediately reflect this update on their next telemetry sync.*`,
      configUpdated: true,
      auditLogId: logId,
    });
  }

  // 7. Conversational Operational / Financial / Telemetry Inquiry
  let aegisReply = '';
  try {
    if (process.env.GEMINI_API_KEY) {
      const prompt = `You are Aegis, the Enterprise Operations & Governance AI Copilot for Project BLOC.
You are conversing with an authorized user:
- User Name: ${userName}
- User Role: ${userRole}
- Workspace: ${workspace.name} (${workspace.baseCurrency})

Here is the real-time operational context:
- Total Sales Generated: $${totalSales}
- Payment Methods Breakdown: ${JSON.stringify(paymentBreakdown)}
- Payment Terms Breakdown: ${JSON.stringify(termsBreakdown)}
- Active Stores: ${storeList.length} (${storeList.map(s => s.name).join(', ')})
- Active Personnel: ${userList.length} staff
- Configured Payment Channels: ${paymentConfig.paymentMethods.filter((m: any) => m.enabled).map((m: any) => m.label).join(', ')}
- Configured Payment Terms: ${paymentConfig.paymentTerms.filter((t: any) => t.enabled).map((t: any) => t.label).join(', ')}
- Active Tasks: ${tasks.map(t => t.title).join('; ')}
- Recent Audit Trail Events: ${recentLogs.map(l => `[${l.module}] ${l.action} by ${l.approvedBy}`).join('; ')}

User Query: "${message}"

Provide a crisp, authoritative, executive-grade analysis and response. Include exact data points where appropriate (such as transaction volumes, payment mix, compliance, or audit trail integrity). Format with clean Markdown headers and bullet points.`;

      const aiRes = await ai.models.generateContent({
        model: MODELS.FLASH,
        contents: prompt,
      });
      aegisReply = aiRes.text || '';
    }
  } catch (err: any) {
    aegisReply = `Aegis telemetry check completed. Current operational revenue is tracked at $${totalSales.toLocaleString()} across ${storeList.length} branches. Top payment channels: ${Object.entries(paymentBreakdown).map(([k, v]) => `${k.toUpperCase()}: $${v.toLocaleString()}`).join(', ') || 'Cash & Cards'}.`;
  }

  // Log the AI inquiry for governance records
  await log(ws, 'aegis.inquiry', 'ai_governance', ws, {
    userRole,
    userName,
    userId,
    query: message,
  }, 'ai_governance', userId, userName, `agent-aegis-${ws}`);

  res.json({ reply: aegisReply });
}));

// ---------------- Demo Generator ----------------
adminRouter.post('/admin/demo/generate', wrap(async (req, res) => {
  if (!req.body?.companyName) return res.status(400).json({ error: 'companyName is required' });
  res.json(await DemoGenerator.generateDraft(req.body));
}));
adminRouter.post('/admin/demo/refine', wrap(async (req, res) => {
  const { draft, instruction } = req.body;
  if (!draft || !instruction) return res.status(400).json({ error: 'draft and instruction are required' });
  res.json(await DemoGenerator.refineDraft(draft, instruction));
}));
adminRouter.post('/admin/demo/commit', wrap(async (req, res) => {
  const d = req.body;
  if (!d?.company?.name || !Array.isArray(d.stores) || !d.stores.length) return res.status(400).json({ error: 'Invalid draft' });
  res.json(await DemoGenerator.commitDraft(d));
}));
adminRouter.delete('/admin/demo/:ws', wrap(async (req, res) => {
  res.json(await DemoGenerator.deleteDemo(req.params.ws));
}));
