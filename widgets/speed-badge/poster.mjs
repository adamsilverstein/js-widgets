// Stages the badge open on its panel, with a slow click rating INP "needs improvement".
export default async function poster( page ) {
	// The demo's slow button blocks for 300ms, so INP has a value to rate.
	await page.getByRole( 'button', { name: 'Slow click' } ).click();
	// Scroll to the footer first, so the panel has room to open in the frame.
	await page.evaluate( () => scrollTo( 0, document.body.scrollHeight ) );
	await page.getByRole( 'button', { name: /^Loaded in \d/ } ).click();
	await page.locator( 'table' ).getByText( 'needs improvement' ).waitFor();
}
