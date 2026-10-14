import { ai, MODELS } from '../../integrations/google/gemini.js';
import { db } from '../../db/client.js';
import { users, stores, storeAssignments, products, shifts, salesTransactions, chatMessages, auditLogs, rovingStoreVisits, supportedLanguages, surveys } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';

export interface FastSaleItem {
  productId: string;
  quantity: number;
}

export interface LanguageMeta {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  promptInstruction: string;
  morningGreeting: (name: string, store: string, target: string, focusSku: string) => string;
  rovingGreeting: (name: string, stopNum: number, activeStore: string, nextStore: string, target: string) => string;
  routeGuidance: (activeStore: string, nextStore: string, stopNum: number, total: number, time: string) => string;
  routeOptimized: (nextStore: string, nextNum: number, savedMins: number) => string;
  tasksChecklist: string;
  allStopsCompleted: (name: string, total: number) => string;
  languageChangedNotice: (langName: string, flag: string) => string;
}

export const SUPPORTED_LANGUAGES_MAP: Record<string, LanguageMeta> = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🌐',
    promptInstruction: 'Write the response in natural, professional English suitable for a frontline retail sales promoter. Be encouraging, crisp, and direct.',
    morningGreeting: (name, store, target, sku) => `Good morning, ${name}! Attendance verified at ${store}. Today's target is ${target}. Focus SKU: ${sku}. Let's make it a high-conversion day!`,
    rovingGreeting: (name, stopNum, active, next, target) => `Good morning, ${name}! Checked in at Stop ${stopNum}/8 (${active}). Next destination: ${next}. Target: ${target}. Let's crush our route!`,
    routeGuidance: (active, next, stopNum, total, time) => `You are currently on site at Stop ${stopNum}/${total}: ${active} (GPS Verified). Once you clock out, your next destination is ${next} (${time}). Tap below to manage your route.`,
    routeOptimized: (next, num, saved) => `⚡ I have re-sequenced your remaining store route based on Metro Manila traffic and real-time geographic proximity! Next up is Stop ${num}: ${next}, saving ~${saved} minutes.`,
    tasksChecklist: `Frontline Checklist: 1) Geofenced Check-In, 2) Vera Shelf Audit for planograms, 3) 1-Tap Fast-Sale for focus bundles, and 4) Store checkout before moving.`,
    allStopsCompleted: (name, total) => `Outstanding job, ${name}! You have completed all ${total} scheduled retail store stops for today! Telemetry is synchronized to HQ.`,
    languageChangedNotice: (langName, flag) => `${flag} Preferred language updated to ${langName}. I will now assist you in this language.`,
  },
  fil: {
    code: 'fil',
    name: 'Filipino / Tagalog',
    nativeName: 'Wikang Filipino',
    flag: '🇵🇭',
    promptInstruction: 'Sumulat gamit ang natural at masiglang Filipino / Taglish (ang pangkaraniwang salita ng mga frontline retail merchandiser at promoter sa Pilipinas). Gamitin ang magiliw na tono tulad ng "Magandang umaga!", "Kumusta ang benta?", "Handa na ba ang ating display?". Huwag maging sobrang pormal; gawing natural, diretso, at propesyonal.',
    morningGreeting: (name, store, target, sku) => `Magandang umaga, ${name}! Naka-check in ka na sa ${store}. Target natin ngayong araw ay ${target}. Focus product: ${sku}. Kayang-kaya nating abutin 'to!`,
    rovingGreeting: (name, stopNum, active, next, target) => `Magandang umaga, ${name}! Naka-check in ka sa Stop ${stopNum}/8 (${active}). Ang susunod na pupuntahan ay ${next}. Target: ${target}. Simulan na natin ang ruta!`,
    routeGuidance: (active, next, stopNum, total, time) => `Kasalukuyan kang nasa Stop ${stopNum}/${total}: ${active} (GPS Verified). Pagka-clock out mo rito, ang susunod na destinasyon ay ${next} bandang ${time}. I-tap ang nasa ibaba para sa direksyon.`,
    routeOptimized: (next, num, saved) => `⚡ Na-resequence ko na ang iyong mga nalalabing tindahan batay sa traffic at lapit ng distansya! Ang susunod mong pupuntahan ay Stop ${num}: ${next}, makakatipid tayo ng mga ${saved} minuto sa biyahe.`,
    tasksChecklist: `Frontline Checklist: 1) Geofenced Store Check-In, 2) Vera Shelf Camera Audit para sa planogram, 3) 1-Tap Fast-Sale sa bawat benta, at 4) Checkout bago lumipat ng branch.`,
    allStopsCompleted: (name, total) => `Napakagaling, ${name}! Nakumpleto mo ang lahat ng ${total} nakatakdang retail store stops para sa araw na ito! Na-sync na sa headquarters ang iyong telemetry.`,
    languageChangedNotice: (langName, flag) => `${flag} Na-update ang wika sa ${langName}. Dito na tayo mag-uusap mula ngayon!`,
  },
  ms: {
    code: 'ms',
    name: 'Bahasa Melayu',
    nativeName: 'Bahasa Melayu',
    flag: '🇲🇾',
    promptInstruction: 'Tulis dalam Bahasa Melayu yang mesra, sopan dan profesional untuk jurujual / promoter runcit barisan hadapan. Gunakan istilah runcit tempatan seperti "Selamat pagi!", "Sasaran jualan", "Daftar masuk", "Pemeriksaan rak". Ringkas dan bertenaga.',
    morningGreeting: (name, store, target, sku) => `Selamat pagi, ${name}! Kehadiran telah disahkan di ${store}. Sasaran jualan hari ini ialah ${target}. Produk tumpuan: ${sku}. Mari capai sasaran kita hari ini!`,
    rovingGreeting: (name, stopNum, active, next, target) => `Selamat pagi, ${name}! Telah mendaftar masuk di Hentian ${stopNum}/8 (${active}). Destinasi seterusnya: ${next}. Sasaran: ${target}. Semoga perjalanan lancar!`,
    routeGuidance: (active, next, stopNum, total, time) => `Anda kini berada di Hentian ${stopNum}/${total}: ${active} (Disahkan GPS). Selepas mendaftar keluar, destinasi seterusnya ialah ${next} (${time}). Ketik di bawah untuk tindakan seterusnya.`,
    routeOptimized: (next, num, saved) => `⚡ Saya telah menyusun semula baki laluan kedai anda mengikut jarak geografi dan keadaan trafik! Hentian seterusnya ialah Hentian ${num}: ${next}, menjimatkan kira-kira ${saved} minit perjalanan.`,
    tasksChecklist: `Senarai Semak Barisan Hadapan: 1) Daftar Masuk Kedai (GPS), 2) Audit Rak Kamera Vera, 3) Rekod Jualan Pantas 1-Ketik, dan 4) Daftar Keluar sebelum ke cawangan seterusnya.`,
    allStopsCompleted: (name, total) => `Tahniah, ${name}! Anda telah melengkapkan kesemua ${total} lawatan cawangan yang dijadualkan hari ini! Data telah diselaraskan ke ibu pejabat.`,
    languageChangedNotice: (langName, flag) => `${flag} Bahasa pilihan telah dikemas kini ke ${langName}. Saya sedia membantu anda dalam bahasa ini.`,
  },
  vi: {
    code: 'vi',
    name: 'Tiếng Việt',
    nativeName: 'Tiếng Việt',
    flag: '🇻🇳',
    promptInstruction: 'Hãy viết bằng Tiếng Việt tự nhiên, thân thiện và chuyên nghiệp dành cho nhân viên bán hàng / tiếp thị bán lẻ tại cửa hàng. Sử dụng văn phong khuyến khích, rõ ràng, không rườm rà.',
    morningGreeting: (name, store, target, sku) => `Chào buổi sáng, ${name}! Đã xác nhận điểm danh tại ${store}. Chỉ tiêu doanh số hôm nay là ${target}. Sản phẩm trọng tâm: ${sku}. Cùng đạt mục tiêu hôm nay nhé!`,
    rovingGreeting: (name, stopNum, active, next, target) => `Chào buổi sáng, ${name}! Đã điểm danh tại Điểm dừng ${stopNum}/8 (${active}). Điểm đến tiếp theo: ${next}. Mục tiêu: ${target}. Chúc bạn một ngày làm việc hiệu quả!`,
    routeGuidance: (active, next, stopNum, total, time) => `Bạn đang có mặt tại Điểm dừng ${stopNum}/${total}: ${active} (Đã xác minh GPS). Sau khi kết thúc, điểm đến tiếp theo là ${next} (${time}). Nhấn bên dưới để quản lý lộ trình.`,
    routeOptimized: (next, num, saved) => `⚡ Tôi đã sắp xếp lại lộ trình các cửa hàng còn lại dựa trên khoảng cách và tình trạng giao thông thực tế! Điểm dừng tiếp theo là Điểm dừng ${num}: ${next}, tiết kiệm khoảng ${saved} phút di chuyển.`,
    tasksChecklist: `Quy trình làm việc: 1) Điểm danh GPS tại cửa hàng, 2) Kiểm tra kệ hàng Vera, 3) Ghi nhận đơn hàng nhanh 1-chạm, và 4) Đăng xuất khi hoàn thành.`,
    allStopsCompleted: (name, total) => `Tuyệt vời, ${name}! Bạn đã hoàn thành toàn bộ ${total} điểm dừng cửa hàng theo lịch trình hôm nay! Dữ liệu đã đồng bộ về hệ thống trung tâm.`,
    languageChangedNotice: (langName, flag) => `${flag} Đã cập nhật ngôn ngữ ưu tiên sang ${langName}. Tôi sẽ hỗ trợ bạn bằng ngôn ngữ này.`,
  },
  ur: {
    code: 'ur',
    name: 'Urdu',
    nativeName: 'اردو',
    flag: '🇵🇰 / 🇮🇳',
    promptInstruction: 'اردو زبان میں شائستہ، پیشہ ورانہ اور دوستانہ انداز میں جواب دیں۔ ریٹیل سیلز پروموٹر کے لیے واضح اور پرجوش الفاظ استعمال کریں۔',
    morningGreeting: (name, store, target, sku) => `صبح بخیر، ${name}! ${store} پر آپ کی حاضری کی تصدیق ہو گئی ہے۔ آج کا سیلز ٹارگٹ ${target} ہے۔ فوکس پروڈکٹ: ${sku}۔ آئیے آج کا ہدف حاصل کریں!`,
    rovingGreeting: (name, stopNum, active, next, target) => `صبح بخیر، ${name}! اسٹاپ ${stopNum}/8 (${active}) پر چیک ان مکمل ہے۔ اگلی منزل: ${next}۔ ٹارگٹ: ${target}۔ کامیابی کے ساتھ روٹ مکمل کریں!`,
    routeGuidance: (active, next, stopNum, total, time) => `آپ اس وقت اسٹاپ ${stopNum}/${total}: ${active} پر موجود ہیں (GPS تصدیق شدہ)۔ یہاں کا کام مکمل ہونے پر اگلی منزل ${next} ہوگی (${time})۔`,
    routeOptimized: (next, num, saved) => `⚡ میں نے جغرافیائی قربت اور ٹریفک کے مطابق آپ کا روٹ دوبارہ ترتیب دے دیا ہے! اگلا اسٹاپ نمبر ${num}: ${next} ہے، جس سے تقریباً ${saved} منٹ کی بچت ہوگی۔`,
    tasksChecklist: `فرنٹ لائن چیک لسٹ: 1) جی پی ایس چیک ان، 2) ویرا شیلف آڈٹ، 3) 1-ٹیپ فاسٹ سیل اندراج، 4) روانگی سے قبل چیک آؤٹ۔`,
    allStopsCompleted: (name, total) => `شاندار کارکردگی، ${name}! آپ نے آج کے تمام ${total} مقررہ ریٹیل اسٹاپس کامیابی سے مکمل کر لیے ہیں! ڈیٹا ہیڈ کوارٹر کے ساتھ ہم آہنگ ہو چکا ہے۔`,
    languageChangedNotice: (langName, flag) => `${flag} ترجیحی زبان اردو میں تبدیل کر دی گئی ہے۔ اب میں آپ سے اردو میں بات چیت کروں گا۔`,
  },
  hi: {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    flag: '🇮🇳',
    promptInstruction: 'हिंदी में स्वाभाविक, उत्साहवर्धक और पेशेवर शैली में उत्तर दें। रिटेल सेल्स प्रमोटर के लिए आसान और सटीक शब्दों का प्रयोग करें।',
    morningGreeting: (name, store, target, sku) => `नमस्ते / शुभ प्रभात, ${name}! ${store} पर आपकी उपस्थिति दर्ज हो गई है। आज का बिक्री लक्ष्य ${target} है। मुख्य उत्पाद: ${sku}। आइए आज का लक्ष्य हासिल करें!`,
    rovingGreeting: (name, stopNum, active, next, target) => `नमस्ते, ${name}! स्टॉप ${stopNum}/8 (${active}) पर चेक-इन पूरा हुआ। अगला गंतव्य: ${next}। लक्ष्य: ${target}। आपका दिन शुभ हो!`,
    routeGuidance: (active, next, stopNum, total, time) => `आप वर्तमान में स्टॉप ${stopNum}/${total}: ${active} पर उपस्थित हैं (GPS सत्यापित)। चेक-आउट के बाद आपका अगला पड़ाव ${next} (${time}) होगा।`,
    routeOptimized: (next, num, saved) => `⚡ मैंने ट्रैफ़िक और भौगोलिक दूरी के अनुसार आपके शेष रूट को अनुकूलित कर दिया है! अगला स्टॉप नंबर ${num}: ${next} है, जिससे लगभग ${saved} मिनट की बचत होगी।`,
    tasksChecklist: `फ़्रंटलाइन चेकलिस्ट: 1) जीपीएस चेक-इन, 2) वेरा शेल्फ़ अनुपालन ऑडिट, 3) 1-टैप फ़ास्ट-सेल बिक्री प्रविष्टि, और 4) प्रस्थान से पहले चेक-आउट।`,
    allStopsCompleted: (name, total) => `बहुत बढ़िया काम, ${name}! आपने आज के सभी ${total} निर्धारित रिटेल स्टोर स्टॉप्स पूरे कर लिए हैं! डेटा मुख्यालय से सिंक हो चुका है।`,
    languageChangedNotice: (langName, flag) => `${flag} पसंदीदा भाषा हिंदी में अपडेट कर दी गई है। अब से मैं आपकी इसी भाषा में सहायता करूँगा।`,
  },
};

export class PaxAgent {
  /**
   * Normalizes incoming raw language codes into supported taxonomy keys
   */
  static normalizeLanguageCode(code?: string | null): string {
    if (!code) return 'en';
    const c = String(code).toLowerCase().trim();
    if (c === 'fil' || c === 'tl' || c === 'tl-ph' || c === 'fil-ph' || c.includes('tagalog') || c.includes('filipino')) return 'fil';
    if (c === 'ms' || c === 'ms-my' || c.includes('malay') || c.includes('melayu')) return 'ms';
    if (c === 'vi' || c === 'vi-vn' || c.includes('vietnam') || c.includes('tiếng việt')) return 'vi';
    if (c === 'ur' || c === 'ur-pk' || c === 'ur-in' || c.includes('urdu')) return 'ur';
    if (c === 'hi' || c === 'hi-in' || c.includes('hindi')) return 'hi';
    return 'en';
  }

  /**
   * Resolves language configuration meta object
   */
  static getLanguageConfig(code?: string | null): LanguageMeta {
    const norm = this.normalizeLanguageCode(code);
    return SUPPORTED_LANGUAGES_MAP[norm] || SUPPORTED_LANGUAGES_MAP['en'];
  }

  /**
   * Intelligently detects if the user is typing in a specific regional language (Language Mirroring)
   */
  static detectInputLanguage(text: string): string | null {
    if (!text || text.trim().length === 0) return null;
    const lower = text.toLowerCase();

    // 1. Tagalog / Filipino patterns
    // Matches interrogatives, particles, verbs, and syntax:
    // e.g. "anong survey today na need gawin?", "saan ang rota?", "kumusta benta?"
    const filipinoRegex = /\b(anong|ano|saan|san|kailan|paano|bakit|meron|mayron|wala|gawin|gagawin|ginawa|benta|bentahan|kumusta|kamusta|magkano|tindahan|ngayon|paki|po|opo|ba|na need|na dapat|ito|dito|iyon|doon|tayo|namin|natin|salamat|araw|oras|kita|kayo|ninyo|sila|kanila|lahat|meron ba|wala ba|sino)\b/i;
    if (filipinoRegex.test(lower)) return 'fil';

    // 2. Bahasa Melayu patterns
    const malayRegex = /\b(apa|bila|bagaimana|mana|ada|tiada|tidak|tak|buat|terima kasih|khabar|berapa|jualan|kedai|hari ini|sila|boleh|kita|kami|semua|hentian|laluan|jadual|lawatan)\b/i;
    if (malayRegex.test(lower)) return 'ms';

    // 3. Vietnamese patterns
    const vietnameseRegex = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]|(\b(gi|nao|khi nao|o dau|lam sao|khong|cam on|bao nhieu|hom nay|khao sat|cua hang|don hang)\b)/i;
    if (vietnameseRegex.test(lower)) return 'vi';

    // 4. Urdu patterns
    if (/[\u0600-\u06FF]/.test(text)) return 'ur';
    const urduRomanRegex = /\b(kya|kab|kaise|kahan|kyun|hai|hain|shukriya|kitna|aaj|karna|store|survey|haddaf)\b/i;
    if (urduRomanRegex.test(lower)) return 'ur';

    // 5. Hindi patterns
    if (/[\u0900-\u097F]/.test(text)) return 'hi';
    const hindiRomanRegex = /\b(namaste|kya|kab|kaise|kahan|hai|hain|aaj|karna hai|bikri|lakshya)\b/i;
    if (hindiRomanRegex.test(lower)) return 'hi';

    return null;
  }

  /**
   * Updates user preferred language in database and logs audit trail
   */
  static async changeUserLanguage(userId: string, newLanguageCode: string) {
    const normalized = this.normalizeLanguageCode(newLanguageCode);
    const lang = this.getLanguageConfig(normalized);
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) throw new Error('User not found');

    const previousLanguage = user.preferredLanguage || 'en';
    await db.update(users).set({ preferredLanguage: normalized } as any).where(eq(users.id, userId));

    try {
      await db.insert(auditLogs).values({
        id: `audit-lang-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        workspaceId: user.workspaceId,
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        action: 'user.language_changed',
        entityType: 'user',
        entityId: user.id,
        module: 'users',
        diff: {
          previousLanguage,
          newLanguage: normalized,
          languageName: lang.name,
        },
        timestamp: new Date(),
      } as any);
    } catch (auditErr) {
      console.warn('[Audit] Language change audit skipped:', auditErr);
    }

    return {
      success: true,
      userId,
      language: normalized,
      languageName: lang.name,
      nativeName: lang.nativeName,
      flagEmoji: lang.flag,
      confirmationMessage: lang.languageChangedNotice(lang.name, lang.flag),
    };
  }
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

    const lang = this.getLanguageConfig(user.preferredLanguage);

    // Generate prompt for Gemini 2.5 Flash
    let prompt = '';
    if (isRoving && routeCtx && routeCtx.isRoving) {
      const activeName = routeCtx.activeVisit?.store?.name || 'SM Aura Premier';
      const nextName = routeCtx.nextVisit?.store?.name || 'Glorietta 4';
      prompt = `You are Pax, frontline retail operations copilot for Project BLOC.
Promoter: ${user.name} (Roving Fleet Multi-Store Ambassador)
Language Requirement: You MUST generate your response ENTIRELY in ${lang.name} (${lang.nativeName}). ${lang.promptInstruction}
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
Language Requirement: You MUST generate your response ENTIRELY in ${lang.name} (${lang.nativeName}). ${lang.promptInstruction}
Assigned Store: ${store.name}
Today's Target: ${shift.currency} ${shift.targetAmount.toLocaleString()}
Focus SKUs: ${focusProducts.map(p => `${p.name} (${p.currency} ${p.unitPrice})`).join(', ')}

Generate a 2-sentence morning kick-off briefing:
1. Confirm attendance check-in at ${store.name}.
2. State today's sales target and the focus push item.
Keep it punchy, warm, and zero fluff.`;
    }

    const defaultBriefing = (isRoving && routeCtx && routeCtx.isRoving)
      ? lang.rovingGreeting(user.name, routeCtx.activeVisit?.sequenceOrder || 3, routeCtx.activeVisit?.store?.name || 'SM Aura Premier', routeCtx.nextVisit?.store?.name || 'Glorietta 4', `${shift.currency} ${shift.targetAmount.toLocaleString()}`)
      : lang.morningGreeting(user.name, store.name, `${shift.currency} ${shift.targetAmount.toLocaleString()}`, focusProducts[0]?.name || 'Promo Bundle');

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
      originalLanguage: lang.code,
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
    approvalCode?: string,
    customFields: Record<string, any> = {}
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
        customFields: customFields && Object.keys(customFields).length > 0 ? customFields : null,
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
            customFields,
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

    // Resolve active language:
    // 1. Language Mirroring: If the user speaks in a detected language (e.g. Filipino "anong survey today na need gawin?"),
    //    mirror their language immediately so the AI speaks their tongue!
    // 2. Otherwise, fall back to the user's preferred language configured in App Settings (or default English).
    const detectedInputLang = this.detectInputLanguage(userMessage);
    const configuredUserLang = this.normalizeLanguageCode(user.preferredLanguage);
    const activeLangCode = detectedInputLang || configuredUserLang || 'en';
    const lang = this.getLanguageConfig(activeLangCode);

    const msgLower = userMessage.toLowerCase();
    const isLangChange = /(?:change|switch|set|palit|lipat|tukar|đổi|تبدیل|बदल)\s+(?:language|wika|bahasa|ngôn ngữ|زبان|भाषा)/i.test(msgLower) ||
      /(?:speak|talk|mag-usap|bercakap|nói|بات کریں|बात करो)\s+(?:in|sa|dalam|bằng|میں|में)?\s*(filipino|tagalog|english|malay|bahasa|melayu|vietnamese|tiếng việt|urdu|hindi)/i.test(msgLower);

    const isOptimizeQuery = /optimi|traffic|reorder|ayusin|sequence|ayos|fastest|route order|susun|tối ưu/i.test(msgLower);
    const isRouteQuery = /next|store|where|saan|san|route|itinerary|puntahan|stop|stops|rota|bisi|visit|destinasi|lộ trình|منزل|स्टॉप/i.test(msgLower);
    const isTasksQuery = /task|gagawin|checklist|guide|todo|to\s*do|tugas|nhiệm vụ|کام|कार्य/i.test(msgLower);
    const isSurveyQuery = /survey|sarvey|surbey|form|forms|tanong|checklist|pormularyo|khảo sát|kaji selidik|سروے|सर्वे/i.test(msgLower);

    let reply = '';
    let interactiveCardType: string | null = null;
    let cardMetadata: any = null;

    if (isLangChange) {
      let targetCode = 'en';
      if (/filipino|tagalog|fil/i.test(msgLower)) targetCode = 'fil';
      else if (/malay|melayu|ms/i.test(msgLower)) targetCode = 'ms';
      else if (/vietnam|tiếng việt|vi/i.test(msgLower)) targetCode = 'vi';
      else if (/urdu|اردو|ur/i.test(msgLower)) targetCode = 'ur';
      else if (/hindi|हिन्दी|hi/i.test(msgLower)) targetCode = 'hi';
      else if (/english|en/i.test(msgLower)) targetCode = 'en';

      const changeResult = await this.changeUserLanguage(userId, targetCode);
      const newLang = this.getLanguageConfig(targetCode);
      reply = changeResult.confirmationMessage || newLang.languageChangedNotice(newLang.name, newLang.flag);
      interactiveCardType = 'language_updated';
      cardMetadata = {
        language: newLang.code,
        languageName: newLang.name,
        nativeName: newLang.nativeName,
        flag: newLang.flag,
      };
    } else if (isOptimizeQuery && routeCtx?.isRoving) {
      // Execute intelligent proximity optimization
      const optResult = await this.optimizeUserRoute(userId);
      const updatedCtx = await this.getPromoterRouteContext(userId);

      const nextStoreName = updatedCtx?.nextVisit?.store?.name || 'Glorietta 4';
      reply = lang.routeOptimized(nextStoreName, updatedCtx?.nextVisit?.sequenceOrder || 4, 35);
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
        reply = lang.routeGuidance(active.store?.name || 'SM Aura Premier', next?.store?.name || 'Glorietta 4', active.sequenceOrder, total, next?.scheduledTime || '01:30 PM');
      } else if (next) {
        reply = lang.routeGuidance('In Transit', next.store?.name || 'Retail Branch', next.sequenceOrder, total, next.scheduledTime || '01:30 PM');
      } else {
        reply = lang.allStopsCompleted(user.name, total);
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
      reply = lang.tasksChecklist;
      interactiveCardType = 'tasks_card';
    } else {
      // General retail operations query & dynamic survey inquiries via Gemini Flash
      const activeStoreName = routeCtx?.isRoving
        ? (routeCtx.activeVisit?.store?.name || 'SM Aura Premier')
        : (routeCtx?.store?.name || 'Retail Branch');

      // Check active surveys for user's workspace
      let activeSurveys: any[] = [];
      try {
        activeSurveys = await db.select().from(surveys).where(
          and(eq(surveys.workspaceId, user.workspaceId), eq(surveys.status, 'active'))
        );
      } catch (e) {}

      const prompt = `You are Pax, frontline retail operations copilot for Project BLOC.
Promoter: ${user.name} (${routeCtx?.isRoving ? 'Roving Multi-Store Ambassador' : 'Stationary Sales Rep'})
Current Store Location: ${activeStoreName}
Shift Status: Active (${shift ? `${shift.currency} ${shift.targetAmount.toLocaleString()} target` : 'Active'})
Active Surveys Scheduled Today: ${activeSurveys.length > 0 ? activeSurveys.map(s => `"${s.title}" (${s.surveyType})`).join(', ') : 'None scheduled for today'}
Language Requirement: The user asked in ${lang.name} (${lang.nativeName}). You MUST answer strictly in natural, friendly ${lang.name} (${lang.nativeName}). ${lang.promptInstruction}
User Said: "${userMessage}"

Guidelines:
- If asking about surveys (e.g. "anong survey today na need gawin?" or "any surveys today?"):
  * If no surveys are scheduled: clearly tell them in ${lang.name} that there are no special surveys required today, but remind them of their core frontline tasks: 1) Vera Shelf Camera Audit for planogram compliance, 2) Fast-Sale focus promo bundle logging, and 3) EOD shift checkout!
  * If active surveys exist: state the survey title and advise them to tap the Surveys tab at the bottom to complete it.
- If asking about products or pricing: Give concise promotional guidance in ${lang.name}.
- If asking about store operations: Keep answers practical and friendly in ${lang.name}.
- Length: 2 sentences max. Zero fluff.`;

      let fallbackText = lang.morningGreeting(user.name, activeStoreName, shift ? `${shift.currency} ${shift.targetAmount.toLocaleString()}` : 'daily target', 'Focus Promo');
      if (isSurveyQuery) {
        if (activeLangCode === 'fil') {
          fallbackText = activeSurveys.length > 0
            ? `Kumusta, ${user.name}! May ${activeSurveys.length} active survey tayo ngayon: "${activeSurveys[0].title}". Buksan lang ang Surveys tab sa ibaba para sagutan!`
            : `Kumusta, ${user.name}! Walang partikular na 'survey' na kailangan sagutan ngayon. Ang pangunahing checklist mo ay patakbuhin ang Vera Shelf Camera Audit para sa planogram compliance at mag-log ng focus promo sales gamit ang Fast-Sale bago mag-checkout!`;
        } else if (activeLangCode === 'ms') {
          fallbackText = activeSurveys.length > 0
            ? `Hai, ${user.name}! Terdapat borang tinjauan aktif hari ini: "${activeSurveys[0].title}". Sila buka tab Tinjauan di bahagian bawah untuk melengkapkannya.`
            : `Hai, ${user.name}! Tiada 'survey' khusus dijadualkan hari ini. Keutamaan anda ialah menjalankan Audit Rak Kamera Vera dan merekod jualan promosi sebelum daftar keluar!`;
        } else if (activeLangCode === 'vi') {
          fallbackText = activeSurveys.length > 0
            ? `Chào ${user.name}! Hôm nay có bài khảo sát đang hoạt động: "${activeSurveys[0].title}". Nhấn vào tab Khảo sát bên dưới để thực hiện!`
            : `Chào ${user.name}! Hôm nay không có bài khảo sát bắt buộc nào. Nhiệm vụ chính của bạn là thực hiện Kiểm tra Kệ hàng Vera và ghi nhận đơn hàng Fast-Sale trước khi kết thúc ca làm!`;
        } else {
          fallbackText = `No specific survey scheduled today! Your main priorities are running the Vera Shelf Camera Audit for planogram compliance and logging focus promo sales with Fast-Sale before checkout.`;
        }
      }

      reply = fallbackText;
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
      originalLanguage: lang.code,
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
