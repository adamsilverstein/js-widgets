# Listen to This Page

Adds a small player above an article that reads it aloud with the browser's own voices. The sentence being spoken is highlighted and kept in view. No text-to-speech service, no account, no network requests.

```html
<script src="listen.min.js" data-target="article" data-rate="1"></script>
```

## Options

| Attribute | Default | Description |
| --- | --- | --- |
| `data-target` | `article` | CSS selector for the element to read. The player is inserted just before it. |
| `data-rate` | `1` | Starting speed, from `0.5` to `2`. Visitors can change it. |
| `data-skip` | | Extra CSS selector for content not to read, eg. `.ad, .footnotes`. |

## Controls

- **Listen / Pause / Resume** starts, pauses and continues reading.
- **Previous** and **Next** move one sentence back or forward.
- **Speed** changes the rate. The current sentence restarts at the new speed.
- Once reading has started, clicking a sentence in the article reads from there.

All controls are buttons and a select, so they work from the keyboard. The player sticks to the top of the viewport while the article scrolls, so Pause stays in reach.

## What is read

Text inside the target, in document order, one sentence at a time. These are skipped:

- `nav`, `aside`, `pre`, `figure` (and its caption), `sup` (footnote markers), form controls, `svg` and `aria-hidden="true"` content.
- Anything not rendered: `hidden`, `display: none` and similar.
- Whatever matches `data-skip`.

Inline `code` inside a sentence is read, since the sentence makes no sense without it.

## Notes

- **Voices** come from the visitor's device and vary a lot in quality. The widget uses the voice that best matches the target's `lang` (or the page's), preferring an exact match such as `en-GB` over another `en` voice, and the device's default voice among equals.
- **Hidden when it cannot work.** Nothing renders without `speechSynthesis`, and the player stays hidden until the browser reports at least one voice.
- **Highlighting** uses the CSS Custom Highlight API, so the article markup is never changed. Browsers without it still read aloud, without the highlight.
- **Sentences** are split with `Intl.Segmenter`. Where it is missing, each paragraph is read as one piece.
- **Leaving the page** stops speech.
- The player follows the page theme: `data-theme="light|dark"` on `<html>`, or the page's `color-scheme`.
- Scrolling to the current sentence is instant when the visitor prefers reduced motion.
