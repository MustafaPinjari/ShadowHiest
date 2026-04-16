/**
 * Collectible.js — IInteractable collectible asset entity
 * A glowing gold box the player can pick up by pressing E.
 *
 * Requirements: 10.1, 10.2
 */
export class Collectible {
  /** @type {BABYLON.Mesh} */
  #mesh;

  /** @type {string} */
  #id;

  /** @type {boolean} */
  #collected = false;

  /**
   * @param {BABYLON.Scene} scene
   * @param {{ id: string, position: BABYLON.Vector3, label?: string }} options
   */
  constructor(scene, { id, position, label }) {
    this.#id = id;

    // Create a small gold box (0.4 × 0.4 × 0.4)
    this.#mesh = BABYLON.MeshBuilder.CreateBox(
      `collectible_${id}`,
      { size: 0.4 },
      scene,
    );
    this.#mesh.position = position.clone();

    // Gold/yellow emissive material
    const mat = new BABYLON.StandardMaterial(`mat_collectible_${id}`, scene);
    mat.diffuseColor  = new BABYLON.Color3(0.8, 0.6, 0);
    mat.emissiveColor = new BABYLON.Color3(1, 0.8, 0);
    this.#mesh.material = mat;

    // Register as interactable so Player.js interaction system can find it
    this.#mesh.metadata = { interactable: true, entity: this };
  }

  /**
   * Called by the player interaction system when the player presses E nearby.
   * @param {import('./Player.js').default} player
   */
  interact(player) {
    if (this.#collected) return;
    this.#collected = true;
    player.collectAsset(this.#id);
    this.#mesh.isVisible = false;
    this.#mesh.metadata.interactable = false;
  }

  /**
   * Rotate the collectible — call once per frame.
   * @param {number} delta  Frame delta time in seconds
   */
  update(delta) {
    if (!this.#collected) {
      this.#mesh.rotation.y += delta * 1.5;
    }
  }

  /** @returns {BABYLON.Mesh} */
  get mesh() {
    return this.#mesh;
  }

  dispose() {
    this.#mesh?.dispose();
  }
}
