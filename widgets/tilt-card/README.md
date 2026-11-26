# Tilt Card

Tilts any element toward the pointer, with a holographic shine that slides across it as the angle changes. Good for profile cards, product shots and badges.

```html
<script src="tilt.min.js" data-target=".card" data-max="15" data-shine="holo"></script>
```

## Options

| Attribute | Default | Description |
| --- | --- | --- |
| `data-target` | `.tilt` | CSS selector for the elements to tilt. Every match tilts on its own. |
| `data-max` | `15` | Largest tilt in degrees. |
| `data-shine` | `holo` | `holo` for a rainbow foil sheen, `gloss` for a plain white highlight, or `none` for the tilt alone. |

## Notes

- **Layout.** The tilt is a CSS transform, so the element keeps its size and place. A transform the page already gives the element is kept and applied after the tilt. The shine is an empty, absolutely positioned `<jsw-tilt-shine>` element appended inside the card. To position it, a card with `position: static` is switched to `position: relative`.
- **Content stays usable.** The shine ignores the pointer, so links, buttons and text selection inside the card work as usual.
- **Touch.** On touch screens the cards follow the device's orientation instead of a finger, so scrolling past a card does not tilt it. iOS only sends orientation data after a permission request made from a tap, and this widget never asks, so on iPhone and iPad the cards stay still.
- **Keyboard.** When focus moves into a card, it tilts slightly and shines, so keyboard users get the effect too.
- **Reduced motion.** With `prefers-reduced-motion: reduce` there is no tilt and no shine. Turning the setting on while the page is open stops the effect at once.
- Cards are found once, when the page has loaded. Cards added later are not enhanced.
- No network requests, no permission prompts.
