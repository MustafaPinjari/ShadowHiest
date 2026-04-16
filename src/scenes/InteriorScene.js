/**
 * InteriorScene.js — Bank interior gameplay scene
 * Rooms: lobby, hallways, security office, staff rooms, vault corridor, vault room, escape zone.
 * All wall/floor meshes receive PhysicsImpostor (static) so player and guards cannot pass through.
 * Requirements: 4.1, 4.2, 4.3
 */
import InputSystem from '../systems/InputSystem.js';
import Player from '../entities/Player.js';
import { placeDoors } from '../entities/Door.js';
import { populateInteriorProps } from '../utils/InstancedProps.js';
import { SecurityCamera, CameraControlPanel } from '../entities/Camera.js';
import { Guard } from '../entities/Guard.js';
import { buildInteriorWaypointGraph, GUARD_PATROL_PATHS } from '../utils/Waypoint.js';
import AlarmSystem from '../systems/AlarmSystem.js';
import { Laser } from '../entities/Laser.js';
import { VaultPuzzle } from '../puzzles/VaultPuzzle.js';
import { LaserPuzzle } from '../puzzles/LaserPuzzle.js';
import { Collectible } from '../entities/Collectible.js';
import { gameState } from '../core/GameState.js';
import { EscapeTimer } from '../systems/EscapeTimer.js';
import { decisionTracker } from '../systems/DecisionTracker.js';
import { HUD } from '../ui/HUD.js';
import { sceneManager } from '../core/SceneManager.js';

// ── Layout constants (all in metres) ────────────────────────────────────────
const WALL_H   = 3.5;   // standard ceiling height
const WALL_T   = 0.3;   // wall thickness
const FLOOR_T  = 0.2;   // floor slab thickness

export class InteriorScene {
  /** @type {BABYLON.Scene|null} */
  #scene = null;

  /** @type {import('../core/Engine.js').Engine|null} */
  #engine = null;

  /** @type {InputSystem|null} */
  #input = null;

  /** @type {Player|null} */
  #player = null;

  /** @type {BABYLON.Mesh[]} All static collision meshes */
  #staticMeshes = [];

  /** @type {import('../entities/Door.js').Door[]} */
  #doors = [];

  /** @type {import('../entities/Camera.js').SecurityCamera[]} */
  #cameras = [];

  /** @type {import('../entities/Camera.js').CameraControlPanel[]} */
  #controlPanels = [];

  /** @type {import('../entities/Guard.js').Guard[]} */
  #guards = [];

  /** @type {Laser[]} */
  #lasers = [];

  /** @type {VaultPuzzle|null} */
  #vaultPuzzle = null;

  /** @type {LaserPuzzle|null} */
  #laserPuzzle = null;

  /** @type {Collectible[]} */
  #collectibles = [];

  /** @type {Array<{ mesh: BABYLON.Mesh, thrown: boolean }>} */
  #distractionItems = [];

  /** @type {boolean} */
  #vaultUnlocked = false;

  /** @type {{ triggerLose(reason: string): void }|null} */
  #gameState = null;

  /** @type {BABYLON.Mesh|null} Escape zone trigger pad */
  #escapePad = null;

  /** @type {EscapeTimer} */
  #escapeTimer = null;

  /** @type {HUD|null} */
  #hud = null;

  // ── Shared materials (created once, reused) ──────────────────────────────────
  /** @type {Map<string, BABYLON.StandardMaterial>} */
  #mats = new Map();

  // ── Scene interface ──────────────────────────────────────────────────────────

  /**
   * @param {import('../core/Engine.js').Engine} engine
   */
  init(engine) {
    this.#engine = engine;
    const babylonEngine = engine.babylonEngine;

    this.#scene = new BABYLON.Scene(babylonEngine);
    this.#scene.clearColor = new BABYLON.Color4(0.05, 0.05, 0.07, 1);

    // Enable physics (Cannon.js plugin bundled with Babylon.js CDN)
    this.#enablePhysics();

    this.#buildMaterials();
    this.#buildLighting();
    this.#buildRooms();
    this.#buildEscapeZone();
    this.#doors = placeDoors(this.#scene);
    populateInteriorProps(this.#scene, WALL_H);

    // Input + player
    this.#input  = new InputSystem();
    this.#player = new Player(this.#scene, this.#input);
    this.#player.position.set(0, 1, 8); // lobby centre, clear of walls

    // Security cameras
    this.#cameras      = placeCameras(this.#scene);
    this.#controlPanels = placeControlPanels(this.#scene, this.#cameras);

    // Guards
    this.#guards = placeGuards(this.#scene);

    // Lasers in vault corridor
    this.#lasers = placeLasers(this.#scene);

    // Puzzle instances
    this.#vaultPuzzle = new VaultPuzzle();
    this.#laserPuzzle = new LaserPuzzle(this.#lasers);

    // Wire interactable entities to vault door and laser panel meshes
    this.#wireInteractables();

    // Place collectible assets in the vault room
    this.#placeCollectibles(this.#scene);

    // Place throwable distraction items in staff rooms
    this.#placeDistractionItems(this.#scene);

    // Escape timer
    this.#escapeTimer = new EscapeTimer();
    this.#escapeTimer.setGameState(gameState);
    this.#escapeTimer.start();

    // Forward alarm level changes to escape timer
    AlarmSystem.onLevelChange((level) => {
      this.#escapeTimer.onAlertLevelChange(level);
    });

    // HUD — mount and wire to AlarmSystem + EscapeTimer
    this.#hud = new HUD(this.#collectibles.length);
    this.#hud.mount();
    this.#hud.setObjective('Reach the vault and steal the assets');
    this.#hud.wire(AlarmSystem, this.#escapeTimer);

    // Configure gameState and wire guards
    gameState.configure({
      engine: this.#engine,
      sceneManager,
      player: this.#player,
      decisionTracker: decisionTracker,
    });
    this.setGameState(gameState);

    // Performance budget audit — runs once after scene is fully built.
    // Budget: < 500,000 triangles, all textures ≤ 1024×1024px (Requirements 15.4, 15.5)
    engine.auditScene(this.#scene);
  }

  /** @param {number} delta */
  update(delta) {
    if (!this.#scene) return;
    this.#input?.update();
    this.#player?.update(delta);
    AlarmSystem.update(delta);
    this.#escapeTimer?.update(delta);
    for (const cam of this.#cameras) {
      cam.update(delta, this.#player);
    }
    for (const guard of this.#guards) {
      guard.update(delta, this.#player);
    }
    for (const laser of this.#lasers) {
      laser.update(this.#player);
    }
    for (const collectible of this.#collectibles) {
      collectible.update(delta);
    }
    // Update HUD asset counter each frame
    if (this.#hud && this.#player) {
      this.#hud.setAssets(this.#player.inventory.length, this.#collectibles.length);
    }
    this.#checkEscapeZone();
    this.#scene.render();
  }

  dispose() {
    this.#hud?.unmount();
    this.#player?.dispose();
    this.#input?.dispose();
    for (const door of this.#doors) door.dispose();
    for (const cam of this.#cameras) cam.dispose();
    for (const panel of this.#controlPanels) panel.dispose();
    for (const guard of this.#guards) guard.dispose();
    for (const laser of this.#lasers) laser.dispose();
    for (const collectible of this.#collectibles) collectible.dispose();
    this.#scene?.dispose();
    this.#scene  = null;
    this.#player = null;
    this.#input  = null;
  }

  // ── Public accessors ─────────────────────────────────────────────────────────

  /** @returns {BABYLON.Scene|null} */
  get babylonScene() { return this.#scene; }

  /** @returns {Player|null} */
  get player() { return this.#player; }

  /** @returns {Laser[]} */
  get lasers() { return this.#lasers; }

  /**
   * Wire the GameState so guards can trigger the lose condition.
   * Call this after init() once GameState is available.
   * @param {{ triggerLose(reason: string): void }} gameState
   */
  setGameState(gameState) {
    this.#gameState = gameState;
    for (const guard of this.#guards) {
      guard.setGameState(gameState);
    }
  }

  // ── Private: place distraction items ────────────────────────────────────────

  /**
   * Create 3 throwable distraction items (small grey spheres) in the staff rooms.
   * @param {BABYLON.Scene} scene
   */
  #placeDistractionItems(scene) {
    const positions = [
      new BABYLON.Vector3(12, 0.15, -2),
      new BABYLON.Vector3(14, 0.15, -6),
      new BABYLON.Vector3(-16, 0.15, -4),
    ];

    for (const pos of positions) {
      const mesh = BABYLON.MeshBuilder.CreateSphere(
        `distraction_${this.#distractionItems.length}`,
        { diameter: 0.3 },
        scene,
      );
      mesh.position.copyFrom(pos);

      const mat = new BABYLON.StandardMaterial(`distraction_mat_${this.#distractionItems.length}`, scene);
      mat.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);
      mesh.material = mat;

      const item = { mesh, thrown: false };
      mesh.metadata = {
        interactable: true,
        entity: { interact: (player) => this.#throwDistraction(item, player) },
      };

      this.#distractionItems.push(item);
    }
  }

  /**
   * Throw a distraction item: hide it and lure the nearest guard within 8m.
   * @param {{ mesh: BABYLON.Mesh, thrown: boolean }} item
   * @param {import('../entities/Player.js').default} player
   */
  #throwDistraction(item, player) {
    if (item.thrown) return;
    item.thrown = true;
    item.mesh.isVisible = false;

    const itemPosition = item.mesh.position;
    let nearestGuard = null;
    let nearestDist = 8;

    for (const guard of this.#guards) {
      const dist = BABYLON.Vector3.Distance(guard.mesh.position, itemPosition);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestGuard = guard;
      }
    }

    if (nearestGuard) {
      nearestGuard.distract(itemPosition);
    }
  }

  // ── Private: place collectibles ─────────────────────────────────────────────

  /**
   * Create 3 collectible assets inside the vault room.
   * @param {BABYLON.Scene} scene
   */
  #placeCollectibles(scene) {
    const defs = [
      { id: 'gold_bar',   position: new BABYLON.Vector3(-2, 0.2, -30), label: 'Gold Bar'   },
      { id: 'documents',  position: new BABYLON.Vector3( 0, 0.2, -32), label: 'Documents'  },
      { id: 'hard_drive', position: new BABYLON.Vector3( 2, 0.2, -30), label: 'Hard Drive' },
    ];
    for (const def of defs) {
      this.#collectibles.push(new Collectible(scene, def));
    }
  }

  // ── Private: wire interactables ─────────────────────────────────────────────

  #wireInteractables() {
    // Vault door
    const vaultDoorMesh = this.#scene.getMeshByName('vaultDoor');
    if (vaultDoorMesh) {
      vaultDoorMesh.metadata.entity = {
        interact: (_player) => {
          if (this.#vaultUnlocked) return; // already open
          this.#vaultPuzzle.open(
            {
              unlock: () => {
                this.#vaultUnlocked = true;
                vaultDoorMesh.isVisible = false; // hide door on unlock
              },
            },
            null,
          );
        },
      };
    }

    // Laser panel
    const laserPanelMesh = this.#scene.getMeshByName('laserPanel');
    if (laserPanelMesh) {
      laserPanelMesh.metadata.entity = {
        interact: (_player) => {
          this.#laserPuzzle.open(null);
        },
      };
    }
  }

  // ── Private: physics ─────────────────────────────────────────────────────────

  #enablePhysics() {
    try {
      const gravityVector = new BABYLON.Vector3(0, -9.81, 0);
      const physicsPlugin  = new BABYLON.CannonJSPlugin();
      this.#scene.enablePhysics(gravityVector, physicsPlugin);
    } catch (err) {
      console.warn('InteriorScene: physics plugin unavailable — static collision disabled.', err);
    }
  }

  // ── Private: materials ───────────────────────────────────────────────────────

  #buildMaterials() {
    const defs = {
      floor:    [0.55, 0.50, 0.45],
      wall:     [0.72, 0.70, 0.68],
      ceiling:  [0.85, 0.85, 0.85],
      vault:    [0.30, 0.32, 0.35],
      corridor: [0.40, 0.42, 0.45],
      escape:   [0.10, 0.80, 0.30],
    };
    for (const [key, rgb] of Object.entries(defs)) {
      const mat = new BABYLON.StandardMaterial(`mat_${key}`, this.#scene);
      mat.diffuseColor = new BABYLON.Color3(...rgb);
      this.#mats.set(key, mat);
    }
  }

  // ── Private: lighting ────────────────────────────────────────────────────────

  #buildLighting() {
    // Ambient fill
    const hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0, 1, 0), this.#scene);
    hemi.intensity   = 0.5;
    hemi.groundColor = new BABYLON.Color3(0.1, 0.1, 0.12);

    // Lobby overhead point light
    const lobby = new BABYLON.PointLight('lobbyLight', new BABYLON.Vector3(0, WALL_H - 0.3, 0), this.#scene);
    lobby.intensity = 0.8;
    lobby.range     = 20;

    // Vault corridor strip light
    const corridor = new BABYLON.PointLight('corridorLight', new BABYLON.Vector3(0, WALL_H - 0.3, -30), this.#scene);
    corridor.intensity = 0.6;
    corridor.range     = 15;
    corridor.diffuse   = new BABYLON.Color3(0.8, 0.2, 0.2); // red tint for tension
  }

  // ── Private: room builders ───────────────────────────────────────────────────

  /**
   * Build all rooms. Layout (top-down, Z = depth):
   *
   *   Z=+20  ┌──────────────────────────────────┐
   *          │         LOBBY  (20×20)            │
   *   Z=0    ├──────────┬───────────┬────────────┤
   *          │ SEC OFF  │  HALLWAY  │ STAFF ROOM │
   *   Z=-8   ├──────────┴───────────┴────────────┤
   *          │         HALLWAY (40×6)            │
   *   Z=-14  ├──────────────────────────────────┤
   *          │       VAULT CORRIDOR (8×12)       │
   *   Z=-26  ├──────────────────────────────────┤
   *          │         VAULT ROOM (12×10)        │
   *   Z=-36  └──────────────────────────────────┘
   */
  #buildRooms() {
    this.#buildLobby();
    this.#buildSecurityOffice();
    this.#buildMainHallway();
    this.#buildStaffRooms();
    this.#buildVaultCorridor();
    this.#buildVaultRoom();
  }

  // ── Lobby ────────────────────────────────────────────────────────────────────

  #buildLobby() {
    // Floor
    this.#addStaticBox('lobby_floor', 20, FLOOR_T, 20, 0, -FLOOR_T / 2, 10, 'floor');
    // Ceiling
    this.#addStaticBox('lobby_ceil',  20, FLOOR_T, 20, 0, WALL_H + FLOOR_T / 2, 10, 'ceiling');
    // Walls
    this.#addStaticBox('lobby_N', 20, WALL_H, WALL_T, 0, WALL_H / 2, 20, 'wall');
    this.#addStaticBox('lobby_S', 20, WALL_H, WALL_T, 0, WALL_H / 2,  0, 'wall');
    // East wall (leave gap for hallway opening at x=10, z=5)
    this.#addStaticBox('lobby_E1', WALL_T, WALL_H, 12, 10, WALL_H / 2, 14, 'wall');
    this.#addStaticBox('lobby_E2', WALL_T, WALL_H,  5, 10, WALL_H / 2,  2.5, 'wall');
    // West wall (leave gap for security office at x=-10, z=5)
    this.#addStaticBox('lobby_W1', WALL_T, WALL_H, 12, -10, WALL_H / 2, 14, 'wall');
    this.#addStaticBox('lobby_W2', WALL_T, WALL_H,  5, -10, WALL_H / 2,  2.5, 'wall');

    // Reception desk (decorative, collidable)
    this.#addStaticBox('reception', 4, 1.1, 1.2, 0, 0.55, 15, 'wall');
  }

  // ── Security office ──────────────────────────────────────────────────────────

  #buildSecurityOffice() {
    // 8×8 room at x=-14..−10, z=0..−8
    this.#addStaticBox('sec_floor', 8, FLOOR_T, 8, -14, -FLOOR_T / 2, -4, 'floor');
    this.#addStaticBox('sec_ceil',  8, FLOOR_T, 8, -14, WALL_H + FLOOR_T / 2, -4, 'ceiling');
    this.#addStaticBox('sec_W',  WALL_T, WALL_H, 8, -18, WALL_H / 2, -4, 'wall');
    this.#addStaticBox('sec_S',  8, WALL_H, WALL_T, -14, WALL_H / 2, -8, 'wall');
    this.#addStaticBox('sec_N1', 3, WALL_H, WALL_T, -16.5, WALL_H / 2, 0, 'wall'); // gap for door
    this.#addStaticBox('sec_N2', 3, WALL_H, WALL_T, -11.5, WALL_H / 2, 0, 'wall');

    // Camera control panel (interactable — wired in Task 8)
    const panel = this.#addStaticBox('camPanel', 0.8, 1.2, 0.3, -17.5, 0.6, -4, 'vault');
    panel.metadata = { interactable: true, type: 'cameraPanel' };
  }

  // ── Main hallway ─────────────────────────────────────────────────────────────

  #buildMainHallway() {
    // Horizontal corridor: x=-18..18, z=-8..−14
    this.#addStaticBox('hall_floor', 36, FLOOR_T, 6, 0, -FLOOR_T / 2, -11, 'floor');
    this.#addStaticBox('hall_ceil',  36, FLOOR_T, 6, 0, WALL_H + FLOOR_T / 2, -11, 'ceiling');
    this.#addStaticBox('hall_N',  36, WALL_H, WALL_T, 0, WALL_H / 2, -8,  'wall');
    this.#addStaticBox('hall_S',  36, WALL_H, WALL_T, 0, WALL_H / 2, -14, 'wall');
    this.#addStaticBox('hall_W',  WALL_T, WALL_H, 6, -18, WALL_H / 2, -11, 'wall');
    this.#addStaticBox('hall_E',  WALL_T, WALL_H, 6,  18, WALL_H / 2, -11, 'wall');
  }

  // ── Staff rooms ──────────────────────────────────────────────────────────────

  #buildStaffRooms() {
    // Two staff rooms on the east side: x=10..18, z=0..−8
    // Room A (north)
    this.#addStaticBox('staffA_floor', 8, FLOOR_T, 4, 14, -FLOOR_T / 2, -2, 'floor');
    this.#addStaticBox('staffA_ceil',  8, FLOOR_T, 4, 14, WALL_H + FLOOR_T / 2, -2, 'ceiling');
    this.#addStaticBox('staffA_E',  WALL_T, WALL_H, 4, 18, WALL_H / 2, -2, 'wall');
    this.#addStaticBox('staffA_S1', 3, WALL_H, WALL_T, 16.5, WALL_H / 2, -4, 'wall'); // gap for door
    this.#addStaticBox('staffA_S2', 3, WALL_H, WALL_T, 11.5, WALL_H / 2, -4, 'wall');

    // Room B (south)
    this.#addStaticBox('staffB_floor', 8, FLOOR_T, 4, 14, -FLOOR_T / 2, -6, 'floor');
    this.#addStaticBox('staffB_ceil',  8, FLOOR_T, 4, 14, WALL_H + FLOOR_T / 2, -6, 'ceiling');
    this.#addStaticBox('staffB_E',  WALL_T, WALL_H, 4, 18, WALL_H / 2, -6, 'wall');
    this.#addStaticBox('staffB_N1', 3, WALL_H, WALL_T, 16.5, WALL_H / 2, -4, 'wall');
    this.#addStaticBox('staffB_N2', 3, WALL_H, WALL_T, 11.5, WALL_H / 2, -4, 'wall');
    this.#addStaticBox('staffB_S',  8, WALL_H, WALL_T, 14, WALL_H / 2, -8, 'wall');
  }

  // ── Vault corridor ───────────────────────────────────────────────────────────

  #buildVaultCorridor() {
    // Narrow corridor: x=-4..4, z=-14..−26
    this.#addStaticBox('vc_floor', 8, FLOOR_T, 12, 0, -FLOOR_T / 2, -20, 'corridor');
    this.#addStaticBox('vc_ceil',  8, FLOOR_T, 12, 0, WALL_H + FLOOR_T / 2, -20, 'ceiling');
    this.#addStaticBox('vc_W',  WALL_T, WALL_H, 12, -4, WALL_H / 2, -20, 'corridor');
    this.#addStaticBox('vc_E',  WALL_T, WALL_H, 12,  4, WALL_H / 2, -20, 'corridor');
    // North wall with door gap (wired in Task 6.3)
    this.#addStaticBox('vc_N1', 3, WALL_H, WALL_T, -2.5, WALL_H / 2, -14, 'corridor');
    this.#addStaticBox('vc_N2', 3, WALL_H, WALL_T,  2.5, WALL_H / 2, -14, 'corridor');

    // Laser disable panel (interactable — wired in Task 12)
    const laserPanel = this.#addStaticBox('laserPanel', 0.6, 1.0, 0.2, -3.5, 0.5, -18, 'vault');
    laserPanel.metadata = { interactable: true, type: 'laserPanel' };
  }

  // ── Vault room ───────────────────────────────────────────────────────────────

  #buildVaultRoom() {
    // 12×10 room: x=-6..6, z=-26..−36
    this.#addStaticBox('vr_floor', 12, FLOOR_T, 10, 0, -FLOOR_T / 2, -31, 'vault');
    this.#addStaticBox('vr_ceil',  12, FLOOR_T, 10, 0, WALL_H + FLOOR_T / 2, -31, 'ceiling');
    this.#addStaticBox('vr_W',  WALL_T, WALL_H, 10, -6, WALL_H / 2, -31, 'vault');
    this.#addStaticBox('vr_E',  WALL_T, WALL_H, 10,  6, WALL_H / 2, -31, 'vault');
    this.#addStaticBox('vr_S',  12, WALL_H, WALL_T,  0, WALL_H / 2, -36, 'vault');
    // North wall — vault door gap (wired in Task 13)
    this.#addStaticBox('vr_N1', 4, WALL_H, WALL_T, -4, WALL_H / 2, -26, 'vault');
    this.#addStaticBox('vr_N2', 4, WALL_H, WALL_T,  4, WALL_H / 2, -26, 'vault');

    // Vault door placeholder (interactable — wired in Task 13)
    const vaultDoor = this.#addStaticBox('vaultDoor', 4, WALL_H, WALL_T, 0, WALL_H / 2, -26, 'vault');
    vaultDoor.metadata = { interactable: true, type: 'vaultDoor', locked: true };
  }

  // ── Escape zone ──────────────────────────────────────────────────────────────

  #buildEscapeZone() {
    // Glowing pad on the rooftop access area (north lobby)
    this.#escapePad = BABYLON.MeshBuilder.CreateCylinder(
      'escapePad',
      { diameter: 3, height: 0.05, tessellation: 32 },
      this.#scene,
    );
    this.#escapePad.position = new BABYLON.Vector3(0, 0.025, 18);

    const mat = new BABYLON.StandardMaterial('escapePadMat', this.#scene);
    mat.diffuseColor  = new BABYLON.Color3(0.1, 0.9, 0.3);
    mat.emissiveColor = new BABYLON.Color3(0.0, 0.3, 0.1);
    mat.alpha         = 0.0; // hidden until player has ≥1 asset (activated in Task 16)
    this.#escapePad.material  = mat;
    this.#escapePad.isPickable = false;

    this.#escapePad.metadata = { type: 'escapeZone' };
  }

  // ── Escape zone check ────────────────────────────────────────────────────────

  #checkEscapeZone() {
    if (!this.#player || !this.#escapePad) return;
    const mat = /** @type {BABYLON.StandardMaterial} */ (this.#escapePad.material);
    const hasAsset = this.#player.inventory.length >= 1;
    mat.alpha = hasAsset ? 0.75 : 0.0;

    if (hasAsset) {
      const padPos = this.#escapePad.position;
      const playerPos = this.#player.position;
      const dx = playerPos.x - padPos.x;
      const dz = playerPos.z - padPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist <= 2.0) {
        gameState.triggerWin();
      }
    }
  }

  // ── Utility: static box factory ──────────────────────────────────────────────

  /**
   * Create a box mesh with a PhysicsImpostor (mass=0 → static).
   * @param {string} name
   * @param {number} w Width
   * @param {number} h Height
   * @param {number} d Depth
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {string} matKey
   * @returns {BABYLON.Mesh}
   */
  #addStaticBox(name, w, h, d, x, y, z, matKey) {
    const mesh = BABYLON.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, this.#scene);
    mesh.position.set(x, y, z);
    mesh.material  = this.#mats.get(matKey) ?? null;
    mesh.isPickable = false;

    try {
      new BABYLON.PhysicsImpostor(
        mesh,
        BABYLON.PhysicsImpostor.BoxImpostor,
        { mass: 0, restitution: 0.1, friction: 0.8 },
        this.#scene,
      );
    } catch {
      // Physics not available — mesh still provides visual geometry
    }

    this.#staticMeshes.push(mesh);
    return mesh;
  }
}

// ── Laser placement helper ────────────────────────────────────────────────────

/**
 * Place 5 laser beams spanning the vault corridor width at staggered heights.
 * Corridor: x=-4..4, z=-14..-26, floor y=0, ceiling y=3.5
 *
 * @param {BABYLON.Scene} scene
 * @returns {Laser[]}
 */
function placeLasers(scene) {
  return [
    new Laser(scene, { name: 'laser_1', start: new BABYLON.Vector3(-3.5, 0.5, -16), end: new BABYLON.Vector3(3.5, 0.5, -16) }),
    new Laser(scene, { name: 'laser_2', start: new BABYLON.Vector3(-3.5, 1.2, -18), end: new BABYLON.Vector3(3.5, 1.2, -18) }),
    new Laser(scene, { name: 'laser_3', start: new BABYLON.Vector3(-3.5, 0.8, -20), end: new BABYLON.Vector3(3.5, 0.8, -20) }),
    new Laser(scene, { name: 'laser_4', start: new BABYLON.Vector3(-3.5, 1.5, -22), end: new BABYLON.Vector3(3.5, 1.5, -22) }),
    new Laser(scene, { name: 'laser_5', start: new BABYLON.Vector3(-3.5, 0.6, -24), end: new BABYLON.Vector3(3.5, 0.6, -24) }),
  ];
}

// ── Camera placement helpers ─────────────────────────────────────────────────

/**
 * Instantiate the 4 required security cameras in the interior scene.
 *
 * Camera positions (based on room layout in #buildRooms):
 *   1. Lobby camera 1  — near south entrance, sweeps main door area
 *   2. Lobby camera 2  — north lobby wall, covers reception desk
 *   3. Hallway camera  — main hallway connecting lobby to vault corridor
 *   4. Vault corridor  — entrance to vault corridor
 *
 * @param {BABYLON.Scene} scene
 * @returns {SecurityCamera[]}
 */
function placeCameras(scene) {
  return [
    // 1. Lobby south entrance — mounted on south wall, sweeps left/right
    new SecurityCamera(scene, {
      name:          'cam_lobby_S',
      position:      new BABYLON.Vector3(0, WALL_H - 0.3, 1),
      minAngle:      -60,
      maxAngle:       60,
      rotationSpeed:  25,
    }),

    // 2. Lobby north wall — covers reception desk area
    new SecurityCamera(scene, {
      name:          'cam_lobby_N',
      position:      new BABYLON.Vector3(0, WALL_H - 0.3, 19),
      minAngle:       120,
      maxAngle:       240,
      rotationSpeed:  20,
    }),

    // 3. Main hallway — mounted mid-hallway, sweeps east-west
    new SecurityCamera(scene, {
      name:          'cam_hallway',
      position:      new BABYLON.Vector3(0, WALL_H - 0.3, -11),
      minAngle:      -45,
      maxAngle:       45,
      rotationSpeed:  30,
    }),

    // 4. Vault corridor entrance — mounted at north end of corridor
    new SecurityCamera(scene, {
      name:          'cam_vault_corridor',
      position:      new BABYLON.Vector3(0, WALL_H - 0.3, -15),
      minAngle:       150,
      maxAngle:       210,
      rotationSpeed:  20,
    }),
  ];
}

/**
 * Create a CameraControlPanel near each camera so the player can disable it.
 * Panels are placed 1.2m in front of and slightly below each camera mount.
 *
 * @param {BABYLON.Scene} scene
 * @param {SecurityCamera[]} cameras
 * @returns {CameraControlPanel[]}
 */
function placeControlPanels(scene, cameras) {
  // Panel offsets relative to each camera's position (within 1.5m)
  const offsets = [
    new BABYLON.Vector3( 1.2, -WALL_H + 1.5,  0),   // lobby S panel — to the right
    new BABYLON.Vector3(-1.2, -WALL_H + 1.5,  0),   // lobby N panel — to the left
    new BABYLON.Vector3( 0,   -WALL_H + 1.5,  1.2), // hallway panel — in front
    new BABYLON.Vector3( 0,   -WALL_H + 1.5,  1.2), // vault corridor panel — in front
  ];

  return cameras.map((cam, i) => {
    const panelPos = cam.mesh.position.add(offsets[i]);
    return new CameraControlPanel(
      scene,
      cam,
      panelPos,
      `camPanel_${i}`,
    );
  });
}

// ── Guard placement helper ────────────────────────────────────────────────────

/**
 * Instantiate 3 guards with assigned waypoint patrol paths.
 * Uses the interior waypoint graph defined in Waypoint.js.
 *
 * Guard assignments:
 *   Guard 0 — Lobby patrol (covers main entrance and reception)
 *   Guard 1 — Hallway patrol (covers connecting corridor)
 *   Guard 2 — Vault corridor patrol (covers approach to vault)
 *
 * @param {BABYLON.Scene} scene
 * @returns {import('../entities/Guard.js').Guard[]}
 */
function placeGuards(scene) {
  const graph = buildInteriorWaypointGraph();

  /**
   * Resolve an array of node IDs to WaypointNode instances.
   * @param {string[]} ids
   * @returns {import('../utils/Waypoint.js').WaypointNode[]}
   */
  function resolveNodes(ids) {
    return ids.map(id => graph.getNode(id)).filter(Boolean);
  }

  const guards = [
    // Guard 0: Lobby patrol
    new Guard(scene, {
      id:         '0',
      position:   new BABYLON.Vector3(0, 0, 10),
      patrolPath: resolveNodes(GUARD_PATROL_PATHS.guard_0),
    }),

    // Guard 1: Hallway patrol
    new Guard(scene, {
      id:         '1',
      position:   new BABYLON.Vector3(-12, 0, -11),
      patrolPath: resolveNodes(GUARD_PATROL_PATHS.guard_1),
    }),

    // Guard 2: Vault corridor patrol
    new Guard(scene, {
      id:         '2',
      position:   new BABYLON.Vector3(0, 0, -16),
      patrolPath: resolveNodes(GUARD_PATROL_PATHS.guard_2),
    }),
  ];

  // Wire guards together for alert broadcasting
  for (const guard of guards) {
    guard.setAllGuards(guards);
  }

  return guards;
}
