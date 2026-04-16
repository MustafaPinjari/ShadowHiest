/**
 * Camera.js — Security camera entity and CameraControlPanel interactable.
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
 */
import AlarmSystem from '../systems/AlarmSystem.js';

// ── Constants ────────────────────────────────────────────────────────────────

/** Vision cone half-angle in degrees (60° FOV → 30° half) */
const CONE_HALF_ANGLE_DEG = 30;
const CONE_HALF_ANGLE_RAD = (CONE_HALF_ANGLE_DEG * Math.PI) / 180;

/** Maximum detection range in metres */
const DETECTION_RANGE = 8;

/** Seconds before the camera re-enables after being disabled */
const DISABLE_DURATION = 30;

/** Seconds of cooldown after player leaves cone before alarm decreases */
const DETECTION_COOLDOWN = 3;

// ── SecurityCamera ────────────────────────────────────────────────────────────

export class SecurityCamera {
  // ── Private fields ───────────────────────────────────────────────────────────

  /** @type {BABYLON.Scene} */
  #scene;

  /** @type {BABYLON.Mesh} Camera body mount */
  #mount;

  /** @type {BABYLON.Mesh} Vision cone mesh */
  #cone;

  /** @type {number} Current rotation angle in degrees */
  #rotationAngle;

  /** @type {1 | -1} Current sweep direction */
  #rotationDirection = 1;

  /** @type {number} Degrees per second */
  #rotationSpeed;

  /** @type {number} Minimum sweep angle in degrees */
  #minAngle;

  /** @type {number} Maximum sweep angle in degrees */
  #maxAngle;

  /** @type {boolean} */
  #isActive = true;

  /** @type {boolean} */
  #isDisabled = false;

  /** @type {number} Countdown until re-enable (-1 = not disabled) */
  #disableTimer = -1;

  /** @type {boolean} Whether the player is currently inside the cone */
  #isDetectingPlayer = false;

  /** @type {number} Cooldown timer after player exits cone (-1 = inactive) */
  #detectionCooldown = -1;

  // ── Constructor ──────────────────────────────────────────────────────────────

  /**
   * @param {BABYLON.Scene} scene
   * @param {object} options
   * @param {BABYLON.Vector3} options.position       World position of the camera mount
   * @param {number}          options.minAngle        Minimum sweep angle in degrees
   * @param {number}          options.maxAngle        Maximum sweep angle in degrees
   * @param {number}          [options.rotationSpeed] Degrees per second (default 30)
   * @param {string}          [options.name]          Unique name prefix (default 'secCam')
   */
  constructor(scene, { position, minAngle, maxAngle, rotationSpeed = 30, name = 'secCam' }) {
    this.#scene         = scene;
    this.#minAngle      = minAngle;
    this.#maxAngle      = maxAngle;
    this.#rotationSpeed = rotationSpeed;
    this.#rotationAngle = minAngle;

    this.#buildMount(name, position);
    this.#buildCone(name);
  }

  // ── Private builders ─────────────────────────────────────────────────────────

  /**
   * Build the camera body box mesh.
   * @param {string} name
   * @param {BABYLON.Vector3} position
   */
  #buildMount(name, position) {
    this.#mount = BABYLON.MeshBuilder.CreateBox(
      `${name}_mount`,
      { width: 0.3, height: 0.2, depth: 0.4 },
      this.#scene,
    );
    this.#mount.position.copyFrom(position);

    const mat = new BABYLON.StandardMaterial(`${name}_mountMat`, this.#scene);
    mat.diffuseColor = new BABYLON.Color3(0.15, 0.15, 0.15);
    this.#mount.material = mat;
    this.#mount.isPickable = false;
  }

  /**
   * Build the transparent red vision cone attached to the mount.
   * Uses a cylinder with diameterTop=0 to form a cone shape.
   * The cone points along the mount's local -Z axis (forward).
   */
  #buildCone(name) {
    this.#cone = BABYLON.MeshBuilder.CreateCylinder(
      `${name}_cone`,
      {
        height:      DETECTION_RANGE,
        diameterTop: 0,
        // diameter at base = 2 * range * tan(halfAngle)
        diameterBottom: 2 * DETECTION_RANGE * Math.tan(CONE_HALF_ANGLE_RAD),
        tessellation: 16,
      },
      this.#scene,
    );

    // Attach to mount so it rotates with it
    this.#cone.parent = this.#mount;

    // Offset forward by half the cone height so apex is at mount origin
    // Cylinder default axis is Y; rotate 90° around X so it points along -Z (forward)
    this.#cone.rotation.x = Math.PI / 2;
    this.#cone.position   = new BABYLON.Vector3(0, 0, DETECTION_RANGE / 2);

    const mat = new BABYLON.StandardMaterial(`${name}_coneMat`, this.#scene);
    mat.diffuseColor  = new BABYLON.Color3(1, 0.1, 0.1);
    mat.alpha         = 0.3;
    mat.backFaceCulling = false;
    this.#cone.material  = mat;
    this.#cone.isPickable = false;
  }

  // ── Public state getters ─────────────────────────────────────────────────────

  get isActive()           { return this.#isActive; }
  get isDisabled()         { return this.#isDisabled; }
  get rotationAngle()      { return this.#rotationAngle; }
  get rotationDirection()  { return this.#rotationDirection; }
  get rotationSpeed()      { return this.#rotationSpeed; }
  get isDetectingPlayer()  { return this.#isDetectingPlayer; }
  get disableTimer()       { return this.#disableTimer; }

  /** The camera mount mesh (used by CameraControlPanel for position reference). */
  get mesh() { return this.#mount; }

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Disable the camera for DISABLE_DURATION seconds.
   * Stops rotation and hides the vision cone.
   */
  disable() {
    if (this.#isDisabled) return;
    this.#isDisabled  = true;
    this.#isActive    = false;
    this.#disableTimer = DISABLE_DURATION;
    this.#cone.setEnabled(false);

    // If we were detecting the player, cancel that state cleanly
    if (this.#isDetectingPlayer) {
      this.#isDetectingPlayer = false;
      this.#detectionCooldown = -1;
    }
  }

  /**
   * Main per-frame update.
   * @param {number} delta  Seconds since last frame
   * @param {import('./Player.js').default|null} [player]  Player reference for detection
   */
  update(delta, player = null) {
    // ── Re-enable countdown ──────────────────────────────────────────────────
    if (this.#isDisabled) {
      this.#disableTimer -= delta;
      if (this.#disableTimer <= 0) {
        this.#isDisabled   = false;
        this.#isActive     = true;
        this.#disableTimer = -1;
        this.#cone.setEnabled(true);
      }
      return; // no rotation or detection while disabled
    }

    // ── Oscillating rotation ─────────────────────────────────────────────────
    this.#rotationAngle += this.#rotationDirection * this.#rotationSpeed * delta;

    if (this.#rotationAngle >= this.#maxAngle) {
      this.#rotationAngle   = this.#maxAngle;
      this.#rotationDirection = -1;
    } else if (this.#rotationAngle <= this.#minAngle) {
      this.#rotationAngle   = this.#minAngle;
      this.#rotationDirection = 1;
    }

    // Apply rotation to mount mesh (Y-axis oscillation)
    this.#mount.rotation.y = (this.#rotationAngle * Math.PI) / 180;

    // ── Player detection ─────────────────────────────────────────────────────
    if (player) {
      this.#detectPlayer(delta, player);
    }
  }

  /**
   * Clean up all meshes.
   */
  dispose() {
    this.#cone?.dispose();
    this.#mount?.dispose();
  }

  // ── Private: detection ───────────────────────────────────────────────────────

  /**
   * Per-frame detection logic: angle test → distance test → raycast occlusion.
   * @param {number} delta
   * @param {import('./Player.js').default} player
   */
  #detectPlayer(delta, player) {
    const detected = this.#isPlayerInCone(player);

    if (detected && !this.#isDetectingPlayer) {
      // Detection start
      this.#isDetectingPlayer = true;
      this.#detectionCooldown = -1;
      AlarmSystem.increase(1);
    } else if (!detected && this.#isDetectingPlayer) {
      // Detection exit — start cooldown
      this.#isDetectingPlayer = false;
      this.#detectionCooldown = DETECTION_COOLDOWN;
    }

    // Tick cooldown
    if (this.#detectionCooldown > 0) {
      this.#detectionCooldown -= delta;
      if (this.#detectionCooldown <= 0) {
        this.#detectionCooldown = -1;
        AlarmSystem.decrease(1);
      }
    }
  }

  /**
   * Returns true if the player is within the vision cone and not occluded.
   * @param {import('./Player.js').default} player
   * @returns {boolean}
   */
  #isPlayerInCone(player) {
    const camPos    = this.#mount.getAbsolutePosition();
    const playerPos = player.position;

    // ── Distance check ───────────────────────────────────────────────────────
    const effectiveRange = DETECTION_RANGE * player.getDetectionMultiplier();
    const toPlayer       = playerPos.subtract(camPos);
    const distance       = toPlayer.length();

    if (distance > effectiveRange || distance < 0.001) return false;

    // ── Dot-product angle test ───────────────────────────────────────────────
    // Camera forward in world space: mount faces -Z in local space, rotated by mount.rotation.y
    const yaw = this.#mount.rotation.y;
    const forward = new BABYLON.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));

    const toPlayerNorm = toPlayer.normalize();
    const dot          = BABYLON.Vector3.Dot(forward, toPlayerNorm);
    const angle        = Math.acos(Math.max(-1, Math.min(1, dot)));

    if (angle > CONE_HALF_ANGLE_RAD) return false;

    // ── Raycast occlusion ────────────────────────────────────────────────────
    const ray = new BABYLON.Ray(camPos, toPlayerNorm, distance);

    const playerMesh = player.mesh ?? null;
    const coneMesh   = this.#cone;

    const hit = this.#scene.pickWithRay(ray, (mesh) => {
      // Exclude the player mesh, cone mesh, and non-pickable geometry
      if (mesh === playerMesh) return false;
      if (mesh === coneMesh)   return false;
      if (mesh === this.#mount) return false;
      return mesh.isPickable;
    });

    // If we hit something before reaching the player, the player is occluded
    if (hit?.hit && hit.distance < distance - 0.1) return false;

    return true;
  }
}

// ── CameraControlPanel ────────────────────────────────────────────────────────

/**
 * An interactable control panel that disables a linked SecurityCamera.
 * Implements the IInteractable interface (interact(player) method).
 */
export class CameraControlPanel {
  /** @type {BABYLON.Scene} */
  #scene;

  /** @type {SecurityCamera} */
  #camera;

  /** @type {BABYLON.Mesh} */
  #mesh;

  /** Maximum interaction distance in metres */
  static #INTERACT_RANGE = 1.5;

  /**
   * @param {BABYLON.Scene} scene
   * @param {SecurityCamera} camera  The camera this panel controls
   * @param {BABYLON.Vector3} position  World position of the panel
   * @param {string} [name]
   */
  constructor(scene, camera, position, name = 'camPanel') {
    this.#scene  = scene;
    this.#camera = camera;
    this.#buildMesh(name, position);
  }

  // ── IInteractable ────────────────────────────────────────────────────────────

  /**
   * Disable the linked camera if the player is close enough.
   * @param {import('./Player.js').default} player
   */
  interact(player) {
    const dist = BABYLON.Vector3.Distance(player.position, this.#mesh.position);
    if (dist <= CameraControlPanel.#INTERACT_RANGE) {
      this.#camera.disable();
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /** @returns {BABYLON.Mesh} */
  get mesh() { return this.#mesh; }

  dispose() {
    this.#mesh?.dispose();
  }

  // ── Private builder ──────────────────────────────────────────────────────────

  #buildMesh(name, position) {
    this.#mesh = BABYLON.MeshBuilder.CreateBox(
      name,
      { width: 0.4, height: 0.6, depth: 0.15 },
      this.#scene,
    );
    this.#mesh.position.copyFrom(position);

    const mat = new BABYLON.StandardMaterial(`${name}_mat`, this.#scene);
    mat.diffuseColor  = new BABYLON.Color3(0.1, 0.5, 0.9);
    mat.emissiveColor = new BABYLON.Color3(0.0, 0.1, 0.3);
    this.#mesh.material = mat;

    // Register as interactable so Player.#handleInteraction can find it
    this.#mesh.metadata = { interactable: true, entity: this };
  }
}
