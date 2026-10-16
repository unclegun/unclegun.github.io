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
| `crosswordGenerator.js` | `CrosswordBoard` + `CrosswordGenerator`: scans all solved words/letters, scores & randomizes candidates |
| `gameEngine.js` | Rounds, attempts, scoring, precomputation, serialization (no DOM) |
| `random.js` | Seedable, restorable PRNG (reproducible tests and saves) |
| `storage.js` | Save/resume and high score |
| `renderer.js`, `input.js`, `main.js` | DOM rendering, pan/zoom, keyboard handling, wiring |

Precomputation: while the player guesses, `engine.precompute()` places the (known) target on a projected board and caches
candidates; they are revalidated before reveal, with on-demand generation as fallback.

## Extending
Swap the dictionary by passing any object with the same methods to `GameEngine`; replace `data/*.txt` to change the word lists.
Limitations: answer list is auto-curated, not hand-reviewed; no Web Worker (generation is fast enough in testing).
