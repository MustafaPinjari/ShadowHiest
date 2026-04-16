/**
 * Door.js — Interactive door entity (IInteractable)
 * Supports open/close animation (rotation around Y-axis hinge) and collision state toggle.
 * Registers itself on its mesh metadata so Player's sphere-cast can find it.
 * Requirements: 4.4, 4.5
 */

/** @typedef {{ interact(player: import('./Player.js').default): void }} IInteractable */

export class Door {
  // ── Private fields ───────────────────────────────────────────────────────────

  /** @type {BABYLON.Scene} */
  #scene;

  /** @type {BABYLON.Mesh} Door panel mesh */
  #mesh;

  /** @type {BABYLON.PhysicsImpostor|null} */
  #impostor = null;

  /** @type {boolean} */
  #isOpen = false;

  /** @type {boolean} Whether an animation is currently playing */
  #animating = false;

  // ── Animation constants ──────────────────────────────────────────────────────

  /** Rotation (radians) when fully open — 90° swing */
  static #OPEN_ANGLE  = Math.PI / 2;
  static #CLOSE_ANGLE = 0;

  /** Animation duration in seconds */
  static #ANIM_DURATION = 0.4;

  // ── Constructor ──────────────────────────────────────────────────────────────

  /**
   * @param {BABYLON.Scene} scene
   * @param {object} options
   * @param {string}              options.name       Unique name for this door
   * @param {BABYLON.Vector3}     options.position   World position of the door hinge
   * @param {number}              [options.rotationY] Initial Y rotation of the door frame (radians)
   * @param {number}              [options.width]    Door panel width (default 1.0 m)
   * @param {number}              [options.height]   Door panel height (default 2.2 m)
   */
  constructor(scene, { name, position, rotationY = 0, width = 1.0, height = 2.2 }) {
    this.#scene = scene;
    this.#buildMesh(name, position, rotationY, width, height);
  }

  // ── IInteractable ────────────────────────────────────────────────────────────

  /**
   * Toggle the door open/closed when the player interacts with it.
   * @param {import('./Player.js').default} _player
   */
  interact(_player) {
    if (this.#animating) return;
    this.#isOpen ? this.#close() : this.#open();
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /** @returns {boolean} */
  get isOpen() { return this.#isOpen; }

  /** @returns {BABYLON.Mesh} */
  get mesh() { return this.#mesh; }

  /** Force-open the door without animation (e.g. vault unlock). */
  forceOpen() {
    this.#isOpen = true;
    this.#mesh.rotation.y = Door.#OPEN_ANGLE;
    this.#setCollision(false);
  }

  dispose() {
    this.#impostor?.dispose();
    this.#mesh?.dispose();
  }

  // ── Private builders ─────────────────────────────────────────────────────────

  /**
   * Build the door panel mesh.
   * The pivot is at the hinge edge (left side), so we offset the geometry.
   */
  #buildMesh(name, position, rotationY, width, height) {
    // Parent node acts as the hinge pivot
    const hinge = new BABYLON.TransformNode(`${name}_hinge`, this.#scene);
    hinge.position.copyFrom(position);
    hinge.rotation.y = rotationY;

    // Door panel — offset so left edge aligns with hinge
    this.#mesh = BABYLON.MeshBuilder.CreateBox(
      name,
      { width, height, depth: 0.08 },
      this.#scene,
    );
    this.#mesh.parent   = hinge;
    this.#mesh.position = new BABYLON.Vector3(width / 2, height / 2, 0);

    const mat = new BABYLON.StandardMaterial(`${name}_mat`, this.#scene);
    mat.diffuseColor = new BABYLON.Color3(0.55, 0.38, 0.22);
    this.#mesh.material = mat;

    // Physics impostor on the panel (mass=0 → static blocker)
    try {
      this.#impostor = new BABYLON.PhysicsImpostor(
        this.#mesh,
        BABYLON.PhysicsImpostor.BoxImpostor,
        { mass: 0, restitution: 0 },
        this.#scene,
      );
    } catch {
      // Physics unavailable — door still animates visually
    }

    // Register as interactable so Player.#handleInteraction can find it
    this.#mesh.metadata = { interactable: true, entity: this };
  }

  // ── Private animation ────────────────────────────────────────────────────────

  #open() {
    this.#animating = true;
    this.#setCollision(false); // disable collision immediately so player can pass
    this.#animateHinge(Door.#OPEN_ANGLE, () => {
      this.#isOpen    = true;
      this.#animating = false;
    });
  }

  #close() {
    this.#animating = true;
    this.#animateHinge(Door.#CLOSE_ANGLE, () => {
      this.#isOpen    = false;
      this.#animating = false;
      this.#setCollision(true); // re-enable collision once fully closed
    });
  }

  /**
   * Animate the hinge parent's Y rotation to targetAngle over ANIM_DURATION seconds.
   * Uses a simple per-frame observer rather than Babylon's animation system to keep
   * the implementation dependency-free.
   * @param {number} targetAngle
   * @param {() => void} onComplete
   */
  #animateHinge(targetAngle, onComplete) {
    const hinge      = this.#mesh.parent;
    if (!hinge) { onComplete(); return; }

    const startAngle = /** @type {BABYLON.TransformNode} */ (hinge).rotation.y;
    const delta      = targetAngle - startAngle;
    let   elapsed    = 0;

    const observer = this.#scene.onBeforeRenderObservable.add(() => {
      const dt = this.#scene.getEngine().getDeltaTime() / 1000;
      elapsed += dt;
      const t  = Math.min(elapsed / Door.#ANIM_DURATION, 1);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // ease-in-out quad

      /** @type {BABYLON.TransformNode} */ (hinge).rotation.y = startAngle + delta * eased;

      if (t >= 1) {
        this.#scene.onBeforeRenderObservable.remove(observer);
        onComplete();
      }
    });
  }

  /**
   * Enable or disable the physics impostor so the door blocks / allows passage.
   * @param {boolean} enabled
   */
  #setCollision(enabled) {
    if (!this.#impostor) return;
    // Toggle mesh checkCollisions as a lightweight fallback when physics is unavailable
    this.#mesh.checkCollisions = enabled;
    // With physics: swap between static (mass=0) and ghost (no collision response)
    try {
      if (enabled) {
        this.#impostor.setParam('mass', 0);
      } else {
        // Setting mass to -1 effectively makes it a ghost in CannonJS
        this.#impostor.setParam('mass', -1);
      }
    } catch {
      // Ignore — visual animation still works
    }
  }
}

// ── Door placement helper ────────────────────────────────────────────────────

/**
 * Place the 6 required interactive doors in the InteriorScene.
 * Called from InteriorScene after the scene geometry is built.
 *
 * Door positions correspond to the wall gaps defined in InteriorScene.js:
 *  1. Lobby south entrance
 *  2. Security office north door
 *  3. Staff room A south door
 *  4. Staff room B north door
 *  5. Vault corridor north door
 *  6. Vault room north door (vault door — locked until puzzle solved)
 *
 * @param {BABYLON.Scene} scene
 * @returns {Door[]}
 */
export function placeDoors(scene) {
  return [
    // 1. Lobby south entrance (player enters from rooftop stairwell)
    new Door(scene, {
      name:      'door_lobby_S',
      position:  new BABYLON.Vector3(-1, 0, 0),
      rotationY: 0,
    }),

    // 2. Security office north door
    new Door(scene, {
      name:      'door_sec_N',
      position:  new BABYLON.Vector3(-15, 0, 0),
      rotationY: 0,
    }),

    // 3. Staff room A south door
    new Door(scene, {
      name:      'door_staffA_S',
      position:  new BABYLON.Vector3(10, 0, -4),
      rotationY: Math.PI / 2,
    }),

    // 4. Staff room B north door
    new Door(scene, {
      name:      'door_staffB_N',
      position:  new BABYLON.Vector3(10, 0, -4),
      rotationY: Math.PI / 2,
    }),

    // 5. Vault corridor north entrance
    new Door(scene, {
      name:      'door_vc_N',
      position:  new BABYLON.Vector3(-1, 0, -14),
      rotationY: 0,
    }),

    // 6. Vault room door (locked — unlocked by VaultPuzzle in Task 13)
    new Door(scene, {
      name:      'door_vault',
      position:  new BABYLON.Vector3(-1, 0, -26),
      rotationY: 0,
    }),
  ];
}
