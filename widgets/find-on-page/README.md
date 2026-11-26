# Find on Page

A small search box that floats in a corner of the page and highlights every match in your content as the visitor types. It shows "3 of 7", and Enter or the arrow buttons step through the matches. Useful on long documentation pages, FAQs and recipes, where the browser's own find is buried in a menu on phones and also searches navigation and footers.

```html
<script src="find.min.js" data-target="main" data-hotkey="/"></script>
```

## Options

| Attribute | Default | Description |
| --- | --- | --- |
| `data-target` | `main` | CSS selector for the element to search. Falls back to `<body>` when nothing matches. |
| `data-position` | `top-right` | Corner the box floats in: `top-left`, `top-right`, `bottom-left` or `bottom-right`. |
| `data-hotkey` | none | A single key that moves focus to the box, eg. `/`. It is ignored while the visitor is typing in a field, and when Ctrl, Alt or Cmd is held. |

## Keyboard

| Key | Action |
| --- | --- |
| Enter | Next match |
| Shift+Enter | Previous match |
| Escape | Clear the search |

## Notes

- Matches are painted with the [CSS Custom Highlight API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API), so no `<mark>` elements are added and the page's own scripts see the same DOM as before. The one change it makes is opening a closed `<details>` element when the visitor steps to a match inside it.
- Matching is case insensitive and literal: no fuzzy matching or regular expressions. A match can span inline elements, eg. a phrase that is half in bold.
- Text hidden with CSS or the `hidden` attribute is left out of the count.
- The match count is in a status region, so screen readers announce it.
- The active match is scrolled into view in the window. Scrolling is instant when the visitor prefers reduced motion. Matches inside a separately scrolling box are not scrolled to.
- Highlight colors are fixed: yellow for matches, orange for the active one, both with black text so they read on light and dark pages. The box follows `data-theme` on `<html>`, or the system color scheme.
- Supported in all current browsers. In a browser without the Highlight API the widget renders nothing.
- No network requests.
