# Comment Helper

Adds three buttons under the textareas you pick: "Fix grammar", "Friendlier" and "Shorter". Each one shows a suggestion next to the visitor's text, and nothing changes until they choose "Use suggestion". One click on "Undo" brings their text back exactly.

```html
<script src="write.min.js" data-target="#comment, .contact-form textarea"></script>
```

## Options

| Attribute | Default | Description |
| --- | --- | --- |
| `data-target` | `textarea` | CSS selector for the textareas to help with. Elements that are not textareas are skipped. |

## Notes

- Built on Chrome's built-in [Prompt API](https://developer.chrome.com/docs/ai/prompt-api) (`LanguageModel`), available to web pages from Chrome 148 on desktop. The model runs on the visitor's device: nothing they type is sent anywhere, and the widget makes no network requests.
- The model needs Windows 10 or 11, macOS 13+, Linux or a Chromebook Plus, with about 22 GB of free disk space and either a GPU with more than 4 GB of memory or 16 GB of RAM. It does not run on Android or iOS. See [the hardware requirements](https://developer.chrome.com/docs/ai/prompt-api#hardware-requirements).
- Where the API is missing, the device cannot run the model or the page language is not supported, the widget adds nothing and the form is untouched. The language comes from `<html lang>`, and defaults to English. The model currently supports English, Spanish, Japanese, German and French.
- On first use Chrome may need to download the model. That starts only after a click, and the progress shows under the buttons.
- Using a suggestion sets the textarea's value and fires a bubbling `input` event, so frameworks that track form state (React, Vue and others) see the change. The form submits as usual whether or not the helper was used.
- Typing in the textarea discards an open suggestion and the undo, so undo can never overwrite newer typing.
- The buttons are ordinary tab stops after the textarea, with results announced in a status region.
- Suggestions are written by a small model and can be wrong. The panel says so.
- Out of scope for now: checking as the visitor types, rich text editors and `contenteditable`, tone warnings, and drafting from scratch.
