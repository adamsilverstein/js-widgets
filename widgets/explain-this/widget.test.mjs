import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDemo } from '../../test/harness.mjs';

/** Mocks the Prompt API, recording calls on `window.calls`. */
const mockModel = ( page ) =>
	page.addInitScript( () => {
		window.calls = { create: [], prompt: [] };
		const session = {
			clone: async () => session,
			prompt: async ( input ) => {
				window.calls.prompt.push( input );
				return 'A **widget** is a small piece of a page.';
			},
			destroy() {},
		};
		window.LanguageModel = {
			availability: async () => 'available',
			create: async ( options ) => {
				window.calls.create.push( options );
				return session;
			},
		};
	} );

/** Selects the first occurrence of `text` inside the element matching `selector`. */
const select = ( page, text, selector = 'article' ) =>
	page.evaluate(
		( [ text, selector ] ) => {
			const walker = document.createTreeWalker( document.querySelector( selector ), NodeFilter.SHOW_TEXT );
			while ( walker.nextNode() ) {
				const index = walker.currentNode.data.indexOf( text );
				if ( index >= 0 ) {
					const range = document.createRange();
					range.setStart( walker.currentNode, index );
					range.setEnd( walker.currentNode, index + text.length );
					getSelection().removeAllRanges();
					getSelection().addRange( range );
					return;
				}
			}
			throw new Error( `"${ text }" not found` );
		},
		[ text, selector ]
	);

const explainButton = ( page ) => page.getByRole( 'button', { name: 'Explain' } );
const panel = ( page ) => page.getByRole( 'dialog', { name: 'AI explanation' } );

const hasHost = ( page ) => page.evaluate( () => [ ...document.querySelectorAll( '*' ) ].some( ( el ) => el.shadowRoot ) );

// Recent headless Chromium exposes `LanguageModel` (as "downloadable"), so each case is set up explicitly.
for ( const [ name, setup ] of [
	[ 'is missing', ( page ) => page.addInitScript( () => delete window.LanguageModel ) ],
	[ 'is unavailable', ( page ) => page.addInitScript( () => ( window.LanguageModel = { availability: async () => 'unavailable' } ) ) ],
] ) {
	test( `renders nothing when the Prompt API ${ name }`, async () => {
		const { page, errors, close } = await openDemo( 'explain-this', {}, setup );
		await select( page, 'hit counter' );
		await page.waitForTimeout( 400 );
		assert.equal( await hasHost( page ), false );
		assert.deepEqual( errors, [] );
		await close();
	} );
}

test( 'explains a selection in its paragraph only after a click', async () => {
	const { page, errors, close } = await openDemo( 'explain-this', {}, mockModel );
	await select( page, 'hit counter' );
	await explainButton( page ).waitFor();
	assert.deepEqual( await page.evaluate( () => window.calls ), { create: [], prompt: [] }, 'nothing sent before the click' );

	await explainButton( page ).click();
	await panel( page ).getByText( 'A widget is a small piece of a page.' ).waitFor();
	assert.ok( await panel( page ).getByText( 'AI explanation' ).isVisible(), 'marked as AI generated' );

	const [ input ] = await page.evaluate( () => window.calls.prompt );
	assert.match( input, /Explain "hit counter"/ );
	assert.match( input, /A hit counter in the footer, a guestbook link/, 'paragraph sent as context' );
	assert.doesNotMatch( input, /The copy and paste years/, 'only the one paragraph' );
	assert.deepEqual( errors, [] );
	await close();
} );

test( 'ignores selections outside the target or too long', async () => {
	const { page, close } = await openDemo( 'explain-this', {}, mockModel );
	await select( page, 'Needs Chrome', '.demo-note' );
	await page.waitForTimeout( 400 );
	assert.equal( await explainButton( page ).isVisible(), false, 'outside the target' );

	await page.evaluate( () => {
		const range = document.createRange();
		range.selectNodeContents( document.querySelector( 'article' ) );
		getSelection().removeAllRanges();
		getSelection().addRange( range );
	} );
	await page.waitForTimeout( 400 );
	assert.equal( await explainButton( page ).isVisible(), false, 'too long' );
	await close();
} );

test( 'works from the keyboard and closes with Escape', async () => {
	const { page, close } = await openDemo( 'explain-this', {}, mockModel );
	await select( page, 'guestbook' );
	await explainButton( page ).waitFor();
	await page.keyboard.press( 'Tab' );
	assert.ok( await explainButton( page ).evaluate( ( el ) => el.getRootNode().activeElement === el ), 'button is the next Tab stop' );

	await page.keyboard.press( 'Enter' );
	await panel( page ).getByText( 'A widget is a small piece' ).waitFor();
	await page.keyboard.press( 'Escape' );
	await panel( page ).waitFor( { state: 'hidden' } );
	await close();
} );

test( 'leaves table markup intact', async () => {
	const { page, close } = await openDemo( 'explain-this', {}, mockModel );
	await page.evaluate( () =>
		document.querySelector( 'article' ).insertAdjacentHTML( 'beforeend', '<table><tr><td>Cell one</td><td>Cell two</td></tr></table>' )
	);
	await select( page, 'Cell one' );
	await explainButton( page ).waitFor();
	assert.deepEqual( await page.evaluate( () => [ ...document.querySelector( 'tr' ).children ].map( ( el ) => el.tagName ) ), [ 'TD', 'TD' ] );
	await close();
} );

test( 'keeps the explanation on screen next to the selection', async () => {
	const { page, close } = await openDemo( 'explain-this', { viewport: { width: 360, height: 640 } }, mockModel );
	await select( page, 'guestbook' );
	await explainButton( page ).click();
	await panel( page ).getByText( 'A widget is a small piece' ).waitFor();

	const box = await panel( page ).boundingBox();
	const word = await page.evaluate( () => getSelection().getRangeAt( 0 ).getBoundingClientRect().toJSON() );
	assert.ok( box.x >= 0 && box.x + box.width <= 360, 'inside the viewport horizontally' );
	assert.ok( box.y >= 0 && box.y + box.height <= 640, 'inside the viewport vertically' );
	assert.ok( Math.abs( box.y - word.bottom ) < 40 || Math.abs( box.y + box.height - word.top ) < 40, 'next to the selection' );
	await close();
} );

test( 'shows download progress on first use', async () => {
	const { page, close } = await openDemo( 'explain-this', {}, ( page ) =>
		page.addInitScript( () => {
			window.LanguageModel = {
				availability: async () => 'downloadable',
				create: ( options ) => {
					const monitor = new EventTarget();
					options.monitor( monitor );
					const progress = new Event( 'downloadprogress' );
					progress.loaded = 0.5;
					monitor.dispatchEvent( progress );
					// Never resolves, so the progress message stays up.
					return new Promise( () => {} );
				},
			};
		} )
	);
	await select( page, 'guestbook' );
	await explainButton( page ).click();
	await panel( page ).getByText( 'Downloading the AI model, 50%' ).waitFor();
	await close();
} );

test( 'works with touch', async () => {
	const { page, close } = await openDemo( 'explain-this', { hasTouch: true, isMobile: true, viewport: { width: 375, height: 667 } }, mockModel );
	await select( page, 'guestbook' );
	await explainButton( page ).tap();
	await panel( page ).getByText( 'A widget is a small piece' ).waitFor();
	await close();
} );
