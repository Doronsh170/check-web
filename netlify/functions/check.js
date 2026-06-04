// netlify/functions/check.js
// "בודק קניות" — מוח מבוסס ניקוד משוקלל + ודאות.
// שכבה קשיחה דטרמיניסטית (Safe Browsing, גיל דומיין, whitelist, התחזות) מכריעה תחילה — עובדה גוברת על דעה.
// מה שלא הוכרע עובר לשכבת ניקוד רכה (סוג טענות, סיכון לפי Gemini, האם מודעה ממומנת).
// עיקרון מפתח: מודעה ממומנת בלי URL לאימות אינה יכולה לצאת ירוק — אי אפשר לאשר ממה שלא רואים.

const GEMINI_MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash"];

// ---------- אתרים מוכרים (whitelist) ----------
const TRUSTED = [
  "ksp.co.il", "ivory.co.il", "terminalx.com", "shufersal.co.il", "rami-levy.co.il",
  "zap.co.il", "lastprice.co.il", "payngo.co.il", "bug.co.il", "mahsani-ashuk.co.il",
  "amazon.com", "ebay.com", "aliexpress.com", "apple.com", "asos.com",
];

// ---------- מותגים שמתחזים אליהם ----------
const BRANDS = [
  { token: "ksp", official: "ksp.co.il" },
  { token: "terminalx", official: "terminalx.com" },
  { token: "ivory", official: "ivory.co.il" },
  { token: "shufersal", official: "shufersal.co.il" },
  { token: "lastprice", official: "lastprice.co.il" },
];

// ---------- משקלי סוגי טענות (לשכבת הניקוד הרכה) ----------
const CLAIM_WEIGHTS = {
  pseudo_medical: 450,        // טענה רפואית לא מבוססת (מכשיר ביתי זול "מרפא" מחלה/כאב)
  miracle_cure: 450,          // "מוצר פלא", ריפוי מהיר מובטח
  unrealistic_discount: 280,  // מחיר/הנחה לא הגיוניים
  closing_down: 220,          // "חיסול מלאי / הרשת נסגרת"
  fake_urgency: 140,          // לחץ זמן/מלאי
  advance_payment_private: 900, // תשלום מראש לאדם פרטי (Marketplace)
  off_platform: 400,          // מעבר לוואטסאפ/מסנג'ר לסגירת עסקה
  brand_impersonation: 500,   // התחזות למותג מוכר
  none: 0,
};

// ---------- prompts ----------
const CLAIMS_VOCAB = `pseudo_medical, miracle_cure, unrealistic_discount, closing_down, fake_urgency, advance_payment_private, off_platform, brand_impersonation, none`;

function urlPrompt(domain, ageDays, pageText) {
  return `אתה מנתח זהיר שבודק אם אתר קניות עלול להיות הונאה (עוקץ), עבור משתמש מבוגר בישראל.
החזר אך ורק JSON תקין, בלי טקסט נוסף ובלי \`\`\`.

מידע:
- כתובת: ${domain}
- גיל הדומיין בימים: ${ageDays == null ? "לא ידוע" : ageDays}
- תוכן הדף (חלקי): ${pageText ? pageText.slice(0, 4000) : "לא הצלחנו לקרוא את תוכן הדף"}

זהה דגלים. לגבי תשלום: בקשת אשראי כשלעצמה אינה סימן לביטחון; הדגל הוא דחיפה לתשלום לא הפיך (העברה/Bit/PayBox/גיפט-קארד/קריפטו) או מסירת אשראי לאתר חדש ולא מוכר.
טענות רפואיות-פלא (ריפוי מחלה/כאב במכשיר ביתי זול תוך ימים) הן דגל אדום חזק במיוחד מול קהל מבוגר.

מלא את השדות:
- context: אחד מ [shop, ad, marketplace, chat, other]
- isSponsoredAd: true/false
- claims: מערך מתוך הרשימה הסגורה [${CLAIMS_VOCAB}] — רק מה שמתקיים בפועל
- aiRisk: מספר שלם 0-100, ההערכה שלך לסיכון שזו הונאה
- reasons: 2-3 משפטים קצרים בעברית פשוטה למשתמש המבוגר
- headline: משפט קצר אחד
- action: משפט אחד — מה לעשות עכשיו

החזר בדיוק:
{"context":"...","isSponsoredAd":false,"claims":["..."],"aiRisk":0,"reasons":["..."],"headline":"...","action":"..."}`;
}

function imagePrompt() {
  return `אתה מנתח זהיר שבודק אם מה שבצילום המסך עלול להיות הונאה (עוקץ), עבור משתמש מבוגר בישראל. רוב הצילומים מאפליקציית פייסבוק: פרסומת ממומנת, מודעת Marketplace, או שיחה עם מוכר.
החזר אך ורק JSON תקין, בלי טקסט נוסף ובלי \`\`\`.

חשוב: אם זו מודעה ממומנת (מופיע "ממומן"/"Sponsored", או כפתור "לקנייה"/"Shop now"), סמן isSponsoredAd=true. מודעה ממומנת שמובילה לחנות לא מוכרת היא ערוץ עוקץ נפוץ; עיצוב מקצועי אינו עדות לאמינות.
טענות רפואיות-פלא (ריפוי נוירופתיה/סוכרת/כאב במכשיר ביתי זול תוך ימים, "מוצר פלא") הן דגל אדום חזק במיוחד מול קהל מבוגר.
דגלים אדומים נוספים: תשלום מראש לאדם פרטי (Bit/PayBox/העברה), "מקדמה לשמור", "אני בחו"ל אשלח בדואר", מעבר לוואטסאפ, "חיסול מלאי/הרשת נסגרת", מחיר לא הגיוני, התחזות למותג.

מלא:
- context: אחד מ [shop, ad, marketplace, chat, other]
- isSponsoredAd: true/false
- claims: מערך מתוך הרשימה הסגורה [${CLAIMS_VOCAB}] — רק מה שמתקיים
- aiRisk: 0-100
- visibleUrl: כתובת אתר אם נראית בתמונה, אחרת ""
- reasons: 2-3 משפטים קצרים בעברית פשוטה
- headline / action: משפט קצר כל אחד

החזר בדיוק:
{"context":"...","isSponsoredAd":false,"claims":["..."],"aiRisk":0,"visibleUrl":"","reasons":["..."],"headline":"...","action":"..."}`;
}

// ---------- handler ----------
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return resp(204, {});
  if (event.httpMethod !== "POST") return resp(405, { error: "Method not allowed" });

  const KEY = process.env.GEMINI_API_KEY;
  const SB_KEY = process.env.SAFE_BROWSING_KEY || "";
  if (!KEY) return resp(500, { error: "חסר GEMINI_API_KEY בהגדרות הסביבה של Netlify" });

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return resp(400, { error: "בקשה לא תקינה" }); }

  try {
    if (body.imageBase64) return resp(200, await analyzeImage(body, KEY, SB_KEY));
    if (body.url)         return resp(200, await analyzeUrl(body.url, KEY, SB_KEY));
    return resp(400, { error: "צריך לשלוח url או imageBase64" });
  } catch (e) {
    return resp(500, { error: "שגיאה בבדיקה. נסה שוב.", detail: String((e && e.message) || e) });
  }
};

// ---------- url flow ----------
async function analyzeUrl(rawUrl, key, sbKey) {
  const fullUrl = normalizeUrl(rawUrl);
  const domain = extractDomain(fullUrl);
  const hard = { domain, trusted: isWhitelisted(domain), impersonation: impersonationOf(domain) };
  const [ageDays, sbThreat, pageText] = await Promise.all([
    rdapAgeDays(domain).catch(() => null),
    safeBrowsing(fullUrl, sbKey).catch(() => null),
    fetchPageText(fullUrl).catch(() => null),
  ]);
  hard.ageDays = ageDays; hard.sbThreat = sbThreat;
  const ai = await callGemini([{ text: urlPrompt(domain, ageDays, pageText) }], key);
  return combine(hard, ai);
}

// ---------- image flow ----------
async function analyzeImage({ imageBase64, mimeType }, key, sbKey) {
  const ai = await callGemini([
    { text: imagePrompt() },
    { inline_data: { mime_type: mimeType || "image/jpeg", data: imageBase64 } },
  ], key);

  const hard = { domain: null, trusted: false, impersonation: null, ageDays: null, sbThreat: null };
  if (ai.visibleUrl && /\./.test(ai.visibleUrl)) {
    const fullUrl = normalizeUrl(ai.visibleUrl);
    hard.domain = extractDomain(fullUrl);
    hard.trusted = isWhitelisted(hard.domain);
    hard.impersonation = impersonationOf(hard.domain);
    const [ageDays, sbThreat] = await Promise.all([
      rdapAgeDays(hard.domain).catch(() => null),
      safeBrowsing(fullUrl, sbKey).catch(() => null),
    ]);
    hard.ageDays = ageDays; hard.sbThreat = sbThreat;
  }
  return combine(hard, ai);
}

// ---------- שילוב: שכבה קשיחה דטרמיניסטית + שכבת ניקוד רכה ----------
function combine(hard, ai) {
  const facts = [];
  let verdict = null, adCeiling = false;
  const claims = Array.isArray(ai.claims) ? ai.claims : [];
  const isAd = !!ai.isSponsoredAd || ai.context === "ad";
  const hasUrl = !!hard.domain;
  const aiRisk = clamp(ai.aiRisk, 0, 100);

  // ----- שכבה קשיחה (עובדה גוברת על דעה) -----
  if (hard.sbThreat) { verdict = "red"; facts.push("גוגל מסמנת את האתר כמסוכן או פישינג ידוע."); }
  if (!verdict && hard.impersonation) { verdict = "red"; facts.push(`הכתובת מתחזה למותג "${hard.impersonation.brand}" אך אינה האתר הרשמי (${hard.impersonation.official}).`); }
  if (hard.ageDays != null && hard.ageDays < 14) { verdict = "red"; facts.unshift(`האתר נפתח לפני ${hard.ageDays} ימים בלבד — סימן מובהק לעוקץ.`); }
  if (!verdict && hard.trusted) { verdict = "green"; facts.push("אתר מוכר ומבוסס."); }

  // ----- שכבת ניקוד רכה (רק אם לא הוכרע קשיחות) -----
  if (!verdict) {
    let score = 0;
    claims.forEach((c) => { score += (CLAIM_WEIGHTS[c] || 0); });
    score += Math.round(aiRisk * 3); // 0..300
    if (!hard.trusted && hard.ageDays != null && hard.ageDays < 60) score += 200;
    if (isAd) score += 150;
    verdict = score >= 600 ? "red" : score >= 250 ? "yellow" : "green";
    // מודעה ממומנת בלי URL לאימות — אי אפשר לאשר, לא ירוק
    if (verdict === "green" && isAd && !hasUrl) { verdict = "yellow"; adCeiling = true; }
  }

  // זהירות דומיין צעיר (לא טרי לגמרי, לא אתר מוכר)
  if (verdict !== "red" && !hard.trusted && hard.ageDays != null && hard.ageDays >= 14 && hard.ageDays < 60) {
    if (verdict === "green") verdict = "yellow";
    facts.push("האתר נפתח רק לפני כחודשיים — כדאי להיזהר.");
  }

  // ----- כותרת ופעולה: למנוע ניגוד בין צבע לטקסט -----
  let headline, action;
  if (adCeiling) {
    headline = "מודעה ממומנת — אי אפשר לאשר מהתמונה";
    action = "הקש על המודעה, ואז בדוק כאן את הקישור של החנות שנפתחת — שם אפשר לבדוק באמת.";
    facts.unshift("זו מודעה ממומנת. עיצוב מקצועי אינו עדות לאמינות — דווקא לרמאים יש עיצוב טוב.");
  } else {
    const aiColor = aiRisk >= 66 ? "red" : aiRisk >= 33 ? "yellow" : "green";
    const matches = aiColor === verdict;
    headline = (matches && ai.headline) ? ai.headline : defaultHeadline(verdict);
    action   = (matches && ai.action)   ? ai.action   : defaultAction(verdict);
  }

  const aiReasons = Array.isArray(ai.reasons) ? ai.reasons : [];
  const reasons = [...new Set([...facts, ...aiReasons])].slice(0, 3);

  return {
    verdict, headline, reasons, action,
    domain: hard.domain || null,
    domainAgeDays: hard.ageDays,
    trusted: !!hard.trusted,
  };
}

function defaultHeadline(v) {
  return v === "red" ? "זהירות — נראה חשוד מאוד"
       : v === "yellow" ? "כדאי לבדוק לפני שקונים"
       : "לא נמצאו סימני אזהרה";
}
function defaultAction(v) {
  return v === "red" ? "אל תשלם. סגור את הדף ושלח לבן המשפחה לבדיקה."
       : v === "yellow" ? "אל תמהר. שלח לבן המשפחה לפני שאתה משלם."
       : "נראה בסדר. שלם באשראי (יש דרך לערער אם משהו משתבש) ולא בהעברה או ביט.";
}

// ---------- whitelist / impersonation ----------
function isWhitelisted(domain) {
  if (!domain) return false;
  return TRUSTED.some((w) => domain === w || domain.endsWith("." + w));
}
function impersonationOf(domain) {
  if (!domain) return null;
  for (const b of BRANDS) {
    const isOfficial = domain === b.official || domain.endsWith("." + b.official);
    if (!isOfficial && domain.includes(b.token)) return { brand: b.token, official: b.official };
  }
  return null;
}

// ---------- Google Safe Browsing (אופציונלי) ----------
async function safeBrowsing(url, key) {
  if (!key) return null;
  const r = await withTimeout(fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${key}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client: { clientId: "buy-check", clientVersion: "1.0" },
      threatInfo: {
        threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
        platformTypes: ["ANY_PLATFORM"],
        threatEntryTypes: ["URL"],
        threatEntries: [{ url }],
      },
    }),
  }), 7000);
  if (!r.ok) return null;
  const j = await r.json();
  return (j.matches && j.matches.length) ? j.matches[0].threatType : null;
}

// ---------- RDAP ----------
async function rdapAgeDays(domain) {
  if (!domain) return null;
  const labels = domain.split(".");
  for (let i = 0; i <= labels.length - 2; i++) {
    const cand = labels.slice(i).join(".");
    try {
      const date = await rdapRegistrationDate(cand);
      if (date) {
        const days = Math.floor((Date.now() - date.getTime()) / 86400000);
        return days >= 0 ? days : null;
      }
    } catch (_) { /* שכבה הבאה */ }
  }
  return null;
}
async function rdapRegistrationDate(domain) {
  const r = await withTimeout(fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
    headers: { accept: "application/rdap+json" },
  }), 7000);
  if (!r.ok) return null;
  const j = await r.json();
  const ev = (j.events || []).find((e) => e.eventAction === "registration");
  return ev && ev.eventDate ? new Date(ev.eventDate) : null;
}

// ---------- קריאת תוכן הדף ----------
async function fetchPageText(url) {
  try {
    const r = await withTimeout(fetch(url, {
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (compatible; SafeBuyCheck/1.0)" },
    }), 7000);
    if (!r.ok) return null;
    const html = await r.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim().slice(0, 4000);
  } catch (_) { return null; }
}

// ---------- Gemini (fallback בין דגמים) ----------
async function callGemini(parts, key) {
  let lastErr;
  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const r = await withTimeout(fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 800 },
        }),
      }), 25000);
      if (r.status === 404) { lastErr = new Error(`Gemini 404 (${model})`); continue; }
      if (!r.ok) throw new Error(`Gemini ${r.status}`);
      const data = await r.json();
      const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
      return safeJson(text);
    } catch (e) {
      lastErr = e;
      if (!/404/.test(String(e.message))) throw e;
    }
  }
  throw lastErr || new Error("Gemini failed");
}

// ---------- utils ----------
function normalizeUrl(u) {
  const s = String(u).trim();
  return /^https?:\/\//i.test(s) ? s : "https://" + s;
}
function extractDomain(u) {
  try { return new URL(normalizeUrl(u)).hostname.replace(/^www\./i, "").toLowerCase(); }
  catch (_) { return String(u).replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0].toLowerCase(); }
}
function clamp(n, a, b) { n = Number(n) || 0; return Math.max(a, Math.min(b, n)); }
function safeJson(text) {
  let t = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a !== -1 && b !== -1) t = t.slice(a, b + 1);
  try { return JSON.parse(t); }
  catch { return { context: "other", isSponsoredAd: false, claims: [], aiRisk: 50, visibleUrl: "", reasons: ["נסה שוב, או שלח לבן המשפחה."], headline: "לא הצלחנו לנתח עד הסוף", action: "אל תשלם עד שתקבל אישור." }; }
}
function withTimeout(promise, ms) {
  let t;
  const timeout = new Promise((_, rej) => { t = setTimeout(() => rej(new Error("timeout")), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}
function resp(status, obj) {
  return {
    statusCode: status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "POST, OPTIONS",
    },
    body: JSON.stringify(obj),
  };
}
