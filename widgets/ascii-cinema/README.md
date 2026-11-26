# ASCII Cinema

Plays a video as live ASCII art. Good for a landing page, a 404 page or a demo reel. Visitors can pause it, or click the picture to see the real video with its native controls.

```html
<script src="ascii.min.js" data-src="clip.mp4" data-cols="100" data-color="#33ff66"></script>
```

Paste it in the `<body>` where the video should appear. With `data-target` the script can go anywhere, including `<head>`.

To keep captions or other settings, put your own `<video>` on the page and point the widget at it. It stays a normal video if the widget never loads.

```html
<video id="intro" src="intro.mp4" controls loop playsinline>
	<track kind="captions" src="intro.vtt" srclang="en" label="English">
</video>
<script src="ascii.min.js" data-target="#intro"></script>
```

## Options

| Attribute | Default | Description |
| --- | --- | --- |
| `data-src` | | Video to play, MP4 or WebM. The widget creates a looping `<video>` with controls. |
| `data-target` | | CSS selector for an existing `<video>`, used instead of `data-src`. |
| `data-cols` | `100` | Characters per row. Rows follow from the video's shape. |
| `data-ramp` | ` .:-=+*#%@` | Characters from darkest to brightest. |
| `data-color` | `#33ff66` | Character color, any CSS color. The background is black. |
| `data-autoplay` | `true` | `false` waits for the Play button. |

## Notes

- **Same-origin video only.** The widget reads pixels from a canvas, which the browser blocks for videos from other origins unless they send CORS headers. When it cannot read them, it shows the plain video instead. For a CORS-enabled host, use `data-target` with a `<video crossorigin>`.
- **No sound on autoplay.** Autoplay starts muted, and only once the video scrolls into view. It is skipped when the visitor prefers reduced motion. The video pauses when scrolled out of view and resumes when it comes back.
- **Accessibility.** Play/Pause and Show video/Show ASCII are real buttons. The ASCII layer is exposed as one labelled image, so screen readers do not read the characters. While it shows, the video underneath is `inert`. Captions show in the video view.
- **Frame timing.** Uses `requestVideoFrameCallback` to convert each video frame once, falling back to `requestAnimationFrame`.
- **One color.** Characters share one color. Per-character color is a possible follow-up.
- No network requests besides the video itself.
