# Dictionary data

- `valid-guesses.txt` – 12.6k lowercase five-letter words accepted as guesses. Extracted (five-letter, a–z only) from the
  npm package [`an-array-of-english-words`](https://www.npmjs.com/package/an-array-of-english-words) v2.0.0 (MIT license).
- `answers.txt` – ~1.6k common words eligible as answers. Subset of the list above, selected by word frequency
  (Zipf ≥ 3.4, via the Python `wordfreq` package, used only for ranking; no frequency data is redistributed),
  with a hand-written blocklist of offensive/unsuitable words, most plural `-s` forms dropped, and proper names removed
  (checked against the Hunspell `en_US` dictionary).

The lists are generated offline and shipped as static text files; the game makes no runtime API calls.
Review `answers.txt` by hand if you want a stricter curation; removing a line is all that is needed.

## Answer filtering
`answer-exclusions.txt` records words removed from `answers.txt` after review (proper names, slang/contractions such as
`gonna`, brands, nationalities, crude or sensitive terms, obscure words). A test asserts none of them are in `answers.txt`.
`valid-guesses.txt` is left broad, so excluded words remain accepted as guesses. Licensing notes above are unchanged.

## Wildcard lists (4, 6, 7 letters)
`valid-guesses-{4,6,7}.txt` come from the npm package `an-array-of-english-words` (MIT). `answers-{4,6,7}.txt` are the subset with
Zipf frequency ≥ 4.0 (Python `wordfreq`, MIT/CC-BY-SA data), excluding plurals/-ed/-ies forms, a blocklist, and names/places;
`answer-exclusions-extra.txt` lists the extra removals. Static files; no runtime API calls.
