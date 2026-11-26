# Ask This Page

A button in the corner opens a small chat panel where visitors ask questions about the page they are reading. Answers come from the page's own text and are generated on the visitor's device by Chrome's built-in [Prompt API](https://developer.chrome.com/docs/ai/prompt-api), so there is no account, API key or server.

```html
<script src="ask.min.js" data-target="main" data-greeting="Ask me about this page"></script>
```

## Options

| Attribute | Default | Description |
| --- | --- | --- |
| `data-target` | `main` | CSS selector for the content to answer from. Falls back to `<body>` when nothing matches or the selector is invalid. |
| `data-greeting` | `Ask me about this page` | First message shown in the panel. |
| `data-position` | `bottom-right` | Corner: `top-left`, `top-right`, `bottom-left` or `bottom-right`. |

## Notes

- **Browser support.** Needs the Prompt API: Chrome 148 or later on Windows, macOS, Linux or ChromeOS (Chromebook Plus), on hardware that meets [Chrome's requirements](https://developer.chrome.com/docs/ai/prompt-api) for the on-device model. Everywhere else the widget renders nothing and the page is unchanged.
- **Model download.** The first question on a device without the model downloads it, with a progress bar. Nothing downloads until the visitor asks.
- **Grounding.** The visible text of the target element, up to about 12,000 characters, goes into the model's instructions. Text past that point is not seen, so on very long pages point `data-target` at the part that matters. The model is told to answer only from that text and to reply "That is not covered on this page." otherwise. Like any language model it can still be wrong, which the panel says.
- **Languages.** The model is asked for English input and output.
- **Accessibility.** The panel is a labelled, non-modal dialog. Escape or the close button closes it and returns focus to the button. Answers stream in visibly, and each finished answer is announced to screen readers once. While an answer streams, the Ask button becomes Stop.
- **Privacy and network.** The widget makes no network requests. Questions and page text stay on the device. Conversation history lasts only until the page is closed.
- **Shared corner.** Other corner widgets in the same corner stack above or below it.
- **In an iframe.** A cross-origin iframe needs `allow="language-model"` to use the API.
