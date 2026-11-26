// Stages a burst of confetti mid-air, a moment after the signup goes through.

/**
 * Seeds Math.random so every run throws the same burst.
 *
 * @param {import('playwright').Page} page
 */
export async function setup( page ) {
	await page.addInitScript( () => {
		let seed = 7;
		Math.random = () => ( ( seed = ( seed * 16807 ) % 2147483647 ) - 1 ) / 2147483646;
	} );
}

/**
 * Fires the cannon and catches the pieces in flight.
 *
 * @param {import('playwright').Page} page
 */
export default async function poster( page ) {
	await page.getByRole( 'button', { name: 'Subscribe' } ).click();
	await page.getByText( 'Thanks for subscribing!' ).waitFor();
	await page.locator( 'canvas' ).waitFor();
	// The thanks line pushes the note down; keep its last line in frame.
	await page.evaluate( () => scrollTo( 0, document.documentElement.scrollHeight ) );
	// Mid-flight on purpose: a few hundred milliseconds in, the burst fills the frame.
	await page.waitForTimeout( 320 );
}
