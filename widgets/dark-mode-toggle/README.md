# Dark Mode Toggle

A sun and moon button that switches your site between light and dark. The first visit follows the visitor's system setting, the choice is remembered across page loads and tabs, and the new theme spreads out in a circle from the button.

```html
<script src="theme.min.js" data-position="top-right"></script>
```

Paste it in `<head>`, not the body. It sets the theme before the page paints, so visitors who chose dark never see a flash of light.

## Options

| Attribute | Default | Description |
| --- | --- | --- |
| `data-position` | `top-right` | Corner for the button: `top-left`, `top-right`, `bottom-left` or `bottom-right`. |

## Styling your site

The widget sets two things on `<html>`:

- `data-theme="light"` or `data-theme="dark"`. Hook your dark styles into it:

  ```css
  :root { --bg: #fff; --text: #111; }
  [data-theme="dark"] { --bg: #111; --text: #eee; }
  ```

- The `color-scheme` property. Sites that use `light-dark()`, system colors such as `Canvas`, or browser default colors get a dark theme from this alone. Form controls and scrollbars follow it too.

Styles written only with `@media (prefers-color-scheme: dark)` follow the system, not the button. Move them under `[data-theme="dark"]`.

The widget does not invent dark colors for a site that has none.

## Notes

- Choosing the theme your system already uses clears the stored choice, so the page goes back to following the system. A stored choice is kept when the system later changes.
- The choice is saved in `localStorage` under `jsw-theme`. If storage is blocked, the toggle still works for the current page.
- The circular reveal uses the View Transitions API. Browsers without it, and visitors who prefer reduced motion, get an instant switch.
- The button is a real `<button>` labelled "Dark mode", with `aria-pressed` showing whether dark is on.
- Other widgets can follow the theme by reading `data-theme` on `<html>`.
- No network requests.
