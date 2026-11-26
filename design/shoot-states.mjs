/** Design tooling: screenshots of the concept pages in particular states. */
import { chromium } from 'playwright';
import { serve } from '../scripts/serve.mjs';

const server = await serve( new URL( '../site', import.meta.url ).pathname );
const browser = await chromium.launch( { channel: 'chrome' } );
const shot = async ( name, url, { width = 1440, height = 960, dark = false, full = false } = {}, act ) => {
	const context = await browser.newContext( { viewport: { width, height }, deviceScaleFactor: width < 600 ? 2 : 1, colorScheme: dark ? 'dark' : 'light' } );
	const page = await context.newPage();
	await page.goto( server.url + url );
	await page.waitForTimeout( 1500 );
	await act?.( page );
	await page.waitForTimeout( 1500 );
	await page.screenshot( { path: `design/shots/${ name }.png`, fullPage: full } );
	await context.close();
};

await shot( 'a-workbench', 'concept-workbench.html' );
await shot( 'a-workbench-edited', 'concept-workbench.html', {}, async ( page ) => {
	await page.fill( 'input[name="data-size"]', '128' );
	await page.fill( 'input[name="data-color"]', '#2447d8' );
	await page.waitForTimeout( 800 );
	await page.mouse.move( 700, 420 );
} );
await shot( 'a-workbench-ai-dark', 'concept-workbench.html#tldr-button', { dark: true } );
await shot( 'a-workbench-synth', 'concept-workbench.html#mini-synth' );
await shot( 'a-workbench-phone', 'concept-workbench.html#pet-companion', { width: 390, height: 844 } );
await shot( 'b-catalog', 'concept-catalog.html' );
await shot( 'b-catalog-open', 'concept-catalog.html#tilt-card', {}, async ( page ) => {
	await page.evaluate( () => scrollBy( 0, -120 ) );
	await page.mouse.move( 480, 420 );
} );
await shot( 'b-catalog-phone', 'concept-catalog.html', { width: 390, height: 844 } );
await browser.close();
await server.close();
