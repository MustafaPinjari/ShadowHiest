/**
 * WinScreen.js — Mission complete overlay
 * Requirements: 13.5
 */

export class WinScreen {
  #overlay = null;

  /**
   * @param {{
   *   elapsedSeconds: number,
   *   assetsCollected: number,
   *   totalAssets: number,
   *   approach: string,
   *   onRestart: () => void
   * }} opts
   */
  show({ elapsedSeconds, assetsCollected, totalAssets, approach, onRestart }) {
    this.hide();

    const overlay = document.createElement('div');
    overlay.style.cssText = [
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

    const title = document.createElement('h1');
    title.textContent = 'MISSION COMPLETE';
    title.style.cssText = 'margin:0 0 16px;font-size:3rem;color:#43a047;letter-spacing:4px;';

    const mm = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
    const ss = String(Math.floor(elapsedSeconds % 60)).padStart(2, '0');
    const approachLabel = approach === 'Stealth' || approach === 'Aggressive' ? approach : approach;

    const stats = document.createElement('div');
    stats.style.cssText = 'margin:0 0 32px;font-size:1.1rem;color:#ccc;line-height:2;text-align:center;';
    stats.innerHTML = [
      `<div>Time: <span style="color:#fff">${mm}:${ss}</span></div>`,
      `<div>Assets Collected: <span style="color:#fff">${assetsCollected}/${totalAssets}</span></div>`,
      `<div>Approach: <span style="color:#fff">${approachLabel}</span></div>`,
    ].join('');

    const btn = this.#buildButton('Play Again');
    btn.addEventListener('click', () => {
      this.hide();
      onRestart();
    });

    overlay.append(title, stats, btn);
    document.body.appendChild(overlay);
    this.#overlay = overlay;
  }

  hide() {
    this.#overlay?.remove();
    this.#overlay = null;
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
    ].join(';');
    btn.addEventListener('mouseenter', () => { btn.style.background = '#16213e'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = '#1a1a2e'; });
    return btn;
  }
}
