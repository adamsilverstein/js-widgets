/*
 * Lets the gallery try out edited options: applies `data-` overrides from the
 * URL fragment (eg. `#data-size=96`) to the widget's script tag. The observer
 * fires once the parser has inserted the tag and before the script runs, so
 * the widget reads the new values.
 */
( () => {
	const overrides = [ ...new URLSearchParams( location.hash.slice( 1 ) ) ].filter( ( [ name ] ) => name.startsWith( 'data-' ) );
	if ( ! overrides.length ) {
		return;
	}
	new MutationObserver( ( records, observer ) => {
		const script = document.querySelector( 'script[src$=".min.js"]' );
		if ( script ) {
			observer.disconnect();
			for ( const [ name, value ] of overrides ) {
				script.setAttribute( name, value );
			}
		}
	} ).observe( document.documentElement, { childList: true, subtree: true } );
} )();
