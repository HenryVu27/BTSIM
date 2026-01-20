// Game Configuration Module
// Handles difficulty settings and game state

const GameConfig = (function() {
  // Difficulty presets
  const DIFFICULTIES = {
    easy: {
      name: 'Easy',
      description: 'Practice mode - no pressure',
      availabilityPercent: { min: 0.65, max: 0.80 },
      botsEnabled: false,
      botSpeed: 0,
      ticketHoldTime: Infinity, // No time limit
      ticketStealChance: 0,
      listingDisappearRate: 0 // listings per second
    },
    medium: {
      name: 'Medium',
      description: 'Some competition from other buyers',
      availabilityPercent: { min: 0.45, max: 0.60 },
      botsEnabled: true,
      botSpeed: 1,
      ticketHoldTime: 60000, // 60 seconds
      ticketStealChance: 0.1, // 10% chance per check
      listingDisappearRate: 0.05 // 1 listing every 20 seconds on average
    },
    hard: {
      name: 'Hard',
      description: 'High demand event simulation',
      availabilityPercent: { min: 0.25, max: 0.40 },
      botsEnabled: true,
      botSpeed: 2,
      ticketHoldTime: 30000, // 30 seconds
      ticketStealChance: 0.25, // 25% chance per check
      listingDisappearRate: 0.15 // 1 listing every ~7 seconds
    },
    nightmare: {
      name: 'Nightmare',
      description: 'BTS/Taylor Swift level chaos',
      availabilityPercent: { min: 0.10, max: 0.20 },
      botsEnabled: true,
      botSpeed: 3,
      ticketHoldTime: 15000, // 15 seconds
      ticketStealChance: 0.4, // 40% chance per check
      listingDisappearRate: 0.3 // 1 listing every ~3 seconds
    }
  };

  // Current game state
  let currentDifficulty = 'medium';
  let gameActive = false;
  let countdownMode = false;
  let onsaleTime = null;

  // Load saved settings
  function loadSettings() {
    const saved = localStorage.getItem('sg_simulator_settings');
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        currentDifficulty = settings.difficulty || 'medium';
      } catch (e) {
        console.error('Error loading settings:', e);
      }
    }
  }

  // Save settings
  function saveSettings() {
    localStorage.setItem('sg_simulator_settings', JSON.stringify({
      difficulty: currentDifficulty
    }));
  }

  // Get current difficulty config
  function getDifficulty() {
    return DIFFICULTIES[currentDifficulty];
  }

  // Set difficulty
  function setDifficulty(level) {
    if (DIFFICULTIES[level]) {
      currentDifficulty = level;
      saveSettings();
      return true;
    }
    return false;
  }

  // Get difficulty name
  function getDifficultyName() {
    return currentDifficulty;
  }

  // Get all difficulties for UI
  function getAllDifficulties() {
    return Object.entries(DIFFICULTIES).map(([key, value]) => ({
      id: key,
      ...value
    }));
  }

  // Game state methods
  function startGame() {
    gameActive = true;
    window.dispatchEvent(new CustomEvent('gameStarted'));
  }

  function endGame(success) {
    gameActive = false;
    window.dispatchEvent(new CustomEvent('gameEnded', { detail: { success } }));
  }

  function isGameActive() {
    return gameActive;
  }

  // Countdown mode
  function setCountdownMode(enabled, targetTime = null) {
    countdownMode = enabled;
    onsaleTime = targetTime;
  }

  function isCountdownMode() {
    return countdownMode;
  }

  function getOnsaleTime() {
    return onsaleTime;
  }

  // Initialize
  loadSettings();

  // Public API
  return {
    getDifficulty,
    setDifficulty,
    getDifficultyName,
    getAllDifficulties,
    startGame,
    endGame,
    isGameActive,
    setCountdownMode,
    isCountdownMode,
    getOnsaleTime,
    DIFFICULTIES
  };
})();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GameConfig;
}
