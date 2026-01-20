// Score Tracker Module
// Tracks user performance and stores stats in localStorage

const ScoreTracker = (function() {
  const STORAGE_KEY = 'sg_simulator_scores';

  // Current session data
  let sessionData = {
    startTime: null,
    attempts: 0,
    successfulPurchases: 0,
    failedAttempts: 0,
    bestTime: null,
    lastPurchase: null
  };

  // All-time stats
  let allTimeStats = {
    totalAttempts: 0,
    totalSuccesses: 0,
    totalFailures: 0,
    bestTimeEver: null,
    bestSection: null,
    bestPrice: null,
    averageTime: null,
    purchaseHistory: [],
    difficultyStats: {
      easy: { attempts: 0, successes: 0 },
      medium: { attempts: 0, successes: 0 },
      hard: { attempts: 0, successes: 0 },
      nightmare: { attempts: 0, successes: 0 }
    }
  };

  // Load saved stats
  function loadStats() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        allTimeStats = { ...allTimeStats, ...JSON.parse(saved) };
      } catch (e) {
        console.error('Error loading scores:', e);
      }
    }
  }

  // Save stats
  function saveStats() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allTimeStats));
  }

  // Start a new attempt
  function startAttempt() {
    sessionData.startTime = Date.now();
    sessionData.attempts++;
    allTimeStats.totalAttempts++;

    const difficulty = GameConfig.getDifficultyName();
    if (allTimeStats.difficultyStats[difficulty]) {
      allTimeStats.difficultyStats[difficulty].attempts++;
    }

    saveStats();

    window.dispatchEvent(new CustomEvent('attemptStarted', {
      detail: { attemptNumber: sessionData.attempts }
    }));
  }

  // Record successful purchase
  function recordSuccess(purchaseData) {
    const endTime = Date.now();
    const duration = sessionData.startTime ? endTime - sessionData.startTime : 0;

    const record = {
      timestamp: endTime,
      duration: duration,
      difficulty: GameConfig.getDifficultyName(),
      section: purchaseData.section,
      row: purchaseData.row,
      price: purchaseData.price,
      quantity: purchaseData.quantity
    };

    sessionData.successfulPurchases++;
    sessionData.lastPurchase = record;

    // Update best time
    if (!sessionData.bestTime || duration < sessionData.bestTime) {
      sessionData.bestTime = duration;
    }

    // Update all-time stats
    allTimeStats.totalSuccesses++;

    if (!allTimeStats.bestTimeEver || duration < allTimeStats.bestTimeEver) {
      allTimeStats.bestTimeEver = duration;
    }

    // Track best section (by price tier - lower section number = better typically)
    const sectionNum = parseInt(purchaseData.section.replace(/\D/g, '')) || 999;
    const currentBestNum = allTimeStats.bestSection
      ? parseInt(allTimeStats.bestSection.replace(/\D/g, '')) || 999
      : 999;
    if (sectionNum < currentBestNum) {
      allTimeStats.bestSection = purchaseData.section;
    }

    // Track best price (lowest)
    if (!allTimeStats.bestPrice || purchaseData.price < allTimeStats.bestPrice) {
      allTimeStats.bestPrice = purchaseData.price;
    }

    // Calculate average time
    const successTimes = allTimeStats.purchaseHistory.map(p => p.duration).concat(duration);
    allTimeStats.averageTime = successTimes.reduce((a, b) => a + b, 0) / successTimes.length;

    // Add to history (keep last 50)
    allTimeStats.purchaseHistory.unshift(record);
    if (allTimeStats.purchaseHistory.length > 50) {
      allTimeStats.purchaseHistory.pop();
    }

    // Update difficulty stats
    const difficulty = GameConfig.getDifficultyName();
    if (allTimeStats.difficultyStats[difficulty]) {
      allTimeStats.difficultyStats[difficulty].successes++;
    }

    saveStats();

    window.dispatchEvent(new CustomEvent('purchaseSuccess', {
      detail: { record, sessionData, allTimeStats }
    }));

    return record;
  }

  // Record failed attempt (ticket stolen, sold out, etc)
  function recordFailure(reason) {
    sessionData.failedAttempts++;
    allTimeStats.totalFailures++;
    saveStats();

    window.dispatchEvent(new CustomEvent('purchaseFailure', {
      detail: { reason }
    }));
  }

  // Reset session (not all-time stats)
  function resetSession() {
    sessionData = {
      startTime: null,
      attempts: 0,
      successfulPurchases: 0,
      failedAttempts: 0,
      bestTime: null,
      lastPurchase: null
    };
  }

  // Reset all stats (full reset)
  function resetAllStats() {
    allTimeStats = {
      totalAttempts: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      bestTimeEver: null,
      bestSection: null,
      bestPrice: null,
      averageTime: null,
      purchaseHistory: [],
      difficultyStats: {
        easy: { attempts: 0, successes: 0 },
        medium: { attempts: 0, successes: 0 },
        hard: { attempts: 0, successes: 0 },
        nightmare: { attempts: 0, successes: 0 }
      }
    };
    resetSession();
    saveStats();
  }

  // Format time for display
  function formatTime(ms) {
    if (!ms && ms !== 0) return '--';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const milliseconds = Math.floor((ms % 1000) / 10);

    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
    }
    return `${seconds}.${milliseconds.toString().padStart(2, '0')}s`;
  }

  // Get current elapsed time
  function getElapsedTime() {
    if (!sessionData.startTime) return 0;
    return Date.now() - sessionData.startTime;
  }

  // Get session data
  function getSessionData() {
    return { ...sessionData };
  }

  // Get all-time stats
  function getAllTimeStats() {
    return { ...allTimeStats };
  }

  // Get success rate
  function getSuccessRate() {
    if (allTimeStats.totalAttempts === 0) return 0;
    return (allTimeStats.totalSuccesses / allTimeStats.totalAttempts * 100).toFixed(1);
  }

  // Get difficulty success rate
  function getDifficultySuccessRate(difficulty) {
    const stats = allTimeStats.difficultyStats[difficulty];
    if (!stats || stats.attempts === 0) return 0;
    return (stats.successes / stats.attempts * 100).toFixed(1);
  }

  // Initialize
  loadStats();

  // Public API
  return {
    startAttempt,
    recordSuccess,
    recordFailure,
    resetSession,
    resetAllStats,
    formatTime,
    getElapsedTime,
    getSessionData,
    getAllTimeStats,
    getSuccessRate,
    getDifficultySuccessRate
  };
})();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ScoreTracker;
}
