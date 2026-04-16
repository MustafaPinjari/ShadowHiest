/**
 * Guard.js — AI guard entity with 5-state FSM and waypoint patrol.
 *
 * States: Idle → Suspicious → Alert → Chase → Return
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10
 */
import AlarmSystem from '../systems/AlarmSystem.js';
import { WaypointNode } from '../utils/Waypoint.js';
import { decisionTracker } from '../systems/DecisionTracker.js';

// ── Constants ────────────────────────────────────────────────────────────────

/** Guard movement speeds (m/s) per state */
const SPEED = {
  Idle:       2,
  Suspicious: 3,
  Alert:      4,
  Chase:      5,
  Return:     2,
};

/** Detection parameters */
const DETECTION_RANGE     = 10;   // metres
const DETECTION_HALF_ARC  = 45;   // degrees (forward half-angle)
const DETECTION_HALF_RAD  = (DETECTION_HALF_ARC * Math.PI) / 180;

/** FSM timer thresholds */
const LOS_TO_ALERT_TIME   = 2;    // seconds of continuous LOS → Suspicious→Alert
const LOST_LOS_REVERT_TIME = 5;   // seconds without LOS → Alert→Suspicious
const CATCH_DISTANCE      = 1;    // metres — triggers lose condition

/** How close to a waypoint before advancing to the next (metres) */
const WAYPOINT_ARRIVE_DIST = 0.5;

/** Capsule dimensions */
const GUARD_HEIGHT = 1.8;
const GUARD_RADIUS = 0.35;

// ── Guard states ─────────────────────────────────────────────────────────────

/** @typedef {'Idle'|'Suspicious'|'Alert'|'Chase'|'Return'} GuardState */

// ── Guard class ───────────────────────────────────────────────────────────────

export class Guard {
  // ── Private fields ───────────────────────────────────────────────────────────

  /** @type {BABYLON.Scene} */
  #scene;

  /** @type {string} */
  #id;

  /** @type {BABYLON.Mesh} */
  #mesh;

  /** @type {GuardState} */
  #state = 'Idle';

  // Waypoint patrol
  /** @type {WaypointNode[]} Ordered patrol path */
  #patrolPath = [];

  /** @type {number} Index into #patrolPath */
  #patrolIndex = 0;

  // Detection timers
  /** @type {number} Continuous LOS seconds (Suspicious→Alert) */
  #losTimer = 0;

  /** @type {number} Seconds since LOS lost (Alert→Suspicious) */
  #lostLosTimer = 0;

  // Last known player position (used in Suspicious/Alert states)
  /** @type {BABYLON.Vector3|null} */
  #lastKnownPlayerPos = null;

  // Reference to all guards for broadcasting (set externally)
  /** @type {Guard[]} */
  #allGuards = [];

  // GameState reference for lose condition
  /** @type {{ triggerLose(reason: string): void }|null} */
  #gameState = null;

  // ── Constructor ──────────────────────────────────────────────────────────────

  /**
   * @param {BABYLON.Scene} scene
   * @param {object} options
   * @param {string}          options.id           Unique guard identifier
   * @param {BABYLON.Vector3} options.position     Spawn position
   * @param {WaypointNode[]}  options.patrolPath   Ordered waypoint nodes to patrol
   */
  constructor(scene, { id, position, patrolPath }) {
    this.#scene      = scene;
    this.#id         = id;
    this.#patrolPath = patrolPath;

    this.#buildMesh(position);
  }

  // ── Private builders ─────────────────────────────────────────────────────────

  /**
   * Build the guard capsule mesh.
   * @param {BABYLON.Vector3} position
   */
  #buildMesh(position) {
    this.#mesh = BABYLON.MeshBuilder.CreateCapsule(
      `guard_${this.#id}`,
      { height: GUARD_HEIGHT, radius: GUARD_RADIUS },
      this.#scene,
    );
    this.#mesh.position.copyFrom(position);
    this.#mesh.position.y = GUARD_HEIGHT / 2;

    const mat = new BABYLON.StandardMaterial(`guard_${this.#id}_mat`, this.#scene);
    mat.diffuseColor = new BABYLON.Color3(0.2, 0.4, 0.8); // blue uniform
    this.#mesh.material = mat;
    this.#mesh.isPickable = true; // needed for raycasting exclusion
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Register all guards so this guard can broadcast alerts.
   * Call after all guards are instantiated.
   * @param {Guard[]} guards
   */
  setAllGuards(guards) {
    this.#allGuards = guards;
  }

  /**
   * Register the GameState so the guard can trigger the lose condition.
   * @param {{ triggerLose(reason: string): void }} gameState
   */
  setGameState(gameState) {
    this.#gameState = gameState;
  }

  /**
   * Force this guard into Alert state (used when another guard broadcasts).
   */
  receiveAlert() {
    if (this.#state === 'Idle' || this.#state === 'Suspicious') {
      this.#setState('Alert');
    }
  }

  /**
   * Distract this guard toward a position (e.g. a thrown item).
   * Transitions to Suspicious unless already in Chase state.
   * @param {BABYLON.Vector3} position
   */
  distract(position) {
    if (this.#state === 'Chase') return; // don't interrupt chase
    this.#lastKnownPlayerPos = position.clone();
    this.#setState('Suspicious');
  }

  /**
   * Main per-frame update.
   * @param {number} delta  Seconds since last frame
   * @param {import('./Player.js').default|null} player
   */
  update(delta, player) {
    if (!player) {
      this.#moveAlongPatrol(delta);
      return;
    }

    // ── Global: Chase override when alarm is full ────────────────────────────
    if (AlarmSystem.alertLevel === 3 && this.#state !== 'Chase') {
      this.#setState('Chase');
    }

    // ── Global: Return to patrol when alarm clears ───────────────────────────
    if (AlarmSystem.alertLevel === 0 && this.#state !== 'Idle' && this.#state !== 'Return') {
      this.#setState('Return');
    }

    // ── Per-state update ─────────────────────────────────────────────────────
    switch (this.#state) {
      case 'Idle':       this.#updateIdle(delta, player);       break;
      case 'Suspicious': this.#updateSuspicious(delta, player); break;
      case 'Alert':      this.#updateAlert(delta, player);      break;
      case 'Chase':      this.#updateChase(delta, player);      break;
      case 'Return':     this.#updateReturn(delta);             break;
    }

    // ── Lose condition check ─────────────────────────────────────────────────
    this.#checkCatchPlayer(player);
  }

  /**
   * Clean up the guard mesh.
   */
  dispose() {
    this.#mesh?.dispose();
  }

  // ── Getters ──────────────────────────────────────────────────────────────────

  /** @returns {GuardState} */
  get state() { return this.#state; }

  /** @returns {BABYLON.Mesh} */
  get mesh() { return this.#mesh; }

  /** @returns {string} */
  get id() { return this.#id; }

  // ── Private: state machine ───────────────────────────────────────────────────

  /**
   * Transition to a new state, resetting relevant timers.
   * @param {GuardState} newState
   */
  #setState(newState) {
    if (this.#state === newState) return;
    this.#state = newState;

    // Reset timers on state entry
    this.#losTimer     = 0;
    this.#lostLosTimer = 0;

    // Record detection when transitioning to Suspicious
    if (newState === 'Suspicious') {
      decisionTracker.recordDetection();
    }

    // Update mesh colour to reflect state
    const mat = /** @type {BABYLON.StandardMaterial} */ (this.#mesh.material);
    switch (newState) {
      case 'Idle':       mat.diffuseColor = new BABYLON.Color3(0.2, 0.4, 0.8); break; // blue
      case 'Suspicious': mat.diffuseColor = new BABYLON.Color3(0.9, 0.7, 0.1); break; // yellow
      case 'Alert':      mat.diffuseColor = new BABYLON.Color3(0.9, 0.4, 0.1); break; // orange
      case 'Chase':      mat.diffuseColor = new BABYLON.Color3(0.9, 0.1, 0.1); break; // red
      case 'Return':     mat.diffuseColor = new BABYLON.Color3(0.2, 0.4, 0.8); break; // blue
    }
  }

  // ── Private: per-state updates ───────────────────────────────────────────────

  /**
   * Idle: patrol waypoints; transition to Suspicious on detection.
   * @param {number} delta
   * @param {import('./Player.js').default} player
   */
  #updateIdle(delta, player) {
    this.#moveAlongPatrol(delta);

    if (this.#detectPlayer(player)) {
      this.#lastKnownPlayerPos = player.position.clone();
      this.#setState('Suspicious');
    }
  }

  /**
   * Suspicious: move toward last known position; maintain LOS timer.
   * Suspicious→Alert after 2s continuous LOS.
   * @param {number} delta
   * @param {import('./Player.js').default} player
   */
  #updateSuspicious(delta, player) {
    const hasLos = this.#detectPlayer(player);

    if (hasLos) {
      this.#lastKnownPlayerPos = player.position.clone();
      this.#losTimer += delta;
      this.#lostLosTimer = 0;

      if (this.#losTimer >= LOS_TO_ALERT_TIME) {
        // Transition to Alert and broadcast
        this.#setState('Alert');
        AlarmSystem.increase(1);
        this.#broadcastAlert();
        return;
      }
    } else {
      this.#losTimer = 0;
    }

    // Move toward last known position
    if (this.#lastKnownPlayerPos) {
      this.#moveToward(this.#lastKnownPlayerPos, SPEED.Suspicious, delta);
    } else {
      this.#moveAlongPatrol(delta);
    }
  }

  /**
   * Alert: chase player; revert to Suspicious after 5s without LOS.
   * @param {number} delta
   * @param {import('./Player.js').default} player
   */
  #updateAlert(delta, player) {
    const hasLos = this.#detectPlayer(player);

    if (hasLos) {
      this.#lastKnownPlayerPos = player.position.clone();
      this.#lostLosTimer = 0;
    } else {
      this.#lostLosTimer += delta;
      if (this.#lostLosTimer >= LOST_LOS_REVERT_TIME) {
        this.#setState('Suspicious');
        return;
      }
    }

    // Chase toward last known position
    if (this.#lastKnownPlayerPos) {
      this.#moveToward(this.#lastKnownPlayerPos, SPEED.Alert, delta);
    }
  }

  /**
   * Chase: move directly toward player's current position at max speed.
   * @param {number} delta
   * @param {import('./Player.js').default} player
   */
  #updateChase(delta, player) {
    this.#lastKnownPlayerPos = player.position.clone();
    this.#moveToward(player.position, SPEED.Chase, delta);

    // Drop out of Chase if alarm level falls below 3
    if (AlarmSystem.alertLevel < 3) {
      this.#setState('Alert');
    }
  }

  /**
   * Return: walk back to the nearest patrol waypoint, then resume Idle.
   * @param {number} delta
   */
  #updateReturn(delta) {
    if (this.#patrolPath.length === 0) {
      this.#setState('Idle');
      return;
    }

    const target = this.#patrolPath[this.#patrolIndex].position;
    this.#moveToward(target, SPEED.Return, delta);

    const dist = BABYLON.Vector3.Distance(this.#mesh.position, target);
    if (dist <= WAYPOINT_ARRIVE_DIST) {
      this.#setState('Idle');
    }
  }

  // ── Private: detection ───────────────────────────────────────────────────────

  /**
   * Raycast-based player detection: 10m range, 45° forward arc.
   * Applies player.getDetectionMultiplier() to effective range.
   * @param {import('./Player.js').default} player
   * @returns {boolean}
   */
  #detectPlayer(player) {
    const guardPos  = this.#mesh.getAbsolutePosition();
    const playerPos = player.position;

    // ── Distance check ───────────────────────────────────────────────────────
    const effectiveRange = DETECTION_RANGE * player.getDetectionMultiplier();
    const toPlayer       = playerPos.subtract(guardPos);
    const distance       = toPlayer.length();

    if (distance > effectiveRange || distance < 0.001) return false;

    // ── Forward arc check ────────────────────────────────────────────────────
    // Guard forward direction derived from mesh rotation Y
    const yaw     = this.#mesh.rotation.y;
    const forward = new BABYLON.Vector3(Math.sin(yaw), 0, Math.cos(yaw));

    const toPlayerFlat = new BABYLON.Vector3(toPlayer.x, 0, toPlayer.z).normalize();
    const dot          = BABYLON.Vector3.Dot(forward, toPlayerFlat);
    const angle        = Math.acos(Math.max(-1, Math.min(1, dot)));

    if (angle > DETECTION_HALF_RAD) return false;

    // ── Raycast occlusion ────────────────────────────────────────────────────
    const eyePos = guardPos.add(new BABYLON.Vector3(0, GUARD_HEIGHT * 0.85, 0));
    const dir    = playerPos.subtract(eyePos).normalize();
    const ray    = new BABYLON.Ray(eyePos, dir, distance);

    const playerMesh = player.mesh;

    const hit = this.#scene.pickWithRay(ray, (mesh) => {
      if (mesh === playerMesh) return false;
      if (mesh === this.#mesh)  return false;
      return mesh.isPickable;
    });

    // Occluded if something solid is hit before reaching the player
    if (hit?.hit && hit.distance < distance - 0.2) return false;

    return true;
  }

  // ── Private: movement ────────────────────────────────────────────────────────

  /**
   * Move the guard toward a world position at the given speed.
   * Rotates the mesh to face the direction of travel.
   * Applies a 1.2× speed multiplier when alertLevel === 3.
   * @param {BABYLON.Vector3} target
   * @param {number} speed  m/s
   * @param {number} delta  seconds
   */
  #moveToward(target, speed, delta) {
    const pos  = this.#mesh.position;
    const diff = target.subtract(pos);
    diff.y     = 0; // stay on ground plane

    const dist = diff.length();
    if (dist < 0.05) return;

    const effectiveSpeed = speed * (AlarmSystem.alertLevel === 3 ? 1.2 : 1.0);
    const dir  = diff.normalize();
    const step = Math.min(effectiveSpeed * delta, dist);

    this.#mesh.position.addInPlace(dir.scale(step));

    // Face direction of travel
    this.#mesh.rotation.y = Math.atan2(dir.x, dir.z);
  }

  /**
   * Advance along the patrol path, moving toward the current waypoint.
   * When close enough, advance to the next waypoint (looping).
   * @param {number} delta
   */
  #moveAlongPatrol(delta) {
    if (this.#patrolPath.length === 0) return;

    const target = this.#patrolPath[this.#patrolIndex].position;
    this.#moveToward(target, SPEED.Idle, delta);

    const dist = BABYLON.Vector3.Distance(this.#mesh.position, target);
    if (dist <= WAYPOINT_ARRIVE_DIST) {
      this.#patrolIndex = (this.#patrolIndex + 1) % this.#patrolPath.length;
    }
  }

  // ── Private: broadcast ───────────────────────────────────────────────────────

  /**
   * Broadcast alert to all other guards so they enter Alert state.
   */
  #broadcastAlert() {
    for (const guard of this.#allGuards) {
      if (guard !== this) {
        guard.receiveAlert();
      }
    }
  }

  // ── Private: lose condition ──────────────────────────────────────────────────

  /**
   * Check if the guard has caught the player (within 1m).
   * @param {import('./Player.js').default} player
   */
  #checkCatchPlayer(player) {
    const dist = BABYLON.Vector3.Distance(this.#mesh.position, player.position);
    if (dist <= CATCH_DISTANCE) {
      this.#gameState?.triggerLose('caught');
    }
  }
}
