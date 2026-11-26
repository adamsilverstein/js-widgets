/**
 * `npm run posters`: saves a screenshot of every built demo to
 * `site/posters/<slug>.png`. The README shows them in place of live demos,
 * which GitHub cannot run. They are published with the gallery and never
 * committed. Run `npm run build` first.
 *
 * A widget that only shows itself with a query string or fragment sets
 * `poster` in widget.json, eg. `"poster": "?alt-audit"`.
 */
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';
import { serve } from './serve.mjs';

const site = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '../site' );
const widgets = JSON.parse( await readFile( path.join( site, 'widgets.json' ), 'utf8' ) );
await mkdir( path.join( site, 'posters' ), { recursive: true } );

const server = await serve( site );
const browser = await chromium.launch();
try {
	for ( const widget of widgets ) {
		// 16:10 at double density, sharp at a third of the README's width.
		const context = await browser.newContext( { viewport: { width: 440, height: 275 }, deviceScaleFactor: 2 } );
		const page = await context.newPage();
		await page.goto( `${ server.url }demos/${ widget.slug }/${ widget.poster || '' }` );
		// Bring the pointer in so widgets that react to it show some life, then let them settle.
		await page.mouse.move( 300, 110 );
		await page.waitForTimeout( 1200 );
		await page.screenshot( { path: path.join( site, 'posters', `${ widget.slug }.png` ) } );
		await context.close();
	}
	console.log( `Saved ${ widgets.length } poster(s) to site/posters/` );
} finally {
	await browser.close();
	await server.close();
}
