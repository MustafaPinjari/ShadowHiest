/**
 * GameState.js — Win/Lose condition handler
 * Stops the render loop and displays end-game overlays.
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6
 */

const LOSE_REASONS = {
  caught: 'You were caught by a guard',
  timer: 'Time ran out',
};

export class GameState {
  #engine = null;
  #sceneManager = null;
  #helicopter = null;
  #decisionTracker = null;
  #player = null;
  #startTime = Date.now();
  #triggered = false;

  /**
   * @param {{ engine, sceneManager, helicopter?, decisionTracker?, player? }} deps
   */
  configure({ engine, sceneManager, helicopter = null, decisionTracker = null, player = null }) {
    this.#engine = engine;
    this.#sceneManager = sceneManager;
    this.#helicopter = helicopter;
    this.#decisionTracker = decisionTracker;
    this.#player = player;
    this.#startTime = Date.now();
    this.#triggered = false;
  }

  /** Stop render loop and show the lose overlay. */
  triggerLose(reason) {
    if (this.#triggered) return;
    this.#triggered = true;

    this.#engine?.stop();

    const reasonText = LOSE_REASONS[reason] ?? reason ?? 'Mission failed';
    const overlay = this.#buildOverlay();

    const title = document.createElement('h1');
    title.textContent = 'MISSION FAILED';
    title.style.cssText = 'margin:0 0 16px;font-size:3rem;color:#e53935;letter-spacing:4px;';

    const sub = document.createElement('p');
    sub.textContent = reasonText;
    sub.style.cssText = 'margin:0 0 32px;font-size:1.2rem;color:#ccc;';

    const btn = this.#buildButton('Restart');
    btn.addEventListener('click', () => {
      overlay.remove();
      this.#sceneManager?.reload();
    });

    overlay.append(title, sub, btn);
    document.body.appendChild(overlay);
  }

  /** Optionally play helicopter takeoff, then show the win overlay. */
  async triggerWin() {
    if (this.#triggered) return;
    this.#triggered = true;

    if (this.#helicopter && typeof this.#helicopter.takeoff === 'function') {
      this.#helicopter.takeoff();
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    this.#engine?.stop();

    const elapsed = ((Date.now() - this.#startTime) / 1000).toFixed(0);
    const assets = this.#player?.inventory?.length ?? 0;
    const approach = this.#decisionTracker?.getApproach() ?? 'Unknown';

    const overlay = this.#buildOverlay();

    const title = document.createElement('h1');
    title.textContent = 'MISSION COMPLETE';
    title.style.cssText = 'margin:0 0 16px;font-size:3rem;color:#43a047;letter-spacing:4px;';

    const stats = document.createElement('div');
    stats.style.cssText = 'margin:0 0 32px;font-size:1.1rem;color:#ccc;line-height:2;';
    stats.innerHTML = `
      <div>Time: <span style="color:#fff">${elapsed}s</span></div>
      <div>Assets Collected: <span style="color:#fff">${assets}</span></div>
      <div>Approach: <span style="color:#fff">${approach}</span></div>
    `;

    const btn = this.#buildButton('Play Again');
    btn.addEventListener('click', () => {
      overlay.remove();
      this.#sceneManager?.reload();
    });

    overlay.append(title, stats, btn);
    document.body.appendChild(overlay);
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  #buildOverlay() {
    const el = document.createElement('div');
    el.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:2000',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'justify-content:center',
      'background:rgba(0,0,0,0.88)',
      'font-family:monospace',
    ].join(';');
    return el;
  }

  #buildButton(label) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = [
      'padding:12px 32px',
      'font-size:1rem',
      'font-family:monospace',
      'background:#1a1a2e',
      'color:#e0e0e0',
      'border:1px solid #444',
      'border-radius:4px',
      'cursor:pointer',
      'letter-spacing:2px',
      'transition:background 0.2s',
    ].join(';');
    btn.addEventListener('mouseenter', () => { btn.style.background = '#16213e'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = '#1a1a2e'; });
    return btn;
  }
}

export const gameState = new GameState();
