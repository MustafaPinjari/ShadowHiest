# Requirements Document

## Introduction

Operation Shadow Heist is a complete, story-driven 3D browser game built with Babylon.js and Vanilla JavaScript. The player controls Alexei, a Russian operative, who arrives by helicopter, infiltrates a bank, bypasses security systems, solves puzzles to access the vault, steals assets, and escapes before being caught. The game targets portfolio-level quality with smooth 60 FPS browser performance, using only free assets and libraries.

## Glossary

- **Game**: The Operation Shadow Heist browser application
- **Player**: The human user controlling Alexei
- **Alexei**: The player character — a Russian operative performing the heist
- **Scene**: A Babylon.js scene representing a distinct game environment (exterior, interior)
- **Guard**: An AI-controlled NPC that patrols the bank and reacts to the player
- **Camera**: A security camera NPC with a vision cone that triggers alarms
- **Alarm**: The bank's security alert state, escalating from Silent → Suspicious → Alert → Full Alarm
- **Vault**: The secured room containing the target assets
- **Helicopter**: The animated vehicle used for entry and escape
- **HUD**: The heads-up display showing timer, alert level, and objective status
- **FSM**: Finite State Machine — the AI behavior model used for Guards
- **Raycast**: A ray projected from a point in a direction used for vision and collision detection
- **Waypoint**: A predefined position in the world used for Guard patrol paths
- **Puzzle**: An interactive minigame required to unlock the Vault or bypass security
- **Alert_Level**: A numeric value (0–3) representing the current security state: 0=Silent, 1=Suspicious, 2=Alert, 3=Full Alarm
- **Escape_Zone**: The designated area (helicopter landing pad or exit) the Player must reach to win
- **Physics_Engine**: Cannon.js or Babylon.js built-in physics used for collision and movement
- **Asset**: A free 3D model or texture sourced from Kenney, Sketchfab Free, or Poly Pizza
- **Renderer**: The Babylon.js WebGL rendering pipeline

---

## Requirements

### Requirement 1: Game Initialization and Scene Loading

**User Story:** As a Player, I want the game to load quickly in my browser, so that I can start playing without long wait times.

#### Acceptance Criteria

1. THE Game SHALL initialize a Babylon.js engine targeting a full-viewport HTML5 canvas element on page load.
2. WHEN the page loads, THE Game SHALL display a loading screen with progress feedback until all Assets are ready.
3. WHEN all Assets are loaded, THE Game SHALL transition to the helicopter entry sequence automatically.
4. THE Renderer SHALL target 60 frames per second during all gameplay phases.
5. IF the browser does not support WebGL, THEN THE Game SHALL display a descriptive error message informing the Player of the requirement.
6. THE Game SHALL use only free, openly licensed Assets sourced from Kenney, Sketchfab Free, or Poly Pizza.

---

### Requirement 2: Helicopter Entry System

**User Story:** As a Player, I want to arrive at the bank via an animated helicopter, so that the game establishes narrative context before I take control.

#### Acceptance Criteria

1. WHEN the Scene loads, THE Helicopter SHALL follow a predefined flight path and descend toward the bank rooftop landing pad.
2. WHILE the Helicopter is in flight, THE Game SHALL play the entry cinematic with the camera tracking the Helicopter.
3. WHEN the Helicopter reaches the landing pad, THE Game SHALL trigger a landing animation and transition player control to Alexei.
4. THE Helicopter SHALL use keyframe animation for rotor spin and descent movement.
5. WHEN the Player reaches the Escape_Zone at game end, THE Helicopter SHALL return and play a takeoff animation before the win screen is shown.

---

### Requirement 3: Player Movement System

**User Story:** As a Player, I want smooth, responsive character movement, so that I can navigate the bank environment with precision.

#### Acceptance Criteria

1. THE Player SHALL move Alexei using WASD or arrow keys for directional movement.
2. THE Player SHALL rotate the camera using mouse movement in first-person or third-person mode.
3. WHEN the Player presses the sprint key (Shift), THE Player_Controller SHALL increase Alexei's movement speed by 1.8x for the duration the key is held.
4. WHEN Alexei collides with a wall, door, or static object, THE Physics_Engine SHALL prevent movement through the object.
5. THE Player_Controller SHALL support crouching via the C key, reducing Alexei's collision height and movement speed by 50%.
6. WHILE Alexei is crouching, THE Guard detection range SHALL be reduced by 40% compared to standing detection range.
7. WHEN the Player presses the interact key (E), THE Game SHALL trigger the interaction for the nearest interactable object within 2 meters.

---

### Requirement 4: Bank Environment

**User Story:** As a Player, I want a detailed bank environment with exterior and interior areas, so that the game world feels believable and navigable.

#### Acceptance Criteria

1. THE Game SHALL render a bank exterior including a rooftop landing pad, main entrance, and surrounding street area.
2. THE Game SHALL render a bank interior including a lobby, hallways, security office, staff rooms, and a Vault room.
3. THE Bank environment SHALL use static mesh collision so the Player and Guards cannot pass through walls or floors.
4. THE Game SHALL include at least 6 interactive doors that the Player can open, close, or lock.
5. WHEN a door is opened by the Player, THE Door SHALL play an open animation and update its collision state to allow passage.
6. THE Vault room SHALL be accessible only after the Player completes the Vault Puzzle.
7. THE Game SHALL use texture atlasing and geometry instancing for repeated environmental Assets to maintain performance.

---

### Requirement 5: Security Camera System

**User Story:** As a Player, I want to avoid security cameras with visible detection cones, so that I can plan my infiltration route strategically.

#### Acceptance Criteria

1. THE Game SHALL place at least 4 security Cameras in the bank interior at fixed positions.
2. EACH Camera SHALL rotate on a fixed axis at a configurable speed, sweeping a defined arc.
3. THE Camera SHALL project a visible cone mesh representing its field of view (60-degree angle, 8-meter range).
4. WHEN Alexei enters an active Camera's vision cone, THE Alarm SHALL increase the Alert_Level by 1.
5. WHEN Alexei exits a Camera's vision cone, THE Alarm SHALL begin a 3-second cooldown before decreasing the Alert_Level by 1.
6. WHERE a Camera disable mechanic is available, THE Player SHALL be able to disable a Camera by interacting with a nearby control panel within 1.5 meters.
7. WHEN a Camera is disabled, THE Camera SHALL stop rotating and its vision cone SHALL become inactive for 30 seconds before reactivating.

---

### Requirement 6: Alarm System

**User Story:** As a Player, I want a multi-level alarm system, so that my mistakes have escalating consequences that increase tension.

#### Acceptance Criteria

1. THE Alarm SHALL maintain an Alert_Level integer value between 0 and 3 inclusive.
2. WHEN the Alert_Level reaches 1, THE HUD SHALL display a "Suspicious" indicator and Guards SHALL enter the Suspicious state.
3. WHEN the Alert_Level reaches 2, THE HUD SHALL display an "Alert" indicator, Guards SHALL enter the Alert state, and the escape timer SHALL begin counting down.
4. WHEN the Alert_Level reaches 3, THE HUD SHALL display a "Full Alarm" indicator, all Guards SHALL enter the Chase state, and the escape timer SHALL accelerate by 50%.
5. WHEN the Alert_Level is 0 and no detection event has occurred for 10 seconds, THE Alarm SHALL maintain the Silent state.
6. IF the Alert_Level reaches 3 and the Player does not reach the Escape_Zone within the remaining timer, THEN THE Game SHALL trigger the lose condition.

---

### Requirement 7: AI Guard System

**User Story:** As a Player, I want intelligent guards that patrol and react to my presence, so that the game presents a meaningful stealth challenge.

#### Acceptance Criteria

1. THE Game SHALL place at least 3 Guards in the bank interior, each assigned a patrol Waypoint path.
2. WHILE in the Idle state, THE Guard SHALL move between assigned Waypoints at a walking speed of 2 m/s.
3. WHEN a Guard's Raycast detects Alexei within a 10-meter range and 45-degree forward arc, THE Guard FSM SHALL transition to the Suspicious state.
4. WHILE in the Suspicious state, THE Guard SHALL move toward Alexei's last known position at 3 m/s and play an investigation animation.
5. WHEN a Guard in the Suspicious state maintains line-of-sight with Alexei for 2 continuous seconds, THE Guard FSM SHALL transition to the Alert state and increase the Alert_Level by 1.
6. WHILE in the Alert state, THE Guard SHALL chase Alexei at 4 m/s and broadcast the Alert_Level increase to all other Guards.
7. WHEN a Guard in the Alert state loses line-of-sight with Alexei for 5 continuous seconds, THE Guard FSM SHALL transition back to the Suspicious state.
8. WHEN the Alert_Level reaches 3, ALL Guards SHALL transition to the Chase state and move toward Alexei's current position at 5 m/s.
9. WHEN a Guard in any detection state reaches within 1 meter of Alexei, THE Game SHALL trigger the lose condition.
10. THE Guard pathfinding SHALL use a Waypoint graph to navigate around static obstacles without passing through walls.

---

### Requirement 8: Laser Detection System

**User Story:** As a Player, I want laser tripwires in the vault corridor, so that I must carefully navigate a physical puzzle to reach the vault.

#### Acceptance Criteria

1. THE Game SHALL place at least 5 laser beams in the corridor leading to the Vault room.
2. EACH laser beam SHALL be rendered as a visible red line mesh between two fixed emitter points.
3. WHEN Alexei's collision volume intersects a laser beam, THE Alarm SHALL increase the Alert_Level by 2 immediately.
4. WHERE a laser disable panel is present, THE Player SHALL be able to disable all lasers in a zone by solving a pattern-matching Puzzle at the panel.
5. WHEN the laser disable Puzzle is completed successfully, THE lasers in that zone SHALL deactivate and become non-detecting for the remainder of the session.

---

### Requirement 9: Vault Puzzle System

**User Story:** As a Player, I want to solve a vault-unlocking puzzle, so that accessing the vault feels earned and mentally engaging.

#### Acceptance Criteria

1. WHEN the Player interacts with the Vault door, THE Game SHALL display a fullscreen Puzzle UI overlay.
2. THE Vault Puzzle SHALL present a combination lock minigame requiring the Player to match a sequence of 4 symbols within 60 seconds.
3. WHEN the Player selects the correct symbol sequence, THE Puzzle SHALL play a success animation and unlock the Vault door.
4. WHEN the Player fails to complete the Puzzle within 60 seconds, THE Alarm SHALL increase the Alert_Level by 1 and the Puzzle SHALL reset.
5. THE Puzzle UI SHALL display a countdown timer and the current input sequence clearly.
6. FOR ALL valid symbol sequences, the Puzzle validation logic SHALL accept the correct sequence and reject all other sequences (correctness invariant).

---

### Requirement 10: Asset Stealing Mechanic

**User Story:** As a Player, I want to collect assets from the vault, so that I have a clear objective that drives the heist narrative.

#### Acceptance Criteria

1. THE Vault room SHALL contain at least 3 collectible Asset objects (e.g., gold bars, documents, hard drives).
2. WHEN the Player interacts with a collectible Asset, THE Game SHALL add it to Alexei's inventory and remove it from the Scene.
3. THE HUD SHALL display the number of Assets collected out of the total available.
4. THE win condition SHALL require the Player to collect at least 1 Asset before reaching the Escape_Zone.

---

### Requirement 11: Escape System

**User Story:** As a Player, I want a timed escape sequence, so that the endgame creates urgency and excitement.

#### Acceptance Criteria

1. THE Game SHALL display a global escape timer starting at 10 minutes when the Player first enters the bank interior.
2. WHEN the Alert_Level reaches 2, THE escape timer SHALL begin a visible countdown with a warning indicator on the HUD.
3. WHEN the Alert_Level reaches 3, THE escape timer SHALL reduce its remaining time by 50%.
4. WHEN the Player reaches the Escape_Zone with at least 1 collected Asset and the timer has not expired, THE Game SHALL trigger the win condition.
5. IF the escape timer reaches 0, THEN THE Game SHALL trigger the lose condition regardless of Alert_Level.
6. THE Escape_Zone SHALL be marked with a visible indicator (glowing pad or arrow) that activates when the Player has collected at least 1 Asset.

---

### Requirement 12: Decision System — Stealth vs Aggressive

**User Story:** As a Player, I want to choose between stealth and aggressive approaches, so that the game offers meaningful strategic variety.

#### Acceptance Criteria

1. THE Game SHALL allow the Player to complete the heist without triggering any Guard detection (full stealth path).
2. THE Game SHALL allow the Player to use distraction items (throwable objects) to redirect Guard patrol paths.
3. WHEN the Player throws a distraction object, THE Guard nearest to the impact point SHALL transition to the Suspicious state and move to investigate the sound.
4. WHERE an aggressive approach is taken and the Alert_Level reaches 3, THE Game SHALL increase Guard movement speed by 20% as a difficulty escalation.
5. THE Game SHALL track and display the Player's chosen approach (Stealth / Aggressive) on the end screen.

---

### Requirement 13: HUD and UI System

**User Story:** As a Player, I want a clean, minimal HUD, so that I can monitor my status without the interface cluttering the game view.

#### Acceptance Criteria

1. THE HUD SHALL display the current Alert_Level as a color-coded indicator (green/yellow/orange/red) at all times during gameplay.
2. THE HUD SHALL display the escape timer as a countdown in MM:SS format when the Alert_Level is 1 or higher.
3. THE HUD SHALL display the number of Assets collected (e.g., "Assets: 2/3") at all times during gameplay.
4. THE HUD SHALL display the current objective text in the top-left corner of the screen.
5. WHEN the win condition is triggered, THE Game SHALL display a win screen showing elapsed time, Assets collected, and approach style.
6. WHEN the lose condition is triggered, THE Game SHALL display a lose screen with the reason for failure and a restart option.
7. THE HUD SHALL use a dark semi-transparent overlay style to remain readable against all Scene backgrounds.

---

### Requirement 14: Win and Lose Conditions

**User Story:** As a Player, I want clear win and lose conditions, so that I understand the goals and consequences of my actions.

#### Acceptance Criteria

1. THE Game SHALL trigger the win condition WHEN the Player reaches the Escape_Zone with at least 1 collected Asset and the escape timer has not expired.
2. THE Game SHALL trigger the lose condition WHEN a Guard reaches within 1 meter of Alexei.
3. THE Game SHALL trigger the lose condition WHEN the escape timer reaches 0.
4. THE Game SHALL trigger the lose condition WHEN the Alert_Level reaches 3 and the Player does not reach the Escape_Zone within the remaining timer.
5. WHEN any lose condition is triggered, THE Game SHALL freeze gameplay, display the lose screen, and offer a full restart.
6. WHEN the win condition is triggered, THE Game SHALL play the Helicopter escape animation before displaying the win screen.

---

### Requirement 15: Performance and Optimization

**User Story:** As a Player, I want the game to run smoothly in my browser, so that performance issues do not break immersion.

#### Acceptance Criteria

1. THE Renderer SHALL maintain a minimum of 30 FPS on mid-range hardware during all gameplay phases, targeting 60 FPS.
2. THE Game SHALL use geometry instancing for repeated objects (e.g., chairs, pillars, lights) to reduce draw calls.
3. THE Game SHALL apply level-of-detail (LOD) reduction for objects beyond 20 meters from the camera.
4. THE Game SHALL limit the total polygon count of the active Scene to under 500,000 triangles.
5. THE Game SHALL use compressed textures and a maximum texture resolution of 1024x1024 pixels for environmental Assets.
6. WHEN the Renderer detects frame time exceeding 33ms for 3 consecutive frames, THE Game SHALL log a performance warning to the browser console.
