'use strict';

/* ══════════════════════════════════════
   SELFIT — App Logic
   ══════════════════════════════════════ */

// ── Mock Database
const DB = [
  { id: 1, name: "Urban Crop T-Shirt",    length: 48, width: 120, emoji: "✂️" },
  { id: 2, name: "Standard Daily Fit",    length: 66, width: 145, emoji: "👕" },
  { id: 3, name: "Oversized Street Tee",  length: 78, width: 180, emoji: "🧥" },
  { id: 4, name: "Slim Muscle Fit",       length: 62, width: 125, emoji: "💪" },
];

// ── State
const state = {
  length: 66,
  width: 145,
  garment: 'tshirt',
  gender: 'neutral',
};

// ── SVG Clothing geometry constants
// Mannequin SVG viewBox is 200x480
// Shirt shoulder line is at y=155 (collar base ~y=153)
// Shoulder width (full): left edge ~x=52, right edge ~x=148 = 96px span
// These scale with "width" slider
// Shirt bottom at y=265 for default length 66cm
// length range 40-90cm → y range 200-310 (bottom edge)

const BASE = {
  // Fixed points
  shoulderY: 155,
  shoulderLeft: 52,
  shoulderRight: 148,
  centerX: 100,
  collarDepth: 15, // how far down the collar V goes

  // Width: 100cm→offset=-10, 200cm→offset=+28
  // width pixels = (w - 100) / 100 * 38 - 10
  // Length: 40cm→y=212, 90cm→y=305
  // y = 212 + (l - 40) / 50 * 93
};

function widthToPx(w) {
  // Map 100-200cm → -10 to +28 px offset from natural shoulder
  return (w - 100) / 100 * 38 - 10;
}

function lengthToY(l) {
  // Map 40-90cm → y 212 to 310 (SVG units)
  return 212 + (l - 40) / 50 * 98;
}

function computeShirt(length, width) {
  const wOffset = widthToPx(width);
  const lx = BASE.shoulderLeft  - wOffset;  // left edge x
  const rx = BASE.shoulderRight + wOffset;  // right edge x
  const sy = BASE.shoulderY;
  const by = lengthToY(length);             // bottom y
  const cx = BASE.centerX;
  const mid = (sy + by) / 2;

  // Subtle waist taper
  const taper = wOffset * 0.18;
  const lxMid = lx + taper;
  const rxMid = rx - taper;

  // Shirt body path (slight curves for realism)
  const body = `M${lx} ${sy} Q${lx-4} ${mid} ${lx} ${by} Q${cx} ${by+8} ${rx} ${by} Q${rx+4} ${mid} ${rx} ${sy} Z`;

  // Left sleeve: from shoulder to about y=210, arm angle
  const sleeveLeftTip = { x: lx - 22 - wOffset*0.3, y: sy + 50 };
  const sleeveLeft = `M${lx} ${sy} Q${lx-10} ${sy+10} ${sleeveLeftTip.x} ${sleeveLeftTip.y} Q${lx-8} ${sy+48} ${lx} ${sy+46} Z`;

  // Right sleeve
  const sleeveRightTip = { x: rx + 22 + wOffset*0.3, y: sy + 50 };
  const sleeveRight = `M${rx} ${sy} Q${rx+10} ${sy+10} ${sleeveRightTip.x} ${sleeveRightTip.y} Q${rx+8} ${sy+48} ${rx} ${sy+46} Z`;

  // Collar V-neck
  const collar = `M${cx-16} ${sy} Q${cx} ${sy+BASE.collarDepth+4} ${cx+16} ${sy}`;

  // Hem
  const hem = `M${lx} ${by} Q${cx} ${by+8} ${rx} ${by}`;

  // Measure guide positions
  const guideLength = `M${rx+10} ${sy} L${rx+10} ${by}`;

  return { body, sleeveLeft, sleeveRight, collar, hem, lx, rx, sy, by };
}

// ── DOM refs
const sliderLength  = document.getElementById('slider-length');
const sliderWidth   = document.getElementById('slider-width');
const displayLength = document.getElementById('display-length');
const displayWidth  = document.getElementById('display-width');
const dimLengthVal  = document.getElementById('dim-length-val');
const dimWidthVal   = document.getElementById('dim-width-val');
const summaryLength = document.getElementById('summary-length');
const summaryWidth  = document.getElementById('summary-width');
const summaryType   = document.getElementById('summary-type');
const summarySil    = document.getElementById('summary-sil');
const fitBadge      = document.getElementById('fit-badge');
const btnSearch     = document.getElementById('btn-search');
const guideLengthLabel = document.getElementById('guide-length-label');
const guideWidthLabel  = document.getElementById('guide-width-label');

// SVG elements
const shirtBody   = document.getElementById('shirt-body');
const sleeveLeft  = document.getElementById('shirt-sleeve-left');
const sleeveRight = document.getElementById('shirt-sleeve-right');
const collar      = document.getElementById('shirt-collar');
const hem         = document.getElementById('shirt-hem');

// Result panels
const resultsIdle    = document.getElementById('results-idle');
const resultsLoading = document.getElementById('results-loading');
const resultsEmpty   = document.getElementById('results-empty');
const resultsList    = document.getElementById('results-list');
const matchLegend    = document.getElementById('match-legend');
const countBadge     = document.getElementById('result-count-badge');
const closestHint    = document.getElementById('closest-hint');

// ── Fit type classification
function classifyFit(length, width) {
  const isLong   = length >= 75;
  const isCrop   = length <= 54;
  const isOver   = width  >= 165;
  const isSlim   = width  <= 130;

  if (isCrop && isSlim)  return { type: 'Cropped Slim',     sil: 'Body-con',   badge: 'Cropped Slim' };
  if (isCrop && isOver)  return { type: 'Cropped Oversized',sil: 'Boxy',       badge: 'Crop Oversize' };
  if (isCrop)            return { type: 'Crop Top',         sil: 'Cropped',    badge: 'Crop' };
  if (isOver && isLong)  return { type: 'Longline Oversized',sil:'Drop Shoulder',badge:'Longline OS' };
  if (isOver)            return { type: 'Oversized',        sil: 'Boxy Drop',  badge: 'Oversized' };
  if (isSlim)            return { type: 'Slim / Muscle Fit',sil: 'Fitted',     badge: 'Slim Fit' };
  if (isLong)            return { type: 'Longline',         sil: 'Extended',   badge: 'Longline' };
  return                        { type: 'Standard Fit',     sil: 'Regular',    badge: 'Standard Fit' };
}

// ── Update slider track fill
function updateSliderFill(slider) {
  const min = +slider.min, max = +slider.max, val = +slider.value;
  const pct = ((val - min) / (max - min) * 100).toFixed(1);
  slider.style.setProperty('--pct', pct + '%');
}

// ── Main update function
function update() {
  const l = state.length;
  const w = state.width;

  // Update displays
  displayLength.textContent = l;
  displayWidth.textContent  = w;
  dimLengthVal.textContent  = l;
  dimWidthVal.textContent   = w;
  summaryLength.textContent = l + ' cm';
  summaryWidth.textContent  = w + ' cm';

  const fit = classifyFit(l, w);
  summaryType.textContent  = fit.type;
  summarySil.textContent   = fit.sil;
  fitBadge.textContent     = fit.badge;

  // Animate value boxes
  displayLength.parentElement.classList.add('pop');
  displayWidth.parentElement.classList.add('pop');
  setTimeout(() => {
    displayLength.parentElement.classList.remove('pop');
    displayWidth.parentElement.classList.remove('pop');
  }, 200);

  // Update SVG clothing overlay
  const geom = computeShirt(l, w);
  shirtBody.setAttribute('d', geom.body);
  sleeveLeft.setAttribute('d', geom.sleeveLeft);
  sleeveRight.setAttribute('d', geom.sleeveRight);
  collar.setAttribute('d', geom.collar);
  hem.setAttribute('d', geom.hem);

  // Guide labels
  if (guideLengthLabel) guideLengthLabel.textContent = l + 'cm';
  if (guideWidthLabel)  guideWidthLabel.textContent  = w + 'cm';

  // Guide line positions
  const guideLength = document.querySelector('#measure-guides line:nth-child(1)');
  const guideLengthTop = document.querySelector('#measure-guides line:nth-child(2)');
  const guideLengthBot = document.querySelector('#measure-guides line:nth-child(3)');
  if (guideLength) {
    guideLength.setAttribute('x1', geom.rx + 12);
    guideLength.setAttribute('x2', geom.rx + 12);
    guideLength.setAttribute('y1', geom.sy);
    guideLength.setAttribute('y2', geom.by);
    guideLengthTop?.setAttribute('x1', geom.rx + 7);
    guideLengthTop?.setAttribute('x2', geom.rx + 17);
    guideLengthTop?.setAttribute('y1', geom.sy);
    guideLengthTop?.setAttribute('y2', geom.sy);
    guideLengthBot?.setAttribute('x1', geom.rx + 7);
    guideLengthBot?.setAttribute('x2', geom.rx + 17);
    guideLengthBot?.setAttribute('y1', geom.by);
    guideLengthBot?.setAttribute('y2', geom.by);
    if (guideLengthLabel) {
      guideLengthLabel.setAttribute('x', geom.rx + 15);
      guideLengthLabel.setAttribute('y', (geom.sy + geom.by) / 2 + 3);
    }
  }

  // Width guide
  const guideWidthLine = document.querySelector('#measure-guides line:nth-child(5)');
  if (guideWidthLine) {
    guideWidthLine.setAttribute('x1', geom.lx);
    guideWidthLine.setAttribute('x2', geom.rx);
    guideWidthLine.setAttribute('y1', geom.sy + 18);
    guideWidthLine.setAttribute('y2', geom.sy + 18);
    const wl = document.querySelector('#measure-guides line:nth-child(6)');
    const wr = document.querySelector('#measure-guides line:nth-child(7)');
    if (wl) { wl.setAttribute('x1', geom.lx); wl.setAttribute('x2', geom.lx); wl.setAttribute('y1', geom.sy+13); wl.setAttribute('y2', geom.sy+23); }
    if (wr) { wr.setAttribute('x1', geom.rx); wr.setAttribute('x2', geom.rx); wr.setAttribute('y1', geom.sy+13); wr.setAttribute('y2', geom.sy+23); }
    if (guideWidthLabel) {
      guideWidthLabel.setAttribute('x', geom.lx + (geom.rx - geom.lx) / 2 - 14);
      guideWidthLabel.setAttribute('y', geom.sy + 12);
    }
  }

  // Slider fills
  updateSliderFill(sliderLength);
  updateSliderFill(sliderWidth);

  // Update preset chip active states
  document.querySelectorAll('.preset-chip[data-slider="length"]').forEach(c => {
    c.classList.toggle('active', +c.dataset.val === l);
  });
  document.querySelectorAll('.preset-chip[data-slider="width"]').forEach(c => {
    c.classList.toggle('active', +c.dataset.val === w);
  });
}

// ── Matching Algorithm
function matchItems(targetL, targetW) {
  const WEIGHT = 1.8; // variance weight factor
  return DB
    .map(item => {
      const variance = Math.abs(targetL - item.length) + Math.abs(targetW - item.width);
      const matchPct = Math.max(0, Math.round(100 - variance * WEIGHT));
      return { ...item, matchPct, variance };
    })
    .sort((a, b) => b.matchPct - a.matchPct);
}

function getMatchTier(pct) {
  if (pct >= 80) return { tier: 'tier-green', color: 'color-green' };
  if (pct >= 60) return { tier: 'tier-blue',  color: 'color-blue'  };
  if (pct >= 40) return { tier: 'tier-orange',color: 'color-orange'};
  return              { tier: 'tier-red',   color: 'color-red'  };
}

// ── Render Results
function renderResults(results) {
  const best = results[0];
  const hasGoodMatch = best.matchPct >= 50;

  countBadge.classList.remove('hidden');
  countBadge.textContent = results.length;
  matchLegend.classList.remove('hidden');

  if (!hasGoodMatch) {
    // Show no-match state with closest hint
    resultsEmpty.classList.remove('hidden');
    resultsList.classList.add('hidden');
    closestHint.innerHTML = `
      <strong>Closest item:</strong> ${best.emoji} ${best.name}<br>
      Match: <span style="color:var(--accent)">${best.matchPct}%</span> 
      (Δ${Math.abs(state.length - best.length)}cm length, Δ${Math.abs(state.width - best.width)}cm width)
    `;
    return;
  }

  resultsEmpty.classList.add('hidden');
  resultsList.classList.remove('hidden');
  resultsList.innerHTML = '';

  results.forEach((item, i) => {
    const { tier, color } = getMatchTier(item.matchPct);
    const isBest = i === 0 && item.matchPct >= 50;
    const card = document.createElement('div');
    card.className = `result-card${isBest ? ' best' : ''}`;
    card.style.animationDelay = `${i * 0.07}s`;

    card.innerHTML = `
      <div class="card-top">
        <div class="card-thumb">${item.emoji}</div>
        <div class="card-info">
          <div class="card-name">${item.name}</div>
          <div class="card-specs">
            <span class="spec-pill">↕ ${item.length}cm</span>
            <span class="spec-pill">↔ ${item.width}cm</span>
          </div>
        </div>
      </div>
      <div class="match-row">
        <div class="match-bar-track">
          <div class="match-bar-fill ${tier}" style="width:0%"
               data-target="${item.matchPct}"></div>
        </div>
        <span class="match-pct ${color}">${item.matchPct}%</span>
      </div>
    `;

    resultsList.appendChild(card);

    // Animate bar fill after render
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const fill = card.querySelector('.match-bar-fill');
        if (fill) fill.style.width = item.matchPct + '%';
      });
    });
  });
}

// ── Search action
function doSearch() {
  // Show loading
  resultsIdle.classList.add('hidden');
  resultsEmpty.classList.add('hidden');
  resultsList.classList.add('hidden');
  matchLegend.classList.add('hidden');
  countBadge.classList.add('hidden');
  resultsLoading.classList.remove('hidden');
  btnSearch.classList.add('loading');
  btnSearch.innerHTML = `<div class="mini-spinner"></div> Scanning...`;

  // Simulate async processing
  setTimeout(() => {
    resultsLoading.classList.add('hidden');
    btnSearch.classList.remove('loading');
    btnSearch.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      Search Matching Clothes`;

    const results = matchItems(state.length, state.width);
    renderResults(results);
  }, 1100);
}

// ── Event Listeners

// Sliders
sliderLength.addEventListener('input', () => {
  state.length = +sliderLength.value;
  update();
});
sliderWidth.addEventListener('input', () => {
  state.width = +sliderWidth.value;
  update();
});

// Preset chips
document.querySelectorAll('.preset-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const slider = chip.dataset.slider;
    const val    = +chip.dataset.val;
    if (slider === 'length') {
      state.length = val;
      sliderLength.value = val;
    } else {
      state.width = val;
      sliderWidth.value = val;
    }
    update();
  });
});

// Garment tabs
document.querySelectorAll('.garment-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.garment-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    state.garment = tab.dataset.type;
    // Could swap SVG clothing shapes — for now just update color
    const colors = { tshirt: ['#3a3aff','#0055ff'], hoodie: ['#1a1a3a','#0a0a2a'], shirt: ['#1a3a1a','#004400'] };
    const [c1, c2] = colors[state.garment] || colors.tshirt;
    document.getElementById('cloth-stop-1').style.stopColor = c1;
    document.getElementById('cloth-stop-2').style.stopColor = c2;
  });
});

// Gender tabs
document.querySelectorAll('.gender-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.gender-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    state.gender = tab.dataset.gender;
  });
});

// Search button
btnSearch.addEventListener('click', doSearch);

// ── Keyboard shortcut
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !btnSearch.classList.contains('loading')) {
    doSearch();
  }
});

// ── Initial render
update();
