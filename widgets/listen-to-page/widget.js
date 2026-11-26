/**
 * Listen to This Page: reads an article aloud with the browser's own voices,
 * highlighting the sentence being spoken and keeping it in view.
 *
 * Options (data- attributes on the script tag):
 *   data-target  CSS selector for the element to read. Default "article".
 *   data-rate    Starting speed, 0.5 to 2. Default 1.
 *   data-skip    Extra CSS selector for content not to read, added to the defaults.
 */
import { createHost, options, ready, reducedMotion } from '../../shared/embed.js';

const config = options( { target: 'article', rate: '1', skip: '' } );
const synth = window.speechSynthesis;

/** Never read aloud. Inline `code` is read, since it is part of a sentence. */
const SKIP = [
	'nav, aside, pre, figure, sup, script, style, noscript, template, button, select, textarea, svg, [aria-hidden="true"]',
	config.skip,
]
	.filter( Boolean )
	.join( ', ' );

const RATES = [ 0.75, 1, 1.25, 1.5, 2 ];
const HIGHLIGHT = 'jsw-listen';

const CSS_TEXT = `
	:host { display: block; position: sticky; top: 0; z-index: 1; }
	:host([hidden]) { display: none; }
	div { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 8px 0; background: Canvas; color: CanvasText; }
	button, select { font: inherit; font-size: 0.9rem; min-height: 36px; padding: 4px 12px; border: 1px solid; border-radius: 18px; background: none; color: inherit; cursor: pointer; }
	button { display: inline-flex; align-items: center; gap: 6px; }
	button[aria-label] { padding: 4px 8px; }
	:focus-visible { outline: 2px solid Highlight; outline-offset: 2px; }
	svg { width: 16px; height: 16px; fill: currentColor; }
	.count { font-size: 0.85rem; opacity: 0.75; font-variant-numeric: tabular-nums; }
`;

const icon = ( path ) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ path }"/></svg>`;
const PLAY = icon( 'M7 4v16l13-8z' );
const PAUSE = icon( 'M6 4h4v16H6zm8 0h4v16h-4z' );

/**
 * Picks the voice for a language: an exact match before one for the base
 * language, and the platform default first within each.
 *
 * @param {string} lang BCP 47 tag, eg. `en-GB`.
 * @return {SpeechSynthesisVoice|undefined} The voice, or undefined to let the browser choose.
 */
function voiceFor( lang ) {
	const tag = ( value ) => value.toLowerCase().replace( '_', '-' );
	const wanted = tag( lang );
	const voices = synth.getVoices();
	const rank = ( voice ) => ( tag( voice.lang ) === wanted ? 2 : 0 ) + voice.default;
	return voices
		.filter( ( voice ) => tag( voice.lang ).split( '-' )[ 0 ] === wanted.split( '-' )[ 0 ] )
		.sort( ( a, b ) => rank( b ) - rank( a ) )[ 0 ];
}

/**
 * Splits the readable text of `root` into sentences, each with a Range over
 * the original text nodes so it can be highlighted without touching the DOM.
 *
 * @param {Element} root Element to read.
 * @param {string}  lang Language for sentence breaking.
 * @return {{text: string, range: Range}[]} Sentences in document order.
 */
function sentences( root, lang ) {
	// Whitespace-only text nodes are kept: they are the spaces between inline elements.
	const walker = document.createTreeWalker( root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, ( node ) => {
		if ( node.nodeType === Node.TEXT_NODE || node.localName === 'br' ) {
			return NodeFilter.FILTER_ACCEPT;
		}
		return node.matches( SKIP ) || ! node.checkVisibility( { visibilityProperty: true } )
			? NodeFilter.FILTER_REJECT
			: NodeFilter.FILTER_SKIP;
	} );

	// Split the text nodes into runs at block boundaries and <br>, so a sentence never runs on into the next paragraph or line.
	const runs = [];
	let last;
	for ( let node = walker.nextNode(); node; node = walker.nextNode() ) {
		if ( node.localName === 'br' ) {
			last = null;
			continue;
		}
		let block = node.parentElement;
		while ( block !== root && getComputedStyle( block ).display.startsWith( 'inline' ) ) {
			block = block.parentElement;
		}
		if ( block !== last ) {
			runs.push( [] );
			last = block;
		}
		runs.at( -1 ).push( node );
	}

	const segmenter = window.Intl?.Segmenter && new Intl.Segmenter( lang, { granularity: 'sentence' } );
	const result = [];
	for ( const nodes of runs ) {
		const text = nodes.map( ( node ) => node.data ).join( '' );

		// Maps an offset in the run's text back to a text node and an offset in it.
		const locate = ( offset ) => {
			for ( const node of nodes ) {
				if ( offset <= node.length ) {
					return [ node, offset ];
				}
				offset -= node.length;
			}
		};

		// Without Intl.Segmenter, each run is read as one sentence.
		const parts = segmenter ? segmenter.segment( text ) : [ { segment: text, index: 0 } ];
		for ( const { segment, index } of parts ) {
			const trimmed = segment.trim();
			if ( ! trimmed ) {
				continue;
			}
			const start = index + segment.indexOf( trimmed );
			const range = new Range();
			range.setStart( ...locate( start ) );
			range.setEnd( ...locate( start + trimmed.length ) );
			result.push( { text: trimmed.replace( /\s+/g, ' ' ), range } );
		}
	}
	return result;
}

ready( () => {
	const target = document.querySelector( config.target );
	if ( ! synth || ! target ) {
		return;
	}

	const lang = target.closest( '[lang]' )?.lang || navigator.language;
	let list = [];
	let current = 0;
	let playing = false;
	// Bumped on every new utterance, so a cancelled one cannot advance the reader.
	let token = 0;
	let rate = Math.min( 2, Math.max( 0.5, Number( config.rate ) || 1 ) );
	if ( ! RATES.includes( rate ) ) {
		RATES.push( rate );
		RATES.sort( ( a, b ) => a - b );
	}

	const host = createHost( CSS_TEXT );
	host.hidden = true;
	host.shadowRoot.innerHTML += `<div role="group" aria-label="Listen to this page">
		<button type="button" class="play">${ PLAY }<span>Listen</span></button>
		<button type="button" class="prev" aria-label="Previous sentence">${ icon( 'M6 5h2v14H6zm3 7 10 7V5z' ) }</button>
		<button type="button" class="next" aria-label="Next sentence">${ icon( 'M16 5h2v14h-2zM5 19l10-7L5 5z' ) }</button>
		<select aria-label="Speed">${ RATES.map( ( value ) => `<option value="${ value }">${ value }×</option>` ).join( '' ) }</select>
		<span class="count"></span>
	</div>`;
	target.before( host );

	const $ = ( selector ) => host.shadowRoot.querySelector( selector );
	const playButton = $( '.play' );
	const speed = $( 'select' );
	const status = $( '.count' );
	speed.value = rate;

	/*
	 * Document level styles: ::highlight() applies where the article text lives,
	 * and the bar's Canvas background follows the page's data-theme.
	 */
	host.dataset.jswListen = '';
	const sheet = new CSSStyleSheet();
	sheet.replaceSync( `::highlight(${ HIGHLIGHT }) { background-color: #ffe27a; color: #111; }
		[data-theme=dark] [data-jsw-listen] { color-scheme: dark; }
		[data-theme=light] [data-jsw-listen] { color-scheme: light; }` );
	document.adoptedStyleSheets = [ ...document.adoptedStyleSheets, sheet ];

	const render = () => {
		playButton.innerHTML = playing ? `${ PAUSE }<span>Pause</span>` : `${ PLAY }<span>${ list.length ? 'Resume' : 'Listen' }</span>`;
		status.textContent = list.length ? `${ current + 1 } / ${ list.length }` : '';
	};

	const highlight = ( range ) => {
		if ( window.Highlight ) {
			CSS.highlights.set( HIGHLIGHT, new Highlight( range ) );
		}
		const rect = range.getBoundingClientRect();
		if ( rect.top < host.offsetHeight || rect.bottom > innerHeight ) {
			// Ranges cannot scroll themselves, so scroll by the difference to center the sentence.
			scrollBy( { top: rect.top - innerHeight / 2, behavior: reducedMotion() ? 'instant' : 'smooth' } );
		}
	};

	const stop = () => {
		playing = false;
		token++;
		synth.cancel();
		render();
	};

	const reset = () => {
		stop();
		list = [];
		current = 0;
		CSS.highlights?.delete( HIGHLIGHT );
		render();
	};

	/** Speaks sentence `index`, then the ones after it. */
	const speak = ( index ) => {
		if ( index < 0 || index >= list.length ) {
			reset();
			return;
		}
		const mine = ++token;
		current = index;
		playing = true;
		synth.cancel();

		const utterance = new SpeechSynthesisUtterance( list[ index ].text );
		utterance.lang = lang;
		utterance.voice = voiceFor( lang ) || null;
		utterance.rate = rate;
		utterance.onend = () => {
			if ( mine === token ) {
				speak( index + 1 );
			}
		};
		// Our own cancel() calls bump the token first, so an error that still
		// matches it came from elsewhere, eg. another script cancelling speech.
		utterance.onerror = () => {
			if ( mine === token ) {
				stop();
			}
		};
		synth.speak( utterance );
		highlight( list[ index ].range );
		render();
	};

	const start = ( index = current ) => {
		if ( ! list.length ) {
			list = sentences( target, lang );
		}
		speak( index );
	};

	playButton.addEventListener( 'click', () => ( playing ? stop() : start() ) );
	$( '.prev' ).addEventListener( 'click', () => start( Math.max( 0, current - 1 ) ) );
	$( '.next' ).addEventListener( 'click', () => start( list.length ? current + 1 : 0 ) );
	speed.addEventListener( 'change', () => {
		rate = Number( speed.value );
		if ( playing ) {
			speak( current );
		}
	} );

	// Once reading has started, clicking a sentence reads from there.
	target.addEventListener( 'click', ( event ) => {
		if ( ! list.length || event.target.closest( 'a, button, input, select, textarea, label' ) || ! getSelection().isCollapsed ) {
			return;
		}
		const index = list.findIndex( ( { range } ) =>
			[ ...range.getClientRects() ].some(
				( rect ) => event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom
			)
		);
		if ( index !== -1 ) {
			speak( index );
		}
	} );

	// Browsers may keep speaking after navigation, or when restored from the back/forward cache.
	addEventListener( 'pagehide', stop );

	// Voices often load after the page does, and some platforms have none at all.
	const showIfVoices = () => {
		host.hidden = ! synth.getVoices().length;
	};
	synth.addEventListener?.( 'voiceschanged', showIfVoices );
	showIfVoices();
	render();
} );
