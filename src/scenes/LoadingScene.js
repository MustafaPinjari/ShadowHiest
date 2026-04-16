/**
 * LoadingScene.js — Loading screen scene
 * Displays a full-viewport HTML/CSS overlay with title, progress bar, and percentage.
 * Driven by AssetLoader callbacks. Calls onComplete() when loading finishes.
 * Requirements: 1.2, 1.3
 */
import { AssetLoader } from '../core/AssetLoader.js';

export class LoadingScene {
  /** @type {Array<{type: 'mesh'|'texture', name: string, rootUrl?: string, filename?: string, url?: string}>} */
  #manifest;

  /** @type {() => void} */
  #onComplete;

  /** @type {BABYLON.Scene|null} */
  #scene = null;

  /** @type {HTMLElement|null} */
  #overlay = null;

  /** @type {HTMLElement|null} */
  #progressBar = null;

  /** @type {HTMLElement|null} */
  #percentLabel = null;

  /**
   * @param {Array<{type: 'mesh'|'texture', name: string, rootUrl?: string, filename?: string, url?: string}>} manifest
   * @param {() => void} onComplete
   */
  constructor(manifest, onComplete) {
    this.#manifest = manifest ?? [];
    this.#onComplete = onComplete ?? (() => {});
  }

  /**
   * Create a minimal Babylon.js scene and inject the loading overlay.
   * @param {import('../core/Engine.js').Engine} engine
   */
  init(engine) {
    const babylonEngine = engine.babylonEngine;

    // Minimal scene — just enough to keep the render loop alive
    this.#scene = new BABYLON.Scene(babylonEngine);
    this.#scene.clearColor = new BABYLON.Color4(0, 0, 0, 1);

    // Babylon.js requires at least one camera to render a scene
    const cam = new BABYLON.FreeCamera('loadingCam', new BABYLON.Vector3(0, 0, -1), this.#scene);
    cam.setTarget(BABYLON.Vector3.Zero());

    this.#createOverlay();
    this.#startLoading(babylonEngine);
  }

  /** @param {number} _deltaTime */
  update(_deltaTime) {
    this.#scene?.render();
  }

  dispose() {
    this.#removeOverlay();
    this.#scene?.dispose();
    this.#scene = null;
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  #createOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: #0a0a0a;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      font-family: 'Segoe UI', Arial, sans-serif;
      color: #e0e0e0;
    `;

    const title = document.createElement('h1');
    title.textContent = 'OPERATION SHADOW HEIST';
    title.style.cssText = `
      font-size: clamp(1.4rem, 4vw, 2.4rem);
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: #c8a84b;
      margin-bottom: 2.5rem;
      text-align: center;
    `;

    const barContainer = document.createElement('div');
    barContainer.style.cssText = `
      width: min(480px, 80vw);
      height: 8px;
      background: #222;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 0.75rem;
    `;

    const bar = document.createElement('div');
    bar.style.cssText = `
      height: 100%;
      width: 0%;
      background: #c8a84b;
      border-radius: 4px;
      transition: width 0.15s ease;
    `;
    barContainer.appendChild(bar);

    const label = document.createElement('p');
    label.textContent = 'Loading... 0%';
    label.style.cssText = `
      font-size: 0.9rem;
      color: #888;
      letter-spacing: 0.05em;
    `;

    overlay.appendChild(title);
    overlay.appendChild(barContainer);
    overlay.appendChild(label);
    document.body.appendChild(overlay);

    this.#overlay = overlay;
    this.#progressBar = bar;
    this.#percentLabel = label;
  }

  #removeOverlay() {
    this.#overlay?.remove();
    this.#overlay = null;
    this.#progressBar = null;
    this.#percentLabel = null;
  }

  /**
   * @param {BABYLON.Engine} babylonEngine
   */
  #startLoading(babylonEngine) {
    // We need a scene for AssetsManager — reuse the one we already created
    const loader = new AssetLoader(this.#scene);

    for (const item of this.#manifest) {
      if (item.type === 'mesh') {
        loader.addMesh(item.name, item.rootUrl ?? '', item.filename ?? '');
      } else if (item.type === 'texture') {
        loader.addTexture(item.name, item.url ?? '');
      }
    }

    loader.load(
      (percent) => this.#onProgress(percent),
      (_assets) => this.#onLoadComplete(),
      (message) => console.error('[LoadingScene]', message),
    );
  }

  /** @param {number} percent */
  #onProgress(percent) {
    if (this.#progressBar) {
      this.#progressBar.style.width = `${percent}%`;
    }
    if (this.#percentLabel) {
      this.#percentLabel.textContent = `Loading... ${percent}%`;
    }
  }

  #onLoadComplete() {
    this.#onProgress(100);
    // Brief pause so the user sees 100% before the overlay disappears
    setTimeout(() => {
      this.#removeOverlay();
      this.#onComplete();
    }, 300);
  }
}
