/**
 * ExteriorScene.js — Bank rooftop exterior scene
 * Contains the rooftop landing pad, skybox, and helicopter spawn point.
 * Plays the helicopter entry cinematic, then transitions to InteriorScene.
 * Requirements: 4.1, 2.1, 2.2, 2.3, 2.4
 */
import { sceneManager } from '../core/SceneManager.js';
import { Helicopter } from '../entities/Helicopter.js';
import { InteriorScene } from './InteriorScene.js';

export class ExteriorScene {
  /** @type {BABYLON.Scene|null} */
  #scene = null;

  /** @type {BABYLON.Engine|null} */
  #engine = null;

  // ── Spawn / marker references ────────────────────────────────────────────────

  /** @type {BABYLON.Mesh|null} Landing pad mesh */
  #landingPad = null;

  /** @type {BABYLON.TransformNode|null} Helicopter spawn point marker */
  #helicopterSpawn = null;

  /** @type {BABYLON.Mesh|null} Rooftop access door trigger zone */
  #accessTrigger = null;

  /** @type {Helicopter|null} */
  #helicopter = null;

  /** @type {BABYLON.ArcRotateCamera|null} */
  #camera = null;

  // ── Scene interface ──────────────────────────────────────────────────────────

  /**
   * @param {import('../core/Engine.js').Engine} engine
   */
  init(engine) {
    this.#engine = engine;
    const babylonEngine = engine.babylonEngine;

    this.#scene = new BABYLON.Scene(babylonEngine);
    this.#scene.clearColor = new BABYLON.Color4(0.53, 0.81, 0.98, 1); // sky blue

    this.#buildLighting();
    this.#buildSkybox();
    this.#buildRooftop();
    this.#buildLandingPad();
    this.#buildHelicopterSpawn();
    this.#buildAccessTrigger();
    this.#camera = this.#buildCamera();

    // Spawn helicopter and start entry cinematic
    this.#helicopter = new Helicopter(this.#scene);
    this.#helicopter.startEntry(this.#camera, () => {
      // Helicopter has landed — transition to interior scene
      sceneManager.loadScene(InteriorScene);
    });

    // Performance budget audit — runs once after scene is fully built.
    // Budget: < 500,000 triangles, all textures ≤ 1024×1024px (Requirements 15.4, 15.5)
    engine.auditScene(this.#scene);
  }

  /** @param {number} delta */
  update(delta) {
    this.#helicopter?.update(delta);
    this.#scene?.render();
  }

  dispose() {
    this.#helicopter?.dispose();
    this.#scene?.dispose();
    this.#scene = null;
  }

  // ── Public accessors ─────────────────────────────────────────────────────────

  /**
   * World position of the helicopter spawn point (above the landing pad).
   * @returns {BABYLON.Vector3}
   */
  get helicopterSpawnPosition() {
    return this.#helicopterSpawn
      ? this.#helicopterSpawn.getAbsolutePosition()
      : new BABYLON.Vector3(0, 20, 0);
  }

  /**
   * World position of the landing pad centre.
   * @returns {BABYLON.Vector3}
   */
  get landingPadPosition() {
    return this.#landingPad
      ? this.#landingPad.getAbsolutePosition()
      : BABYLON.Vector3.Zero();
  }

  /**
   * The underlying Babylon.js scene.
   * @returns {BABYLON.Scene|null}
   */
  get babylonScene() {
    return this.#scene;
  }

  // ── Private builders ─────────────────────────────────────────────────────────

  #buildLighting() {
    // Directional sun light
    const sun = new BABYLON.DirectionalLight(
      'sun',
      new BABYLON.Vector3(-1, -2, -1),
      this.#scene,
    );
    sun.intensity = 1.2;
    sun.diffuse   = new BABYLON.Color3(1, 0.95, 0.85);

    // Ambient hemisphere light for sky/ground bounce
    const hemi = new BABYLON.HemisphericLight(
      'hemi',
      new BABYLON.Vector3(0, 1, 0),
      this.#scene,
    );
    hemi.intensity    = 0.4;
    hemi.groundColor  = new BABYLON.Color3(0.2, 0.2, 0.25);
  }

  #buildSkybox() {
    const skybox = BABYLON.MeshBuilder.CreateBox(
      'skybox',
      { size: 1000 },
      this.#scene,
    );

    const mat = new BABYLON.StandardMaterial('skyboxMat', this.#scene);
    mat.backFaceCulling = false;
    mat.disableLighting = true;

    // Gradient sky colour using emissive — no external texture required
    mat.emissiveColor = new BABYLON.Color3(0.53, 0.81, 0.98);
    skybox.material   = mat;
    skybox.infiniteDistance = true;
    skybox.isPickable = false;
  }

  #buildRooftop() {
    // Flat rooftop surface (50 × 50 m)
    const roof = BABYLON.MeshBuilder.CreateBox(
      'rooftop',
      { width: 50, height: 1, depth: 50 },
      this.#scene,
    );
    roof.position.y = -0.5; // top face sits at y = 0

    const mat = new BABYLON.StandardMaterial('rooftopMat', this.#scene);
    mat.diffuseColor = new BABYLON.Color3(0.35, 0.35, 0.38);
    roof.material    = mat;
    roof.isPickable  = false;

    // Low parapet walls around the perimeter
    this.#buildParapet();
  }

  #buildParapet() {
    const parapetMat = new BABYLON.StandardMaterial('parapetMat', this.#scene);
    parapetMat.diffuseColor = new BABYLON.Color3(0.4, 0.4, 0.42);

    const walls = [
      { pos: new BABYLON.Vector3(0,  0.5, -25), size: { width: 50, height: 1, depth: 0.5 } },
      { pos: new BABYLON.Vector3(0,  0.5,  25), size: { width: 50, height: 1, depth: 0.5 } },
      { pos: new BABYLON.Vector3(-25, 0.5, 0),  size: { width: 0.5, height: 1, depth: 50 } },
      { pos: new BABYLON.Vector3( 25, 0.5, 0),  size: { width: 0.5, height: 1, depth: 50 } },
    ];

    for (let i = 0; i < walls.length; i++) {
      const w = walls[i];
      const mesh = BABYLON.MeshBuilder.CreateBox(`parapet_${i}`, w.size, this.#scene);
      mesh.position.copyFrom(w.pos);
      mesh.material  = parapetMat;
      mesh.isPickable = false;
    }
  }

  #buildLandingPad() {
    // Circular landing pad (radius 5 m) centred on the rooftop
    this.#landingPad = BABYLON.MeshBuilder.CreateCylinder(
      'landingPad',
      { diameter: 10, height: 0.05, tessellation: 32 },
      this.#scene,
    );
    this.#landingPad.position.y = 0.025; // just above rooftop surface

    const mat = new BABYLON.StandardMaterial('landingPadMat', this.#scene);
    mat.diffuseColor  = new BABYLON.Color3(0.9, 0.75, 0.1);
    mat.emissiveColor = new BABYLON.Color3(0.15, 0.12, 0.0);
    this.#landingPad.material  = mat;
    this.#landingPad.isPickable = false;

    // "H" marking — thin cross disc
    const hMark = BABYLON.MeshBuilder.CreateBox(
      'hMark',
      { width: 0.4, height: 0.06, depth: 5 },
      this.#scene,
    );
    hMark.position.y = 0.03;
    const hMat = new BABYLON.StandardMaterial('hMarkMat', this.#scene);
    hMat.diffuseColor  = new BABYLON.Color3(1, 1, 1);
    hMat.emissiveColor = new BABYLON.Color3(0.3, 0.3, 0.3);
    hMark.material     = hMat;
    hMark.isPickable   = false;

    const hMark2 = hMark.clone('hMark2');
    hMark2.rotation.y = Math.PI / 2;
  }

  #buildHelicopterSpawn() {
    // Invisible transform node marking where the helicopter starts (above the pad)
    this.#helicopterSpawn = new BABYLON.TransformNode('helicopterSpawn', this.#scene);
    this.#helicopterSpawn.position = new BABYLON.Vector3(0, 20, -15);
  }

  #buildAccessTrigger() {
    // Rooftop access door / stairwell opening — trigger zone for scene transition
    this.#accessTrigger = BABYLON.MeshBuilder.CreateBox(
      'rooftopAccess',
      { width: 2, height: 2.2, depth: 0.2 },
      this.#scene,
    );
    this.#accessTrigger.position = new BABYLON.Vector3(0, 1.1, -20);

    const mat = new BABYLON.StandardMaterial('accessMat', this.#scene);
    mat.diffuseColor = new BABYLON.Color3(0.6, 0.4, 0.2);
    this.#accessTrigger.material  = mat;
    this.#accessTrigger.isPickable = false;

    // Metadata marks this as the interior transition trigger
    this.#accessTrigger.metadata = { interiorTransition: true };
  }

  #buildCamera() {
    // Overview camera for the exterior scene (used during cinematic / before player control)
    const cam = new BABYLON.ArcRotateCamera(
      'exteriorCam',
      -Math.PI / 2,
      Math.PI / 3,
      30,
      BABYLON.Vector3.Zero(),
      this.#scene,
    );
    cam.lowerRadiusLimit = 10;
    cam.upperRadiusLimit = 60;
    return cam;
  }
}
