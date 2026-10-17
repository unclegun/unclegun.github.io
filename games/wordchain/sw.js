/* WordChain service worker. Scope is this folder only (games/wordchain/), so it never touches the parent site.
 * Strategy: precache the app shell, scripts and word lists; serve cache-first with a network fallback.
 * Updates: bump VERSION when assets change. The new worker installs in the background and WAITS (no skipWaiting),
 * so a game in progress never mixes old and new modules; it takes over the next time the game is opened.
 * Only caches prefixed "wordchain-" are ever deleted. */
const VERSION = '2.1.0';
const CACHE = `wordchain-${VERSION}`;
const PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'data/answer-exclusions-extra.txt',
  'data/answer-exclusions.txt',
  'data/answers-4.txt',
  'data/answers-6.txt',
  'data/answers-7.txt',
  'data/answers.txt',
  'data/valid-guesses-4.txt',
  'data/valid-guesses-6.txt',
  'data/valid-guesses-7.txt',
  'data/valid-guesses.txt',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/icon.svg',
  'js/anarchy/anarchyDirector.js',
  'js/anarchy/anarchyGame.js',
  'js/anarchy/anarchyScoring.js',
  'js/anarchy/anarchyState.js',
  'js/anarchy/arcadeEconomy.js',
  'js/anarchy/audioDirector.js',
  'js/anarchy/chaosMeter.js',
  'js/anarchy/consequences.js',
  'js/anarchy/encounterManager.js',
  'js/anarchy/eventRegistry.js',
  'js/anarchy/eventRules.js',
  'js/anarchy/modifierRegistry.js',
  'js/anarchy/playtestMetrics.js',
  'js/anarchy/puzzles/chainReaction.js',
  'js/anarchy/puzzles/forge.js',
  'js/anarchy/puzzles/gravity.js',
  'js/anarchy/puzzles/index.js',
  'js/anarchy/puzzles/infection.js',
  'js/anarchy/puzzles/letterCollapse.js',
  'js/anarchy/puzzles/letterStorm.js',
  'js/anarchy/puzzles/memory.js',
  'js/anarchy/puzzles/reverseWordle.js',
  'js/anarchy/puzzles/sliding.js',
  'js/anarchy/puzzles/sudoku.js',
  'js/anarchy/puzzles/tileRepair.js',
  'js/anarchy/themeDirector.js',
  'js/anarchy/ui/anarchyChrome.js',
  'js/anarchy/ui/anarchyUI.js',
  'js/anarchy/ui/dom.js',
  'js/anarchy/ui/effects.js',
  'js/anarchy/ui/puzzleViews.js',
  'js/challengeManager.js',
  'js/crosswordGenerator.js',
  'js/dictionaryService.js',
  'js/difficulty.js',
  'js/gameEngine.js',
  'js/gameModes.js',
  'js/input.js',
  'js/main.js',
  'js/menu.js',
  'js/modeRules.js',
  'js/placementValidator.js',
  'js/random.js',
  'js/renderer.js',
  'js/resourceManager.js',
  'js/saveValidator.js',
  'js/scoring.js',
  'js/share.js',
  'js/storage.js',
  'js/wordleEvaluator.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('wordchain-') && k !== CACHE).map((k) => caches.delete(k)))),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting(); // only on an explicit request from the page
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(new URL('./', self.location).pathname)) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))),
  );
});
