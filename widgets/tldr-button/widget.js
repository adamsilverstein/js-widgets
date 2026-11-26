/**
 * TL;DR Button: summarizes an article on the visitor's device with Chrome's
 * built-in Summarizer API. Renders nothing where the API is unavailable.
 *
 * Options (data- attributes on the script tag):
 *   data-target  CSS selector for the article. Default "article".
 *   data-type    "key-points", "tldr", "teaser" or "headline". Default "key-points".
 *   data-length  "short", "medium" or "long". Default "short".
 */
import { createHost, options, ready } from '../../shared/embed.js';
import { availability, create } from '../../shared/ai.js';

const { target, type, length } = options( {
	target: 'article',
	type: 'key-points',
	length: 'short',
} );

ready( async () => {
	const article = document.querySelector( target );
	if ( ! article ) {
		return;
	}
	// availability() reports "unavailable" for a language the model does not support, so the button stays hidden.
	const lang = ( article.closest( '[lang]' )?.lang || 'en' ).slice( 0, 2 );
	const config = {
		type,
		length,
		format: 'markdown',
		expectedInputLanguages: [ lang ],
		outputLanguage: lang,
		sharedContext: 'An article on a web page.',
	};
	let state = await availability( 'Summarizer', config );
	if ( state === 'unavailable' ) {
		return;
	}

	const host = createHost( `
		:host { display: block; margin: 0 0 1em; }
		button { font: inherit; padding: 4px 12px; border-radius: 6px; border: 1px solid; background: Canvas; color: CanvasText; cursor: pointer; }
		[aria-expanded] { font-weight: 600; }
		.box { margin-top: 8px; padding: 10px 14px; border: 1px solid color-mix(in srgb, CanvasText 25%, transparent); border-radius: 8px; }
		.label { margin: 0; font-size: .85em; opacity: .75; }
		.out > * { margin: 6px 0 0; }
		ul { padding-left: 1.2em; }
		progress { width: 10em; vertical-align: middle; }
		.wait { margin: 6px 0 0; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
		.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
		[hidden] { display: none !important; }
	` );
	const root = host.shadowRoot;
	root.innerHTML += `
		<button type="button" aria-expanded="false" aria-controls="box">TL;DR</button>
		<div class="box" id="box" role="region" aria-label="Summary" hidden>
			<p class="label">AI-generated summary, made on your device. May contain mistakes.</p>
			<div class="wait" hidden><span></span><progress max="1" hidden></progress><button type="button">Cancel</button></div>
			<div class="out"></div>
		</div>
		<div class="sr" role="status"></div>`;
	const [ toggle, cancel ] = root.querySelectorAll( 'button' );
	const box = root.querySelector( '.box' );
	const label = root.querySelector( '.label' );
	const wait = root.querySelector( '.wait' );
	const waitText = wait.querySelector( 'span' );
	const progress = root.querySelector( 'progress' );
	const out = root.querySelector( '.out' );
	const status = root.querySelector( '.sr' );

	// Under the article's title when it starts with one, so the button reads as part of it.
	const first = article.firstElementChild;
	if ( /^H[1-3]$/.test( first?.tagName ) ) {
		first.after( host );
	} else {
		article.prepend( host );
	}

	let controller;
	let done = false;

	toggle.addEventListener( 'click', () => {
		const open = toggle.getAttribute( 'aria-expanded' ) !== 'true';
		toggle.setAttribute( 'aria-expanded', open );
		box.hidden = ! open;
		if ( open && ! done && ! controller ) {
			summarize();
		}
	} );

	cancel.addEventListener( 'click', () => {
		controller?.abort();
		controller = null;
		toggle.click();
		toggle.focus();
	} );

	/** Downloads the model if needed, then streams a summary of the article into the box. */
	async function summarize() {
		controller = new AbortController();
		const { signal } = controller;
		out.replaceChildren();
		status.textContent = '';
		showWait( 'Preparing…' );
		let summarizer;
		try {
			// create() must run in the click's task: a model download needs user activation.
			// create() reports progress 0 and 1 even when the model is already on the
			// device, so only show it when a download is expected.
			summarizer = await create( 'Summarizer', { ...config, signal }, ( loaded ) => {
				if ( state !== 'available' ) {
					showWait( 'Downloading the summary model…' );
					progress.hidden = false;
					progress.value = loaded;
				}
			} );
			state = 'available';
			progress.hidden = true;
			showWait( 'Summarizing…' );
			// innerText skips the widget's own shadow root, so the button text is not summarized.
			const { text, cut } = await fit( summarizer, article.innerText.trim() );
			label.textContent = `AI-generated summary${
				cut ? ' of the first part of the article' : ''
			}, made on your device. May contain mistakes.`;
			let summary = '';
			let lines = [];
			for await ( const chunk of summarizer.summarizeStreaming( text, { signal } ) ) {
				summary += chunk;
				lines = render( summary );
			}
			done = true;
			// Announced once complete, since a live region updated per chunk would be read in fragments.
			status.textContent = `Summary: ${ lines.join( ' ' ) }`;
		} catch {
			if ( ! signal.aborted ) {
				out.textContent = 'Sorry, this article could not be summarized.';
				status.textContent = out.textContent;
			}
		} finally {
			summarizer?.destroy();
			// A cancelled run can settle after the visitor has started a new one.
			if ( controller?.signal === signal ) {
				wait.hidden = true;
				progress.hidden = true;
				controller = null;
			}
		}
	}

	function showWait( message ) {
		wait.hidden = false;
		waitText.textContent = message;
	}

	/**
	 * Renders the model's Markdown as a list of points or a paragraph. Uses
	 * textContent only, so model output can never inject markup.
	 *
	 * @param {string} markdown Summary so far.
	 * @return {string[]} The rendered lines.
	 */
	function render( markdown ) {
		const lines = markdown
			.split( '\n' )
			.map( ( line ) => line.replace( /^\s*[-*•]\s+|\*\*|__/g, '' ).trim() )
			.filter( Boolean );
		const list = type === 'key-points';
		const parent = document.createElement( list ? 'ul' : 'p' );
		if ( list ) {
			parent.append( ...lines.map( ( line ) => Object.assign( document.createElement( 'li' ), { textContent: line } ) ) );
		} else {
			parent.textContent = lines.join( ' ' );
		}
		out.replaceChildren( parent );
		return lines;
	}
} );

/**
 * Shortens text until it fits the model's input quota.
 *
 * @param {Object} summarizer Summarizer session.
 * @param {string} text       Article text.
 * @return {Promise<{text: string, cut: boolean}>} Text that fits, and whether it was shortened.
 */
async function fit( summarizer, text ) {
	let cut = false;
	for ( let usage; ( usage = await summarizer.measureInputUsage?.( text ) ) > summarizer.inputQuota; ) {
		// Usage is in tokens, so scale by the overshoot with some margin and measure again.
		text = text.slice( 0, Math.floor( ( text.length * summarizer.inputQuota * 0.9 ) / usage ) );
		cut = true;
	}
	return { text, cut };
}
