/**
 * Helicopter.js — Procedural helicopter entity with entry/takeoff animations
 * Built from Babylon.js primitives (no GLTF model required).
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 14.6
 */

const SPAWN_POS    = new BABYLON.Vector3(0, 30, -20);
const LANDING_POS  = new BABYLON.Vector3(0, 2, 0);
const ENTRY_DURATION   = 5;   // seconds
const TAKEOFF_DURATION = 3;   // seconds

export class Helicopter {
  /** @type {BABYLON.TransformNode|null} */
  #root = null;

  /** @type {BABYLON.Mesh|null} */
  #rotor = null;

  /** @type {BABYLON.Mesh|null} */
  #tailRotor = null;

  /** @type {BABYLON.Scene|null} */
  #scene = null;

  /** @type {((helicopter: Helicopter) => void)|null} */
  #onLanded = null;

  /** @type {BABYLON.Camera|null} */
  #camera = null;

  /** @type {'idle'|'landing'|'landed'|'takeoff'} */
  #state = 'idle';

  #animTime = 0;

  /** @type {BABYLON.Vector3} position at start of takeoff */
  #takeoffStart = null;

  /**
   * @param {BABYLON.Scene} scene
   */
  constructor(scene) {
    this.#scene = scene;
    this.#build();
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Start the entry cinematic — helicopter descends from spawn to landing pad.
   * @param {BABYLON.Camera} camera  Camera to track the helicopter during entry
   * @param {() => void} onLanded   Callback fired when the helicopter touches down
   */
  startEntry(camera, onLanded) {
    this.#camera   = camera;
    this.#onLanded = onLanded;
    this.#animTime = 0;
    this.#state    = 'landing';

    // Place at spawn position immediately
    this.#root.position.copyFrom(SPAWN_POS);
  }

  /**
   * Start the takeoff animation (ascend back to spawn position).
   * Called by GameState.triggerWin().
   */
  takeoff() {
    if (this.#state === 'takeoff') return;
    this.#takeoffStart = this.#root.position.clone();
    this.#animTime = 0;
    this.#state    = 'takeoff';
  }

  /**
   * Call each frame with the elapsed time in seconds.
   * @param {number} delta
   */
  update(delta) {
    if (!this.#root) return; // already disposed

    if (this.#state === 'idle' || this.#state === 'landed') {
      // Still spin rotors while landed (engine running)
      if (this.#state === 'landed') {
        this.#spinRotors(delta);
      }
      return;
    }

    this.#animTime += delta;
    this.#spinRotors(delta);

    if (this.#state === 'landing') {
      this.#updateLanding();
    } else if (this.#state === 'takeoff') {
      this.#updateTakeoff();
    }

    // Camera tracks helicopter during entry cinematic
    if (this.#camera && this.#root && this.#state !== 'idle') {
      this.#camera.target = this.#root.position.clone();
    }
  }

  dispose() {
    this.#root?.dispose();
    this.#root = null;
  }

  /** @returns {BABYLON.TransformNode|null} */
  get mesh() {
    return this.#root;
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  #build() {
    const scene = this.#scene;

    this.#root = new BABYLON.TransformNode('helicopter', scene);
    this.#root.position.copyFrom(SPAWN_POS);

    // ── Materials ────────────────────────────────────────────────────────────
    const bodyMat = new BABYLON.StandardMaterial('heliBodyMat', scene);
    bodyMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.25);

    const rotorMat = new BABYLON.StandardMaterial('heliRotorMat', scene);
    rotorMat.diffuseColor = new BABYLON.Color3(0.15, 0.15, 0.15);

    // ── Body (3 × 1 × 1.5) ──────────────────────────────────────────────────
    const body = BABYLON.MeshBuilder.CreateBox(
      'heliBody',
      { width: 3, height: 1, depth: 1.5 },
      scene,
    );
    body.material = bodyMat;
    body.parent   = this.#root;
    body.position = BABYLON.Vector3.Zero();

    // ── Tail boom (0.4 × 0.4 × 2) offset behind body ────────────────────────
    const tail = BABYLON.MeshBuilder.CreateBox(
      'heliTail',
      { width: 0.4, height: 0.4, depth: 2 },
      scene,
    );
    tail.material  = bodyMat;
    tail.parent    = this.#root;
    tail.position  = new BABYLON.Vector3(0, 0, -1.75); // behind body

    // ── Main rotor — flat disc on top ────────────────────────────────────────
    this.#rotor = BABYLON.MeshBuilder.CreateCylinder(
      'heliMainRotor',
      { diameter: 4, height: 0.1, tessellation: 16 },
      scene,
    );
    this.#rotor.material = rotorMat;
    this.#rotor.parent   = this.#root;
    this.#rotor.position = new BABYLON.Vector3(0, 0.6, 0); // on top of body

    // ── Tail rotor — small disc at tail end ──────────────────────────────────
    this.#tailRotor = BABYLON.MeshBuilder.CreateCylinder(
      'heliTailRotor',
      { diameter: 0.8, height: 0.1, tessellation: 12 },
      scene,
    );
    this.#tailRotor.material  = rotorMat;
    this.#tailRotor.parent    = this.#root;
    this.#tailRotor.position  = new BABYLON.Vector3(0.25, 0.1, -2.7); // at tail end
    this.#tailRotor.rotation.z = Math.PI / 2; // spin axis perpendicular to tail
  }

  /** Spin both rotors each frame. */
  #spinRotors(delta) {
    this.#rotor.rotation.y     += delta * 8;
    this.#tailRotor.rotation.x += delta * 8;
  }

  /** Lerp helicopter from spawn to landing pad. */
  #updateLanding() {
    const t = Math.min(1, this.#animTime / ENTRY_DURATION);

    this.#root.position.x = SPAWN_POS.x + (LANDING_POS.x - SPAWN_POS.x) * t;
    this.#root.position.y = SPAWN_POS.y + (LANDING_POS.y - SPAWN_POS.y) * t;
    this.#root.position.z = SPAWN_POS.z + (LANDING_POS.z - SPAWN_POS.z) * t;

    if (t >= 1) {
      this.#state = 'landed';
      this.#root.position.copyFrom(LANDING_POS);
      this.#onLanded?.();
    }
  }

  /** Lerp helicopter from landing pad back to spawn. */
  #updateTakeoff() {
    const t = Math.min(1, this.#animTime / TAKEOFF_DURATION);
    const start = this.#takeoffStart ?? LANDING_POS;

    this.#root.position.x = start.x + (SPAWN_POS.x - start.x) * t;
    this.#root.position.y = start.y + (SPAWN_POS.y - start.y) * t;
    this.#root.position.z = start.z + (SPAWN_POS.z - start.z) * t;

    if (t >= 1) {
      this.#state = 'idle';
      this.#root.position.copyFrom(SPAWN_POS);
    }
  }
}
