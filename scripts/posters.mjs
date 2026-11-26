/**
 * `npm run posters`: saves a screenshot of every built demo to
 * `site/posters/<slug>.png`. The README shows them in place of live demos,
 * which GitHub cannot run. They are published with the gallery and never
 * committed. Run `npm run build` first.
 *
 * A widget that only shows itself with a query string or fragment sets
 * `poster` in widget.json, eg. `"poster": "?alt-audit"`.
 *
 * A widget that looks like nothing until it is used adds
 * `widgets/<slug>/poster.mjs` to stage its screenshot:
 *
 *   // Optional. Runs before the demo loads, eg. to mock a browser API or a request.
 *   export async function setup( page ) {}
 *   // Runs once the demo has loaded. Leaves the widget in the state worth showing.
 *   export default async function poster( page ) {}
 */
import { mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';
import { serve } from './serve.mjs';

const root = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '..' );
const site = path.join( root, 'site' );
const widgets = JSON.parse( await readFile( path.join( site, 'widgets.json' ), 'utf8' ) );
await mkdir( path.join( site, 'posters' ), { recursive: true } );

const server = await serve( site );
const browser = await chromium.launch();
let failed = 0;
try {
	for ( const widget of widgets ) {
		// 16:10 at double density, sharp at a third of the README's width.
		const context = await browser.newContext( { viewport: { width: 440, height: 275 }, deviceScaleFactor: 2 } );
		const page = await context.newPage();
		const file = path.join( root, 'widgets', widget.slug, 'poster.mjs' );
		const stage = existsSync( file ) ? await import( pathToFileURL( file ) ) : {};
		try {
			await stage.setup?.( page );
			await page.goto( `${ server.url }demos/${ widget.slug }/${ widget.poster || '' }` );
			// Bring the pointer in so widgets that react to it show some life, then let them settle.
			await page.mouse.move( 300, 110 );
			await page.waitForTimeout( 1200 );
			await stage.default?.( page );
		} catch ( error ) {
			// A plain screenshot beats a failed publish. The warning shows up in the workflow summary.
			failed++;
			console.warn( `::warning::Poster staging failed for ${ widget.slug }: ${ error.message }` );
		}
		await page.screenshot( { path: path.join( site, 'posters', `${ widget.slug }.png` ) } );
		await context.close();
	}
	console.log( `Saved ${ widgets.length } poster(s) to site/posters/${ failed ? `, ${ failed } without staging` : '' }` );
} finally {
	await browser.close();
	await server.close();
}
