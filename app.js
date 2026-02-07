const PORTION_OPTIONS = [0, 0.5, 1, 2];

const NUTRIENTS = {
  calories: { label: 'Calories', type: 'max', unit: '' },
  total_fat_g: { label: 'Total Fat', type: 'max', unit: 'g' },
  sat_fat_g: { label: 'Saturated Fat', type: 'max', unit: 'g' },
  cholesterol_mg: { label: 'Cholesterol', type: 'max', unit: 'mg' },
  sodium_mg: { label: 'Sodium', type: 'max', unit: 'mg' },
  sugar_g: { label: 'Sugar', type: 'max', unit: 'g' },
  fiber_g: { label: 'Fiber', type: 'min', unit: 'g' },
  protein_g: { label: 'Protein', type: 'min', unit: 'g' }
};

const DEFAULT_CONSTRAINTS = {
  calories: 700,
  total_fat_g: 20,
  sat_fat_g: 5,
  cholesterol_mg: 100,
  sodium_mg: 700,
  sugar_g: 12,
  fiber_g: 10,
  protein_g: 20
};

const CATEGORY_ORDER = ['base', 'proteins', 'toppings', 'sauces', 'extras'];

const state = {
  restaurants: [],
  selectedRestaurantId: '',
  constraints: { ...DEFAULT_CONSTRAINTS },
  portions: {},
  strictMinEnforcement: false
};

const elements = {
  restaurantSelect: document.getElementById('restaurantSelect'),
  resetBowlBtn: document.getElementById('resetBowlBtn'),
  copyShareBtn: document.getElementById('copyShareBtn'),
  applyDefaultsBtn: document.getElementById('applyDefaultsBtn'),
  restoreDefaultsBtn: document.getElementById('restoreDefaultsBtn'),
  strictMinsSwitch: document.getElementById('strictMinsSwitch'),
  constraintsForm: document.getElementById('constraintsForm'),
  ingredientsAccordion: document.getElementById('ingredientsAccordion'),
  totalsPanel: document.getElementById('totalsPanel'),
  toastMessage: document.getElementById('toastMessage'),
  appToast: document.getElementById('appToast')
};

let toast;

function getRestaurant() {
  return state.restaurants.find((restaurant) => restaurant.id === state.selectedRestaurantId);
}

function flattenIngredients(restaurant) {
  return (restaurant.categories || []).flatMap((category) =>
    (category.ingredients || []).map((ingredient) => ({ ...ingredient, categoryId: category.id }))
  );
}

function computeTotals(currentState, restaurant) {
  const totals = Object.keys(NUTRIENTS).reduce((acc, nutrient) => {
    acc[nutrient] = 0;
    return acc;
  }, {});

  flattenIngredients(restaurant).forEach((ingredient) => {
    const portion = Number(currentState.portions[ingredient.id] ?? 0);
    if (!portion) {
      return;
    }

    Object.keys(NUTRIENTS).forEach((nutrient) => {
      totals[nutrient] += Number(ingredient[nutrient] || 0) * portion;
    });
  });

  return totals;
}

function wouldViolateConstraints(totals, constraints, strictMins = state.strictMinEnforcement) {
  return Object.entries(NUTRIENTS).some(([nutrient, config]) => {
    if (config.type === 'max') {
      return totals[nutrient] > Number(constraints[nutrient]);
    }

    if (strictMins) {
      return totals[nutrient] < Number(constraints[nutrient]);
    }

    return false;
  });
}

function explainViolation(beforeTotals, afterTotals, constraints, strictMins = state.strictMinEnforcement) {
  for (const [nutrient, config] of Object.entries(NUTRIENTS)) {
    const limit = Number(constraints[nutrient]);
    if (config.type === 'max' && afterTotals[nutrient] > limit) {
      const overage = afterTotals[nutrient] - limit;
      return `Would exceed ${config.label.toLowerCase()} by ${formatValue(overage, config.unit)}`;
    }

    if (config.type === 'min' && strictMins && afterTotals[nutrient] < limit) {
      const shortfall = limit - afterTotals[nutrient];
      return `Would drop ${config.label.toLowerCase()} below minimum by ${formatValue(shortfall, config.unit)}`;
    }
  }

  const changed = Object.entries(NUTRIENTS).find(([nutrient]) => beforeTotals[nutrient] !== afterTotals[nutrient]);
  if (changed) {
    return `Invalid change for ${NUTRIENTS[changed[0]].label.toLowerCase()}.`;
  }

  return 'Invalid change.';
}

function formatValue(value, unit) {
  const rounded = unit === 'mg' ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded}${unit ? ` ${unit}` : ''}`.trim();
}

function toFixedDisplay(value, unit) {
  if (unit === 'mg' || unit === '') {
    return Math.round(value).toString();
  }
  return (Math.round(value * 10) / 10).toFixed(1).replace('.0', '');
}

function encodeStateToUrl(currentState) {
  const compactPortions = Object.fromEntries(
    Object.entries(currentState.portions).filter(([, portion]) => Number(portion) !== 0)
  );

  const payload = {
    r: currentState.selectedRestaurantId,
    c: currentState.constraints,
    p: compactPortions,
    m: currentState.strictMinEnforcement ? 1 : 0
  };

  const encoded = btoa(encodeURIComponent(JSON.stringify(payload)));
  location.hash = encoded;
}

function decodeStateFromUrl() {
  if (!location.hash || location.hash.length < 2) {
    return null;
  }

  try {
    const raw = location.hash.slice(1);
    const parsed = JSON.parse(decodeURIComponent(atob(raw)));
    return {
      selectedRestaurantId: parsed.r,
      constraints: parsed.c,
      portions: parsed.p,
      strictMinEnforcement: Boolean(parsed.m)
    };
  } catch (error) {
    console.warn('Could not parse share state:', error);
    return null;
  }
}

function setToastMessage(message) {
  elements.toastMessage.textContent = message;
  toast.show();
}

function updateStateFromConstraintInputs() {
  Object.keys(NUTRIENTS).forEach((nutrient) => {
    const input = document.getElementById(`constraint-${nutrient}`);
    if (!input) return;

    const parsed = Number(input.value);
    state.constraints[nutrient] = Number.isFinite(parsed) ? parsed : 0;
  });
}

function resetPortions() {
  const restaurant = getRestaurant();
  state.portions = {};
  flattenIngredients(restaurant).forEach((ingredient) => {
    state.portions[ingredient.id] = 0;
  });
}

function applyDecodedState(decoded) {
  if (!decoded) return;

  if (decoded.selectedRestaurantId && state.restaurants.some((r) => r.id === decoded.selectedRestaurantId)) {
    state.selectedRestaurantId = decoded.selectedRestaurantId;
  }

  Object.keys(DEFAULT_CONSTRAINTS).forEach((key) => {
    if (decoded.constraints && Number.isFinite(Number(decoded.constraints[key]))) {
      state.constraints[key] = Number(decoded.constraints[key]);
    }
  });

  state.strictMinEnforcement = Boolean(decoded.strictMinEnforcement);
  elements.strictMinsSwitch.checked = state.strictMinEnforcement;

  const restaurant = getRestaurant();
  const ingredientIds = new Set(flattenIngredients(restaurant).map((ingredient) => ingredient.id));
  resetPortions();

  if (decoded.portions) {
    Object.entries(decoded.portions).forEach(([ingredientId, portion]) => {
      const value = Number(portion);
      if (ingredientIds.has(ingredientId) && PORTION_OPTIONS.includes(value)) {
        state.portions[ingredientId] = value;
      }
    });
  }
}

function renderRestaurantSelect() {
  elements.restaurantSelect.innerHTML = state.restaurants
    .map((restaurant) => `<option value="${restaurant.id}">${restaurant.name}</option>`)
    .join('');
  elements.restaurantSelect.value = state.selectedRestaurantId;
}

function renderConstraints() {
  const html = Object.entries(NUTRIENTS)
    .map(([nutrient, config]) => {
      const label = `${config.type === 'max' ? 'Max' : 'Min'} ${config.label}${config.unit ? ` (${config.unit})` : ''}`;
      return `
        <div class="mb-2">
          <label for="constraint-${nutrient}" class="form-label small mb-1">${label}</label>
          <input
            id="constraint-${nutrient}"
            type="number"
            min="0"
            step="${config.unit === 'mg' || config.unit === '' ? '1' : '0.1'}"
            class="form-control form-control-sm constraint-input"
            value="${state.constraints[nutrient]}"
          />
        </div>
      `;
    })
    .join('');

  elements.constraintsForm.innerHTML = html;
}

function nutritionPreview(ingredient) {
  return `
    ${toFixedDisplay(ingredient.calories, '')} cal ·
    ${toFixedDisplay(ingredient.protein_g, 'g')}g protein ·
    ${toFixedDisplay(ingredient.fiber_g, 'g')}g fiber ·
    ${toFixedDisplay(ingredient.sodium_mg, 'mg')}mg sodium
  `;
}

function renderIngredients() {
  const restaurant = getRestaurant();
  const beforeTotals = computeTotals(state, restaurant);
  const categories = [...(restaurant.categories || [])].sort((a, b) => {
    const aIndex = CATEGORY_ORDER.indexOf(a.id);
    const bIndex = CATEGORY_ORDER.indexOf(b.id);
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
  });

  elements.ingredientsAccordion.innerHTML = categories
    .map((category, index) => {
      const categoryId = `cat-${category.id}`;
      const rows = category.ingredients
        .map((ingredient) => {
          const currentPortion = Number(state.portions[ingredient.id] ?? 0);
          const buttons = PORTION_OPTIONS.map((portion) => {
            const candidateState = {
              ...state,
              portions: { ...state.portions, [ingredient.id]: portion }
            };
            const afterTotals = computeTotals(candidateState, restaurant);
            const violates = wouldViolateConstraints(afterTotals, state.constraints, state.strictMinEnforcement);
            const isCurrent = portion === currentPortion;
            const mustAllow = portion === currentPortion;
            const disabled = violates && !mustAllow;
            const reason = disabled
              ? explainViolation(beforeTotals, afterTotals, state.constraints, state.strictMinEnforcement)
              : '';

            return {
              portion,
              isCurrent,
              disabled,
              reason
            };
          });

          const rowReason = buttons.find((button) => button.disabled)?.reason || '';

          return `
            <div class="p-3 ingredient-row" data-ingredient-id="${ingredient.id}">
              <div class="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-2">
                <div>
                  <div class="fw-medium">${ingredient.name}</div>
                  <div class="text-muted ingredient-meta">${nutritionPreview(ingredient)}</div>
                  <div class="text-danger violation-message">${rowReason}</div>
                </div>
                <div class="btn-group portion-group" role="group" aria-label="Portion for ${ingredient.name}">
                  ${buttons
                    .map(
                      (button) => `
                    <button
                      type="button"
                      class="btn btn-sm ${button.isCurrent ? 'btn-primary' : 'btn-outline-primary'}"
                      data-ingredient-id="${ingredient.id}"
                      data-portion="${button.portion}"
                      ${button.disabled ? 'disabled' : ''}
                      title="${button.disabled ? button.reason : ''}"
                    >${button.portion}x</button>
                  `
                    )
                    .join('')}
                </div>
              </div>
            </div>
          `;
        })
        .join('');

      return `
        <div class="accordion-item">
          <h2 class="accordion-header" id="heading-${categoryId}">
            <button
              class="accordion-button ${index === 0 ? '' : 'collapsed'}"
              type="button"
              data-bs-toggle="collapse"
              data-bs-target="#collapse-${categoryId}"
              aria-expanded="${index === 0 ? 'true' : 'false'}"
              aria-controls="collapse-${categoryId}"
            >
              ${category.label}
            </button>
          </h2>
          <div
            id="collapse-${categoryId}"
            class="accordion-collapse collapse ${index === 0 ? 'show' : ''}"
            aria-labelledby="heading-${categoryId}"
            data-bs-parent="#ingredientsAccordion"
          >
            <div class="p-3 border-bottom bg-body-tertiary d-flex justify-content-between align-items-center gap-2">
              <input type="search" class="form-control form-control-sm category-search" data-category-id="${category.id}" placeholder="Filter ${category.label.toLowerCase()}..." />
              <button class="btn btn-sm btn-outline-secondary clear-category-btn" data-category-id="${category.id}">Clear category</button>
            </div>
            <div data-category-list="${category.id}">${rows}</div>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderTotals() {
  const restaurant = getRestaurant();
  const totals = computeTotals(state, restaurant);

  const lines = Object.entries(NUTRIENTS)
    .map(([nutrient, config]) => {
      const limit = Number(state.constraints[nutrient]);
      const value = totals[nutrient];
      const statusPass = config.type === 'max' ? value <= limit : value >= limit;
      const statusIcon = statusPass ? '✅' : '⚠️';
      const statusClass = statusPass ? 'text-success' : 'text-danger';

      const remaining = config.type === 'max' ? limit - value : value - limit;
      const remainingLabel = config.type === 'max' ? 'Remaining to max' : 'Remaining to min';
      const remainingText =
        config.type === 'max'
          ? `${formatValue(Math.max(remaining, 0), config.unit)} left`
          : remaining >= 0
            ? `${formatValue(remaining, config.unit)} above min`
            : `${formatValue(Math.abs(remaining), config.unit)} needed`;

      return `
        <div class="d-flex justify-content-between align-items-start border-bottom py-2">
          <div>
            <div class="fw-medium">${config.label}</div>
            <div class="small text-muted">${remainingLabel}: ${remainingText}</div>
          </div>
          <div class="text-end">
            <div>${toFixedDisplay(value, config.unit)} ${config.unit}</div>
            <div class="small ${statusClass}">${statusIcon} ${statusPass ? 'Pass' : 'Fail'}</div>
          </div>
        </div>
      `;
    })
    .join('');

  elements.totalsPanel.innerHTML = lines;
}

function renderAll() {
  renderRestaurantSelect();
  renderConstraints();
  renderIngredients();
  renderTotals();
  encodeStateToUrl(state);
}

function handleIngredientClick(event) {
  const target = event.target.closest('button[data-ingredient-id][data-portion]');
  if (!target) return;

  const ingredientId = target.dataset.ingredientId;
  const portion = Number(target.dataset.portion);
  if (!PORTION_OPTIONS.includes(portion)) return;

  const restaurant = getRestaurant();
  const beforeTotals = computeTotals(state, restaurant);
  const nextState = {
    ...state,
    portions: {
      ...state.portions,
      [ingredientId]: portion
    }
  };
  const afterTotals = computeTotals(nextState, restaurant);

  if (wouldViolateConstraints(afterTotals, state.constraints, state.strictMinEnforcement)) {
    const message = explainViolation(beforeTotals, afterTotals, state.constraints, state.strictMinEnforcement);
    setToastMessage(message);
    return;
  }

  state.portions[ingredientId] = portion;
  renderIngredients();
  renderTotals();
  encodeStateToUrl(state);
}

function filterCategory(categoryId, query) {
  const list = document.querySelector(`[data-category-list="${categoryId}"]`);
  if (!list) return;

  const normalized = query.trim().toLowerCase();
  list.querySelectorAll('.ingredient-row').forEach((row) => {
    const name = row.querySelector('.fw-medium')?.textContent?.toLowerCase() || '';
    row.classList.toggle('d-none', normalized.length > 0 && !name.includes(normalized));
  });
}

function attachListeners() {
  elements.restaurantSelect.addEventListener('change', (event) => {
    state.selectedRestaurantId = event.target.value;
    resetPortions();
    renderAll();
  });

  elements.resetBowlBtn.addEventListener('click', () => {
    resetPortions();
    renderIngredients();
    renderTotals();
    encodeStateToUrl(state);
  });

  elements.copyShareBtn.addEventListener('click', async () => {
    encodeStateToUrl(state);
    try {
      await navigator.clipboard.writeText(location.href);
      setToastMessage('Share link copied.');
    } catch (error) {
      setToastMessage('Could not copy; link is in URL bar.');
    }
  });

  elements.applyDefaultsBtn.addEventListener('click', () => {
    state.constraints = { ...DEFAULT_CONSTRAINTS };
    renderAll();
  });

  elements.restoreDefaultsBtn.addEventListener('click', () => {
    state.constraints = { ...DEFAULT_CONSTRAINTS };
    state.strictMinEnforcement = false;
    elements.strictMinsSwitch.checked = false;
    renderAll();
  });

  elements.strictMinsSwitch.addEventListener('change', (event) => {
    state.strictMinEnforcement = event.target.checked;
    renderIngredients();
    renderTotals();
    encodeStateToUrl(state);
  });

  elements.constraintsForm.addEventListener('input', (event) => {
    if (!event.target.classList.contains('constraint-input')) return;
    updateStateFromConstraintInputs();
    renderIngredients();
    renderTotals();
    encodeStateToUrl(state);
  });

  elements.ingredientsAccordion.addEventListener('click', (event) => {
    if (event.target.closest('.clear-category-btn')) {
      const categoryId = event.target.closest('.clear-category-btn').dataset.categoryId;
      const restaurant = getRestaurant();
      const category = restaurant.categories.find((item) => item.id === categoryId);
      if (category) {
        const nextState = {
          ...state,
          portions: { ...state.portions }
        };
        category.ingredients.forEach((ingredient) => {
          nextState.portions[ingredient.id] = 0;
        });
        const totals = computeTotals(nextState, restaurant);
        if (wouldViolateConstraints(totals, state.constraints, state.strictMinEnforcement)) {
          setToastMessage('Cannot clear category under strict minimum constraints.');
          return;
        }
        state.portions = nextState.portions;
        renderIngredients();
        renderTotals();
        encodeStateToUrl(state);
      }
      return;
    }

    handleIngredientClick(event);
  });

  elements.ingredientsAccordion.addEventListener('input', (event) => {
    if (!event.target.classList.contains('category-search')) return;
    filterCategory(event.target.dataset.categoryId, event.target.value);
  });
}

async function init() {
  toast = new bootstrap.Toast(elements.appToast);
  const response = await fetch('./data/restaurants.json');
  const data = await response.json();

  state.restaurants = data.restaurants || [];
  if (!state.restaurants.length) {
    throw new Error('No restaurants found in data/restaurants.json');
  }

  state.selectedRestaurantId = state.restaurants[0].id;
  resetPortions();

  const decoded = decodeStateFromUrl();
  applyDecodedState(decoded);

  attachListeners();
  renderAll();
}

init().catch((error) => {
  console.error(error);
  alert('Failed to initialize Slop Bowl Calculator. Check console for details.');
});
