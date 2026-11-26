# Reading Progress

A thin bar across the top of the page fills as the reader moves through an article, and a small pill shows the minutes left. Useful on long posts, where readers like to know how much is left.

```html
<script src="progress.min.js" data-target="article" data-color="#f60"></script>
```

## Options

| Attribute | Default | Description |
| --- | --- | --- |
| `data-target` | `article` | CSS selector for the element to track. The first match is used. |
| `data-color` | `#f60` | Bar color, any CSS color. |
| `data-wpm` | `230` | Reading speed in words per minute, used for the time estimate. |
| `data-time` | `true` | Set to `false` to show only the bar. |

## Notes

- Progress follows the target element only. The bar is empty until the top of the article reaches the top of the window, and full once its end is in view, so comments and footers do not count.
- The bar runs on a CSS scroll-driven animation (a `ViewTimeline` on the target), so no JavaScript runs while the page scrolls. Browsers without scroll-driven animations get the same bar and pill, updated by a passive scroll listener.
- The time left is the target's word count divided by `data-wpm`, counting down in whole minutes. It is left out for articles under two minutes, and fades out near the end.
- Both the bar and the pill are hidden from assistive technology, since they repeat the scroll position.
- The pill sits in the bottom right corner of the window. It does not share the corner stack other floating widgets use, which keeps the widget under 1.5 KB.
- Nothing moves except in step with the reader's own scrolling, so there is no separate reduced motion mode.
- No network requests, no permissions.
