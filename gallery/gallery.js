/* Copy buttons for the gallery. The snippets are inlined by the build as JSON. */
const snippets = JSON.parse( document.getElementById( 'snippets' ).textContent );
const status = document.querySelector( '.status' );

document.addEventListener( 'click', async ( event ) => {
	const button = event.target.closest( 'button[data-copy]' );
	if ( ! button ) {
		return;
	}
	const label = button.textContent;
	let message = 'Copied';
	try {
		await navigator.clipboard.writeText( snippets[ button.dataset.widget ][ button.dataset.copy ] );
	} catch {
		message = 'Copy failed';
	}
	button.textContent = message;
	status.textContent = `${ message }: ${ label }`;
	setTimeout( () => {
		button.textContent = label;
	}, 1500 );
} );
