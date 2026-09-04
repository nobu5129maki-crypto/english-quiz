/* 中学1年生のための５分英単語 — 画面と学習ループ */
(function () {
  const STORE_PROGRESS = "fmin_v1_progress";
  const STORE_META = "fmin_v1_meta";
  const WEEK_DAYS = ["月", "火", "水", "木", "金", "土", "日"];
  const TAB_SCREENS = ["home", "dex", "parent"];

  let progress = {};
  let meta = {
    onboarded: false,
    streak: 0,
    lastSessionDate: "",
    sessionCount: 0,
    log: [],
  };

  let session = null;
  let selectedVoice = null;
  let isChecking = false;
  let combo = 0;
  let dexFilter = "all";
  let rec = null;
  let sheetWord = null;

  const $ = (id) => document.getElementById(id);

  function ymd(d) {
    const x = d || new Date();
    const m = String(x.getMonth() + 1).padStart(2, "0");
    const day = String(x.getDate()).padStart(2, "0");
    return x.getFullYear() + "-" + m + "-" + day;
  }

  function addDays(dateStr, n) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + n);
    return ymd(dt);
  }

  function yesterday() {
    return addDays(ymd(), -1);
  }

  function mondayOf(dateStr) {
    const [y, m, d] = (dateStr || ymd()).split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    const day = dt.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    dt.setDate(dt.getDate() + diff);
    return ymd(dt);
  }

  function shuffle(arr) {
    return arr
      .map((value) => ({ sort: Math.random(), value }))
      .sort((a, b) => a.sort - b.sort)
      .map((x) => x.value);
  }

  function wordById(id) {
    return WORDS.find((w) => w.id === id);
  }

  function unitById(id) {
    return UNITS.find((u) => u.id === id);
  }

  function wordsInUnit(unitId) {
    return WORDS.filter((w) => w.unit === unitId);
  }

  function defaultProg() {
    return { box: 0, due: ymd(), seen: 0, speakOk: 0 };
  }

  function getProg(id) {
    if (!progress[id]) progress[id] = defaultProg();
    return progress[id];
  }

  function load() {
    try {
      progress = JSON.parse(localStorage.getItem(STORE_PROGRESS) || "{}");
    } catch (e) {
      progress = {};
    }
    try {
      const m = JSON.parse(localStorage.getItem(STORE_META) || "{}");
      meta = Object.assign(meta, m);
    } catch (e) {}
    if (!Array.isArray(meta.log)) meta.log = [];
    WORDS.forEach((w) => getProg(w.id));
    if (meta.lastSessionDate && meta.log.length === 0) {
      meta.log.push({ date: meta.lastSessionDate, ids: [], listen: 0, write: 0, speak: 0 });
    }
  }

  function save() {
    localStorage.setItem(STORE_PROGRESS, JSON.stringify(progress));
    localStorage.setItem(STORE_META, JSON.stringify(meta));
  }

  function unitMasteredCount(unitId) {
    return wordsInUnit(unitId).filter((w) => getProg(w.id).box >= MASTER_BOX).length;
  }

  function unitSeenCount(unitId) {
    return wordsInUnit(unitId).filter((w) => getProg(w.id).seen || getProg(w.id).box > 0).length;
  }

  function unitCleared(unitId) {
    const list = wordsInUnit(unitId);
    return list.length > 0 && list.every((w) => getProg(w.id).box >= MASTER_BOX);
  }

  function currentUnit() {
    return UNITS.find((u) => !unitCleared(u.id)) || UNITS[UNITS.length - 1];
  }

  function dueWords() {
    const today = ymd();
    return WORDS.filter((w) => {
      const p = getProg(w.id);
      return p.box >= 1 && p.due <= today;
    }).sort((a, b) => {
      const pa = getProg(a.id);
      const pb = getProg(b.id);
      if (pa.due !== pb.due) return pa.due < pb.due ? -1 : 1;
      return pa.box - pb.box;
    });
  }

  function pickSessionWords() {
    const unit = currentUnit();
    const used = new Set();
    const picked = [];

    function add(w) {
      if (!w || used.has(w.id) || picked.length >= SESSION_SIZE) return;
      used.add(w.id);
      picked.push(w);
    }

    const due = dueWords();
    const otherDue = due.filter((w) => w.unit !== unit.id);
    otherDue.forEach((w) => {
      if (picked.length < 2) add(w);
    });
    due.forEach((w) => {
      if (picked.length < 2) add(w);
    });

    const fresh = shuffle(wordsInUnit(unit.id).filter((w) => getProg(w.id).box === 0));
    fresh.forEach(add);
    due.filter((w) => w.unit === unit.id).forEach(add);
    shuffle(wordsInUnit(unit.id)).forEach(add);
    due.forEach(add);
    shuffle(WORDS).forEach(add);
    return shuffle(picked).slice(0, SESSION_SIZE);
  }

  function applySrs(word, listenOk, writeOk) {
    const p = getProg(word.id);
    const today = ymd();
    p.seen = 1;
    if (listenOk && writeOk) {
      p.box = Math.min(3, Math.max(1, p.box + 1));
      p.due = addDays(today, INTERVAL_DAYS[p.box]);
    } else {
      p.box = 1;
      p.due = addDays(today, 1);
    }
    save();
  }

  function markSessionComplete(results) {
    const today = ymd();
    if (meta.lastSessionDate !== today) {
      if (meta.lastSessionDate === yesterday()) meta.streak += 1;
      else meta.streak = 1;
      meta.lastSessionDate = today;
    }
    meta.sessionCount = (meta.sessionCount || 0) + 1;
    meta.log = meta.log || [];
    meta.log.push({
      date: today,
      ids: results.map((r) => r.id),
      listen: results.filter((r) => r.listenOk).length,
      write: results.filter((r) => r.writeOk).length,
      speak: results.filter((r) => r.speakOk).length,
    });
    if (meta.log.length > 90) meta.log = meta.log.slice(-90);
    save();
  }

  function todayDone() {
    return meta.lastSessionDate === ymd();
  }

  function weakCount() {
    const today = ymd();
    return WORDS.filter((w) => {
      const p = getProg(w.id);
      return p.box === 1 || (p.box > 0 && p.due <= today);
    }).length;
  }

  function seenCount() {
    return WORDS.filter((w) => getProg(w.id).seen || getProg(w.id).box > 0).length;
  }

  function masteredCount() {
    return WORDS.filter((w) => getProg(w.id).box >= MASTER_BOX).length;
  }

  function weekLogs() {
    const start = mondayOf(ymd());
    const end = addDays(start, 6);
    return (meta.log || []).filter((x) => x.date >= start && x.date <= end);
  }

  function showTabbar(on, active) {
    const bar = $("tabbar");
    bar.hidden = !on;
    document.body.classList.toggle("has-tabbar", on);
    if (!on) return;
    ["home", "dex", "parent"].forEach((id) => {
      const btn = $("tab-" + id);
      if (btn) btn.classList.toggle("is-on", id === active);
    });
  }

  function showScreen(name) {
    ["onboard", "home", "lesson", "result", "dex", "parent"].forEach((id) => {
      const el = $("screen-" + id);
      if (!el) return;
      const on = id === name;
      el.hidden = !on;
      el.setAttribute("aria-hidden", on ? "false" : "true");
    });
    const tabs = TAB_SCREENS.indexOf(name) >= 0;
    showTabbar(tabs, name);
  }

  function showPhase(name) {
    ["listen", "meaning", "speak", "write"].forEach((id) => {
      const el = $("phase-" + id);
      if (el) el.hidden = id !== name;
    });
  }

  function selectVoice() {
    const voices = speechSynthesis.getVoices();
    const en = voices.filter((v) => v.lang && v.lang.startsWith("en"));
    if (!en.length) return null;
    const preferred = ["Google US English", "Microsoft Zira", "Microsoft David", "Samantha", "Alex", "Karen", "Daniel"];
    for (const name of preferred) {
      const v = en.find((x) => x.name.includes(name));
      if (v) return v;
    }
    return en.find((v) => v.lang === "en-US") || en.find((v) => v.lang === "en-GB") || en[0];
  }

  function initVoices() {
    const voices = speechSynthesis.getVoices();
    if (voices.length) selectedVoice = selectVoice();
  }

  function speak(text) {
    if (!("speechSynthesis" in window) || !text) return;
    speechSynthesis.cancel();
    initVoices();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.92;
    u.pitch = 1;
    if (selectedVoice) u.voice = selectedVoice;
    speechSynthesis.speak(u);
  }

  function currentWord() {
    if (!session) return null;
    return session.words[session.index];
  }

  function closeOptions(word) {
    const same = WORDS.filter((w) => w.unit === word.unit && w.ja !== word.ja);
    let pool = shuffle(same);
    if (pool.length < 3) {
      const extra = WORDS.filter((w) => w.ja !== word.ja && !pool.includes(w) && w.id !== word.id);
      pool = pool.concat(shuffle(extra));
    }
    const wrong = pool.slice(0, 3).map((w) => w.ja);
    return shuffle([word.ja, ...wrong]);
  }

  function normalizeSpell(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .replace(/[.?!,]/g, "")
      .replace(/\s+/g, " ");
  }

  function hintFor(en) {
    const t = en.trim();
    if (t.length <= 2) return t[0] + "_";
    return t[0] + "_".repeat(Math.max(1, t.length - 2)) + t.slice(-1);
  }

  function speakMatch(heard, target) {
    const a = normalizeSpell(heard);
    const b = normalizeSpell(target);
    if (!a || !b) return false;
    if (a === b) return true;
    if (b.length <= 2) return a === b || a.split(" ").indexOf(b) >= 0;
    if (a.indexOf(b) >= 0 || b.indexOf(a) >= 0) return true;
    const at = a.split(" ");
    const bt = b.split(" ").filter((t) => t.length > 1);
    if (!bt.length) return false;
    const hit = bt.filter((t) => at.indexOf(t) >= 0).length;
    return hit >= Math.ceil(bt.length / 2);
  }

  function recEngine() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  function stopRec() {
    if (rec) {
      try { rec.onresult = null; rec.onerror = null; rec.onend = null; rec.stop(); } catch (e) {}
      rec = null;
    }
    const mic = $("btn-mic");
    if (mic) mic.classList.remove("is-live");
    const sm = $("sheet-mic");
    if (sm) sm.classList.remove("is-live");
  }

  function listenSpeak(targetEn, onDone) {
    const Ctor = recEngine();
    if (!Ctor) {
      onDone({ ok: false, heard: "", reason: "no-mic" });
      return;
    }
    stopRec();
    rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 3;
    rec.onresult = function (ev) {
      const alts = [];
      for (let i = 0; i < ev.results[0].length; i++) alts.push(ev.results[0][i].transcript);
      const heard = alts[0] || "";
      const ok = alts.some((t) => speakMatch(t, targetEn));
      stopRec();
      onDone({ ok: ok, heard: heard });
    };
    rec.onerror = function () {
      stopRec();
      onDone({ ok: false, heard: "", reason: "error" });
    };
    rec.onend = function () {
      const mic = $("btn-mic");
      if (mic) mic.classList.remove("is-live");
    };
    try {
      rec.start();
    } catch (e) {
      onDone({ ok: false, heard: "", reason: "error" });
    }
  }

  function setCombo(n) {
    combo = n;
    const el = $("combo-line");
    if (!el) return;
    if (combo >= 2) {
      el.hidden = false;
      el.textContent = combo + " れんぞく";
    } else {
      el.hidden = true;
    }
  }

  function renderHome() {
    const unit = currentUnit();
    $("streak-num").textContent = String(meta.streak || 0);
    $("home-status").textContent = todayDone() ? "きょうは達成" : "きょうはまだ";
    $("home-status").classList.toggle("is-done", todayDone());
    $("next-unit-name").textContent = unit.name;
    $("next-unit-blurb").textContent = unit.blurb;
    $("cta-main").textContent = todayDone() ? "もう1セット（任意）" : "きょうの5分をはじめる";
    $("cta-sub").textContent = todayDone()
      ? "達成済み。追加の練習もできます"
      : "1セット 約5分・8語";
    $("weak-line").textContent =
      weakCount() > 0 ? "弱点 " + weakCount() + "語が復習待ち" : "弱点なし。新しい単元を進めよう";

    const list = $("unit-list");
    list.innerHTML = "";
    UNITS.forEach((u) => {
      const total = wordsInUnit(u.id).length;
      const done = unitMasteredCount(u.id);
      const row = document.createElement("button");
      row.type = "button";
      row.className = "unit-row";
      if (u.id === unit.id) row.classList.add("is-current");
      if (unitCleared(u.id)) row.classList.add("is-cleared");
      const mark = document.createElement("span");
      mark.className = "unit-mark";
      mark.textContent = unitCleared(u.id) ? "済" : u.id === unit.id ? "今" : "";
      const body = document.createElement("div");
      body.className = "unit-body";
      const name = document.createElement("div");
      name.className = "unit-name";
      name.textContent = u.name;
      const metaLine = document.createElement("div");
      metaLine.className = "unit-meta";
      metaLine.textContent = done + "/" + total + "語 定着  ·  図鑑へ";
      body.appendChild(name);
      body.appendChild(metaLine);
      row.appendChild(mark);
      row.appendChild(body);
      row.addEventListener("click", () => goDex(u.id));
      list.appendChild(row);
    });
  }

  function goHome() {
    session = null;
    stopRec();
    closeSheet();
    renderHome();
    showScreen("home");
  }

  function startOnboard() {
    session = {
      kind: "onboard",
      words: ONBOARD_IDS.map(wordById),
      index: 0,
      answers: [],
    };
    showScreen("onboard");
    renderOnboard();
  }

  function renderOnboard() {
    const w = session.words[session.index];
    $("onboard-step").textContent = session.index + 1 + " / 3";
    $("onboard-en").textContent = w.en;
    speak(w.en);
    const box = $("onboard-options");
    box.innerHTML = "";
    closeOptions(w).forEach((ja) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice";
      btn.textContent = ja;
      btn.onclick = () => finishOnboardItem(ja === w.ja, btn);
      box.appendChild(btn);
    });
  }

  function finishOnboardItem(ok, btn) {
    if (isChecking) return;
    isChecking = true;
    btn.classList.add(ok ? "is-ok" : "is-ng");
    const w = session.words[session.index];
    if (!ok) {
      Array.from($("onboard-options").children).forEach((b) => {
        if (b.textContent === w.ja) b.classList.add("is-ok");
      });
    }
    setTimeout(() => {
      isChecking = false;
      session.index += 1;
      if (session.index >= session.words.length) {
        meta.onboarded = true;
        save();
        $("onboard-quiz").hidden = true;
        $("onboard-done").hidden = false;
      } else {
        renderOnboard();
      }
    }, ok ? 700 : 1100);
  }

  function startLesson() {
    stopRec();
    closeSheet();
    const words = pickSessionWords();
    session = {
      kind: "lesson",
      words: words,
      index: 0,
      phase: "listen",
      listenOk: {},
      writeOk: {},
      speakOk: {},
      results: [],
    };
    setCombo(0);
    $("lesson-total").textContent = String(words.length);
    showScreen("lesson");
    renderListen();
  }

  function updateLessonChrome() {
    const w = currentWord();
    const unit = unitById(w.unit);
    $("lesson-unit").textContent = unit ? unit.name : "";
    $("lesson-index").textContent = String(session.index + 1);
    $("lesson-total").textContent = String(session.words.length);
    const dots = $("progress-dots");
    dots.innerHTML = "";
    session.words.forEach((_, i) => {
      const d = document.createElement("span");
      d.className = "dot";
      if (i < session.index) d.classList.add("is-done");
      if (i === session.index) d.classList.add("is-now");
      dots.appendChild(d);
    });
  }

  function renderListen() {
    const w = currentWord();
    isChecking = false;
    session.phase = "listen";
    getProg(w.id).seen = 1;
    save();
    updateLessonChrome();
    $("step-label").textContent = "きく";
    showPhase("listen");
    $("listen-feedback").textContent = "";
    const box = $("listen-options");
    box.innerHTML = "";
    closeOptions(w).forEach((ja) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice";
      btn.textContent = ja;
      btn.onclick = () => onListenChoice(ja === w.ja, btn);
      box.appendChild(btn);
    });
    speak(w.en);
  }

  function onListenChoice(ok, btn) {
    if (isChecking) return;
    isChecking = true;
    const w = currentWord();
    session.listenOk[w.id] = ok;
    btn.classList.add(ok ? "is-ok" : "is-ng");
    if (!ok) {
      Array.from($("listen-options").children).forEach((b) => {
        if (b.textContent === w.ja) b.classList.add("is-ok");
      });
      setCombo(0);
    } else {
      setCombo(combo + 1);
    }
    $("listen-feedback").textContent = ok ? "せいかい" : "こたえは「" + w.ja + "」";
    $("listen-feedback").className = "feedback " + (ok ? "ok" : "ng");
    setTimeout(() => {
      isChecking = false;
      renderMeaning();
    }, ok ? 650 : 1200);
  }

  function renderMeaning() {
    const w = currentWord();
    session.phase = "meaning";
    updateLessonChrome();
    $("step-label").textContent = "いみ";
    showPhase("meaning");
    const ok = session.listenOk[w.id];
    $("meaning-flag").textContent = ok ? "せいかい" : "おぼえなおし";
    $("meaning-flag").className = "flag " + (ok ? "ok" : "ng");
    $("meaning-en").textContent = w.en;
    $("meaning-ja").textContent = w.ja;
    $("meaning-ex-en").textContent = w.exampleEn;
    $("meaning-ex-ja").textContent = w.exampleJa;
    speak(w.en);
  }

  function renderSpeak() {
    const w = currentWord();
    stopRec();
    session.phase = "speak";
    updateLessonChrome();
    $("step-label").textContent = "いう";
    showPhase("speak");
    $("speak-en").textContent = w.en;
    $("speak-ja").textContent = w.ja;
    $("speak-heard").textContent = recEngine() ? "マイクを押して言う" : "マイクが使えないときは、口に出してつぎへ";
    $("speak-feedback").textContent = "";
    $("btn-mic").classList.remove("is-live");
    $("btn-mic").textContent = recEngine() ? "マイク" : "使えない";
    speak(w.en);
  }

  function onMicLesson() {
    const w = currentWord();
    if (!w || session.phase !== "speak") return;
    if (!recEngine()) {
      $("speak-feedback").textContent = "マイク非対応。口に出してつぎへ";
      $("speak-feedback").className = "feedback ng";
      return;
    }
    $("btn-mic").classList.add("is-live");
    $("btn-mic").textContent = "きいています";
    $("speak-heard").textContent = "どうぞ";
    listenSpeak(w.en, function (res) {
      $("btn-mic").textContent = "マイク";
      $("speak-heard").textContent = res.heard ? "聞こえた: " + res.heard : "うまく聞き取れませんでした";
      if (res.ok) {
        session.speakOk[w.id] = true;
        getProg(w.id).speakOk = (getProg(w.id).speakOk || 0) + 1;
        save();
        $("speak-feedback").textContent = "言えた";
        $("speak-feedback").className = "feedback ok";
      } else {
        $("speak-feedback").textContent = "もう一度、またはつぎへ";
        $("speak-feedback").className = "feedback ng";
      }
    });
  }

  function skipSpeak() {
    const w = currentWord();
    if (w && session.speakOk[w.id] == null) session.speakOk[w.id] = false;
    renderWrite();
  }

  function renderWrite() {
    const w = currentWord();
    stopRec();
    isChecking = false;
    session.phase = "write";
    updateLessonChrome();
    $("step-label").textContent = "かく";
    showPhase("write");
    $("write-ja").textContent = w.ja;
    $("write-hint").textContent = "";
    $("write-feedback").textContent = "";
    const input = $("spell-input");
    input.value = "";
    input.disabled = false;
    setTimeout(() => input.focus(), 80);
  }

  function onWriteSubmit() {
    if (isChecking || !session || session.phase !== "write") return;
    const w = currentWord();
    const input = $("spell-input");
    const val = input.value;
    if (!normalizeSpell(val)) return;
    isChecking = true;
    const ok = normalizeSpell(val) === normalizeSpell(w.en);
    session.writeOk[w.id] = ok;
    input.disabled = true;
    $("write-feedback").textContent = ok ? "せいかい" : "こたえは " + w.en;
    $("write-feedback").className = "feedback " + (ok ? "ok" : "ng");
    if (!ok) setCombo(0);
    speak(w.en);
    applySrs(w, !!session.listenOk[w.id], ok);
    session.results.push({
      id: w.id,
      listenOk: !!session.listenOk[w.id],
      writeOk: ok,
      speakOk: !!session.speakOk[w.id],
    });
    setTimeout(() => {
      isChecking = false;
      session.index += 1;
      if (session.index >= session.words.length) finishLesson();
      else renderListen();
    }, ok ? 800 : 1600);
  }

  function finishLesson() {
    markSessionComplete(session.results);
    const weak = session.results.filter((r) => !r.listenOk || !r.writeOk).length;
    const spoken = session.results.filter((r) => r.speakOk).length;
    $("result-count").textContent = session.words.length + "語";
    $("result-weak").textContent =
      weak > 0 ? "弱点 " + weak + "語は、あしたもう一度出ます。" : "全部できた。あしたも5分だけ。";
    $("result-dex-note").textContent =
      "図鑑に記録: " + session.results.length + "語" + (spoken ? " ／ 声に出した " + spoken + "語" : "");
    const ul = $("result-words");
    ul.innerHTML = "";
    session.results.forEach((r) => {
      const w = wordById(r.id);
      const li = document.createElement("li");
      const good = r.listenOk && r.writeOk;
      li.className = good ? "ok" : "ng";
      li.textContent = (good ? "定着へ  " : "あした  ") + w.en + "  " + w.ja + (r.speakOk ? "  声○" : "");
      ul.appendChild(li);
    });
    showScreen("result");
  }

  function wordStatus(w) {
    const p = getProg(w.id);
    if (p.box >= MASTER_BOX) return "mastered";
    if (p.box === 1 || (p.seen && p.box > 0)) return "weak";
    if (p.seen || p.box > 0) return "seen";
    return "locked";
  }

  function goDex(filter) {
    stopRec();
    closeSheet();
    dexFilter = filter || "all";
    renderDex();
    showScreen("dex");
  }

  function renderDex() {
    $("dex-count").textContent = "見つけた " + seenCount() + " / " + WORDS.length + "語　定着 " + masteredCount() + "語";
    const filters = $("dex-filters");
    filters.innerHTML = "";
    const chips = [{ id: "all", name: "すべて" }, { id: "weak", name: "弱点" }, { id: "mastered", name: "定着" }]
      .concat(UNITS.map((u) => ({ id: u.id, name: u.name })));
    chips.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (dexFilter === c.id ? " is-on" : "");
      b.textContent = c.name;
      b.addEventListener("click", () => {
        dexFilter = c.id;
        renderDex();
      });
      filters.appendChild(b);
    });

    const list = $("dex-list");
    list.innerHTML = "";
    UNITS.forEach((u) => {
      if (dexFilter !== "all" && dexFilter !== "weak" && dexFilter !== "mastered" && dexFilter !== u.id) return;
      const words = wordsInUnit(u.id).filter((w) => {
        const st = wordStatus(w);
        if (dexFilter === "weak") return st === "weak";
        if (dexFilter === "mastered") return st === "mastered";
        return true;
      });
      if (!words.length) return;
      const h = document.createElement("div");
      h.className = "dex-unit";
      h.textContent = u.name + "  " + unitSeenCount(u.id) + "/" + wordsInUnit(u.id).length;
      list.appendChild(h);
      const grid = document.createElement("div");
      grid.className = "dex-grid";
      words.forEach((w) => {
        const st = wordStatus(w);
        const card = document.createElement("button");
        card.type = "button";
        card.className = "dex-card";
        if (st === "locked") card.classList.add("is-locked");
        if (st === "weak") card.classList.add("is-weak");
        if (st === "seen") card.classList.add("is-new");
        const en = document.createElement("div");
        en.className = "en";
        en.textContent = st === "locked" ? "????" : w.en;
        const ja = document.createElement("div");
        ja.className = "ja";
        ja.textContent = st === "locked" ? "まだ聞いていない" : w.ja;
        const lab = document.createElement("div");
        lab.className = "st";
        lab.textContent = st === "mastered" ? "定着" : st === "weak" ? "弱点" : st === "seen" ? "みつけた" : "未発見";
        card.appendChild(en);
        card.appendChild(ja);
        card.appendChild(lab);
        if (st !== "locked") card.addEventListener("click", () => openSheet(w));
        grid.appendChild(card);
      });
      list.appendChild(grid);
    });
    if (!list.children.length) {
      const p = document.createElement("p");
      p.className = "cta-sub";
      p.style.textAlign = "left";
      p.textContent = "この条件の語はまだありません。";
      list.appendChild(p);
    }
  }

  function openSheet(w) {
    sheetWord = w;
    const st = wordStatus(w);
    $("sheet-st").textContent = st === "mastered" ? "定着" : st === "weak" ? "弱点・学習中" : "みつけた";
    $("sheet-st").className = "flag " + (st === "weak" ? "ng" : "ok");
    $("sheet-en").textContent = w.en;
    $("sheet-ja").textContent = w.ja;
    $("sheet-ex-en").textContent = w.exampleEn;
    $("sheet-ex-ja").textContent = w.exampleJa;
    $("sheet-mic-fb").textContent = "";
    $("sheet-word").hidden = false;
    speak(w.en);
  }

  function closeSheet() {
    stopRec();
    sheetWord = null;
    const el = $("sheet-word");
    if (el) el.hidden = true;
  }

  function goParent() {
    stopRec();
    closeSheet();
    renderParent();
    showScreen("parent");
  }

  function parentReportText() {
    const start = mondayOf(ymd());
    const logs = weekLogs();
    const days = new Set(logs.map((x) => x.date));
    const sessions = logs.length;
    const speakN = logs.reduce((n, x) => n + (x.speak || 0), 0);
    const unit = currentUnit();
    const weak = WORDS.filter((w) => wordStatus(w) === "weak").slice(0, 5);
    const weakLine = weak.length ? weak.map((w) => w.en).join(" / ") : "なし";
    const dayMarks = WEEK_DAYS.map((_, i) => {
      const d = addDays(start, i);
      return days.has(d) ? WEEK_DAYS[i] : null;
    }).filter(Boolean);
    return (
      "【中学1年生のための５分英単語】今週の記録\n\n" +
      "学習した日: " + (dayMarks.length ? dayMarks.join("・") : "まだなし") + "（" + days.size + "/7）\n" +
      "セット数: " + sessions + "\n" +
      "連続: " + (meta.streak || 0) + "日\n" +
      "定着した語: " + masteredCount() + "語（全体）\n" +
      "声に出した語: " + speakN + "語（今週）\n" +
      "弱点: " + weakLine + "\n\n" +
      "いまの単元: " + unit.name + "（" + unitMasteredCount(unit.id) + "/" + wordsInUnit(unit.id).length + "）\n\n" +
      "毎日5分、音からおぼえています。"
    );
  }

  function renderParent() {
    const start = mondayOf(ymd());
    const end = addDays(start, 6);
    $("week-range").textContent = start.replace(/-/g, "/") + " 〜 " + end.replace(/-/g, "/");
    const logs = weekLogs();
    const days = new Set(logs.map((x) => x.date));
    const dots = $("week-dots");
    dots.innerHTML = "";
    WEEK_DAYS.forEach((lab, i) => {
      const d = addDays(start, i);
      const el = document.createElement("div");
      el.className = "week-dot" + (days.has(d) ? " is-on" : "");
      el.innerHTML = "<span></span><small>" + lab + "</small>";
      dots.appendChild(el);
    });
    $("week-days").textContent = String(days.size) + "/7";
    $("week-sessions").textContent = String(logs.length);
    $("week-master").textContent = String(masteredCount());
    $("week-speak").textContent = String(logs.reduce((n, x) => n + (x.speak || 0), 0));
    $("parent-note").textContent = parentReportText();
    $("share-ok").textContent = "";

    const box = $("parent-units");
    box.innerHTML = "";
    UNITS.forEach((u) => {
      const total = wordsInUnit(u.id).length;
      const done = unitMasteredCount(u.id);
      const row = document.createElement("div");
      row.className = "unit-row";
      if (unitCleared(u.id)) row.classList.add("is-cleared");
      if (u.id === currentUnit().id) row.classList.add("is-current");
      const mark = document.createElement("span");
      mark.className = "unit-mark";
      mark.textContent = unitCleared(u.id) ? "済" : u.id === currentUnit().id ? "今" : "";
      const body = document.createElement("div");
      body.className = "unit-body";
      const name = document.createElement("div");
      name.className = "unit-name";
      name.textContent = u.name;
      const metaLine = document.createElement("div");
      metaLine.className = "unit-meta";
      metaLine.textContent = done + "/" + total + "語 定着";
      body.appendChild(name);
      body.appendChild(metaLine);
      row.appendChild(mark);
      row.appendChild(body);
      box.appendChild(row);
    });
  }

  function shareParent() {
    const text = parentReportText();
    $("share-ok").textContent = "";
    if (navigator.share) {
      navigator.share({ title: "今週の5分英単語", text: text }).then(function () {
        $("share-ok").textContent = "送りました";
      }).catch(function () {
        copyText(text);
      });
    } else {
      copyText(text);
    }
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        $("share-ok").textContent = "コピーしました。LINEなどで貼って送れます";
      }).catch(function () {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); $("share-ok").textContent = "コピーしました。LINEなどで貼って送れます"; }
    catch (e) { $("share-ok").textContent = "コピーできませんでした。上の文を長押ししてコピーしてください"; }
    ta.remove();
  }

  function bind() {
    $("cta-main").addEventListener("click", startLesson);
    $("btn-onboard-go").addEventListener("click", goHome);
    $("btn-replay").addEventListener("click", () => { const w = currentWord(); if (w) speak(w.en); });
    $("btn-replay-meaning").addEventListener("click", () => { const w = currentWord(); if (w) speak(w.en); });
    $("btn-replay-speak").addEventListener("click", () => { const w = currentWord(); if (w) speak(w.en); });
    $("btn-replay-write").addEventListener("click", () => { const w = currentWord(); if (w) speak(w.en); });
    $("btn-to-speak").addEventListener("click", renderSpeak);
    $("btn-to-write").addEventListener("click", skipSpeak);
    $("btn-speak-skip").addEventListener("click", skipSpeak);
    $("btn-mic").addEventListener("click", onMicLesson);
    $("btn-write-submit").addEventListener("click", onWriteSubmit);
    $("spell-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onWriteSubmit();
      }
    });
    $("btn-hint").addEventListener("click", () => {
      const w = currentWord();
      if (w) $("write-hint").textContent = hintFor(w.en);
    });
    $("btn-quit").addEventListener("click", () => {
      if (confirm("きょうの途中でホームに戻りますか？")) goHome();
    });
    $("btn-result-home").addEventListener("click", goHome);
    $("btn-result-again").addEventListener("click", startLesson);
    $("btn-result-dex").addEventListener("click", () => goDex("all"));
    $("tab-home").addEventListener("click", goHome);
    $("tab-dex").addEventListener("click", () => goDex(dexFilter || "all"));
    $("tab-parent").addEventListener("click", goParent);
    $("btn-share").addEventListener("click", shareParent);
    $("sheet-close").addEventListener("click", closeSheet);
    $("sheet-word").addEventListener("click", (e) => {
      if (e.target === $("sheet-word")) closeSheet();
    });
    $("sheet-speak-btn").addEventListener("click", () => { if (sheetWord) speak(sheetWord.en); });
    $("sheet-mic").addEventListener("click", () => {
      if (!sheetWord) return;
      if (!recEngine()) {
        $("sheet-mic-fb").textContent = "マイク非対応です。口に出しておぼえましょう";
        return;
      }
      $("sheet-mic").textContent = "きいています";
      listenSpeak(sheetWord.en, function (res) {
        $("sheet-mic").textContent = "マネして言う";
        if (res.ok) {
          getProg(sheetWord.id).speakOk = (getProg(sheetWord.id).speakOk || 0) + 1;
          save();
          $("sheet-mic-fb").textContent = "言えた" + (res.heard ? "（" + res.heard + "）" : "");
          $("sheet-mic-fb").className = "feedback ok";
        } else {
          $("sheet-mic-fb").textContent = res.heard ? "聞こえた: " + res.heard : "もう一度どうぞ";
          $("sheet-mic-fb").className = "feedback ng";
        }
      });
    });
  }

  function boot() {
    load();
    bind();
    if ("speechSynthesis" in window) {
      speechSynthesis.onvoiceschanged = initVoices;
      initVoices();
    }
    if (!meta.onboarded) startOnboard();
    else goHome();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
