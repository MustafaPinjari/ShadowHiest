/**
 * DecisionTracker.js — Tracks whether the player was detected during the mission.
 * Used to determine the approach label shown on the win screen.
 * Requirements: 12.1, 12.5
 */

export class DecisionTracker {
  #detectionOccurred = false;

  /** Call this when any guard detects the player (transitions to Suspicious). */
  recordDetection() {
    this.#detectionOccurred = true;
  }

  /** Returns 'Stealth' if no detection occurred, 'Aggressive' otherwise. */
  getApproach() {
    return this.#detectionOccurred ? 'Aggressive' : 'Stealth';
  }

  reset() {
    this.#detectionOccurred = false;
  }
}

export const decisionTracker = new DecisionTracker();
