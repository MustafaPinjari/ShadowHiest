/**
 * Waypoint.js — Waypoint graph for guard pathfinding.
 * Guards navigate between named waypoint nodes. Edges connect adjacent nodes
 * that have clear line-of-sight (no walls between them).
 * Requirements: 7.10
 */

/**
 * A single node in the waypoint graph.
 */
export class WaypointNode {
  /** @type {string} */
  id;

  /** @type {BABYLON.Vector3} */
  position;

  /** @type {WaypointNode[]} Adjacent nodes */
  neighbors = [];

  /**
   * @param {string} id
   * @param {BABYLON.Vector3} position
   */
  constructor(id, position) {
    this.id       = id;
    this.position = position;
  }
}

/**
 * A simple waypoint graph.
 * Guards are assigned an ordered list of WaypointNodes to patrol in sequence.
 */
export class WaypointGraph {
  /** @type {Map<string, WaypointNode>} */
  #nodes = new Map();

  /**
   * Add a node to the graph.
   * @param {string} id
   * @param {BABYLON.Vector3} position
   * @returns {WaypointNode}
   */
  addNode(id, position) {
    const node = new WaypointNode(id, position);
    this.#nodes.set(id, node);
    return node;
  }

  /**
   * Connect two nodes bidirectionally.
   * @param {string} idA
   * @param {string} idB
   */
  connect(idA, idB) {
    const a = this.#nodes.get(idA);
    const b = this.#nodes.get(idB);
    if (!a || !b) return;
    if (!a.neighbors.includes(b)) a.neighbors.push(b);
    if (!b.neighbors.includes(a)) b.neighbors.push(a);
  }

  /**
   * Get a node by ID.
   * @param {string} id
   * @returns {WaypointNode|undefined}
   */
  getNode(id) {
    return this.#nodes.get(id);
  }

  /**
   * Return all nodes.
   * @returns {WaypointNode[]}
   */
  getAllNodes() {
    return [...this.#nodes.values()];
  }

  /**
   * Find the next waypoint toward `target` from `current` using BFS.
   * Returns the immediate next node to move toward, or null if already at target.
   * @param {WaypointNode} current
   * @param {WaypointNode} target
   * @returns {WaypointNode|null}
   */
  getNextNode(current, target) {
    if (current === target) return null;

    // BFS
    const visited = new Set([current]);
    const queue   = [[current]]; // each entry is a path

    while (queue.length > 0) {
      const path = queue.shift();
      const node = path[path.length - 1];

      for (const neighbor of node.neighbors) {
        if (neighbor === target) {
          // Return the first step from current
          return path.length === 1 ? neighbor : path[1];
        }
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push([...path, neighbor]);
        }
      }
    }

    return null; // no path found
  }
}

/**
 * Build the interior scene waypoint graph matching the room layout in InteriorScene.js.
 *
 * Layout reference (Z axis, top-down):
 *   Lobby:          x=-10..10, z=0..20
 *   Security office: x=-18..-10, z=-8..0
 *   Main hallway:   x=-18..18, z=-14..-8
 *   Staff rooms:    x=10..18, z=-8..0
 *   Vault corridor: x=-4..4, z=-26..-14
 *   Vault room:     x=-6..6, z=-36..-26
 *
 * @returns {WaypointGraph}
 */
export function buildInteriorWaypointGraph() {
  const g = new WaypointGraph();

  // ── Lobby nodes ──────────────────────────────────────────────────────────
  g.addNode('lobby_center',  new BABYLON.Vector3( 0,  0.1,  10));
  g.addNode('lobby_NW',      new BABYLON.Vector3(-7,  0.1,  17));
  g.addNode('lobby_NE',      new BABYLON.Vector3( 7,  0.1,  17));
  g.addNode('lobby_SW',      new BABYLON.Vector3(-7,  0.1,   3));
  g.addNode('lobby_SE',      new BABYLON.Vector3( 7,  0.1,   3));

  // ── Hallway nodes ────────────────────────────────────────────────────────
  g.addNode('hall_W',        new BABYLON.Vector3(-12, 0.1, -11));
  g.addNode('hall_center',   new BABYLON.Vector3(  0, 0.1, -11));
  g.addNode('hall_E',        new BABYLON.Vector3( 12, 0.1, -11));

  // ── Security office ──────────────────────────────────────────────────────
  g.addNode('sec_office',    new BABYLON.Vector3(-14, 0.1,  -4));

  // ── Staff room area ──────────────────────────────────────────────────────
  g.addNode('staff_area',    new BABYLON.Vector3( 14, 0.1,  -4));

  // ── Vault corridor ───────────────────────────────────────────────────────
  g.addNode('vc_entrance',   new BABYLON.Vector3(  0, 0.1, -16));
  g.addNode('vc_mid',        new BABYLON.Vector3(  0, 0.1, -20));
  g.addNode('vc_exit',       new BABYLON.Vector3(  0, 0.1, -24));

  // ── Connections ──────────────────────────────────────────────────────────

  // Lobby internal
  g.connect('lobby_center', 'lobby_NW');
  g.connect('lobby_center', 'lobby_NE');
  g.connect('lobby_center', 'lobby_SW');
  g.connect('lobby_center', 'lobby_SE');
  g.connect('lobby_NW',     'lobby_NE');
  g.connect('lobby_SW',     'lobby_SE');

  // Lobby → hallway (through south wall gap at z=0)
  g.connect('lobby_SW',   'hall_W');
  g.connect('lobby_SE',   'hall_E');
  g.connect('lobby_center', 'hall_center');

  // Hallway internal
  g.connect('hall_W',      'hall_center');
  g.connect('hall_center', 'hall_E');

  // Hallway → security office
  g.connect('hall_W',    'sec_office');

  // Hallway → staff rooms
  g.connect('hall_E',    'staff_area');

  // Hallway → vault corridor
  g.connect('hall_center', 'vc_entrance');
  g.connect('vc_entrance', 'vc_mid');
  g.connect('vc_mid',      'vc_exit');

  return g;
}

/**
 * Pre-defined patrol paths for each guard (ordered arrays of node IDs).
 * Guards loop through these in sequence.
 */
export const GUARD_PATROL_PATHS = {
  /** Guard 1: Lobby patrol — covers main entrance and reception */
  guard_0: ['lobby_center', 'lobby_NW', 'lobby_NE', 'lobby_SE', 'lobby_SW'],

  /** Guard 2: Hallway patrol — covers connecting corridor */
  guard_1: ['hall_W', 'hall_center', 'hall_E', 'hall_center'],

  /** Guard 3: Vault corridor patrol — covers approach to vault */
  guard_2: ['hall_center', 'vc_entrance', 'vc_mid', 'vc_entrance'],
};
