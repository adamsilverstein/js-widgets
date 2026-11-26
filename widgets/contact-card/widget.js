/**
 * Contact Card: a floating button that opens a card with call and email links
 * and, when an endpoint is set, a short contact form.
 *
 * Options (data- attributes on the script tag):
 *   data-phone     Phone number for the "Call" link.
 *   data-email     Address for the "Email" link.
 *   data-endpoint  URL the form posts JSON to. Without it the form is left out.
 *   data-label     Button label and card heading. Default "Contact us".
 *   data-color     Accent color for the button and submit. Default "#2563eb".
 *   data-position  Corner: top-left, top-right, bottom-left or bottom-right (default).
 */
import { mountCorner, options, ready } from '../../shared/embed.js';

const { phone, email, endpoint, label, color, position } = options( {
	label: 'Contact us',
	color: '#2563eb',
	position: 'bottom-right',
} );

const CSS = `
:host { color-scheme: light dark; --accent: ${ color }; font: 15px/1.4 system-ui, sans-serif }
button, input, textarea { font: inherit }
.toggle { width: 56px; height: 56px; border: 0; border-radius: 50%; background: var(--accent); color: #fff; cursor: pointer; display: grid; place-items: center; box-shadow: 0 4px 14px #0004 }
.toggle svg { width: 26px; height: 26px }
:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px }
.card { position: fixed; inset: auto; margin: 0; box-sizing: border-box; width: min(20rem, 100vw - 32px); overflow: auto; padding: 16px; border: 1px solid color-mix(in srgb, CanvasText 20%, transparent); border-radius: 12px; background: Canvas; color: CanvasText; box-shadow: 0 8px 30px #0003; transition: opacity .15s, translate .15s }
@starting-style { .card:popover-open { opacity: 0; translate: 0 8px } }
@media (prefers-reduced-motion: reduce) { .card { transition: none } }
header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px }
h2 { font-size: 1.1em; margin: 0 }
.close { border: 0; background: none; color: inherit; font-size: 1.5em; line-height: 1; padding: 0 6px; cursor: pointer; border-radius: 6px }
.actions { display: flex; gap: 8px; margin-bottom: 12px }
.actions a { flex: 1; padding: 8px 10px; border: 1px solid color-mix(in srgb, CanvasText 25%, transparent); border-radius: 8px; color: inherit; text-decoration: none; overflow-wrap: anywhere }
.actions a:hover { border-color: var(--accent) }
.actions small { display: block; opacity: .75 }
form { display: grid; gap: 8px }
label { display: grid; gap: 2px; font-size: .9em }
input, textarea { box-sizing: border-box; width: 100%; padding: 6px 8px; border: 1px solid color-mix(in srgb, CanvasText 35%, transparent); border-radius: 6px; background: Canvas; color: inherit }
textarea { resize: vertical; min-height: 4.5em }
:user-invalid { border-color: #d93025 }
.trap { position: absolute; left: -9999px }
.send { padding: 8px; border: 0; border-radius: 8px; background: var(--accent); color: #fff; cursor: pointer }
.send[aria-disabled=true] { opacity: .6; cursor: progress }
[role=status] { margin: 0; font-size: .9em }
[role=status]:empty { display: none }
`;

const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.8 7L3 21l2-6A8 8 0 1 1 21 12z"/></svg>';

const FORM = `<form>
	<label>Name <input name="name" required autocomplete="name" maxlength="200"></label>
	<label>Email <input name="email" type="email" required autocomplete="email" maxlength="200"></label>
	<label>Message <textarea name="message" required rows="3" maxlength="5000"></textarea></label>
	<div class="trap" aria-hidden="true"><input name="_gotcha" tabindex="-1" autocomplete="off"></div>
	<button class="send">Send</button>
	<p role="status"></p>
</form>`;

/**
 * Builds an action link with its value on a second line.
 *
 * @param {string} href  Link target.
 * @param {string} title Visible action name.
 * @param {string} value Phone number or address shown under the name.
 * @return {HTMLAnchorElement} The link.
 */
function action( href, title, value ) {
	const link = document.createElement( 'a' );
	link.href = href;
	link.append( title, Object.assign( document.createElement( 'small' ), { textContent: value } ) );
	return link;
}

// Without popover support the card would render permanently open, so show nothing.
if ( ( phone || email || endpoint ) && Object.hasOwn( HTMLElement.prototype, 'popover' ) ) {
	ready( () => {
		const root = mountCorner( CSS, position );
		root.innerHTML += `<button class="toggle" type="button">${ ICON }</button>
<div class="card" popover role="dialog" aria-labelledby="title">
	<header><h2 id="title"></h2><button class="close" type="button" aria-label="Close">&times;</button></header>
	<div class="actions"></div>
	${ endpoint ? FORM : '' }
</div>`;

		const [ toggle, close ] = root.querySelectorAll( 'button' );
		const card = root.querySelector( '.card' );
		const actions = root.querySelector( '.actions' );

		toggle.setAttribute( 'aria-label', label );
		root.querySelector( 'h2' ).textContent = label;
		toggle.popoverTargetElement = close.popoverTargetElement = card;
		close.popoverTargetAction = 'hide';

		if ( phone ) {
			actions.append( action( `tel:${ phone.replace( /[^\d+]/g, '' ) }`, 'Call', phone ) );
		}
		if ( email ) {
			actions.append( action( `mailto:${ email }`, 'Email', email ) );
		}
		if ( ! actions.children.length ) {
			actions.remove();
		}
		// The popover moves focus here when it opens.
		root.querySelector( '.actions a, input' ).autofocus = true;

		/** Places the card beside the toggle, wherever it sits in its corner stack. */
		const place = () => {
			const rect = toggle.getBoundingClientRect();
			const style = card.style;
			if ( position.startsWith( 'top' ) ) {
				style.top = `${ rect.bottom + 8 }px`;
				style.maxHeight = `${ innerHeight - rect.bottom - 24 }px`;
			} else {
				style.bottom = `${ innerHeight - rect.top + 8 }px`;
				style.maxHeight = `${ rect.top - 24 }px`;
			}
			if ( position.endsWith( 'left' ) ) {
				style.left = `${ rect.left }px`;
			} else {
				style.right = `${ document.documentElement.clientWidth - rect.right }px`;
			}
		};

		card.addEventListener( 'beforetoggle', ( event ) => {
			if ( event.newState === 'open' ) {
				// Follow the page's dark mode toggle when there is one.
				root.host.style.colorScheme = document.documentElement.dataset.theme || '';
				place();
			} else if ( card.contains( root.activeElement ) ) {
				// Browsers restore focus on close, but not from inside a shadow root.
				toggle.focus();
			}
		} );
		addEventListener( 'resize', () => card.matches( ':popover-open' ) && place() );

		const form = root.querySelector( 'form' );
		form?.addEventListener( 'submit', async ( event ) => {
			event.preventDefault();
			const send = form.querySelector( '.send' );
			if ( send.ariaDisabled ) {
				return;
			}
			const { _gotcha: trap, ...data } = Object.fromEntries( new FormData( form ) );
			const status = form.querySelector( '[role=status]' );
			const done = () => {
				form.reset();
				status.textContent = 'Thanks, your message was sent.';
			};

			// Only bots fill the hidden field. Drop the message but look successful.
			if ( trap ) {
				done();
				return;
			}
			// aria-disabled keeps focus on the button, where disabled would drop it.
			send.ariaDisabled = 'true';
			status.textContent = 'Sending…';
			try {
				const response = await fetch( endpoint, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
					body: JSON.stringify( data ),
				} );
				if ( ! response.ok ) {
					throw new Error( response.status );
				}
				done();
			} catch {
				status.textContent = 'Sorry, your message did not send. Please try again.';
			}
			send.ariaDisabled = null;
		} );
	} );
}
