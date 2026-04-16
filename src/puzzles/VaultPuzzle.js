import AlarmSystem from '../systems/AlarmSystem.js';

const SYMBOLS = ['★', '◆', '▲', '●', '■'];
const TIMER_DURATION = 60; // seconds

// Inject success animation CSS once
let styleInjected = false;
function injectStyles() {
  if (styleInjected) return;
  styleInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes vaultSuccess {
      0%   { transform: scale(1); }
      50%  { transform: scale(1.05); background: #1a4a1a; }
      100% { transform: scale(1); }
    }
  `;
  document.head.appendChild(style);
}

export class VaultPuzzle {
  constructor() {
    this._overlay = null;
    this._panel = null;
    this._timerEl = null;
    this._inputSlots = [];
    this._feedbackEl = null;

    this._target = [];
    this._input = [];
    this._vault = null;
    this._onClose = null;

    this._rafId = null;
    this._timeLeft = TIMER_DURATION;
    this._lastTimestamp = null;
  }

  /** Pure validation: returns true iff input matches target element-by-element */
  validate(input, target) {
    return input.length === 4 && input.every((s, i) => s === target[i]);
  }

  open(vault, onClose) {
    injectStyles();

    this._vault = vault;
    this._onClose = onClose;
    this._target = Array.from({ length: 4 }, () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
    this._input = [];
    this._timeLeft = TIMER_DURATION;
    this._lastTimestamp = null;

    this._buildUI();
    this._startTimer();
  }

  close() {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    if (this._overlay && this._overlay.parentNode) {
      this._overlay.parentNode.removeChild(this._overlay);
    }
    this._overlay = null;
    this._panel = null;
    this._timerEl = null;
    this._inputSlots = [];
    this._feedbackEl = null;

    if (this._onClose) {
      this._onClose();
      this._onClose = null;
    }
  }

  // ─── UI Construction ────────────────────────────────────────────────────────

  _buildUI() {
    // Overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:1000;display:flex;align-items:center;justify-content:center;';
    this._overlay = overlay;

    // Panel
    const panel = document.createElement('div');
    panel.style.cssText = 'background:#111;border:1px solid #666;border-radius:8px;padding:32px 40px;min-width:360px;text-align:center;font-family:monospace;color:#fff;';
    this._panel = panel;

    // Title
    const title = document.createElement('div');
    title.textContent = 'VAULT ACCESS PANEL';
    title.style.cssText = 'font-size:18px;font-weight:bold;color:#f0a500;letter-spacing:2px;margin-bottom:20px;';
    panel.appendChild(title);

    // Timer
    const timerEl = document.createElement('div');
    timerEl.style.cssText = 'font-size:36px;font-weight:bold;margin-bottom:20px;letter-spacing:4px;';
    timerEl.textContent = '01:00';
    this._timerEl = timerEl;
    panel.appendChild(timerEl);

    // Target hint row
    const hintRow = document.createElement('div');
    hintRow.style.cssText = 'display:flex;justify-content:center;gap:8px;margin-bottom:16px;';
    for (let i = 0; i < 4; i++) {
      const slot = document.createElement('div');
      slot.textContent = '?';
      slot.style.cssText = 'width:40px;height:40px;line-height:40px;background:#222;border:1px solid #444;border-radius:4px;font-size:20px;color:#555;';
      hintRow.appendChild(slot);
    }
    panel.appendChild(hintRow);

    // Input slots
    const inputRow = document.createElement('div');
    inputRow.style.cssText = 'display:flex;justify-content:center;gap:8px;margin-bottom:20px;';
    this._inputSlots = [];
    for (let i = 0; i < 4; i++) {
      const slot = document.createElement('div');
      slot.style.cssText = 'width:48px;height:48px;line-height:48px;background:#1a1a1a;border:1px solid #555;border-radius:4px;font-size:24px;text-align:center;';
      slot.textContent = '·';
      this._inputSlots.push(slot);
      inputRow.appendChild(slot);
    }
    panel.appendChild(inputRow);

    // Symbol picker
    const picker = document.createElement('div');
    picker.style.cssText = 'display:flex;justify-content:center;gap:8px;margin-bottom:20px;flex-wrap:wrap;';
    for (const sym of SYMBOLS) {
      const btn = document.createElement('button');
      btn.textContent = sym;
      btn.style.cssText = 'background:#222;color:#fff;font-size:24px;padding:12px 16px;border:1px solid #555;border-radius:4px;cursor:pointer;';
      btn.addEventListener('click', () => this._pickSymbol(sym));
      picker.appendChild(btn);
    }
    panel.appendChild(picker);

    // Action buttons
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;justify-content:center;gap:12px;margin-bottom:16px;';

    const submitBtn = document.createElement('button');
    submitBtn.textContent = 'SUBMIT';
    submitBtn.style.cssText = 'background:#1a3a1a;color:#4f4;font-size:14px;padding:10px 24px;border:1px solid #4f4;border-radius:4px;cursor:pointer;letter-spacing:1px;';
    submitBtn.addEventListener('click', () => this._submit());

    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'RESET';
    resetBtn.style.cssText = 'background:#2a1a1a;color:#f44;font-size:14px;padding:10px 24px;border:1px solid #f44;border-radius:4px;cursor:pointer;letter-spacing:1px;';
    resetBtn.addEventListener('click', () => this._resetInput());

    actions.appendChild(submitBtn);
    actions.appendChild(resetBtn);
    panel.appendChild(actions);

    // Feedback
    const feedback = document.createElement('div');
    feedback.style.cssText = 'font-size:14px;min-height:20px;letter-spacing:1px;';
    this._feedbackEl = feedback;
    panel.appendChild(feedback);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  }

  // ─── Input Handling ──────────────────────────────────────────────────────────

  _pickSymbol(sym) {
    if (this._input.length >= 4) return;
    this._input.push(sym);
    this._updateInputSlots();
  }

  _resetInput() {
    this._input = [];
    this._updateInputSlots();
    this._setFeedback('', '');
  }

  _updateInputSlots() {
    for (let i = 0; i < 4; i++) {
      this._inputSlots[i].textContent = this._input[i] ?? '·';
    }
  }

  // ─── Submission ──────────────────────────────────────────────────────────────

  _submit() {
    if (this._input.length < 4) {
      this._setFeedback('Select 4 symbols first.', '#f88');
      return;
    }

    if (this.validate(this._input, this._target)) {
      this._onSuccess();
    } else {
      this._onWrongSubmit();
    }
  }

  _onSuccess() {
    // Stop timer
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }

    this._setFeedback('✔ VAULT UNLOCKED', '#4f4');
    this._panel.style.animation = 'vaultSuccess 0.6s ease-in-out';

    if (this._vault) this._vault.unlock();

    setTimeout(() => this.close(), 2000);
  }

  _onWrongSubmit() {
    this._setFeedback('✘ INCORRECT SEQUENCE', '#f44');
    this._panel.style.border = '1px solid #f44';
    this._resetInput();
    setTimeout(() => {
      if (this._panel) this._panel.style.border = '1px solid #666';
      this._setFeedback('', '');
    }, 800);
  }

  _setFeedback(text, color) {
    if (!this._feedbackEl) return;
    this._feedbackEl.textContent = text;
    this._feedbackEl.style.color = color;
  }

  // ─── Timer ───────────────────────────────────────────────────────────────────

  _startTimer() {
    this._lastTimestamp = null;
    const tick = (timestamp) => {
      if (this._lastTimestamp === null) this._lastTimestamp = timestamp;
      const delta = (timestamp - this._lastTimestamp) / 1000;
      this._lastTimestamp = timestamp;

      this._timeLeft = Math.max(0, this._timeLeft - delta);
      this._renderTimer();

      if (this._timeLeft <= 0) {
        this._onTimeout();
        return;
      }

      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  }

  _renderTimer() {
    if (!this._timerEl) return;
    const total = Math.ceil(this._timeLeft);
    const mm = String(Math.floor(total / 60)).padStart(2, '0');
    const ss = String(total % 60).padStart(2, '0');
    this._timerEl.textContent = `${mm}:${ss}`;
    this._timerEl.style.color = this._timeLeft < 10 ? '#f44' : '#fff';
  }

  _onTimeout() {
    this._rafId = null;
    AlarmSystem.increase(1);
    this._resetInput();
    this._setFeedback('⚠ TIME OUT — ALARM RAISED', '#f88');
    this._timeLeft = TIMER_DURATION;
    setTimeout(() => {
      this._setFeedback('', '');
      this._startTimer();
    }, 1500);
  }
}
