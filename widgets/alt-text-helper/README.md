# Alt Text Helper

Finds images with no alt text and drafts a one sentence description for each with Chrome's on-device Prompt API. It is a tool for site owners: add `?alt-audit` to any page URL, review the suggestions, edit them, and copy them into your CMS.

```html
<script src="alt.min.js" data-param="alt-audit"></script>
```

## Options

| Attribute | Default | Description |
| --- | --- | --- |
| `data-param` | `alt-audit` | URL parameter that turns the audit on, eg. `https://example.com/about/?alt-audit`. |
| `data-position` | `bottom-right` | Corner for the audit panel: `top-left`, `top-right`, `bottom-left` or `bottom-right`. |

## How it works

- Without the URL parameter it does nothing: no panel, no API check, no model download. Ordinary visitors never see it.
- With the parameter it lists every `<img>` that has no `alt` attribute and puts a numbered badge on each. Images with `alt=""` are left alone, since an empty alt marks an image as decorative.
- Each entry has a **Suggest** button. A suggestion is generated only when you ask for it, one image at a time. The first click may download the model, and the panel shows its progress.
- Suggestions go into an editable text field with a **Copy** button. Nothing is written back to the page or your CMS.

## Notes

- **Browser support:** suggestions need the Prompt API with image input, in Chrome 148 or later on desktop, on hardware that can run Gemini Nano. In other browsers the audit still lists the images and says that suggestions are unavailable, so you can write the alt text yourself.
- **Privacy:** images are described on the device. The widget makes no network requests of its own, though Chrome downloads the model the first time.
- **Limits:** images from other origins that the page cannot read, CSS background images, and the quality of existing alt text are out of scope.
- **Accessibility:** badges, buttons and fields are keyboard operable and labelled. Choosing a badge moves focus to its entry in the panel. Scrolling respects `prefers-reduced-motion`.
- Always review a suggestion before publishing it. The model can be wrong, and only you know why an image is on the page.
