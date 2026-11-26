# Contact Card

A round button in a corner of the page that opens a small card with "Call" and "Email" links and a three field contact form. Use it when a site needs an obvious way to get in touch without a form plugin or a third party chat embed.

```html
<script src="contact.min.js"
	data-phone="+15415550100"
	data-email="hello@example.com"
	data-endpoint="https://example.com/contact"></script>
```

## Options

| Attribute | Default | Description |
| --- | --- | --- |
| `data-phone` | none | Phone number for the "Call" link. Shown as written, dialed with only its digits and `+`. |
| `data-email` | none | Address for the "Email" link. |
| `data-endpoint` | none | URL the form posts to. Without it the form is left out and the card shows only the links. |
| `data-label` | `Contact us` | The button's accessible name and the card heading. |
| `data-color` | `#2563eb` | Accent color for the button and the Send button. Text on it is white, so pick a dark enough color. |
| `data-position` | `bottom-right` | `top-left`, `top-right`, `bottom-left` or `bottom-right`. |

Set at least one of `data-phone`, `data-email` or `data-endpoint`, or the widget renders nothing.

## The form

The form posts JSON with `Content-Type: application/json` and `Accept: application/json`:

```json
{ "name": "Ada", "email": "ada@example.com", "message": "Hello" }
```

That is the shape services like [Formspree](https://formspree.io/) accept, so a Formspree form URL works as the endpoint. Any 2xx response counts as sent; anything else, or a network failure, shows an error and keeps what the visitor typed. The endpoint must allow cross origin requests from your site if it is on another domain.

The widget only sends the message. Storing or emailing it is up to the endpoint.

## Notes

- **Network:** the form makes one `POST` to your endpoint when the visitor sends it. Nothing is loaded or sent before that.
- **Spam:** a hidden honeypot field is included. Submissions that fill it are dropped without a request, and the visitor sees the usual success message. There is no other spam protection.
- **Email address:** it is not obfuscated. It sits in plain text in the script tag either way, so leave `data-email` out if scrapers are a concern and rely on the form.
- **Accessibility:** the card is a native popover. Opening it moves focus to the first link (or the first field), and Escape, a click outside or the close button closes it and returns focus to the button. Fields use the browser's built-in validation. Sending, success and error messages are announced through a status region.
- **Small screens:** the card is at most 20rem wide, keeps a 16px margin, and scrolls inside its own box instead of covering the button.
- **Dark mode:** follows `data-theme` on `<html>` when set, otherwise the visitor's color scheme.
- **Browser support:** needs the Popover API (Chrome 114, Firefox 125, Safari 17). Older browsers get no button rather than a broken one.
