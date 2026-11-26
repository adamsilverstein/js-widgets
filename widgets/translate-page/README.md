# Translate This Page

A small language picker that translates an article in place, on the visitor's device, with Chrome's built-in [Translator API](https://developer.chrome.com/docs/ai/translator-api). "Show original" puts the exact original text back.

```html
<script src="translate.min.js" data-target="article" data-languages="es,fr,de,ja"></script>
```

The picker renders where the snippet is pasted, so put it just above the article. A snippet in `<head>` renders the picker just above the target instead.

## Options

| Attribute | Default | Description |
| --- | --- | --- |
| `data-target` | `article` | CSS selector for the region to translate. The first match is used. |
| `data-languages` | `en,es,fr,de,ja,zh` | Comma separated language codes to offer. The page's own language is left out. |

## How it works

- The source language comes from the nearest `lang` attribute on or above the target. Without one, the [Language Detector API](https://developer.chrome.com/docs/ai/language-detection) is used when its model is already on the device.
- The picker lists only the configured languages the browser can translate to, named in their own language, and preselects the visitor's browser language when it is one of them.
- Only text nodes change, so links, inline formatting and other markup survive. Text inside `pre`, `code`, `kbd`, `samp`, `var`, `script`, `style`, `textarea` and anything marked `translate="no"` is left alone.
- The translated region gets the new `lang` attribute so screen readers switch voices. "Show original" restores the original attributes too.
- Each text node is translated on its own, so sentences split by inline tags lose some context and may read less smoothly.

## Notes

- **Browser support:** Chrome 138 or later on desktop. Everywhere else the widget renders nothing and the page is unchanged.
- **Downloads:** each language pair is a separate model download, which starts only after the visitor clicks Translate. A progress bar shows while it downloads.
- **Privacy:** text is translated on the device. The widget makes no network requests of its own.
- **Iframes:** in a cross-origin iframe, the frame needs `allow="translator"` (and `allow="language-detector"` for detection).
- **Scope:** form fields and content added after the page loads are not translated, and the choice is not remembered across pages.
