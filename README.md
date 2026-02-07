# Slop Bowl Calculator

Slop Bowl Calculator is a static, single-page nutrition guardrail tool for customizable bowl restaurants. It runs fully client-side with Bootstrap 5 + vanilla JavaScript and is compatible with GitHub Pages.

## Features

- Choose between multiple restaurant datasets from `data/restaurants.json`.
- Edit per-bowl constraints with sensible defaults:
  - Max calories: 700
  - Max total fat: 20g
  - Max saturated fat: 5g
  - Max cholesterol: 100mg
  - Max sodium: 700mg
  - Max sugar: 12g
  - Min fiber: 10g
  - Min protein: 20g
- Build a bowl using portion multipliers: `0`, `0.5`, `1`, `2`.
- Real-time totals and pass/fail statuses for every nutrient.
- Hard guardrails:
  - Portion choices that exceed any max are disabled.
  - Optional strict min enforcement mode blocks any selection that drops below min fiber/protein.
- Feasibility explanations shown inline and via button tooltips/toasts.
- Quality-of-life:
  - Clear category button
  - Category ingredient search filter
  - Reset bowl
  - Apply/restore default constraints
  - Copy share link (URL hash encoded)
- Share links restore restaurant, constraints, strict-min toggle, and selected portions.

## Project structure

- `index.html` - App shell and Bootstrap layout
- `styles.css` - Minor styling and responsive behavior
- `app.js` - State management, rendering, constraint logic, URL sharing
- `data/restaurants.json` - Restaurant and ingredient nutrition dataset

## Run locally

No build tool is required.

1. Open `index.html` directly in a browser **or** serve the folder with a static server.
2. If your browser blocks local `fetch` calls for `data/restaurants.json` via `file://`, run a local static server (for example `python3 -m http.server`) and open that URL.

## GitHub Pages deployment

1. Push this repository to GitHub.
2. In GitHub: **Settings → Pages**.
3. Under **Build and deployment**, choose:
   - **Source**: `Deploy from a branch`
   - **Branch**: your default branch (for example `main`) and root folder `/`.
4. Save settings. GitHub Pages will publish `index.html` from the repository root.

## Implementation notes

- Single source of truth state object includes:
  - `selectedRestaurantId`
  - `constraints`
  - `portions`
  - `strictMinEnforcement`
- Key helper functions:
  - `computeTotals(state, restaurant)`
  - `wouldViolateConstraints(totals, constraints)`
  - `explainViolation(beforeTotals, afterTotals, constraints)`
  - `encodeStateToUrl(state)`
  - `decodeStateFromUrl()`
- URL hash stores compact base64-encoded JSON state for copy/share and restore on load.

