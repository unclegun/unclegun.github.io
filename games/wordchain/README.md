# WordChain

An endless Wordle-style game: every solved word joins a crossword that grows dynamically. The next word always crosses
a previously solved word, and shared letters are pre-filled and locked. Pure static HTML/CSS/vanilla ES modules; no build step,
no network access needed after the files load.

Live (GitHub Pages): `https://unclegun.github.io/games/wordchain/`

## Play
Guess the highlighted word in 6 tries (physical or on-screen keyboard). Green = right spot, yellow = elsewhere, gray = absent.
Score = 100 per word + 10 per unused attempt. The run ends when attempts run out, or successfully if no placement remains.
Drag to pan, wheel/pinch/`+`/`−` to zoom, `◎` to re-focus the active word. Progress auto-saves; best score is stored in `localStorage`.

## Run / test
```sh
# from the repo root (ES modules and fetch need HTTP, not file://)
python3 -m http.server 8000   # open http://localhost:8000/games/wordchain/
cd games/wordchain && node --test   # Node 18+, no dependencies
```

## Architecture (`js/`)
| Module | Role |
| --- | --- |
| `wordleEvaluator.js` | Green/yellow/gray scoring with duplicate-letter handling |
| `dictionaryService.js` | Replaceable provider (`isValidGuess`, `wordsWith(pos, letter)`, `randomAnswer`); position/letter index; static file loader |
| `placementValidator.js` | Crossword rules on a sparse `(x, y)` board: conflicts, overlap, adjacency, crossings |
| `crosswordGenerator.js` | `CrosswordBoard` + `CrosswordGenerator`: bounded candidate pool sampled across *all* solved words/intersections (validation budget caps cost), scored with configurable `DEFAULT_WEIGHTS` (placement jitter, crossing preference, diversity, compactness), then a diversity-aware pick across anchors/board regions |
| `difficulty.js` | Soft crossing preferences by word number (1: none, 2–5: one, 6–15: one–two, 16+: one–three) |
| `saveValidator.js` | Replays and sanity-checks saves; malformed/outdated saves start a fresh run |
| `share.js` | End-of-run SVG crossword, share text, Web Share → clipboard → download fallback (independent of the engine) |
| `gameEngine.js` | Rounds, attempts, scoring, precomputation, serialization (no DOM) |
| `random.js` | Seedable, restorable PRNG (reproducible tests and saves) |
| `storage.js` | Save/resume and high score |
| `renderer.js`, `input.js`, `main.js` | DOM rendering, pan/zoom, keyboard handling, wiring |

Precomputation: while the player guesses, `engine.precompute()` places the (known) target on a projected board and caches
candidates; they are revalidated before reveal, with on-demand generation as fallback.

## Refinements
- **Resume**: saves are validated; a save taken during the solved transition resumes at the next word. The in-progress
  draft letters are saved too. Restart bumps a run token so stale animations cannot touch a new game.
- **Growth animation**: Wordle flip → solved word joins board → zoom out to whole crossword with highlight on the new word and
  intersections → next word revealed and focused. Input is blocked only during this (~1.5 s); `prefers-reduced-motion` makes it immediate.
- **Answers**: `data/answer-exclusions.txt` lists names, slang and sensitive words removed from `answers.txt` (see `data/README.md`).
- **Sharing**: the end dialog offers Share (Web Share with the SVG when supported, else copies text, else downloads) and Save image.

## Manual browser verification still needed
Loading overlay gone on desktop/mobile, animation feel, touch pan/pinch, safe-area insets, Web Share on mobile.

## Extending
Swap the dictionary by passing any object with the same methods to `GameEngine`; replace `data/*.txt` to change the word lists.
Limitations: answer list is auto-curated plus a hand-written exclusion list, not fully hand-reviewed; no Web Worker (generation is fast enough in testing).

## Game modes
The menu opens on start (`menu.js`); each mode has its own saved run and best score, and "Menu" is available in-game.
| Mode | Summary |
| --- | --- |
| Classic | The original: 5 letters, 6 tries, automatic placements, original scoring. No tokens/objectives. |
| Builder | After each word choose 2–3 placements (Expand = 1 crossing, Connect = 2, Junction = 3+ or joining branches). Targets stay hidden; fewer known letters score more. Tokens enabled. |
| Architect | Builder's selection, scored on structure: crossings, junctions, compactness, with a penalty for linear sprawl. |
| Challenge | Automatic placements plus one active objective at a time (streaks, junctions, orientations, score targets…) that is only offered if achievable. Rewards are score + tokens. |
| Wildcard | 4–7 letter words (lengths introduced gradually), dynamic guess grid, crossings between different lengths. Still 6 tries. |

Tokens (Builder/Architect/Challenge/Wildcard only): Hint (reveal and lock one unknown letter), Reroll (swap an unstarted option; only charged on success),
Extra Try (capped). Costs, caps and earning rules live in `TOKEN_ECONOMY` (`gameModes.js`); rewards are keyed so they cannot be re-claimed.

## Anarchy (sixth mode)
*Every word changes the game.* Separate saved run, best score and stats (`wordchain.v2.anarchy*`); the five modes above are untouched (Anarchy hooks into the shared engine only via small opt-in config).

- **Loop:** solve → score + coins → a seeded **AnarchyDirector** picks the next event (weighted, with cooldowns, minimum rounds, pacing: normal / minor / major / rare, incompatibility checks, guaranteed fallback) → an event card announces it → optional shop/detours → play. Lifecycle: eligible → selected → announced → active → resolved → rewarded → cleaned up.
- **Modifiers:** Pressure Cooker (attempts shrink with inherited letters, never below a fair viable-answer floor), Shared Guess Pool, Bet Your Guesses, Jackpot, Mutating Rules, Blackout (display only), Wildcard Round (4-7 letters), Reverse Wordle (deduce the answer from clues).
- **Board events (on a temporary copy, canonical crossword never mutated):** Letter Collapse (anagram tray; drag, tap or keyboard), Wordquake, Gravity Shift, Letter Storm, Word Infection, Chain Reaction, Double Trouble, Rule Roulette.
- **Encounters:** Boss Word (staged health bar), Risk/Reward choice, Heist (alarm meter, bank or push on), Survival (stability meter).
- **Economy:** Score (never spent) and Coins (per run). Shop: Extra Guess, Reveal Letter, Mistake Shield, Rule Reroll, Wildcard Tile, Stabilizer, Double Coins; costs/caps in `arcadeEconomy.js`, charged only on success, rewards idempotent.
- **Puzzle Detours (optional, reward-capped per round):** Mini Sudoku (4x4), Sliding Letter Puzzle (scrambled from solved state, always solvable), Memory Match. Registry in `js/anarchy/puzzles/index.js`.
- **Layout:** `js/anarchy/` (DOM-free rules: director, state, modifiers, events, economy, scoring, encounters, `anarchyGame.js` orchestrator), `puzzles/` (pure models), `ui/` (dialogs, puzzle views, effects). Quiet monochrome UI; colour/motion only for events; honours `prefers-reduced-motion`.
- **Tests:** `tests/anarchy.test.js` covers director determinism/cooldowns, modifiers, economy, puzzles, all events/encounters, save/resume, restart, corrupt saves and long simulated runs.
- **Not verified:** touch drag-and-drop and Letter Storm timing on real devices; a scripted headless-Chromium run exercised the menu, HUD, announce cards, collapse/quake/gravity/roulette/reverse dialogs with no page errors, but not every event/mini-game visually. Letter Storm is wall-clock and resumes in a calm mode.

## Additional modules
`gameModes.js` (mode config), `modeRules.js` (progression), `scoring.js` (weights + strategies), `challengeManager.js`, `resourceManager.js`, `menu.js`.
`crosswordGenerator.js` gained `analyzePlacement`/`findOptions`; `gameEngine.js` is shared by all modes.
Persistence: `wordchain.v2.*` keys per mode; legacy Classic v1 saves/best score are migrated. Wildcard word lists are in `data/` (see `data/README.md`).

## Limitations
Tests: `node --test` (unit/simulation). UI was only smoke-tested in headless Chromium, not exhaustively on real touch devices. 4/6/7-letter answer lists are auto-curated and may contain a few odd words.

## Anarchy 2.0 additions

Anarchy-only (Classic, Builder, Architect, Challenge and Wildcard are untouched):

- **HUD**: Shop, Detours and Shield buttons are wired in `js/anarchy/ui/anarchyUI.js` (bound once). Inventory chips show held items; the shop separates *Use now* and *Buy for later* items and states why an item is unavailable.
- **Chaos Meter** (`chaosMeter.js`): solving words fills it; a full meter (or 4 words without a major event) forces a major event, and long plain streaks force a minor modifier. All numbers live in `CHAOS`. *Chaos Catalyst* / *Chaos Brake* in the shop raise / drain it.
- **Themes** (`themeDirector.js`): the palette is a pure function of `(themeSeed, solved words)`, so it changes after every solved word, never repeats back-to-back and restores on resume. Only decorative `--an-*` variables are set; Wordle feedback colours are never overridden.
- **Music** (`audioDirector.js`): optional procedural jazz via Web Audio. Off by default, starts only from the *Enable music* click, one scheduler, bar-boundary variation per solved word, suspends when the tab is hidden, stops when leaving Anarchy. Preferences: `wordchain.anarchy.audio`.
- **Local metrics** (`playtestMetrics.js`): counters stored locally (`wordchain.anarchy.metrics.v1`); the **Stats** button downloads them as JSON. Nothing is uploaded.

Tests: `npm test` (includes `tests/browser.test.js`, which drives the HUD in headless Chromium when installed, otherwise skipped).

## WordChain 2.1 (partial delivery)

Done and tested (`tests/forge.test.js`, `tests/pwa.test.js`):

- **Letter Forge** (`js/anarchy/puzzles/forge.js`) replaces Letter Collapse in the event pool. The solved word's tiles drop into a tray and the player must forge a *different* valid word: **anagram**, **letter swap** (exchange one tile with a spare), or **missing ingredient** (supply the tile with a Wildcard Tile or 2 coins). Targets come from bounded, deterministic dictionary searches; if no fair distinct variant exists the event is not offered. Different intended solutions pay different next-round benefits. Only temporary state changes; the crossword is never touched. Letter Collapse remains only so older saves load.
- **Event Consequence Manager** (`js/anarchy/consequences.js`): carried-over effects (`startHint`, `freeGuess`, `shield`, `solveBonus`) with expiry (3 rounds), a cap of 3, one effect per type, no re-adding the same effect id, saved/restored with the run, shown as chips in the Anarchy HUD, applied at the start of the next round or consumed by the next solved word.
- **First-time help** no longer opens over the mode menu; it appears once when the first game starts.
- **PWA foundation**: `manifest.webmanifest`, icons, and `sw.js` (scope is this folder only, cache-first, versioned `wordchain-<VERSION>` caches, no automatic `skipWaiting`, so a game in progress is not swapped to new code). Bump `VERSION` in `sw.js` when assets change; `tests/pwa.test.js` checks the precache list matches the files. Offline use has **not** been verified in a real browser yet.
- `docs/mobile-release-plan.md`: path to App Store / Google Play.

Not done in this iteration (documented, not claimed): board-integrated tile-overlay animations for Wordquake/Gravity/Storm/Chain/Infection/Blackout, new action-changing modifiers (Letter Scramble, Dual Word, etc.), director pacing tiers and diversity metrics, theme cross-fade and jazz arrangement refinements, full mobile layout and accessibility audit, diagnostics separation, and real-browser tests for audio/PWA/persistence.

## WordChain 2.2 reliability stage

- Anarchy's normal Wordle and Reverse Wordle solves now share the same completion-effects path. UI-side completion effects are claimed once per solved word and the marker is saved with the run; older Anarchy saves migrate with an empty marker.
- Reverse Wordle success uses the crossword-growth animation before the next event or round is opened.
- The existing shop catalog has regression coverage for every configured price, successful deduction, failed-purchase accounting, and the existing activation, inventory, and HUD flows.
- `.github/workflows/wordchain.yml` runs `npm test` with Node.js 22 and headless Chromium for pull requests that change WordChain or its workflow. The suite checks the JavaScript module import graph, PWA manifest and service-worker precache assets, and browser HUD/shop/Reverse Wordle integration. The test step adds a test summary, including explicit browser-skip reporting, to the Actions run summary.

To make the workflow a required merge check, configure a branch protection rule or repository ruleset for `main` and require **WordChain CI / Test and browser smoke**. This repository does not configure or assert that merge protection is enabled.

This is a reliability-focused partial 2.2 delivery, not the full arcade expansion. Timed encounters, Gems, achievements, cosmetic packs/Style Shop, crossword-overlay event animations, expanded event consequences, and real-device/offline PWA verification remain deferred and are not presented as available features. Run the suite with `cd games/wordchain && npm test`; without a local Chromium binary the browser test reports itself as skipped.
