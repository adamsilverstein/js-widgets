# Adding a widget

Copy `widgets/_template` to `widgets/<your-slug>` and edit the files. The build picks the directory up on its own: there is no list to add it to.

| File | Purpose |
| --- | --- |
| `widget.js` | The widget source. Plain JavaScript, may import from `shared/`. |
| `widget.json` | Name, category, snippet and size budget. Drives the gallery card and the README list. |
| `demo.html` | The live demo shown in the gallery. |
| `README.md` | Options and notes for site owners. |
| `*.test.mjs` | Optional behavior tests, run in headless Chromium. |
| `assets/` | Optional files the demo needs (eg. a video). Copied next to the built demo page. |

Run `npm run dev -- --template` to see the template itself in the gallery.

## widget.json

```json
{
	"name": "Googly Eyes",
	"description": "A pair of eyes that follows the visitor around the page.",
	"category": "fun",
	"file": "eyes",
	"issue": 1,
	"snippet": "<script src=\"eyes.min.js\" data-size=\"64\"></script>",
	"maxBytes": 2048,
	"demoHeight": 240,
	"requires": "Chrome 138 or later on desktop"
}
```

- `category` is one of `fun`, `reading`, `utility` or `ai`. Categories are defined at the top of `scripts/build.mjs`.
- `file` names the built file: `eyes` builds `eyes.min.js`.
- `snippet` is the script tag users paste, written with the bare file name. The gallery swaps in the hosted URL.
- `maxBytes` (optional) fails the build when the minified file grows past it.
- `demoHeight` (optional) is the height of the demo iframe in pixels. Default 280.
- `requires` (optional) is shown on the card for widgets that need a particular browser.

## demo.html

Write the demo as a body fragment, with the script tag exactly as a user would paste it. The build wraps it in a plain page. A demo that needs its script in `<head>` can be a full document instead, starting with `<!doctype html>`.

`<!-- demo:article -->` is replaced with a sample article of about 500 words inside an `<article>` element, for widgets that work on page content.

The demo runs inside an iframe in the gallery, so a widget fixed to a corner shows in the corner of its own card.

## Conventions

These keep the widgets consistent, and settle the questions the first issues left open.

- **One script tag, configured with `data-` attributes.** Read them with `options()` from `shared/embed.js`. The same tag works with a `src` or with the code inline.
- **Shadow DOM for anything the widget renders**, so styles do not leak either way. `mountInline()` renders where the snippet was pasted (so that snippet belongs in `<body>`, not `<head>`), and `mountCorner()` renders a floating widget in a viewport corner. Widgets that share a corner stack instead of overlapping.
- **`data-target` is a CSS selector** for widgets that enhance markup already on the page. Wait for `ready()` before querying it. The page must keep working if the widget never loads.
- **`data-position`** places a floating widget: `top-left`, `top-right`, `bottom-left` or `bottom-right`.
- **Events are prefixed `jsw:`**, eg. `jsw:confetti`, and dispatched on or listened for on `window`.
- **The page theme is `data-theme="light|dark"` on `<html>`**, set by the dark mode toggle. Widgets that want to follow it read that attribute, and fall back to `prefers-color-scheme`.
- **No dependencies and no globals.** The build wraps each widget in an IIFE. Code under `shared/` is bundled into each widget that imports it, and only the functions used.
- **No network requests** unless the widget's purpose needs one. Say so in its README when it does.
- **Respect `prefers-reduced-motion`**, with `reducedMotion()`.
- **Accessible by default**: real buttons and links, keyboard operable, labelled, and decoration hidden from assistive technology.
- **On-device AI widgets** check `availability()` from `shared/ai.js` and render nothing when the API is missing. A model download starts only after a click and shows progress.
- **Never trigger a permission prompt on load.**

## Size

The build prints each widget's minified and gzipped size. CSS inside template strings is not minified, so keep it compact when a budget is tight.

## Tests

`npm test` builds everything, then loads each demo in headless Chromium and fails on an uncaught error or a missing file. Add behavior tests next to the widget:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDemo } from '../../test/harness.mjs';

test( 'blinks on click', async () => {
	const { page, close } = await openDemo( 'googly-eyes' );
	// ...
	await close();
} );
```

`openDemo( slug, contextOptions )` takes Playwright context options, eg. `{ reducedMotion: 'reduce' }` or `{ hasTouch: true }`. A third argument, `setup( page )`, runs before the page loads. Use it to mock what headless Chromium lacks or a test should not depend on: a built-in AI API with `page.addInitScript()`, or a network request with `page.route()`.

Do not assume a built-in AI API is missing in headless Chromium: recent builds expose `LanguageModel`. A test for the unavailable case should delete the global in `page.addInitScript()`, and every other AI test should mock it.

## Publishing

Merging to `main` runs the `Publish gallery` workflow. It builds the site, deploys it to GitHub Pages, and rewrites the widget list in the README. Do not edit that list by hand or in a pull request.
