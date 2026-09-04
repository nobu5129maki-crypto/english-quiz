/* 中学1年生のための５分英単語 — 画面と学習ループ */
(function () {
  const STORE_PROGRESS = "fmin_v1_progress";
  const STORE_META = "fmin_v1_meta";

  let progress = {};
  let meta = {
    onboarded: false,
    streak: 0,
    lastSessionDate: "",
    sessionCount: 0,
  };

  let session = null;
  let selectedVoice = null;
  let isChecking = false;
  let combo = 0;

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
    return { box: 0, due: ymd() };
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
    WORDS.forEach((w) => getProg(w.id));
  }

  function save() {
    localStorage.setItem(STORE_PROGRESS, JSON.stringify(progress));
    localStorage.setItem(STORE_META, JSON.stringify(meta));
  }

  function unitMasteredCount(unitId) {
    return wordsInUnit(unitId).filter((w) => getProg(w.id).box >= MASTER_BOX).length;
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

    const learning = due.filter((w) => w.unit === unit.id);
    learning.forEach(add);

    shuffle(wordsInUnit(unit.id)).forEach(add);
    due.forEach(add);
    shuffle(WORDS).forEach(add);

    return shuffle(picked).slice(0, SESSION_SIZE);
  }

  function applySrs(word, listenOk, writeOk) {
    const p = getProg(word.id);
    const today = ymd();
    if (listenOk && writeOk) {
      p.box = Math.min(3, Math.max(1, p.box + 1));
      p.due = addDays(today, INTERVAL_DAYS[p.box]);
    } else {
      p.box = 1;
      p.due = addDays(today, 1);
    }
    save();
  }

  function markSessionComplete() {
    const today = ymd();
    if (meta.lastSessionDate !== today) {
      if (meta.lastSessionDate === yesterday()) meta.streak += 1;
      else meta.streak = 1;
      meta.lastSessionDate = today;
    }
    meta.sessionCount = (meta.sessionCount || 0) + 1;
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

  function showScreen(name) {
    ["onboard", "home", "lesson", "result"].forEach((id) => {
      const el = $("screen-" + id);
      if (!el) return;
      const on = id === name;
      el.hidden = !on;
      el.setAttribute("aria-hidden", on ? "false" : "true");
    });
  }

  function showPhase(name) {
    ["listen", "meaning", "write"].forEach((id) => {
      const el = $("phase-" + id);
      if (el) el.hidden = id !== name;
    });
  }

  /* ----- 音声 ----- */
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

  /* ----- 誤答は同じ単元から ----- */
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

  /* ----- ホーム ----- */
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
      const row = document.createElement("div");
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
      metaLine.textContent = done + "/" + total + "語 定着";
      body.appendChild(name);
      body.appendChild(metaLine);
      row.appendChild(mark);
      row.appendChild(body);
      list.appendChild(row);
    });
  }

  function goHome() {
    session = null;
    renderHome();
    showScreen("home");
  }

  /* ----- オンボーディング ----- */
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

  /* ----- レッスン ----- */
  function startLesson() {
    const words = pickSessionWords();
    session = {
      kind: "lesson",
      words: words,
      index: 0,
      phase: "listen",
      listenOk: {},
      writeOk: {},
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

  function renderWrite() {
    const w = currentWord();
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
    if (isChecking || session.phase !== "write") return;
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
    });
    setTimeout(() => {
      isChecking = false;
      session.index += 1;
      if (session.index >= session.words.length) finishLesson();
      else renderListen();
    }, ok ? 800 : 1600);
  }

  function finishLesson() {
    markSessionComplete();
    const weak = session.results.filter((r) => !r.listenOk || !r.writeOk).length;
    $("result-count").textContent = session.words.length + "語";
    $("result-weak").textContent =
      weak > 0 ? "弱点 " + weak + "語は、あしたもう一度出ます。" : "全部できた。あしたも5分だけ。";
    const ul = $("result-words");
    ul.innerHTML = "";
    session.results.forEach((r) => {
      const w = wordById(r.id);
      const li = document.createElement("li");
      const good = r.listenOk && r.writeOk;
      li.className = good ? "ok" : "ng";
      li.textContent = (good ? "定着へ  " : "あした  ") + w.en + "  " + w.ja;
      ul.appendChild(li);
    });
    showScreen("result");
  }

  /* ----- イベント ----- */
  function bind() {
    $("cta-main").addEventListener("click", startLesson);
    $("btn-onboard-go").addEventListener("click", goHome);
    $("btn-replay").addEventListener("click", () => {
      const w = currentWord();
      if (w) speak(w.en);
    });
    $("btn-replay-meaning").addEventListener("click", () => {
      const w = currentWord();
      if (w) speak(w.en);
    });
    $("btn-replay-write").addEventListener("click", () => {
      const w = currentWord();
      if (w) speak(w.en);
    });
    $("btn-to-write").addEventListener("click", renderWrite);
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
