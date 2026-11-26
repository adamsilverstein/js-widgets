import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDemo } from '../../test/harness.mjs';

/**
 * Mocks the Prompt API, since headless Chromium has no built-in AI. The mock
 * records its calls in `window.calls`. `create()` waits for
 * `window.finishDownload()` when the model is `downloadable`, and each answer
 * chunk waits until `window.nextChunk()` when `step` is set.
 *
 * @param {Object}   [mock]        Mock behavior.
 * @param {string}   [mock.status] What `availability()` returns.
 * @param {string[]} [mock.chunks] Streamed answer chunks.
 * @param {boolean}  [mock.step]   Whether chunks wait to be released one at a time.
 * @param {number}   [mock.window] Context window, in characters. Longer prompts throw.
 * @return {Function} An `openDemo()` setup hook.
 */
const mockPromptApi =
	( { status = 'available', chunks = [ 'Widgets arrived ', 'in 2007.' ], step = false, window = 0 } = {} ) =>
	( page ) =>
		page.addInitScript(
			( { status, chunks, step, window: contextWindow } ) => {
				const calls = ( window.calls = { availability: [], create: [], prompts: [] } );
				const waitFor = ( name ) => new Promise( ( resolve ) => ( window[ name ] = resolve ) );

				window.LanguageModel = {
					async availability( options ) {
						calls.availability.push( options );
						return status;
					},
					async create( { monitor, ...options } ) {
						calls.create.push( options );
						const requested = options.initialPrompts[ 0 ].content.length;
						if ( contextWindow && requested > contextWindow ) {
							throw Object.assign( new DOMException( 'Too large', 'QuotaExceededError' ), { requested, quota: contextWindow } );
						}
						if ( status === 'downloadable' ) {
							const target = new EventTarget();
							monitor?.( target );
							target.dispatchEvent( Object.assign( new Event( 'downloadprogress' ), { loaded: 0.5 } ) );
							await waitFor( 'finishDownload' );
							target.dispatchEvent( Object.assign( new Event( 'downloadprogress' ), { loaded: 1 } ) );
						}
						return {
							async *promptStreaming( question, { signal } = {} ) {
								calls.prompts.push( question );
								for ( const chunk of chunks ) {
									if ( step ) {
										await Promise.race( [
											waitFor( 'nextChunk' ),
											new Promise( ( resolve ) => signal?.addEventListener( 'abort', resolve ) ),
										] );
									}
									if ( signal?.aborted ) {
										throw new DOMException( 'Stopped', 'AbortError' );
									}
									yield chunk;
								}
							},
						};
					},
				};
			},
			{ status, chunks, step, window }
		);

/** Removes the Prompt API, which recent headless Chromium exposes as `downloadable`. */
const removePromptApi = ( page ) => page.addInitScript( () => delete window.LanguageModel );

/** The widget's answer bubbles, which Playwright finds through the shadow root. */
const answer = ( page, text ) => page.locator( '.msg.ai', { hasText: text } );

/**
 * Mocks the Prompt API and serves the demo with other script tag attributes.
 *
 * @param {string} attributes Replaces the demo's `data-target` attribute.
 * @return {Function} An `openDemo()` setup hook.
 */
const withAttributes = ( attributes ) => async ( page ) => {
	await mockPromptApi()( page );
	await page.route( '**/demos/ask-this-page/', async ( route ) => {
		const response = await route.fetch();
		const body = ( await response.text() ).replace( 'data-target="article"', attributes );
		await route.fulfill( { response, body } );
	} );
};

const ask = async ( page, question ) => {
	await page.getByRole( 'button', { name: 'Ask this page' } ).click();
	await page.getByRole( 'textbox', { name: 'Your question' } ).fill( question );
	await page.getByRole( 'button', { name: 'Ask', exact: true } ).click();
};

test( 'renders nothing without the Prompt API', async () => {
	const { page, errors, close } = await openDemo( 'ask-this-page', {}, removePromptApi );
	await page.waitForTimeout( 300 );
	assert.equal( await page.locator( '[data-jsw-corner]' ).count(), 0 );
	assert.deepEqual( errors, [] );
	await close();
} );

test( 'renders nothing when the model is unavailable', async () => {
	const { page, close } = await openDemo( 'ask-this-page', {}, mockPromptApi( { status: 'unavailable' } ) );
	await page.waitForTimeout( 300 );
	assert.equal( await page.locator( '[data-jsw-corner]' ).count(), 0 );
	await close();
} );

test( 'opens a labelled dialog with an AI note, and closes with Escape', async () => {
	const { page, close } = await openDemo( 'ask-this-page', {}, mockPromptApi() );
	const toggle = page.getByRole( 'button', { name: 'Ask this page' } );
	await toggle.focus();
	await page.keyboard.press( 'Enter' );

	const dialog = page.getByRole( 'dialog', { name: 'Ask this page' } );
	await dialog.waitFor();
	assert.equal( await toggle.getAttribute( 'aria-expanded' ), 'true' );
	assert.ok( await dialog.getByText( 'Ask me about this article' ).isVisible() );
	assert.ok( await dialog.getByText( /AI generated .* may be wrong/ ).isVisible() );
	assert.ok( await page.getByRole( 'textbox', { name: 'Your question' } ).evaluate( ( input ) => input.matches( ':focus' ) ) );

	await page.keyboard.press( 'Escape' );
	await dialog.waitFor( { state: 'hidden' } );
	assert.equal( await toggle.getAttribute( 'aria-expanded' ), 'false' );
	assert.ok( await toggle.evaluate( ( button ) => button.matches( ':focus' ) ) );
	await close();
} );

test( 'creates a session grounded in the target text only when asked', async () => {
	const { page, close } = await openDemo( 'ask-this-page', {}, mockPromptApi() );
	await page.getByRole( 'button', { name: 'Ask this page' } ).click();
	await page.getByRole( 'dialog' ).waitFor();
	assert.equal( await page.evaluate( () => window.calls.create.length ), 0, 'no session before a question' );
	await page.keyboard.press( 'Escape' );

	await ask( page, 'When did widgets arrive?' );
	await answer( page, 'Widgets arrived in 2007.' ).waitFor();

	const calls = await page.evaluate( () => window.calls );
	assert.equal( calls.create.length, 1 );
	assert.deepEqual( calls.prompts, [ 'When did widgets arrive?' ] );
	const { expectedInputs, expectedOutputs, initialPrompts } = calls.create[ 0 ];
	assert.deepEqual( { expectedInputs, expectedOutputs }, calls.availability[ 0 ] );
	assert.equal( initialPrompts[ 0 ].role, 'system' );
	assert.match( initialPrompts[ 0 ].content, /That is not covered on this page\./ );
	assert.match( initialPrompts[ 0 ].content, /WordPress shipped a widgets screen in 2007/ );
	assert.doesNotMatch( initialPrompts[ 0 ].content, /Needs Chrome 148/, 'only the target element is used' );

	// A follow-up question reuses the session.
	await page.getByRole( 'textbox', { name: 'Your question' } ).fill( 'And then?' );
	await page.keyboard.press( 'Enter' );
	await page.waitForFunction( () => window.calls.prompts.length === 2 );
	assert.equal( await page.evaluate( () => window.calls.create.length ), 1 );
	await close();
} );

test( 'shows download progress, then streams and announces the answer', async () => {
	const { page, close } = await openDemo( 'ask-this-page', {}, mockPromptApi( { status: 'downloadable', step: true } ) );
	await ask( page, 'When?' );

	const bar = page.locator( 'progress' );
	await bar.waitFor();
	assert.equal( await bar.evaluate( ( progress ) => progress.value ), 0.5 );

	await page.evaluate( () => window.finishDownload() );
	await bar.waitFor( { state: 'hidden' } );
	await page.waitForFunction( () => window.nextChunk );
	await page.evaluate( () => window.nextChunk() );
	await answer( page, /^Widgets arrived $/ ).waitFor();
	const status = page.getByRole( 'status' );
	assert.equal( await status.textContent(), '', 'not announced mid-stream' );

	await page.evaluate( () => window.nextChunk() );
	await answer( page, 'Widgets arrived in 2007.' ).waitFor();
	assert.equal( await status.textContent(), 'Widgets arrived in 2007.' );
	await close();
} );

test( 'stops a streaming answer', async () => {
	const { page, close } = await openDemo( 'ask-this-page', {}, mockPromptApi( { step: true } ) );
	await ask( page, 'When?' );
	await page.waitForFunction( () => window.nextChunk );
	await page.evaluate( () => window.nextChunk() );
	await answer( page, /^Widgets arrived $/ ).waitFor();

	await page.getByRole( 'button', { name: 'Stop' } ).click();
	await answer( page, /^Widgets arrived \(stopped\)$/ ).waitFor();
	assert.ok( await page.getByRole( 'button', { name: 'Ask', exact: true } ).isVisible() );
	await close();
} );

test( 'retries with less page text when it overflows the context window', async () => {
	const { page, close } = await openDemo( 'ask-this-page', {}, mockPromptApi( { window: 1000 } ) );
	await ask( page, 'When?' );
	await answer( page, 'Widgets arrived in 2007.' ).waitFor();
	const sizes = await page.evaluate( () => window.calls.create.map( ( options ) => options.initialPrompts[ 0 ].content.length ) );
	assert.equal( sizes.length, 2 );
	assert.ok( sizes[ 0 ] > 1000 && sizes[ 1 ] <= 1000, `prompt sizes ${ sizes }` );
	await close();
} );

test( 'falls back to the body text when data-target is not a valid selector', async () => {
	const { page, close } = await openDemo( 'ask-this-page', {}, withAttributes( 'data-target="[[bad"' ) );
	await ask( page, 'When?' );
	await answer( page, 'Widgets arrived in 2007.' ).waitFor();
	const prompt = await page.evaluate( () => window.calls.create[ 0 ].initialPrompts[ 0 ].content );
	assert.match( prompt, /Needs Chrome 148/ );
	await close();
} );

for ( const position of [ 'bottom-left', 'top-right' ] ) {
	test( `keeps the button in place when the panel opens at ${ position }`, async () => {
		const { page, close } = await openDemo( 'ask-this-page', {}, withAttributes( `data-position="${ position }"` ) );
		const toggle = page.getByRole( 'button', { name: 'Ask this page' } );
		const before = await toggle.boundingBox();
		await toggle.click();
		await page.getByRole( 'dialog' ).waitFor();
		assert.deepEqual( await toggle.boundingBox(), before );
		await close();
	} );
}

test( 'follows the page theme, also while closed', async () => {
	const { page, close } = await openDemo( 'ask-this-page', { colorScheme: 'light' }, mockPromptApi() );
	const toggle = page.getByRole( 'button', { name: 'Ask this page' } );
	const background = () => toggle.evaluate( ( button ) => getComputedStyle( button ).backgroundColor );
	const light = await background();
	await page.evaluate( () => ( document.documentElement.dataset.theme = 'dark' ) );
	assert.notEqual( await background(), light );
	await page.evaluate( () => ( document.documentElement.dataset.theme = 'light' ) );
	assert.equal( await background(), light );
	await close();
} );
