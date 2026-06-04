// netlify/functions/check.js
// "בודק קניות" — המוח של הכלי.
// מקבל מהדפדפן או URL (קישור) או imageBase64 (צילום מסך),
// מריץ בדיקת גיל-דומיין (RDAP) + ניתוח Gemini, ומחזיר פסק רמזור בעברית.

// Gemini 2.0 Flash הוצא משימוש / נחסם בחלק מהמפתחות, ולכן משתמשים במודל עדכני עם fallback.
const GEMINI_MODELS = Array.from(new Set([
  process.env.GEMINI_MODEL || "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-flash-latest",
].filter(Boolean)));

// ---------- prompts ----------
function urlPrompt(domain, ageDays, pageText) {
  return `אתה עוזר זהיר שבודק אם אתר קניות באינטרנט עלול להיות הונאה (עוקץ), עבור משתמש מבוגר בישראל.
החזר אך ורק JSON תקין, בלי טקסט נוסף ובלי סימוני קוד (בלי \`\`\`).

מידע על האתר:
- כתובת: ${domain}
- גיל הדומיין בימים: ${ageDays == null ? "לא ידוע" : ageDays}
- תוכן הדף (חלקי): ${pageText ? pageText.slice(0, 4000) : "לא הצלחנו לקרוא את תוכן הדף"}

חפש דגלי אזהרה: הנחות לא הגיוניות, לחץ של זמן או מלאי, בקשת תשלום בהעברה בנקאית / קריפטו / גיפט-קארד, היעדר ח.פ או כתובת או טלפון, עברית עילגת או מתורגמת במכונה, התחזות למותג מוכר (דומיין שדומה לשם מותג אך אינו הרשמי).

החזר JSON במבנה הבא בדיוק:
{"verdict":"red|yellow|green","headline":"משפט קצר אחד בעברית פשוטה","reasons":["סיבה 1","סיבה 2"],"action":"משפט אחד: מה לעשות עכשיו"}

כללים: verdict=red אם יש סימן ברור להונאה; yellow אם יש ספק או חוסר מידע; green אם נראה תקין ומוכר. 2 עד 3 סיבות בלבד, כל אחת משפט קצר. דבר בעברית רגועה ופשוטה, בלי להפחיד יתר על המידה.`;
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
  if (event.httpMethod === "OPTIONS") return resp(204, {});
  if (event.httpMethod !== "POST") return resp(405, { error: "Method not allowed" });

  const KEY = process.env.GEMINI_API_KEY;
  if (!KEY) return resp(500, { error: "חסר GEMINI_API_KEY בהגדרות הסביבה של Netlify" });

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return resp(400, { error: "בקשה לא תקינה" }); }

  try {
    if (body.imageBase64) return resp(200, await analyzeImage(body, KEY));
    if (body.url)         return resp(200, await analyzeUrl(body.url, KEY));
    return resp(400, { error: "צריך לשלוח url או imageBase64" });
  } catch (e) {
    return resp(500, { error: "שגיאה בבדיקה. נסה שוב.", detail: String((e && e.message) || e) });
  }
};

// ---------- url flow ----------
async function analyzeUrl(rawUrl, key) {
  const domain = extractDomain(rawUrl);
  const [ageDays, pageText] = await Promise.all([rdapAgeDays(domain), fetchPageText(rawUrl)]);
  const ai = await callGemini([{ text: urlPrompt(domain, ageDays, pageText) }], key);
  return finalize(ai, { domain, ageDays });
}

// ---------- image flow ----------
async function analyzeImage({ imageBase64, mimeType }, key) {
  const ai = await callGemini([
    { text: imagePrompt() },
    { inline_data: { mime_type: mimeType || "image/jpeg", data: imageBase64 } },
  ], key);

  let ageDays = null, domain = null;
  if (ai.visibleUrl && /\./.test(ai.visibleUrl)) {
    domain = extractDomain(ai.visibleUrl);
    ageDays = await rdapAgeDays(domain).catch(() => null);
  }
  return finalize(ai, { domain, ageDays });
}

// ---------- combine AI verdict + hard domain-age signal ----------
function finalize(ai, { domain, ageDays }) {
  let verdict = ["red", "yellow", "green"].includes(ai.verdict) ? ai.verdict : "yellow";
  const reasons = Array.isArray(ai.reasons) ? ai.reasons.slice(0, 3) : [];

  // גיל דומיין הוא אחד האותות החזקים ביותר — override קשיח
  if (ageDays != null) {
    if (ageDays < 14) {
      verdict = "red";
      reasons.unshift(`האתר נפתח לפני ${ageDays} ימים בלבד — סימן מובהק לאתר עוקץ.`);
    } else if (ageDays < 60 && verdict === "green") {
      verdict = "yellow";
      reasons.unshift(`האתר נפתח רק לפני כחודשיים — כדאי להיזהר.`);
    }
  }

  return {
    verdict,
    headline: ai.headline || defaultHeadline(verdict),
    reasons: reasons.slice(0, 3),
    action: ai.action || defaultAction(verdict),
    domain: domain || null,
    domainAgeDays: ageDays,
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
       : "נראה בסדר, אבל תמיד שלם רק בכרטיס אשראי.";
}

// ---------- RDAP: גיל הדומיין בימים ----------
async function rdapAgeDays(domain) {
  if (!domain) return null;
  // מנסה מהשם המלא ומקצר שכבה־שכבה (מטפל בתתי־דומיין ובסיומות כמו co.il)
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
  const r = await withTimeout(fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
    headers: { accept: "application/rdap+json" },
  }), 7000);
  if (!r.ok) return null;
  const j = await r.json();
  const ev = (j.events || []).find((e) => e.eventAction === "registration");
  return ev && ev.eventDate ? new Date(ev.eventDate) : null;
}

// ---------- best-effort קריאת תוכן הדף ----------
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
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

    try {
      const r = await withTimeout(fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 700 },
        }),
      }), 25000);

      if (!r.ok) {
        const errText = await r.text().catch(() => "");
        lastError = `Gemini ${r.status} on ${model}: ${errText.slice(0, 250)}`;
        continue;
      }

      const data = await r.json();
      const text = (data.candidates?.[0]?.content?.parts || [])
        .map((p) => p.text || "").join("").trim();
      return safeJson(text);
    } catch (e) {
      lastError = `Gemini failed on ${model}: ${String((e && e.message) || e)}`;
    }
  }

  throw new Error(lastError || "Gemini failed");
}

// ---------- utils ----------
function extractDomain(u) {
  try {
    const withScheme = /^https?:\/\//i.test(u) ? u : "https://" + u;
    return new URL(withScheme).hostname.replace(/^www\./i, "").toLowerCase();
  } catch (_) {
    return String(u).replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0].toLowerCase();
  }
}

function safeJson(text) {
  let t = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a !== -1 && b !== -1) t = t.slice(a, b + 1);
  try { return JSON.parse(t); }
  catch { return { verdict: "yellow", headline: "לא הצלחנו לנתח עד הסוף", reasons: ["נסה שוב, או שלח לבן המשפחה."], action: "אל תשלם עד שתקבל אישור.", visibleUrl: "" }; }
}

function withTimeout(promise, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  // fetch לא תמיד מקבל signal דרך ה-promise הזה; נשתמש ב-race כגיבוי
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
  ]).finally(() => clearTimeout(t));
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
