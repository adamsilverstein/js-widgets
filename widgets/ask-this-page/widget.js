/**
 * Ask This Page: a corner chat panel that answers questions about the page,
 * using Chrome's on-device Prompt API. Renders nothing where the API is missing.
 *
 * Options (data- attributes on the script tag):
 *   data-target    CSS selector for the content to answer from. Default "main",
 *                  falling back to <body> when nothing matches.
 *   data-greeting  First message in the panel. Default "Ask me about this page".
 *   data-position  Corner, eg. "bottom-left". Default "bottom-right".
 */
import { mountCorner, options, ready } from '../../shared/embed.js';
import { availability, create } from '../../shared/ai.js';

const { target, greeting, position } = options( {
	target: 'main',
	greeting: 'Ask me about this page',
	position: 'bottom-right',
} );

/** Characters of page text sent to the model, to stay inside its small context window. */
const MAX_CHARS = 12000;

const NOT_COVERED = 'That is not covered on this page.';
const THINKING = 'Thinking…';

// availability() must be called with the same options as create().
const MODEL_OPTIONS = {
	expectedInputs: [ { type: 'text', languages: [ 'en' ] } ],
	expectedOutputs: [ { type: 'text', languages: [ 'en' ] } ],
};

const CSS = `
:host { color-scheme: light dark; --fg: light-dark(#1d1d1f, #f2f2f2); --bg: light-dark(#fff, #222); --muted: light-dark(#eef0f3, #333); --accent: light-dark(#2f5bd8, #8aa8ff); --on-accent: light-dark(#fff, #111); }
* { box-sizing: border-box; }
.wrap { display: flex; flex-direction: column; align-items: end; gap: 8px; font: 15px/1.45 system-ui, sans-serif; }
button { font: inherit; cursor: pointer; border: 0; border-radius: 8px; padding: 8px 12px; background: var(--accent); color: var(--on-accent); }
button:focus-visible, input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.toggle { display: flex; align-items: center; gap: 6px; border-radius: 999px; padding: 10px 16px; box-shadow: 0 2px 10px #0004; }
.toggle svg { width: 18px; height: 18px; fill: currentColor; }
dialog { position: static; margin: 0; padding: 0; width: min(340px, calc(100vw - 32px)); max-height: min(440px, calc(100vh - 90px)); border: 1px solid #8884; border-radius: 12px; background: var(--bg); color: var(--fg); box-shadow: 0 6px 24px #0005; }
dialog[open] { display: flex; flex-direction: column; }
header { display: flex; align-items: center; justify-content: space-between; padding: 8px 8px 8px 14px; border-bottom: 1px solid #8883; }
h2 { margin: 0; font-size: 1rem; }
.close { background: none; color: inherit; padding: 4px 10px; font-size: 1.25rem; line-height: 1; }
.log { flex: 1; overflow-y: auto; overscroll-behavior: contain; padding: 10px 14px; display: flex; flex-direction: column; gap: 8px; min-height: 80px; }
.msg { margin: 0; padding: 8px 10px; border-radius: 10px; max-width: 90%; white-space: pre-wrap; overflow-wrap: anywhere; background: var(--muted); }
.user { align-self: end; background: var(--accent); color: var(--on-accent); }
.note, .progress { margin: 0; padding: 0 14px 6px; font-size: 0.8rem; opacity: 0.8; }
progress { width: 100%; }
form { display: flex; gap: 6px; padding: 8px; border-top: 1px solid #8883; }
input { flex: 1; min-width: 0; font: inherit; padding: 8px 10px; border: 1px solid #8888; border-radius: 8px; background: var(--bg); color: inherit; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
@media (prefers-reduced-motion: no-preference) { dialog[open] { animation: rise 0.15s ease-out; } }
@keyframes rise { from { opacity: 0; transform: translateY(8px); } }
`;

const HTML = `
<div class="wrap">
	<dialog aria-labelledby="title">
		<header><h2 id="title">Ask this page</h2><button type="button" class="close" aria-label="Close">&times;</button></header>
		<div class="log"></div>
		<p class="progress" hidden>Downloading the AI model, once: <progress max="1" value="0"></progress></p>
		<p class="note">Answers are AI generated from this page and may be wrong.</p>
		<form><input name="q" autocomplete="off" required aria-label="Your question" placeholder="Your question"><button>Ask</button></form>
		<p class="sr" role="status"></p>
	</dialog>
	<button type="button" class="toggle" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/></svg>Ask this page</button>
</div>`;

/**
 * Builds the system prompt from the target element's visible text.
 *
 * @param {number} [scale] Share of the page text to keep, 0 to 1.
 * @return {string} Instructions followed by the truncated page text.
 */
function systemPrompt( scale = 1 ) {
	let content;
	try {
		content = document.querySelector( target );
	} catch {
		// An invalid selector falls back to <body>, as a missing element does.
	}
	content ||= document.body;
	const text = content.innerText.replace( /\n{3,}/g, '\n\n' ).trim();
	return `You answer a visitor's questions about one web page, using only the page text below. Answer briefly, in plain text. Do not use outside knowledge. If the page text does not contain the answer, reply exactly: "${ NOT_COVERED }"

Page title: ${ document.title }

Page text:
${ text.slice( 0, Math.min( text.length, MAX_CHARS ) * scale ) }`;
}

/**
 * Creates a model session grounded in the page, downloading the model first if needed.
 *
 * @param {AbortSignal} signal     Abandons the download. Also destroys the session if aborted later.
 * @param {Function}    onProgress Called with the downloaded fraction, 0 to 1.
 * @param {number}      [scale]    Share of the page text to send.
 * @return {Promise<Object>} The session.
 */
async function createSession( signal, onProgress, scale = 1 ) {
	try {
		return await create(
			'LanguageModel',
			{ ...MODEL_OPTIONS, initialPrompts: [ { role: 'system', content: systemPrompt( scale ) } ], signal },
			onProgress
		);
	} catch ( error ) {
		// Context windows differ by device. Retry once, leaving half the window for the conversation.
		// Chrome reports the window as `quota`, the Prompt API docs as `contextWindow`.
		const limit = error.quota || error.contextWindow;
		if ( error.name !== 'QuotaExceededError' || scale < 1 || ! limit ) {
			throw error;
		}
		return createSession( signal, onProgress, ( 0.5 * limit ) / error.requested );
	}
}

ready( async () => {
	const status = await availability( 'LanguageModel', MODEL_OPTIONS );
	if ( status === 'unavailable' ) {
		return;
	}

	const root = mountCorner( CSS, position );
	root.innerHTML += HTML;
	const $ = ( selector ) => root.querySelector( selector );
	const dialog = $( 'dialog' );
	const toggle = $( '.toggle' );
	const log = $( '.log' );
	const form = $( 'form' );
	const input = $( 'input' );
	const submit = $( 'form button' );
	const progress = $( '.progress' );
	const announce = $( '[role=status]' );

	let session;
	let busy = false;
	// Aborted by the Stop button. Replaced once a session exists, since aborting
	// the signal passed to create() would also destroy the session.
	let stop;

	const say = ( role, text ) => {
		const message = document.createElement( 'p' );
		message.className = `msg ${ role }`;
		message.textContent = text;
		log.append( message );
		log.scrollTop = log.scrollHeight;
		return message;
	};
	say( 'ai', greeting );

	const setOpen = ( open ) => {
		const theme = document.documentElement.dataset.theme;
		root.host.style.colorScheme = theme === 'light' || theme === 'dark' ? theme : '';
		if ( open ) {
			dialog.show();
			input.focus();
		} else {
			dialog.close();
			toggle.focus();
		}
		toggle.setAttribute( 'aria-expanded', open );
	};

	toggle.addEventListener( 'click', () => setOpen( ! dialog.open ) );
	$( '.close' ).addEventListener( 'click', () => setOpen( false ) );
	// A dialog opened with show() does not close on Escape by itself.
	dialog.addEventListener( 'keydown', ( event ) => {
		if ( event.key === 'Escape' ) {
			event.preventDefault();
			setOpen( false );
		}
	} );

	const setBusy = ( value ) => {
		busy = value;
		submit.textContent = busy ? 'Stop' : 'Ask';
		// readOnly, not disabled, so focus stays in the field and Enter stops the answer.
		input.readOnly = busy;
	};

	form.addEventListener( 'submit', async ( event ) => {
		event.preventDefault();
		if ( busy ) {
			stop.abort();
			return;
		}
		const question = input.value.trim();
		if ( ! question ) {
			return;
		}
		input.value = '';
		say( 'user', question );
		const answer = say( 'ai', THINKING );
		stop = new AbortController();
		setBusy( true );

		try {
			if ( ! session ) {
				// The model downloads here, so only after the visitor asks.
				session = await createSession( stop.signal, ( loaded ) => {
					progress.hidden = loaded >= 1;
					progress.querySelector( 'progress' ).value = loaded;
				} );
				stop = new AbortController();
			}
			let text = '';
			for await ( const chunk of session.promptStreaming( question, { signal: stop.signal } ) ) {
				text += chunk;
				answer.textContent = text;
				log.scrollTop = log.scrollHeight;
			}
			// Announced once complete: announcing each chunk would flood screen readers.
			announce.textContent = text;
		} catch ( error ) {
			const stopped = stop.signal.aborted;
			answer.textContent = stopped
				? `${ answer.textContent === THINKING ? '' : answer.textContent.trimEnd() } (stopped)`.trim()
				: 'Sorry, the answer could not be generated. Please try again.';
			announce.textContent = answer.textContent;
			if ( ! stopped ) {
				console.error( error );
			}
		} finally {
			progress.hidden = true;
			setBusy( false );
		}
	} );
} );
