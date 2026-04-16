/**
 * AssetLoader.js — Batch asset loader using BABYLON.AssetsManager
 * Supports GLTF/GLB models and textures with progress callbacks (0–100%).
 * Requirements: 1.2, 1.6
 */
export class AssetLoader {
  /** @type {BABYLON.Scene} */
  #scene;

  /** @type {Array<{type: 'mesh'|'texture', name: string, task: BABYLON.AbstractAssetTask}>} */
  #queue = [];

  /** @type {Map<string, any>} */
  #assets = new Map();

  /**
   * @param {BABYLON.Scene} scene
   */
  constructor(scene) {
    this.#scene = scene;
  }

  /**
   * Queue a GLTF/GLB model for loading.
   * @param {string} name   Unique key for this asset
   * @param {string} rootUrl  Base URL (e.g. 'assets/models/')
   * @param {string} filename Filename (e.g. 'guard.glb')
   */
  addMesh(name, rootUrl, filename) {
    this.#queue.push({ type: 'mesh', name, rootUrl, filename });
  }

  /**
   * Queue a texture for loading.
   * @param {string} name Unique key for this asset
   * @param {string} url  Full URL to the texture file
   */
  addTexture(name, url) {
    this.#queue.push({ type: 'texture', name, url });
  }

  /**
   * Start loading all queued assets.
   * @param {(percent: number) => void} onProgress  Called with 0–100 as assets load
   * @param {(assets: Map<string, any>) => void} onComplete  Called when all assets loaded
   * @param {(message: string) => void} onError  Called if any asset fails
   */
  load(onProgress, onComplete, onError) {
    const manager = new BABYLON.AssetsManager(this.#scene);

    // Disable the built-in loading screen — we manage our own
    manager.useDefaultLoadingScreen = false;

    const total = this.#queue.length;

    if (total === 0) {
      onProgress?.(100);
      onComplete?.(this.#assets);
      return;
    }

    let completed = 0;

    const onTaskDone = () => {
      completed++;
      const percent = Math.round((completed / total) * 100);
      onProgress?.(percent);
    };

    for (const item of this.#queue) {
      if (item.type === 'mesh') {
        const task = manager.addMeshTask(item.name, '', item.rootUrl, item.filename);

        task.onSuccess = (t) => {
          this.#assets.set(item.name, {
            meshes: t.loadedMeshes,
            particleSystems: t.loadedParticleSystems,
            skeletons: t.loadedSkeletons,
            animationGroups: t.loadedAnimationGroups,
          });
          onTaskDone();
        };

        task.onError = (_t, message, exception) => {
          onError?.(`Failed to load mesh "${item.name}": ${message ?? exception?.message ?? 'unknown error'}`);
          onTaskDone();
        };
      } else if (item.type === 'texture') {
        const task = manager.addTextureTask(item.name, item.url);

        task.onSuccess = (t) => {
          this.#assets.set(item.name, t.texture);
          onTaskDone();
        };

        task.onError = (_t, message, exception) => {
          onError?.(`Failed to load texture "${item.name}": ${message ?? exception?.message ?? 'unknown error'}`);
          onTaskDone();
        };
      }
    }

    manager.onFinish = () => {
      onComplete?.(this.#assets);
    };

    manager.load();
  }
}
