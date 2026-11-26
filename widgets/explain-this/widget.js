/**
 * Explain This: select a word or phrase in the target element to get a short,
 * plain language explanation from Chrome's on-device Prompt API.
 *
 * Options (data- attributes on the script tag):
 *   data-target  CSS selector for the content readers can select in. Default "article".
 *   data-level   Reading level: "simple", "standard" or "expert". Default "simple".
 */
import { createHost, options, ready } from '../../shared/embed.js';
import { availability, create } from '../../shared/ai.js';

const { target: selector, level } = options( { target: 'article', level: 'simple' } );

/** Selections longer than this are passages, not terms, so get no button. */
const MAX_SELECTION = 300;

/** Upper bound on the paragraph sent as context, to keep prompts fast. */
const MAX_CONTEXT = 2000;

const LEVELS = {
	simple: 'in simple words a 12 year old would understand',
	standard: 'for a general adult reader',
	expert: 'briefly, for a reader who knows the field',
};

const MODEL_OPTIONS = {
	expectedInputs: [ { type: 'text', languages: [ 'en' ] } ],
	expectedOutputs: [ { type: 'text', languages: [ 'en' ] } ],
};

const SYSTEM_PROMPT =
	'You explain words and phrases to readers of a web page. Explain what the phrase means in the passage it comes from. Answer in two or three short sentences of plain text, with no lists, headings or markdown.';

const CSS = `
:host { all: initial; }
.anchor { position: fixed; anchor-name: --jsw-explain; pointer-events: none; }
[popover] {
	position-anchor: --jsw-explain; position-area: block-end span-all; position-try-fallbacks: flip-block;
	inset: auto; margin: 8px; font: 15px/1.5 system-ui, sans-serif;
	color: light-dark(#1d1d1f, #f2f2f4); background: light-dark(#fff, #26262b);
	border: 1px solid light-dark(#c9c9d1, #4a4a52); border-radius: 10px; box-shadow: 0 6px 24px #0003;
}
.button { padding: 6px 12px; cursor: pointer; font-weight: 600; }
/* The panel takes focus only so screen readers announce it. */
.panel:focus { outline: none; }
.button:focus-visible { outline: 2px solid light-dark(#2457d6, #8fb0ff); outline-offset: 2px; }
.panel { box-sizing: border-box; width: min(22rem, calc(100vw - 16px)); padding: 12px 14px; }
.label { margin: 0 0 4px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: light-dark(#5b3cc4, #b9a5ff); }
.text { margin: 0; }
.note { margin: 8px 0 0; font-size: 12px; color: light-dark(#5f5f68, #a8a8b3); }
`;

ready( async () => {
	const root = document.querySelector( selector );
	// The model check comes last so pages without the API or target pay nothing.
	if ( ! root || ( await availability( 'LanguageModel', MODEL_OPTIONS ) ) === 'unavailable' ) {
		return;
	}

	const host = createHost( CSS );
	const shadow = host.shadowRoot;
	shadow.innerHTML += `
		<div class="anchor"></div>
		<button class="button" type="button" popover="manual">Explain</button>
		<div class="panel" popover="auto" role="dialog" aria-label="AI explanation" tabindex="-1">
			<p class="label">AI explanation</p>
			<p class="text" aria-live="polite"></p>
			<p class="note">Generated on your device by AI. It can be wrong.</p>
		</div>`;
	const anchor = shadow.querySelector( '.anchor' );
	const button = shadow.querySelector( '.button' );
	const panel = shadow.querySelector( '.panel' );
	const output = shadow.querySelector( '.text' );

	let range = null;
	let request = null;
	let session = null;
	let timer;

	/** Moves the anchor over the last line of the selection, which both popovers attach to. */
	const place = () => {
		const rects = range?.getClientRects();
		const rect = rects?.[ rects.length - 1 ];
		if ( rect ) {
			Object.assign( anchor.style, {
				left: `${ rect.left }px`,
				top: `${ rect.top }px`,
				width: `${ rect.width }px`,
				height: `${ rect.height }px`,
			} );
		}
	};

	/** Returns the selection's range when it is a short phrase inside the target, or null. */
	const selected = () => {
		const selection = getSelection();
		if ( ! selection.rangeCount || selection.isCollapsed ) {
			return null;
		}
		const current = selection.getRangeAt( 0 );
		const length = selection.toString().trim().length;
		return length && length <= MAX_SELECTION && root.contains( current.commonAncestorContainer ) ? current : null;
	};

	const onSelectionChange = () => {
		// Tabbing to the button can collapse the selection. Keep the button while it has focus.
		if ( shadow.activeElement || panel.matches( ':popover-open' ) ) {
			return;
		}
		const current = selected();
		if ( ! current ) {
			button.hidePopover();
			return;
		}
		range = current.cloneRange();
		// Makes the button the next Tab stop. Appending inside the block keeps tables and lists valid.
		blockOf( range.commonAncestorContainer ).append( host );
		host.style.colorScheme = document.documentElement.dataset.theme || 'light dark';
		place();
		button.showPopover();
	};

	document.addEventListener( 'selectionchange', () => {
		// Waits for a drag or a run of Shift+Arrow presses to settle.
		clearTimeout( timer );
		timer = setTimeout( onSelectionChange, 250 );
	} );
	addEventListener( 'scroll', place, { capture: true, passive: true } );
	addEventListener( 'resize', place );

	// Keeps the page selection from collapsing when the button is pressed.
	button.addEventListener( 'pointerdown', ( event ) => event.preventDefault() );
	button.addEventListener( 'keydown', ( event ) => {
		if ( event.key === 'Escape' ) {
			button.hidePopover();
		}
	} );
	button.addEventListener( 'click', () => explain( range ) );
	// Tabbing past the button leaves no selection change to hide it.
	button.addEventListener( 'focusout', () => setTimeout( onSelectionChange ) );
	panel.addEventListener( 'toggle', ( event ) => {
		if ( event.newState === 'closed' ) {
			request?.abort();
		}
	} );

	/**
	 * Asks the model about the selected text, with its paragraph as context.
	 *
	 * @param {Range} selection The selected phrase.
	 */
	async function explain( selection ) {
		const phrase = selection.toString().trim().replace( /\s+/g, ' ' );
		const context = blockOf( selection.commonAncestorContainer ).textContent.trim().replace( /\s+/g, ' ' ).slice( 0, MAX_CONTEXT );
		const controller = ( request = new AbortController() );

		button.hidePopover();
		output.textContent = 'Thinking…';
		panel.showPopover();
		panel.focus();

		let clone;
		try {
			// One base session holds the system prompt. Each question gets a clone, so earlier answers do not leak in.
			session ??= create( 'LanguageModel', { ...MODEL_OPTIONS, initialPrompts: [ { role: 'system', content: SYSTEM_PROMPT } ] }, ( loaded ) => {
				output.textContent = `Downloading the AI model, ${ Math.round( loaded * 100 ) }%…`;
			} ).catch( ( error ) => {
				session = null;
				throw error;
			} );
			clone = await ( await session ).clone( { signal: controller.signal } );
			const answer = await clone.prompt(
				`Passage: """${ context }"""\n\nExplain "${ phrase }" ${ LEVELS[ level ] || LEVELS.simple }.`,
				{ signal: controller.signal }
			);
			// The model sometimes adds markdown emphasis despite the instructions.
			output.textContent = answer.replace( /\*\*|__|`/g, '' ).trim();
		} catch ( error ) {
			if ( ! controller.signal.aborted ) {
				output.textContent = 'Sorry, no explanation could be generated.';
				console.error( error );
			}
		} finally {
			clone?.destroy();
		}
	}

	/**
	 * Returns the paragraph-like element around a node, or the target when the
	 * node spans several of them.
	 *
	 * @param {Node} node Node inside the target.
	 * @return {Element} The block.
	 */
	function blockOf( node ) {
		const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
		const block = element.closest( 'p, li, dd, dt, td, th, blockquote, figcaption, h1, h2, h3, h4, h5, h6' );
		return block && root.contains( block ) && block !== root ? block : root;
	}
} );
