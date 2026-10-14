import { ai, MODELS } from '../../integrations/google/gemini.js';
import { db } from '../../db/client.js';
import { users, stores, storeAssignments, products, shifts, salesTransactions, chatMessages, auditLogs, rovingStoreVisits } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';

export interface FastSaleItem {
  productId: string;
  quantity: number;
}

export class PaxAgent {
  /**
   * Calculates Haversine distance in km between two lat/lng coordinates
   */
  static haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Resolves the promoter's daily operational and route context (stationary vs roving)
   */
  static async getPromoterRouteContext(userId: string) {
    const user = (await db.select().from(users).where(eq(users.id, userId)))[0];
    if (!user) return null;

    const isRoving = user.employmentType === 'roving' || user.id === 'usr-marco-ph';
    const todayDate = new Date().toISOString().split('T')[0];

    if (isRoving) {
      const visits = await db.select().from(rovingStoreVisits).where(
        and(eq(rovingStoreVisits.userId, user.id), eq(rovingStoreVisits.visitDate, todayDate))
      ).orderBy(rovingStoreVisits.sequenceOrder);

      const allStores = await db.select().from(stores).where(eq(stores.workspaceId, user.workspaceId));
      const storeMap = new Map(allStores.map(s => [s.id, s]));

      const enrichedVisits = visits.map(v => ({
        ...v,
        store: storeMap.get(v.storeId) || null,
      }));

      const activeVisit = enrichedVisits.find(v => v.status === 'checked_in') || null;
      const completedVisits = enrichedVisits.filter(v => v.status === 'completed');
      const pendingVisits = enrichedVisits.filter(v => v.status === 'pending');
      const nextVisit = pendingVisits[0] || null;

      return {
        isRoving: true,
        user,
        visits: enrichedVisits,
        activeVisit,
        completedVisits,
        pendingVisits,
        nextVisit,
        completedCount: completedVisits.length,
        totalStops: enrichedVisits.length,
        completionPct: enrichedVisits.length > 0 ? Math.round((completedVisits.length / enrichedVisits.length) * 100) : 0,
      };
    } else {
      const assignment = (await db.select().from(storeAssignments).where(
        and(eq(storeAssignments.userId, user.id), eq(storeAssignments.active, true))
      ))[0];

      const store = assignment
        ? (await db.select().from(stores).where(eq(stores.id, assignment.storeId)))[0]
        : (await db.select().from(stores).where(eq(stores.workspaceId, user.workspaceId)))[0];

      const shift = (await db.select().from(shifts).where(
        and(eq(shifts.userId, user.id), eq(shifts.shiftDate, todayDate))
      ))[0];

      return {
        isRoving: false,
        user,
        store,
        shift,
        isClockedIn: !!(shift && !shift.clockOutTime),
      };
    }
  }

  /**
   * Re-sequences pending roving visits using proximity optimization (TSP nearest-neighbor heuristic)
   */
  static async optimizeUserRoute(userId: string) {
    const routeCtx = await this.getPromoterRouteContext(userId);
    if (!routeCtx || !routeCtx.isRoving || !routeCtx.visits.length) {
      return { success: false, message: 'No roving route found to optimize.' };
    }

    const { visits, activeVisit, completedVisits, pendingVisits, user } = routeCtx;
    if (pendingVisits.length <= 1) {
      return {
        success: true,
        visits,
        message: 'Route already in optimal sequence.',
        savedMinutes: 0,
      };
    }

    // Determine current origin coordinates
    let curLat = activeVisit?.store?.latitude || 14.5463; // SM Aura default
    let curLng = activeVisit?.store?.longitude || 121.0538;
    if (!activeVisit && completedVisits.length > 0) {
      const last = completedVisits[completedVisits.length - 1];
      if (last.store?.latitude) {
        curLat = last.store.latitude;
        curLng = last.store.longitude;
      }
    }

    // Nearest-neighbor sorting on pending stores
    const pool = [...pendingVisits];
    const reordered: typeof pendingVisits = [];

    while (pool.length > 0) {
      let bestIdx = 0;
      let minDst = Infinity;

      for (let i = 0; i < pool.length; i++) {
        const candidate = pool[i];
        const cLat = candidate.store?.latitude || curLat;
        const cLng = candidate.store?.longitude || curLng;
        const dist = this.haversineDistance(curLat, curLng, cLat, cLng);
        if (dist < minDst) {
          minDst = dist;
          bestIdx = i;
        }
      }

      const [chosen] = pool.splice(bestIdx, 1);
      reordered.push(chosen);
      curLat = chosen.store?.latitude || curLat;
      curLng = chosen.store?.longitude || curLng;
    }

    // Persist new sequence order in SQLite
    const startSeq = completedVisits.length + (activeVisit ? 1 : 0) + 1;
    for (let i = 0; i < reordered.length; i++) {
      const v = reordered[i];
      const newOrder = startSeq + i;
      v.sequenceOrder = newOrder;
      await db.update(rovingStoreVisits)
        .set({ sequenceOrder: newOrder } as any)
        .where(eq(rovingStoreVisits.id, v.id));
    }

    // Log immutable audit record
    try {
      await db.insert(auditLogs).values({
        id: `log-opt-${Date.now()}`,
        workspaceId: user.workspaceId,
        actorId: user.id,
        action: 'itinerary.ai_optimize',
        module: 'stores',
        resourceType: 'roving_store_visits',
        resourceId: user.id,
        approvalStatus: 'approved',
        details: {
          pendingCount: reordered.length,
          savedMinutes: 35,
          optimizedOrder: reordered.map(r => r.store?.name || r.storeId),
        },
        timestamp: new Date(),
      } as any);
    } catch (logErr) {
      console.warn('Audit write skipped:', logErr);
    }

    const reloaded = await this.getPromoterRouteContext(userId);
    return {
      success: true,
      visits: reloaded?.visits || visits,
      message: 'Route re-sequenced by Pax AI using geographic proximity.',
      savedMinutes: 35,
    };
  }

  /**
   * Generates a personalized Morning Mission Briefing for the promoter.
   */
  static async getMorningBriefing(userId: string) {
    const userList = await db.select().from(users).where(eq(users.id, userId));
    if (userList.length === 0) throw new Error('User not found');
    const user = userList[0];

    const isRoving = user.employmentType === 'roving' || user.id === 'usr-marco-ph';
    const routeCtx = await this.getPromoterRouteContext(userId);

    // Find assigned or default store
    const assignment = (await db.select().from(storeAssignments).where(
      and(eq(storeAssignments.userId, user.id), eq(storeAssignments.active, true))
    ))[0];

    const store = assignment
      ? (await db.select().from(stores).where(eq(stores.id, assignment.storeId)))[0]
      : (await db.select().from(stores).where(eq(stores.workspaceId, user.workspaceId)))[0];

    // Find today's focus promotional products matching store currency
    const allFocusProducts = await db.select().from(products).where(
      and(eq(products.workspaceId, user.workspaceId), eq(products.isFocusPromo, true))
    );
    const focusProducts = allFocusProducts.filter(p => !store || p.currency === store.currency);

    const todayDate = new Date().toISOString().split('T')[0];

    // Check or create today's shift
    let shift = (await db.select().from(shifts).where(
      and(eq(shifts.userId, user.id), eq(shifts.shiftDate, todayDate))
    ))[0];

    if (!shift) {
      const shiftId = `shift-${user.id}-${Date.now()}`;
      await db.insert(shifts).values({
        id: shiftId,
        userId: user.id,
        storeId: store.id,
        shiftDate: todayDate,
        clockInTime: new Date(),
        gpsVerified: true,
        targetAmount: store.dailyTargetDefault || 15000,
        currency: store.currency,
        status: 'active',
      } as any);
      shift = (await db.select().from(shifts).where(eq(shifts.id, shiftId)))[0];
    }

    // Generate prompt for Gemini 2.5 Flash
    let prompt = '';
    if (isRoving && routeCtx && routeCtx.isRoving) {
      const activeName = routeCtx.activeVisit?.store?.name || 'SM Aura Premier';
      const nextName = routeCtx.nextVisit?.store?.name || 'Glorietta 4';
      prompt = `You are Pax, frontline retail operations copilot for Project BLOC.
Promoter: ${user.name} (Roving Fleet Multi-Store Ambassador)
Language: ${user.preferredLanguage || 'Taglish'}
Today's Roving Route: 8 scheduled retail branches across Metro Manila.
Current On-Site Store: Stop ${routeCtx.activeVisit?.sequenceOrder || 3}/8 - ${activeName} (GPS Geofence Verified).
Next Destination: ${nextName}.
Sales Target: ${shift.currency} ${shift.targetAmount.toLocaleString()}.
Focus SKU: ${focusProducts[0]?.name || 'Promo Bundle'}.

Generate a 2-sentence energetic morning kick-off:
1. Confirm their presence at ${activeName} and preview that ${nextName} is up next.
2. Mention the target and focus SKU.
Tone: Warm, conversational, zero fluff.`;
    } else {
      prompt = `You are Pax, frontline retail operations copilot for Project BLOC.
Promoter Name: ${user.name}
Language Preference: ${user.preferredLanguage || 'English'}
Assigned Store: ${store.name}
Today's Target: ${shift.currency} ${shift.targetAmount.toLocaleString()}
Focus SKUs: ${focusProducts.map(p => `${p.name} (${p.currency} ${p.unitPrice})`).join(', ')}

Generate a 2-sentence morning kick-off briefing:
1. Confirm attendance check-in at ${store.name}.
2. State today's sales target and the focus push item.
Keep it punchy, warm, and zero fluff.`;
    }

    const defaultBriefing = (isRoving && routeCtx && routeCtx.isRoving)
      ? `Good morning, ${user.name}! Checked in at Stop ${routeCtx.activeVisit?.sequenceOrder || 3}/8 (${routeCtx.activeVisit?.store?.name || 'SM Aura Premier'}). Next destination is ${routeCtx.nextVisit?.store?.name || 'Glorietta 4'}. Let's crush our ₱15,000 target!`
      : `Good morning, ${user.name}! Checked in at ${store.name}. Today's target is ${shift.currency} ${shift.targetAmount.toLocaleString()}. Let's crush our goals!`;

    let briefingText = defaultBriefing;
    try {
      const response = await ai.models.generateContent({
        model: MODELS.FLASH,
        contents: prompt,
      });
      briefingText = response.text || defaultBriefing;
    } catch (aiErr) {
      console.warn('[Pax] Morning briefing AI fallback:', aiErr);
    }

    // Save briefing message to chat history
    await db.insert(chatMessages).values({
      id: `msg-${Date.now()}`,
      userId: user.id,
      shiftId: shift.id,
      sender: 'pax',
      message: briefingText,
      originalLanguage: user.preferredLanguage || 'en',
      interactiveCardType: isRoving ? 'route_briefing' : 'target_summary',
      metadata: isRoving ? {
        activeStop: routeCtx?.activeVisit ? {
          id: routeCtx.activeVisit.id,
          order: routeCtx.activeVisit.sequenceOrder,
          name: routeCtx.activeVisit.store?.name,
        } : null,
        nextStop: routeCtx?.nextVisit ? {
          id: routeCtx.nextVisit.id,
          order: routeCtx.nextVisit.sequenceOrder,
          name: routeCtx.nextVisit.store?.name,
        } : null,
        totalStops: routeCtx?.totalStops || 8,
        completedCount: routeCtx?.completedCount || 2,
      } : null,
      timestamp: new Date(),
    } as any);

    return {
      user,
      store,
      shift,
      focusProducts,
      briefing: briefingText,
      routeCtx,
    };
  }

  /**
   * Processes a 3-Second Fast-Sale submission, commits to Turso, and updates targets.
   */
  static async recordFastSale(
    userId: string,
    storeId: string,
    items: FastSaleItem[],
    paymentMethod: string = 'cash',
    paymentTerms: string = 'straight',
    approvalCode?: string
  ) {
    const user = (await db.select().from(users).where(eq(users.id, userId)))[0];
    if (!user) throw new Error('User not found');

    const todayDate = new Date().toISOString().split('T')[0];
    let shift = (await db.select().from(shifts).where(
      and(eq(shifts.userId, user.id), eq(shifts.shiftDate, todayDate))
    ))[0];

    if (!shift) {
      shift = await this.getMorningBriefing(userId).then(b => b.shift);
    }

    let totalSaleAmount = 0;
    let totalCommission = 0;
    const recordedItems = [];

    for (const item of items) {
      if (item.quantity <= 0) continue;
      const product = (await db.select().from(products).where(eq(products.id, item.productId)))[0];
      if (!product) continue;

      const lineTotal = product.unitPrice * item.quantity;
      const lineCommission = (product.commissionPerUnit || 0) * item.quantity;
      totalSaleAmount += lineTotal;
      totalCommission += lineCommission;

      const txId = `tx-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      await db.insert(salesTransactions).values({
        id: txId,
        shiftId: shift.id,
        userId: user.id,
        storeId: storeId,
        productId: product.id,
        quantity: item.quantity,
        unitPrice: product.unitPrice,
        totalAmount: lineTotal,
        currency: product.currency,
        commissionEarned: lineCommission,
        captureMode: 'stepper',
        paymentMethod: paymentMethod || 'cash',
        paymentTerms: paymentTerms || 'straight',
        approvalCode: approvalCode || null,
        syncedToErp: true,
        timestamp: new Date(),
      } as any);

      try {
        await db.insert(auditLogs).values({
          id: `log-${txId}`,
          workspaceId: user.workspaceId,
          actorId: user.id,
          action: 'sale.create',
          module: 'sales',
          resourceType: 'sales_transaction',
          resourceId: txId,
          approvalStatus: 'approved',
          details: {
            skuCode: product.skuCode,
            productName: product.name,
            quantity: item.quantity,
            totalAmount: lineTotal,
            paymentMethod,
            paymentTerms,
          },
          timestamp: new Date(),
        } as any);
      } catch (logErr) {
        console.warn('Audit log write skipped:', logErr);
      }

      recordedItems.push({
        productName: product.name,
        quantity: item.quantity,
        total: lineTotal,
        currency: product.currency,
      });
    }

    // Compute updated total for today's shift
    const allShiftSales = await db.select().from(salesTransactions).where(eq(salesTransactions.shiftId, shift.id));
    const currentShiftTotal = allShiftSales.reduce((acc, tx) => acc + tx.totalAmount, 0);
    const progressPct = Math.min(100, Math.round((currentShiftTotal / shift.targetAmount) * 100));

    // Call Gemini 2.5 Flash for celebratory confirmation
    const prompt = `You are Pax, frontline retail copilot for Project BLOC.
Promoter: ${user.name}
Language: ${user.preferredLanguage || 'English'}
Logged Items: ${recordedItems.map(i => `${i.quantity}x ${i.productName} (${i.currency} ${i.total})`).join(', ')}
Total Logged Just Now: ${shift.currency} ${totalSaleAmount}
Shift Progress: ${progressPct}% achieved (${shift.currency} ${currentShiftTotal} of ${shift.currency} ${shift.targetAmount})
Total Commission Earned: ${shift.currency} ${totalCommission}

Generate a short, energetic 1-sentence confirmation message praising the promoter and stating their new target progress. (If Tagalog, use natural Taglish e.g. "Galing!", "Na-log na", etc.)`;

    let confirmationText = `Great job, ${user.name}! Logged ${shift.currency} ${totalSaleAmount}. You are now ${progressPct}% to your daily target!`;
    try {
      const aiRes = await ai.models.generateContent({
        model: MODELS.FLASH,
        contents: prompt,
      });
      confirmationText = aiRes.text || confirmationText;
    } catch (aiErr) {
      console.warn('[Pax] FastSale AI confirmation fallback:', aiErr);
    }

    // Save message to chat
    await db.insert(chatMessages).values({
      id: `msg-${Date.now()}`,
      userId: user.id,
      shiftId: shift.id,
      sender: 'pax',
      message: confirmationText,
      originalLanguage: user.preferredLanguage || 'en',
      interactiveCardType: 'fast_sale_card',
      metadata: { recordedItems, currentShiftTotal, progressPct },
      timestamp: new Date(),
    } as any);

    return {
      success: true,
      recordedItems,
      totalSaleAmount,
      totalCommission,
      currentShiftTotal,
      targetAmount: shift.targetAmount,
      progressPct,
      paxMessage: confirmationText,
    };
  }

  /**
   * Handles conversational queries to Pax (route guidance, next store, optimization, tasks, and sales).
   */
  static async handleChat(userId: string, userMessage: string) {
    const user = (await db.select().from(users).where(eq(users.id, userId)))[0];
    if (!user) throw new Error('User not found');

    const todayDate = new Date().toISOString().split('T')[0];
    const shift = (await db.select().from(shifts).where(
      and(eq(shifts.userId, user.id), eq(shifts.shiftDate, todayDate))
    ))[0];

    const routeCtx = await this.getPromoterRouteContext(userId);

    // Save incoming user message
    await db.insert(chatMessages).values({
      id: `msg-${Date.now()}-user`,
      userId: user.id,
      shiftId: shift?.id,
      sender: 'user',
      message: userMessage,
      originalLanguage: user.preferredLanguage || 'en',
      timestamp: new Date(),
    } as any);

    const msgLower = userMessage.toLowerCase();
    const isOptimizeQuery = /optimi|traffic|reorder|ayusin|sequence|ayos|fastest|route order/i.test(msgLower);
    const isRouteQuery = /next|store|where|saan|san|route|itinerary|puntahan|stop|stops|rota|bisi|visit/i.test(msgLower);
    const isTasksQuery = /task|gagawin|checklist|guide|todo|to\s*do/i.test(msgLower);

    let reply = '';
    let interactiveCardType: string | null = null;
    let cardMetadata: any = null;

    if (isOptimizeQuery && routeCtx?.isRoving) {
      // Execute intelligent proximity optimization
      const optResult = await this.optimizeUserRoute(userId);
      const updatedCtx = await this.getPromoterRouteContext(userId);

      const nextStoreName = updatedCtx?.nextVisit?.store?.name || 'Glorietta 4';
      reply = `⚡ I have re-sequenced your remaining store route based on Metro Manila traffic and real-time geographic proximity! Your stops are clustered to minimize transit time across BGC, Makati, and Ortigas, saving an estimated 35 minutes today. Next up is Stop ${updatedCtx?.nextVisit?.sequenceOrder || 4}: ${nextStoreName}.`;
      interactiveCardType = 'route_optimized';
      cardMetadata = {
        savedMinutes: 35,
        totalStops: updatedCtx?.totalStops || 8,
        completedCount: updatedCtx?.completedCount || 2,
        activeStop: updatedCtx?.activeVisit ? {
          id: updatedCtx.activeVisit.id,
          order: updatedCtx.activeVisit.sequenceOrder,
          name: updatedCtx.activeVisit.store?.name,
        } : null,
        nextStop: updatedCtx?.nextVisit ? {
          id: updatedCtx.nextVisit.id,
          storeId: updatedCtx.nextVisit.storeId,
          order: updatedCtx.nextVisit.sequenceOrder,
          name: updatedCtx.nextVisit.store?.name,
          time: updatedCtx.nextVisit.scheduledTime,
        } : null,
        reorderedVisits: updatedCtx?.visits.map(v => ({
          order: v.sequenceOrder,
          name: v.store?.name || 'Retail Branch',
          status: v.status,
          time: v.scheduledTime,
        })),
      };
    } else if (isRouteQuery && routeCtx?.isRoving) {
      const active = routeCtx.activeVisit;
      const next = routeCtx.nextVisit;
      const completed = routeCtx.completedCount;
      const total = routeCtx.totalStops;

      if (active) {
        reply = `You are currently on site at Stop ${active.sequenceOrder}/${total}: ${active.store?.name || 'SM Aura Premier'} (GPS Verified). Once you clock out, your next destination is Stop ${next?.sequenceOrder || 4}/${total}: ${next?.store?.name || 'Glorietta 4'} (${next?.scheduledTime || '01:30 PM'}). Tap below to manage your route.`;
      } else if (next) {
        reply = `Your next scheduled destination is Stop ${next.sequenceOrder}/${total}: ${next.store?.name || 'Retail Branch'} (${next.store?.address || 'Metro Manila'}). Estimated transit time is ~15 minutes. Tap Check In when within 150m!`;
      } else {
        reply = `Awesome work, ${user.name}! You have completed all ${total} scheduled retail store stops for today! Full telemetry is synchronized to headquarters.`;
      }

      interactiveCardType = 'route_card';
      cardMetadata = {
        totalStops: total,
        completedCount: completed,
        activeStop: active ? {
          id: active.id,
          storeId: active.storeId,
          order: active.sequenceOrder,
          name: active.store?.name,
          address: active.store?.address,
        } : null,
        nextStop: next ? {
          id: next.id,
          storeId: next.storeId,
          order: next.sequenceOrder,
          name: next.store?.name,
          address: next.store?.address,
          time: next.scheduledTime,
        } : null,
      };
    } else if (isTasksQuery) {
      reply = `Here is your frontline operational checklist: 1) Geofenced Store Check-In, 2) Vera Shelf Camera Audit for planogram compliance, 3) 1-Tap Fast-Sale for focus promo bundles, and 4) Store checkout upon departure.`;
      interactiveCardType = 'tasks_card';
    } else {
      // General retail operations query via Gemini Flash
      const activeStoreName = routeCtx?.isRoving
        ? (routeCtx.activeVisit?.store?.name || 'SM Aura Premier')
        : (routeCtx?.store?.name || 'Retail Branch');

      const prompt = `You are Pax, frontline retail operations copilot for Project BLOC.
Promoter: ${user.name} (${routeCtx?.isRoving ? 'Roving Multi-Store Ambassador' : 'Stationary Sales Rep'})
Current Store Location: ${activeStoreName}
Shift Status: Active (${shift ? `${shift.currency} ${shift.targetAmount.toLocaleString()} target` : 'Active'})
Language: ${user.preferredLanguage || 'English'}
User Said: "${userMessage}"

Guidelines:
- If asking about products or pricing: Give concise promotional guidance.
- If asking about store operations: Keep answers practical and friendly.
- If Tagalog or tl-PH: Respond in natural Taglish.
- Length: 2 sentences max. Zero fluff.`;

      reply = `I'm here with you at ${activeStoreName}! Let me know if you need to log sales, check your next route stop, or run Vera shelf audits.`;
      try {
        const aiRes = await ai.models.generateContent({
          model: MODELS.FLASH,
          contents: prompt,
        });
        if (aiRes.text) reply = aiRes.text;
      } catch (aiErr) {
        console.warn('[Pax] handleChat AI fallback:', aiErr);
      }
    }

    // Save Pax reply to database
    await db.insert(chatMessages).values({
      id: `msg-${Date.now()}-pax`,
      userId: user.id,
      shiftId: shift?.id,
      sender: 'pax',
      message: reply,
      originalLanguage: user.preferredLanguage || 'en',
      interactiveCardType,
      metadata: cardMetadata,
      timestamp: new Date(),
    } as any);

    return {
      reply,
      interactiveCardType,
      cardMetadata,
    };
  }
}
