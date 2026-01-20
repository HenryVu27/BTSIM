// Countdown Timer Module
// Handles refresh functionality and onsale countdown

const CountdownTimer = (function() {
  let countdownInterval = null;
  let holdTimerInterval = null;
  let elapsedTimerInterval = null;
  let currentHoldTime = 0;
  let maxHoldTime = 0;
  let isWaitingForOnsale = false;
  let onsaleTargetTime = null;

  // Start countdown to onsale
  function startOnsaleCountdown(seconds = 10) {
    onsaleTargetTime = Date.now() + (seconds * 1000);
    isWaitingForOnsale = true;

    // Show waiting room UI
    window.dispatchEvent(new CustomEvent('waitingRoomStarted', {
      detail: { targetTime: onsaleTargetTime, seconds }
    }));

    updateCountdownDisplay();

    countdownInterval = setInterval(() => {
      const remaining = onsaleTargetTime - Date.now();

      if (remaining <= 0) {
        clearInterval(countdownInterval);
        countdownInterval = null;
        isWaitingForOnsale = false;
        triggerOnsale();
      } else {
        updateCountdownDisplay();
      }
    }, 100);
  }

  // Update countdown display
  function updateCountdownDisplay() {
    const remaining = Math.max(0, onsaleTargetTime - Date.now());
    const seconds = Math.ceil(remaining / 1000);

    window.dispatchEvent(new CustomEvent('countdownTick', {
      detail: {
        remaining,
        seconds,
        formatted: formatCountdown(remaining)
      }
    }));
  }

  // Format countdown for display
  function formatCountdown(ms) {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes > 0) {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${seconds}`;
  }

  // Trigger onsale (tickets become available)
  function triggerOnsale() {
    window.dispatchEvent(new CustomEvent('onsaleStarted'));
    GameConfig.startGame();
    ScoreTracker.startAttempt();
    BotSimulator.start();
    startElapsedTimer();
  }

  // Start elapsed time tracker
  function startElapsedTimer() {
    elapsedTimerInterval = setInterval(() => {
      const elapsed = ScoreTracker.getElapsedTime();
      window.dispatchEvent(new CustomEvent('elapsedTimeTick', {
        detail: {
          elapsed,
          formatted: ScoreTracker.formatTime(elapsed)
        }
      }));
    }, 100);
  }

  // Stop elapsed timer
  function stopElapsedTimer() {
    if (elapsedTimerInterval) {
      clearInterval(elapsedTimerInterval);
      elapsedTimerInterval = null;
    }
  }

  // Start ticket hold timer (when viewing a listing)
  function startHoldTimer(listingId) {
    stopHoldTimer();

    const config = GameConfig.getDifficulty();
    if (config.ticketHoldTime === Infinity) {
      // No timer for easy mode
      return;
    }

    maxHoldTime = config.ticketHoldTime;
    currentHoldTime = maxHoldTime;

    window.dispatchEvent(new CustomEvent('holdTimerStarted', {
      detail: { maxTime: maxHoldTime, listingId }
    }));

    holdTimerInterval = setInterval(() => {
      currentHoldTime -= 100;

      window.dispatchEvent(new CustomEvent('holdTimerTick', {
        detail: {
          remaining: currentHoldTime,
          percent: (currentHoldTime / maxHoldTime) * 100,
          formatted: formatHoldTime(currentHoldTime)
        }
      }));

      if (currentHoldTime <= 0) {
        stopHoldTimer();
        window.dispatchEvent(new CustomEvent('holdTimerExpired', {
          detail: { listingId }
        }));
      }
    }, 100);
  }

  // Format hold time for display
  function formatHoldTime(ms) {
    const seconds = Math.ceil(ms / 1000);
    return `${seconds}s`;
  }

  // Stop hold timer
  function stopHoldTimer() {
    if (holdTimerInterval) {
      clearInterval(holdTimerInterval);
      holdTimerInterval = null;
    }
    currentHoldTime = 0;
  }

  // Get current hold time remaining
  function getHoldTimeRemaining() {
    return currentHoldTime;
  }

  // Get hold time percent remaining
  function getHoldTimePercent() {
    if (maxHoldTime === 0) return 100;
    return (currentHoldTime / maxHoldTime) * 100;
  }

  // Cancel onsale countdown
  function cancelCountdown() {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    isWaitingForOnsale = false;
    onsaleTargetTime = null;

    window.dispatchEvent(new CustomEvent('countdownCancelled'));
  }

  // Reset all timers
  function reset() {
    cancelCountdown();
    stopHoldTimer();
    stopElapsedTimer();
  }

  // Quick refresh (instant, no countdown)
  function quickRefresh() {
    reset();
    BotSimulator.reset();
    ScoreTracker.resetSession();

    window.dispatchEvent(new CustomEvent('refreshTriggered'));

    // Start game immediately
    GameConfig.startGame();
    ScoreTracker.startAttempt();
    BotSimulator.start();
    startElapsedTimer();
  }

  // Check if waiting for onsale
  function isWaiting() {
    return isWaitingForOnsale;
  }

  // Get time until onsale
  function getTimeUntilOnsale() {
    if (!onsaleTargetTime) return null;
    return Math.max(0, onsaleTargetTime - Date.now());
  }

  // Public API
  return {
    startOnsaleCountdown,
    triggerOnsale,
    cancelCountdown,
    startHoldTimer,
    stopHoldTimer,
    getHoldTimeRemaining,
    getHoldTimePercent,
    stopElapsedTimer,
    quickRefresh,
    reset,
    isWaiting,
    getTimeUntilOnsale,
    formatCountdown
  };
})();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CountdownTimer;
}
