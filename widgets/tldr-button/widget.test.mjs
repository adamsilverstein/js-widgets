import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDemo } from '../../test/harness.mjs';

/**
 * Installs a fake `Summarizer` global, since headless Chromium has no built-in AI.
 * Calls are recorded on `window.calls`. Each streamed chunk waits for
 * `window.step()` when `gated` is set, and `create()` hangs after reporting
 * half a download when `download` is set, until its signal aborts. Otherwise
 * `create()` reports progress 0 and 1, as Chrome does when the model is
 * already on the device, and records the widget's text on `window.calls.shown`.
 */
function mockSummarizer( page, settings = {} ) {
	return page.addInitScript( ( { state = 'available', chunks = [], quota = Infinity, gated = false, download = false } ) => {
		const calls = ( window.calls = { availability: [], create: [], input: [], aborted: 0, shown: [] } );
		let permits = 0;
		let wake = () => {};
		window.step = () => {
			permits++;
			wake();
		};
		window.Summarizer = {
			async availability( options ) {
				calls.availability.push( options );
				return state;
			},
			create( options ) {
				calls.create.push( { type: options.type, length: options.length } );
				if ( download ) {
					const target = new EventTarget();
					options.monitor( target );
					target.dispatchEvent( Object.assign( new Event( 'downloadprogress' ), { loaded: 0.5 } ) );
					return new Promise( ( resolve, reject ) =>
						options.signal.addEventListener( 'abort', () => {
							calls.aborted++;
							reject( new DOMException( 'Aborted', 'AbortError' ) );
						} )
					);
				}
				const monitor = new EventTarget();
				options.monitor( monitor );
				for ( const loaded of [ 0, 1 ] ) {
					monitor.dispatchEvent( Object.assign( new Event( 'downloadprogress' ), { loaded } ) );
					calls.shown.push( document.querySelector( 'article > div' ).shadowRoot.textContent );
				}
				return Promise.resolve( {
					inputQuota: quota,
					measureInputUsage: async ( text ) => text.length,
					summarizeStreaming( text ) {
						calls.input.push( text );
						let i = 0;
						return new ReadableStream( {
							async pull( controller ) {
								while ( gated && ! permits ) {
									await new Promise( ( resolve ) => ( wake = resolve ) );
								}
								permits--;
								if ( i < chunks.length ) {
									controller.enqueue( chunks[ i++ ] );
								} else {
									controller.close();
								}
							},
						} );
					},
					destroy() {},
				} );
			},
		};
	}, settings );
}

const CHUNKS = [ '* Widgets began as pasted snippets.\n', '* Blogs moved them into sidebars.\n', '* Modern APIs make new ones possible.' ];

test( 'renders nothing where the Summarizer API is missing', async () => {
	// Recent headless Chromium exposes the API (reporting "downloadable"), so remove it to stand in for other browsers.
	const { page, errors, close } = await openDemo( 'tldr-button', {}, ( p ) =>
		p.addInitScript( () => delete window.Summarizer )
	);
	await page.waitForLoadState( 'load' );
	await page.waitForTimeout( 200 );
	assert.equal( await page.evaluate( () => 'Summarizer' in window ), false );
	assert.equal( await page.getByRole( 'button' ).count(), 0 );
	assert.deepEqual( errors, [] );
	await close();
} );

test( 'renders nothing when availability() reports unavailable', async () => {
	const { page, close } = await openDemo( 'tldr-button', {}, ( p ) => mockSummarizer( p, { state: 'unavailable' } ) );
	await page.waitForFunction( () => window.calls.availability.length > 0 );
	await page.waitForTimeout( 100 );
	assert.equal( await page.getByRole( 'button' ).count(), 0 );
	await close();
} );

test( 'streams a labelled summary on click and announces it when done', async () => {
	const requests = [];
	const { page, errors, close } = await openDemo( 'tldr-button', {}, ( p ) => {
		p.on( 'request', ( request ) => requests.push( request.url() ) );
		return mockSummarizer( p, { chunks: CHUNKS, gated: true } );
	} );
	const toggle = page.getByRole( 'button', { name: 'TL;DR' } );
	await toggle.waitFor();
	assert.equal( await page.evaluate( () => window.calls.create.length ), 0, 'nothing runs before a click' );
	assert.equal( ( await page.evaluate( () => window.calls.availability[ 0 ] ) ).outputLanguage, 'en' );

	await toggle.click();
	assert.equal( await toggle.getAttribute( 'aria-expanded' ), 'true' );
	await page.getByText( /AI-generated summary, made on your device/ ).waitFor();

	// One chunk at a time, to see the summary stream in.
	await page.waitForFunction( () => window.calls.input.length === 1 );
	await page.evaluate( () => window.step() );
	await page.locator( 'li' ).first().waitFor();
	assert.equal( await page.locator( 'li' ).count(), 1 );
	assert.equal( await page.getByRole( 'status' ).textContent(), '', 'not announced while streaming' );

	for ( let i = 0; i < CHUNKS.length; i++ ) {
		await page.evaluate( () => window.step() );
	}
	await page.getByRole( 'status' ).filter( { hasText: 'Summary:' } ).waitFor();
	assert.deepEqual( await page.locator( 'li' ).allTextContents(), [
		'Widgets began as pasted snippets.',
		'Blogs moved them into sidebars.',
		'Modern APIs make new ones possible.',
	] );

	const input = await page.evaluate( () => window.calls.input[ 0 ] );
	assert.match( input, /A short history of the sidebar widget/ );
	assert.doesNotMatch( input, /TL;DR|AI-generated/, 'the widget does not summarize itself' );

	// Closing and reopening shows the same summary without running the model again.
	await toggle.click();
	await toggle.click();
	assert.equal( await page.evaluate( () => window.calls.create.length ), 1 );

	const origin = new URL( page.url() ).origin;
	assert.ok( requests.every( ( url ) => url.startsWith( origin ) ), 'no requests leave the page origin' );
	assert.deepEqual( errors, [] );
	await close();
} );

test( 'shows no download progress when the model is already available', async () => {
	const { page, close } = await openDemo( 'tldr-button', {}, ( p ) => mockSummarizer( p, { chunks: CHUNKS, gated: true } ) );
	await page.getByRole( 'button', { name: 'TL;DR' } ).click();
	await page.getByText( 'Summarizing…' ).waitFor();
	assert.equal( await page.locator( 'progress' ).isVisible(), false );
	const shown = await page.evaluate( () => window.calls.shown );
	assert.equal( shown.length, 2 );
	assert.ok( shown.every( ( text ) => ! text.includes( 'Downloading' ) ), 'no download message flashes' );
	await close();
} );

test( 'shows download progress, and Cancel abandons the download', async () => {
	const { page, close } = await openDemo( 'tldr-button', {}, ( p ) =>
		mockSummarizer( p, { state: 'downloadable', download: true } )
	);
	const toggle = page.getByRole( 'button', { name: 'TL;DR' } );
	await toggle.click();
	await page.getByText( 'Downloading the summary model…' ).waitFor();
	assert.equal( await page.locator( 'progress' ).evaluate( ( el ) => el.value ), 0.5 );

	await page.getByRole( 'button', { name: 'Cancel' } ).click();
	assert.equal( await page.evaluate( () => window.calls.aborted ), 1 );
	assert.equal( await toggle.getAttribute( 'aria-expanded' ), 'false' );
	assert.ok( await toggle.evaluate( ( el ) => el.getRootNode().activeElement === el ), 'focus returns to the button' );

	// Opening again retries.
	await toggle.click();
	assert.equal( await page.evaluate( () => window.calls.create.length ), 2 );
	await close();
} );

test( 'shortens an article over the input quota instead of failing', async () => {
	const { page, close } = await openDemo( 'tldr-button', {}, ( p ) => mockSummarizer( p, { chunks: CHUNKS, quota: 500 } ) );
	await page.getByRole( 'button', { name: 'TL;DR' } ).click();
	await page.getByRole( 'status' ).filter( { hasText: 'Summary:' } ).waitFor();
	const input = await page.evaluate( () => window.calls.input[ 0 ] );
	assert.ok( input.length > 0 && input.length <= 500, `input is ${ input.length } characters` );
	await page.getByText( /summary of the first part of the article/ ).waitFor();
	await close();
} );

test( 'works from the keyboard', async () => {
	const { page, close } = await openDemo( 'tldr-button', {}, ( p ) => mockSummarizer( p, { chunks: CHUNKS } ) );
	const toggle = page.getByRole( 'button', { name: 'TL;DR' } );
	await toggle.focus();
	await page.keyboard.press( 'Enter' );
	await page.getByRole( 'status' ).filter( { hasText: 'Summary:' } ).waitFor();
	await page.keyboard.press( 'Space' );
	assert.equal( await toggle.getAttribute( 'aria-expanded' ), 'false' );
	await close();
} );
