/**
 * Speed Badge: a small "Loaded in 0.83s" badge that opens a panel with the
 * page view's LCP, CLS and INP, measured live with `PerformanceObserver`.
 *
 * Options (data- attributes on the script tag):
 *   data-metric  Headline metric: `lcp` (default), `cls` or `inp`.
 *   data-param   Show the badge only when the URL has this query parameter.
 */
import { mountInline, options } from '../../shared/embed.js';

const { metric, param } = options( { metric: 'lcp' } );

/** Per metric: entry type, headline label, value format, and the good and poor thresholds. */
const METRICS = {
	lcp: [ 'largest-contentful-paint', 'Loaded in', ( ms ) => `${ ( ms / 1000 ).toFixed( 2 ) }s`, 2500, 4000 ],
	cls: [ 'layout-shift', 'Layout shift', ( value ) => value.toFixed( 2 ), 0.1, 0.25 ],
	inp: [ 'event', 'Responds in', ( ms ) => `${ Math.round( ms ) }ms`, 200, 500 ],
};
const RATINGS = [ 'good', 'needs improvement', 'poor' ];

const supported = self.PerformanceObserver?.supportedEntryTypes || [];
const shown = Object.keys( METRICS ).filter( ( key ) => supported.includes( METRICS[ key ][ 0 ] ) );
const headline = shown.includes( metric ) ? metric : shown[ 0 ];

/** Latest value per metric key. A missing key means nothing is measured yet. */
const values = {};

let button, table;

/** Writes the latest values to the badge and the panel. */
function render() {
	button.lastChild.textContent = headline in values ? METRICS[ headline ][ 2 ]( values[ headline ] ) : '…';
	table.innerHTML = shown
		.map( ( key ) => {
			const [ , , format, good, poor ] = METRICS[ key ];
			const value = values[ key ];
			const rating = ( value > good ) + ( value > poor );
			return `<tr><th>${ key.toUpperCase() }<td>${
				key in values ? `${ format( value ) }<td class=r${ rating }>${ RATINGS[ rating ] }` : 'waiting'
			}`;
		} )
		.join( '' );
}

/**
 * Calls `fn` with every entry of `type`, including ones recorded before the
 * widget loaded. Browsers ignore a type they do not support.
 */
function observe( type, fn, extra ) {
	new PerformanceObserver( ( entries ) => {
		entries.getEntries().forEach( fn );
		render();
	} ).observe( { type, buffered: true, ...extra } );
}

if ( shown.length && ( ! param || new URLSearchParams( location.search ).has( param ) ) ) {
	// color-scheme is inherited, so Canvas and light-dark() follow the page.
	const root = mountInline(
		'button,[popover]{font:13px system-ui;padding:4px 10px;border:1px solid;border-radius:1em;background:Canvas;color:CanvasText;text-align:start}' +
			// A minimum width for the number stops the badge resizing, and shifting the page, as it updates.
			'b{display:inline-block;min-width:5ch}' +
			'th,td{padding:2px 6px}' +
			'.r0{color:light-dark(#070,#4d6)}.r1{color:light-dark(#850,#fb3)}.r2{color:light-dark(#c00,#f77)}' +
			// Without anchor positioning the popover keeps its default, centered placement.
			'@supports(position-area:top){[popover]{inset:auto;margin:4px 0;position-area:block-end span-inline-end;position-try-fallbacks:flip-block,flip-inline}}'
	);
	root.innerHTML += `<button popovertarget=p>${ METRICS[ headline ][ 1 ] } <b></b></button><table popover id=p></table>`;
	[ button, table ] = root.querySelectorAll( 'button,table' );

	observe( 'largest-contentful-paint', ( entry ) => ( values.lcp = entry.startTime ) );

	if ( shown.includes( 'cls' ) ) {
		// CLS is the largest burst of shifts, each burst under 5s with gaps under 1s.
		let burst = 0,
			first = 0,
			last = -1e4;
		values.cls = 0;
		observe( 'layout-shift', ( entry ) => {
			if ( ! entry.hadRecentInput ) {
				if ( entry.startTime - last > 1000 || entry.startTime - first > 5000 ) {
					burst = 0;
					first = entry.startTime;
				}
				burst += entry.value;
				last = entry.startTime;
				values.cls = Math.max( values.cls, burst );
			}
		} );
	}

	// INP is the slowest interaction. web-vitals skips one outlier per 50 interactions, which few page views reach.
	const record = ( entry ) => {
		if ( entry.interactionId ) {
			values.inp = Math.max( entry.duration, values.inp || 0 );
		}
	};
	observe( 'event', record, { durationThreshold: 16 } );
	// A fast first interaction can fall under the 16ms event threshold.
	observe( 'first-input', record );

	render();
}
