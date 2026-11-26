/**
 * Design tooling: screenshots of built pages with the system Chrome.
 *   node design/shoot.mjs thumbs            one poster per widget demo -> site/posters/<slug>.png
 *   node design/shoot.mjs page <path> <out> [width] [height] [full] [dark]
 */
import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import { serve } from '../scripts/serve.mjs';

const [ mode, ...args ] = process.argv.slice( 2 );
const server = await serve( new URL( '../site', import.meta.url ).pathname );
const browser = await chromium.launch( { channel: 'chrome' } );

if ( mode === 'thumbs' ) {
	const widgets = JSON.parse( await readFile( new URL( '../site/widgets.json', import.meta.url ), 'utf8' ) );
	await mkdir( new URL( '../site/posters/', import.meta.url ), { recursive: true } );
	for ( const widget of widgets ) {
		const context = await browser.newContext( { viewport: { width: 440, height: 275 }, deviceScaleFactor: 2 } );
		const page = await context.newPage();
		await page.route( /api\.open-meteo\.com/, ( route ) => route.abort() );
		await page.goto( `${ server.url }demos/${ widget.slug }/${ widget.slug === 'alt-text-helper' ? '?alt-audit' : '' }` ).catch( () => {} );
		await page.mouse.move( 300, 110 );
		await page.waitForTimeout( 1200 );
		await page.screenshot( { path: `site/posters/${ widget.slug }.png` } );
		await context.close();
		console.log( widget.slug );
	}
} else {
	const [ target, out, width = 1440, height = 900, full = '', dark = '' ] = args;
	const context = await browser.newContext( { viewport: { width: +width, height: +height }, deviceScaleFactor: 1, colorScheme: dark === 'dark' ? 'dark' : 'light' } );
	const page = await context.newPage();
	await page.goto( server.url + target );
	await page.waitForTimeout( 2500 );
	await page.screenshot( { path: out, fullPage: full === 'full' } );
}
await browser.close();
await server.close();
