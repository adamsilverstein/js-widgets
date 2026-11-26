/**
 * Tests the gallery page against whichever widgets are built: showing a
 * widget, editing an option, and both copy buttons.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { openPage } from './harness.mjs';

const widgets = JSON.parse( await readFile( new URL( '../site/widgets.json', import.meta.url ), 'utf8' ) );
// Any widget whose snippet has an option to edit.
const widget = widgets.find( ( { snippet } ) => /\sdata-[\w-]+="/.test( snippet ) );
const skip = widget ? false : 'no widget with options is built';
const clipboard = { permissions: [ 'clipboard-read', 'clipboard-write' ] };

test( 'shows the widget named in the URL, with one running demo', { skip }, async () => {
	const { page, errors, close } = await openPage( `#${ widget.slug }` );
	assert.equal( await page.locator( '.stage h2' ).textContent(), widget.name );
	assert.equal( await page.locator( 'iframe' ).count(), 1 );
	assert.equal( await page.locator( '.rail a[aria-current="page"]' ).getAttribute( 'href' ), `#${ widget.slug }` );
	assert.deepEqual( errors, [] );
	await close();
} );

test( 'an edited option reaches the demo and the copied snippet', { skip }, async () => {
	const { page, close } = await openPage( `#${ widget.slug }`, clipboard );
	const input = page.locator( '.snippet input.value' ).first();
	const name = await input.getAttribute( 'name' );
	await input.fill( 'edited "value"' );

	// The demo restarts with the override, and its script tag carries it before the widget runs.
	const demo = page.frameLocator( `iframe[src*="#${ name }="]` );
	assert.equal( await demo.locator( 'script[src$=".min.js"]' ).getAttribute( name ), 'edited "value"' );

	await page.getByRole( 'button', { name: 'Copy snippet' } ).click();
	await page.getByRole( 'button', { name: 'Copied' } ).waitFor();
	const copied = await page.evaluate( () => navigator.clipboard.readText() );
	assert.match( copied, new RegExp( `^<script src="https://[^"]+/${ widget.file }\\.min\\.js"` ) );
	assert.ok( copied.includes( `${ name }="edited &quot;value&quot;"` ), copied );

	await page.getByRole( 'button', { name: 'Reset options' } ).click();
	assert.equal( await page.locator( '.snippet input.value' ).first().inputValue(), widget.snippet.match( new RegExp( `${ name }="([^"]*)"` ) )[ 1 ] );
	await close();
} );

test( 'copies the whole widget inline', { skip }, async () => {
	const { page, close } = await openPage( `#${ widget.slug }`, clipboard );
	await page.getByRole( 'button', { name: /Copy inline JS/ } ).click();
	await page.getByRole( 'button', { name: 'Copied' } ).waitFor();
	const copied = await page.evaluate( () => navigator.clipboard.readText() );
	const code = ( await readFile( new URL( `../site/${ widget.file }.min.js`, import.meta.url ), 'utf8' ) ).trim();
	assert.ok( ! copied.includes( ' src=' ) && copied.includes( code ) && copied.endsWith( '</script>' ) );
	await close();
} );
