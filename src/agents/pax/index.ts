import { ai, MODELS } from '../../integrations/google/gemini.js';
import { db } from '../../db/client.js';
import { users, stores, storeAssignments, products, shifts, salesTransactions, chatMessages } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';

export interface FastSaleItem {
  productId: string;
  quantity: number;
}

export class PaxAgent {
  /**
   * Generates a personalized Morning Mission Briefing for the promoter.
   */
  static async getMorningBriefing(userId: string) {
    const userList = await db.select().from(users).where(eq(users.id, userId));
    if (userList.length === 0) throw new Error('User not found');
    const user = userList[0];

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
      });
      shift = (await db.select().from(shifts).where(eq(shifts.id, shiftId)))[0];
    }

    // Generate prompt for Gemini 2.5 Flash
    const prompt = `You are Pax, an encouraging and highly operational frontline retail copilot for Project BLOC.
Promoter Name: ${user.name}
Language Preference: ${user.preferredLanguage || 'English'} (e.g. if 'tl-PH' or Tagalog, respond in warm, natural Taglish; if 'en-SG', natural English/Singlish).
Assigned Store: ${store.name}
Today's Target: ${shift.currency} ${shift.targetAmount.toLocaleString()}
Focus SKUs: ${focusProducts.map(p => `${p.name} (${p.currency} ${p.unitPrice})`).join(', ')}

Generate a 2-sentence morning kick-off briefing:
1. Confirm attendance check-in at ${store.name}.
2. State today's sales target and the focus push item.
Keep it punchy, warm, and zero fluff.`;

    const response = await ai.models.generateContent({
      model: MODELS.FLASH,
      contents: prompt,
    });

    const briefingText = response.text || `Good morning, ${user.name}! Checked in at ${store.name}. Today's target is ${shift.currency} ${shift.targetAmount.toLocaleString()}. Let's crush our goals!`;

    // Save briefing message to chat history
    await db.insert(chatMessages).values({
      id: `msg-${Date.now()}`,
      userId: user.id,
      shiftId: shift.id,
      sender: 'pax',
      message: briefingText,
      originalLanguage: user.preferredLanguage || 'en',
      timestamp: new Date(),
    });

    return {
      user,
      store,
      shift,
      focusProducts,
      briefing: briefingText,
    };
  }

  /**
   * Processes a 3-Second Fast-Sale submission, commits to Turso, and updates targets.
   */
  static async recordFastSale(userId: string, storeId: string, items: FastSaleItem[]) {
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
        syncedToErp: true,
        timestamp: new Date(),
      });

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

    const aiRes = await ai.models.generateContent({
      model: MODELS.FLASH,
      contents: prompt,
    });

    const confirmationText = aiRes.text || `Great job, ${user.name}! Logged ${shift.currency} ${totalSaleAmount}. You are now ${progressPct}% to your daily target!`;

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
    });

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
   * Handles interactive conversational queries to Pax (questions about promos, stock, tips).
   */
  static async handleChat(userId: string, userMessage: string) {
    const user = (await db.select().from(users).where(eq(users.id, userId)))[0];
    if (!user) throw new Error('User not found');

    const todayDate = new Date().toISOString().split('T')[0];
    const shift = (await db.select().from(shifts).where(
      and(eq(shifts.userId, user.id), eq(shifts.shiftDate, todayDate))
    ))[0];

    // Save incoming user message
    await db.insert(chatMessages).values({
      id: `msg-${Date.now()}-user`,
      userId: user.id,
      shiftId: shift?.id,
      sender: 'user',
      message: userMessage,
      originalLanguage: user.preferredLanguage || 'en',
      timestamp: new Date(),
    });

    const prompt = `You are Pax, an autonomous AI retail operations copilot for Project BLOC.
Promoter: ${user.name}
Preferred Language: ${user.preferredLanguage || 'English'}
User Said: "${userMessage}"

Respond helpfully, succinctly (1-3 sentences max) in the promoter's preferred language/dialect (e.g. natural Taglish if Tagalog). If they ask about targets or promotions, guide them to push the focus items or use the 1-Tap Fast-Sale button.`;

    const aiRes = await ai.models.generateContent({
      model: MODELS.FLASH,
      contents: prompt,
    });

    const reply = aiRes.text || 'Got it! I am right here with you. Let me know if you need to log sales or check store targets.';

    // Save reply
    await db.insert(chatMessages).values({
      id: `msg-${Date.now()}-pax`,
      userId: user.id,
      shiftId: shift?.id,
      sender: 'pax',
      message: reply,
      originalLanguage: user.preferredLanguage || 'en',
      timestamp: new Date(),
    });

    return { reply };
  }
}
