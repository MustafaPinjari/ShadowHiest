/**
 * Engine.js — Babylon.js engine wrapper
 * Wraps BABYLON.Engine targeting a full-viewport canvas.
 * Exposes start(), stop(), and registerRenderLoop(fn).
 */
export class Engine {
  /**
   * Performance Budget:
   * - Target: 60 FPS, minimum 30 FPS on mid-range hardware
   * - Max triangles: 500,000 per active scene
   * - Max texture resolution: 1024×1024px
   * - Geometry instancing used for repeated objects (chairs, pillars, lights)
   * - LOD applied at 20m distance for distant objects
   *
   * The scene uses procedural geometry only (no external GLTF assets loaded),
   * so polygon count is well within budget. All materials use StandardMaterial
   * with no textures, keeping memory usage minimal.
   */

  /** @type {BABYLON.PerformanceMonitor|null} */
  #perfMonitor = null;

  /** @type {number} */
  #lowFpsFrameCount = 0;

  /** @type {BABYLON.Engine|null} */
  #engine = null;

  /** @type {HTMLCanvasElement} */
  #canvas;

  /** @type {Array<() => void>} Callbacks registered before or after start() */
  #renderCallbacks = [];

  /** @type {boolean} Whether the render loop is currently running */
  #running = false;

  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.#canvas = canvas;
  }

  /**
   * Initialize the Babylon.js engine.
   * If WebGL is not supported, renders an error div and returns false.
   * @returns {boolean} true if initialization succeeded
   */
  init() {
    if (!BABYLON.Engine.isSupported()) {
      this.#showWebGLError();
      return false;
    }

    this.#engine = new BABYLON.Engine(this.#canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });

    this.#perfMonitor = new BABYLON.PerformanceMonitor(60);
    this.#perfMonitor.enable();

    // Resize the engine when the window resizes
    window.addEventListener('resize', () => {
      this.#engine?.resize();
    });

    return true;
  }

  /**
   * Start the render loop, executing all registered callbacks each frame.
   */
  start() {
    if (!this.#engine) {
      console.warn('Engine.start() called before Engine.init()');
      return;
    }
    if (this.#running) return;
    this.#running = true;
    this.#engine.runRenderLoop(() => {
      for (const fn of this.#renderCallbacks) {
        fn();
      }
      if (this.#perfMonitor) {
        this.#perfMonitor.sampleFrame();
        const avgFps = this.#perfMonitor.averageFPS;
        if (avgFps < 30) {
          this.#lowFpsFrameCount++;
          if (this.#lowFpsFrameCount >= 3) {
            console.warn('Performance warning: frame time exceeded 33ms');
            this.#lowFpsFrameCount = 0; // reset to avoid spamming
          }
        } else {
          this.#lowFpsFrameCount = 0;
        }
      }
    });
  }

  /**
   * Stop the render loop.
   */
  stop() {
    this.#running = false;
    this.#engine?.stopRenderLoop();
  }

  /**
   * Register a function to be called each render frame.
   * If start() has already been called, the callback is added to the running loop.
   * @param {() => void} fn
   */
  registerRenderLoop(fn) {
    if (!this.#engine) {
      console.warn('Engine.registerRenderLoop() called before Engine.init()');
      return;
    }
    this.#renderCallbacks.push(fn);
    // If not yet started, start() will pick up all callbacks when called.
    // If already running, the callback is added to the array and will execute next frame.
  }

  /**
   * Expose the underlying BABYLON.Engine instance.
   * @returns {BABYLON.Engine|null}
   */
  get babylonEngine() {
    return this.#engine;
  }

  /**
   * Audit the active scene's polygon count and texture sizes.
   * Logs a warning if total triangles exceed 500,000 or any texture exceeds 1024×1024px.
   * Call this once after a scene finishes loading — not every frame.
   *
   * Requirements: 15.4, 15.5
   *
   * @param {BABYLON.Scene} scene
   */
  auditScene(scene) {
    if (!scene) return;

    // ── Triangle count ───────────────────────────────────────────────────────
    let totalTriangles = 0;
    for (const mesh of scene.meshes) {
      if (mesh.isEnabled() && mesh.getTotalIndices) {
        totalTriangles += mesh.getTotalIndices() / 3;
      }
    }
    if (totalTriangles > 500_000) {
      console.warn(
        `[SceneAudit] Triangle budget exceeded: ${totalTriangles.toLocaleString()} triangles` +
        ` (limit: 500,000). Reduce geometry or increase LOD aggressiveness.`,
      );
    } else {
      console.info(`[SceneAudit] Triangle count OK: ${totalTriangles.toLocaleString()} / 500,000`);
    }

    // ── Texture resolution ───────────────────────────────────────────────────
    const oversizedTextures = [];
    for (const texture of scene.textures) {
      const w = texture.getSize?.().width  ?? 0;
      const h = texture.getSize?.().height ?? 0;
      if (w > 1024 || h > 1024) {
        oversizedTextures.push(`${texture.name} (${w}×${h})`);
      }
    }
    if (oversizedTextures.length > 0) {
      console.warn(
        `[SceneAudit] Texture budget exceeded — the following textures are larger than 1024×1024px:\n` +
        oversizedTextures.map(t => `  • ${t}`).join('\n'),
      );
    } else {
      console.info(`[SceneAudit] All textures within 1024×1024px budget.`);
    }
  }

  /**
   * Show the WebGL error overlay and hide the canvas.
   */
  #showWebGLError() {
    this.#canvas.style.display = 'none';
    const errorDiv = document.getElementById('webgl-error');
    if (errorDiv) {
      errorDiv.style.display = 'flex';
    }
  }
}
