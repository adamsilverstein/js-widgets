import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDemo } from '../../test/harness.mjs';

/**
 * Replaces `LanguageModel` with a fake that reports download progress and
 * records every prompt in `window.prompts`. The real model is never used.
 * With `hold`, the download stops at 50% and never finishes.
 */
const mockModel = ( page, hold = false ) =>
	page.addInitScript( ( hold ) => {
		window.prompts = [];
		self.LanguageModel = {
			availability: async () => 'downloadable',
			async create( options ) {
				const monitor = new EventTarget();
				options.monitor?.( monitor );
				monitor.dispatchEvent( Object.assign( new Event( 'downloadprogress' ), { loaded: 0.5 } ) );
				if ( hold ) {
					return new Promise( () => {} );
				}
				monitor.dispatchEvent( Object.assign( new Event( 'downloadprogress' ), { loaded: 1 } ) );
				const session = {
					clone: async () => session,
					destroy() {},
					async prompt( messages ) {
						window.prompts.push( messages[ 0 ].content.find( ( part ) => part.type === 'image' ).value.getAttribute( 'src' ) );
						return ' A red bicycle on a quiet street. ';
					},
				};
				return session;
			},
		};
	}, hold );

/** Removes the built-in API, which some Chromium builds expose. */
const removeModel = ( page ) => page.addInitScript( () => delete self.LanguageModel );

/** Opens the demo, by default in audit mode, after `page.goto()` has run. */
async function open( setup, search = '?alt-audit', contextOptions = {} ) {
	const demo = await openDemo( 'alt-text-helper', contextOptions, setup );
	if ( search ) {
		await demo.page.goto( demo.page.url() + search );
	}
	return demo;
}

test( 'does nothing for ordinary visitors', async () => {
	const { page, errors, close } = await open( mockModel, '' );
	await page.waitForTimeout( 300 );
	assert.equal( await page.locator( '[data-jsw-corner]' ).count(), 0 );
	assert.equal( await page.getByRole( 'button' ).count(), 0 );
	assert.deepEqual( await page.evaluate( () => window.prompts ), [] );
	assert.deepEqual( errors, [] );
	await close();
} );

test( 'lists only images with no alt attribute, each with a badge', async () => {
	const { page, close } = await open( mockModel );
	await page.getByText( 'Alt text audit: 3 images missing alt' ).waitFor();
	assert.deepEqual( await page.locator( 'li .name' ).allTextContents(), [
		'1. hills-at-sunset.svg',
		'2. coffee-cup.svg',
		'3. red-bicycle.svg',
	] );
	for ( const number of [ 1, 2, 3 ] ) {
		assert.ok( await page.getByRole( 'button', { name: `Image ${ number } has no alt text` } ).isVisible() );
	}
	await close();
} );

test( 'suggests one image at a time, editable and copyable', async () => {
	const { page, close } = await open( mockModel, '?alt-audit', { permissions: [ 'clipboard-read', 'clipboard-write' ] } );
	const item = page.locator( 'li' ).filter( { hasText: 'red-bicycle.svg' } );
	await item.getByRole( 'button', { name: 'Suggest' } ).click();

	const field = item.getByRole( 'textbox' );
	await assert.doesNotReject( () => item.getByText( 'Suggestion ready' ).waitFor() );
	assert.equal( await field.inputValue(), 'A red bicycle on a quiet street.' );
	assert.deepEqual( await page.evaluate( () => window.prompts ), [ 'red-bicycle.svg' ] );

	await field.fill( 'A red bicycle parked by the curb.' );
	await item.getByRole( 'button', { name: 'Copy' } ).click();
	await item.getByText( 'Copied' ).waitFor();
	assert.equal( await page.evaluate( () => navigator.clipboard.readText() ), 'A red bicycle parked by the curb.' );
	await close();
} );

test( 'shows download progress on the first suggestion', async () => {
	const { page, close } = await open( ( page ) => mockModel( page, true ) );
	await page.getByRole( 'button', { name: 'Suggest' } ).first().click();
	await page.getByText( 'Downloading the model: 50%' ).waitFor();
	await close();
} );

test( 'a badge moves keyboard focus to its entry', async () => {
	const { page, close } = await open( mockModel );
	await page.getByRole( 'button', { name: 'Image 2 has no alt text' } ).focus();
	await page.keyboard.press( 'Enter' );
	const focused = await page.evaluate( () => document.querySelector( '[data-jsw-corner] div' ).shadowRoot.activeElement?.closest( 'li' )?.querySelector( '.name' ).textContent );
	assert.equal( focused, '2. coffee-cup.svg' );
	await close();
} );

test( 'without the Prompt API, says so and offers no suggestions', async () => {
	const { page, errors, close } = await open( removeModel );
	await page.getByText( 'Suggestions need the Prompt API' ).waitFor();
	assert.equal( await page.getByRole( 'button', { name: 'Suggest' } ).count(), 0 );
	assert.equal( await page.locator( 'li .name' ).count(), 3 );
	assert.deepEqual( errors, [] );
	await close();
} );

test( 'without the Prompt API, renders nothing for ordinary visitors', async () => {
	const { page, close } = await open( removeModel, '' );
	await page.waitForTimeout( 300 );
	assert.equal( await page.locator( '[data-jsw-corner]' ).count(), 0 );
	assert.equal( await page.getByRole( 'button' ).count(), 0 );
	await close();
} );
