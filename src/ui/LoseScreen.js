/**
 * LoseScreen.js — Mission failed overlay
 * Requirements: 13.6
 */

const REASON_MAP = {
  caught: 'You were caught by a guard',
  timer: 'Time ran out',
};

export class LoseScreen {
  #overlay = null;

  /**
   * @param {{ reason: string, onRestart: () => void }} opts
   */
  show({ reason, onRestart }) {
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
    title.textContent = 'MISSION FAILED';
    title.style.cssText = 'margin:0 0 16px;font-size:3rem;color:#e53935;letter-spacing:4px;';

    const reasonText = REASON_MAP[reason] ?? reason;
    const sub = document.createElement('p');
    sub.textContent = reasonText;
    sub.style.cssText = 'margin:0 0 32px;font-size:1.2rem;color:#ccc;';

    const btn = this.#buildButton('Restart');
    btn.addEventListener('click', () => {
      this.hide();
      onRestart();
    });

    overlay.append(title, sub, btn);
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
