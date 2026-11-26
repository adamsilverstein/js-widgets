# Speed Badge

A small "Loaded in 0.83s" badge for your footer. Clicking it opens a panel with the current page view's Largest Contentful Paint (LCP), Cumulative Layout Shift (CLS) and Interaction to Next Paint (INP), each rated good, needs improvement or poor. The numbers keep updating as the visitor scrolls, clicks and types.

```html
<script src="speed.min.js" data-metric="lcp"></script>
```

The badge renders where the snippet is pasted, so put it in the `<body>`, eg. in your footer. In `<head>` it renders nothing.

## Options

| Attribute | Default | Description |
| --- | --- | --- |
| `data-metric` | `lcp` | The metric shown on the badge: `lcp`, `cls` or `inp`. |
| `data-param` | none | Show the badge only when the page URL has this query parameter. With `data-param="speed"`, visit `/?speed` to see it. Everyone else gets nothing. |

## Thresholds

| Metric | Good | Needs improvement | Poor |
| --- | --- | --- | --- |
| LCP | 2.5s or less | up to 4s | over 4s |
| CLS | 0.1 or less | up to 0.25 | over 0.25 |
| INP | 200ms or less | up to 500ms | over 500ms |

## Browser support

Metrics a browser does not report are left out of the panel, never shown as zero. If the `data-metric` one is missing, the badge shows the first metric that is available, and if none are, the widget renders nothing.

Chromium browsers report all three. Recent Firefox and Safari releases report LCP and INP but not CLS, and older ones may report fewer. The widget asks the browser with `PerformanceObserver.supportedEntryTypes` rather than keeping its own list.

The panel is a popover. Where CSS anchor positioning is supported it opens next to the badge, and elsewhere it opens in the middle of the viewport.

## Notes

- **Accuracy.** The numbers are measured inline, with no dependency, and can differ slightly from Google's `web-vitals` library. INP here is the slowest interaction so far, which matches `web-vitals` until a page view passes 50 interactions. CLS uses the same session windows as `web-vitals`.
- **No layout shift.** Paste the snippet where the badge should appear rather than loading it `async`, so the badge is in place before the first paint. The number has a fixed minimum width, so the badge keeps its size as typical values update.
- **Display only.** Nothing is sent anywhere and no network requests are made.
- **Colors** follow the page's `color-scheme`.
- **Keyboard.** The badge is a real button. Enter or Space opens the panel, and Escape or a click elsewhere closes it.
