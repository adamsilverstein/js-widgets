/* Copy buttons for the gallery. The snippets are inlined by the build as JSON. */
const snippets = JSON.parse( document.getElementById( 'snippets' ).textContent );
const status = document.querySelector( '.status' );

document.addEventListener( 'click', async ( event ) => {
	const button = event.target.closest( 'button[data-copy]' );
	if ( ! button ) {
		return;
	}
	// Kept from the first click: by the second, the text may be "Copied".
	const label = ( button.dataset.label ??= button.textContent );
	let message = 'Copied';
	try {
		await navigator.clipboard.writeText( snippets[ button.dataset.widget ][ button.dataset.copy ] );
	} catch {
		message = 'Copy failed';
	}
	button.textContent = message;
	status.textContent = `${ message }: ${ label }`;
	clearTimeout( button.resetTimer );
	button.resetTimer = setTimeout( () => {
		button.textContent = label;
	}, 1500 );
} );
