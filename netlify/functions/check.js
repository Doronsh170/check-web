// netlify/functions/check.js
// "בודק קניות" — מנוע בדיקה שמעדיף עובדות קשיחות לפני שיפוט AI:
// Safe Browsing, גיל דומיין, whitelist וזיהוי התחזות. לאחר מכן Gemini משלים את ההקשר.

// לא להשתמש במודל 2.0. הוא מיועד להחלפה ועלול להחזיר Gemini 404.
const GEMINI_MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash"];

// ---------- אתרים מוכרים ובטוחים יחסית ----------
// הוסף כאן אתרים שאבא באמת קונה בהם. אתר ברשימה לא ייצבע אדום רק בגלל חוסר מידע טכני.
const TRUSTED = [
  "ksp.co.il", "ivory.co.il", "terminalx.com", "shufersal.co.il", "rami-levy.co.il",
  "zap.co.il", "lastprice.co.il", "payngo.co.il", "bug.co.il", "mahsaney-hashuk.co.il",
  "amazon.com", "ebay.com", "aliexpress.com", "apple.com", "asos.com",
];

// ---------- מותגים שמתחזים אליהם ----------
// אם הכתובת מכילה את ה-token אבל אינה האתר הרשמי, יש חשד להתחזות.
const BRANDS = [
  { token: "ksp", official: "ksp.co.il" },
  { token: "terminalx", official: "terminalx.com" },
  { token: "ivory", official: "ivory.co.il" },
  { token: "shufersal", official: "shufersal.co.il" },
  { token: "lastprice", official: "lastprice.co.il" },
  { token: "payngo", official: "payngo.co.il" },
  { token: "bug", official: "bug.co.il" },
];

// ---------- prompts ----------
function urlPrompt(domain, ageDays, pageText) {
  return `אתה עוזר זהיר שבודק אם אתר קניות באינטרנט עלול להיות הונאה (עוקץ), עבור משתמש מבוגר בישראל.
החזר אך ורק JSON תקין, בלי טקסט נוסף ובלי סימוני קוד (בלי \`\`\`).

מידע על האתר:
- כתובת: ${domain}
- גיל הדומיין בימים: ${ageDays == null ? "לא ידוע" : ageDays}
- תוכן הדף (חלקי): ${pageText ? pageText.slice(0, 4000) : "לא הצלחנו לקרוא את תוכן הדף"}

חפש דגלי אזהרה: הנחות לא הגיוניות, לחץ של זמן או מלאי, היעדר ח.פ/כתובת/טלפון, עברית עילגת או מתורגמת, התחזות למותג מוכר.
לגבי תשלום — שים לב לדיוק: בקשת כרטיס אשראי כשלעצמה אינה סימן לביטחון. הדגל האדום הוא דחיפה לתשלום בדרך שלא ניתן לבטל: העברה בנקאית, Bit, PayBox, גיפט-קארד או קריפטו. גם מסירת פרטי אשראי לאתר חדש ולא מוכר היא סיכון.

החזר JSON במבנה הבא בדיוק:
{"verdict":"red|yellow|green","headline":"משפט קצר אחד בעברית פשוטה","reasons":["סיבה 1","סיבה 2"],"action":"משפט אחד: מה לעשות עכשיו"}

כללים: verdict=red אם יש סימן ברור להונאה; yellow אם יש ספק או חוסר מידע; green אם נראה תקין ומוכר. 2 עד 3 סיבות בלבד, כל אחת משפט קצר. עברית רגועה ופשוטה, בלי להפחיד יתר על המידה.`;
}

function imagePrompt() {
  return `אתה עוזר זהיר שבודק אם מה שרואים בצילום המסך עלול להיות הונאה (עוקץ), עבור משתמש מבוגר בישראל. רוב הצילומים יגיעו מתוך אפליקציית פייסבוק: פרסומת/מודעה, מודעת Marketplace, או שיחה עם מוכר.
החזר אך ורק JSON תקין, בלי טקסט נוסף ובלי סימוני קוד (בלי \`\`\`).

תחילה זהה את ההקשר: (א) פרסומת או אתר חנות, (ב) מודעת Marketplace, (ג) שיחת צ'אט עם מוכר.

דגלים אדומים חזקים במיוחד — אם מופיע ולו אחד מהם, החזר verdict=red:
- בקשה להעביר כסף מראש לאדם פרטי (Bit, PayBox, העברה בנקאית, או PayPal כ"חבר/משפחה") לפני קבלת המוצר.
- בקשת "מקדמה" כדי "לשמור" את המוצר.
- מוכר שטוען שהוא בחו"ל / חייל / לא יכול להיפגש, ושיישלח בדואר רק אחרי תשלום.
- בקשה לעבור לשיחה פרטית בוואטסאפ/מסנג'ר כדי "לסגור עסקה".
- פרסומת בנוסח "חיסול מלאי / הרשת נסגרת / 90% הנחה" שמובילה לאתר לא מוכר.
- התחזות לחנות רשמית של מותג מוכר.

דגלים נוספים: מחיר נמוך בצורה לא הגיונית, לחץ של זמן או מלאי, עברית עילגת או מתורגמת, פרופיל מוכר חדש או ללא היסטוריה, היעדר פרטי עסק.

אם רואים בתמונה כתובת אתר (URL) כלשהי, החזר אותה בשדה visibleUrl (אחרת ריק "").

החזר JSON במבנה הבא בדיוק:
{"verdict":"red|yellow|green","headline":"משפט קצר אחד בעברית פשוטה","reasons":["סיבה 1","סיבה 2"],"action":"משפט אחד: מה לעשות עכשיו","visibleUrl":""}

כלל זהב ל-action כשמדובר ב-Marketplace או מוכר פרטי: אסור להעביר כסף לפני שרואים ומקבלים את המוצר ביד. verdict=red אם יש סימן ברור; yellow אם יש ספק; green אם נראה תקין. 2 עד 3 סיבות בלבד, עברית רגועה ופשוטה.`;
}

// ---------- handler ----------
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return resp(204, null);
  if (event.httpMethod !== "POST") return resp(405, { error: "Method not allowed" });

  const KEY = process.env.GEMINI_API_KEY;
  const SB_KEY = process.env.SAFE_BROWSING_KEY || "";
  if (!KEY) return resp(500, { error: "חסר GEMINI_API_KEY בהגדרות הסביבה של Netlify" });

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return resp(400, { error: "בקשה לא תקינה" }); }

  try {
    if (body.imageBase64) return resp(200, await analyzeImage(body, KEY, SB_KEY));
    if (body.url) return resp(200, await analyzeUrl(body.url, KEY, SB_KEY));
    return resp(400, { error: "צריך לשלוח url או imageBase64" });
  } catch (e) {
    return resp(500, { error: "שגיאה בבדיקה. נסה שוב.", detail: String((e && e.message) || e) });
  }
};

// ---------- url flow ----------
async function analyzeUrl(rawUrl, key, sbKey) {
  const cleanUrl = normalizeUrl(rawUrl);
  const domain = extractDomain(cleanUrl);
  const hard = {
    domain,
    trusted: isWhitelisted(domain),
    impersonation: impersonationOf(domain),
  };

  const [ageDays, sbThreat, pageText] = await Promise.all([
    rdapAgeDays(domain).catch(() => null),
    safeBrowsing(cleanUrl, sbKey).catch(() => null),
    fetchPageText(cleanUrl).catch(() => null),
  ]);

  hard.ageDays = ageDays;
  hard.sbThreat = sbThreat;

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
    const cleanUrl = normalizeUrl(ai.visibleUrl);
    hard.domain = extractDomain(cleanUrl);
    hard.trusted = isWhitelisted(hard.domain);
    hard.impersonation = impersonationOf(hard.domain);
    const [ageDays, sbThreat] = await Promise.all([
      rdapAgeDays(hard.domain).catch(() => null),
      safeBrowsing(cleanUrl, sbKey).catch(() => null),
    ]);
    hard.ageDays = ageDays;
    hard.sbThreat = sbThreat;
  }
  return combine(hard, ai);
}

// ---------- שילוב: אות קשיח גובר על שיפוט AI ----------
function combine(hard, ai) {
  const aiVerdict = ["red", "yellow", "green"].includes(ai.verdict) ? ai.verdict : "yellow";
  const aiReasons = Array.isArray(ai.reasons) ? ai.reasons : [];
  const facts = [];
  let verdict = null;
  let hardOverride = false;

  if (hard.sbThreat) {
    verdict = "red";
    hardOverride = true;
    facts.push("גוגל מסמנת את האתר הזה כאתר מסוכן או פישינג ידוע.");
  }

  if (!verdict && hard.impersonation) {
    verdict = "red";
    hardOverride = true;
    facts.push(`הכתובת דומה למותג "${hard.impersonation.brand}" אבל אינה האתר הרשמי (${hard.impersonation.official}).`);
  }

  if (!verdict && !hard.trusted && hard.ageDays != null && hard.ageDays < 14) {
    verdict = "red";
    hardOverride = true;
    facts.push(`האתר נפתח לפני ${hard.ageDays} ימים בלבד — סימן אזהרה משמעותי.`);
  }

  if (!verdict && hard.trusted) {
    verdict = "green";
    hardOverride = true;
    facts.push("הכתובת שייכת לאתר מוכר ומבוסס.");
  }

  if (!verdict) {
    verdict = aiVerdict;
  } else if (hard.trusted && verdict === "green" && aiVerdict === "red") {
    verdict = "yellow";
    hardOverride = true;
    facts.push("למרות שמדובר באתר מוכר, נמצא פרט חריג שמצדיק בדיקה לפני תשלום.");
  }

  if (verdict !== "red" && !hard.trusted && hard.ageDays != null && hard.ageDays >= 14 && hard.ageDays < 60) {
    if (verdict === "green") verdict = "yellow";
    facts.push("האתר נפתח רק לאחרונה — כדאי להיזהר לפני שמזינים פרטי תשלום.");
  }

  const reasons = uniqueShort([...facts, ...aiReasons], 3);

  return {
    verdict,
    headline: chooseHeadline(verdict, hard, ai, hardOverride),
    reasons,
    action: chooseAction(verdict, hard, ai, hardOverride),
    domain: hard.domain || null,
    domainAgeDays: hard.ageDays,
    trusted: !!hard.trusted,
  };
}

function uniqueShort(items, max) {
  const out = [];
  for (const item of items) {
    const s = String(item || "").trim();
    if (s && !out.includes(s)) out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

function chooseHeadline(v, hard, ai, hardOverride) {
  if (hard.sbThreat) return "זהירות — האתר מסומן כמסוכן";
  if (hard.impersonation) return "זהירות — ייתכן שמדובר בהתחזות";
  if (hard.trusted && v === "green") return "האתר מוכר, עדיין קונים בזהירות";
  if (hardOverride) return defaultHeadline(v);
  return ai.headline || defaultHeadline(v);
}

function chooseAction(v, hard, ai, hardOverride) {
  if (v === "red") return "אל תשלם. סגור את הדף ושלח לבן משפחה לבדיקה.";
  if (hard.trusted && v === "green") return "ודא שהכתובת בשורת הכתובת נכונה, ושלם רק באמצעי תשלום מוגן ולא בהעברה לאדם פרטי.";
  if (hardOverride) return defaultAction(v);
  return ai.action || defaultAction(v);
}

function defaultHeadline(v) {
  return v === "red" ? "זהירות — נראה חשוד מאוד"
       : v === "yellow" ? "כדאי לבדוק לפני שקונים"
       : "לא נמצאו סימני אזהרה";
}

function defaultAction(v) {
  return v === "red" ? "אל תשלם. סגור את הדף ושלח לבן המשפחה לבדיקה."
       : v === "yellow" ? "אל תמהר. שלח לבן משפחה לפני שאתה משלם."
       : "נראה בסדר. שלם רק באמצעי תשלום מוגן ולא בהעברה או Bit לאדם פרטי.";
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

// ---------- Google Safe Browsing ----------
async function safeBrowsing(url, key) {
  if (!key) return null;
  const r = await fetchWithTimeout(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${key}`, {
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
  }, 7000);
  if (!r.ok) return null;
  const j = await r.json();
  return (j.matches && j.matches.length) ? j.matches[0].threatType : null;
}

// ---------- RDAP: גיל הדומיין בימים ----------
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
    } catch (_) { /* ננסה את השכבה הבאה */ }
  }
  return null;
}

async function rdapRegistrationDate(domain) {
  const r = await fetchWithTimeout(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
    headers: { accept: "application/rdap+json" },
  }, 7000);
  if (!r.ok) return null;
  const j = await r.json();
  const ev = (j.events || []).find((e) => e.eventAction === "registration");
  return ev && ev.eventDate ? new Date(ev.eventDate) : null;
}

// ---------- best-effort קריאת תוכן הדף ----------
async function fetchPageText(url) {
  try {
    const r = await fetchWithTimeout(url, {
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (compatible; SafeBuyCheck/1.0)" },
    }, 7000);
    if (!r.ok) return null;
    const html = await r.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 4000);
  } catch (_) {
    return null;
  }
}

// ---------- Gemini ----------
async function callGemini(parts, key) {
  let lastError = null;
  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const r = await fetchWithTimeout(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 700,
            responseMimeType: "application/json",
          },
        }),
      }, 25000);
      if (!r.ok) throw new Error(`Gemini ${model} ${r.status}`);
      const data = await r.json();
      const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
      return safeJson(text);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error("Gemini failed");
}

// ---------- utils ----------
function normalizeUrl(u) {
  const s = String(u || "").trim();
  if (!s) return "";
  return /^https?:\/\//i.test(s) ? s : "https://" + s;
}

function extractDomain(u) {
  try {
    return new URL(normalizeUrl(u)).hostname.replace(/^www\./i, "").toLowerCase();
  } catch (_) {
    return String(u).replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0].toLowerCase();
  }
}

function safeJson(text) {
  let t = String(text || "").replace(/```json/gi, "").replace(/```/g, "").trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a !== -1 && b !== -1) t = t.slice(a, b + 1);
  try { return JSON.parse(t); }
  catch {
    return {
      verdict: "yellow",
      headline: "לא הצלחנו לנתח עד הסוף",
      reasons: ["נסה שוב, או שלח לבן משפחה לבדיקה."],
      action: "אל תשלם עד שתקבל אישור.",
      visibleUrl: "",
    };
  }
}

async function fetchWithTimeout(url, options, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
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
    body: obj == null ? "" : JSON.stringify(obj),
  };
}
