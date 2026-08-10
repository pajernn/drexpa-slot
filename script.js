"use strict";

/*************************************************
 *
 * Drexpa Prize Machine Engine
 * Version 2.6 (Instant Code Check & Ultra Fast Spin)
 *
 *************************************************/

const WEBAPP_URL =
"https://script.google.com/macros/s/AKfycbxwyh1QIEsp1x4t3FjxfDI-FoBJDS4atEfR2-HKcxKbmzIzKlB6mglflHApzfEdY-PM/exec";

const PrizeMachine = {
    version: "2.6",
    initialized: false,
    spinning: false,
    state: "IDLE",
    animationFrame: null,
    currentPosition: 0,
    currentSpeed: 0,
    targetPosition: 0,
    targetPrize: null,
    prizes: [],
    settings: {},
    images: new Map(),
    dom: {},
    callbacks: {},
    resetTimer: null,
};

// HANGOK
PrizeMachine.audio = {
    spin: new Audio("sounds/spin.mp3"),
    winner: new Audio("sounds/winner.mp3"),
    fail: new Audio("sounds/fail.mp3")
};

/*************************************************
 * IMAGE MANAGER
 *************************************************/
PrizeMachine.preloadImages = async function() {
    this.log("Képek ellenőrzése...");
    this.images.clear();

    for (const prize of this.prizes) {
        this.images.set(prize.id, { src: prize.image });
    }
    this.log(this.images.size, "kép előkészítve");
};

/*************************************************
 * REEL BUILDER
 *************************************************/
PrizeMachine.clearTrack = function() {
    this.dom.slotTrack.innerHTML = "";
};

PrizeMachine.createImage = function(prize) {
    const img = document.createElement("img");
    img.className = "slotImage";
    const cached = this.images.get(prize.id);
    if (cached) {
        img.src = cached.src;
    }
    img.draggable = false;
    img.alt = prize.name;
    return img;
};

PrizeMachine.buildReel = function() {
    this.clearTrack();

    const repeat = Number(this.settings.repeatCount);

    for (let r = 0; r < repeat; r++) {
        for (const prize of this.prizes) {
            const image = this.createImage(prize);
            image.dataset.id = prize.id;
            image.dataset.name = prize.name;
            this.dom.slotTrack.appendChild(image);
        }
    }

    this.totalItems = this.dom.slotTrack.children.length;
    this.itemSize = Number(this.settings.itemWidth) + Number(this.settings.itemGap);
    this.trackLength = this.itemSize * this.totalItems;
    this.loopLength = this.itemSize * this.prizes.length;

    this.currentPosition = 0;
    this.updateTrack();

    this.log("Track:", this.totalItems, "elem");
};

/*************************************************
 * TRACK UPDATE
 *************************************************/
PrizeMachine.updateTrack = function() {
    const drawPosition = this.currentPosition % this.loopLength;
    this.dom.slotTrack.style.transform = `translate3d(${-drawPosition}px,0,0)`;
};

/*************************************************
 * LOOP ENGINE
 *************************************************/
PrizeMachine.normalize = function() {
    while (this.currentPosition >= this.loopLength) {
        this.currentPosition -= this.loopLength;
    }
    while (this.currentPosition < 0) {
        this.currentPosition += this.loopLength;
    }
};

/*************************************************
 * ANIMATION
 *************************************************/
PrizeMachine.animate = (time) => {
    if (!PrizeMachine.spinning) {
        PrizeMachine.animationFrame = null;
        return;
    }

    PrizeMachine.updateSpin(time);

    if (PrizeMachine.state === PrizeMachine.STATE.FINISHED) {
        PrizeMachine.finish();
        return;
    }

    PrizeMachine.normalize();
    PrizeMachine.updateTrack();

    PrizeMachine.animationFrame = requestAnimationFrame(PrizeMachine.animate);
};

/*************************************************
 * START & STOP
 *************************************************/
PrizeMachine.startAnimation = function() {
    this.spinning = true;
    this.animationFrame = requestAnimationFrame(this.animate);
};

PrizeMachine.stopAnimation = function() {
    this.spinning = false;
    if (this.animationFrame) {
        cancelAnimationFrame(this.animationFrame);
    }
};

/*************************************************
 * SPIN ENGINE & STATES
 *************************************************/
PrizeMachine.STATE = {
    IDLE: 0,
    ACCELERATING: 1,
    FULL_SPEED: 2,
    DECELERATING: 3,
    FINISHED: 4
};

PrizeMachine.state = PrizeMachine.STATE.IDLE;

PrizeMachine.setState = function(state) {
    this.state = state;
    this.log("STATE:", state);
};

PrizeMachine.canSpin = function() {
    return this.state === this.STATE.IDLE;
};

PrizeMachine.spin = function(prizeId) {
    if (!this.initialized) {
        throw new Error("Motor nincs inicializálva.");
    }

    // Előző eredmények törlése
    this.dom.centerFrame.classList.remove("winner");
    this.dom.centerFrame.classList.remove("fail");
    this.dom.resultTitle.innerHTML = "";
    this.dom.resultPrize.innerHTML = "";

    const confetti = document.getElementById("confetti");
    if (confetti) confetti.innerHTML = "";

    clearTimeout(this.resetTimer);
    this.dom.gameButtons.style.display = "none";

    if (!this.canSpin()) {
        return Promise.reject("Már pörög.");
    }

    // Hang hurok indítása
    this.audio.spin.currentTime = 0;
    this.audio.spin.loop = true;
    this.audio.spin.play().catch(() => {});

    this.targetPrize = this.prizes.find(p => Number(p.id) === Number(prizeId));

    if (!this.targetPrize) {
        throw new Error("Hibás Prize ID: " + prizeId);
    }

    this.currentSpeed = 0;
    this.startPosition = this.currentPosition;
    this.spinStartTime = performance.now();
    this.accelerationStart = performance.now();

    this.setState(this.STATE.ACCELERATING);
    this.startAnimation();

    return new Promise(resolve => {
        this.spinResolve = resolve;
    });
};

PrizeMachine.updateSpin = function(time) {
    switch (this.state) {
        case this.STATE.ACCELERATING:
            this.updateAcceleration(time);
            break;
        case this.STATE.FULL_SPEED:
            this.updateFullSpeed(time);
            break;
        case this.STATE.DECELERATING:
            this.updateDeceleration(time);
            break;
        case this.STATE.FINISHED:
            this.finish();
            break;
    }
};

PrizeMachine.updateAcceleration = function(time) {
    const elapsed = time - this.accelerationStart;
    const accelTime = 300;
    const progress = Math.min(1, elapsed / accelTime);

    const eased = progress * progress;
    this.currentSpeed = this.settings.maxSpeed * eased;
    this.currentPosition += this.currentSpeed;

    if (progress >= 1) {
        this.currentSpeed = this.settings.maxSpeed;
        this.setState(this.STATE.FULL_SPEED);
    }
};

PrizeMachine.updateFullSpeed = function(time) {
    this.currentPosition += this.settings.maxSpeed;

    const totalElapsed = time - this.spinStartTime;
    const targetDecelTime = Number(this.settings.deceleration);

    if (totalElapsed >= (this.settings.spinDuration - targetDecelTime)) {
        this.calculateTargetPosition();
        this.decelerationStart = performance.now();
        this.startPosition = this.currentPosition;
        this.setState(this.STATE.DECELERATING);
    }
};

PrizeMachine.updateDeceleration = function(time) {
    const elapsed = time - this.decelerationStart;
    const decelTime = Number(this.settings.deceleration);
    const progress = Math.min(1, elapsed / decelTime);

    const eased = 1 - Math.pow(1 - progress, 3);
    this.currentPosition = this.startPosition + (this.targetPosition - this.startPosition) * eased;

    if (progress >= 1) {
        this.currentPosition = this.targetPosition;
        this.currentSpeed = 0;
        this.setState(this.STATE.FINISHED);
    }
};

PrizeMachine.calculateTargetPosition = function() {
    const itemWidth = Number(this.settings.itemWidth);
    const itemGap = Number(this.settings.itemGap);
    const itemSize = itemWidth + itemGap;
    const loopLength = this.prizes.length * itemSize;
    const containerCenter = 1180 / 2;

    const estimatedDecelDistance = (this.settings.maxSpeed * (this.settings.deceleration / 16.6667)) * 0.45;
    const estimatedStopPos = this.currentPosition + estimatedDecelDistance;

    const indexes = [];
    this.prizes.forEach((p, index) => {
        if (Number(p.id) === Number(this.targetPrize.id)) {
            indexes.push(index);
        }
    });

    let bestPosition = null;
    let minDiff = Number.MAX_SAFE_INTEGER;

    indexes.forEach(index => {
        const itemCenterOnTrack = (index * itemSize) + (itemWidth / 2) + 40;
        let baseTarget = itemCenterOnTrack - containerCenter;

        while (baseTarget < estimatedStopPos - (loopLength / 2)) {
            baseTarget += loopLength;
        }

        const diff = Math.abs(baseTarget - estimatedStopPos);
        if (diff < minDiff) {
            minDiff = diff;
            bestPosition = baseTarget;
        }
    });

    this.targetPosition = bestPosition;
};

PrizeMachine.finish = function() {
    this.currentPosition = this.targetPosition;
    this.updateTrack();
    this.stopAnimation();

    this.audio.spin.pause();
    this.audio.spin.loop = false;
    this.audio.spin.currentTime = 0;

    this.state = this.STATE.IDLE;
    this.dom.centerFrame.classList.remove("winner");
    this.dom.centerFrame.classList.remove("fail");

    if (Number(this.targetPrize.id) === 0) {
        this.dom.centerFrame.classList.add("fail");
        this.audio.fail.currentTime = 0;
        this.audio.fail.play().catch(() => {});
        this.dom.resultTitle.innerHTML = "😢 MOST NEM NYERTÉL";
    } else {
        this.dom.centerFrame.classList.add("winner");
        this.audio.winner.currentTime = 0;
        this.audio.winner.play().catch(() => {});
        this.dom.resultTitle.innerHTML = "🎉 NYERTÉL! 🎉";
        this.startConfetti();
    }

    this.dom.resultPrize.innerHTML = this.targetPrize.name;

    if (this.spinResolve) {
        this.spinResolve(this.targetPrize);
        this.spinResolve = null;
    }

    // App Inventor értesítése a nyereményről
    if (window.AppInventor && window.AppInventor.setWebViewString) {
        window.AppInventor.setWebViewString(JSON.stringify({
            event: "winner",
            id: this.targetPrize.id,
            name: this.targetPrize.name
        }));
    }

    setTimeout(() => {
        this.dom.gameButtons.style.display = "flex";
    }, 3000);

    clearTimeout(this.resetTimer);
    this.resetTimer = setTimeout(() => {
        if (window.AppInventor && window.AppInventor.setWebViewString) {
            window.AppInventor.setWebViewString("BACK");
        } else {
            this.resetGame();
        }
    }, 15000);
};

PrizeMachine.stop = function() {
    this.stopAnimation();
    this.audio.spin.pause();
    this.audio.spin.loop = false;
    this.currentSpeed = 0;
    this.state = this.STATE.IDLE;
};

PrizeMachine.reset = function() {
    this.stop();
    this.currentPosition = 0;
    this.targetPosition = 0;
    this.targetPrize = null;
    this.updateTrack();
    this.dom.resultTitle.innerHTML = "";
    this.dom.resultPrize.innerHTML = "";
};

PrizeMachine.applySettings = function() {
    const s = this.settings;

    this.settings.repeatCount = Number(s.repeatCount || s["repeatCount"] || 8);
    this.settings.itemWidth = Number(s.itemWidth || s["itemWidth"] || 180);
    this.settings.itemGap = Number(s.itemGap || s["itemGap"] || 30);
    this.settings.maxSpeed = Number(s.maxSpeed || s["maxSpeed"] || 45);
    this.settings.deceleration = Number(s.deceleration || s["deceleration"] || 3000);

    const spinSec = Number(s["Pörgetési idő (mp)"] || s.spinDuration || 6);
    this.settings.spinDuration = spinSec * 1000;

    if (s.backgroundImage) {
        document.body.style.backgroundImage = "url('" + s.backgroundImage + "')";
        document.body.style.backgroundSize = "cover";
        document.body.style.backgroundPosition = "center";
    }

    if (s.logoImage) {
        const logo = document.getElementById("logo");
        if (logo) logo.src = s.logoImage;
    }

    this.log("Beállítások alkalmazva:", this.settings);
};

PrizeMachine.log = function(...args) {
    console.log("[PrizeMachine]", ...args);
};

PrizeMachine.initDOM = function() {
    this.dom.slotContainer = document.getElementById("slotContainer");
    this.dom.slotTrack = document.getElementById("slotTrack");
    this.dom.centerFrame = document.getElementById("centerFrame");
    this.dom.resultTitle = document.getElementById("resultTitle");
    this.dom.resultPrize = document.getElementById("resultPrize");
    this.dom.gameButtons = document.getElementById("gameButtons");
    this.dom.newCodeBtn = document.getElementById("newCodeBtn");
};

PrizeMachine.load = async function() {
    this.log("API betöltés...");
    const response = await fetch(WEBAPP_URL + "?action=init", { cache: "no-store" });
    const json = await response.json();

    if (json.status !== "OK") {
        throw new Error(json.message);
    }

    this.settings = json.data.settings;
    this.prizes = json.data.prizes;
};

PrizeMachine.init = async function() {
    console.time("INIT");
    this.initDOM();
    await this.load();
    this.applySettings();
    await this.preloadImages();
    this.buildReel();

    this.dom.newCodeBtn.onclick = () => {
        if (window.AppInventor && window.AppInventor.setWebViewString) {
            window.AppInventor.setWebViewString("BACK");
        }
        this.resetGame();
    };

    this.initialized = true;
    this.log("READY");
    console.timeEnd("INIT");
};

PrizeMachine.startConfetti = function() {
    const container = document.getElementById("confetti");
    if (!container) return;
    container.innerHTML = "";

    for (let i = 0; i < 80; i++) {
        const piece = document.createElement("div");
        piece.style.position = "absolute";
        piece.style.width = "10px";
        piece.style.height = "10px";
        piece.style.left = Math.random() * 100 + "%";
        piece.style.top = "-20px";
        piece.style.background = ["#ff0000", "#00ff00", "#0088ff", "#ffd700", "#ff00ff"][Math.floor(Math.random() * 5)];
        piece.style.transform = "rotate(" + Math.random() * 360 + "deg)";
        piece.style.animation = "confettiFall " + (2 + Math.random() * 2) + "s linear";
        container.appendChild(piece);
    }

    setTimeout(() => { container.innerHTML = ""; }, 5000);
};

PrizeMachine.resetGame = function() {
    this.stop();
    this.currentPosition = 0;
    this.targetPosition = 0;
    this.targetPrize = null;
    this.updateTrack();

    clearTimeout(this.resetTimer);
    this.dom.gameButtons.style.display = "none";
    this.dom.resultTitle.innerHTML = "";
    this.dom.resultPrize.innerHTML = "";
    this.dom.centerFrame.classList.remove("winner");
    this.dom.centerFrame.classList.remove("fail");

    const confetti = document.getElementById("confetti");
    if (confetti) confetti.innerHTML = "";

    if (window.AppInventor && window.AppInventor.setWebViewString) {
        window.AppInventor.setWebViewString("BACK");
    }
};

/*******************************************************
 * KÓD BEKÜLDÉSE, ELLENŐRZÉSE ÉS HOMOKÓRA LOGIKA
 *******************************************************/
async function submitCode() {
  const inputEl = document.getElementById("codeInput");
  const btnEl = document.getElementById("spinBtn");
  const btnText = document.getElementById("btnText");
  const btnLoader = document.getElementById("btnLoader");
  const msgEl = document.getElementById("codeMessage");

  if (!inputEl || !btnEl) return;

  // ⚡ MOBIL BILLENTYŰZET BEZÁRÁSA
  inputEl.blur();

  const code = inputEl.value.trim();

  // 1. Üres kód ellenőrzése
  if (!code) {
    msgEl.style.color = "#ff4444";
    msgEl.innerText = "Kérlek, írj be egy kódot!";
    return;
  }

  // 2. Gomb zárolása + Homokóra animáció bekapcsolása
  btnEl.disabled = true;
  inputEl.disabled = true;
  btnText.innerText = "Ellenőrzés ";
  btnLoader.classList.remove("hidden");
  msgEl.innerText = "";

  try {
    // 3. Gyors kérés a Google Apps Script felé
    const response = await fetch(WEBAPP_URL + "?action=checkCode&code=" + encodeURIComponent(code));
    const json = await response.json();

    // 4. Sikeres válasz kezelése
    if (json.status === "OK" && json.prizeId !== undefined) {
      msgEl.style.color = "#00ffcc";
      msgEl.innerText = "Sikeres kód! Pörgetés...";

      // Kódbeíró ablak elhalványítása (fade-out)
      setTimeout(() => {
        const codeContainer = document.getElementById("codeContainer");
        if (codeContainer) codeContainer.classList.add("fade-out");
      }, 300);

      // PÖRGETÉS INDÍTÁSA A KISORSOLT NYEREMÉNY ID-VAL
      PrizeMachine.spin(json.prizeId);

    } else {
      // Érvénytelen vagy már felhasznált kód
      msgEl.style.color = "#ff4444";
      msgEl.innerText = json.message || "Érvénytelen kód!";
      
      resetForm();
    }

  } catch (err) {
    console.error("Hiba az ellenőrzés során:", err);
    msgEl.style.color = "#ff4444";
    msgEl.innerText = "Hálózati hiba! Próbáld újra.";

    resetForm();
  }
}

// Űrlap alaphelyzetbe állítása hiba esetén
function resetForm() {
  const inputEl = document.getElementById("codeInput");
  const btnEl = document.getElementById("spinBtn");
  const btnText = document.getElementById("btnText");
  const btnLoader = document.getElementById("btnLoader");

  if (btnEl) btnEl.disabled = false;
  if (inputEl) inputEl.disabled = false;
  if (btnText) btnText.innerText = "PÖRGETÉS";
  if (btnLoader) btnLoader.classList.add("hidden");
}

/*******************************************************
 * INICIALIZÁLÁS AZ OLDAL BETÖLTÉSEKOR
 *******************************************************/
document.addEventListener("DOMContentLoaded", () => {
  // Gép indítása
  if (typeof PrizeMachine !== "undefined" && PrizeMachine.init) {
    PrizeMachine.init();
  }

  // ENTER gomb figyelése az input mezőben
  const inputEl = document.getElementById("codeInput");
  if (inputEl) {
    inputEl.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        submitCode();
      }
    });
  }
});