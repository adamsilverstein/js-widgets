import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDemo } from '../../test/harness.mjs';
import { mockSpeech } from './mock-speech.mjs';

const ENGLISH = [ { lang: 'fr-FR', default: true }, { lang: 'en-GB' }, { lang: 'en-US' } ];

const open = ( voices = ENGLISH, contextOptions ) => openDemo( 'listen-to-page', contextOptions, mockSpeech( voices ) );
const spoken = ( page ) => page.evaluate( () => window.speech.spoken.map( ( utterance ) => utterance.text ) );
const highlighted = ( page ) => page.evaluate( () => [ ...( CSS.highlights.get( 'jsw-listen' ) ?? [] ) ].map( String ) );

test( 'reads sentence by sentence and highlights each one without changing the DOM', async () => {
	const { page, errors, close } = await open();
	const before = await page.locator( 'article' ).innerHTML();

	await page.getByRole( 'button', { name: 'Listen' } ).click();
	assert.deepEqual( await spoken( page ), [ 'A short history of the sidebar widget' ] );
	assert.deepEqual( await highlighted( page ), [ 'A short history of the sidebar widget' ] );

	await page.evaluate( () => window.speech.finish() );
	const second = 'Long before anyone said "component", websites had widgets.';
	assert.equal( ( await spoken( page ) )[ 1 ], second );
	assert.deepEqual( await highlighted( page ), [ second ] );

	assert.equal( await page.locator( 'article' ).innerHTML(), before );
	assert.deepEqual( errors, [] );
	await close();
} );

test( 'skips navigation, code blocks, figures and hidden content', async () => {
	const { page, close } = await open();
	await page.evaluate( () => {
		document.querySelector( 'article h1' ).insertAdjacentHTML(
			'afterend',
			`<nav>Skip me nav.</nav><pre>skip(me);</pre><figure>Skip me figure.</figure>
			<p hidden>Skip me hidden.</p><p style="display:none">Skip me too.</p>
			<p>Read <code>inline code</code> aloud.</p>`
		);
	} );
	await page.getByRole( 'button', { name: 'Listen' } ).click();
	await page.evaluate( () => window.speech.finish() );

	assert.deepEqual( await spoken( page ), [ 'A short history of the sidebar widget', 'Read inline code aloud.' ] );
	await close();
} );

test( 'keeps the spaces between inline elements, breaks lines at <br> and skips invisible text', async () => {
	const { page, close } = await open();
	await page.evaluate( () => {
		document.querySelector( 'article h1' ).insertAdjacentHTML(
			'afterend',
			`<p style="visibility:hidden">Skip me invisible.</p>
			<p><em>Very</em> <strong>important</strong> words.</p>
			<p><span>One.</span> <span>Two.</span></p>
			<p>Line one<br>line two.</p>`
		);
	} );
	await page.getByRole( 'button', { name: 'Listen' } ).click();
	for ( let i = 0; i < 5; i++ ) {
		await page.evaluate( () => window.speech.finish() );
	}
	assert.deepEqual( ( await spoken( page ) ).slice( 1 ), [ 'Very important words.', 'One.', 'Two.', 'Line one', 'line two.' ] );
	await close();
} );

test( 'uses a voice matching the page language, preferring an exact match', async () => {
	const voiceUsed = async ( voices ) => {
		const { page, close } = await open( voices );
		await page.getByRole( 'button', { name: 'Listen' } ).click();
		const { lang, voice } = await page.evaluate( () => window.speech.spoken[ 0 ] );
		await close();
		return { lang, voice: voice?.lang };
	};
	// The demo article is lang="en". The French default voice is passed over.
	assert.deepEqual( await voiceUsed( ENGLISH ), { lang: 'en', voice: 'en-GB' } );
	assert.deepEqual( await voiceUsed( [ { lang: 'en-US', default: true }, { lang: 'en' } ] ), { lang: 'en', voice: 'en' } );
} );

test( 'play, pause, skip and speed work from the keyboard', async () => {
	const { page, close } = await open();
	const play = page.getByRole( 'button', { name: 'Listen' } );
	await play.focus();
	await page.keyboard.press( 'Enter' );
	assert.equal( ( await spoken( page ) ).length, 1 );

	// Tab to "Next sentence" and press Space.
	await page.keyboard.press( 'Tab' );
	await page.keyboard.press( 'Tab' );
	await page.keyboard.press( 'Space' );
	assert.equal( ( await spoken( page ) )[ 1 ], 'Long before anyone said "component", websites had widgets.' );

	// Shift+Tab to "Previous sentence".
	await page.keyboard.press( 'Shift+Tab' );
	await page.keyboard.press( 'Enter' );
	assert.equal( ( await spoken( page ) )[ 2 ], 'A short history of the sidebar widget' );

	// Speed restarts the current sentence at the new rate.
	await page.keyboard.press( 'Tab' );
	await page.keyboard.press( 'Tab' );
	// Type-ahead picks "2×". Arrow keys open the picker on macOS instead.
	await page.keyboard.press( '2' );
	assert.equal( await page.evaluate( () => window.speech.spoken.at( -1 ).rate ), 2 );

	await page.getByRole( 'button', { name: 'Pause' } ).focus();
	await page.keyboard.press( 'Enter' );
	assert.equal( await page.evaluate( () => window.speech.current ), null );
	assert.ok( await page.getByRole( 'button', { name: 'Resume' } ).isVisible() );
	await close();
} );

test( 'clicking a sentence reads from there once reading has started', async () => {
	const { page, close } = await open();
	const paragraph = page.locator( 'article p' ).first();

	await paragraph.click( { position: { x: 5, y: 5 } } );
	assert.equal( ( await spoken( page ) ).length, 0, 'no speech before the visitor presses play' );

	await page.getByRole( 'button', { name: 'Listen' } ).click();
	await page.getByRole( 'button', { name: 'Pause' } ).click();
	await paragraph.click( { position: { x: 5, y: 5 } } );
	assert.equal( ( await spoken( page ) ).at( -1 ), 'Long before anyone said "component", websites had widgets.' );
	await close();
} );

test( 'stops speaking when the visitor leaves the page', async () => {
	const { page, close } = await open();
	await page.getByRole( 'button', { name: 'Listen' } ).click();
	await page.evaluate( () => dispatchEvent( new PageTransitionEvent( 'pagehide' ) ) );
	assert.equal( await page.evaluate( () => window.speech.current ), null );
	assert.ok( await page.getByRole( 'button', { name: 'Resume' } ).isVisible() );
	await close();
} );

test( 'returns to the start after the last sentence', async () => {
	const { page, close } = await open();
	await page.getByRole( 'button', { name: 'Listen' } ).click();
	await page.evaluate( () => {
		while ( window.speech.current ) {
			window.speech.finish();
		}
	} );
	assert.ok( await page.getByRole( 'button', { name: 'Listen' } ).isVisible() );
	assert.equal( await page.evaluate( () => CSS.highlights.has( 'jsw-listen' ) ), false );
	await close();
} );

test( 'shows Resume when another script cancels speech', async () => {
	const { page, close } = await open();
	await page.getByRole( 'button', { name: 'Listen' } ).click();
	await page.evaluate( () => speechSynthesis.cancel() );
	assert.ok( await page.getByRole( 'button', { name: 'Resume' } ).isVisible() );
	await close();
} );

test( 'hides itself when there are no voices', async () => {
	const { page, close } = await open( [] );
	await page.waitForTimeout( 100 );
	assert.equal( await page.locator( '[data-jsw-listen]' ).count(), 1 );
	assert.equal( await page.locator( '[data-jsw-listen]' ).isVisible(), false );
	await close();
} );

test( 'renders nothing when speechSynthesis is missing', async () => {
	const { page, close } = await openDemo( 'listen-to-page', {}, ( setupPage ) =>
		setupPage.addInitScript( () => delete Window.prototype.speechSynthesis && delete window.speechSynthesis )
	);
	await page.waitForTimeout( 100 );
	assert.equal( await page.getByRole( 'button', { name: 'Listen' } ).count(), 0 );
	await close();
} );

test( 'scrolls without animation under reduced motion', async () => {
	const { page, close } = await open( ENGLISH, { reducedMotion: 'reduce', viewport: { width: 400, height: 300 } } );
	await page.getByRole( 'button', { name: 'Listen' } ).click();
	for ( let i = 0; i < 8; i++ ) {
		await page.evaluate( () => window.speech.finish() );
	}
	// An instant scroll has landed by the next frame.
	const visible = await page.evaluate( async () => {
		await new Promise( requestAnimationFrame );
		const rect = CSS.highlights.get( 'jsw-listen' ).values().next().value.getBoundingClientRect();
		return scrollY > 0 && rect.top >= 0 && rect.bottom <= innerHeight;
	} );
	assert.ok( visible );
	await close();
} );
