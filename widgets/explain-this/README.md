# Explain This

Readers select a word or phrase in your article and press **Explain** to get a two or three sentence explanation that takes the surrounding paragraph into account. It runs on Chrome's built-in Prompt API, so the selected text never leaves the device.

```html
<script src="explain.min.js" data-target="article" data-level="simple"></script>
```

## Options

| Attribute | Default | Description |
| --- | --- | --- |
| `data-target` | `article` | CSS selector for the content readers can select in. Selections elsewhere are ignored. |
| `data-level` | `simple` | Reading level of the explanation: `simple`, `standard` or `expert`. |

## Notes

- **Browser support.** Needs the Prompt API (`LanguageModel`), in Chrome 148 or later on Windows, macOS, Linux or a Chromebook Plus with enough storage and memory to run Gemini Nano. Everywhere else the widget renders nothing and the page is unchanged.
- **Privacy.** Nothing is sent to the model until the reader presses Explain. Then the selection and its paragraph go to the on-device model only. No network requests, apart from Chrome downloading the model the first time, which shows progress in the popover.
- **What counts as a selection.** One to 300 characters inside the target. The paragraph around it (the closest `p`, `li`, `td`, heading, and so on) is sent as context, up to 2,000 characters.
- **Keyboard, mouse and touch.** The button follows any selection, however it was made. It sits just below the selection, where it does not fight the touch selection menu, and is the next Tab stop after the paragraph. Escape closes the button or the popover, as does clicking elsewhere.
- **Labelled as AI.** The popover is titled "AI explanation" and notes that it was generated on the device and can be wrong.
- **Reading level** is set by the site owner. Readers cannot change it.
- **Dark mode.** Follows `data-theme` on `<html>`, or the visitor's color scheme.
