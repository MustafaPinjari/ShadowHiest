/**
 * EscapeTimer.js — 600-second countdown timer for the interior scene.
 *
 * Requirements: 11.1, 11.2, 11.3, 11.5
 *
 * - Starts when the player enters the interior scene
 * - Becomes visible on HUD when alertLevel >= 1
 * - On alertLevel === 3: halves remaining time (one-time only)
 * - On expire: calls GameState.triggerLose('timer')
 */
export class EscapeTimer {
  #totalSeconds = 600;
  #remaining = 600;
  #isRunning = false;
  #isVisible = false;
  #halved = false;
  #gameState = null;
  #listeners = []; // { type: 'tick'|'visibilityChange', callback }

  /** Begin countdown */
  start() {
    this.#isRunning = true;
  }

  /** Pause countdown */
  stop() {
    this.#isRunning = false;
  }

  /**
   * Call each frame with delta in seconds.
   * @param {number} delta — seconds since last frame
   */
  update(delta) {
    if (!this.#isRunning) return;

    this.#remaining = Math.max(0, this.#remaining - delta);
    this._emit('tick', this.#remaining);

    if (this.#remaining === 0) {
      this.#isRunning = false;
      this.#gameState?.triggerLose('timer');
    }
  }

  /**
   * Called by AlarmSystem or InteriorScene when alert level changes.
   * @param {number} level
   */
  onAlertLevelChange(level) {
    if (level >= 1 && !this.#isVisible) {
      this.#isVisible = true;
      this._emit('visibilityChange', true);
    }

    if (level === 3 && !this.#halved) {
      this.#remaining = Math.floor(this.#remaining * 0.5);
      this.#halved = true;
    }
  }

  /**
   * Subscribe to timer events.
   * @param {'tick'|'visibilityChange'} type
   * @param {Function} callback
   */
  on(type, callback) {
    this.#listeners.push({ type, callback });
  }

  /**
   * Unsubscribe from timer events.
   * @param {'tick'|'visibilityChange'} type
   * @param {Function} callback
   */
  off(type, callback) {
    const idx = this.#listeners.findIndex(
      (l) => l.type === type && l.callback === callback
    );
    if (idx !== -1) this.#listeners.splice(idx, 1);
  }

  /**
   * @param {object} gameState — must expose triggerLose(reason)
   */
  setGameState(gameState) {
    this.#gameState = gameState;
  }

  /** Seconds remaining */
  get remaining() {
    return this.#remaining;
  }

  /** Whether the timer is visible on the HUD */
  get isVisible() {
    return this.#isVisible;
  }

  /** Whether the countdown is actively running */
  get isRunning() {
    return this.#isRunning;
  }

  /**
   * Format remaining time as MM:SS string.
   * Uses Math.ceil so 59.1s shows as "01:00" not "00:59".
   * @returns {string}
   */
  getFormattedTime() {
    const total = Math.ceil(this.#remaining);
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  /**
   * Reset to initial state (useful for scene reloads / tests).
   */
  reset() {
    this.#remaining = this.#totalSeconds;
    this.#isRunning = false;
    this.#isVisible = false;
    this.#halved = false;
    this.#listeners = [];
  }

  /**
   * Internal: emit an event to all matching listeners.
   * @param {string} type
   * @param {*} data
   */
  _emit(type, data) {
    for (const listener of this.#listeners) {
      if (listener.type === type) {
        listener.callback(data);
      }
    }
  }
}
