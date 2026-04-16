/**
 * HUD.js — Fixed HTML overlay HUD for Operation Shadow Heist.
 *
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.7
 *
 * Panels:
 *   - Top-left:    objective text
 *   - Top-right:   alert badge + escape timer
 *   - Bottom-left: asset counter
 */

const ALERT_CONFIG = [
  { color: '#4caf50', label: 'SILENT' },
  { color: '#ffeb3b', label: 'SUSPICIOUS' },
  { color: '#ff9800', label: 'ALERT' },
  { color: '#f44336', label: 'FULL ALARM' },
];

const PANEL_STYLE = [
  'background: rgba(0,0,0,0.6)',
  'border-radius: 4px',
  'padding: 8px 12px',
  'font-family: monospace',
  'color: #eee',
  'pointer-events: none',
].join(';');

export class HUD {
  #container = null;
  #alertBadge = null;
  #timerEl = null;
  #assetCounter = null;
  #objectiveEl = null;
  #totalAssets = 3;

  constructor(totalAssets = 3) {
    this.#totalAssets = totalAssets;
  }

  /** Create and append all DOM elements to document.body */
  mount() {
    // Root container — covers the viewport, no pointer interaction
    this.#container = document.createElement('div');
    Object.assign(this.#container.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '500',
      pointerEvents: 'none',
    });

    // ── Top-left: objective ──────────────────────────────────────────────────
    const topLeft = document.createElement('div');
    topLeft.setAttribute('style', PANEL_STYLE);
    Object.assign(topLeft.style, {
      position: 'absolute',
      top: '12px',
      left: '12px',
    });

    this.#objectiveEl = document.createElement('span');
    this.#objectiveEl.textContent = '';
    topLeft.appendChild(this.#objectiveEl);

    // ── Top-right: alert badge + timer ───────────────────────────────────────
    const topRight = document.createElement('div');
    topRight.setAttribute('style', PANEL_STYLE);
    Object.assign(topRight.style, {
      position: 'absolute',
      top: '12px',
      right: '12px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: '6px',
    });

    this.#alertBadge = document.createElement('span');
    Object.assign(this.#alertBadge.style, {
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '3px',
      fontWeight: 'bold',
      fontSize: '13px',
      background: ALERT_CONFIG[0].color,
      color: '#111',
    });
    this.#alertBadge.textContent = ALERT_CONFIG[0].label;

    this.#timerEl = document.createElement('span');
    Object.assign(this.#timerEl.style, {
      fontSize: '18px',
      letterSpacing: '2px',
      display: 'none',
    });
    this.#timerEl.textContent = '10:00';

    topRight.appendChild(this.#alertBadge);
    topRight.appendChild(this.#timerEl);

    // ── Bottom-left: asset counter ───────────────────────────────────────────
    const bottomLeft = document.createElement('div');
    bottomLeft.setAttribute('style', PANEL_STYLE);
    Object.assign(bottomLeft.style, {
      position: 'absolute',
      bottom: '12px',
      left: '12px',
    });

    this.#assetCounter = document.createElement('span');
    this.#assetCounter.textContent = `Assets: 0/${this.#totalAssets}`;
    bottomLeft.appendChild(this.#assetCounter);

    // ── Assemble ─────────────────────────────────────────────────────────────
    this.#container.appendChild(topLeft);
    this.#container.appendChild(topRight);
    this.#container.appendChild(bottomLeft);
    document.body.appendChild(this.#container);
  }

  /** Remove HUD from the DOM */
  unmount() {
    this.#container?.remove();
    this.#container = null;
  }

  /**
   * Update the alert badge color and label.
   * @param {0|1|2|3} level
   */
  setAlertLevel(level) {
    const cfg = ALERT_CONFIG[Math.max(0, Math.min(3, level))];
    this.#alertBadge.style.background = cfg.color;
    this.#alertBadge.textContent = cfg.label;
  }

  /**
   * Update the escape timer display.
   * @param {string} formattedTime — "MM:SS"
   * @param {boolean} isVisible
   */
  setTimer(formattedTime, isVisible) {
    this.#timerEl.textContent = formattedTime;
    this.#timerEl.style.display = isVisible ? 'inline' : 'none';
  }

  /**
   * Update the asset counter.
   * @param {number} collected
   * @param {number} total
   */
  setAssets(collected, total) {
    this.#totalAssets = total;
    this.#assetCounter.textContent = `Assets: ${collected}/${total}`;
  }

  /**
   * Update the objective text.
   * @param {string} text
   */
  setObjective(text) {
    this.#objectiveEl.textContent = text;
  }

  /**
   * Wire the HUD to live game systems.
   * @param {object} alarmSystem — exposes onLevelChange(cb)
   * @param {object} escapeTimer — exposes on(type, cb) and getFormattedTime()
   */
  wire(alarmSystem, escapeTimer) {
    alarmSystem.onLevelChange((level) => {
      this.setAlertLevel(level);
    });

    escapeTimer.on('tick', () => {
      this.setTimer(escapeTimer.getFormattedTime(), escapeTimer.isVisible);
    });

    escapeTimer.on('visibilityChange', (visible) => {
      this.setTimer(escapeTimer.getFormattedTime(), visible);
    });
  }
}
