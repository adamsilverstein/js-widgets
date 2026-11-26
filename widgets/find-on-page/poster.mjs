// Stages a search for "widget" with several matches highlighted in view and the "4 of 11" count showing.
export default async function poster( page ) {
	const input = page.getByRole( 'searchbox', { name: 'Find on page' } );
	await input.fill( 'widget' );
	// Wheel the section with the most matches, and its heading, up under the search box.
	const top = await page.locator( 'h2', { hasText: 'Widgets move into the sidebar' } ).evaluate( ( el ) => Math.round( el.getBoundingClientRect().top + scrollY - 64 ) );
	await page.mouse.wheel( 0, top );
	await page.waitForFunction( ( y ) => Math.abs( scrollY - y ) < 1, top );
	// Step to a match in that section, so the active highlight sits among the others.
	for ( let i = 0; i < 3; i++ ) {
		await input.press( 'Enter' );
	}
	await page.getByRole( 'status' ).filter( { hasText: /^4 of \d+$/ } ).waitFor();
}
