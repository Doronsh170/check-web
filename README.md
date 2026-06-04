# בודק קניות — פריסה דרך GitHub ל-Netlify

מבנה התיקייה (אל תשנה את המבנה):

```
index.html                  ← מה שאבא רואה (גרסת Netlify)
index-local.html            ← לבדיקות שלך בלבד
netlify.toml                ← הגדרות פריסה
netlify/functions/check.js  ← המוח: RDAP (גיל דומיין) + Gemini
.gitignore
README.md
```

## לפני שמעלים — שורה אחת למלא
ב-`index.html` (ובמידת הצורך גם ב-`index-local.html`), בראש ה-`<script>`:

```
const HELPER_PHONE = "972500000000";
```

החלף למספר הוואטסאפ שלך, בפורמט בינלאומי, בלי `+` ובלי `0` מוביל. לדוגמה: `972541234567`.

## שלב 1 — GitHub
1. צור repository חדש (אפשר Private).
2. העלה את כל הקבצים **עם מבנה התיקיות** — חשוב ש-`check.js` יישאר תחת `netlify/functions/`.
   - הכי קל: גרור את כל התיקייה אל "Add file → Upload files" באתר GitHub, או השתמש ב-GitHub Desktop.

## שלב 2 — Netlify
1. Netlify → **Add new site → Import an existing project** → התחבר ל-GitHub ובחר את ה-repo.
2. Build settings: Build command — **השאר ריק**. Publish directory — `.` (אם `netlify.toml` קיים, זה כבר מוגדר).
3. Site configuration → **Environment variables** → הוסף:
   - Key: `GEMINI_API_KEY`
   - Value: המפתח שלך מ-Google AI Studio
4. **Deploy site**.

## שלב 3 — בטלפון של אבא
פתח את כתובת ה-Netlify בכרום → תפריט ⋮ → **"הוספה למסך הבית"**. נוצר אייקון לפתיחה בלחיצה. זהו.

## בדיקה מקומית (אתה)
פתח את `index-local.html` בדפדפן, הדבק מפתח Gemini פעם אחת (נשמר במכשיר בלבד), ונסה קישור או צילום מסך.
הערה: בדיקת גיל הדומיין עלולה להיחסם ב-CORS בגרסה המקומית — אז היא ממשיכה עם Gemini בלבד. בגרסת Netlify זה תמיד עובד.

## אם משהו לא עובד
- "חסר GEMINI_API_KEY" → לא הוגדר משתנה הסביבה ב-Netlify, או שצריך Deploy מחדש אחרי שהוספת אותו.
- הכפתור "שלח לדורון" פותח וואטסאפ ריק → לא מילאת את `HELPER_PHONE`.

## fast-follow (לא נכלל ב-v1)
- Google Safe Browsing (מפתח חינמי) — אות חזק נוסף.
- whitelist של קמעונאים ישראליים מוכרים לזיהוי התחזות.
- PWA + Share Target — שיתוף בלחיצה אחת מתוך אפליקציית פייסבוק / SMS.
