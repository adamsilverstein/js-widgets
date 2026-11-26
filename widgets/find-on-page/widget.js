/**
 * Find on Page: a floating search box that highlights matches inside an
 * element. Matches are painted with the CSS Custom Highlight API, so the
 * searched content is never rewritten.
 *
 * Options (data- attributes on the script tag):
 *   data-target    CSS selector for the element to search. Default "main", then <body>.
 *   data-position  Corner the box floats in. Default "top-right".
 *   data-hotkey    A key that focuses the box, eg. "/". Default none.
 */
import { mountCorner, options, ready, reducedMotion } from '../../shared/embed.js';

const { target, position, hotkey } = options( { target: 'main', position: 'top-right' } );

const MATCH = 'jsw-find';
const ACTIVE = 'jsw-find-active';

const CSS_TEXT = `
	div{display:flex;align-items:center;gap:2px;max-width:calc(100vw - 32px);box-sizing:border-box;padding:4px;border:1px solid #8888;border-radius:10px;background:Canvas;color:CanvasText;font:14px/1.2 system-ui,sans-serif;box-shadow:0 2px 10px #0003}
	input{flex:1;min-width:0;width:11em;margin-right:2px;padding:6px 8px;border:1px solid #8888;border-radius:6px;background:Field;color:FieldText;font:inherit}
	output{padding:0 4px;font-size:13px;white-space:nowrap;opacity:.75}
	output:empty{padding:0}
	button{width:32px;height:32px;flex:none;border:0;border-radius:6px;background:none;color:inherit;font:inherit;cursor:pointer}
	button:hover:not(:disabled){background:#8883}
	button:disabled{opacity:.35;cursor:default}
	:focus-visible{outline:2px solid Highlight;outline-offset:1px}
`;

ready( () => {
	if ( ! globalThis.CSS?.highlights ) {
		return;
	}
	const scope = document.querySelector( target ) || document.body;

	// ::highlight() only styles document text from a document-level sheet.
	const sheet = new CSSStyleSheet();
	sheet.replaceSync( `::highlight(${ MATCH }){background:#ffe14d;color:#000}::highlight(${ ACTIVE }){background:#ff8c1a;color:#000}` );
	document.adoptedStyleSheets = [ ...document.adoptedStyleSheets, sheet ];

	const root = mountCorner( CSS_TEXT, position );
	root.innerHTML += `<div role="search">
		<input type="search" placeholder="Find on page" aria-label="Find on page" autocomplete="off" spellcheck="false" enterkeyhint="search">
		<output role="status"></output>
		<button type="button" aria-label="Previous match" disabled>&uarr;</button>
		<button type="button" aria-label="Next match" disabled>&darr;</button>
	</div>`;
	const input = root.querySelector( 'input' );
	const count = root.querySelector( 'output' );
	const [ prev, next ] = root.querySelectorAll( 'button' );

	// Follow the page's dark mode toggle, or the system setting when there is none.
	const theme = () => ( root.host.style.colorScheme = document.documentElement.dataset.theme || 'light dark' );
	new MutationObserver( theme ).observe( document.documentElement, { attributeFilter: [ 'data-theme' ] } );
	theme();

	let matches = [];
	let active = -1;

	/**
	 * Returns a Range for every case insensitive match of `query` in the scope.
	 * Text nodes are searched as one string, so a match can span inline
	 * elements such as half a phrase in bold.
	 *
	 * @param {string} query Lowercased search text.
	 * @return {Range[]} Ranges in document order.
	 */
	function find( query ) {
		const nodes = [];
		const starts = [];
		let text = '';
		const walker = document.createTreeWalker( scope, NodeFilter.SHOW_TEXT );
		for ( let node; ( node = walker.nextNode() ); ) {
			const parent = node.parentElement;
			// Skip hidden text, except in closed <details>, which open when a match is reached.
			if ( ! parent.checkVisibility() && ! parent.closest( 'details:not([open])' ) ) {
				continue;
			}
			const lower = node.data.toLowerCase();
			nodes.push( node );
			starts.push( text.length );
			// A few characters change length when lowercased, which would shift the offsets.
			text += lower.length === node.data.length ? lower : node.data;
		}

		// Matches come in order, so one cursor walks the nodes once.
		let n = 0;
		const point = ( offset, isEnd ) => {
			const pos = isEnd ? offset - 1 : offset;
			while ( n < nodes.length - 1 && starts[ n + 1 ] <= pos ) {
				n++;
			}
			return [ nodes[ n ], offset - starts[ n ] ];
		};

		const ranges = [];
		for ( let i = text.indexOf( query ); i > -1; i = text.indexOf( query, i + query.length ) ) {
			const range = new Range();
			range.setStart( ...point( i, false ) );
			range.setEnd( ...point( i + query.length, true ) );
			ranges.push( range );
		}
		return ranges;
	}

	/**
	 * Makes match `index` the active one, wrapping at either end, and scrolls
	 * it into view.
	 *
	 * @param {number} index Match index. Out of range values wrap around.
	 */
	function go( index ) {
		active = matches.length ? ( index + matches.length ) % matches.length : -1;
		const range = matches[ active ];
		CSS.highlights.set( ACTIVE, range ? new Highlight( range ) : new Highlight() );
		count.value = input.value.trim() ? ( range ? `${ active + 1 } of ${ matches.length }` : 'No matches' ) : '';
		prev.disabled = next.disabled = matches.length < 2;
		if ( ! range ) {
			return;
		}

		for ( let details; ( details = range.startContainer.parentElement.closest( 'details:not([open])' ) ); ) {
			details.open = true;
		}
		const { top, bottom } = range.getBoundingClientRect();
		if ( top < 0 || bottom > innerHeight ) {
			scrollBy( { top: top - innerHeight / 3, behavior: reducedMotion() ? 'instant' : 'smooth' } );
		}
	}

	function search() {
		const query = input.value.toLowerCase();
		matches = query.trim() ? find( query ) : [];
		const highlight = new Highlight();
		matches.forEach( ( range ) => highlight.add( range ) );
		CSS.highlights.set( MATCH, highlight );
		go( 0 );
	}

	input.addEventListener( 'input', search );
	input.addEventListener( 'keydown', ( event ) => {
		if ( event.key === 'Enter' ) {
			event.preventDefault();
			go( active + ( event.shiftKey ? -1 : 1 ) );
		} else if ( event.key === 'Escape' ) {
			event.preventDefault();
			input.value = '';
			search();
		}
	} );
	prev.addEventListener( 'click', () => go( active - 1 ) );
	next.addEventListener( 'click', () => go( active + 1 ) );

	if ( hotkey ) {
		addEventListener( 'keydown', ( event ) => {
			// composedPath() sees through shadow roots, including this widget's own input.
			const typingIn = event.composedPath()[ 0 ];
			if (
				event.key !== hotkey ||
				event.ctrlKey ||
				event.metaKey ||
				event.altKey ||
				typingIn.isContentEditable ||
				/^(INPUT|TEXTAREA|SELECT)$/.test( typingIn.tagName )
			) {
				return;
			}
			event.preventDefault();
			input.focus();
			input.select();
		} );
	}
} );
