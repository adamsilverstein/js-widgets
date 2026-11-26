/**
 * Test helpers: one headless Chromium and one static server per test file,
 * started on first use and stopped when the file's tests finish.
 */
import { after } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serve } from '../scripts/serve.mjs';

let started;

const start = () =>
	( started ??= Promise.all( [
		chromium.launch(),
		serve( fileURLToPath( new URL( '../site', import.meta.url ) ) ),
	] ) );

after( async () => {
	if ( started ) {
		const [ browser, server ] = await started;
		await browser.close();
		await server.close();
	}
} );

/**
 * Opens a widget's built demo page. Run `npm run build` first (`npm test` does).
 *
 * @param {string} slug             Widget directory name.
 * @param {Object} [contextOptions] Playwright context options, eg. `{ reducedMotion: 'reduce' }`.
 * @return {Promise<{page: import('playwright').Page, errors: Error[], close: Function}>}
 *         The page, the uncaught errors it has thrown so far, and a function to close it.
 */
export async function openDemo( slug, contextOptions = {} ) {
	const [ browser, server ] = await start();
	const context = await browser.newContext( contextOptions );
	const page = await context.newPage();
	const errors = [];
	page.on( 'pageerror', ( error ) => errors.push( error ) );
	await page.goto( `${ server.url }demos/${ slug }/` );
	return { page, errors, close: () => context.close() };
}
