// Bot Simulator Module
// Simulates other buyers competing for tickets

const BotSimulator = (function() {
  let botInterval = null;
  let isRunning = false;
  let removedListings = new Set();
  let removedSections = new Set();

  // Start bot simulation
  function start() {
    if (isRunning) return;

    const config = GameConfig.getDifficulty();
    if (!config.botsEnabled) {
      console.log('Bots disabled for this difficulty');
      return;
    }

    isRunning = true;
    removedListings.clear();
    removedSections.clear();

    // Calculate interval based on disappear rate
    // Rate is listings per second, so interval = 1000 / rate
    const baseInterval = config.listingDisappearRate > 0
      ? 1000 / config.listingDisappearRate
      : 10000;

    // Add some randomness
    scheduleNextBotAction(baseInterval);

    console.log(`Bot simulator started (difficulty: ${GameConfig.getDifficultyName()})`);
  }

  // Schedule next bot action with randomness
  function scheduleNextBotAction(baseInterval) {
    if (!isRunning) return;

    // Random interval between 0.5x and 1.5x base
    const randomInterval = baseInterval * (0.5 + Math.random());

    botInterval = setTimeout(() => {
      performBotAction();
      scheduleNextBotAction(baseInterval);
    }, randomInterval);
  }

  // Perform a bot action (buy a ticket)
  function performBotAction() {
    if (!isRunning || !GameConfig.isGameActive()) return;

    const config = GameConfig.getDifficulty();

    // Get current listings from state
    if (typeof state === 'undefined' || !state.listings) return;

    const availableListings = state.listings.filter(l =>
      !removedListings.has(`${l.sectionId}-${l.row}`)
    );

    if (availableListings.length === 0) return;

    // Bots prefer better sections (lower index = better price usually sorted)
    // But add some randomness
    let targetIndex;
    if (config.botSpeed >= 3) {
      // Nightmare: bots target best listings
      targetIndex = Math.floor(Math.random() * Math.min(10, availableListings.length));
    } else if (config.botSpeed >= 2) {
      // Hard: bots target good listings
      targetIndex = Math.floor(Math.random() * Math.min(20, availableListings.length));
    } else {
      // Medium: random selection
      targetIndex = Math.floor(Math.random() * availableListings.length);
    }

    const targetListing = availableListings[targetIndex];
    if (!targetListing) return;

    // Mark listing as sold
    const listingKey = `${targetListing.sectionId}-${targetListing.row}`;
    removedListings.add(listingKey);

    // Dispatch event for UI update
    window.dispatchEvent(new CustomEvent('listingSold', {
      detail: {
        sectionId: targetListing.sectionId,
        row: targetListing.row,
        sectionName: targetListing.sectionName
      }
    }));

    // Check if entire section is sold out
    const remainingSectionListings = availableListings.filter(l =>
      l.sectionId === targetListing.sectionId &&
      !removedListings.has(`${l.sectionId}-${l.row}`)
    );

    if (remainingSectionListings.length <= 1) {
      removedSections.add(targetListing.sectionId);
      window.dispatchEvent(new CustomEvent('sectionSoldOut', {
        detail: { sectionId: targetListing.sectionId }
      }));
    }

    console.log(`Bot bought: ${targetListing.sectionName} Row ${targetListing.row}`);
  }

  // Check if a listing was stolen by bots
  function isListingSold(sectionId, row) {
    return removedListings.has(`${sectionId}-${row}`);
  }

  // Check if section is sold out
  function isSectionSoldOut(sectionId) {
    return removedSections.has(sectionId);
  }

  // Try to steal the currently viewed listing (called when viewing detail)
  function tryStealCurrentListing(sectionId, row) {
    if (!isRunning || !GameConfig.isGameActive()) return false;

    const config = GameConfig.getDifficulty();

    // Random chance based on difficulty
    if (Math.random() < config.ticketStealChance) {
      const listingKey = `${sectionId}-${row}`;
      if (!removedListings.has(listingKey)) {
        removedListings.add(listingKey);
        window.dispatchEvent(new CustomEvent('currentListingStolen', {
          detail: { sectionId, row }
        }));
        return true;
      }
    }
    return false;
  }

  // Stop bot simulation
  function stop() {
    isRunning = false;
    if (botInterval) {
      clearTimeout(botInterval);
      botInterval = null;
    }
    console.log('Bot simulator stopped');
  }

  // Reset (for new game)
  function reset() {
    stop();
    removedListings.clear();
    removedSections.clear();
  }

  // Get stats
  function getStats() {
    return {
      listingsSold: removedListings.size,
      sectionsSoldOut: removedSections.size
    };
  }

  // Get removed listings for filtering
  function getRemovedListings() {
    return new Set(removedListings);
  }

  function getRemovedSections() {
    return new Set(removedSections);
  }

  // Public API
  return {
    start,
    stop,
    reset,
    isListingSold,
    isSectionSoldOut,
    tryStealCurrentListing,
    getStats,
    getRemovedListings,
    getRemovedSections
  };
})();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BotSimulator;
}
