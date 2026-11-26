# Tag Cloud Sphere

Turns a list of links already on the page, such as the WordPress Tag Cloud block, into a slowly rotating 3D globe. Visitors can drag it to spin it, and every tag stays a real link.

```html
<script src="sphere.min.js" data-target=".wp-block-tag-cloud" data-radius="140"></script>
```

Place the snippet anywhere after the tag cloud, or in `<head>`: the widget waits for the page to finish parsing.

## Options

| Attribute | Default | Description |
| --- | --- | --- |
| `data-target` | `.wp-block-tag-cloud` | CSS selector for the element that holds the links. Every match becomes a sphere. |
| `data-radius` | `140` | Sphere radius in pixels. It shrinks to fit a narrower container. |

## How it works

- The widget moves the `<a>` elements themselves into the sphere, so their `href`, attributes and listeners are kept. The rest of the target element's content (list items, separators, other text) is replaced, so point `data-target` at the element that wraps only the tags.
- Without JavaScript, or if the script fails to load, the original list is left as it was.
- Tag sizes come from the links' existing font sizes, eg. the sizes WordPress sets by post count, scaled to fit the sphere. Tags at the front are larger and fully opaque, tags at the back are smaller and faded.
- Tags take the text color of the surrounding page, so they follow light and dark themes.
- Long tag names are cut short with an ellipsis. The full name stays in the link text for assistive technology and is shown on hover as a tooltip.

## Interaction and accessibility

- **Drag** with a mouse, pen or finger to spin the sphere, with a little inertia. A drag that ends on a tag does not follow the link. A plain click or tap does.
- **Tab** moves through the tags in their original order, and the sphere turns each focused tag to the front.
- Rotation pauses while the mouse is over the sphere, while a tag has focus, and with the **Pause** button in the corner.
- With `prefers-reduced-motion: reduce` the sphere does not rotate on its own, has no inertia, and turns a focused tag to the front without animating. Dragging still works.
- Touch drags over the sphere spin it instead of scrolling the page.
- The animation stops when the sphere is scrolled out of view, and when nothing is moving.

## Notes

Uses CSS 3D transforms, `ResizeObserver` and `IntersectionObserver`, supported in every current browser. No network requests.
