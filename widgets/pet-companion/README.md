# Pet Companion

A tiny pixel cat that lives along the bottom edge of the window. It wanders and sits, runs toward the pointer when it comes close, naps after 20 seconds without any activity on the page, and shows a heart when clicked.

```html
<script src="pet.min.js" data-pet="cat"></script>
```

## Options

| Attribute | Default | Description |
| --- | --- | --- |
| `data-pet` | `cat` | Reserved for more animals. Only the cat ships, and it shows whatever the value. |

## Notes

- The art is drawn in code on a 16 by 10 pixel canvas. There are no images and no network requests.
- Only the pet and its × button catch the pointer. Everything else on the page stays clickable, and the pet sits below other floating widgets.
- The × hides the pet for the rest of the browser session (`sessionStorage`).
- With `prefers-reduced-motion: reduce` the pet sits still in the bottom left corner.
- The pet is hidden from assistive technology. The × is a labelled button ("Hide the pet"), so keyboard users can reach it, and the pet holds still while it has focus.
- One pet per page. Pasting the snippet twice adds two.
