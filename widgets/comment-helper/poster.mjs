// Stages a "Fix grammar" suggestion shown next to the original comment, before it is accepted.

const FIXED = 'I really liked this post. It explains the topic well, and I will definitely try it on my own site tomorrow.';

/** Fakes the Prompt API, which headless Chromium cannot run, with a fixed correction. */
export async function setup( page ) {
	await page.addInitScript( ( reply ) => {
		const session = { prompt: async () => reply, clone: async () => session, destroy() {} };
		window.LanguageModel = { availability: async () => 'available', create: async () => session };
	}, FIXED );
}

export default async function poster( page ) {
	// Zoom out a touch so the toolbar and the side-by-side suggestion fit the frame together.
	await page.evaluate( () => ( document.documentElement.style.zoom = 0.9 ) );
	await page.getByRole( 'button', { name: 'Fix grammar' } ).click();
	const panel = page.getByRole( 'region', { name: 'Suggestion' } );
	await panel.getByText( FIXED ).waitFor();
	// Toolbar at the top with a little room above it, so the panel's bottom edge clears the frame.
	await page.getByRole( 'group', { name: 'Writing help' } ).evaluate( ( el ) => {
		el.style.scrollMarginTop = '8px';
		el.scrollIntoView();
	} );
}
