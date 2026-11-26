# Confetti Cannon

A burst of confetti when a visitor clicks "Subscribe", "Order placed" or "Donate", or whenever your own code decides a moment deserves one.

```html
<script src="confetti.min.js" data-trigger=".celebrate" data-colors="#f60,#09f,#fc0"></script>
```

## Options

| Attribute | Default | Description |
| --- | --- | --- |
| `data-trigger` | none | CSS selector for the elements that fire confetti when clicked. The burst starts from the center of the clicked element. |
| `data-colors` | `#f60,#09f,#fc0,#e3c,#3c6` | Comma separated CSS colors for the pieces. |

## Firing from code

Dispatch a `jsw:confetti` event on `window` and a burst fires from the bottom center of the screen:

```js
window.dispatchEvent( new CustomEvent( 'jsw:confetti' ) );
```

This is the way to celebrate a form that submits in the background: fire the event once the request succeeds. A form that reloads the page on submit would hide the confetti anyway.

## Notes

- The confetti is drawn on one full page canvas that ignores the pointer, so it never blocks a click. The canvas is added when a burst starts and removed when the last piece falls off screen, after about two to three seconds.
- Rapid repeat clicks add to the same animation, and the oldest pieces are dropped past a few hundred, so mashing the button does not slow the page down.
- With `prefers-reduced-motion: reduce` the widget does nothing.
- Keyboard and touch activation work the same as a mouse click, since the burst starts from the element, not the pointer.
- The canvas is hidden from assistive technology. If the moment matters, announce it in the page too, eg. a "Thanks for subscribing" message.
- No network requests.
