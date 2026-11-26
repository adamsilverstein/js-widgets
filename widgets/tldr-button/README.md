# TL;DR Button

Adds a "TL;DR" button to the top of an article. A click shows a short summary that streams in under the button, generated on the visitor's device by Chrome's built-in [Summarizer API](https://developer.chrome.com/docs/ai/summarizer-api). No API key, no server, and the article never leaves the device.

```html
<script src="tldr.min.js" data-target="article" data-type="key-points" data-length="short"></script>
```

## Options

| Attribute | Default | Description |
| --- | --- | --- |
| `data-target` | `article` | CSS selector for the article to summarize. The first match is used. |
| `data-type` | `key-points` | `key-points` (a bulleted list), `tldr`, `teaser` or `headline`. |
| `data-length` | `short` | `short`, `medium` or `long`. For `key-points` that is at most 3, 5 or 7 points. |

The button goes right after the article's heading when the article starts with an `h1` to `h3`, and at the very top otherwise.

## Notes

- **Browser support.** The button only appears where `Summarizer.availability()` says the API can be used: Chrome 138 or later on Windows, macOS, Linux or ChromeOS on Chromebook Plus, on hardware that can run the model. Not on Android, iOS, Firefox or Safari. Everywhere else the widget renders nothing and the page is unchanged.
- **Languages.** The summary language follows the nearest `lang` attribute (English, Spanish, Japanese, German and French are supported today). On a page in another language the button does not appear.
- **First use downloads a model.** Nothing runs until the visitor clicks. If the model is not on the device yet, the click starts a one-time download of a few gigabytes, managed by Chrome, with a progress bar and a Cancel button.
- **Long articles** are cut to fit the model's input limit, and the label then says the summary covers the first part of the article.
- **Accessibility.** The button is a disclosure toggle with `aria-expanded`. The summary is labelled as machine generated, and announced to screen readers once complete rather than chunk by chunk.
- **Network.** The widget makes no network requests itself. Chrome fetches the model.
- **Iframes.** In a cross-origin iframe the page embedding it must allow the API with `allow="summarizer"`.
