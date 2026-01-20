// SeatGeek BTS Concert Simulator
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
  showSeats: false, // Toggle seat visibility based on zoom
  hoveredSection: null,
  seatElements: new Map() // Cache seat SVG elements
};

// Configuration for random availability
const availabilityConfig = {
  minAvailablePercent: 0.4, // At least 40% of sections available
  maxAvailablePercent: 0.7  // At most 70% of sections available
};

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
    name: `Section ${sectionId}`,
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

// Generate seat circles for a section
function generateSeatCircles(svg, section, pathElement) {
  const bounds = getPathBounds(pathElement);
  if (!bounds || bounds.width < 50 || bounds.height < 50) return;

  const seatRadius = Math.min(bounds.width, bounds.height) / 25; // Adaptive seat size
  const padding = seatRadius * 0.8;
  const rowSpacing = seatRadius * 2.5;
  const seatSpacing = seatRadius * 2.3;

  // Create a group for this section's seats
  const seatsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  seatsGroup.setAttribute('class', 'section-seats');
  seatsGroup.setAttribute('data-section', section.id);
  seatsGroup.style.opacity = '0'; // Hidden initially, shown on zoom
  seatsGroup.style.transition = 'opacity 0.3s ease';

  // Calculate how many rows and seats fit
  const numRows = Math.min(section.rows.length, Math.floor((bounds.height - padding * 2) / rowSpacing));

  section.rows.slice(0, numRows).forEach((row, rowIndex) => {
    const y = bounds.y + padding + rowIndex * rowSpacing + rowSpacing / 2;
    const numSeats = Math.min(row.seats.length, Math.floor((bounds.width - padding * 2) / seatSpacing));
    const rowWidth = numSeats * seatSpacing;
    const startX = bounds.centerX - rowWidth / 2 + seatSpacing / 2;

    row.seats.slice(0, numSeats).forEach((seat, seatIndex) => {
      const x = startX + seatIndex * seatSpacing;

      // Check if point is roughly inside the section path
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', x);
      circle.setAttribute('cy', y);
      circle.setAttribute('r', seatRadius);
      circle.setAttribute('fill', getSeatColor(seat, section));
      circle.setAttribute('class', 'seat-circle');
      circle.setAttribute('data-section', section.id);
      circle.setAttribute('data-row', row.id);
      circle.setAttribute('data-seat', seat.id);
      circle.setAttribute('data-available', seat.available);
      circle.setAttribute('data-price', seat.price);

      if (seat.available) {
        circle.style.cursor = 'pointer';
        circle.addEventListener('mouseenter', () => {
          circle.setAttribute('fill', colors.hovered);
          showSeatTooltip(circle, section, row, seat);
        });
        circle.addEventListener('mouseleave', () => {
          circle.setAttribute('fill', getSeatColor(seat, section));
          hideSeatTooltip();
        });
        circle.addEventListener('click', (e) => {
          e.stopPropagation();
          selectSeat(section, row, seat, circle);
        });
      }

      seatsGroup.appendChild(circle);
    });
  });

  // Insert seats group after the section path
  pathElement.parentNode.insertBefore(seatsGroup, pathElement.nextSibling);
  state.seatElements.set(section.id, seatsGroup);
}

// Show tooltip for individual seat
function showSeatTooltip(circle, section, row, seat) {
  const tooltip = document.getElementById('map-tooltip');
  const rect = circle.getBoundingClientRect();

  tooltip.querySelector('.tooltip-section').textContent = `${section.name}, Row ${row.id}`;
  tooltip.querySelector('.tooltip-price').textContent = `$${seat.price.toLocaleString()}`;
  tooltip.querySelector('.tooltip-perks').textContent = seat.type === 'aisle' ? 'Aisle seat' : 'Standard seat';

  tooltip.style.left = `${rect.left + rect.width / 2}px`;
  tooltip.style.top = `${rect.top - 10}px`;
  tooltip.classList.add('visible');
}

function hideSeatTooltip() {
  const tooltip = document.getElementById('map-tooltip');
  tooltip.classList.remove('visible');
}

// Handle seat selection
function selectSeat(section, row, seat, circle) {
  console.log(`Selected: ${section.name}, Row ${row.id}, Seat ${seat.id} - $${seat.price}`);

  // Visual feedback
  circle.setAttribute('fill', colors.selected);

  // Find matching listing and show detail
  const listing = state.listings.find(l => l.sectionId === section.id && l.row === row.id);
  if (listing) {
    showListingDetail(listing);
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

// Toggle seat visibility based on zoom level
function updateSeatVisibility() {
  const showSeats = state.zoom > 1.8;

  if (showSeats !== state.showSeats) {
    state.showSeats = showSeats;

    state.seatElements.forEach((seatsGroup) => {
      seatsGroup.style.opacity = showSeats ? '1' : '0';
      seatsGroup.style.pointerEvents = showSeats ? 'auto' : 'none';
    });
  }
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
        <img src="${listingImagePath}" alt="Section view" onerror="this.src='bts.jpg'">
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
        <img src="${similarImagePath}" alt="View from section" onerror="this.src='bts.jpg'">
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
}

// Hide listing detail panel
function hideListingDetail() {
  const panel = document.getElementById('listing-detail');
  panel.classList.remove('visible');
  state.selectedSection = null;
  state.selectedListing = null;
  clearSectionHighlight();
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

    // Update seat visibility (price labels now move with SVG automatically)
    updateSeatVisibility();

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
    const panSpeed = Math.max(2.5, state.zoom * 2);
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

  // Collect all section IDs from SVG
  const sectionIds = [];
  const sectionPathsMap = new Map();

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
      sectionIds.push(id);
      sectionPathsMap.set(id, path);
      // Mark as section path for CSS
      path.classList.add('section-path');
    }
  });

  console.log('Section IDs found:', sectionIds.length, sectionIds.slice(0, 10));

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
        // Find the first listing for this section and show its detail
        const sectionListings = state.listings.filter(l => l.sectionId === id);
        if (sectionListings.length > 0) {
          // Sort by price and show cheapest listing
          sectionListings.sort((a, b) => a.price - b.price);
          showListingDetail(sectionListings[0]);
        }
        highlightSectionOnMap(id);
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
      const price = sectionListings.length > 0
        ? Math.min(...sectionListings.map(l => l.price))
        : section.basePrice;

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

// Generate all seat circles for visible sections
function generateAllSeats(svg) {
  console.log('Generating seat circles for', state.sections.length, 'sections');

  // Only generate for a subset to avoid performance issues
  const sectionsToRender = state.sections.slice(0, 100); // Limit for performance

  sectionsToRender.forEach(section => {
    const path = svg.querySelector(`path[id="${section.id}"]`);
    if (path) {
      generateSeatCircles(svg, section, path);
    }
  });

  console.log('Generated seats for', state.seatElements.size, 'sections');
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

  // Show quantity modal on initial load
  setTimeout(() => {
    quantityModal.classList.add('visible');
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

  // Continue button - navigate to checkout
  document.getElementById('continue-btn').addEventListener('click', () => {
    if (state.selectedListing) {
      const listing = state.selectedListing;
      const ticketCount = document.getElementById('ticket-count').textContent.split(' ')[0];
      const params = new URLSearchParams({
        section: listing.sectionName,
        row: `Row ${listing.row}`,
        price: listing.price,
        quantity: ticketCount,
        rating: listing.rating,
        aisle: listing.perks.aisle
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

  // Generate histogram after listings are created
  setTimeout(() => {
    if (state.listings.length > 0) {
      generatePriceHistogram();
    }
  }, 100);
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

// Start the app
document.addEventListener('DOMContentLoaded', () => {
  init();
  setupShareButtons();
});

// Also try to start if DOM is already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(() => {
    init();
    setupShareButtons();
  }, 100);
}
