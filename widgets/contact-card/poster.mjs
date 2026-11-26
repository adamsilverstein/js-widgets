// Stages the card open, showing the call and email actions and the contact form.

// The open card and its button are about 500px tall, so shrink the page to fit the 275px frame.
const ZOOM = 0.5;

export default async function poster( page ) {
	await page.evaluate( ( zoom ) => ( document.documentElement.style.zoom = zoom ), ZOOM );
	await page.getByRole( 'button', { name: 'Contact us' } ).click();
	const card = page.getByRole( 'dialog', { name: 'Contact us' } );
	await card.getByRole( 'button', { name: 'Send' } ).waitFor();
	// The card is placed in unzoomed pixels, so scale its offsets into the zoomed page.
	await card.evaluate( ( el, zoom ) => {
		for ( const prop of [ 'top', 'right', 'bottom', 'left', 'maxHeight' ] ) {
			if ( el.style[ prop ] ) {
				el.style[ prop ] = `${ parseFloat( el.style[ prop ] ) / zoom }px`;
			}
		}
	}, ZOOM );
	// Let the open transition finish so the card is not caught half faded.
	await card.evaluate( ( el ) => Promise.all( el.getAnimations().map( ( a ) => a.finished ) ) );
}
