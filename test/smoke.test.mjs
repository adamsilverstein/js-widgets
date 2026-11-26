/**
 * Loads every widget's demo and fails on an uncaught error or a missing local
 * file. Behavior tests live next to each widget, in `widgets/<slug>/*.test.mjs`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { openDemo } from './harness.mjs';

const widgets = JSON.parse( await readFile( new URL( '../site/widgets.json', import.meta.url ), 'utf8' ) );

for ( const widget of widgets ) {
	test( `${ widget.name } demo loads cleanly`, async () => {
		// Third party requests are blocked, so the run stays offline and shows widgets failing quietly.
		const { page, errors, close } = await openDemo( widget.slug, {}, ( newPage ) =>
			newPage.route(
				( url ) => url.hostname !== '127.0.0.1',
				( route ) => route.abort()
			)
		);
		const missing = [];
		page.on( 'response', ( response ) => {
			if ( response.status() === 404 && response.url().startsWith( 'http://127.0.0.1' ) ) {
				missing.push( response.url() );
			}
		} );
		// Reload so the 404 listener sees every request, then give the widget a moment to run.
		await page.reload();
		await page.waitForTimeout( 500 );
		await close();

		assert.deepEqual( errors.map( String ), [], 'uncaught errors' );
		assert.deepEqual( missing, [], 'missing files' );
	} );
}
