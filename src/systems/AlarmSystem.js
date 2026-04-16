/**
 * AlarmSystem.js — Singleton managing the Alert_Level (0–3).
 *
 * Alert levels:
 *   0 = Silent
 *   1 = Suspicious
 *   2 = Alert
 *   3 = Full Alarm
 *
 * Cooldown logic: after a camera-exit event, a 3-second timer starts.
 * If no new detection occurs before it expires, decrease(1) fires automatically.
 */
const AlarmSystem = (() => {
  /** @type {number} Current alert level, clamped to [0, 3] */
  let alertLevel = 0;

  /** @type {number} Seconds remaining on the decrease cooldown (-1 = inactive) */
  let cooldownTimer = -1;

  /** @type {Function[]} Registered level-change listeners */
  const listeners = [];

  /** Duration of the camera-exit cooldown in seconds */
  const COOLDOWN_DURATION = 3;

  /**
   * Notify all registered listeners of a level change.
   * @param {number} newLevel
   * @param {number} oldLevel
   */
  function _notify(newLevel, oldLevel) {
    for (const cb of listeners) {
      cb(newLevel, oldLevel);
    }
  }

  return {
    /** Read-only access to the current alert level. */
    get alertLevel() {
      return alertLevel;
    },

    /**
     * Increase the alert level by `amount`, clamped to 3.
     * Fires onLevelChange callbacks if the level changed.
     * @param {number} amount
     */
    increase(amount) {
      const prev = alertLevel;
      alertLevel = Math.min(3, alertLevel + amount);
      if (alertLevel !== prev) {
        _notify(alertLevel, prev);
      }
    },

    /**
     * Decrease the alert level by `amount`, clamped to 0.
     * Fires onLevelChange callbacks if the level changed.
     * @param {number} amount
     */
    decrease(amount) {
      const prev = alertLevel;
      alertLevel = Math.max(0, alertLevel - amount);
      if (alertLevel !== prev) {
        _notify(alertLevel, prev);
      }
    },

    /**
     * Tick the cooldown timer. When it reaches 0, decrease(1) fires.
     * Called each frame from the game loop with the frame delta in seconds.
     * @param {number} delta — seconds since last frame
     */
    update(delta) {
      if (cooldownTimer < 0) return;

      cooldownTimer -= delta;
      if (cooldownTimer <= 0) {
        cooldownTimer = -1;
        this.decrease(1);
      }
    },

    /**
     * Start (or restart) the 3-second camera-exit cooldown.
     * After the cooldown expires without a new detection, decrease(1) fires.
     */
    startCooldown() {
      cooldownTimer = COOLDOWN_DURATION;
    },

    /**
     * Register a callback invoked whenever alertLevel changes.
     * Callback signature: (newLevel: number, oldLevel: number) => void
     * @param {Function} callback
     */
    onLevelChange(callback) {
      listeners.push(callback);
    },

    /**
     * Remove a previously registered onLevelChange callback.
     * @param {Function} callback
     */
    offLevelChange(callback) {
      const idx = listeners.indexOf(callback);
      if (idx !== -1) listeners.splice(idx, 1);
    },

    /**
     * Reset the system to its initial state (useful for scene reloads / tests).
     */
    reset() {
      alertLevel = 0;
      cooldownTimer = -1;
      listeners.length = 0;
    },
  };
})();

export default AlarmSystem;
