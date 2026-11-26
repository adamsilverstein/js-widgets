// Stages the chat panel open, with one question asked and a streamed answer shown.

/** Mocks the Prompt API, which headless Chromium lacks, with a fixed streamed answer. */
export async function setup( page ) {
	await page.addInitScript( () => {
		window.LanguageModel = {
			availability: async () => 'available',
			create: async () => ( {
				async *promptStreaming() {
					yield 'WordPress shipped ';
					yield 'a widgets screen in 2007.';
				},
			} ),
		};
	} );
}

export default async function poster( page ) {
	// The panel needs more height than the standard frame has. Same 16:10 shape, half again as large.
	await page.setViewportSize( { width: 660, height: 412 } );
	// Without motion, so the panel is not caught mid-fade.
	await page.emulateMedia( { reducedMotion: 'reduce' } );
	await page.getByRole( 'button', { name: 'Ask this page' } ).click();
	await page.getByRole( 'textbox', { name: 'Your question' } ).fill( 'When did widgets arrive?' );
	await page.keyboard.press( 'Enter' );
	await page.locator( '.msg.ai', { hasText: 'in 2007.' } ).waitFor();
	await page.getByRole( 'button', { name: 'Ask', exact: true } ).waitFor();
}
