# Implementation Plan: Operation Shadow Heist

## Overview

Incremental implementation of the browser-based 3D stealth game using Babylon.js and Vanilla JavaScript. Each task builds on the previous, wiring components together progressively. The game is structured as a single-page ES module application with no bundler required.

## Tasks

- [x] 1. Project scaffold and engine initialization
  - Create `index.html` with a full-viewport `<canvas>` element and `<script type="module">` entry point
  - Create `src/main.js` as the entry point that initializes the Babylon.js engine
  - Create `src/core/Engine.js` wrapping `BABYLON.Engine` with `start()`, `stop()`, and `registerRenderLoop(fn)` methods
  - Add WebGL support check: if `BABYLON.Engine.isSupported()` is false, render an error `<div>` and halt
  - Create the `assets/models/`, `assets/textures/` directory placeholders (`.gitkeep`)
  - _Requirements: 1.1, 1.5_

- [x] 2. Asset loading and loading screen
  - [x] 2.1 Implement `src/core/AssetLoader.js` using `BABYLON.AssetsManager` to batch-load GLTF models and textures with progress callbacks (0–100%)
    - _Requirements: 1.2, 1.6_

  - [x] 2.2 Implement `src/scenes/LoadingScene.js` that displays a loading screen with a progress bar driven by `AssetLoader` callbacks
    - Transition to the next scene automatically when loading completes
    - _Requirements: 1.2, 1.3_

  - [x] 2.3 Implement `src/core/SceneManager.js` with `loadScene(SceneClass)` and `reload()` methods managing scene lifecycle (`init`, `update`, `dispose`)
    - _Requirements: 1.1, 1.3_

- [x] 3. Input system
  - [x] 3.1 Implement `src/systems/InputSystem.js` tracking keyboard state (WASD, arrow keys, Shift, C, E) and mouse delta each frame
    - Expose `isKeyDown(key)`, `getMouseDelta()`, and `consumeKey(key)` methods
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.7_

- [x] 4. Player controller
  - [x] 4.1 Implement `src/entities/Player.js` with a physics capsule (`BABYLON.PhysicsImpostor`) representing Alexei
    - Base movement speed 3 m/s using WASD/arrow keys via `InputSystem`
    - Sprint at 1.8x speed while Shift is held
    - Crouch via C key: halve capsule height, set speed to 1.5 m/s
    - Expose `getDetectionMultiplier()` returning `0.6` when crouching, `1.0` otherwise
    - _Requirements: 3.1, 3.3, 3.4, 3.5, 3.6_

  - [x] 4.2 Implement third-person arc-rotate camera in `Player.js` that follows Alexei with mouse-delta rotation
    - Alexei mesh yaw tracks camera yaw
    - _Requirements: 3.2_

  - [x] 4.3 Implement interaction system in `Player.js`: on E keydown, sphere-cast radius 2m and call `interact(player)` on the nearest `IInteractable` entity
    - _Requirements: 3.7_

  - [ ]* 4.4 Write unit tests for Player movement speed calculations (base, sprint, crouch) and `getDetectionMultiplier()`
    - Test that sprint speed = base × 1.8, crouch speed = 1.5 m/s, crouch multiplier = 0.6
    - _Requirements: 3.3, 3.5, 3.6_

- [x] 5. Checkpoint — Ensure engine, loading, input, and player controller work end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Bank environment
  - [x] 6.1 Implement `src/scenes/ExteriorScene.js` with rooftop landing pad, skybox, and helicopter spawn point
    - _Requirements: 4.1_

  - [x] 6.2 Implement `src/scenes/InteriorScene.js` with lobby, hallways, security office, staff rooms, vault corridor, vault room, and escape zone using static mesh collision
    - Apply `BABYLON.PhysicsImpostor` to all wall/floor meshes so player and guards cannot pass through
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 6.3 Implement `src/entities/Door.js` as an `IInteractable` entity with open/close animation and collision state toggle
    - Place at least 6 interactive doors in the interior scene
    - _Requirements: 4.4, 4.5_

  - [x] 6.4 Apply geometry instancing (`BABYLON.Mesh.createInstance()`) for repeated objects (chairs, pillars, lights) and LOD levels (`mesh.addLODLevel(20, reducedMesh)`) for objects beyond 20m
    - _Requirements: 4.7, 15.2, 15.3_

- [x] 7. Alarm system
  - [x] 7.1 Implement `src/systems/AlarmSystem.js` as a singleton with `alertLevel` (0–3), `increase(n)`, `decrease(n)`, `update(delta)` (cooldown logic), and `onLevelChange(callback)` event subscription
    - Camera-exit cooldown: 3-second timer before `decrease(1)` fires
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 7.2 Write property test for Alert Level Bounds (Property 1)
    - **Property 1: Alert Level Bounds**
    - For any sequence of `increase(n)` and `decrease(n)` calls, `alertLevel` must always remain in [0, 3]
    - **Validates: Requirements 6.1**

  - [ ]* 7.3 Write unit tests for `AlarmSystem` cooldown timer and level-change event callbacks
    - _Requirements: 6.2, 6.3, 6.4, 6.5_

- [x] 8. Security camera system
  - [x] 8.1 Implement `src/entities/Camera.js` (security camera) with oscillating rotation between configurable min/max angles at configurable speed
    - Render vision cone as a transparent red `BABYLON.MeshBuilder.CreateCylinder` (60° FOV, 8m range)
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 8.2 Add per-frame player detection in `Camera.js`: dot-product angle test + distance check + raycast occlusion; on detection call `AlarmSystem.increase(1)`, on exit start 3s cooldown then `AlarmSystem.decrease(1)`
    - Apply `player.getDetectionMultiplier()` to effective detection range
    - _Requirements: 5.4, 5.5_

  - [x] 8.3 Implement camera disable mechanic: control panel `IInteractable` within 1.5m calls `camera.disable()` — stops rotation, deactivates cone for 30 seconds then reactivates
    - _Requirements: 5.6, 5.7_

  - [x] 8.4 Place at least 4 security cameras in the interior scene (lobby ×2, hallway ×1, vault corridor ×1)
    - _Requirements: 5.1_

- [x] 9. Guard AI system
  - [x] 9.1 Implement `src/entities/Guard.js` with 5-state FSM (Idle, Suspicious, Alert, Chase, Return) and waypoint-based patrol at 2 m/s
    - _Requirements: 7.1, 7.2_

  - [x] 9.2 Implement guard detection raycast in `Guard.js`: 10m range, 45° forward arc, applying `player.getDetectionMultiplier()`; transition `Idle → Suspicious` on detection
    - _Requirements: 7.3_

  - [x] 9.3 Implement `Suspicious → Alert` transition: maintain LOS timer; after 2 continuous seconds call `AlarmSystem.increase(1)` and broadcast to all guards
    - Implement `Alert → Suspicious` transition: LOS-lost timer; after 5 continuous seconds revert
    - _Requirements: 7.4, 7.5, 7.6, 7.7_

  - [x] 9.4 Implement `Chase` state: when `AlarmSystem.alertLevel === 3`, all guards transition to Chase at 5 m/s toward player's current position
    - _Requirements: 7.8_

  - [x] 9.5 Implement lose condition trigger in `Guard.js`: when guard reaches within 1m of Alexei, call `GameState.triggerLose('caught')`
    - _Requirements: 7.9, 14.2_

  - [x] 9.6 Implement `src/utils/Waypoint.js` waypoint graph and wire guard pathfinding to navigate between nodes without passing through walls
    - _Requirements: 7.10_

  - [x] 9.7 Place at least 3 guards in the interior scene with assigned waypoint patrol paths
    - _Requirements: 7.1_

  - [ ]* 9.8 Write unit tests for Guard FSM state transitions (all edges) and detection range with crouch modifier
    - _Requirements: 7.3, 7.5, 7.7, 7.8_

- [x] 10. Checkpoint — Ensure guard AI, cameras, and alarm system integrate correctly
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Laser detection system
  - [x] 11.1 Implement `src/entities/Laser.js` rendering each beam as a thin red emissive `BABYLON.MeshBuilder.CreateTube` between two `Vector3` endpoints
    - Per-frame AABB intersection check against Alexei's capsule using closest-point-on-segment math; on intersection call `AlarmSystem.increase(2)`
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 11.2 Place at least 5 laser beams in the vault corridor
    - _Requirements: 8.1_

  - [ ]* 11.3 Write unit tests for laser intersection detection (hit and miss cases)
    - _Requirements: 8.3_

- [ ] 12. Laser puzzle
  - [x] 12.1 Implement `src/puzzles/LaserPuzzle.js` as a pattern-matching HTML overlay UI triggered by interacting with the laser disable panel
    - On success, call `laser.deactivate()` on all lasers in the zone (sets `isActive = false`, hides mesh, disables detection permanently)
    - _Requirements: 8.4, 8.5_

- [ ] 13. Vault puzzle system
  - [x] 13.1 Implement `src/puzzles/VaultPuzzle.js` with a fullscreen HTML/CSS overlay showing 4 symbol slots and a symbol picker (5 symbols: ★ ◆ ▲ ● ■)
    - Generate a random 4-symbol target sequence on open; display 60-second countdown timer
    - _Requirements: 9.1, 9.2, 9.5_

  - [x] 13.2 Implement puzzle validation in `VaultPuzzle.js`: compare input array to target element-by-element; on success play CSS success animation and call `vault.unlock()`; on timeout call `AlarmSystem.increase(1)` and reset
    - _Requirements: 9.3, 9.4_

  - [ ]* 13.3 Write property test for Vault Puzzle Correctness Invariant (Property 2)
    - **Property 2: Vault Puzzle Correctness Invariant**
    - `validate(input, target) === true` if and only if all 4 elements match element-by-element
    - **Validates: Requirements 9.6**

  - [ ]* 13.4 Write unit tests for VaultPuzzle timer expiry and reset behavior
    - _Requirements: 9.4_

  - [x] 13.5 Wire `VaultPuzzle` to the Vault door `IInteractable` in the interior scene; vault room accessible only after puzzle success
    - _Requirements: 4.6, 9.1_

- [ ] 14. Collectible assets and inventory
  - [x] 14.1 Implement `src/entities/Collectible.js` as an `IInteractable` entity; on `interact(player)` add asset ID to `player.inventory` and remove mesh from scene
    - _Requirements: 10.1, 10.2_

  - [x] 14.2 Place at least 3 collectible assets in the vault room
    - _Requirements: 10.1_

  - [ ]* 14.3 Write property test for Inventory Monotonic Growth (Property 5)
    - **Property 5: Inventory Monotonic Growth**
    - After any sequence of `collectAsset()` calls, `inventory.length` must be non-decreasing
    - **Validates: Requirements 10.2, 10.4**

- [ ] 15. Escape timer
  - [x] 15.1 Implement `src/systems/EscapeTimer.js` with a 600-second countdown starting when the player enters the interior scene
    - Becomes visible on HUD when `alertLevel ≥ 1`; on `alertLevel === 3` set `remaining = Math.floor(remaining * 0.5)`; on expire call `GameState.triggerLose('timer')`
    - _Requirements: 11.1, 11.2, 11.3, 11.5_

  - [ ]* 15.2 Write property test for Escape Timer Monotonic Decrease (Property 3)
    - **Property 3: Escape Timer Monotonic Decrease**
    - For any sequence of `update(delta)` calls, `remaining(t+1) ≤ remaining(t)` (the Alert_Level-3 halving is also a decrease)
    - **Validates: Requirements 11.1, 11.3**

  - [ ]* 15.3 Write unit tests for escape timer Alert_Level-3 halving and expiry trigger
    - _Requirements: 11.3, 11.5_

- [ ] 16. Win and lose conditions
  - [x] 16.1 Implement `GameState` module (in `src/core/SceneManager.js` or standalone `src/core/GameState.js`) with `triggerWin()` and `triggerLose(reason)` methods
    - `triggerLose`: stop render loop, show `LoseScreen` with reason and restart button
    - `triggerWin`: play helicopter takeoff animation, then show `WinScreen`
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

  - [x] 16.2 Implement escape zone trigger in the interior scene: glowing pad activates when `player.inventory.length ≥ 1`; on player overlap with active zone call `GameState.triggerWin()`
    - _Requirements: 11.4, 11.6, 14.1_

- [ ] 17. HUD system
  - [x] 17.1 Implement `src/ui/HUD.js` as a fixed HTML overlay with alert indicator (color-coded badge), escape timer (MM:SS, visible when `alertLevel ≥ 1`), asset counter ("Assets: X/Y"), and objective text
    - Use dark semi-transparent panel backgrounds; subscribe to `AlarmSystem.onLevelChange` and `EscapeTimer` events for updates
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.7_

  - [x] 17.2 Implement `src/ui/WinScreen.js` displaying elapsed time, assets collected, and approach style (Stealth/Aggressive)
    - _Requirements: 13.5_

  - [x] 17.3 Implement `src/ui/LoseScreen.js` displaying the reason for failure and a restart button that calls `SceneManager.reload()`
    - _Requirements: 13.6_

- [ ] 18. Helicopter entry and escape animations
  - [x] 18.1 Implement `src/entities/Helicopter.js` with keyframe animation for rotor spin and descent along a predefined flight path to the rooftop landing pad
    - Camera tracks helicopter during entry cinematic; on landing trigger player control handoff
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 18.2 Wire helicopter takeoff animation to `GameState.triggerWin()`: play takeoff sequence before showing win screen
    - _Requirements: 2.5, 14.6_

- [ ] 19. Decision system — stealth vs aggressive
  - [x] 19.1 Implement `src/systems/DecisionTracker.js` tracking whether any guard detection occurred during the session; expose `getApproach()` returning `'Stealth'` or `'Aggressive'`
    - _Requirements: 12.1, 12.5_

  - [x] 19.2 Implement throwable distraction items in the interior scene: on throw impact, find the nearest guard within 8m and transition it to `Suspicious` with `lastKnownPosition` set to impact point
    - _Requirements: 12.2, 12.3_

  - [x] 19.3 When `alertLevel === 3`, increase all guard movement speeds by 20% as difficulty escalation
    - _Requirements: 12.4_

  - [x] 19.4 Wire `DecisionTracker.getApproach()` to the `WinScreen` display
    - _Requirements: 12.5_

- [x] 20. Performance monitoring
  - [x] 20.1 Integrate `BABYLON.PerformanceMonitor` in `Engine.js`; if average FPS < 30 for 3 consecutive frames, emit `console.warn('Performance warning: frame time exceeded 33ms')`
    - _Requirements: 15.1, 15.6_

  - [x] 20.2 Audit active scene polygon count and texture sizes; ensure total triangles < 500,000 and all textures ≤ 1024×1024px
    - _Requirements: 15.4, 15.5_

- [x] 21. Final integration and wiring
  - [x] 21.1 Wire all systems into the `InteriorScene.update(delta)` loop: `InputSystem`, `Player`, `Guard[]`, `Camera[]`, `Laser[]`, `AlarmSystem`, `EscapeTimer`, `HUD`, `DecisionTracker`
    - _Requirements: 1.4, 6.1–6.6, 7.1–7.10_

  - [x] 21.2 Wire `ExteriorScene` → `LoadingScene` → helicopter entry → `InteriorScene` full scene transition chain via `SceneManager`
    - _Requirements: 1.3, 2.3_

  - [ ]* 21.3 Write integration tests for the win path (collect asset → reach escape zone → win screen) and lose path (guard catch → lose screen)
    - _Requirements: 14.1, 14.2_

- [~] 22. Final checkpoint — Ensure all tests pass and full game loop is playable
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties defined in the design
- Unit tests validate specific examples and edge cases
- Checkpoints ensure incremental validation at key milestones
