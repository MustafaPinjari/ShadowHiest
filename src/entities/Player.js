/**
 * Player.js — Alexei player controller
 * Manages movement (WASD/arrows, sprint, crouch), third-person arc-rotate camera,
 * and interaction with nearby IInteractable entities.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.5, 3.6, 3.7
 */
export default class Player {
  // ── Private fields ──────────────────────────────────────────────────────────

  /** @type {BABYLON.Scene} */
  #scene;

  /** @type {import('../systems/InputSystem.js').default} */
  #inputSystem;

  /** @type {BABYLON.Mesh} */
  #mesh;

  /** @type {BABYLON.ArcRotateCamera} */
  #camera;

  /** @type {BABYLON.PhysicsImpostor|null} */
  #impostor = null;

  /** @type {boolean} */
  #crouching = false;

  /** @type {string[]} */
  #inventory = [];

  /** @type {boolean} Whether physics impostor is available */
  #usePhysics = false;

  // ── Movement constants ───────────────────────────────────────────────────────

  static #BASE_SPEED   = 3.0;   // m/s
  static #SPRINT_MULT  = 1.8;
  static #CROUCH_SPEED = 1.5;   // m/s

  // ── Camera constants ─────────────────────────────────────────────────────────

  static #CAM_RADIUS   = 6;
  static #CAM_ALPHA    = -Math.PI / 2;
  static #CAM_BETA     = Math.PI / 3;
  static #BETA_MIN     = 0.2;
  static #BETA_MAX     = Math.PI / 2;
  static #MOUSE_SENS   = 0.003;

  // ── Interaction constant ─────────────────────────────────────────────────────

  static #INTERACT_RANGE = 2; // metres

  // ── Constructor ──────────────────────────────────────────────────────────────

  /**
   * @param {BABYLON.Scene} scene
   * @param {import('../systems/InputSystem.js').default} inputSystem
   */
  constructor(scene, inputSystem) {
    this.#scene       = scene;
    this.#inputSystem = inputSystem;

    this.#buildMesh();
    this.#buildCamera();
  }

  // ── Private builders ─────────────────────────────────────────────────────────

  /** Create Alexei's capsule mesh and attach a physics impostor. */
  #buildMesh() {
    this.#mesh = BABYLON.MeshBuilder.CreateCapsule(
      'alexei',
      { height: 1.8, radius: 0.4 },
      this.#scene,
    );

    // Attempt to attach physics; fall back to direct position manipulation.
    try {
      this.#impostor = new BABYLON.PhysicsImpostor(
        this.#mesh,
        BABYLON.PhysicsImpostor.CylinderImpostor,
        { mass: 80, restitution: 0 },
        this.#scene,
      );
      this.#usePhysics = true;
    } catch (err) {
      console.warn('Player: PhysicsImpostor unavailable, using direct position movement.', err);
      this.#usePhysics = false;
    }
  }

  /** Create the third-person arc-rotate camera and disable built-in inputs. */
  #buildCamera() {
    this.#camera = new BABYLON.ArcRotateCamera(
      'playerCam',
      Player.#CAM_ALPHA,
      Player.#CAM_BETA,
      Player.#CAM_RADIUS,
      this.#mesh.position.clone(),
      this.#scene,
    );

    // Prevent camera from clipping through walls
    this.#camera.checkCollisions = true;
    this.#camera.collisionRadius = new BABYLON.Vector3(0.3, 0.3, 0.3);

    // Disable all built-in camera controls — mouse delta is applied manually.
    this.#camera.inputs.clear();
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  /**
   * Compute the camera-relative movement direction from WASD / arrow keys.
   * Returns a normalised Vector3 (or zero vector if no input).
   * @returns {BABYLON.Vector3}
   */
  #getMovementDirection() {
    const forward =
      this.#inputSystem.isKeyDown('w') ||
      this.#inputSystem.isKeyDown('W') ||
      this.#inputSystem.isKeyDown('ArrowUp');

    const backward =
      this.#inputSystem.isKeyDown('s') ||
      this.#inputSystem.isKeyDown('S') ||
      this.#inputSystem.isKeyDown('ArrowDown');

    const left =
      this.#inputSystem.isKeyDown('a') ||
      this.#inputSystem.isKeyDown('A') ||
      this.#inputSystem.isKeyDown('ArrowLeft');

    const right =
      this.#inputSystem.isKeyDown('d') ||
      this.#inputSystem.isKeyDown('D') ||
      this.#inputSystem.isKeyDown('ArrowRight');

    if (!forward && !backward && !left && !right) {
      return BABYLON.Vector3.Zero();
    }

    // Camera forward/right vectors projected onto the XZ plane.
    const camAlpha = this.#camera.alpha;

    // Forward in world space based on camera yaw (alpha).
    // ArcRotateCamera alpha=0 points along +X; we derive forward/right from it.
    const camForward = new BABYLON.Vector3(
      -Math.sin(camAlpha),
      0,
      -Math.cos(camAlpha),
    );
    const camRight = new BABYLON.Vector3(
      Math.cos(camAlpha),
      0,
      -Math.sin(camAlpha),
    );

    const dir = BABYLON.Vector3.Zero();
    if (forward)  dir.addInPlace(camForward);
    if (backward) dir.subtractInPlace(camForward);
    if (right)    dir.addInPlace(camRight);
    if (left)     dir.subtractInPlace(camRight);

    if (dir.lengthSquared() > 0) {
      dir.normalize();
    }
    return dir;
  }

  /**
   * Determine the current movement speed based on crouch / sprint state.
   * @returns {number} speed in m/s
   */
  #getSpeed() {
    if (this.#crouching) return Player.#CROUCH_SPEED;
    const sprinting = this.#inputSystem.isKeyDown('Shift');
    return sprinting
      ? Player.#BASE_SPEED * Player.#SPRINT_MULT
      : Player.#BASE_SPEED;
  }

  /**
   * Apply movement to the mesh for the current frame.
   * @param {BABYLON.Vector3} dir  Normalised direction vector
   * @param {number} speed         m/s
   * @param {number} delta         Frame delta in seconds
   */
  #applyMovement(dir, speed, delta) {
    if (dir.lengthSquared() === 0) {
      if (this.#usePhysics && this.#impostor) {
        // Zero out horizontal velocity when no input.
        const vel = this.#impostor.getLinearVelocity();
        if (vel) {
          this.#impostor.setLinearVelocity(new BABYLON.Vector3(0, vel.y, 0));
        }
      }
      return;
    }

    const displacement = dir.scale(speed * delta);

    if (this.#usePhysics && this.#impostor) {
      // Drive via linear velocity so physics handles collisions.
      const vel = this.#impostor.getLinearVelocity() ?? BABYLON.Vector3.Zero();
      this.#impostor.setLinearVelocity(
        new BABYLON.Vector3(dir.x * speed, vel.y, dir.z * speed),
      );
    } else {
      this.#mesh.position.addInPlace(displacement);
    }
  }

  /**
   * Toggle crouch state and adjust capsule scale.
   */
  #toggleCrouch() {
    this.#crouching = !this.#crouching;
    this.#mesh.scaling.y = this.#crouching ? 0.5 : 1.0;
  }

  /**
   * Check for nearby interactable meshes and call interact() on the closest one.
   */
  #handleInteraction() {
    const triggered =
      this.#inputSystem.consumeKey('e') ||
      this.#inputSystem.consumeKey('E');

    if (!triggered) return;

    const playerPos = this.#mesh.position;

    /** @type {Array<{ dist: number, entity: { interact(player: Player): void } }>} */
    const candidates = [];

    for (const mesh of this.#scene.meshes) {
      if (!mesh.metadata?.interactable) continue;
      const dist = BABYLON.Vector3.Distance(playerPos, mesh.position);
      if (dist <= Player.#INTERACT_RANGE && mesh.metadata.entity) {
        candidates.push({ dist, entity: mesh.metadata.entity });
      }
    }

    if (candidates.length === 0) return;

    // Sort ascending by distance and call interact on the nearest.
    candidates.sort((a, b) => a.dist - b.dist);
    candidates[0].entity.interact(this);
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Main update — call once per frame from the game loop.
   * @param {number} delta  Frame delta time in seconds
   */
  update(delta) {
    // 1. Compute movement direction and speed.
    const dir   = this.#getMovementDirection();
    const speed = this.#getSpeed();

    // 2. Apply movement.
    this.#applyMovement(dir, speed, delta);

    // 3. Update camera target to follow Alexei.
    this.#camera.target.copyFrom(this.#mesh.position);

    // 4. Apply mouse delta to camera rotation.
    const mouseDelta = this.#inputSystem.getMouseDelta();
    this.#camera.alpha -= mouseDelta.x * Player.#MOUSE_SENS;
    this.#camera.beta  -= mouseDelta.y * Player.#MOUSE_SENS;

    // 5. Clamp beta.
    this.#camera.beta = Math.max(
      Player.#BETA_MIN,
      Math.min(Player.#BETA_MAX, this.#camera.beta),
    );

    // 6. Mesh yaw tracks camera alpha.
    this.#mesh.rotation.y = -this.#camera.alpha - Math.PI / 2;

    // 7. Crouch toggle (C key, one-shot).
    if (this.#inputSystem.consumeKey('c') || this.#inputSystem.consumeKey('C')) {
      this.#toggleCrouch();
    }

    // 8. Interaction (E key, one-shot).
    this.#handleInteraction();
  }

  /**
   * Clean up mesh, impostor, and camera.
   */
  dispose() {
    if (this.#impostor) {
      this.#impostor.dispose();
      this.#impostor = null;
    }
    this.#mesh?.dispose();
    this.#camera?.dispose();
  }

  // ── Getters ──────────────────────────────────────────────────────────────────

  /**
   * Returns the detection multiplier for guard range calculations.
   * 0.6 when crouching (40% reduction), 1.0 otherwise.
   * @returns {number}
   */
  getDetectionMultiplier() {
    return this.#crouching ? 0.6 : 1.0;
  }

  /**
   * Whether Alexei is currently crouching.
   * @returns {boolean}
   */
  get isCrouching() {
    return this.#crouching;
  }

  /**
   * Alexei's current world position.
   * @returns {BABYLON.Vector3}
   */
  get position() {
    return this.#mesh.position;
  }

  /**
   * Alexei's capsule mesh (used by external systems for raycasting exclusion).
   * @returns {BABYLON.Mesh}
   */
  get mesh() {
    return this.#mesh;
  }

  /**
   * The player's collected asset inventory.
   * @returns {string[]}
   */
  get inventory() {
    return this.#inventory;
  }

  /**
   * Add an asset ID to the inventory.
   * @param {string} id
   */
  collectAsset(id) {
    this.#inventory.push(id);
  }
}
