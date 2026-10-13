import { Type } from '@google/genai';
import { ai, MODELS } from '../../integrations/google/gemini.js';
import { db } from '../../db/client.js';
import {
  workspaces, users, stores, storeAssignments, products, promotions,
  shifts, salesTransactions, shelfAudits, chatMessages, auditLogs,
} from '../../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import { COUNTRY_CURRENCY, COUNTRY_LANGUAGE, COUNTRY_TZ } from '../../lib/currency.js';

export interface DemoRequest {
  companyName: string;
  industry: string;
  markets: string[];          // ['PH','SG']
  storeCount: number;
  promoterCount: number;
  mustIncludeProducts?: string;
  chains?: string;
}

export interface DemoDraft {
  company: { name: string; tagline: string; baseCurrency: string };
  products: Array<{ name: string; category: string; country: string; unitPrice: number; commissionPerUnit: number; isFocusPromo: boolean }>;
  stores: Array<{ name: string; chain: string; country: string; city: string; address: string; latitude: number; longitude: number; dailyTarget: number }>;
  promoters: Array<{ name: string; country: string; storeIndex: number }>;
  supervisor: { name: string; country: string };
  promotions: Array<{ title: string; description: string; discountPct: number; bonusCommission: number }>;
  source: 'gemini' | 'template';
}

const draftSchema = {
  type: Type.OBJECT,
  properties: {
    company: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        tagline: { type: Type.STRING },
        baseCurrency: { type: Type.STRING },
      },
      required: ['name', 'tagline', 'baseCurrency'],
    },
    products: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          category: { type: Type.STRING },
          country: { type: Type.STRING },
          unitPrice: { type: Type.NUMBER },
          commissionPerUnit: { type: Type.NUMBER },
          isFocusPromo: { type: Type.BOOLEAN },
        },
        required: ['name', 'category', 'country', 'unitPrice', 'commissionPerUnit', 'isFocusPromo'],
      },
    },
    stores: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          chain: { type: Type.STRING },
          country: { type: Type.STRING },
          city: { type: Type.STRING },
          address: { type: Type.STRING },
          latitude: { type: Type.NUMBER },
          longitude: { type: Type.NUMBER },
          dailyTarget: { type: Type.NUMBER },
        },
        required: ['name', 'chain', 'country', 'city', 'address', 'latitude', 'longitude', 'dailyTarget'],
      },
    },
    promoters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          country: { type: Type.STRING },
          storeIndex: { type: Type.INTEGER },
        },
        required: ['name', 'country', 'storeIndex'],
      },
    },
    supervisor: {
      type: Type.OBJECT,
      properties: { name: { type: Type.STRING }, country: { type: Type.STRING } },
      required: ['name', 'country'],
    },
    promotions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          discountPct: { type: Type.NUMBER },
          bonusCommission: { type: Type.NUMBER },
        },
        required: ['title', 'description', 'discountPct', 'bonusCommission'],
      },
    },
  },
  required: ['company', 'products', 'stores', 'promoters', 'supervisor', 'promotions'],
};

const clampInt = (n: any, lo: number, hi: number, d: number) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
};

function normalizeRequest(r: DemoRequest): DemoRequest {
  const markets = (r.markets || []).map(m => m.toUpperCase()).filter(m => COUNTRY_CURRENCY[m]);
  return {
    companyName: (r.companyName || '').trim() || 'Demo Company',
    industry: (r.industry || 'FMCG').trim(),
    markets: markets.length ? markets : ['PH'],
    storeCount: clampInt(r.storeCount, 1, 12, 4),
    promoterCount: clampInt(r.promoterCount, 1, 20, 4),
    mustIncludeProducts: r.mustIncludeProducts?.trim() || '',
    chains: r.chains?.trim() || '',
  };
}

export class DemoGenerator {
  /** Ask Gemini for a realistic draft; fall back to a deterministic template so a live demo never fails. */
  static async generateDraft(input: DemoRequest): Promise<DemoDraft> {
    const req = normalizeRequest(input);
    const prompt = `You are generating realistic seed data for a live sales demo of a retail field-force app (promoters/merchandisers in stores).
Client company: ${req.companyName}
Industry: ${req.industry}
Markets (ISO country codes): ${req.markets.join(', ')}
Currencies per market: ${req.markets.map(m => `${m}=${COUNTRY_CURRENCY[m]}`).join(', ')}
Number of stores: exactly ${req.storeCount}
Number of promoters: exactly ${req.promoterCount}
${req.mustIncludeProducts ? `Products the client explicitly wants included: ${req.mustIncludeProducts}` : ''}
${req.chains ? `Retail chains to use: ${req.chains}` : 'Pick the real retail chains/malls this company typically sells through in each market.'}

Rules:
- Products: 8-14 real or highly plausible products this company actually sells. Repeat each product once per market with "country" set and "unitPrice" in that market's local currency at realistic shelf price. commissionPerUnit is a small promoter incentive (2-6% of price). Mark 2-3 hero items per market isFocusPromo=true.
- Stores: real branch names (e.g. "SM Megamall", "Robinsons Galleria"), real city, plausible address, accurate latitude/longitude. Spread across the markets. dailyTarget in local currency, realistic for one promoter-day of sell-out for this category.
- Promoters: realistic local full names for their country; storeIndex is the 0-based index into stores (same country). Every store should get at least one promoter if counts allow.
- Supervisor: one regional supervisor with a realistic name.
- Promotions: 1-2 current trade promotions typical for this brand.
- company.baseCurrency: currency of the first market.`;

    try {
      const res = await ai.models.generateContent({
        model: MODELS.FLASH,
        contents: prompt,
        config: { responseMimeType: 'application/json', responseSchema: draftSchema as any, temperature: 0.7 },
      });
      const parsed = JSON.parse(res.text || '{}');
      return DemoGenerator.sanitize(parsed, req, 'gemini');
    } catch (err: any) {
      console.warn('Demo generator: Gemini failed, using template.', err?.message);
      return DemoGenerator.templateDraft(req);
    }
  }

  /** Refine an existing draft based on natural language user feedback */
  static async refineDraft(currentDraft: DemoDraft, instruction: string): Promise<DemoDraft> {
    const prompt = `You are an AI retail operations assistant refining an existing retail workspace draft for an enterprise demo.
Current draft JSON:
${JSON.stringify(currentDraft, null, 2)}

User's requested modification or enhancement:
"${instruction}"

Rules:
1. Apply the user's modifications (e.g. add, remove, or edit products, change pricing/currencies, add or change stores, adjust quotas, edit promoter personas or language, modify promotional campaigns).
2. Keep all existing valid data unless the user explicitly requested changes.
3. Ensure all local currencies and realistic pricing align with the countries.
4. Return the full complete updated draft JSON adhering to the exact schema.`;

    try {
      const res = await ai.models.generateContent({
        model: MODELS.FLASH,
        contents: prompt,
        config: { responseMimeType: 'application/json', responseSchema: draftSchema as any, temperature: 0.4 },
      });
      const parsed = JSON.parse(res.text || '{}');
      if (parsed.company && Array.isArray(parsed.stores) && Array.isArray(parsed.products)) {
        return { ...parsed, source: 'gemini' };
      }
      return currentDraft;
    } catch (err: any) {
      console.warn('Demo refiner: Gemini failed:', err?.message);
      return currentDraft;
    }
  }

  /** Validate & repair model output so it can be inserted safely. */
  static sanitize(d: any, req: DemoRequest, source: 'gemini' | 'template'): DemoDraft {
    const okCountry = (c: any) => (typeof c === 'string' && req.markets.includes(c.toUpperCase())) ? c.toUpperCase() : req.markets[0];
    const storesOut = (Array.isArray(d.stores) ? d.stores : []).slice(0, req.storeCount).map((s: any) => ({
      name: String(s.name || 'Flagship Store').slice(0, 80),
      chain: String(s.chain || 'Retail Partner').slice(0, 60),
      country: okCountry(s.country),
      city: String(s.city || '').slice(0, 60),
      address: String(s.address || '').slice(0, 160),
      latitude: Number(s.latitude) || 0,
      longitude: Number(s.longitude) || 0,
      dailyTarget: Math.max(1, Number(s.dailyTarget) || 1000),
    }));
    if (storesOut.length === 0) return DemoGenerator.templateDraft(req);

    const productsOut = (Array.isArray(d.products) ? d.products : []).slice(0, 40).map((p: any) => ({
      name: String(p.name || 'Product').slice(0, 80),
      category: String(p.category || req.industry).slice(0, 40),
      country: okCountry(p.country),
      unitPrice: Math.max(0.01, Number(p.unitPrice) || 1),
      commissionPerUnit: Math.max(0, Number(p.commissionPerUnit) || 0),
      isFocusPromo: !!p.isFocusPromo,
    }));
    // Every market that has a store needs at least one focus product.
    for (const m of new Set(storesOut.map((s: any) => s.country))) {
      const inMarket = productsOut.filter((p: any) => p.country === m);
      if (inMarket.length && !inMarket.some((p: any) => p.isFocusPromo)) inMarket.slice(0, 2).forEach((p: any) => (p.isFocusPromo = true));
    }

    const promotersOut = (Array.isArray(d.promoters) ? d.promoters : []).slice(0, req.promoterCount).map((p: any, i: number) => {
      let idx = clampInt(p.storeIndex, 0, storesOut.length - 1, i % storesOut.length);
      return { name: String(p.name || `Promoter ${i + 1}`).slice(0, 60), country: storesOut[idx].country, storeIndex: idx };
    });
    if (promotersOut.length === 0) promotersOut.push({ name: 'Demo Promoter', country: storesOut[0].country, storeIndex: 0 });

    return {
      company: {
        name: String(d.company?.name || req.companyName),
        tagline: String(d.company?.tagline || ''),
        baseCurrency: COUNTRY_CURRENCY[req.markets[0]],
      },
      products: productsOut.length ? productsOut : DemoGenerator.templateDraft(req).products,
      stores: storesOut,
      promoters: promotersOut,
      supervisor: { name: String(d.supervisor?.name || 'Regional Supervisor'), country: okCountry(d.supervisor?.country) },
      promotions: (Array.isArray(d.promotions) ? d.promotions : []).slice(0, 3).map((p: any) => ({
        title: String(p.title || 'Trade Promo'), description: String(p.description || ''),
        discountPct: Math.max(0, Math.min(90, Number(p.discountPct) || 0)), bonusCommission: Math.max(0, Number(p.bonusCommission) || 0),
      })),
      source,
    };
  }

  static templateDraft(req: DemoRequest): DemoDraft {
    const CITY: Record<string, [string, string, number, number][]> = {
      PH: [['SM Megamall', 'SM Supermalls', 14.5850, 121.0565], ['Robinsons Galleria', 'Robinsons', 14.5906, 121.0597], ['Ayala Malls Glorietta', 'Ayala Malls', 14.5513, 121.0249], ['SM North EDSA', 'SM Supermalls', 14.6566, 121.0293]],
      SG: [['FairPrice Xtra VivoCity', 'FairPrice', 1.2644, 103.8222], ['Cold Storage ION', 'Cold Storage', 1.3040, 103.8318], ['Giant Tampines', 'Giant', 1.3546, 103.9437]],
      MY: [['AEON Mid Valley', 'AEON', 3.1180, 101.6770], ['Lotus\'s Kepong', 'Lotus\'s', 3.2140, 101.6360]],
      TH: [['Big C Ratchadamri', 'Big C', 13.7469, 100.5394], ['Tops CentralWorld', 'Tops', 13.7466, 100.5393]],
      ID: [['Hypermart Kemang', 'Hypermart', -6.2607, 106.8130]],
      VN: [['WinMart Landmark 81', 'WinMart', 10.7950, 106.7218]],
      JP: [['AEON Makuhari', 'AEON', 35.6510, 140.0410]],
      US: [['Walmart Supercenter', 'Walmart', 40.7128, -74.0060]],
    };
    const TARGET: Record<string, number> = { PHP: 25000, SGD: 1200, MYR: 3500, THB: 28000, IDR: 12000000, VND: 20000000, JPY: 120000, USD: 900 };
    const PRICE: Record<string, number> = { PHP: 1, SGD: 0.024, MYR: 0.083, THB: 0.63, IDR: 280, VND: 440, JPY: 2.6, USD: 0.0175 };
    const NAMES: Record<string, string[]> = {
      PH: ['Liza Santos', 'Mark Dela Cruz', 'Joy Reyes', 'Paolo Garcia'], SG: ['Sarah Tan', 'Wei Ling Lim', 'Darren Ong'],
      MY: ['Nur Aisyah', 'Jason Lee'], TH: ['Ploy Srisuk', 'Narong Chai'], ID: ['Putri Wulandari'], VN: ['Nguyen Thi Lan'], JP: ['Yuki Sato'], US: ['Emily Carter'],
    };
    const baseItems = [
      ['Hero Product Bundle', 999, true], ['Classic Variant 500g', 189, true], ['Premium Edition', 1499, false],
      ['Family Value Pack', 649, false], ['Travel Size', 89, false], ['Limited Seasonal Edition', 799, true],
    ] as const;

    const storesOut: DemoDraft['stores'] = [];
    for (let i = 0; i < req.storeCount; i++) {
      const m = req.markets[i % req.markets.length];
      const list = CITY[m];
      const [name, chain, lat, lng] = list[Math.floor(i / req.markets.length) % list.length];
      storesOut.push({ name, chain, country: m, city: '', address: '', latitude: lat, longitude: lng, dailyTarget: TARGET[COUNTRY_CURRENCY[m]] });
    }
    const productsOut: DemoDraft['products'] = [];
    for (const m of req.markets) {
      const cur = COUNTRY_CURRENCY[m];
      for (const [n, php, focus] of baseItems) {
        const price = Math.round(php * PRICE[cur] * 100) / 100;
        productsOut.push({ name: `${req.companyName} ${n}`, category: req.industry, country: m, unitPrice: price, commissionPerUnit: Math.round(price * 0.04 * 100) / 100, isFocusPromo: focus });
      }
    }
    const promotersOut = Array.from({ length: req.promoterCount }, (_, i) => {
      const idx = i % storesOut.length;
      const c = storesOut[idx].country;
      const pool = NAMES[c];
      return { name: pool[Math.floor(i / storesOut.length) % pool.length], country: c, storeIndex: idx };
    });
    return {
      company: { name: req.companyName, tagline: `${req.industry} field execution`, baseCurrency: COUNTRY_CURRENCY[req.markets[0]] },
      products: productsOut, stores: storesOut, promoters: promotersOut,
      supervisor: { name: 'Regional Supervisor', country: req.markets[0] },
      promotions: [{ title: 'Weekend Bundle Push', description: 'Extra incentive on hero bundles', discountPct: 10, bonusCommission: 20 }],
      source: 'template',
    };
  }

  /** Persist a (possibly edited) draft as a new workspace + simulate 7 days of activity. */
  static async commitDraft(draft: DemoDraft) {
    const slugBase = draft.company.name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'demo';
    const tag = Date.now().toString(36).slice(-5);
    const wsId = `ws-demo-${slugBase}-${tag}`;
    const now = new Date();
    const markets = Array.from(new Set(draft.stores.map(s => s.country)));

    await db.insert(workspaces).values({
      id: wsId, slug: `${slugBase}-${tag}`, name: draft.company.name, status: 'trial',
      baseCurrency: draft.company.baseCurrency, driveFolderId: `drive-${wsId}`, sheetSyncId: `sheet-${wsId}`,
      settings: { isDemo: true, tagline: draft.company.tagline, markets, source: draft.source }, createdAt: now,
    } as any);

    const storeRows = draft.stores.map((s, i) => ({
      id: `${wsId}-st${i}`, workspaceId: wsId, storeCode: `${s.chain.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() || 'STR'}-${String(i + 1).padStart(2, '0')}-${tag}`,
      name: s.name, chain: s.chain, country: s.country, city: s.city, address: s.address,
      latitude: s.latitude, longitude: s.longitude, dailyTargetDefault: Math.round(s.dailyTarget),
      currency: COUNTRY_CURRENCY[s.country], active: true,
    }));
    await chunkInsert(stores, storeRows);

    const productRows = draft.products.map((p, i) => ({
      id: `${wsId}-p${i}`, workspaceId: wsId, skuCode: `${slugBase.slice(0, 6).toUpperCase()}-${String(i + 1).padStart(3, '0')}-${tag}`,
      barcode: `${tag}${String(880000000 + i)}`, name: p.name, category: p.category, unitPrice: p.unitPrice,
      currency: COUNTRY_CURRENCY[p.country], commissionPerUnit: p.commissionPerUnit, isFocusPromo: p.isFocusPromo, displayOrder: i, active: true,
    }));
    await chunkInsert(products, productRows);

    const supId = `${wsId}-sup`;
    const userRows: any[] = [{
      id: supId, workspaceId: wsId, name: draft.supervisor.name, email: `supervisor.${tag}@${slugBase}.demo`,
      role: 'supervisor', preferredLanguage: 'en', timezone: COUNTRY_TZ[draft.supervisor.country] || 'Asia/Singapore', active: true, createdAt: now,
    }];
    draft.promoters.forEach((p, i) => userRows.push({
      id: `${wsId}-u${i}`, workspaceId: wsId, name: p.name, email: `promoter${i + 1}.${tag}@${slugBase}.demo`,
      role: 'promoter', preferredLanguage: COUNTRY_LANGUAGE[p.country] || 'en', timezone: COUNTRY_TZ[p.country] || 'Asia/Singapore', active: true, createdAt: now,
    }));
    await chunkInsert(users, userRows);

    await chunkInsert(storeAssignments, draft.promoters.map((p, i) => ({
      id: `${wsId}-as${i}`, workspaceId: wsId, userId: `${wsId}-u${i}`, storeId: storeRows[p.storeIndex].id, active: true,
    })));

    const today = new Date();
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    if (draft.promotions.length) {
      await chunkInsert(promotions, draft.promotions.map((p, i) => ({
        id: `${wsId}-promo${i}`, workspaceId: wsId, promoCode: `PROMO-${i + 1}-${tag}`.toUpperCase(), title: p.title, description: p.description,
        discountType: 'percentage', discountValue: p.discountPct, bonusCommission: p.bonusCommission,
        startDate: fmt(new Date(today.getTime() - 7 * 864e5)), endDate: fmt(new Date(today.getTime() + 21 * 864e5)), active: true,
      })));
    }

    // ---- Simulate 7 days of shifts, sales and audits (deterministic per workspace) ----
    const rand = mulberry32(hashStr(wsId));
    const shiftRows: any[] = [], saleRows: any[] = [], auditRows: any[] = [];
    const issuesPool = ['Missing price tag on shelf 2', 'Competitor facing encroachment on eye-level shelf', 'Promo wobbler not displayed',
      'Out-of-stock: hero SKU slot empty', 'Planogram mismatch on bottom shelf', 'Facings aligned with planogram'];

    draft.promoters.forEach((p, ui) => {
      const userId = `${wsId}-u${ui}`;
      const store = storeRows[p.storeIndex];
      const catalog = productRows.filter(pr => pr.currency === store.currency);
      if (!catalog.length) return;
      for (let d = 6; d >= 0; d--) {
        const day = new Date(today.getTime() - d * 864e5);
        const dow = day.getDay();
        const isToday = d === 0;
        const shiftId = `${wsId}-sh${ui}-${d}`;
        const clockIn = new Date(day); clockIn.setHours(9, Math.floor(rand() * 20), 0, 0);
        shiftRows.push({
          id: shiftId, userId, storeId: store.id, shiftDate: fmt(day), clockInTime: clockIn,
          clockOutTime: isToday ? null : new Date(clockIn.getTime() + 9 * 36e5), gpsVerified: rand() > 0.05,
          targetAmount: store.dailyTargetDefault, currency: store.currency, status: isToday ? 'active' : 'completed',
        });
        // Weekend lift; today is partial (~ morning progress)
        const pace = (0.65 + rand() * 0.5) * (dow === 0 || dow === 6 ? 1.25 : 1) * (isToday ? 0.3 : 1);
        let goal = store.dailyTargetDefault * pace, sold = 0, n = 0;
        while (sold < goal && n < 60) {
          const pick = rand() < 0.65 ? (catalog.filter(c => c.isFocusPromo)[0] ? pickRand(catalog.filter(c => c.isFocusPromo), rand) : pickRand(catalog, rand)) : pickRand(catalog, rand);
          const qty = 1 + Math.floor(rand() * (pick.unitPrice < store.dailyTargetDefault / 20 ? 4 : 1));
          const ts = new Date(clockIn.getTime() + (0.3 + rand() * (isToday ? 2.5 : 8.5)) * 36e5);
          saleRows.push({
            id: `${wsId}-tx${ui}-${d}-${n}`, shiftId, userId, storeId: store.id, productId: pick.id, quantity: qty,
            unitPrice: pick.unitPrice, totalAmount: Math.round(pick.unitPrice * qty * 100) / 100, currency: store.currency,
            commissionEarned: Math.round((pick.commissionPerUnit || 0) * qty * 100) / 100, captureMode: rand() < 0.8 ? 'stepper' : 'barcode_cam',
            syncedToErp: true, timestamp: ts,
          });
          sold += pick.unitPrice * qty; n++;
        }
        if (d % 3 === 0) {
          const score = Math.round(78 + rand() * 20);
          const issues = [pickRand(issuesPool, rand), ...(score < 88 ? [pickRand(issuesPool, rand)] : [])];
          auditRows.push({
            id: `${wsId}-au${ui}-${d}`, shiftId, userId, storeId: store.id, driveImageId: `drive-${wsId}-${ui}-${d}`,
            complianceScore: score, shareOfShelfPct: Math.round(28 + rand() * 20), detectedIssues: Array.from(new Set(issues)),
            geminiVerdict: score >= 90 ? 'Strong planogram execution; maintain facings.' : 'Fix flagged gaps before peak hours to protect share of shelf.',
            timestamp: new Date(clockIn.getTime() + 2 * 36e5),
          });
        }
      }
    });
    await chunkInsert(shifts, shiftRows);
    await chunkInsert(salesTransactions, saleRows);
    await chunkInsert(shelfAudits, auditRows);

    await db.insert(auditLogs).values({
      id: `${wsId}-log0`, workspaceId: wsId, action: 'demo.generate', resourceType: 'workspace', resourceId: wsId,
      details: { source: draft.source, stores: storeRows.length, products: productRows.length, promoters: draft.promoters.length, sales: saleRows.length },
      timestamp: now,
    } as any);

    return {
      workspaceId: wsId,
      firstPromoterId: `${wsId}-u0`,
      counts: { stores: storeRows.length, products: productRows.length, promoters: draft.promoters.length, shifts: shiftRows.length, sales: saleRows.length, audits: auditRows.length },
    };
  }

  /** Remove a generated demo workspace and every row belonging to it. Refuses non-demo workspaces. */
  static async deleteDemo(workspaceId: string) {
    if (!workspaceId.startsWith('ws-demo-')) throw new Error('Only generated demo workspaces can be deleted');
    const userIds = (await db.select({ id: users.id }).from(users).where(eq(users.workspaceId, workspaceId))).map(u => u.id);
    if (userIds.length) {
      await db.delete(salesTransactions).where(inArray(salesTransactions.userId, userIds));
      await db.delete(shelfAudits).where(inArray(shelfAudits.userId, userIds));
      await db.delete(chatMessages).where(inArray(chatMessages.userId, userIds));
      await db.delete(shifts).where(inArray(shifts.userId, userIds));
    }
    await db.delete(storeAssignments).where(eq(storeAssignments.workspaceId, workspaceId));
    await db.delete(promotions).where(eq(promotions.workspaceId, workspaceId));
    await db.delete(products).where(eq(products.workspaceId, workspaceId));
    await db.delete(auditLogs).where(eq(auditLogs.workspaceId, workspaceId));
    await db.delete(users).where(eq(users.workspaceId, workspaceId));
    await db.delete(stores).where(eq(stores.workspaceId, workspaceId));
    await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
    return { deleted: workspaceId };
  }
}

async function chunkInsert(table: any, rows: any[], size = 40) {
  for (let i = 0; i < rows.length; i += size) {
    const slice = rows.slice(i, i + size);
    if (slice.length) await db.insert(table).values(slice);
  }
}
function hashStr(s: string) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
function mulberry32(a: number) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function pickRand<T>(arr: T[], rand: () => number): T { return arr[Math.floor(rand() * arr.length)]; }
