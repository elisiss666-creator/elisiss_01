"use strict";

const STORAGE_KEY = "orange-cat-multiplication-rail-v1";
const GAME_SECONDS = 80;
const TARGET_SCORE = 10;
const MAX_HEARTS = 5;

const LEVELS = [
  { id: 1, name: "紅旗起點站", tables: [2, 5], cats: 2, visible: 2400, gap: 680, position: [13.5, 18.5] },
  { id: 2, name: "藍橋練習站", tables: [3, 4], cats: 2, visible: 2200, gap: 620, position: [44.2, 18.5] },
  { id: 3, name: "紫丘轉運站", tables: [6], cats: 3, visible: 2000, gap: 560, position: [70.5, 18.5] },
  { id: 4, name: "綠野七號站", tables: [7], cats: 3, visible: 1800, gap: 500, position: [19.2, 49.3] },
  { id: 5, name: "橘風八號站", tables: [8], cats: 4, visible: 1650, gap: 450, position: [48.3, 49.2] },
  { id: 6, name: "瀑布九號站", tables: [9], cats: 4, visible: 1500, gap: 400, position: [76.0, 49.2] },
  { id: 7, name: "櫻花混合站", tables: [2, 3, 4, 5], cats: 5, visible: 1350, gap: 360, position: [20.0, 78.5] },
  { id: 8, name: "粉紅快車站", tables: [6, 7, 8, 9], cats: 5, visible: 1200, gap: 320, position: [46.5, 78.5] },
  { id: 9, name: "冠軍總站", tables: [2, 3, 4, 5, 6, 7, 8, 9], cats: 6, visible: 1050, gap: 280, position: [82.2, 76.5] },
];

const screens = [...document.querySelectorAll(".screen")];
const app = document.querySelector("#app");
const mapButtonsRoot = document.querySelector("#level-buttons");
const holesGrid = document.querySelector("#holes-grid");
const questionCard = document.querySelector("#question-card");
const questionText = document.querySelector("#question-text");
const timerValue = document.querySelector("#timer-value");
const scoreValue = document.querySelector("#score-value");
const heartsRoot = document.querySelector("#hearts");
const feedback = document.querySelector("#feedback");
const hammerCursor = document.querySelector("#hammer-cursor");
const toast = document.querySelector("#toast");

const overlays = {
  tutorial: document.querySelector("#tutorial-overlay"),
  pause: document.querySelector("#pause-overlay"),
  result: document.querySelector("#result-overlay"),
  confirm: document.querySelector("#confirm-overlay"),
};

let progress = loadProgress();
let selectedLevelId = Math.min(progress.unlocked, LEVELS.length);
let audioContext = null;
let toastTimer = null;
let resultReturnTimer = null;

const game = {
  token: 0,
  running: false,
  paused: false,
  level: null,
  score: 0,
  hearts: MAX_HEARTS,
  timeMs: GAME_SECONDS * 1000,
  question: null,
  lastQuestionKey: "",
  waveLocked: false,
  waveTimer: null,
  ticker: null,
  lastTick: 0,
  holes: [],
};

function defaultProgress() {
  return {
    unlocked: 1,
    stars: Array(LEVELS.length).fill(0),
    tutorialSeen: false,
    muted: false,
  };
}

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const base = defaultProgress();
    if (!saved || typeof saved !== "object") return base;
    return {
      unlocked: clamp(Number(saved.unlocked) || 1, 1, LEVELS.length),
      stars: Array.from({ length: LEVELS.length }, (_, index) => clamp(Number(saved.stars?.[index]) || 0, 0, 3)),
      tutorialSeen: Boolean(saved.tutorialSeen),
      muted: Boolean(saved.muted),
    };
  } catch {
    return defaultProgress();
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function showScreen(id) {
  screens.forEach((screen) => {
    const isActive = screen.id === id;
    screen.classList.toggle("active", isActive);
    screen.hidden = !isActive;
    screen.setAttribute("aria-hidden", String(!isActive));
  });
  app.classList.toggle("game-active", id === "game-screen");
}

function setOverlay(name, open) {
  overlays[name].classList.toggle("hidden", !open);
  overlays[name].setAttribute("aria-hidden", String(!open));
  if (open) {
    window.setTimeout(() => overlays[name].querySelector("button")?.focus(), 30);
  }
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("show");
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 1800);
}

function tableDescription(level) {
  if (level.tables.length === 1) return `練習 ${level.tables[0]} 的乘法`;
  if (level.tables.length === 8) return "2～9 全部混合挑戰";
  return `練習 ${level.tables.join("、")} 的乘法`;
}

function renderMap() {
  mapButtonsRoot.replaceChildren();
  LEVELS.forEach((level) => {
    const unlocked = level.id <= progress.unlocked;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "level-button";
    button.style.left = `${level.position[0]}%`;
    button.style.top = `${level.position[1]}%`;
    button.dataset.level = String(level.id);
    button.dataset.stars = progress.stars[level.id - 1] ? "★".repeat(progress.stars[level.id - 1]) : "☆";
    button.textContent = String(level.id);
    button.setAttribute(
      "aria-label",
      unlocked
        ? `第 ${level.id} 關，${level.name}，${tableDescription(level)}，${progress.stars[level.id - 1]} 顆星`
        : `第 ${level.id} 關尚未解鎖`,
    );
    if (!unlocked) button.classList.add("locked");
    if (level.id === selectedLevelId) button.classList.add("selected");
    button.addEventListener("click", () => {
      if (!unlocked) {
        button.classList.remove("wiggle");
        void button.offsetWidth;
        button.classList.add("wiggle");
        playTone(170, 0.12, "square", 0.035);
        showToast("先完成前一站，這一站才會開放喔！");
        return;
      }
      selectedLevelId = level.id;
      renderMap();
      playTone(440, 0.05, "sine", 0.025);
    });
    mapButtonsRoot.append(button);
  });
  renderLevelCard();
}

function renderLevelCard() {
  const level = LEVELS[selectedLevelId - 1];
  const stars = progress.stars[level.id - 1];
  document.querySelector("#level-card-number").textContent = String(level.id);
  document.querySelector("#level-card-name").textContent = level.name;
  document.querySelector("#level-card-tables").textContent = tableDescription(level);
  const starsRoot = document.querySelector("#level-card-stars");
  starsRoot.textContent = `${"★".repeat(stars)}${"☆".repeat(3 - stars)}`;
  starsRoot.setAttribute("aria-label", stars ? `已取得 ${stars} 顆星` : "尚未取得星星");
  document.querySelector("#enter-level-button").textContent = stars ? "再次挑戰" : "進入關卡";
}

function showMap({ tutorial = false } = {}) {
  stopGame();
  showScreen("map-screen");
  renderMap();
  if (tutorial || !progress.tutorialSeen) {
    window.setTimeout(openTutorial, 160);
  }
}

function openTutorial() {
  setOverlay("tutorial", true);
}

function closeTutorial() {
  progress.tutorialSeen = true;
  saveProgress();
  setOverlay("tutorial", false);
}

function buildHoles() {
  holesGrid.replaceChildren();
  game.holes = Array.from({ length: 9 }, (_, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "hole-button";
    button.disabled = true;
    button.dataset.index = String(index);
    button.setAttribute("aria-label", `第 ${index + 1} 個洞口`);
    button.innerHTML = `
      <span class="hole-shadow" aria-hidden="true"></span>
      <span class="hole-mask" aria-hidden="true">
        <span class="cat-figure">
          <img src="assets/orange-cat-master.png" alt="" draggable="false" />
          <span class="answer-badge"></span>
        </span>
      </span>
      <span class="hole-front" aria-hidden="true"></span>
    `;
    button.addEventListener("click", (event) => handleHoleHit(index, event));
    holesGrid.append(button);
    return button;
  });
}

function generateQuestion() {
  const level = game.level;
  let question;
  let attempts = 0;
  do {
    const a = level.tables[Math.floor(Math.random() * level.tables.length)];
    const b = 1 + Math.floor(Math.random() * 9);
    question = { a, b, answer: a * b, key: `${a}x${b}` };
    attempts += 1;
  } while (question.key === game.lastQuestionKey && attempts < 12);
  game.lastQuestionKey = question.key;
  return question;
}

function distractorsFor(question, count) {
  const { a, b, answer } = question;
  const candidates = [
    a * (b - 1),
    a * (b + 1),
    (a - 1) * b,
    (a + 1) * b,
    answer - a,
    answer + a,
    answer - b,
    answer + b,
    answer - 1,
    answer + 1,
    answer - 2,
    answer + 2,
  ];
  const unique = shuffle([...new Set(candidates.filter((value) => value > 0 && value <= 81 && value !== answer))]);
  while (unique.length < count) {
    const value = 1 + Math.floor(Math.random() * 81);
    if (value !== answer && !unique.includes(value)) unique.push(value);
  }
  return unique.slice(0, count);
}

function setQuestion(question, animate = false) {
  game.question = question;
  questionText.textContent = `${question.a} × ${question.b} = ？`;
  if (animate) {
    questionCard.animate(
      [
        { transform: "translateY(-5px) scale(.98)", opacity: 0.55 },
        { transform: "translateY(0) scale(1)", opacity: 1 },
      ],
      { duration: 220, easing: "ease-out" },
    );
  }
}

function clearWave() {
  window.clearTimeout(game.waveTimer);
  game.waveTimer = null;
  game.holes.forEach((hole) => {
    hole.classList.remove("active", "hit");
    hole.disabled = true;
    delete hole.dataset.answer;
    const image = hole.querySelector("img");
    image.src = "assets/orange-cat-master.png";
    hole.querySelector(".answer-badge").textContent = "";
    hole.setAttribute("aria-label", `第 ${Number(hole.dataset.index) + 1} 個洞口`);
  });
}

function scheduleWave(delay = game.level.gap) {
  const token = game.token;
  window.clearTimeout(game.waveTimer);
  game.waveTimer = window.setTimeout(() => {
    if (token !== game.token || !game.running || game.paused) return;
    launchWave();
  }, delay);
}

function launchWave() {
  if (!game.running || game.paused) return;
  clearWave();
  game.waveLocked = false;
  const indices = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]).slice(0, game.level.cats);
  const correctSlot = Math.floor(Math.random() * indices.length);
  const wrongAnswers = distractorsFor(game.question, indices.length - 1);
  let wrongIndex = 0;

  indices.forEach((holeIndex, slot) => {
    const answer = slot === correctSlot ? game.question.answer : wrongAnswers[wrongIndex++];
    const hole = game.holes[holeIndex];
    hole.dataset.answer = String(answer);
    hole.querySelector(".answer-badge").textContent = String(answer);
    hole.setAttribute("aria-label", `第 ${holeIndex + 1} 個洞口，答案 ${answer}`);
    hole.disabled = false;
    requestAnimationFrame(() => hole.classList.add("active"));
  });

  const jitter = 0.9 + Math.random() * 0.2;
  const visibleFor = Math.round(game.level.visible * jitter);
  const token = game.token;
  game.waveTimer = window.setTimeout(() => {
    if (token !== game.token || !game.running || game.paused || game.waveLocked) return;
    clearWave();
    scheduleWave(game.level.gap);
  }, visibleFor);
}

function showFeedback(message, wrong = false) {
  feedback.classList.remove("show", "wrong");
  void feedback.offsetWidth;
  feedback.textContent = message;
  feedback.classList.toggle("wrong", wrong);
  feedback.classList.add("show");
}

function flashQuestion(kind) {
  const className = kind === "correct" ? "correct-flash" : "wrong-flash";
  questionCard.classList.remove("correct-flash", "wrong-flash");
  void questionCard.offsetWidth;
  questionCard.classList.add(className);
  window.setTimeout(() => questionCard.classList.remove(className), 460);
}

function handleHoleHit(index, event) {
  if (!game.running || game.paused || game.waveLocked) return;
  const hole = game.holes[index];
  if (!hole.classList.contains("active") || !hole.dataset.answer) return;
  game.waveLocked = true;
  window.clearTimeout(game.waveTimer);

  const chosen = Number(hole.dataset.answer);
  const correct = chosen === game.question.answer;
  game.holes.forEach((candidate, candidateIndex) => {
    candidate.disabled = true;
    if (candidateIndex !== index) candidate.classList.remove("active");
  });
  hole.querySelector("img").src = "assets/orange-cat-hit.png";
  hole.classList.add("hit", "active");
  makeTapImpact(event.clientX, event.clientY);

  if (correct) {
    game.score += 1;
    scoreValue.textContent = String(game.score);
    showFeedback("答對了！ +1");
    flashQuestion("correct");
    playCorrectSound();
    window.setTimeout(() => {
      if (!game.running) return;
      clearWave();
      if (game.score >= TARGET_SCORE) {
        finishLevel(true, "complete");
        return;
      }
      setQuestion(generateQuestion(), true);
      scheduleWave(240);
    }, 520);
  } else {
    game.hearts -= 1;
    renderHearts();
    showFeedback("再想一下！", true);
    flashQuestion("wrong");
    playWrongSound();
    window.setTimeout(() => {
      if (!game.running) return;
      clearWave();
      if (game.hearts <= 0) {
        finishLevel(false, "hearts");
        return;
      }
      scheduleWave(340);
    }, 580);
  }
}

function renderHearts() {
  heartsRoot.replaceChildren();
  for (let index = 0; index < MAX_HEARTS; index += 1) {
    const heart = document.createElement("span");
    heart.className = `heart${index >= game.hearts ? " lost" : ""}`;
    heart.textContent = index < game.hearts ? "♥" : "♡";
    heart.setAttribute("aria-hidden", "true");
    heartsRoot.append(heart);
  }
  heartsRoot.setAttribute("aria-label", `還有 ${game.hearts} 顆愛心`);
}

function startTicker() {
  window.clearInterval(game.ticker);
  game.lastTick = performance.now();
  game.ticker = window.setInterval(() => {
    const now = performance.now();
    const elapsed = now - game.lastTick;
    game.lastTick = now;
    if (!game.running || game.paused) return;
    game.timeMs = Math.max(0, game.timeMs - elapsed);
    const seconds = Math.ceil(game.timeMs / 1000);
    timerValue.textContent = String(seconds);
    timerValue.parentElement.classList.toggle("urgent", seconds <= 10);
    if (game.timeMs <= 0) finishLevel(false, "time");
  }, 100);
}

function startLevel(levelId) {
  const level = LEVELS[levelId - 1];
  if (!level || level.id > progress.unlocked) return;
  ensureAudio();
  game.token += 1;
  game.running = true;
  game.paused = false;
  game.level = level;
  game.score = 0;
  game.hearts = MAX_HEARTS;
  game.timeMs = GAME_SECONDS * 1000;
  game.lastQuestionKey = "";
  game.waveLocked = false;
  window.clearTimeout(resultReturnTimer);

  showScreen("game-screen");
  setOverlay("result", false);
  setOverlay("pause", false);
  document.querySelector("#game-level-number").textContent = `第 ${level.id} 關`;
  document.querySelector("#game-level-name").textContent = level.name;
  timerValue.textContent = String(GAME_SECONDS);
  scoreValue.textContent = "0";
  renderHearts();
  setQuestion(generateQuestion());
  startTicker();
  scheduleWave(450);
  playStartSound();
}

function stopGame() {
  game.token += 1;
  game.running = false;
  game.paused = false;
  window.clearTimeout(game.waveTimer);
  window.clearInterval(game.ticker);
  game.waveTimer = null;
  game.ticker = null;
  if (game.holes.length) clearWave();
  app.classList.remove("game-active");
}

function pauseGame() {
  if (!game.running || game.paused) return;
  game.paused = true;
  clearWave();
  setOverlay("pause", true);
}

function resumeGame() {
  if (!game.running) return;
  game.paused = false;
  game.lastTick = performance.now();
  setOverlay("pause", false);
  scheduleWave(250);
}

function calculateStars() {
  const seconds = Math.ceil(game.timeMs / 1000);
  if (game.hearts >= 4 && seconds >= 30) return 3;
  if (game.hearts >= 3 || seconds >= 15) return 2;
  return 1;
}

function finishLevel(success, reason) {
  if (!game.running) return;
  const level = game.level;
  const score = game.score;
  const hearts = game.hearts;
  const seconds = Math.ceil(game.timeMs / 1000);
  const stars = success ? calculateStars() : 0;
  stopGame();

  if (success) {
    progress.stars[level.id - 1] = Math.max(progress.stars[level.id - 1], stars);
    progress.unlocked = Math.max(progress.unlocked, Math.min(LEVELS.length, level.id + 1));
    selectedLevelId = Math.min(LEVELS.length, level.id + 1);
    saveProgress();
  } else {
    selectedLevelId = level.id;
  }

  const title = document.querySelector("#result-title");
  const kicker = document.querySelector("#result-kicker");
  const message = document.querySelector("#result-message");
  const starsRoot = document.querySelector("#result-stars");
  const resultCat = document.querySelector("#result-cat");
  const dialog = document.querySelector("#result-dialog");
  const mapButton = document.querySelector("#result-map-button");

  dialog.classList.toggle("failed", !success);
  resultCat.src = success ? "assets/orange-cat-master.png" : "assets/orange-cat-hit.png";
  kicker.textContent = success ? "列車到站" : "列車暫停";
  title.textContent = success ? (level.id === LEVELS.length ? "全線通車！" : "挑戰成功！") : "挑戰失敗";
  starsRoot.textContent = success ? "★".repeat(stars) + "☆".repeat(3 - stars) : "☆☆☆";
  starsRoot.setAttribute("aria-label", success ? `獲得 ${stars} 顆星` : "沒有取得星星");
  if (success) {
    message.textContent = level.id === LEVELS.length ? "你完成了全部九九乘法車站！" : "下一站已經開放。";
    mapButton.textContent = "回主地圖";
    playWinSound();
  } else {
    message.textContent = reason === "time" ? "時間到了，回地圖再整裝出發吧！" : "愛心用完了，回地圖再挑戰一次吧！";
    mapButton.textContent = "回主地圖（4）";
    playLoseSound();
  }
  document.querySelector("#result-stats").innerHTML = `
    <span class="result-stat">答對 ${score} 題</span>
    <span class="result-stat">剩下 ${seconds} 秒</span>
    <span class="result-stat">愛心 ${hearts} / ${MAX_HEARTS}</span>
  `;
  setOverlay("result", true);

  if (!success) {
    let countdown = 4;
    resultReturnTimer = window.setInterval(() => {
      countdown -= 1;
      mapButton.textContent = countdown > 0 ? `回主地圖（${countdown}）` : "回主地圖";
      if (countdown <= 0) {
        window.clearInterval(resultReturnTimer);
        closeResultToMap();
      }
    }, 1000);
  }
}

function closeResultToMap() {
  window.clearInterval(resultReturnTimer);
  setOverlay("result", false);
  showMap();
}

function ensureAudio() {
  if (!audioContext) {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (Context) audioContext = new Context();
  }
  if (audioContext?.state === "suspended") audioContext.resume().catch(() => {});
}

function playTone(frequency, duration, type = "sine", volume = 0.04, delay = 0) {
  if (progress.muted) return;
  ensureAudio();
  if (!audioContext) return;
  const start = audioContext.currentTime + delay;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function playStartSound() {
  playTone(392, 0.12, "triangle", 0.04);
  playTone(523, 0.15, "triangle", 0.04, 0.12);
}

function playCorrectSound() {
  playTone(659, 0.11, "sine", 0.05);
  playTone(880, 0.16, "sine", 0.05, 0.09);
}

function playWrongSound() {
  playTone(190, 0.18, "square", 0.035);
  playTone(150, 0.2, "square", 0.025, 0.12);
}

function playWinSound() {
  [523, 659, 784, 1047].forEach((tone, index) => playTone(tone, 0.2, "triangle", 0.045, index * 0.1));
}

function playLoseSound() {
  [330, 277, 220].forEach((tone, index) => playTone(tone, 0.22, "triangle", 0.035, index * 0.12));
}

function toggleSound() {
  progress.muted = !progress.muted;
  saveProgress();
  updateSoundButtons();
  if (!progress.muted) playTone(660, 0.08, "sine", 0.035);
}

function updateSoundButtons() {
  document.querySelectorAll(".sound-button").forEach((button) => {
    button.textContent = progress.muted ? "🔇" : "🔊";
    button.setAttribute("aria-label", progress.muted ? "開啟音效" : "關閉音效");
  });
}

function makeTapImpact(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || (x === 0 && y === 0)) return;
  const impact = document.createElement("span");
  impact.className = "tap-impact";
  impact.style.left = `${x}px`;
  impact.style.top = `${y}px`;
  document.body.append(impact);
  window.setTimeout(() => impact.remove(), 450);
}

function resetProgress() {
  progress = defaultProgress();
  selectedLevelId = 1;
  saveProgress();
  updateSoundButtons();
  renderMap();
  setOverlay("confirm", false);
  showToast("進度已重設，從第一站重新出發！");
}

document.querySelector("#start-button").addEventListener("click", () => {
  ensureAudio();
  showMap();
});
document.querySelector("#title-help-button").addEventListener("click", openTutorial);
document.querySelector("#map-help-button").addEventListener("click", openTutorial);
document.querySelector("#tutorial-close-button").addEventListener("click", closeTutorial);
document.querySelector("#enter-level-button").addEventListener("click", () => startLevel(selectedLevelId));
document.querySelector("#pause-button").addEventListener("click", pauseGame);
document.querySelector("#resume-button").addEventListener("click", resumeGame);
document.querySelector("#quit-button").addEventListener("click", () => {
  setOverlay("pause", false);
  showMap();
});
document.querySelector("#result-map-button").addEventListener("click", closeResultToMap);
document.querySelector("#reset-button").addEventListener("click", () => setOverlay("confirm", true));
document.querySelector("#confirm-reset-button").addEventListener("click", resetProgress);
document.querySelector("#cancel-reset-button").addEventListener("click", () => setOverlay("confirm", false));
document.querySelectorAll(".sound-button").forEach((button) => button.addEventListener("click", toggleSound));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && game.running) {
    if (game.paused) resumeGame();
    else pauseGame();
    return;
  }
  if (!game.running || game.paused || !/^[1-9]$/.test(event.key)) return;
  const index = Number(event.key) - 1;
  const hole = game.holes[index];
  if (!hole?.disabled) hole.click();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && game.running && !game.paused) pauseGame();
});

document.addEventListener("pointermove", (event) => {
  if (!app.classList.contains("game-active")) return;
  hammerCursor.style.left = `${event.clientX}px`;
  hammerCursor.style.top = `${event.clientY}px`;
});

document.addEventListener("pointerdown", () => {
  if (!app.classList.contains("game-active")) return;
  hammerCursor.classList.remove("swing");
  void hammerCursor.offsetWidth;
  hammerCursor.classList.add("swing");
});

window.addEventListener("beforeunload", saveProgress);

buildHoles();
renderMap();
updateSoundButtons();
showScreen("title-screen");

[
  "assets/orange-cat-hit.png",
  "assets/orange-cat-master.png",
  "assets/orange-cat-tutorial.png",
  "assets/toy-hammer.png",
  "assets/game-station-bg.png",
  "assets/world-map-bg.png",
].forEach((source) => {
  const image = new Image();
  image.src = source;
});
