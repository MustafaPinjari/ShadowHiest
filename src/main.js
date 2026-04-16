/**
 * main.js — Entry point for Operation Shadow Heist
 * Initializes the Babylon.js engine, wires SceneManager, and starts the loading screen.
 */
import { Engine } from './core/Engine.js';
import { sceneManager } from './core/SceneManager.js';
import { LoadingScene } from './scenes/LoadingScene.js';
import { ExteriorScene } from './scenes/ExteriorScene.js';
import { gameState } from './core/GameState.js';

const canvas = document.getElementById('renderCanvas');
const engine = new Engine(canvas);

const initialized = engine.init();

if (initialized) {
  // Wire SceneManager into the engine render loop
  sceneManager.init(engine);

  // Pre-configure GameState with engine + sceneManager so win/lose screens work
  // from any scene. InteriorScene will re-configure with player/helicopter refs.
  gameState.configure({ engine, sceneManager });

  // Start the render loop — SceneManager's registered callback will drive scene updates
  engine.start();

  // Asset manifest — empty for now; scenes populate their own loaders
  const manifest = [];

  // LoadingScene → ExteriorScene (helicopter entry) → InteriorScene (auto-triggered on landing)
  sceneManager.loadScene(LoadingScene, manifest, () => {
    sceneManager.loadScene(ExteriorScene);
    console.log('Operation Shadow Heist — transitioning to exterior scene');
  });

  console.log('Operation Shadow Heist — engine initialized');
}
