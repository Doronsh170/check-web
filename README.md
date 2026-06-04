<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<title>בודק קניות</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@500;700;900&family=Heebo:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  :root{
    --paper:#FAF6EF; --paper-2:#F2EADC; --ink:#211D17; --ink-soft:#6B6256;
    --line:#E3D8C5; --gold:#B08642; --burgundy:#7A2E2E;
    --green:#2E7D4F; --green-bg:#E7F1E9;
    --amber:#B07A12; --amber-bg:#FBF0D6;
    --red:#B23A3A;   --red-bg:#F6E3E1;
    --wa:#1FA855;
  }
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  html,body{margin:0;padding:0}
  body{
    font-family:'Heebo',sans-serif; color:var(--ink); background:var(--paper);
    background-image:radial-gradient(120% 90% at 50% -10%, #FFFDF8 0%, var(--paper) 55%, var(--paper-2) 100%);
    min-height:100vh; font-size:18px; line-height:1.55;
    padding:22px 18px 40px; display:flex; justify-content:center;
  }
  .app{width:100%; max-width:460px}
  .brand{text-align:center; margin:6px 0 26px}
  .brand .mark{width:54px;height:54px;border-radius:16px;display:inline-flex;align-items:center;justify-content:center;
    background:var(--ink); color:var(--paper); font-size:28px; box-shadow:0 8px 22px rgba(33,29,23,.18)}
  .brand h1{font-family:'Frank Ruhl Libre',serif; font-weight:900; font-size:30px; margin:14px 0 4px; letter-spacing:-.5px}
  .brand p{margin:0; color:var(--ink-soft); font-size:16px}
  .brand .rule{width:46px;height:3px;background:var(--gold);border-radius:3px;margin:14px auto 0}

  .card{background:#FFFCF6; border:1px solid var(--line); border-radius:22px; padding:20px;
    box-shadow:0 10px 30px rgba(33,29,23,.06)}
  .lead{font-family:'Frank Ruhl Libre',serif; font-size:21px; font-weight:700; text-align:center; margin:2px 0 18px}

  .btn{display:flex;align-items:center;gap:14px;width:100%;border:0;cursor:pointer;
    font-family:'Heebo',sans-serif; font-size:21px; font-weight:700; color:var(--ink);
    padding:20px 22px; border-radius:18px; margin-bottom:14px; text-align:right; transition:transform .08s ease}
  .btn:active{transform:scale(.985)}
  .btn .ico{font-size:26px; width:30px; text-align:center}
  .btn.primary{background:var(--gold); color:#fff; box-shadow:0 8px 20px rgba(176,134,66,.35)}
  .btn.ghost{background:#FBF7EF; border:1.5px solid var(--line); color:var(--ink)}
  .btn .sub{display:block;font-size:14px;font-weight:400;opacity:.85;margin-top:2px}
  .primary .sub{color:#fff}

  .urlbox{margin-top:4px}
  .urlbox.hidden{display:none}
  .urlbox input{width:100%; font-family:'Heebo',sans-serif; font-size:19px; padding:16px 16px;
    border:1.5px solid var(--line); border-radius:14px; background:#fff; color:var(--ink); margin-bottom:12px}
  .urlbox input:focus{outline:none; border-color:var(--gold)}

  /* loading */
  .loading{text-align:center; padding:34px 10px}
  .spin{width:54px;height:54px;border-radius:50%;border:5px solid var(--line);border-top-color:var(--gold);
    margin:0 auto 18px; animation:sp 1s linear infinite}
  @keyframes sp{to{transform:rotate(360deg)}}
  .loading p{color:var(--ink-soft); font-size:17px; margin:0}

  /* result */
  .badge{width:150px;height:150px;border-radius:50%;margin:6px auto 16px;display:flex;flex-direction:column;
    align-items:center;justify-content:center;color:#fff;box-shadow:0 12px 30px rgba(33,29,23,.18)}
  .badge .em{font-size:52px;line-height:1}
  .badge .wd{font-family:'Frank Ruhl Libre',serif;font-weight:900;font-size:22px;margin-top:4px}
  .b-red{background:var(--red)} .b-yellow{background:var(--amber)} .b-green{background:var(--green)}
  .headline{font-family:'Frank Ruhl Libre',serif;font-weight:700;font-size:24px;text-align:center;margin:0 0 16px}
  .reasons{list-style:none;padding:0;margin:0 0 18px}
  .reasons li{display:flex;gap:11px;align-items:flex-start;padding:11px 14px;background:#FBF7EF;
    border:1px solid var(--line);border-radius:13px;margin-bottom:9px;font-size:17px}
  .reasons li .dot{flex:none;width:11px;height:11px;border-radius:50%;margin-top:7px}
  .action{border-radius:15px;padding:15px 16px;font-size:18px;font-weight:500;margin-bottom:20px;border:1.5px solid}
  .a-red{background:var(--red-bg);border-color:#E9C4C0;color:#7d2222}
  .a-yellow{background:var(--amber-bg);border-color:#EAD7A0;color:#6e4d05}
  .a-green{background:var(--green-bg);border-color:#C4DDCB;color:#1f5536}
  .action b{font-weight:700}
  .meta{text-align:center;color:var(--ink-soft);font-size:13.5px;margin:-8px 0 18px}

  .wa{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;border:0;cursor:pointer;
    background:var(--wa);color:#fff;font-family:'Heebo',sans-serif;font-weight:700;font-size:20px;
    padding:18px;border-radius:16px;text-decoration:none;box-shadow:0 8px 20px rgba(31,168,85,.3)}
  .restart{display:block;width:100%;background:none;border:0;cursor:pointer;color:var(--ink-soft);
    font-family:'Heebo',sans-serif;font-size:17px;font-weight:500;padding:18px 0 4px;text-decoration:underline}
  .errbox{background:var(--red-bg);border:1px solid #E9C4C0;color:#7d2222;border-radius:14px;padding:16px;text-align:center;font-size:17px}
  .hidden{display:none}
  .foot{text-align:center;color:var(--ink-soft);font-size:12.5px;margin-top:22px;line-height:1.6}
</style>
</head>
<body>
<div class="app">
  <div class="brand">
    <div class="mark">🛡️</div>
    <h1>בודק קניות</h1>
    <p>לפני שקונים — בודקים רגע</p>
    <div class="rule"></div>
  </div>

  <!-- HOME -->
  <div id="home" class="card">
    <div class="lead">מה רוצים לבדוק?</div>
    <button class="btn primary" id="btnShot">
      <span class="ico">📷</span>
      <span>צילום מסך
        <span class="sub">צלמו פרסומת, מודעת Marketplace, או שיחה עם מוכר</span>
      </span>
    </button>
    <button class="btn ghost" id="btnLink">
      <span class="ico">🔗</span>
      <span>כתובת אתר (קישור)
        <span class="sub">הדביקו את הקישור של האתר</span>
      </span>
    </button>
    <div class="urlbox hidden" id="urlbox">
      <input id="urlInput" type="url" inputmode="url" placeholder="הדביקו כאן את הקישור…" />
      <button class="btn primary" id="btnCheckUrl" style="justify-content:center;margin-bottom:0">
        <span>בדיקה</span>
      </button>
    </div>
    <input id="fileInput" type="file" accept="image/*" class="hidden" />
  </div>

  <!-- LOADING -->
  <div id="loading" class="card loading hidden">
    <div class="spin"></div>
    <p id="loadMsg">בודק…</p>
  </div>

  <!-- RESULT -->
  <div id="result" class="card hidden">
    <div id="badge" class="badge"><span class="em"></span><span class="wd"></span></div>
    <h2 id="headline" class="headline"></h2>
    <div id="meta" class="meta"></div>
    <ul id="reasons" class="reasons"></ul>
    <div id="action" class="action"></div>
    <a id="waBtn" class="wa" href="#"><span>📲</span><span>שלח לדורון לבדיקה</span></a>
    <button id="restart" class="restart">בדיקה חדשה</button>
  </div>

  <!-- ERROR -->
  <div id="error" class="card hidden">
    <div class="errbox" id="errMsg"></div>
    <button id="restart2" class="restart">נסה שוב</button>
  </div>

  <div class="foot">
    הכלי עוזר לזהות סימני אזהרה אבל אינו ערובה.<br>אל תעבירו כסף למוכר פרטי לפני שראיתם את המוצר. בספק — שאלו בן משפחה.
  </div>
</div>

<script>
  // ⬅️ שים כאן את מספר הוואטסאפ שלך (פורמט בינלאומי, בלי + ובלי 0 מוביל). לדוגמה: 972541234567
  const HELPER_PHONE = "972500000000";

  const ENDPOINT = "/.netlify/functions/check"; // גרסת Netlify

  const $ = (id) => document.getElementById(id);
  const views = ["home","loading","result","error"];
  const show = (v) => views.forEach((x)=> $(x).classList.toggle("hidden", x!==v));
  let lastSubject = ""; // למה שנשלח לוואטסאפ

  const LOAD_MSGS = ["בודק את הכתובת…","מסתכל על הפרטים…","כמעט סיימתי…"];
  let loadTimer;
  function startLoading(){
    show("loading"); let i=0; $("loadMsg").textContent = LOAD_MSGS[0];
    loadTimer = setInterval(()=>{ i=(i+1)%LOAD_MSGS.length; $("loadMsg").textContent = LOAD_MSGS[i]; }, 2200);
  }
  function stopLoading(){ clearInterval(loadTimer); }

  // ---- inputs ----
  $("btnLink").onclick = ()=> $("urlbox").classList.toggle("hidden");
  $("btnShot").onclick = ()=> $("fileInput").click();

  $("btnCheckUrl").onclick = ()=>{
    const url = $("urlInput").value.trim();
    if(!url){ $("urlInput").focus(); return; }
    lastSubject = url;
    runCheck({ url });
  };

  $("fileInput").onchange = (e)=>{
    const file = e.target.files && e.target.files[0];
    if(!file) return;
    lastSubject = "צילום מסך של מוצר/אתר";
    const reader = new FileReader();
    reader.onload = ()=>{
      const base64 = String(reader.result).split(",")[1];
      runCheck({ imageBase64: base64, mimeType: file.type || "image/jpeg" });
    };
    reader.readAsDataURL(file);
  };

  $("restart").onclick = reset;
  $("restart2").onclick = reset;
  function reset(){ $("urlInput").value=""; $("fileInput").value=""; $("urlbox").classList.add("hidden"); show("home"); }

  // ---- main ----
  async function runCheck(payload){
    startLoading();
    try{
      const r = await fetch(ENDPOINT, {
        method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify(payload)
      });
      const data = await r.json();
      stopLoading();
      if(!r.ok || data.error){ return showError(data.error || "משהו השתבש בבדיקה."); }
      renderResult(data);
    }catch(err){
      stopLoading();
      showError("אין חיבור או שהבדיקה נכשלה. נסה שוב.");
    }
  }

  function showError(msg){ $("errMsg").textContent = msg; show("error"); }

  function renderResult(d){
    const v = ["red","yellow","green"].includes(d.verdict) ? d.verdict : "yellow";
    const conf = {
      red:    { em:"⚠️", wd:"זהירות",  cls:"b-red",    acls:"a-red" },
      yellow: { em:"🤔", wd:"בדוק",    cls:"b-yellow", acls:"a-yellow" },
      green:  { em:"✅", wd:"נראה תקין", cls:"b-green",  acls:"a-green" },
    }[v];

    const badge = $("badge");
    badge.className = "badge " + conf.cls;
    badge.querySelector(".em").textContent = conf.em;
    badge.querySelector(".wd").textContent = conf.wd;

    $("headline").textContent = d.headline || "";

    $("meta").textContent = (d.domain ? d.domain : "") +
      (d.domainAgeDays != null ? `  ·  גיל האתר: ${d.domainAgeDays} ימים` : "");

    const ul = $("reasons"); ul.innerHTML = "";
    (d.reasons || []).forEach((rsn)=>{
      const li = document.createElement("li");
      const dot = document.createElement("span");
      dot.className = "dot";
      dot.style.background = v==="red" ? "var(--red)" : v==="yellow" ? "var(--amber)" : "var(--green)";
      const txt = document.createElement("span"); txt.textContent = rsn;
      li.appendChild(dot); li.appendChild(txt); ul.appendChild(li);
    });

    const act = $("action");
    act.className = "action " + conf.acls;
    act.innerHTML = "<b>מה לעשות עכשיו:</b> " + (d.action || "");

    // וואטסאפ
    const lines = [
      "היי דורון, בדקתי משהו בכלי וזה מה שיצא:",
      "נושא: " + lastSubject,
      "תוצאה: " + conf.wd + " — " + (d.headline||""),
      d.domain ? ("כתובת: " + d.domain) : "",
      (d.reasons && d.reasons.length) ? ("סיבות: " + d.reasons.join(" | ")) : "",
      "אפשר לבדוק לי?"
    ].filter(Boolean).join("\n");
    $("waBtn").href = `https://wa.me/${HELPER_PHONE}?text=${encodeURIComponent(lines)}`;

    show("result");
  }
</script>
</body>
</html>
