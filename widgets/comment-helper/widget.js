/**
 * Comment Helper: adds "Fix grammar", "Friendlier" and "Shorter" buttons under
 * textareas, using Chrome's built-in Prompt API on the visitor's device.
 * Renders nothing where the API is unavailable.
 *
 * Options (data- attributes on the script tag):
 *   data-target  CSS selector for the textareas to help with. Default "textarea".
 */
import { createHost, options, ready } from '../../shared/embed.js';
import { availability, create } from '../../shared/ai.js';

const { target } = options( { target: 'textarea' } );

/** Button labels and the instruction each one sends to the model. */
const ACTIONS = {
	'Fix grammar': 'Fix the spelling, grammar and punctuation. Change nothing else.',
	Friendlier: 'Rewrite it to sound warmer and friendlier.',
	Shorter: 'Rewrite it to be shorter. Keep every important point.',
};

const SYSTEM =
	'You edit text a visitor typed into a form on a website. Reply with only the edited text: no quotes, no preamble, no explanation. ' +
	'Keep the writer\'s meaning, language and point of view.';

const CSS = `
	:host { display: block; margin: 6px 0 12px; font-size: .9em; }
	button { font: inherit; min-block-size: 24px; padding: 3px 10px; border-radius: 6px; border: 1px solid color-mix(in srgb, CanvasText 35%, transparent); background: Canvas; color: CanvasText; cursor: pointer; }
	[aria-disabled="true"] { opacity: .5; cursor: progress; }
	.bar, .end { display: flex; flex-wrap: wrap; gap: 6px; }
	.status { margin: 6px 0 0; }
	.status:empty { margin: 0; }
	.panel { margin-top: 8px; padding: 10px; border: 1px solid color-mix(in srgb, CanvasText 25%, transparent); border-radius: 8px; }
	.note { margin: 0 0 8px; opacity: .75; }
	.cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(14em, 1fr)); gap: 10px; margin-bottom: 10px; }
	.cols b { display: block; font-size: .85em; }
	.cols p { margin: 4px 0 0; padding: 6px 8px; border-radius: 6px; white-space: pre-wrap; overflow-wrap: anywhere; background: color-mix(in srgb, CanvasText 6%, Canvas); }
	.after { background: color-mix(in srgb, Highlight 18%, Canvas) !important; }
	.accept { font-weight: 600; }
	@media (pointer: coarse) { button { min-block-size: 44px; } }
	[hidden] { display: none !important; }
`;

ready( async () => {
	const fields = [ ...document.querySelectorAll( target ) ].filter( ( field ) => field instanceof HTMLTextAreaElement );
	if ( ! fields.length ) {
		return;
	}
	// availability() reports "unavailable" for a language the model does not support, so no toolbar appears.
	const lang = ( document.documentElement.lang || 'en' ).split( /[-_]/ )[ 0 ];
	const io = {
		expectedInputs: [ { type: 'text', languages: [ lang ] } ],
		expectedOutputs: [ { type: 'text', languages: [ lang ] } ],
	};
	if ( ( await availability( 'LanguageModel', io ) ) === 'unavailable' ) {
		return;
	}

	let session;
	// One session for every textarea, created on the first click since that may start the model download.
	const getSession = ( onProgress ) =>
		( session ??= create( 'LanguageModel', { ...io, initialPrompts: [ { role: 'system', content: SYSTEM } ] }, onProgress ).catch(
			( error ) => {
				session = null;
				throw error;
			}
		) );

	for ( const field of fields ) {
		attach( field, getSession );
	}
} );

/**
 * Sets a textarea's value so that frameworks managing form state notice.
 *
 * @param {HTMLTextAreaElement} field Textarea.
 * @param {string}              value New value.
 */
function setValue( field, value ) {
	// The prototype setter skips React's value tracker on the element, so its onChange fires on the input event.
	Object.getOwnPropertyDescriptor( HTMLTextAreaElement.prototype, 'value' ).set.call( field, value );
	field.dispatchEvent( new Event( 'input', { bubbles: true } ) );
}

/**
 * Renders the buttons and suggestion panel after one textarea.
 *
 * @param {HTMLTextAreaElement} field      Textarea to help with.
 * @param {Function}            getSession Resolves to the shared Prompt API session.
 */
function attach( field, getSession ) {
	const host = createHost( CSS );
	const root = host.shadowRoot;
	root.innerHTML += `
		<div class="bar" role="group" aria-label="Writing help">
			${ Object.keys( ACTIONS ).map( ( name ) => `<button type="button" class="act">${ name }</button>` ).join( '' ) }
			<button type="button" class="undo" hidden>Undo</button>
		</div>
		<p class="status" role="status"></p>
		<div class="panel" role="region" aria-label="Suggestion" hidden>
			<p class="note">Written on your device by AI. Check it before you use it.</p>
			<div class="cols">
				<div><b>Your text</b><p class="before"></p></div>
				<div><b>Suggestion</b><p class="after"></p></div>
			</div>
			<div class="end">
				<button type="button" class="accept">Use suggestion</button>
				<button type="button" class="discard">Keep mine</button>
			</div>
		</div>`;
	const $ = ( selector ) => root.querySelector( selector );
	const actions = root.querySelectorAll( '.act' );
	const [ undo, status, panel, before, after ] = [ '.undo', '.status', '.panel', '.before', '.after' ].map( $ );
	field.after( host );

	let controller;
	let busy = false;
	let original;
	let lastAction;

	const setBusy = ( value ) => {
		busy = value;
		// aria-disabled instead of disabled, so the focused button keeps focus while the model works.
		actions.forEach( ( button ) => button.setAttribute( 'aria-disabled', value ) );
	};

	const reset = () => {
		controller?.abort();
		setBusy( false );
		panel.hidden = true;
		undo.hidden = true;
		status.textContent = '';
	};

	// The visitor typing makes any suggestion stale and any undo unsafe. Our own input events are untrusted.
	field.addEventListener( 'input', ( event ) => event.isTrusted && reset() );

	actions.forEach( ( button ) =>
		button.addEventListener( 'click', async () => {
			if ( busy ) {
				return;
			}
			const text = field.value;
			if ( ! text.trim() ) {
				status.textContent = 'Write something first.';
				return;
			}
			reset();
			lastAction = button;
			controller = new AbortController();
			const { signal } = controller;
			setBusy( true );
			status.textContent = 'Working on it…';
			try {
				const base = await getSession( ( loaded ) => {
					status.textContent = `Downloading the writing model: ${ Math.round( loaded * 100 ) }%`;
				} );
				// A fresh clone per request, so earlier rewrites do not pile up in the conversation.
				const chat = await base.clone();
				let suggestion;
				try {
					suggestion = ( await chat.prompt( `${ ACTIONS[ button.textContent ] }\n\nText:\n${ text }`, { signal } ) ).trim();
				} finally {
					chat.destroy();
				}
				setBusy( false );
				if ( suggestion === text.trim() ) {
					status.textContent = 'No changes to suggest.';
					return;
				}
				before.textContent = text;
				after.textContent = suggestion;
				panel.hidden = false;
				status.textContent = 'Suggestion ready below.';
			} catch {
				if ( ! signal.aborted ) {
					setBusy( false );
					status.textContent = 'No suggestion this time. Please try again.';
				}
			}
		} )
	);

	$( '.accept' ).addEventListener( 'click', () => {
		original = field.value;
		setValue( field, after.textContent );
		panel.hidden = true;
		undo.hidden = false;
		status.textContent = 'Suggestion used.';
		undo.focus();
	} );

	$( '.discard' ).addEventListener( 'click', () => {
		panel.hidden = true;
		status.textContent = '';
		lastAction?.focus();
	} );

	undo.addEventListener( 'click', () => {
		setValue( field, original );
		undo.hidden = true;
		status.textContent = 'Your text is back.';
		field.focus();
	} );
}
