/**
 * InstancedProps.js — Geometry instancing and LOD helpers
 * Provides factory functions for placing repeated environmental props
 * (chairs, pillars, ceiling lights) using BABYLON.Mesh.createInstance()
 * and LOD levels via mesh.addLODLevel() for objects beyond 20 m.
 * Requirements: 4.7, 15.2, 15.3
 *
 * Performance budget (Requirements 15.4, 15.5):
 *   - All source meshes use low tessellation (boxes and 8-sided cylinders) to
 *     keep per-instance triangle counts minimal.
 *   - No textures are used — all materials are StandardMaterial with diffuseColor
 *     only, so texture budget (≤ 1024×1024px) is trivially satisfied here.
 *   - LOD meshes swap in at 20 m, further reducing the effective triangle count
 *     for distant instances.
 */

// ── LOD distance threshold ───────────────────────────────────────────────────
const LOD_DISTANCE = 20; // metres

// ── Chair ────────────────────────────────────────────────────────────────────

/**
 * Create the shared chair source mesh (full-detail) and a reduced LOD mesh.
 * Returns a factory function that stamps instances at given positions.
 *
 * @param {BABYLON.Scene} scene
 * @returns {(positions: BABYLON.Vector3[], rotationsY?: number[]) => BABYLON.InstancedMesh[]}
 */
export function createChairFactory(scene) {
  // Full-detail chair: seat + back + 4 legs
  const seat = BABYLON.MeshBuilder.CreateBox('chair_seat_src', { width: 0.5, height: 0.05, depth: 0.5 }, scene);
  seat.isVisible = false; // source mesh hidden; only instances are visible

  const back = BABYLON.MeshBuilder.CreateBox('chair_back_src', { width: 0.5, height: 0.6, depth: 0.05 }, scene);
  back.parent   = seat;
  back.position = new BABYLON.Vector3(0, 0.325, -0.225);
  back.isVisible = false;

  const legPositions = [
    new BABYLON.Vector3( 0.2, -0.225,  0.2),
    new BABYLON.Vector3(-0.2, -0.225,  0.2),
    new BABYLON.Vector3( 0.2, -0.225, -0.2),
    new BABYLON.Vector3(-0.2, -0.225, -0.2),
  ];
  for (let i = 0; i < legPositions.length; i++) {
    const leg = BABYLON.MeshBuilder.CreateBox(`chair_leg${i}_src`, { width: 0.05, height: 0.45, depth: 0.05 }, scene);
    leg.parent   = seat;
    leg.position = legPositions[i];
    leg.isVisible = false;
  }

  // Merge into a single source mesh for instancing
  const merged = BABYLON.Mesh.MergeMeshes(
    [seat, back, ...scene.meshes.filter(m => m.name.startsWith('chair_leg') && m.name.endsWith('_src'))],
    true, true, undefined, false, true,
  );
  if (merged) {
    merged.name      = 'chair_src';
    merged.isVisible = false;
    const mat = new BABYLON.StandardMaterial('chairMat', scene);
    mat.diffuseColor = new BABYLON.Color3(0.45, 0.30, 0.18);
    merged.material  = mat;

    // LOD: simplified box at 20 m+
    const lodMesh = BABYLON.MeshBuilder.CreateBox('chair_lod', { width: 0.5, height: 0.9, depth: 0.5 }, scene);
    lodMesh.material  = mat;
    lodMesh.isVisible = false;
    merged.addLODLevel(LOD_DISTANCE, lodMesh);
  }

  return (positions, rotationsY = []) => {
    if (!merged) return [];
    return positions.map((pos, i) => {
      const inst = merged.createInstance(`chair_${i}`);
      inst.position.copyFrom(pos);
      inst.rotation.y = rotationsY[i] ?? 0;
      inst.isPickable = false;
      return inst;
    });
  };
}

// ── Pillar ───────────────────────────────────────────────────────────────────

/**
 * Create the shared pillar source mesh with LOD.
 * @param {BABYLON.Scene} scene
 * @param {number} height  Pillar height (default 3.5 m = WALL_H)
 * @returns {(positions: BABYLON.Vector3[]) => BABYLON.InstancedMesh[]}
 */
export function createPillarFactory(scene, height = 3.5) {
  const pillar = BABYLON.MeshBuilder.CreateCylinder(
    'pillar_src',
    { diameter: 0.4, height, tessellation: 8 },
    scene,
  );
  pillar.isVisible = false;

  const mat = new BABYLON.StandardMaterial('pillarMat', scene);
  mat.diffuseColor = new BABYLON.Color3(0.75, 0.73, 0.70);
  pillar.material  = mat;

  // LOD: 4-sided box at 20 m+
  const lodPillar = BABYLON.MeshBuilder.CreateBox(
    'pillar_lod',
    { width: 0.4, height, depth: 0.4 },
    scene,
  );
  lodPillar.material  = mat;
  lodPillar.isVisible = false;
  pillar.addLODLevel(LOD_DISTANCE, lodPillar);

  return (positions) =>
    positions.map((pos, i) => {
      const inst = pillar.createInstance(`pillar_${i}`);
      inst.position.copyFrom(pos);
      inst.isPickable = false;
      return inst;
    });
}

// ── Ceiling light ────────────────────────────────────────────────────────────

/**
 * Create the shared ceiling light fixture mesh with LOD.
 * @param {BABYLON.Scene} scene
 * @returns {(positions: BABYLON.Vector3[]) => BABYLON.InstancedMesh[]}
 */
export function createCeilingLightFactory(scene) {
  const fixture = BABYLON.MeshBuilder.CreateBox(
    'ceilLight_src',
    { width: 0.6, height: 0.08, depth: 0.6 },
    scene,
  );
  fixture.isVisible = false;

  const mat = new BABYLON.StandardMaterial('ceilLightMat', scene);
  mat.diffuseColor  = new BABYLON.Color3(1, 1, 0.9);
  mat.emissiveColor = new BABYLON.Color3(0.8, 0.8, 0.7);
  fixture.material  = mat;

  // LOD: flat plane at 20 m+
  const lodFixture = BABYLON.MeshBuilder.CreatePlane(
    'ceilLight_lod',
    { width: 0.6, height: 0.6 },
    scene,
  );
  lodFixture.material  = mat;
  lodFixture.isVisible = false;
  fixture.addLODLevel(LOD_DISTANCE, lodFixture);

  return (positions) =>
    positions.map((pos, i) => {
      const inst = fixture.createInstance(`ceilLight_${i}`);
      inst.position.copyFrom(pos);
      inst.isPickable = false;
      return inst;
    });
}

// ── Scene prop placement ─────────────────────────────────────────────────────

/**
 * Populate the interior scene with instanced chairs, pillars, and ceiling lights.
 * Call this after InteriorScene geometry is built.
 * @param {BABYLON.Scene} scene
 * @param {number} wallH  Ceiling height (default 3.5)
 */
export function populateInteriorProps(scene, wallH = 3.5) {
  const chairFactory  = createChairFactory(scene);
  const pillarFactory = createPillarFactory(scene, wallH);
  const lightFactory  = createCeilingLightFactory(scene);

  // ── Chairs (lobby waiting area) ──────────────────────────────────────────
  chairFactory(
    [
      new BABYLON.Vector3(-6, 0.475, 14),
      new BABYLON.Vector3(-4, 0.475, 14),
      new BABYLON.Vector3( 4, 0.475, 14),
      new BABYLON.Vector3( 6, 0.475, 14),
      new BABYLON.Vector3(-6, 0.475, 12),
      new BABYLON.Vector3(-4, 0.475, 12),
      new BABYLON.Vector3( 4, 0.475, 12),
      new BABYLON.Vector3( 6, 0.475, 12),
    ],
    [Math.PI, Math.PI, Math.PI, Math.PI, 0, 0, 0, 0],
  );

  // ── Pillars (lobby corners and hallway) ──────────────────────────────────
  pillarFactory([
    new BABYLON.Vector3(-8, wallH / 2,  18),
    new BABYLON.Vector3( 8, wallH / 2,  18),
    new BABYLON.Vector3(-8, wallH / 2,   2),
    new BABYLON.Vector3( 8, wallH / 2,   2),
    // Hallway pillars
    new BABYLON.Vector3(-8, wallH / 2, -11),
    new BABYLON.Vector3( 8, wallH / 2, -11),
  ]);

  // ── Ceiling lights ───────────────────────────────────────────────────────
  lightFactory([
    // Lobby
    new BABYLON.Vector3(-5, wallH - 0.04, 15),
    new BABYLON.Vector3( 5, wallH - 0.04, 15),
    new BABYLON.Vector3(-5, wallH - 0.04,  5),
    new BABYLON.Vector3( 5, wallH - 0.04,  5),
    // Hallway
    new BABYLON.Vector3(-8, wallH - 0.04, -11),
    new BABYLON.Vector3( 0, wallH - 0.04, -11),
    new BABYLON.Vector3( 8, wallH - 0.04, -11),
    // Vault corridor
    new BABYLON.Vector3( 0, wallH - 0.04, -17),
    new BABYLON.Vector3( 0, wallH - 0.04, -23),
    // Vault room
    new BABYLON.Vector3(-2, wallH - 0.04, -31),
    new BABYLON.Vector3( 2, wallH - 0.04, -31),
  ]);
}
