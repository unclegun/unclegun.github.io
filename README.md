# unclegun.github.io

Root homepage is the Stratastack site imported from `unclegun/stratastack-site`.

## Homepage source of truth

- Root homepage file: `/index.html`
- Imported Stratastack assets: `/stratastack/style.css` and `/stratastack/stratastack_logo.png`

## How to update Stratastack homepage

1. Pull latest from `https://github.com/unclegun/stratastack-site`.
2. Copy updated static files into this repo:
	- homepage markup into `/index.html`
	- static assets into `/stratastack/`
3. Normalize all references for root hosting on `unclegun.github.io`:
	- use root-relative paths (for example `/stratastack/style.css`)
	- remove repo/subpath assumptions such as `/stratastack-site/...`
4. Verify homepage has no links to legacy pages in this repository.