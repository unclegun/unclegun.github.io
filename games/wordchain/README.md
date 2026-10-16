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

## Additional modules
`gameModes.js` (mode config), `modeRules.js` (progression), `scoring.js` (weights + strategies), `challengeManager.js`, `resourceManager.js`, `menu.js`.
`crosswordGenerator.js` gained `analyzePlacement`/`findOptions`; `gameEngine.js` is shared by all modes.
Persistence: `wordchain.v2.*` keys per mode; legacy Classic v1 saves/best score are migrated. Wildcard word lists are in `data/` (see `data/README.md`).

## Limitations
Tests: `node --test` (unit/simulation). UI was only smoke-tested in headless Chromium, not exhaustively on real touch devices. 4/6/7-letter answer lists are auto-curated and may contain a few odd words.
