// Stages the TL;DR button clicked, with a three point summary from a mocked Summarizer.

export function setup( page ) {
	return page.addInitScript( () => {
		const points = [ '* Widgets began as pasted snippets.\n', '* Blogs moved them into sidebars.\n', '* Modern APIs make new ones possible.' ];
		window.Summarizer = {
			availability: async () => 'available',
			create: async () => ( {
				summarizeStreaming: () =>
					new ReadableStream( {
						start( controller ) {
							points.forEach( ( point ) => controller.enqueue( point ) );
							controller.close();
						},
					} ),
				destroy() {},
			} ),
		};
	} );
}

export default async function poster( page ) {
	await page.getByRole( 'button', { name: 'TL;DR' } ).click();
	await page.getByRole( 'listitem' ).filter( { hasText: 'Modern APIs' } ).waitFor();
	// Article title at the top, so the button and summary read in context.
	await page.locator( 'article h1' ).evaluate( ( title ) => title.scrollIntoView( { block: 'start' } ) );
}
