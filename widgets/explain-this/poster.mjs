// Stages "hit counter" selected in the article with its explanation popover open.

export async function setup( page ) {
	await page.addInitScript( () => {
		const session = {
			clone: async () => session,
			prompt: async () => 'A small tally on a web page that counts and shows how many times the page has been visited.',
			destroy() {},
		};
		window.LanguageModel = { availability: async () => 'available', create: async () => session };
	} );
}

export default async function poster( page ) {
	await page.evaluate( () => {
		const paragraph = document.querySelector( 'article p' );
		const text = paragraph.firstChild;
		const start = text.data.indexOf( 'hit counter' );
		const range = document.createRange();
		range.setStart( text, start );
		range.setEnd( text, start + 'hit counter'.length );
		scrollTo( 0, paragraph.getBoundingClientRect().top + scrollY - 16 );
		getSelection().removeAllRanges();
		getSelection().addRange( range );
	} );
	await page.getByRole( 'button', { name: 'Explain' } ).click();
	await page.getByRole( 'dialog', { name: 'AI explanation' } ).getByText( 'counts and shows' ).waitFor();
}
