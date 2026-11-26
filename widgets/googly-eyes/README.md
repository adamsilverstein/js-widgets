# Googly Eyes

A pair of eyes that watches the visitor. Good for a 404 page, an about page or a footer that could use some personality.

```html
<script src="eyes.min.js" data-size="64" data-color="#222"></script>
```

The eyes render where the snippet is pasted.

## Behavior

- The pupils follow the mouse, pen or finger anywhere in the page. On touch screens they look at the last touch point.
- They blink every few seconds, and glance around on their own after a few idle seconds.
- They go wide for a moment on any click or tap.

## Options

| Attribute | Default | Description |
| --- | --- | --- |
| `data-size` | `64` | Diameter of each eye in pixels. |
| `data-color` | `#222` | Pupil and outline color. Any CSS color. |

## Notes

- With `prefers-reduced-motion: reduce`, the eyes do not blink or wander, and the pupils jump to the pointer instead of sliding. They still follow the pointer.
- The eyes are decorative and hidden from assistive technology.
- Rendered in a shadow root, so page styles do not change the eyes and the eyes' styles do not touch the page.
- No network requests, no dependencies and no globals. About 1.9 KB minified.
- Inside an iframe, the eyes only see the pointer while it is over that frame.
- One pair per snippet. Paste the snippet again for another pair.
