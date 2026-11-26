import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDemo } from '../../test/harness.mjs';

/**
 * Returns a setup hook that installs a fake `LanguageModel`, since headless
 * Chromium has no model to run. The fake reply is "FIXED: " plus the text.
 *
 * @param {string} state What `availability()` reports.
 */
const mockApi = ( state = 'available' ) => ( page ) =>
	page.addInitScript( ( state ) => {
		window.__prompts = [];
		class Session {
			async prompt( input ) {
				window.__prompts.push( input );
				return `FIXED: ${ input.split( 'Text:\n' )[ 1 ] }\n`;
			}
			async clone() {
				return new Session();
			}
			destroy() {}
		}
		window.LanguageModel = {
			async availability( options ) {
				window.__languages = options.expectedInputs[ 0 ].languages;
				return state;
			},
			async create( options ) {
				window.__createOptions = options;
				options.monitor?.( { addEventListener: ( type, listener ) => listener( { loaded: 0.5 } ) } );
				// A download waits for the test to finish it, so the progress can be read.
				if ( state === 'downloadable' ) {
					await new Promise( ( resolve ) => ( window.__finishDownload = resolve ) );
				}
				return new Session();
			},
		};
	}, state );

const sample = 'i realy liked this post, it explain the topic good and i will defintely try it on my own site tomorow';

test( 'renders nothing and leaves the form alone without the API', async () => {
	// Recent headless Chromium exposes the global, so remove it to act like a browser without it.
	const { page, errors, close } = await openDemo( 'comment-helper', {}, ( page ) =>
		page.addInitScript( () => delete window.LanguageModel )
	);
	await page.waitForTimeout( 300 );
	assert.equal( await page.getByRole( 'button', { name: 'Fix grammar' } ).count(), 0 );
	assert.equal( await page.locator( '#comment + *' ).evaluate( ( el ) => el.tagName ), 'BUTTON' );
	assert.deepEqual( errors, [] );
	await close();
} );

test( 'renders nothing when the model is unavailable', async () => {
	const { page, close } = await openDemo( 'comment-helper', {}, mockApi( 'unavailable' ) );
	await page.waitForTimeout( 300 );
	assert.equal( await page.getByRole( 'button', { name: 'Fix grammar' } ).count(), 0 );
	await close();
} );

test( 'shows a suggestion next to the text, and changes nothing until accepted', async () => {
	const { page, close } = await openDemo( 'comment-helper', {}, mockApi() );
	await page.getByRole( 'button', { name: 'Fix grammar' } ).click();

	const panel = page.getByRole( 'region', { name: 'Suggestion' } );
	await panel.waitFor();
	assert.equal( await panel.locator( '.before' ).textContent(), sample );
	assert.equal( await panel.locator( '.after' ).textContent(), `FIXED: ${ sample }` );
	assert.equal( await page.locator( '#comment' ).inputValue(), sample );
	assert.match( await page.evaluate( () => window.__prompts[ 0 ] ), /^Fix the spelling/ );
	assert.equal( await page.evaluate( () => window.__createOptions.initialPrompts[ 0 ].role ), 'system' );

	await page.getByRole( 'button', { name: 'Keep mine' } ).click();
	assert.equal( await panel.isVisible(), false );
	assert.equal( await page.locator( '#comment' ).inputValue(), sample );
	await close();
} );

test( 'accepting fires an input event, and undo restores the text exactly', async () => {
	const { page, close } = await openDemo( 'comment-helper', {}, mockApi() );
	const field = page.locator( '#comment' );
	const original = '  Two  spaces,\n\ttabs and a trailing newline.\n';
	await field.fill( original );
	await field.evaluate( ( el ) => {
		window.__inputs = 0;
		el.addEventListener( 'input', () => window.__inputs++ );
	} );

	await page.getByRole( 'button', { name: 'Shorter' } ).click();
	await page.getByRole( 'button', { name: 'Use suggestion' } ).click();
	assert.equal( await field.inputValue(), `FIXED: ${ original }`.trim() );
	assert.equal( await page.evaluate( () => window.__inputs ), 1 );

	const undo = page.getByRole( 'button', { name: 'Undo' } );
	assert.ok( await undo.evaluate( ( el ) => el === el.getRootNode().activeElement ) );
	await undo.click();
	assert.equal( await field.inputValue(), original );
	assert.equal( await undo.isVisible(), false );
	await close();
} );

test( 'typing discards a pending suggestion', async () => {
	const { page, close } = await openDemo( 'comment-helper', {}, mockApi() );
	await page.getByRole( 'button', { name: 'Friendlier' } ).click();
	const panel = page.getByRole( 'region', { name: 'Suggestion' } );
	await panel.waitFor();
	await page.locator( '#comment' ).press( 'End' );
	await page.keyboard.type( '!' );
	assert.equal( await panel.isVisible(), false );
	await close();
} );

test( 'the form submits normally, with or without the helper', async () => {
	const { page, close } = await openDemo( 'comment-helper', {}, mockApi() );
	const output = page.locator( 'output' );
	await page.getByRole( 'button', { name: 'Post comment' } ).click();
	assert.equal( await output.textContent(), `Posted: ${ sample }` );

	await page.getByRole( 'button', { name: 'Fix grammar' } ).click();
	await page.getByRole( 'button', { name: 'Use suggestion' } ).click();
	await page.getByRole( 'button', { name: 'Post comment' } ).click();
	assert.equal( await output.textContent(), `Posted: FIXED: ${ sample }` );
	await close();
} );

test( 'is keyboard reachable and does not trap focus', async () => {
	const { page, close } = await openDemo( 'comment-helper', {}, mockApi() );
	await page.getByRole( 'button', { name: 'Fix grammar' } ).waitFor();
	await page.locator( '#comment' ).focus();
	const focused = () =>
		page.evaluate( () => {
			let el = document.activeElement;
			while ( el?.shadowRoot?.activeElement ) {
				el = el.shadowRoot.activeElement;
			}
			return el.textContent;
		} );

	await page.keyboard.press( 'Tab' );
	assert.equal( await focused(), 'Fix grammar' );
	await page.keyboard.press( 'Enter' );
	await page.getByRole( 'region', { name: 'Suggestion' } ).waitFor();

	for ( const name of [ 'Friendlier', 'Shorter', 'Use suggestion', 'Keep mine', 'Post comment' ] ) {
		await page.keyboard.press( 'Tab' );
		assert.equal( await focused(), name );
	}
	await close();
} );

test( 'shows download progress, and sends nothing over the network', async () => {
	const { page, close } = await openDemo( 'comment-helper', {}, mockApi( 'downloadable' ) );
	const requests = [];
	page.on( 'request', ( request ) => requests.push( request.url() ) );
	await page.locator( '#comment' ).fill( 'A private message.' );
	await page.getByRole( 'button', { name: 'Fix grammar' } ).click();
	await page.getByRole( 'status' ).getByText( 'Downloading the writing model: 50%' ).waitFor();
	await page.evaluate( () => window.__finishDownload() );
	await page.getByRole( 'region', { name: 'Suggestion' } ).waitFor();
	assert.equal( await page.evaluate( () => window.__prompts.length ), 1 );
	assert.deepEqual( requests, [] );
	await close();
} );

test( 'asks for the primary language subtag of the page', async () => {
	for ( const [ lang, expected ] of [ [ 'es-MX', 'es' ], [ 'jam', 'jam' ] ] ) {
		const { page, close } = await openDemo( 'comment-helper', {}, async ( page ) => {
			await mockApi()( page );
			// Serve the demo with a different <html lang>.
			await page.route( '**/demos/comment-helper/', async ( route ) => {
				const response = await route.fetch();
				const body = ( await response.text() ).replace( 'lang="en"', `lang="${ lang }"` );
				await route.fulfill( { response, body } );
			} );
		} );
		await page.getByRole( 'button', { name: 'Fix grammar' } ).waitFor();
		assert.deepEqual( await page.evaluate( () => window.__languages ), [ expected ] );
		await close();
	}
} );
