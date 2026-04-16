/**
 * LaserPuzzle.js — Pattern-matching HTML overlay puzzle for the laser disable panel.
 *
 * Displays a 4-cell target pattern of colored squares (red/green/blue).
 * Player must click the color buttons in the correct order to match the pattern.
 * On success, deactivates all lasers in the zone.
 *
 * Requirements: 8.4, 8.5
 */

/** @typedef {import('../entities/Laser.js').Laser} Laser */

const COLORS = {
  red:   '#ff3333',
  green: '#33ff66',
  blue:  '#3399ff',
};

const EMPTY_COLOR = '#333';
const PATTERN_LENGTH = 4;

export class LaserPuzzle {
  /** @type {HTMLElement|null} */
  #overlay = null;

  /** @type {Laser[]} */
  #lasers = [];

  /** @type {string[]} */
  #targetPattern = [];

  /** @type {string[]} */
  #inputPattern = [];

  /** @type {Function|null} */
  #onClose = null;

  /**
   * @param {Laser[]} lasers - All lasers in the zone to deactivate on success
   */
  constructor(lasers) {
    this.#lasers = lasers;
  }

  /**
   * Open the puzzle overlay.
   * @param {Function} [onClose] - Called when the puzzle is closed (success or dismiss)
   */
  open(onClose = null) {
    if (this.#overlay) return;
    this.#onClose = onClose;
    this.#generate();
    this.#inputPattern = [];
    this.#render();
  }

  /**
   * Remove the overlay from the DOM.
   */
  close() {
    if (this.#overlay) {
      this.#overlay.remove();
      this.#overlay = null;
    }
    if (this.#onClose) {
      this.#onClose();
      this.#onClose = null;
    }
  }

  /**
   * Generate a random 4-color target pattern from red/green/blue.
   */
  #generate() {
    const colorKeys = Object.keys(COLORS);
    this.#targetPattern = Array.from({ length: PATTERN_LENGTH }, () =>
      colorKeys[Math.floor(Math.random() * colorKeys.length)]
    );
  }

  /**
   * Build/update the DOM overlay.
   */
  #render() {
    // Remove existing overlay if present
    if (this.#overlay) {
      this.#overlay.remove();
    }

    // ── Overlay backdrop ────────────────────────────────────────────────────
    const overlay = document.createElement('div');
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'background:rgba(0,0,0,0.75)',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'z-index:1000',
      'font-family:monospace',
    ].join(';');
    this.#overlay = overlay;

    // ── Panel box ───────────────────────────────────────────────────────────
    const panel = document.createElement('div');
    panel.style.cssText = [
      'background:#111',
      'border:2px solid #555',
      'border-radius:8px',
      'padding:28px 36px',
      'min-width:320px',
      'text-align:center',
      'color:#eee',
    ].join(';');

    // Title
    const title = document.createElement('h2');
    title.textContent = 'LASER DISABLE PANEL';
    title.style.cssText = [
      'margin:0 0 20px',
      'font-size:16px',
      'letter-spacing:2px',
      'color:#ff9900',
    ].join(';');
    panel.appendChild(title);

    // ── Target pattern label ────────────────────────────────────────────────
    const targetLabel = document.createElement('div');
    targetLabel.textContent = 'TARGET PATTERN';
    targetLabel.style.cssText = 'font-size:11px;letter-spacing:1px;color:#aaa;margin-bottom:8px;';
    panel.appendChild(targetLabel);

    // ── Target pattern row ──────────────────────────────────────────────────
    const targetRow = document.createElement('div');
    targetRow.style.cssText = 'display:flex;gap:8px;justify-content:center;margin-bottom:20px;';
    this.#targetPattern.forEach(colorKey => {
      const cell = document.createElement('div');
      cell.style.cssText = [
        `width:50px`,
        `height:50px`,
        `display:inline-block`,
        `background:${COLORS[colorKey]}`,
        `border-radius:4px`,
        `border:2px solid rgba(255,255,255,0.2)`,
      ].join(';');
      targetRow.appendChild(cell);
    });
    panel.appendChild(targetRow);

    // ── Input label ─────────────────────────────────────────────────────────
    const inputLabel = document.createElement('div');
    inputLabel.textContent = 'YOUR INPUT';
    inputLabel.style.cssText = 'font-size:11px;letter-spacing:1px;color:#aaa;margin-bottom:8px;';
    panel.appendChild(inputLabel);

    // ── Input row ───────────────────────────────────────────────────────────
    const inputRow = document.createElement('div');
    inputRow.id = 'lp-input-row';
    inputRow.style.cssText = 'display:flex;gap:8px;justify-content:center;margin-bottom:20px;';
    for (let i = 0; i < PATTERN_LENGTH; i++) {
      const slot = document.createElement('div');
      const filled = this.#inputPattern[i];
      slot.style.cssText = [
        `width:50px`,
        `height:50px`,
        `display:inline-block`,
        `background:${filled ? COLORS[filled] : EMPTY_COLOR}`,
        `border-radius:4px`,
        `border:2px solid rgba(255,255,255,0.15)`,
        `transition:background 0.15s`,
      ].join(';');
      inputRow.appendChild(slot);
    }
    panel.appendChild(inputRow);

    // ── Color buttons ───────────────────────────────────────────────────────
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:10px;justify-content:center;margin-bottom:14px;';
    Object.entries(COLORS).forEach(([colorKey, hex]) => {
      const btn = document.createElement('button');
      btn.textContent = colorKey.charAt(0).toUpperCase() + colorKey.slice(1);
      btn.style.cssText = [
        `background:${hex}`,
        'color:#000',
        'border:none',
        'border-radius:4px',
        'padding:10px 18px',
        'font-family:monospace',
        'font-size:13px',
        'font-weight:bold',
        'cursor:pointer',
        'letter-spacing:1px',
      ].join(';');
      btn.addEventListener('click', () => this.#handleInput(colorKey));
      btnRow.appendChild(btn);
    });
    panel.appendChild(btnRow);

    // ── Reset button ────────────────────────────────────────────────────────
    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'Reset';
    resetBtn.style.cssText = [
      'background:#444',
      'color:#eee',
      'border:none',
      'border-radius:4px',
      'padding:8px 20px',
      'font-family:monospace',
      'font-size:12px',
      'cursor:pointer',
      'margin-bottom:16px',
    ].join(';');
    resetBtn.addEventListener('click', () => {
      this.#inputPattern = [];
      this.#render();
    });
    panel.appendChild(resetBtn);

    // ── Feedback text ───────────────────────────────────────────────────────
    const feedback = document.createElement('div');
    feedback.id = 'lp-feedback';
    feedback.style.cssText = 'min-height:22px;font-size:13px;letter-spacing:1px;';
    panel.appendChild(feedback);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  }

  /**
   * Handle a color button click — add to input and check for match.
   * @param {string} colorKey - 'red' | 'green' | 'blue'
   */
  #handleInput(colorKey) {
    if (!this.#overlay) return;
    if (this.#inputPattern.length >= PATTERN_LENGTH) return;

    this.#inputPattern.push(colorKey);

    // Update input row slots live
    const inputRow = this.#overlay.querySelector('#lp-input-row');
    if (inputRow) {
      const slots = inputRow.children;
      const idx = this.#inputPattern.length - 1;
      if (slots[idx]) {
        slots[idx].style.background = COLORS[colorKey];
      }
    }

    if (this.#inputPattern.length < PATTERN_LENGTH) return;

    // Full pattern entered — check match
    const isMatch = this.#inputPattern.every((c, i) => c === this.#targetPattern[i]);

    if (isMatch) {
      this.#showFeedback('✔ ACCESS GRANTED', '#33ff66');
      this.#deactivateAll();
      setTimeout(() => this.close(), 1500);
    } else {
      this.#showFeedback('✘ WRONG SEQUENCE', '#ff3333');
      this.#flashRed();
      setTimeout(() => {
        this.#inputPattern = [];
        this.#render();
      }, 700);
    }
  }

  /**
   * Set the feedback text and color.
   * @param {string} message
   * @param {string} color
   */
  #showFeedback(message, color) {
    const feedback = this.#overlay?.querySelector('#lp-feedback');
    if (feedback) {
      feedback.textContent = message;
      feedback.style.color = color;
    }
  }

  /**
   * Flash the input row red to signal wrong input.
   */
  #flashRed() {
    const inputRow = this.#overlay?.querySelector('#lp-input-row');
    if (!inputRow) return;
    Array.from(inputRow.children).forEach(slot => {
      slot.style.background = '#ff3333';
    });
  }

  /**
   * Deactivate all lasers in the zone.
   */
  #deactivateAll() {
    for (const laser of this.#lasers) {
      laser.deactivate();
    }
  }
}
