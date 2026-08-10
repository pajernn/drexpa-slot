"use strict";

const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbxwyh1QIEsp1x4t3FjxfDI-FoBJDS4atEfR2-HKcxKbmzIzKlB6mglflHApzfEdY-PM/exec";

// Kódellenőrzés és beküldés
async function handleCodeSubmit() {
  const inputEl = document.getElementById("codeInput");
  const btnEl = document.getElementById("spinBtn");
  const btnText = document.getElementById("btnText");
  const btnLoader = document.getElementById("btnLoader");
  const msgEl = document.getElementById("codeMessage");

  if (!inputEl) return;
  const code = inputEl.value.trim();

  if (!code) {
    if (msgEl) {
      msgEl.style.color = "#ff4444";
      msgEl.innerText = "Kérlek, írj be egy kódot!";
    }
    return;
  }

  // UI zárolás
  if (btnEl) btnEl.disabled = true;
  inputEl.disabled = true;
  if (btnText) btnText.innerText = "Ellenőrzés ";
  if (btnLoader) btnLoader.classList.remove("hidden");
  if (msgEl) msgEl.innerText = "";

  try {
    const response = await fetch(`${WEBAPP_URL}?action=checkCode&code=${encodeURIComponent(code)}`);
    const json = await response.json();

    if (json.status === "OK" && json.prizeId !== undefined) {
      if (msgEl) {
        msgEl.style.color = "#00ffcc";
        msgEl.innerText = "Sikeres kód! Pörgetés...";
      }

      setTimeout(() => {
        document.getElementById("codeContainer").classList.add("hidden");
        document.getElementById("machineContainer").classList.remove("hidden");
        PrizeMachine.spin(json.prizeId);
      }, 500);

    } else {
      if (msgEl) {
        msgEl.style.color = "#ff4444";
        msgEl.innerText = json.message || "Érvénytelen kód!";
      }
      resetForm();
    }

  } catch (err) {
    console.error("Hiba:", err);
    if (msgEl) {
      msgEl.style.color = "#ff4444";
      msgEl.innerText = "Hálózati hiba! Próbáld újra.";
    }
    resetForm();
  }

  function resetForm() {
    if (btnEl) btnEl.disabled = false;
    if (inputEl) inputEl.disabled = false;
    if (btnText) btnText.innerText = "PÖRGETÉS";
    if (btnLoader) btnLoader.classList.add("hidden");
  }
}

// Nyilvánossá tesszük a biztonság kedvéért
window.useCode = handleCodeSubmit;
window.submitCode = handleCodeSubmit;

/*************************************************
 * PrizeMachine Engine
 *************************************************/
const PrizeMachine = {
  initialized: false,
  spinning: false,
  state: 0,
  currentPosition: 0,
  targetPosition: 0,
  targetPrize: null,
  prizes: [],
  settings: {},
  dom: {},

  audio: {
    spin: new Audio("sounds/spin.mp3"),
    winner: new Audio("sounds/winner.mp3"),
    fail: new Audio("sounds/fail.mp3")
  },

  async init() {
    this.dom.slotTrack = document.getElementById("slotTrack");
    this.dom.resultTitle = document.getElementById("resultTitle");
    this.dom.resultPrize = document.getElementById("resultPrize");
    this.dom.gameButtons = document.getElementById("gameButtons");

    try {
      const res = await fetch(`${WEBAPP_URL}?action=init`);
      const json = await res.json();
      if (json.status === "OK") {
        this.settings = json.data.settings;
        this.prizes = json.data.prizes;
        this.applySettings();
        this.buildReel();
        this.initialized = true;
      }
    } catch (e) {
      console.error("Init hiba:", e);
    }
  },

  applySettings() {
    this.itemWidth = Number(this.settings.itemWidth || 180);
    this.itemGap = Number(this.settings.itemGap || 30);
    this.maxSpeed = Number(this.settings.maxSpeed || 40);
    this.decelTime = Number(this.settings.deceleration || 3000);
    this.spinDuration = (Number(this.settings.spinDuration) || 5) * 1000;
  },

  buildReel() {
    if (!this.dom.slotTrack) return;
    this.dom.slotTrack.innerHTML = "";
    const repeat = 8;

    for (let r = 0; r < repeat; r++) {
      for (const prize of this.prizes) {
        const img = document.createElement("img");
        img.className = "slotImage";
        img.src = prize.image;
        img.alt = prize.name;
        this.dom.slotTrack.appendChild(img);
      }
    }

    this.itemSize = this.itemWidth + this.itemGap;
    this.loopLength = this.itemSize * this.prizes.length;
    this.updateTrack();
  },

  updateTrack() {
    if (this.dom.slotTrack) {
      const drawPos = this.currentPosition % this.loopLength;
      this.dom.slotTrack.style.transform = `translate3d(${-drawPos}px,0,0)`;
    }
  },

  spin(prizeId) {
    if (!this.initialized) return;
    this.targetPrize = this.prizes.find(p => Number(p.id) === Number(prizeId));
    if (!this.targetPrize) return;

    this.spinning = true;
    this.audio.spin.currentTime = 0;
    this.audio.spin.loop = true;
    this.audio.spin.play().catch(() => {});

    const startTime = performance.now();
    const startPos = this.currentPosition;
    
    // Pontos célpozíció kiszámítása a keret közepére (330px keretszélességgel)
    const prizeIndex = this.prizes.findIndex(p => Number(p.id) === Number(prizeId));
    const containerCenter = 330 / 2;
    const itemCenter = (prizeIndex * this.itemSize) + (this.itemWidth / 2);
    
    // Szimulált pörgetési távolság
    const targetOffset = itemCenter - containerCenter;
    const extraLoops = 4 * this.loopLength;
    this.targetPosition = startPos + extraLoops + targetOffset;

    const animate = (now) => {
      const elapsed = now - startTime;

      if (elapsed < this.spinDuration) {
        const progress = elapsed / this.spinDuration;
        // Easing funkció a lassuláshoz
        const easeOut = 1 - Math.pow(1 - progress, 3);
        this.currentPosition = startPos + (this.targetPosition - startPos) * easeOut;
        this.updateTrack();
        requestAnimationFrame(animate);
      } else {
        this.currentPosition = this.targetPosition;
        this.updateTrack();
        this.finish();
      }
    };

    requestAnimationFrame(animate);
  },

  finish() {
    this.spinning = false;
    this.audio.spin.pause();

    if (Number(this.targetPrize.id) === 0) {
      this.audio.fail.play().catch(() => {});
      if (this.dom.resultTitle) this.dom.resultTitle.innerHTML = "😢 MOST NEM NYERTÉL";
    } else {
      this.audio.winner.play().catch(() => {});
      if (this.dom.resultTitle) this.dom.resultTitle.innerHTML = "🎉 NYERTÉL! 🎉";
    }

    if (this.dom.resultPrize) this.dom.resultPrize.innerText = this.targetPrize.name;
    if (this.dom.gameButtons) this.dom.gameButtons.classList.remove("hidden");
  },

  resetGame() {
    document.getElementById("machineContainer").classList.add("hidden");
    document.getElementById("codeContainer").classList.remove("hidden");
    document.getElementById("codeInput").disabled = false;
    document.getElementById("codeInput").value = "";
    document.getElementById("spinBtn").disabled = false;
    document.getElementById("btnText").innerText = "PÖRGETÉS";
    document.getElementById("btnLoader").classList.add("hidden");
    document.getElementById("codeMessage").innerText = "";
    if (this.dom.gameButtons) this.dom.gameButtons.classList.add("hidden");
  }
};

// Eseménykezelők hozzárendelése betöltés után
document.addEventListener("DOMContentLoaded", () => {
  PrizeMachine.init();

  const spinBtn = document.getElementById("spinBtn");
  const codeInput = document.getElementById("codeInput");
  const newCodeBtn = document.getElementById("newCodeBtn");

  if (spinBtn) {
    spinBtn.addEventListener("click", (e) => {
      e.preventDefault();
      handleCodeSubmit();
    });
  }

  if (codeInput) {
    codeInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleCodeSubmit();
      }
    });
  }

  if (newCodeBtn) {
    newCodeBtn.addEventListener("click", () => {
      PrizeMachine.resetGame();
    });
  }
});