// Stages the article scrolled 40 percent: the bar part filled and the minutes left pill showing.
export default async function poster( page ) {
	await page.evaluate( () => {
		const article = document.querySelector( 'article' );
		const top = scrollY + article.getBoundingClientRect().top;
		scrollTo( 0, top + 0.4 * ( article.offsetHeight - innerHeight ) );
	} );
	// The bar and pill follow the scroll on the next frames; wait until they have caught up.
	await page.waitForFunction( () => {
		const root = document.querySelector( 'body > div[aria-hidden="true"]' )?.shadowRoot;
		const scale = root && new DOMMatrix( getComputedStyle( root.querySelector( 'div' ) ).transform ).a;
		return scale > 0.35 && scale < 0.45 && Number( getComputedStyle( root.querySelector( 'b' ) ).opacity ) === 1;
	} );
}
