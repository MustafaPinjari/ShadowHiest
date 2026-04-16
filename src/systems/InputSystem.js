/**
 * InputSystem.js — Keyboard and mouse input tracking
 * Tracks keyboard state for WASD, arrow keys, Shift, C, E and mouse delta each frame.
 */
export default class InputSystem {
  /** @type {Set<string>} Keys currently held down */
  #keys = new Set();

  /** @type {{ x: number, y: number }} Accumulated mouse delta for the current frame */
  #mouseDelta = { x: 0, y: 0 };

  /** @type {Set<string>} Tracked keys */
  static #TRACKED_KEYS = new Set([
    'w', 'a', 's', 'd',
    'W', 'A', 'S', 'D',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'Shift', 'c', 'C', 'e', 'E',
  ]);

  /** @type {(e: KeyboardEvent) => void} */
  #onKeyDown;
  /** @type {(e: KeyboardEvent) => void} */
  #onKeyUp;
  /** @type {(e: MouseEvent) => void} */
  #onMouseMove;

  constructor() {
    this.#onKeyDown = (e) => {
      if (InputSystem.#TRACKED_KEYS.has(e.key)) {
        this.#keys.add(e.key);
      }
    };

    this.#onKeyUp = (e) => {
      this.#keys.delete(e.key);
    };

    this.#onMouseMove = (e) => {
      this.#mouseDelta.x += e.movementX;
      this.#mouseDelta.y += e.movementY;
    };

    window.addEventListener('keydown', this.#onKeyDown);
    window.addEventListener('keyup', this.#onKeyUp);
    window.addEventListener('mousemove', this.#onMouseMove);
  }

  /**
   * Returns true if the given key is currently held down.
   * @param {string} key — e.g. 'w', 'ArrowUp', 'Shift'
   * @returns {boolean}
   */
  isKeyDown(key) {
    return this.#keys.has(key);
  }

  /**
   * Returns the accumulated mouse movement delta for the current frame, then resets to zero.
   * @returns {{ x: number, y: number }}
   */
  getMouseDelta() {
    const delta = { x: this.#mouseDelta.x, y: this.#mouseDelta.y };
    this.#mouseDelta.x = 0;
    this.#mouseDelta.y = 0;
    return delta;
  }

  /**
   * One-shot key check: returns true if the key is currently down, then clears it.
   * Used for actions like interact (E key) that should fire once per press.
   * @param {string} key
   * @returns {boolean}
   */
  consumeKey(key) {
    if (this.#keys.has(key)) {
      this.#keys.delete(key);
      return true;
    }
    return false;
  }

  /**
   * Called each frame to reset per-frame state.
   * Mouse delta is reset by getMouseDelta(); this method is a hook for future per-frame resets.
   */
  update() {
    // Mouse delta is reset on read via getMouseDelta().
    // This method exists for future per-frame state resets and to fit the game loop interface.
  }

  /**
   * Remove all event listeners. Call when the system is no longer needed.
   */
  dispose() {
    window.removeEventListener('keydown', this.#onKeyDown);
    window.removeEventListener('keyup', this.#onKeyUp);
    window.removeEventListener('mousemove', this.#onMouseMove);
  }
}
