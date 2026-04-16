/**
 * SceneManager.js — Scene lifecycle management singleton
 * Manages transitions between scenes implementing the { init, update, dispose } interface.
 * Requirements: 1.1, 1.3
 */

class SceneManager {
  /** @type {import('./Engine.js').Engine|null} */
  #engine = null;

  /** @type {object|null} Active scene instance */
  #activeScene = null;

  /** @type {Function|null} Current scene class */
  #activeSceneClass = null;

  /** @type {any[]} Args used to instantiate the current scene */
  #activeSceneArgs = [];

  /**
   * Store the engine reference and wire the render loop.
   * @param {import('./Engine.js').Engine} engine
   */
  init(engine) {
    this.#engine = engine;

    engine.registerRenderLoop(() => {
      if (!this.#activeScene) return;

      const babylonEngine = engine.babylonEngine;
      const delta = babylonEngine ? babylonEngine.getDeltaTime() / 1000 : 0;

      this.#activeScene.update(delta);
    });
  }

  /**
   * Dispose the current scene, instantiate SceneClass with args, and call init(engine).
   * @param {new (...args: any[]) => object} SceneClass
   * @param {...any} args  Constructor arguments forwarded to SceneClass
   */
  loadScene(SceneClass, ...args) {
    // Dispose existing scene
    if (this.#activeScene && typeof this.#activeScene.dispose === 'function') {
      this.#activeScene.dispose();
    }

    this.#activeSceneClass = SceneClass;
    this.#activeSceneArgs = args;

    const scene = new SceneClass(...args);
    scene.init(this.#engine);
    this.#activeScene = scene;
  }

  /**
   * Re-instantiate and re-init the current scene with the same constructor args.
   */
  reload() {
    if (!this.#activeSceneClass) {
      console.warn('SceneManager.reload() called with no active scene');
      return;
    }
    this.loadScene(this.#activeSceneClass, ...this.#activeSceneArgs);
  }

  /**
   * Returns the current active scene instance.
   * @returns {object|null}
   */
  getActiveScene() {
    return this.#activeScene;
  }
}

// Export a single shared instance
export const sceneManager = new SceneManager();
