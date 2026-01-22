// BTS Concert Ticket Simulator
// Main Application Logic

// State Management
const state = {
  ticketQuantity: 2,
  selectedSection: null,
  selectedListing: null,
  priceRange: { min: 0, max: 5000 },
  filters: {
    aisle: false,
    frontRow: false,
    includeFees: true
  },
  sections: [],
  listings: [],
  availableSectionIds: new Set(), // Sections with tickets available
  zoom: 1,
  pan: { x: 0, y: 0 },
  hoveredSection: null,
  allSectionIds: [] // Store all section IDs for reset
};

// Game State
const gameState = {
  difficulty: 'medium',
  isOnsaleMode: false,
  onsaleCountdown: null,
  countdownInterval: null,
  botInterval: null,
  holdTimer: null,
  holdTimerInterval: null,
  holdTimeRemaining: 0,
  sessionStats: {
    attempts: 0,
    successes: 0,
    fastestCheckout: null,
    bestSection: null,
    totalSpent: 0
  },
  currentAttempt: {
    startTime: null,
    listingViewTime: null
  }
};

// Difficulty configurations
const difficultySettings = {
  easy: {
    label: 'Easy',
    description: 'Learn the interface, no competition',
    availablePercent: { min: 0.65, max: 0.80 },
    botEnabled: false,
    botSpeed: 0,
    holdTime: 0,
    ticketDisappearRate: 0
  },
  medium: {
    label: 'Medium',
    description: 'Some tickets sell out while browsing',
    availablePercent: { min: 0.40, max: 0.55 },
    botEnabled: true,
    botSpeed: 2000,      // Check every 2 seconds
    holdTime: 45,
    ticketDisappearRate: 0.08  // 8% chance each check
  },
  hard: {
    label: 'Hard',
    description: 'High demand, tickets go fast',
    availablePercent: { min: 0.20, max: 0.35 },
    botEnabled: true,
    botSpeed: 1000,      // Check every 1 second
    holdTime: 20,
    ticketDisappearRate: 0.15  // 15% chance each check
  },
  nightmare: {
    label: 'Nightmare',
    description: 'BTS onsale day - thousands competing',
    availablePercent: { min: 0.05, max: 0.15 },
    botEnabled: true,
    botSpeed: 500,       // Check every 0.5 seconds
    holdTime: 10,
    ticketDisappearRate: 0.25  // 25% chance each check - chaos!
  }
};

// Configuration for random availability
const availabilityConfig = {
  minAvailablePercent: 0.45,
  maxAvailablePercent: 0.60
};

// Load saved stats from localStorage
function loadGameStats() {
  const saved = localStorage.getItem('bts_sim_stats');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      Object.assign(gameState.sessionStats, parsed);
    } catch (e) {
      console.log('Could not load saved stats');
    }
  }
  const savedDifficulty = localStorage.getItem('bts_sim_difficulty');
  if (savedDifficulty && difficultySettings[savedDifficulty]) {
    gameState.difficulty = savedDifficulty;
    applyDifficultySettings(savedDifficulty);
  }
}

// Save stats to localStorage
function saveGameStats() {
  localStorage.setItem('bts_sim_stats', JSON.stringify(gameState.sessionStats));
  localStorage.setItem('bts_sim_difficulty', gameState.difficulty);
}

// Apply difficulty settings (without resetting)
function applyDifficultySettings(difficulty) {
  const settings = difficultySettings[difficulty];
  if (!settings) return;

  gameState.difficulty = difficulty;
  availabilityConfig.minAvailablePercent = settings.availablePercent.min;
  availabilityConfig.maxAvailablePercent = settings.availablePercent.max;
}

// Change difficulty and refresh
function changeDifficulty(difficulty) {
  applyDifficultySettings(difficulty);
  saveGameStats();
  updateDifficultyDisplay();
  updateDifficultyBadge();
  refreshTickets();
}

// Update difficulty display
function updateDifficultyDisplay() {
  const difficultyLabel = document.getElementById('current-difficulty');
  if (difficultyLabel) {
    difficultyLabel.textContent = difficultySettings[gameState.difficulty].label;
  }

  // Update selected state in settings modal
  document.querySelectorAll('.difficulty-option').forEach(opt => {
    opt.classList.toggle('selected', opt.dataset.difficulty === gameState.difficulty);
  });
}

// Update stats display
function updateStatsDisplay() {
  const attemptsEl = document.getElementById('stat-attempts');
  const successesEl = document.getElementById('stat-successes');
  const fastestEl = document.getElementById('stat-fastest');
  const rateEl = document.getElementById('stat-rate');

  if (attemptsEl) attemptsEl.textContent = gameState.sessionStats.attempts;
  if (successesEl) successesEl.textContent = gameState.sessionStats.successes;
  if (fastestEl) {
    fastestEl.textContent = gameState.sessionStats.fastestCheckout
      ? `${(gameState.sessionStats.fastestCheckout / 1000).toFixed(1)}s`
      : '--';
  }
  if (rateEl) {
    const rate = gameState.sessionStats.attempts > 0
      ? Math.round((gameState.sessionStats.successes / gameState.sessionStats.attempts) * 100)
      : 0;
    rateEl.textContent = `${rate}%`;
  }
}

// Show ready modal before refresh
function showReadyModal() {
  const readyModal = document.getElementById('ready-modal');
  if (readyModal) {
    readyModal.classList.add('visible');
  }
}

// Hide ready modal
function hideReadyModal() {
  const readyModal = document.getElementById('ready-modal');
  if (readyModal) {
    readyModal.classList.remove('visible');
  }
}

// Refresh tickets (regenerate availability)
function refreshTickets() {
  console.log('Refreshing tickets...');

  // Stop any existing bot first
  stopBotActivity();

  // Show ready modal
  showReadyModal();

  // Wait 2 seconds, then do the actual refresh
  setTimeout(() => {
    hideReadyModal();
    performRefresh();
  }, 2000);
}

// Perform the actual refresh logic
function performRefresh() {
  // Record attempt start time (timer starts AFTER ready screen)
  gameState.currentAttempt.startTime = Date.now();
  gameState.sessionStats.attempts++;
  saveGameStats();
  updateStatsDisplay();

  // Get the SVG
  const mapContainer = document.getElementById('map-container');
  const svg = mapContainer.querySelector('svg');
  if (!svg) return;

  // Re-select available sections
  if (state.allSectionIds.length > 0) {
    state.availableSectionIds = selectAvailableSections(state.allSectionIds);

    // Regenerate section data for available sections
    state.sections = state.allSectionIds
      .filter(id => state.availableSectionIds.has(id))
      .map(id => generateSectionData(id));

    // Regenerate listings
    state.listings = generateListings();
    renderListings();

    // Update map colors
    colorCodeSections(svg);

    // Update section interactivity
    updateSectionAvailability(svg);

    // Generate histogram
    if (state.listings.length > 0) {
      generatePriceHistogram();
    }

    // Start bot activity if enabled
    startBotActivity();

    // Close any open listing detail
    hideListingDetail();

    showToast(`Tickets refreshed! ${state.availableSectionIds.size} sections available`);
  }
}

// Update section availability on map
function updateSectionAvailability(svg) {
  const allPaths = svg.querySelectorAll('path.section-path');

  allPaths.forEach(path => {
    const id = path.getAttribute('id');
    const isAvailable = state.availableSectionIds.has(id);

    if (isAvailable) {
      path.style.cursor = 'pointer';
      path.style.pointerEvents = 'all';
      path.classList.add('section-available');
      path.classList.remove('section-unavailable');
    } else {
      path.style.cursor = 'default';
      path.style.pointerEvents = 'none';
      path.classList.remove('section-available');
      path.classList.add('section-unavailable');
      path.setAttribute('fill', '#e0e0e0');
    }
  });
}

// Bot activity - simulates other buyers purchasing tickets
function startBotActivity() {
  const settings = difficultySettings[gameState.difficulty];
  if (!settings.botEnabled) return;

  gameState.botInterval = setInterval(() => {
    if (state.listings.length === 0) return;

    // Determine how many listings to remove this tick
    // Nightmare: 3-8 listings, Hard: 2-5, Medium: 1-3
    const baseRemove = gameState.difficulty === 'nightmare' ? 3 :
                       gameState.difficulty === 'hard' ? 2 : 1;
    const maxExtra = gameState.difficulty === 'nightmare' ? 5 :
                     gameState.difficulty === 'hard' ? 3 : 2;
    const numToRemove = Math.min(
      baseRemove + Math.floor(Math.random() * maxExtra),
      state.listings.length
    );

    const sectionsAffected = new Set();

    // Chance to wipe out an entire section (someone bought all tickets)
    // Nightmare: 15% chance, Hard: 8%, Medium: 3%
    const sectionWipeChance = gameState.difficulty === 'nightmare' ? 0.15 :
                              gameState.difficulty === 'hard' ? 0.08 : 0.03;

    if (Math.random() < sectionWipeChance && state.availableSectionIds.size > 0) {
      // Pick a random section and remove ALL its listings
      const availableSections = [...state.availableSectionIds];
      const sectionToWipe = availableSections[Math.floor(Math.random() * availableSections.length)];

      // Check if user is viewing this section
      if (state.selectedListing && state.selectedListing.sectionId === sectionToWipe) {
        showListingSoldOut();
      }

      // Remove all listings for this section
      state.listings = state.listings.filter(l => l.sectionId !== sectionToWipe);
      markSectionSoldOut(sectionToWipe);
      renderListings();
      return;
    }

    // Remove individual listings
    for (let i = 0; i < numToRemove && state.listings.length > 0; i++) {
      if (Math.random() < settings.ticketDisappearRate) {
        const randomIndex = Math.floor(Math.random() * state.listings.length);
        const removedListing = state.listings[randomIndex];

        // Remove the listing
        state.listings.splice(randomIndex, 1);
        sectionsAffected.add(removedListing.sectionId);

        // If viewing this listing, show sold message
        if (state.selectedListing &&
            state.selectedListing.sectionId === removedListing.sectionId &&
            state.selectedListing.row === removedListing.row) {
          showListingSoldOut();
        }
      }
    }

    // Update affected sections
    sectionsAffected.forEach(sectionId => {
      const sectionListings = state.listings.filter(l => l.sectionId === sectionId);
      if (sectionListings.length === 0) {
        markSectionSoldOut(sectionId);
      } else {
        updateSectionColor(sectionId);
      }
    });

    if (sectionsAffected.size > 0) {
      renderListings();
    }
  }, settings.botSpeed);
}

function stopBotActivity() {
  if (gameState.botInterval) {
    clearInterval(gameState.botInterval);
    gameState.botInterval = null;
  }
}

// Mark a section as sold out
function markSectionSoldOut(sectionId) {
  state.availableSectionIds.delete(sectionId);

  const mapContainer = document.getElementById('map-container');
  const svg = mapContainer.querySelector('svg');
  const path = svg?.querySelector(`path[id="${sectionId}"]`);

  if (path) {
    path.style.cursor = 'default';
    path.style.pointerEvents = 'none';
    path.classList.remove('section-available');
    path.classList.add('section-unavailable');
    path.setAttribute('fill', '#e0e0e0');
    path.dataset.tierColor = '#e0e0e0';
  }
}

// Update a single section's color based on remaining listings
function updateSectionColor(sectionId) {
  const mapContainer = document.getElementById('map-container');
  const svg = mapContainer.querySelector('svg');
  const path = svg?.querySelector(`path[id="${sectionId}"]`);

  if (!path) return;

  const sectionListings = state.listings.filter(l => l.sectionId === sectionId);
  if (sectionListings.length === 0) {
    markSectionSoldOut(sectionId);
    return;
  }

  // Get new lowest price
  const price = Math.min(...sectionListings.map(l => l.price));

  // Color based on price tier
  let bgColor = '';
  if (price < 200) bgColor = '#e8f5e9';
  else if (price < 400) bgColor = '#c8e6c9';
  else if (price < 600) bgColor = '#a5d6a7';
  else if (price < 800) bgColor = '#81c784';
  else bgColor = '#66bb6a';

  path.setAttribute('fill', bgColor);
  path.dataset.tierColor = bgColor;
  path.dataset.price = price;
}

// Show listing sold out message
function showListingSoldOut() {
  showToast('This listing is no longer available');
  hideListingDetail();
}

// Hold timer for listing detail
function startHoldTimer() {
  const settings = difficultySettings[gameState.difficulty];
  if (settings.holdTime === 0) return;

  stopHoldTimer();

  gameState.holdTimeRemaining = settings.holdTime;
  gameState.currentAttempt.listingViewTime = Date.now();
  updateHoldTimerDisplay();

  gameState.holdTimerInterval = setInterval(() => {
    gameState.holdTimeRemaining--;
    updateHoldTimerDisplay();

    if (gameState.holdTimeRemaining <= 0) {
      stopHoldTimer();
      showListingSoldOut();
    }
  }, 1000);
}

function stopHoldTimer() {
  if (gameState.holdTimerInterval) {
    clearInterval(gameState.holdTimerInterval);
    gameState.holdTimerInterval = null;
  }
  gameState.holdTimeRemaining = 0;
  updateHoldTimerDisplay();
}

function updateHoldTimerDisplay() {
  // Update the progress bar style timer
  updateHoldTimerBar();

  // Also update legacy timer if it exists
  const timerEl = document.getElementById('hold-timer');
  const timerContainer = document.getElementById('hold-timer-container');

  if (timerEl && timerContainer) {
    if (gameState.holdTimeRemaining > 0) {
      timerContainer.classList.add('visible');
      timerEl.textContent = gameState.holdTimeRemaining;

      if (gameState.holdTimeRemaining <= 10) {
        timerContainer.classList.add('urgent');
      } else {
        timerContainer.classList.remove('urgent');
      }
    } else {
      timerContainer.classList.remove('visible', 'urgent');
    }
  }
}

// Record successful checkout
function recordSuccessfulCheckout() {
  const checkoutTime = Date.now() - gameState.currentAttempt.startTime;

  gameState.sessionStats.successes++;

  if (!gameState.sessionStats.fastestCheckout || checkoutTime < gameState.sessionStats.fastestCheckout) {
    gameState.sessionStats.fastestCheckout = checkoutTime;
  }

  if (state.selectedListing) {
    gameState.sessionStats.totalSpent += state.selectedListing.price * state.ticketQuantity;

    // Track best section (lowest section number = closer to stage)
    const sectionNum = parseInt(state.selectedListing.sectionId);
    if (!isNaN(sectionNum)) {
      if (!gameState.sessionStats.bestSection || sectionNum < gameState.sessionStats.bestSection) {
        gameState.sessionStats.bestSection = sectionNum;
      }
    }
  }

  saveGameStats();
  updateStatsDisplay();
}

// Reset stats
function resetStats() {
  gameState.sessionStats = {
    attempts: 0,
    successes: 0,
    fastestCheckout: null,
    bestSection: null,
    totalSpent: 0
  };
  saveGameStats();
  updateStatsDisplay();
  showToast('Stats reset');
}

// Color scheme matching SeatGeek
const colors = {
  available: {
    tier1: '#1a5f2a', // Premium - dark green
    tier2: '#2d8f4e', // High price
    tier3: '#4aa564', // Medium-high
    tier4: '#7bc47f', // Medium
    tier5: '#a8d8a8'  // Budget - light green
  },
  unavailable: '#e8e8e8', // Light gray for sold seats
  selected: '#ff9500',    // Orange for selected
  hovered: '#ffd700',     // Gold for hover
  sectionBg: '#f5f5f5',   // Section background
  sectionStroke: '#d0d0d0'
};

// Section configuration for AT&T Stadium
const sectionConfig = {
  floor: {
    prefix: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'GA'],
    priceRange: [800, 2500],
    rows: 30,
    seatsPerRow: 20
  },
  '100': {
    prefix: ['1'],
    sections: Array.from({ length: 50 }, (_, i) => (101 + i).toString()),
    priceRange: [400, 800],
    rows: 22,
    seatsPerRow: 25
  },
  '200': {
    prefix: ['2'],
    sections: Array.from({ length: 50 }, (_, i) => (201 + i).toString()),
    priceRange: [300, 500],
    rows: 15,
    seatsPerRow: 20
  },
  '300': {
    prefix: ['3'],
    sections: Array.from({ length: 50 }, (_, i) => (301 + i).toString()),
    priceRange: [200, 400],
    rows: 17,
    seatsPerRow: 22
  },
  '400': {
    prefix: ['4'],
    sections: Array.from({ length: 60 }, (_, i) => (401 + i).toString()),
    priceRange: [100, 250],
    rows: 30,
    seatsPerRow: 28
  },
  club: {
    prefix: ['C'],
    priceRange: [500, 1000],
    rows: 10,
    seatsPerRow: 15
  }
};

// Randomly select which sections have tickets available
function selectAvailableSections(sectionIds) {
  const { minAvailablePercent, maxAvailablePercent } = availabilityConfig;
  const availablePercent = minAvailablePercent + Math.random() * (maxAvailablePercent - minAvailablePercent);
  const numAvailable = Math.floor(sectionIds.length * availablePercent);

  // Shuffle and pick random sections
  const shuffled = [...sectionIds].sort(() => Math.random() - 0.5);
  const available = new Set(shuffled.slice(0, numAvailable));

  console.log(`Selected ${available.size}/${sectionIds.length} sections as available (${(availablePercent * 100).toFixed(0)}%)`);
  return available;
}

// Check if a section is available (has tickets)
function isSectionAvailable(sectionId) {
  return state.availableSectionIds.has(sectionId);
}

// Generate section data
function generateSectionData(sectionId) {
  let level = 'unknown';
  let config = null;

  if (sectionId.startsWith('C')) {
    level = 'club';
    config = sectionConfig.club;
  } else if (/^[A-H]$|^GA/.test(sectionId)) {
    level = 'floor';
    config = sectionConfig.floor;
  } else {
    const num = parseInt(sectionId);
    if (num >= 100 && num < 200) {
      level = '100';
      config = sectionConfig['100'];
    } else if (num >= 200 && num < 300) {
      level = '200';
      config = sectionConfig['200'];
    } else if (num >= 300 && num < 400) {
      level = '300';
      config = sectionConfig['300'];
    } else if (num >= 400 && num < 500) {
      level = '400';
      config = sectionConfig['400'];
    }
  }

  if (!config) {
    config = sectionConfig['400']; // Default fallback
  }

  const basePrice = Math.floor(
    Math.random() * (config.priceRange[1] - config.priceRange[0]) + config.priceRange[0]
  );

  const rows = [];
  const rowCount = Math.floor(Math.random() * 10) + config.rows - 5;

  for (let r = 1; r <= rowCount; r++) {
    const rowLabel = r <= 26 ? String.fromCharCode(64 + r) : `AA${r - 26}`;
    const seats = [];
    const seatCount = Math.floor(Math.random() * 10) + config.seatsPerRow - 5;

    for (let s = 1; s <= seatCount; s++) {
      const isAvailable = Math.random() > 0.3;
      seats.push({
        id: s.toString(),
        available: isAvailable,
        price: basePrice + Math.floor((rowCount - r) * (config.priceRange[1] - config.priceRange[0]) / rowCount / 2),
        type: s === 1 || s === seatCount ? 'aisle' : 'standard'
      });
    }

    rows.push({
      id: rowLabel,
      seats,
      adaAccessible: r === rowCount,
      isFrontRow: r === 1
    });
  }

  return {
    id: sectionId,
    name: `Section ${sectionId.replace(/^C/, '')}`,
    level,
    rows,
    basePrice,
    available: true
  };
}

// Get seat color based on price tier and availability
function getSeatColor(seat, section, isSelected = false, isHovered = false) {
  if (isSelected) return colors.selected;
  if (isHovered) return colors.hovered;
  if (!seat.available) return colors.unavailable;

  const price = seat.price;
  if (price >= 800) return colors.available.tier1;
  if (price >= 600) return colors.available.tier2;
  if (price >= 400) return colors.available.tier3;
  if (price >= 200) return colors.available.tier4;
  return colors.available.tier5;
}

// Parse SVG path to get bounding box
function getPathBounds(pathElement) {
  try {
    const bbox = pathElement.getBBox();
    return {
      x: bbox.x,
      y: bbox.y,
      width: bbox.width,
      height: bbox.height,
      centerX: bbox.x + bbox.width / 2,
      centerY: bbox.y + bbox.height / 2
    };
  } catch (e) {
    return null;
  }
}

// Create price labels as SVG elements (so they move with the map)
function createPriceLabels(svg) {
  // Remove existing labels
  svg.querySelectorAll('.price-labels-group').forEach(el => el.remove());

  // Find the main group that gets transformed
  const mainGroup = svg.querySelector('g#main-container') || svg.querySelector('g');
  if (!mainGroup) return;

  // Add shadow filter definition if not exists
  let defs = svg.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svg.insertBefore(defs, svg.firstChild);
  }
  if (!defs.querySelector('#label-shadow')) {
    const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    filter.setAttribute('id', 'label-shadow');
    filter.setAttribute('x', '-20%');
    filter.setAttribute('y', '-20%');
    filter.setAttribute('width', '140%');
    filter.setAttribute('height', '140%');
    filter.innerHTML = `
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.2"/>
    `;
    defs.appendChild(filter);
  }

  // Create a group for all labels
  const labelsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  labelsGroup.setAttribute('class', 'price-labels-group');
  labelsGroup.style.pointerEvents = 'none'; // Don't block clicks

  // Only show labels for larger sections (skip small ones)
  let labelCount = 0;
  const maxLabels = 40; // Limit total labels for performance

  state.sections.forEach(section => {
    if (labelCount >= maxLabels) return;

    const path = svg.querySelector(`path[id="${section.id}"]`);
    if (!path) return;

    const bounds = getPathBounds(path);
    if (!bounds || bounds.width < 200 || bounds.height < 150) return; // Skip small sections

    // Get min price for section
    const sectionListings = state.listings.filter(l => l.sectionId === section.id);
    const minPrice = sectionListings.length > 0
      ? Math.min(...sectionListings.map(l => l.price))
      : section.basePrice;

    // Create SVG group for label (scaled for large viewBox 10240x7680)
    const labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    labelGroup.setAttribute('class', 'svg-price-label');
    labelGroup.setAttribute('transform', `translate(${bounds.centerX}, ${bounds.centerY})`);
    labelGroup.style.pointerEvents = 'none';

    // Background pill (scaled up 5x for large viewBox)
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', '-200');
    bg.setAttribute('y', '-70');
    bg.setAttribute('width', '400');
    bg.setAttribute('height', '140');
    bg.setAttribute('rx', '70');
    bg.setAttribute('fill', 'white');
    bg.setAttribute('filter', 'url(#label-shadow)');
    bg.style.pointerEvents = 'none';

    // Green dot
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', '-130');
    dot.setAttribute('cy', '0');
    dot.setAttribute('r', '35');
    dot.setAttribute('fill', '#1a8f41');
    dot.style.pointerEvents = 'none';

    // Price text
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', '-70');
    text.setAttribute('y', '35');
    text.setAttribute('font-size', '100');
    text.setAttribute('font-weight', '600');
    text.setAttribute('fill', '#1a1a1a');
    text.setAttribute('font-family', '-apple-system, BlinkMacSystemFont, sans-serif');
    text.style.pointerEvents = 'none';
    text.textContent = `$${minPrice}`;

    labelGroup.appendChild(bg);
    labelGroup.appendChild(dot);
    labelGroup.appendChild(text);
    labelsGroup.appendChild(labelGroup);
    labelCount++;
  });

  // Add to the main group so it transforms with the map
  mainGroup.appendChild(labelsGroup);
  console.log(`Created ${labelCount} price labels`);
}

// No longer needed - labels are now in SVG
function updatePriceLabelPositions() {
  // Labels now move with SVG automatically
}

// Generate all listings from sections
function generateListings() {
  const listings = [];

  state.sections.forEach(section => {
    // Group available seats by row
    section.rows.forEach(row => {
      const availableSeats = row.seats.filter(s => s.available);
      if (availableSeats.length >= state.ticketQuantity) {
        // Find consecutive seats
        let consecutiveCount = 0;
        let startSeat = null;

        for (let i = 0; i < row.seats.length; i++) {
          if (row.seats[i].available) {
            if (consecutiveCount === 0) startSeat = row.seats[i];
            consecutiveCount++;

            if (consecutiveCount >= state.ticketQuantity) {
              const avgPrice = Math.floor(
                row.seats.slice(i - state.ticketQuantity + 1, i + 1)
                  .reduce((sum, s) => sum + s.price, 0) / state.ticketQuantity
              );

              const hasAisle = row.seats.slice(i - state.ticketQuantity + 1, i + 1)
                .some(s => s.type === 'aisle');

              listings.push({
                sectionId: section.id,
                sectionName: section.name,
                row: row.id,
                seats: `${state.ticketQuantity}`,
                startSeat: startSeat.id,
                price: avgPrice,
                rating: Math.floor(Math.random() * 3) + 8, // 8-10 rating
                perks: {
                  aisle: hasAisle,
                  frontRow: row.isFrontRow,
                  bestDeal: Math.random() > 0.9,
                  lowestPrice: false
                },
                level: section.level
              });
              break; // Only one listing per row
            }
          } else {
            consecutiveCount = 0;
          }
        }
      }
    });
  });

  // Sort by price and mark lowest
  listings.sort((a, b) => a.price - b.price);
  if (listings.length > 0) {
    listings[0].perks.lowestPrice = true;
  }

  return listings;
}

// Render listings in the panel
function renderListings() {
  const container = document.getElementById('listings-container');
  const countDisplay = document.getElementById('listings-count');

  // Apply filters
  let filtered = state.listings.filter(listing => {
    if (state.filters.aisle && !listing.perks.aisle) return false;
    if (state.filters.frontRow && !listing.perks.frontRow) return false;
    if (listing.price < state.priceRange.min || listing.price > state.priceRange.max) return false;
    return true;
  });

  countDisplay.textContent = `${filtered.length.toLocaleString()} listings`;

  // Only show first 50 for performance
  filtered = filtered.slice(0, 50);

  container.innerHTML = filtered.map(listing => {
    const listingImagePath = `seatview_images/section-${listing.sectionId}.jpg`;
    return `
    <div class="listing-card" data-section="${listing.sectionId}" data-row="${listing.row}">
      <div class="listing-image">
        <img src="${listingImagePath}" alt="Section view" loading="lazy" onerror="this.src='bts.jpg'">
        <div class="section-indicator"></div>
      </div>
      <div class="listing-info">
        <div class="listing-section">${listing.sectionName}</div>
        <div class="listing-row">Row ${listing.row}, ${listing.seats} tickets</div>
        <div class="listing-tags">
          <span class="tag amazing"><span style="color:#1a8f41;font-weight:600">${listing.rating}</span> Amazing</span>
          ${listing.perks.aisle ? '<span class="tag aisle">/A Aisle</span>' : ''}
          ${listing.perks.frontRow ? '<span class="tag front-row">Front row</span>' : ''}
          ${listing.perks.bestDeal ? '<span class="tag deal">Best deal</span>' : ''}
          ${listing.perks.lowestPrice ? '<span class="tag lowest">Lowest price</span>' : ''}
        </div>
      </div>
      <div class="listing-price">
        <div class="price-amount">$${listing.price.toLocaleString()}</div>
        <div class="price-fees">incl. fees</div>
      </div>
    </div>
  `}).join('');

  // Add click handlers
  container.querySelectorAll('.listing-card').forEach(card => {
    card.addEventListener('click', () => {
      const sectionId = card.dataset.section;
      const row = card.dataset.row;
      // Find the specific listing
      const listing = state.listings.find(l => l.sectionId === sectionId && l.row === row);
      if (listing) {
        showListingDetail(listing);
        highlightSectionOnMap(sectionId);
        // Zoom to the section with smooth animation
        zoomToSection(sectionId);
      }
    });
  });
}

// Show listing detail panel
function showListingDetail(listing) {
  const panel = document.getElementById('listing-detail');
  const title = document.getElementById('listing-title');
  const price = document.getElementById('listing-detail-price');
  const ticketCount = document.getElementById('ticket-count');
  const ratingBadge = document.getElementById('listing-rating-badge');
  const dealBanner = document.getElementById('deal-banner');
  const featureAisle = document.getElementById('feature-aisle');
  const similarGrid = document.getElementById('similar-listings-grid');
  const affirmPrice = document.getElementById('affirm-price');
  const viewImage = document.getElementById('listing-view-img');

  // Set section view image
  const sectionImagePath = `seatview_images/section-${listing.sectionId}.jpg`;
  viewImage.src = sectionImagePath;
  viewImage.onerror = function() {
    this.src = 'bts.jpg'; // Fallback if section image doesn't exist
  };

  // Set listing details
  title.textContent = `${listing.sectionName}, Row ${listing.row}`;
  price.textContent = `$${listing.price.toLocaleString()}`;
  ticketCount.textContent = `${listing.seats} Tickets`;

  // Calculate Affirm monthly price (roughly price / 4)
  const monthlyPrice = Math.ceil(listing.price / 4);
  affirmPrice.textContent = `$${monthlyPrice}`;

  // Set rating badge
  const ratingNumber = ratingBadge.querySelector('.rating-number');
  const ratingText = ratingBadge.querySelector('.rating-text');
  ratingNumber.textContent = listing.rating;
  ratingText.textContent = listing.rating >= 9 ? 'Amazing' : 'Great';

  // Show/hide deal banner for best deals
  if (listing.perks.bestDeal || listing.rating >= 9) {
    dealBanner.classList.add('visible');
  } else {
    dealBanner.classList.remove('visible');
  }

  // Show/hide aisle feature
  if (listing.perks.aisle) {
    featureAisle.style.display = 'flex';
  } else {
    featureAisle.style.display = 'none';
  }

  // Populate similar listings (listings from same or nearby sections)
  const sectionNum = parseInt(listing.sectionId);
  const similarListings = state.listings
    .filter(l => {
      const num = parseInt(l.sectionId);
      // Same section different row, or adjacent sections
      return (l.sectionId === listing.sectionId && l.row !== listing.row) ||
             (Math.abs(num - sectionNum) <= 5 && l.sectionId !== listing.sectionId);
    })
    .slice(0, 6);

  // Generate random seat ranges for similar listings
  similarGrid.innerHTML = similarListings.map(similar => {
    const startSeat = Math.floor(Math.random() * 10) + 1;
    const endSeat = startSeat + parseInt(similar.seats) - 1;
    const similarImagePath = `seatview_images/section-${similar.sectionId}.jpg`;
    return `
    <div class="similar-listing-card" data-section="${similar.sectionId}" data-row="${similar.row}">
      <div class="similar-listing-image">
        <img src="${similarImagePath}" alt="View from section" loading="lazy" onerror="this.src='bts.jpg'">
      </div>
      <div class="similar-listing-section">${similar.sectionName}</div>
      <div class="similar-listing-row">Row ${similar.row}, Seats ${startSeat}-${endSeat}</div>
    </div>
  `}).join('');

  // Add click handlers for similar listings
  similarGrid.querySelectorAll('.similar-listing-card').forEach(card => {
    card.addEventListener('click', () => {
      const sectionId = card.dataset.section;
      const row = card.dataset.row;
      const newListing = state.listings.find(l => l.sectionId === sectionId && l.row === row);
      if (newListing) {
        showListingDetail(newListing);
        highlightSectionOnMap(sectionId);
        zoomToSection(sectionId);
      }
    });
  });

  panel.classList.add('visible');
  panel.scrollTop = 0; // Scroll to top when showing new listing
  state.selectedSection = listing.sectionId;
  state.selectedListing = listing;

  // Start hold timer for difficulty modes
  startHoldTimer();
}

// Hide listing detail panel
function hideListingDetail() {
  const panel = document.getElementById('listing-detail');
  const sectionPanel = document.getElementById('section-detail');
  panel.classList.remove('visible');
  state.selectedListing = null;
  stopHoldTimer();

  // Only clear section state if section detail panel is not visible
  if (!sectionPanel.classList.contains('visible')) {
    state.selectedSection = null;
    clearSectionHighlight();
  }
}

// Show section detail panel (for multi-row selection)
function showSectionDetail(sectionId, sectionListings) {
  const panel = document.getElementById('section-detail');
  const title = document.getElementById('section-detail-title');
  const count = document.getElementById('section-detail-count');
  const rowsList = document.getElementById('section-rows-list');

  // Get section name from first listing
  const sectionName = sectionListings[0].sectionName;

  // Set title and count
  title.textContent = sectionName;
  count.textContent = `${sectionListings.length} listing${sectionListings.length > 1 ? 's' : ''} available`;

  // Sort listings by price
  const sortedListings = [...sectionListings].sort((a, b) => a.price - b.price);

  // Generate row cards
  rowsList.innerHTML = sortedListings.map(listing => {
    const sectionImagePath = `seatview_images/section-${listing.sectionId}.jpg`;
    const ticketText = listing.seats === 1 ? '1 ticket' : `1-${listing.seats} tickets`;
    return `
      <div class="section-row-card" data-section="${listing.sectionId}" data-row="${listing.row}">
        <div class="section-row-thumbnail">
          <img src="${sectionImagePath}" alt="View from section" loading="lazy" onerror="this.src='bts.jpg'">
        </div>
        <div class="section-row-info">
          <p class="section-row-name">Row ${listing.row}</p>
          <p class="section-row-tickets">${ticketText}</p>
        </div>
        <div class="section-row-price">
          <span class="section-row-price-amount">$${listing.price.toLocaleString()}</span>
          <span class="section-row-price-label">incl. fees</span>
        </div>
      </div>
    `;
  }).join('');

  // Add click handlers for row cards
  rowsList.querySelectorAll('.section-row-card').forEach(card => {
    card.addEventListener('click', () => {
      const row = card.dataset.row;
      const listing = sectionListings.find(l => l.row === row);
      if (listing) {
        hideSectionDetail();
        showListingDetail(listing);
      }
    });
  });

  panel.classList.add('visible');
  panel.scrollTop = 0;
  state.selectedSection = sectionId;
  highlightSectionOnMap(sectionId);
  zoomToSection(sectionId);
}

// Hide section detail panel
function hideSectionDetail() {
  const panel = document.getElementById('section-detail');
  panel.classList.remove('visible');
}

// Highlight section on map
function highlightSectionOnMap(sectionId) {
  // Clear previous selection
  clearSectionHighlight();

  const mapContainer = document.getElementById('map-container');
  const sectionPath = mapContainer.querySelector(`path[id="${sectionId}"]`);

  if (sectionPath) {
    sectionPath.classList.add('section-selected');
    sectionPath.setAttribute('fill', '#ffd700'); // Gold highlight
  }
}

function clearSectionHighlight() {
  const mapContainer = document.getElementById('map-container');
  mapContainer.querySelectorAll('.section-selected').forEach(el => {
    el.classList.remove('section-selected');
    // Restore original tier color
    if (el.dataset.tierColor) {
      el.setAttribute('fill', el.dataset.tierColor);
    }
  });
}

// Load and setup SVG map
async function loadSVGMap() {
  const mapContainer = document.getElementById('map-container');

  try {
    const response = await fetch('att-stadium.svg');
    const svgText = await response.text();
    mapContainer.innerHTML = svgText;

    const svg = mapContainer.querySelector('svg');
    if (svg) {
      // Set SVG to fill container
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      svg.style.width = '100%';
      svg.style.height = '100%';
      svg.style.pointerEvents = 'all';

      // AGGRESSIVE APPROACH: Remove all blocking overlay elements entirely

      // Step 1: Remove the blue overlay container
      const blueOverlay = svg.querySelector('#section-map-outline-container');
      if (blueOverlay) {
        blueOverlay.remove();
        console.log('Removed blue overlay container');
      }

      // Step 2: Remove ALL decorative shadow elements - these block clicks
      // Method A: Remove by ID prefix (DS: or DS;)
      // Method B: Remove any path with a filter attribute (shadow effects)
      const shadowElements = [];
      svg.querySelectorAll('path').forEach(path => {
        const id = path.getAttribute('id') || '';
        const hasFilter = path.getAttribute('filter');
        // Match DS: prefix or DS; prefix or any path with shadow filter
        if (id.startsWith('DS') || hasFilter) {
          shadowElements.push(path);
        }
      });
      shadowElements.forEach(el => el.remove());
      console.log(`Removed ${shadowElements.length} shadow/decorative elements`);

      // Step 3: Disable pointer events on all remaining non-section elements
      svg.querySelectorAll('*').forEach(el => {
        el.style.pointerEvents = 'none';
      });

      console.log('Disabled pointer events on all SVG elements');

      // Also check for nested SVGs
      const nestedSvgs = svg.querySelectorAll('svg');
      nestedSvgs.forEach(nested => {
        nested.style.pointerEvents = 'all';
        nested.style.overflow = 'visible';
      });

      setupMapInteraction(svg);
      setupSectionInteraction(svg);
      colorCodeSections(svg);

      // Setup touch support for mobile
      if (typeof setupTouchSupport === 'function') {
        setupTouchSupport(mapContainer);
      }

      // Price labels disabled for debugging hover issues
      // setTimeout(() => {
      //   createPriceLabels(svg);
      // }, 100);

      console.log('SVG setup complete');
    }
  } catch (error) {
    console.error('Error loading SVG:', error);
    mapContainer.innerHTML = '<div class="loading">Error loading map</div>';
  }
}

// Setup map pan and zoom
function setupMapInteraction(svg) {
  let isPanning = false;
  let startPoint = { x: 0, y: 0 };
  let hasMoved = false;

  const mapContainer = document.getElementById('map-container');

  // Get the main group or create a wrapper
  let mainGroup = svg.querySelector('g#main-container') || svg.querySelector('g');
  if (!mainGroup) {
    mainGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    while (svg.firstChild) {
      mainGroup.appendChild(svg.firstChild);
    }
    svg.appendChild(mainGroup);
  }

  // Set initial viewBox for better fit
  const viewBox = svg.getAttribute('viewBox');
  if (viewBox) {
    const [, , w, h] = viewBox.split(' ').map(Number);
    // Center the map initially
    state.pan.x = 0;
    state.pan.y = 0;
  }

  function updateTransform(animate = false) {
    const scaleVal = state.zoom;

    if (animate) {
      mainGroup.style.transition = 'transform 0.4s ease-out';
    } else {
      mainGroup.style.transition = 'none';
    }

    mainGroup.style.transform = `translate(${state.pan.x}px, ${state.pan.y}px) scale(${scaleVal})`;
    mainGroup.style.transformOrigin = 'center center';

    // Update zoom level indicator
    const zoomLevel = document.getElementById('zoom-level');
    if (zoomLevel) {
      zoomLevel.textContent = `${scaleVal.toFixed(1)}x`;
    }

    // Update zoom hint visibility
    const zoomHint = document.getElementById('zoom-hint');
    if (zoomHint) {
      if (scaleVal > 1.5) {
        zoomHint.classList.add('hidden');
      } else {
        zoomHint.classList.remove('hidden');
      }
    }
  }

  // Store updateTransform globally for use elsewhere
  window.updateMapTransform = updateTransform;

  // Mouse events for panning
  let panStartMouse = { x: 0, y: 0 };
  let panStartState = { x: 0, y: 0 };

  mapContainer.addEventListener('mousedown', (e) => {
    // Don't start pan on section paths or seats
    if (e.target.classList.contains('section-path') || e.target.classList.contains('seat-circle')) return;

    e.preventDefault(); // Prevent text selection while dragging
    isPanning = true;
    hasMoved = false;
    panStartMouse = { x: e.clientX, y: e.clientY };
    panStartState = { x: state.pan.x, y: state.pan.y };
    startPoint = { x: e.clientX - state.pan.x, y: e.clientY - state.pan.y };
    mapContainer.style.cursor = 'grabbing';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    hasMoved = true;
    // Scale pan speed based on zoom level - faster panning when zoomed in
    const panSpeed = Math.max(4, state.zoom * 3);
    const deltaX = e.clientX - panStartMouse.x;
    const deltaY = e.clientY - panStartMouse.y;
    state.pan.x = panStartState.x + deltaX * panSpeed;
    state.pan.y = panStartState.y + deltaY * panSpeed;
    updateTransform();
  });

  document.addEventListener('mouseup', () => {
    isPanning = false;
    mapContainer.style.cursor = 'grab';
  });

  // Zoom controls with smooth animation
  document.getElementById('zoom-in').addEventListener('click', () => {
    state.zoom = Math.min(state.zoom * 1.4, 6);
    updateTransform(true);
  });

  document.getElementById('zoom-out').addEventListener('click', () => {
    state.zoom = Math.max(state.zoom / 1.4, 0.5);
    updateTransform(true);
  });

  // Mouse wheel zoom - using smaller multiplier for smoother zooming
  mapContainer.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.97 : 1.03;
    state.zoom = Math.min(Math.max(state.zoom * delta, 0.5), 6);
    updateTransform();
  });

  // Double-click to zoom in on section
  mapContainer.addEventListener('dblclick', (e) => {
    if (e.target.classList.contains('section-path')) {
      const sectionId = e.target.getAttribute('id');
      zoomToSection(sectionId);
    }
  });

  // Initialize transform
  updateTransform();
}

// Smooth zoom to a specific section
function zoomToSection(sectionId) {
  const mapContainer = document.getElementById('map-container');
  const svg = mapContainer.querySelector('svg');
  const path = svg.querySelector(`path[id="${sectionId}"]`);

  if (!path) return;

  const bounds = getPathBounds(path);
  if (!bounds) return;

  const containerRect = mapContainer.getBoundingClientRect();
  const viewBox = svg.getAttribute('viewBox');
  const [, , vbWidth, vbHeight] = viewBox.split(' ').map(Number);

  const scaleX = containerRect.width / vbWidth;
  const scaleY = containerRect.height / vbHeight;

  // Target zoom level
  state.zoom = 3;

  // Center on section
  const targetX = containerRect.width / 2 - bounds.centerX * scaleX * state.zoom;
  const targetY = containerRect.height / 2 - bounds.centerY * scaleY * state.zoom;

  state.pan.x = targetX;
  state.pan.y = targetY;

  if (window.updateMapTransform) {
    window.updateMapTransform(true); // Animate
  }
}

// Setup section hover and click
function setupSectionInteraction(svg) {
  const tooltip = document.getElementById('map-tooltip');

  // Find ALL path elements in the SVG (including nested SVGs)
  const allPaths = svg.querySelectorAll('path[id]');

  console.log('Found paths:', allPaths.length);

  // Disable pointer events on ALL non-section paths - they block clicks on sections
  // This includes drop shadows (DS:, DS;), SRO, level outlines, etc.
  allPaths.forEach(path => {
    const id = path.getAttribute('id');
    if (!id) return;

    // Only allow pointer events on actual section paths (3-digit numbers or C-prefixed)
    const isSection = /^\d{3}$/.test(id) || /^C\d+$/.test(id);
    if (!isSection) {
      path.style.pointerEvents = 'none';
    }
  });

  // Collect all section IDs from SVG
  const sectionIds = [];
  const sectionPathsMap = new Map();

  // First pass: collect all valid section paths and track duplicates
  const duplicatePaths = []; // Paths to hide (later duplicates)

  allPaths.forEach(path => {
    const id = path.getAttribute('id');
    if (!id) return;

    // Include valid section IDs:
    // - 3-digit numbers (100-999 level sections)
    // - C-prefixed (club sections like C135, C234)
    // Skip text labels and other non-section elements
    const isSection = /^\d{3}$/.test(id) || /^C\d+$/.test(id);
    const isNotLabel = !id.includes('ZONE') && !id.includes('LINE') && !id.includes('FIELD') &&
                       !id.includes('HASH') && !id.includes('SIDELINE') && !id.includes('NUMBERS') &&
                       id !== 'ISM_Shadow' && id !== 'main-container' && id !== 'background-container';

    if (isSection && isNotLabel) {
      // Keep the FIRST path for each ID, hide later duplicates
      if (sectionPathsMap.has(id)) {
        // This is a duplicate - mark it to be hidden
        duplicatePaths.push(path);
      } else {
        sectionIds.push(id);
        sectionPathsMap.set(id, path);
      }
    }
  });

  // Hide duplicate paths (the later white paths that appear in wrong position)
  duplicatePaths.forEach(path => {
    path.style.display = 'none';
  });

  // Mark only the first occurrence paths with section-path class
  sectionPathsMap.forEach((path) => {
    path.classList.add('section-path');
  });

  console.log('Section IDs found:', sectionIds.length, sectionIds.slice(0, 10));

  // Store all section IDs for refresh functionality
  state.allSectionIds = sectionIds;

  // Randomly select which sections are available (have tickets)
  state.availableSectionIds = selectAvailableSections(sectionIds);

  // Generate section data only for available sections
  state.sections = sectionIds
    .filter(id => state.availableSectionIds.has(id))
    .map(id => generateSectionData(id));

  // Generate listings (only for available sections)
  state.listings = generateListings();
  renderListings();

  // Setup each section based on availability
  sectionPathsMap.forEach((path, id) => {
    const isAvailable = state.availableSectionIds.has(id);

    // Store original fill color
    const originalFill = path.getAttribute('fill') || '#ffffff';
    path.dataset.originalFill = originalFill;

    if (isAvailable) {
      // AVAILABLE SECTION: Enable interaction
      path.style.cursor = 'pointer';
      path.style.pointerEvents = 'all';
      path.classList.add('section-available');

      const section = state.sections.find(s => s.id === id);
      // Fallback values if section data not found
      const sectionName = section ? section.name : `Section ${id}`;
      const basePrice = section ? section.basePrice : 500;

      path.addEventListener('mouseenter', (e) => {
        e.stopPropagation();
        path.classList.add('section-hover');

        // Show tooltip
        const sectionListings = state.listings.filter(l => l.sectionId === id);
        const minPrice = sectionListings.length > 0
          ? Math.min(...sectionListings.map(l => l.price))
          : basePrice;

        tooltip.querySelector('.tooltip-section').textContent = sectionName;
        tooltip.querySelector('.tooltip-price').textContent = `From $${minPrice.toLocaleString()}`;
        tooltip.querySelector('.tooltip-perks').textContent = `${sectionListings.length} listings`;

        tooltip.style.left = `${e.clientX + 15}px`;
        tooltip.style.top = `${e.clientY + 15}px`;
        tooltip.classList.add('visible');
      });

      path.addEventListener('mousemove', (e) => {
        tooltip.style.left = `${e.clientX + 15}px`;
        tooltip.style.top = `${e.clientY + 15}px`;
      });

      path.addEventListener('mouseleave', () => {
        path.classList.remove('section-hover');
        tooltip.classList.remove('visible');
      });

      path.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log('Clicked section:', id);
        // Find all listings for this section
        const sectionListings = state.listings.filter(l => l.sectionId === id);
        if (sectionListings.length === 1) {
          // Single listing - show detail directly
          showListingDetail(sectionListings[0]);
          highlightSectionOnMap(id);
        } else if (sectionListings.length > 1) {
          // Multiple listings - show section detail for row selection
          showSectionDetail(id, sectionListings);
        }
      });
    } else {
      // UNAVAILABLE SECTION: Disable interaction completely
      // This fixes the hover bug - unavailable sections won't block mouse events
      path.style.cursor = 'default';
      path.style.pointerEvents = 'none';
      path.classList.add('section-unavailable');
    }
  });
}

// Color code sections by price tier with SeatGeek-style appearance
function colorCodeSections(svg) {
  const allPaths = svg.querySelectorAll('path.section-path');

  allPaths.forEach(path => {
    const id = path.getAttribute('id');
    const isAvailable = state.availableSectionIds.has(id);

    if (!isAvailable) {
      // Unavailable section - gray color
      const grayColor = '#e0e0e0';
      path.setAttribute('fill', grayColor);
      path.dataset.tierColor = grayColor;
      path.dataset.price = 0;
      return;
    }

    const section = state.sections.find(s => s.id === id);

    if (section) {
      // Get min price from listings for this section
      const sectionListings = state.listings.filter(l => l.sectionId === id);

      // If no listings, grey out the section
      if (sectionListings.length === 0) {
        const grayColor = '#e0e0e0';
        path.setAttribute('fill', grayColor);
        path.dataset.tierColor = grayColor;
        path.dataset.price = 0;
        return;
      }

      const price = Math.min(...sectionListings.map(l => l.price));

      // Color based on price tier - lighter background for sections
      let bgColor = '';
      if (price < 200) bgColor = '#e8f5e9';      // Very light green
      else if (price < 400) bgColor = '#c8e6c9'; // Light green
      else if (price < 600) bgColor = '#a5d6a7'; // Medium light green
      else if (price < 800) bgColor = '#81c784'; // Medium green
      else bgColor = '#66bb6a';                   // Darker green

      path.setAttribute('fill', bgColor);
      // Stroke handled by CSS for better separation
      path.dataset.tierColor = bgColor;
      path.dataset.price = price;
    }
  });
}

// Add price labels to map (for prominent sections)
function addPriceLabels(svg) {
  const mapContainer = document.getElementById('map-container');
  const svgRect = svg.getBoundingClientRect();

  // Only add labels for a subset of sections to avoid clutter
  const prominentSections = state.sections.filter((_, i) => i % 10 === 0).slice(0, 20);

  prominentSections.forEach(section => {
    const path = svg.querySelector(`path[id="${section.id}"]`);
    if (!path) return;

    const bbox = path.getBBox();
    const sectionListings = state.listings.filter(l => l.sectionId === section.id);
    const minPrice = sectionListings.length > 0
      ? Math.min(...sectionListings.map(l => l.price))
      : section.basePrice;

    const label = document.createElement('div');
    label.className = 'price-label';
    label.textContent = `$${minPrice}`;
    label.style.left = `${(bbox.x + bbox.width / 2) / 100}%`;
    label.style.top = `${(bbox.y + bbox.height / 2) / 76.8}%`;

    // Note: Price labels are complex with SVG transforms, simplified for now
  });
}

// Modal handling
function setupModals() {
  const quantityModal = document.getElementById('quantity-modal');
  const quantityBtn = document.getElementById('quantity-btn');
  const quantityOptions = document.querySelectorAll('.quantity-option');

  const priceModal = document.getElementById('price-modal');
  const priceBtn = document.getElementById('price-btn');
  const priceMinSlider = document.getElementById('price-min');
  const priceMaxSlider = document.getElementById('price-max');
  const minPriceDisplay = document.getElementById('min-price-display');
  const maxPriceDisplay = document.getElementById('max-price-display');
  const includeFees = document.getElementById('include-fees');

  const perksModal = document.getElementById('perks-modal');
  const perksBtn = document.getElementById('perks-btn');

  // Check if first launch (no saved settings)
  const isFirstLaunch = !localStorage.getItem('bts_sim_difficulty');

  // Show settings modal on first launch, otherwise quantity modal
  setTimeout(() => {
    if (isFirstLaunch) {
      const settingsModal = document.getElementById('settings-modal');
      if (settingsModal) {
        updateSettingsModalStats();
        settingsModal.classList.add('visible');
      }
    } else {
      quantityModal.classList.add('visible');
      quantityModal.classList.add('was-shown');
    }
  }, 500);

  // Quantity modal
  quantityBtn.addEventListener('click', () => {
    quantityModal.classList.add('visible');
  });

  quantityModal.addEventListener('click', (e) => {
    if (e.target === quantityModal) {
      quantityModal.classList.remove('visible');
    }
  });

  quantityOptions.forEach(option => {
    option.addEventListener('click', () => {
      quantityOptions.forEach(o => o.classList.remove('selected'));
      option.classList.add('selected');

      const qty = option.dataset.qty;
      state.ticketQuantity = qty === '6' ? 6 : parseInt(qty);
      document.getElementById('quantity-display').textContent =
        qty === '6' ? '6+ tickets' : `${qty} ticket${qty === '1' ? '' : 's'}`;

      // Regenerate listings with new quantity
      state.listings = generateListings();
      renderListings();

      quantityModal.classList.remove('visible');
    });
  });

  // Price modal
  priceBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    priceModal.classList.toggle('visible');
    perksModal.classList.remove('visible');
  });

  // Price slider functionality
  function updatePriceSliders() {
    const minVal = parseInt(priceMinSlider.value);
    const maxVal = parseInt(priceMaxSlider.value);

    // Prevent min from exceeding max
    if (minVal > maxVal) {
      priceMinSlider.value = maxVal;
    }

    state.priceRange.min = parseInt(priceMinSlider.value);
    state.priceRange.max = parseInt(priceMaxSlider.value);

    minPriceDisplay.textContent = `$${state.priceRange.min.toLocaleString()}`;
    maxPriceDisplay.textContent = `$${state.priceRange.max.toLocaleString()}`;

    // Update price button to show filter is active
    if (state.priceRange.min > 0 || state.priceRange.max < 5000) {
      priceBtn.classList.add('active');
    } else {
      priceBtn.classList.remove('active');
    }
  }

  priceMinSlider.addEventListener('input', updatePriceSliders);
  priceMaxSlider.addEventListener('input', updatePriceSliders);

  // Include fees toggle
  includeFees.addEventListener('change', () => {
    state.filters.includeFees = includeFees.checked;
    renderListings();
  });

  // Perks modal
  perksBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    perksModal.classList.toggle('visible');
    priceModal.classList.remove('visible');
  });

  // Close modals on outside click
  document.addEventListener('click', (e) => {
    if (!priceModal.contains(e.target) && e.target !== priceBtn) {
      priceModal.classList.remove('visible');
    }
    if (!perksModal.contains(e.target) && e.target !== perksBtn) {
      perksModal.classList.remove('visible');
    }
  });

  // Price filter actions
  const priceApplyBtn = priceModal?.querySelector('.filter-action-btn.apply');
  const priceClearBtn = priceModal?.querySelector('.filter-action-btn.clear');

  if (priceApplyBtn) {
    priceApplyBtn.addEventListener('click', () => {
      priceModal.classList.remove('visible');
      renderListings();
    });
  }

  if (priceClearBtn) {
    priceClearBtn.addEventListener('click', () => {
      state.priceRange = { min: 0, max: 5000 };
      priceMinSlider.value = 0;
      priceMaxSlider.value = 5000;
      minPriceDisplay.textContent = '$0';
      maxPriceDisplay.textContent = '$5,000';
      priceBtn.classList.remove('active');
      renderListings();
    });
  }

  // Perks filter
  perksModal.querySelectorAll('.perk-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      const perk = checkbox.dataset.perk;
      if (perk === 'aisle') state.filters.aisle = checkbox.checked;
      if (perk === 'front-row') state.filters.frontRow = checkbox.checked;
    });
  });

  const perksApplyBtn = perksModal?.querySelector('.filter-action-btn.apply');
  const perksClearBtn = perksModal?.querySelector('.filter-action-btn.clear');

  if (perksApplyBtn) {
    perksApplyBtn.addEventListener('click', () => {
      perksModal.classList.remove('visible');

      // Update button state
      if (state.filters.aisle || state.filters.frontRow) {
        perksBtn.classList.add('active');
      } else {
        perksBtn.classList.remove('active');
      }

      renderListings();
    });
  }

  if (perksClearBtn) {
    perksClearBtn.addEventListener('click', () => {
      state.filters.aisle = false;
      state.filters.frontRow = false;
      perksModal.querySelectorAll('.perk-checkbox').forEach(cb => cb.checked = false);
      perksBtn.classList.remove('active');
      renderListings();
    });
  }

  // Back button for listing detail
  document.getElementById('back-to-listings').addEventListener('click', () => {
    hideListingDetail();
  });

  // Back button for section detail
  document.getElementById('back-from-section').addEventListener('click', () => {
    hideSectionDetail();
    clearSectionHighlight();
    state.selectedSection = null;
  });

  // Auto-hide scrollbar for detail panel
  const detailPanel = document.getElementById('listing-detail');
  let scrollTimeout;
  detailPanel.addEventListener('scroll', () => {
    detailPanel.classList.add('scrolling');
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      detailPanel.classList.remove('scrolling');
    }, 500);
  });

  // Auto-hide scrollbar for listings container
  const listingsContainer = document.getElementById('listings-container');
  let listingsScrollTimeout;
  listingsContainer.addEventListener('scroll', () => {
    listingsContainer.classList.add('scrolling');
    clearTimeout(listingsScrollTimeout);
    listingsScrollTimeout = setTimeout(() => {
      listingsContainer.classList.remove('scrolling');
    }, 500);
  });

  // Similar listings navigation
  const similarGrid = document.getElementById('similar-listings-grid');
  document.getElementById('similar-prev').addEventListener('click', () => {
    similarGrid.scrollBy({ left: -180, behavior: 'smooth' });
  });
  document.getElementById('similar-next').addEventListener('click', () => {
    similarGrid.scrollBy({ left: 180, behavior: 'smooth' });
  });

  // Continue button - navigate to checkout page
  document.getElementById('continue-btn').addEventListener('click', () => {
    if (state.selectedListing) {
      stopHoldTimer();
      stopBotActivity();

      // Save attempt data to localStorage for checkout page
      const checkoutData = {
        startTime: gameState.currentAttempt.startTime,
        section: state.selectedListing.sectionName,
        row: state.selectedListing.row,
        price: state.selectedListing.price,
        quantity: state.ticketQuantity,
        rating: state.selectedListing.rating,
        hasAisle: state.selectedListing.perks.aisle
      };
      localStorage.setItem('bts_checkout_data', JSON.stringify(checkoutData));

      // Navigate to checkout page with parameters
      const params = new URLSearchParams({
        section: state.selectedListing.sectionName,
        row: `Row ${state.selectedListing.row}`,
        price: state.selectedListing.price,
        quantity: state.ticketQuantity,
        rating: state.selectedListing.rating,
        aisle: state.selectedListing.perks.aisle
      });
      window.location.href = `checkout.html?${params.toString()}`;
    }
  });
}

// Generate price histogram
function generatePriceHistogram() {
  const histogram = document.getElementById('price-histogram');
  const prices = state.listings.map(l => l.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const bucketCount = 30;
  const bucketSize = (max - min) / bucketCount;

  const buckets = Array(bucketCount).fill(0);
  prices.forEach(price => {
    const bucket = Math.min(Math.floor((price - min) / bucketSize), bucketCount - 1);
    buckets[bucket]++;
  });

  const maxCount = Math.max(...buckets);

  histogram.innerHTML = buckets.map(count =>
    `<div class="histogram-bar" style="height: ${(count / maxCount) * 100}%"></div>`
  ).join('');

  // Update min/max displays
  document.getElementById('min-price-display').textContent = `$${min.toLocaleString()}`;
  document.getElementById('max-price-display').textContent = `$${max.toLocaleString()}`;
}

// Setup game UI (refresh button, settings, difficulty, etc.)
function setupGameUI() {
  // Load saved settings
  loadGameStats();

  // Refresh button
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      refreshTickets();
    });
  }

  // Settings button
  const settingsBtn = document.getElementById('settings-btn');
  const settingsModal = document.getElementById('settings-modal');
  const settingsClose = document.getElementById('settings-close');

  if (settingsBtn && settingsModal) {
    settingsBtn.addEventListener('click', () => {
      updateSettingsModalStats();
      settingsModal.classList.add('visible');
    });
  }

  if (settingsClose && settingsModal) {
    settingsClose.addEventListener('click', () => {
      settingsModal.classList.remove('visible');
      // Show quantity modal after closing settings (for first launch flow)
      const quantityModal = document.getElementById('quantity-modal');
      if (quantityModal && !quantityModal.classList.contains('was-shown')) {
        setTimeout(() => {
          quantityModal.classList.add('visible');
          quantityModal.classList.add('was-shown');
        }, 200);
      }
    });
  }

  if (settingsModal) {
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) {
        settingsModal.classList.remove('visible');
        // Show quantity modal after closing settings (for first launch flow)
        const quantityModal = document.getElementById('quantity-modal');
        if (quantityModal && !quantityModal.classList.contains('was-shown')) {
          setTimeout(() => {
            quantityModal.classList.add('visible');
            quantityModal.classList.add('was-shown');
          }, 200);
        }
      }
    });
  }

  // Difficulty options
  document.querySelectorAll('.difficulty-option').forEach(option => {
    option.addEventListener('click', () => {
      const difficulty = option.dataset.difficulty;
      if (difficulty) {
        changeDifficulty(difficulty);
        document.querySelectorAll('.difficulty-option').forEach(opt => {
          opt.classList.toggle('selected', opt === option);
        });
      }
    });
  });

  // Countdown mode toggle
  const countdownToggle = document.getElementById('countdown-mode-toggle');
  if (countdownToggle) {
    countdownToggle.addEventListener('change', () => {
      gameState.isOnsaleMode = countdownToggle.checked;
    });
  }

  // Reset stats button
  const resetStatsBtn = document.getElementById('reset-stats');
  if (resetStatsBtn) {
    resetStatsBtn.addEventListener('click', () => {
      if (confirm('Reset all your stats? This cannot be undone.')) {
        resetStats();
        updateSettingsModalStats();
      }
    });
  }

  // Success modal buttons
  const successAgain = document.getElementById('success-again');
  const successStats = document.getElementById('success-stats');
  const successModal = document.getElementById('success-modal');

  if (successAgain) {
    successAgain.addEventListener('click', () => {
      successModal.classList.remove('visible');
      refreshTickets();
    });
  }

  if (successStats) {
    successStats.addEventListener('click', () => {
      successModal.classList.remove('visible');
      settingsModal.classList.add('visible');
      updateSettingsModalStats();
    });
  }

  // Skip countdown button
  const skipCountdown = document.getElementById('skip-countdown');
  const waitingRoom = document.getElementById('waiting-room');
  if (skipCountdown) {
    skipCountdown.addEventListener('click', () => {
      if (gameState.countdownInterval) {
        clearInterval(gameState.countdownInterval);
        gameState.countdownInterval = null;
      }
      waitingRoom.classList.remove('visible');
      startOnsale();
    });
  }

  // Update initial difficulty display
  updateDifficultyBadge();
  updateSettingsModalDifficulty();

  // Start elapsed timer updater
  setInterval(updateElapsedTimer, 100);
}

// Update elapsed timer display
function updateElapsedTimer() {
  const elapsedEl = document.getElementById('elapsed-time');
  const timerContainer = document.getElementById('elapsed-timer');

  if (!elapsedEl || !gameState.currentAttempt.startTime) return;

  const elapsed = Date.now() - gameState.currentAttempt.startTime;
  const seconds = (elapsed / 1000).toFixed(2);
  elapsedEl.textContent = `${seconds}s`;

  if (timerContainer) {
    timerContainer.classList.add('active');
  }
}

// Update difficulty badge display
function updateDifficultyBadge() {
  const badge = document.getElementById('difficulty-badge');
  if (!badge) return;

  const settings = difficultySettings[gameState.difficulty];
  badge.textContent = settings.label;
  badge.className = `difficulty-badge ${gameState.difficulty}`;
}

// Update settings modal difficulty selection
function updateSettingsModalDifficulty() {
  document.querySelectorAll('.difficulty-option').forEach(opt => {
    opt.classList.toggle('selected', opt.dataset.difficulty === gameState.difficulty);
  });
}

// Update stats in settings modal
function updateSettingsModalStats() {
  const bestTimeEl = document.getElementById('stat-best-time');
  const successRateEl = document.getElementById('stat-success-rate');
  const attemptsEl = document.getElementById('stat-total-attempts');
  const bestSectionEl = document.getElementById('stat-best-section');

  if (bestTimeEl) {
    bestTimeEl.textContent = gameState.sessionStats.fastestCheckout
      ? `${(gameState.sessionStats.fastestCheckout / 1000).toFixed(2)}s`
      : '--';
  }

  if (successRateEl) {
    const rate = gameState.sessionStats.attempts > 0
      ? Math.round((gameState.sessionStats.successes / gameState.sessionStats.attempts) * 100)
      : 0;
    successRateEl.textContent = `${rate}%`;
  }

  if (attemptsEl) {
    attemptsEl.textContent = gameState.sessionStats.attempts;
  }

  if (bestSectionEl) {
    bestSectionEl.textContent = gameState.sessionStats.bestSection
      ? `Sec ${gameState.sessionStats.bestSection}`
      : '--';
  }
}

// Show success modal
function showSuccessModal() {
  const modal = document.getElementById('success-modal');
  const timeEl = document.getElementById('success-time');
  const detailsEl = document.getElementById('success-details');

  if (!modal || !state.selectedListing) return;

  const checkoutTime = Date.now() - gameState.currentAttempt.startTime;
  recordSuccessfulCheckout();

  if (timeEl) {
    timeEl.textContent = `${(checkoutTime / 1000).toFixed(2)}s`;
  }

  if (detailsEl) {
    detailsEl.innerHTML = `${state.selectedListing.sectionName}, Row ${state.selectedListing.row}<br>${state.ticketQuantity} tickets at $${state.selectedListing.price} each`;
  }

  modal.classList.add('visible');
}

// Start countdown for onsale mode
function startOnsaleCountdown(seconds = 10) {
  const waitingRoom = document.getElementById('waiting-room');
  const countdownDisplay = document.getElementById('countdown-display');

  if (!waitingRoom || !countdownDisplay) return;

  waitingRoom.classList.add('visible');
  let remaining = seconds;
  countdownDisplay.textContent = remaining;

  gameState.countdownInterval = setInterval(() => {
    remaining--;
    countdownDisplay.textContent = remaining;

    if (remaining <= 0) {
      clearInterval(gameState.countdownInterval);
      gameState.countdownInterval = null;
      waitingRoom.classList.remove('visible');
      startOnsale();
    }
  }, 1000);
}

// Start onsale (after countdown)
function startOnsale() {
  gameState.currentAttempt.startTime = Date.now();
  gameState.sessionStats.attempts++;
  saveGameStats();
  startBotActivity();
}

// Update hold timer bar display
function updateHoldTimerBar() {
  const timerBar = document.getElementById('hold-timer-bar');
  const progress = document.getElementById('hold-timer-progress');

  if (!timerBar || !progress) return;

  const settings = difficultySettings[gameState.difficulty];
  if (settings.holdTime === 0 || gameState.holdTimeRemaining <= 0) {
    timerBar.classList.remove('active', 'warning', 'critical');
    return;
  }

  const percent = (gameState.holdTimeRemaining / settings.holdTime) * 100;
  progress.style.width = `${percent}%`;
  timerBar.classList.add('active');

  // Warning states
  timerBar.classList.toggle('warning', percent <= 50 && percent > 20);
  timerBar.classList.toggle('critical', percent <= 20);
}

// Initialize application
async function init() {
  console.log('Initializing SeatGeek simulator...');

  // Clean up any old HTML price labels
  document.querySelectorAll('.floating-price-label').forEach(el => el.remove());

  try {
    await loadSVGMap();
    console.log('SVG map loaded');
    console.log('Sections:', state.sections.length);
    console.log('Listings:', state.listings.length);
  } catch (error) {
    console.error('Error loading SVG map:', error);
  }

  setupModals();
  setupGameUI();

  // Generate histogram after listings are created
  setTimeout(() => {
    if (state.listings.length > 0) {
      generatePriceHistogram();
    }
  }, 100);

  // Timer will start when user presses Refresh button
  // Do NOT auto-start timer or bot activity on launch

  // Check if returning from successful checkout
  const successDataStr = localStorage.getItem('bts_show_success');
  if (successDataStr) {
    const successData = JSON.parse(successDataStr);
    localStorage.removeItem('bts_show_success');

    // Show success modal with the data
    setTimeout(() => {
      showSuccessModalWithData(successData);
    }, 300);
  }
}

// Show success modal with checkout data from localStorage
function showSuccessModalWithData(successData) {
  const modal = document.getElementById('success-modal');
  const timeEl = document.getElementById('success-time');
  const detailsEl = document.getElementById('success-details');

  if (!modal) return;

  if (timeEl && successData.checkoutTime) {
    timeEl.textContent = `${(successData.checkoutTime / 1000).toFixed(2)}s`;
  }

  if (detailsEl) {
    detailsEl.innerHTML = `${successData.section}, Row ${successData.row}<br>${successData.quantity} tickets at $${successData.price} each`;
  }

  // Update stats display
  updateStatsDisplay();

  modal.classList.add('visible');
}

// Share functionality
function setupShareButtons() {
  const twitterBtn = document.getElementById('share-twitter');
  const copyBtn = document.getElementById('share-copy');
  const closeBtn = document.getElementById('banner-close');
  const banner = document.getElementById('simulator-banner');

  const shareText = "Practice buying BTS concert tickets before they go on sale! Free simulator to master the SeatGeek interface. #BTS #BTSARMY #BTSArirangTour";
  const shareUrl = window.location.href;

  if (twitterBtn) {
    twitterBtn.addEventListener('click', () => {
      const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
      window.open(twitterUrl, '_blank', 'width=550,height=420');
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(shareUrl);
        showToast('Link copied to clipboard!');
      } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showToast('Link copied to clipboard!');
      }
    });
  }

  if (closeBtn && banner) {
    closeBtn.addEventListener('click', () => {
      banner.classList.add('hidden');
      localStorage.setItem('bannerClosed', 'true');
    });

    // Check if banner was previously closed
    if (localStorage.getItem('bannerClosed') === 'true') {
      banner.classList.add('hidden');
    }
  }
}

function showToast(message) {
  // Remove existing toast
  const existingToast = document.querySelector('.toast');
  if (existingToast) existingToast.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  // Trigger animation
  setTimeout(() => toast.classList.add('visible'), 10);

  // Remove after 3 seconds
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Mobile view toggle
function setupMobileViewToggle() {
  const toggle = document.getElementById('mobile-view-toggle');
  const listingsPanel = document.querySelector('.listings-panel');
  const mapPanel = document.querySelector('.map-panel');
  const buttons = toggle?.querySelectorAll('.view-toggle-btn');

  if (!toggle || !buttons) return;

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;

      // Update button states
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Toggle views
      if (view === 'list') {
        listingsPanel.classList.remove('hidden');
        mapPanel.classList.remove('visible');
      } else {
        listingsPanel.classList.add('hidden');
        mapPanel.classList.add('visible');
      }
    });
  });
}

// Touch support for mobile map panning
function setupTouchSupport(mapContainer) {
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartPanX = 0;
  let touchStartPanY = 0;
  let initialDistance = 0;
  let initialZoom = 1;

  mapContainer.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      // Single touch - pan
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartPanX = state.pan.x;
      touchStartPanY = state.pan.y;
    } else if (e.touches.length === 2) {
      // Two touches - pinch to zoom
      initialDistance = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY
      );
      initialZoom = state.zoom;
    }
  }, { passive: true });

  mapContainer.addEventListener('touchmove', (e) => {
    e.preventDefault();

    if (e.touches.length === 1) {
      // Pan
      const deltaX = e.touches[0].clientX - touchStartX;
      const deltaY = e.touches[0].clientY - touchStartY;
      const panSpeed = Math.max(3, state.zoom * 2);
      state.pan.x = touchStartPanX + deltaX * panSpeed;
      state.pan.y = touchStartPanY + deltaY * panSpeed;
      if (window.updateMapTransform) {
        window.updateMapTransform(false);
      }
    } else if (e.touches.length === 2) {
      // Pinch zoom
      const currentDistance = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY
      );
      const scale = currentDistance / initialDistance;
      state.zoom = Math.min(Math.max(initialZoom * scale, 0.5), 6);
      if (window.updateMapTransform) {
        window.updateMapTransform(false);
      }
    }
  }, { passive: false });
}

// Start the app
document.addEventListener('DOMContentLoaded', () => {
  init();
  setupShareButtons();
  setupMobileViewToggle();
});

// Also try to start if DOM is already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(() => {
    init();
    setupShareButtons();
    setupMobileViewToggle();
  }, 100);
}
