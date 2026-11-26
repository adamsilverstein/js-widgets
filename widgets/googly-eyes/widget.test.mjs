import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDemo } from '../../test/harness.mjs';

/** Returns each pupil's horizontal and vertical offset in pixels. */
const pupils = ( page ) =>
	page.evaluate( () =>
		[ ...document.querySelector( 'script[src*="eyes"] + div' ).shadowRoot.querySelectorAll( 'b' ) ].map( ( pupil ) =>
			( pupil.style.translate || '0px 0px' ).split( ' ' ).map( parseFloat )
		)
	);

/** Fakes timers and counts blinks, so idle behavior can be checked without waiting. */
const withClock = async ( page ) => {
	await page.clock.install();
	await page.addInitScript( () => {
		window.blinks = 0;
		const animate = Element.prototype.animate;
		Element.prototype.animate = function ( ...args ) {
			window.blinks++;
			return animate.apply( this, args );
		};
	} );
};

test( 'renders two decorative eyes in a shadow root right after the snippet', async () => {
	const { page, errors, close } = await openDemo( 'googly-eyes' );
	const info = await page.evaluate( () => {
		const host = document.querySelector( 'script[src*="eyes"]' ).nextElementSibling;
		const wrap = host.shadowRoot.querySelector( 'p' );
		return {
			eyes: wrap.querySelectorAll( 'i' ).length,
			hidden: wrap.getAttribute( 'aria-hidden' ),
			width: wrap.firstElementChild.getBoundingClientRect().width,
			lightDomStyles: document.querySelectorAll( 'style' ).length,
		};
	} );
	assert.equal( info.eyes, 2 );
	assert.equal( info.hidden, 'true' );
	assert.equal( info.width, 64 );
	// Only the demo's own <style>: the widget adds nothing to the page.
	assert.equal( info.lightDomStyles, 2 );
	assert.deepEqual( errors, [] );
	await close();
} );

test( 'pupils follow the mouse', async () => {
	const { page, close } = await openDemo( 'googly-eyes', { reducedMotion: 'reduce' } );
	const { width, height } = page.viewportSize();
	await page.mouse.move( width - 1, 1 );
	await page.waitForFunction( () => document.querySelector( 'script[src*="eyes"] + div' ).shadowRoot.querySelector( 'b' ).style.translate );
	for ( const [ x, y ] of await pupils( page ) ) {
		assert.ok( x > 0 && y < 0, `looks up and right, got ${ x } ${ y }` );
	}
	await page.mouse.move( 1, height - 1 );
	await page.waitForTimeout( 50 );
	for ( const [ x, y ] of await pupils( page ) ) {
		assert.ok( x < 0 && y > 0, `looks down and left, got ${ x } ${ y }` );
	}
	await close();
} );

test( 'pupils follow touch and pen input', async () => {
	const { page, close } = await openDemo( 'googly-eyes', { hasTouch: true, reducedMotion: 'reduce' } );
	const { width, height } = page.viewportSize();
	await page.touchscreen.tap( 1, height - 1 );
	await page.waitForTimeout( 50 );
	for ( const [ x, y ] of await pupils( page ) ) {
		assert.ok( x < 0 && y > 0, `looks at the touch point, got ${ x } ${ y }` );
	}
	await page.evaluate(
		( [ x, y ] ) => dispatchEvent( new PointerEvent( 'pointermove', { clientX: x, clientY: y, pointerType: 'pen' } ) ),
		[ width - 1, 1 ]
	);
	await page.waitForTimeout( 50 );
	for ( const [ x, y ] of await pupils( page ) ) {
		assert.ok( x > 0 && y < 0, `looks at the pen, got ${ x } ${ y }` );
	}
	await close();
} );

test( 'goes wide for a moment on click', async () => {
	const { page, close } = await openDemo( 'googly-eyes' );
	const wide = () => page.evaluate( () => document.querySelector( 'script[src*="eyes"] + div' ).shadowRoot.querySelector( 'p' ).className );
	await page.mouse.click( 10, 10 );
	assert.equal( await wide(), 'w' );
	await page.waitForFunction( () => ! document.querySelector( 'script[src*="eyes"] + div' ).shadowRoot.querySelector( 'p' ).className );
	await close();
} );

test( 'blinks and wanders when idle', async () => {
	const { page, close } = await openDemo( 'googly-eyes', {}, withClock );
	await page.clock.runFor( 13000 );
	assert.ok( ( await page.evaluate( () => window.blinks ) ) >= 4, 'blinked at least twice' );
	const moved = ( await pupils( page ) ).some( ( [ x, y ] ) => x || y );
	assert.ok( moved, 'pupils wandered with no input' );
	await close();
} );

test( 'neither blinks nor wanders with reduced motion', async () => {
	const { page, close } = await openDemo( 'googly-eyes', { reducedMotion: 'reduce' }, withClock );
	await page.clock.runFor( 30000 );
	assert.equal( await page.evaluate( () => window.blinks ), 0 );
	assert.deepEqual( await pupils( page ), [ [ 0, 0 ], [ 0, 0 ] ] );
	await close();
} );

test( 'leaves no globals behind', async () => {
	const { page, close } = await openDemo( 'googly-eyes', {}, ( setupPage ) =>
		setupPage.addInitScript( () => {
			window.before = Object.keys( window );
		} )
	);
	const added = await page.evaluate( () => Object.keys( window ).filter( ( key ) => ! window.before.includes( key ) ) );
	assert.deepEqual( added, [ 'before' ] );
	await close();
} );
