/**
 * Stands in for a form backend on the demo page, so the form can be tried
 * without one. A message containing "error" fails, to show the error state.
 */
const realFetch = window.fetch;

window.fetch = async ( url, init ) => {
	if ( url !== 'https://example.com/contact' ) {
		return realFetch( url, init );
	}
	await new Promise( ( resolve ) => setTimeout( resolve, 900 ) );
	const ok = ! /error/i.test( JSON.parse( init.body ).message );
	return new Response( '{}', { status: ok ? 200 : 500 } );
};
