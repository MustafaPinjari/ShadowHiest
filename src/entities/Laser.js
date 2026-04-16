import AlarmSystem from '../systems/AlarmSystem.js';

/**
 * Laser.js — A laser beam entity that detects player intersection.
 *
 * Renders a thin red emissive tube between two Vector3 endpoints.
 * Each frame, performs a closest-point-on-segment check against
 * Alexei's capsule. On intersection, calls AlarmSystem.increase(2).
 */
export class Laser {
  /** @type {BABYLON.Mesh} */
  #mesh;

  /** @type {boolean} */
  #isActive = true;

  /** @type {BABYLON.Vector3} */
  #start;

  /** @type {BABYLON.Vector3} */
  #end;

  /** Capsule radius used for intersection check (metres) */
  static CAPSULE_RADIUS = 0.4;

  /** Capsule height used for vertical bounds check (metres) */
  static CAPSULE_HEIGHT = 1.8;

  /**
   * @param {BABYLON.Scene} scene
   * @param {{ name: string, start: BABYLON.Vector3, end: BABYLON.Vector3 }} options
   */
  constructor(scene, { name, start, end }) {
    this.#start = start.clone();
    this.#end = end.clone();

    // Build the tube mesh between start and end
    this.#mesh = BABYLON.MeshBuilder.CreateTube(
      name,
      {
        path: [start, end],
        radius: 0.03,
        tessellation: 6,
        updatable: false,
      },
      scene
    );

    // Emissive red material
    const mat = new BABYLON.StandardMaterial(`${name}_mat`, scene);
    mat.emissiveColor = new BABYLON.Color3(1, 0, 0);
    mat.backFaceCulling = false;
    this.#mesh.material = mat;
  }

  /** @returns {BABYLON.Mesh} */
  get mesh() {
    return this.#mesh;
  }

  /** @returns {boolean} */
  get isActive() {
    return this.#isActive;
  }

  /**
   * Per-frame detection check against the player's capsule.
   * Uses closest-point-on-segment math for accurate AABB intersection.
   * @param {{ position: BABYLON.Vector3 }} player
   */
  update(player) {
    if (!this.#isActive) return;

    const playerPos = player.position;
    const closest = this.#closestPointOnSegment(playerPos);

    // Horizontal distance check
    const dx = closest.x - playerPos.x;
    const dz = closest.z - playerPos.z;
    const horizDist = Math.sqrt(dx * dx + dz * dz);

    if (horizDist >= Laser.CAPSULE_RADIUS) return;

    // Vertical bounds check: closest point Y must be within capsule height range
    const minY = playerPos.y - 0.1;
    const maxY = playerPos.y + Laser.CAPSULE_HEIGHT;

    if (closest.y < minY || closest.y > maxY) return;

    AlarmSystem.increase(2);
  }

  /**
   * Deactivate the laser permanently — hides mesh and disables detection.
   */
  deactivate() {
    this.#isActive = false;
    this.#mesh.isVisible = false;
  }

  /**
   * Dispose the tube mesh and its material.
   */
  dispose() {
    if (this.#mesh) {
      if (this.#mesh.material) {
        this.#mesh.material.dispose();
      }
      this.#mesh.dispose();
      this.#mesh = null;
    }
  }

  /**
   * Find the closest point on the segment (start→end) to a given point.
   * @param {BABYLON.Vector3} point
   * @returns {BABYLON.Vector3}
   */
  #closestPointOnSegment(point) {
    const ab = this.#end.subtract(this.#start);
    const ap = point.subtract(this.#start);

    const abLenSq = ab.x * ab.x + ab.y * ab.y + ab.z * ab.z;

    // Degenerate segment (start === end)
    if (abLenSq === 0) return this.#start.clone();

    // Project ap onto ab, clamped to [0, 1]
    const t = Math.max(0, Math.min(1, BABYLON.Vector3.Dot(ap, ab) / abLenSq));

    return this.#start.add(ab.scale(t));
  }
}
