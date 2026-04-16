# Design Document: Operation Shadow Heist

## Overview

Operation Shadow Heist is a story-driven 3D stealth browser game built with Babylon.js and Vanilla JavaScript. The player controls Alexei through a bank heist — arriving by helicopter, infiltrating the building, bypassing security, solving puzzles, stealing assets, and escaping. The architecture is a single-page application with a scene-based game loop, component-driven entity system, and finite state machines for AI.

## Technology Stack

- **Renderer**: Babylon.js 6.x (WebGL2 with WebGL1 fallback)
- **Physics**: Babylon.js HavokPlugin (built-in) or CannonJS for collision
- **Language**: Vanilla JavaScript (ES2020 modules)
- **UI/HUD**: HTML/CSS overlay + Babylon.js GUI for in-world elements
- **Assets**: Kenney, Sketchfab Free, Poly Pizza (GLTF/GLB format)
- **Build**: No bundler required — native ES modules via `<script type="module">`

---

## Architecture

### Module Structure

```
/
├── index.html
├── src/
│   ├── main.js                  # Entry point, engine init
│   ├── core/
│   │   ├── Engine.js            # Babylon.js engine wrapper
│   │   ├── SceneManager.js      # Scene lifecycle management
│   │   └── AssetLoader.js       # Asset loading with progress
│   ├── scenes/
│   │   ├── LoadingScene.js      # Loading screen
│   │   ├── ExteriorScene.js     # Rooftop / helicopter entry
│   │   └── InteriorScene.js     # Bank interior gameplay
│   ├── entities/
│   │   ├── Player.js            # Alexei controller
│   │   ├── Guard.js             # Guard AI entity
│   │   ├── Camera.js            # Security camera entity
│   │   ├── Helicopter.js        # Helicopter animation entity
│   │   ├── Door.js              # Interactive door entity
│   │   ├── Laser.js             # Laser beam entity
│   │   └── Collectible.js       # Vault asset entity
│   ├── systems/
│   │   ├── AlarmSystem.js       # Alert level state machine
│   │   ├── InputSystem.js       # Keyboard/mouse input
│   │   ├── PhysicsSystem.js     # Collision setup helpers
│   │   ├── EscapeTimer.js       # Countdown timer logic
│   │   └── DecisionTracker.js   # Stealth/aggressive tracking
│   ├── puzzles/
│   │   ├── VaultPuzzle.js       # Symbol combination lock
│   │   └── LaserPuzzle.js       # Pattern-matching panel
│   ├── ui/
│   │   ├── HUD.js               # HUD overlay controller
│   │   ├── WinScreen.js         # Win screen UI
│   │   └── LoseScreen.js        # Lose screen UI
│   └── utils/
│       ├── Raycast.js           # Raycast helpers
│       ├── Waypoint.js          # Waypoint graph
│       └── MathUtils.js         # Vector/angle helpers
└── assets/
    ├── models/                  # GLTF/GLB files
    ├── textures/                # Compressed textures ≤1024px
    └── audio/                   # Sound effects (optional)
```

### Game Loop

```
main.js
  └── Engine.init()
        └── SceneManager.loadScene(LoadingScene)
              └── AssetLoader.load(manifest)
                    └── [onComplete] SceneManager.loadScene(ExteriorScene)
                          └── Helicopter entry cinematic
                                └── [onLand] SceneManager.loadScene(InteriorScene)
                                      └── Game loop: update(delta)
                                            ├── InputSystem.update()
                                            ├── Player.update(delta)
                                            ├── Guard[].update(delta)
                                            ├── Camera[].update(delta)
                                            ├── AlarmSystem.update(delta)
                                            ├── EscapeTimer.update(delta)
                                            └── HUD.update()
```

---

## Component Designs

### 1. Engine and Scene Management

`Engine.js` wraps `BABYLON.Engine` targeting a full-viewport canvas. It exposes `start()`, `stop()`, and a `registerRenderLoop(fn)` method.

`SceneManager.js` maintains the active scene reference and handles transitions. Scenes implement a common interface:
```javascript
// Scene interface
{
  init(engine): Promise<void>,
  update(deltaTime): void,
  dispose(): void
}
```

`AssetLoader.js` uses `BABYLON.AssetsManager` to batch-load all GLTF models and textures. It fires progress callbacks (0–100%) used by the loading screen.

**WebGL check**: On `Engine.init()`, if `BABYLON.Engine.isSupported()` returns false, render an error div and halt.

---

### 2. Player Controller

`Player.js` manages Alexei's movement, camera, and interaction.

**State**: `{ position, velocity, isCrouching, isSprinting, inventory[] }`

**Movement**:
- Base speed: 3 m/s
- Sprint multiplier: 1.8x (Shift held)
- Crouch speed: 1.5 m/s (50% reduction), collision capsule height halved
- Physics: `BABYLON.PhysicsImpostor` capsule on Alexei mesh

**Camera modes**:
- Third-person: arc-rotate camera offset behind/above Alexei
- Mouse delta rotates the camera; Alexei mesh yaw follows camera yaw

**Interaction**:
- On `E` keydown: sphere-cast radius 2m from Alexei position
- Nearest `IInteractable` entity within range receives `interact(player)` call

**Crouch detection modifier**: Exposes `getDetectionMultiplier()` → returns `0.6` when crouching, `1.0` otherwise.

---

### 3. Guard AI (FSM)

`Guard.js` implements a 5-state FSM: `Idle → Suspicious → Alert → Chase → Return`.

**States**:

| State | Speed | Behavior |
|-------|-------|----------|
| Idle | 2 m/s | Patrol waypoints in sequence |
| Suspicious | 3 m/s | Move to last known player position |
| Alert | 4 m/s | Chase player, broadcast alert |
| Chase | 5 m/s | Chase player's current position |
| Return | 2 m/s | Return to patrol after losing sight |

**Detection**:
- Raycast from guard eye position toward player
- Detection range: 10m, arc: 45° forward half-angle
- Crouch modifier applied to effective range
- Line-of-sight confirmed if raycast hits player mesh before any wall

**Transitions**:
- `Idle → Suspicious`: Raycast detects player
- `Suspicious → Alert`: LOS maintained for 2 continuous seconds
- `Alert → Chase`: Alert_Level reaches 3
- `Alert → Suspicious`: LOS lost for 5 continuous seconds
- `Chase → Suspicious`: Alert_Level drops below 3
- Any detection state → `Return` if Alert_Level = 0 for 10s

**Pathfinding**: Waypoint graph — guard moves toward next waypoint node using `Vector3.lerp`. Obstacle avoidance is waypoint-placement-based (no navmesh required for MVP).

**Distraction**: When a throwable lands, the nearest guard within 8m transitions to `Suspicious` and sets `lastKnownPosition` to the impact point.

---

### 4. Security Camera System

`Camera.js` (security camera entity, not Babylon camera).

**State**: `{ isActive, rotationAngle, rotationDirection, rotationSpeed, isDisabled, disableTimer }`

**Rotation**: Oscillates between `minAngle` and `maxAngle` at `rotationSpeed` deg/s. Reverses direction at limits.

**Vision cone**:
- Rendered as a `BABYLON.MeshBuilder.CreateCylinder` (flat cone) with transparent red material
- Parameters: 60° FOV, 8m range
- Each frame: check if player position is within cone using dot-product angle test + distance check + raycast for occlusion

**Disable mechanic**:
- Interacting with nearby control panel calls `camera.disable()`
- Sets `isDisabled = true`, stops rotation, deactivates cone
- After 30 seconds: `isDisabled = false`, resumes

---

### 5. Alarm System

`AlarmSystem.js` is a singleton managing `Alert_Level` (0–3).

```javascript
// AlarmSystem interface
{
  alertLevel: number,           // 0–3
  increase(amount): void,       // clamps to 3
  decrease(amount): void,       // clamps to 0
  update(delta): void,          // handles cooldown timers
  onLevelChange(callback): void // event subscription
}
```

**Cooldown logic**: Camera exit starts a 3-second cooldown timer. If no new detection occurs, `decrease(1)` fires after cooldown.

**Guard broadcast**: When a guard enters Alert state, it calls `AlarmSystem.increase(1)` and emits an event that all other guards subscribe to for state sync.

---

### 6. Laser System

`Laser.js` renders each beam as a `BABYLON.MeshBuilder.CreateTube` (thin cylinder) between two `Vector3` endpoints with emissive red material.

**Detection**: Each frame, check if Alexei's capsule AABB intersects the laser line segment using closest-point-on-segment math. On intersection: `AlarmSystem.increase(2)`.

**Disable**: `LaserPuzzle.js` presents a pattern-matching UI. On success, calls `laser.deactivate()` on all lasers in the zone — sets `isActive = false`, hides mesh, disables detection permanently for the session.

---

### 7. Vault Puzzle

`VaultPuzzle.js` manages the combination lock minigame.

**UI**: Fullscreen HTML overlay with 4 symbol slots and a symbol picker. Built with DOM elements styled via CSS.

**Logic**:
- Generate a random 4-symbol target sequence on puzzle open (symbols: ★ ◆ ▲ ● ■ — 5 options)
- Player selects symbols one at a time
- On submit: compare input array to target array element-by-element
- Success: play CSS animation, call `vault.unlock()`, close UI
- Failure (timeout): `AlarmSystem.increase(1)`, reset input, restart 60s timer

**Timer**: Countdown displayed in puzzle UI. Uses `performance.now()` delta accumulation.

---

### 8. Escape Timer

`EscapeTimer.js` manages the global 10-minute countdown.

**State**: `{ totalSeconds: 600, remaining: 600, isRunning: false, isVisible: false }`

- Starts when player enters interior scene
- Becomes visible (HUD) when Alert_Level ≥ 1
- On Alert_Level = 3: `remaining = Math.floor(remaining * 0.5)`
- On expire: `GameState.triggerLose('timer')`

---

### 9. HUD System

`HUD.js` manages a fixed HTML overlay (`position: fixed`) layered above the canvas.

**Elements**:
- Alert indicator: color-coded badge (green/yellow/orange/red) — always visible
- Timer: MM:SS countdown — visible when Alert_Level ≥ 1
- Asset counter: "Assets: X/Y" — always visible
- Objective text: top-left string — always visible
- Semi-transparent dark background panels for readability

Updates are driven by `AlarmSystem.onLevelChange` and `EscapeTimer` events.

---

### 10. Win/Lose Conditions

`GameState.js` (part of `SceneManager` or standalone module):

**Win**: Player at Escape_Zone + inventory.length ≥ 1 + timer not expired → play helicopter takeoff animation → show `WinScreen`

**Lose triggers**:
- Guard within 1m of Alexei
- Timer reaches 0
- Alert_Level 3 + timer expires

On lose: freeze game loop (`engine.stopRenderLoop()`), show `LoseScreen` with reason + restart button. Restart calls `SceneManager.reload()`.

---

### 11. Performance Systems

- **Geometry instancing**: `BABYLON.Mesh.createInstance()` for chairs, pillars, lights
- **LOD**: `mesh.addLODLevel(distance, reducedMesh)` — swap at 20m
- **Texture compression**: KTX2 or basis format where supported; fallback PNG ≤1024px
- **Performance monitor**: `BABYLON.PerformanceMonitor` — if `averageFPS < 30` for 3 frames, `console.warn('Performance warning: frame time exceeded 33ms')`
- **Polygon budget**: Scene composition kept under 500k triangles via asset selection

---

## Data Structures

### Guard State

```javascript
{
  id: string,
  mesh: BABYLON.Mesh,
  state: 'Idle' | 'Suspicious' | 'Alert' | 'Chase' | 'Return',
  waypoints: BABYLON.Vector3[],
  currentWaypointIndex: number,
  lastKnownPlayerPosition: BABYLON.Vector3 | null,
  losTimer: number,        // seconds of continuous LOS
  lostLosTimer: number,    // seconds since LOS lost
  speed: number
}
```

### Player State

```javascript
{
  mesh: BABYLON.Mesh,
  camera: BABYLON.ArcRotateCamera,
  isCrouching: boolean,
  isSprinting: boolean,
  inventory: string[],     // collected asset IDs
  position: BABYLON.Vector3
}
```

### Alarm State

```javascript
{
  alertLevel: number,      // 0–3
  cooldownTimer: number,   // seconds remaining on decrease cooldown
  listeners: Function[]
}
```

---

## Correctness Properties

### Property 1: Alert Level Bounds

For any sequence of `increase(n)` and `decrease(n)` calls, `alertLevel` SHALL always remain in the range [0, 3].

- **Formal**: ∀ operations O on AlarmSystem: 0 ≤ AlarmSystem.alertLevel ≤ 3
- **Validates**: Requirements 6.1

### Property 2: Vault Puzzle Correctness Invariant

For all valid 4-symbol sequences S, the puzzle validation function SHALL return `true` if and only if S equals the target sequence element-by-element.

- **Formal**: `validate(input, target) === true ↔ ∀i ∈ [0,3]: input[i] === target[i]`
- **Validates**: Requirements 9.6

### Property 3: Escape Timer Monotonic Decrease

The escape timer remaining value SHALL never increase except when the Alert_Level transitions to 3 (which halves it — a decrease). The timer SHALL only decrease or stay the same each tick.

- **Formal**: ∀ ticks t: `remaining(t+1) ≤ remaining(t)` (excluding the Alert_Level-3 halving event which is also a decrease)
- **Validates**: Requirements 11.1, 11.3

### Property 4: Guard Detection Range Crouch Reduction

When Alexei is crouching, the effective guard detection range SHALL always be exactly 60% of the standing detection range (40% reduction).

- **Formal**: `effectiveRange(crouching) = baseRange × 0.6`
- **Validates**: Requirements 3.6

### Property 5: Inventory Monotonic Growth

Once an asset is added to the player's inventory, it SHALL never be removed (no drop mechanic). The inventory size SHALL be monotonically non-decreasing during a session.

- **Formal**: ∀ t: `inventory(t+1).length ≥ inventory(t).length`
- **Validates**: Requirements 10.2, 10.4

---

## Scene Layout (Conceptual)

### Exterior Scene
- Rooftop landing pad (center)
- Helicopter spawn point (above, offset)
- Skybox
- Transition trigger zone at rooftop access door

### Interior Scene
- **Lobby**: Main entrance, reception desk, 2 guards, 2 cameras
- **Hallways**: Connecting corridors, 1 guard patrol loop
- **Security Office**: Camera control panels (disable mechanic)
- **Staff Rooms**: Side rooms, distraction item spawns
- **Vault Corridor**: 5 laser beams, laser disable panel
- **Vault Room**: Vault door (puzzle trigger), 3 collectible assets
- **Escape Zone**: Rooftop access (glowing pad, activates after 1 asset collected)
