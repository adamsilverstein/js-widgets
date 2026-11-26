import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDemo } from '../../test/harness.mjs';

const RAMP = ' .:-=+*#%@';

/** Resolves once the ASCII layer has text. */
const firstFrame = ( page ) => page.waitForFunction( () => document.querySelector( 'div' )?.shadowRoot?.querySelector( 'pre' )?.textContent );

/** Counts ASCII frame updates over `ms` milliseconds. */
const countFrames = ( page, ms ) =>
	page.evaluate(
		( wait ) =>
			new Promise( ( resolve ) => {
				let frames = 0;
				const pre = document.querySelector( 'div' ).shadowRoot.querySelector( 'pre' );
				const observer = new MutationObserver( () => frames++ );
				observer.observe( pre, { childList: true, characterData: true, subtree: true } );
				setTimeout( () => {
					observer.disconnect();
					resolve( frames );
				}, wait );
			} ),
		ms
	);

test( 'plays muted as 100 columns of ASCII at a steady frame rate', async () => {
	const { page, errors, close } = await openDemo( 'ascii-cinema' );
	await firstFrame( page );

	const text = await page.getByRole( 'img', { name: 'Video shown as ASCII art' } ).textContent();
	const lines = text.trimEnd().split( '\n' );
	assert.equal( lines[ 0 ].length, 100 );
	// A 16:9 clip in 0.6:1 character cells.
	assert.equal( lines.length, Math.round( ( 100 * 9 * 0.6 ) / 16 ) );
	assert.ok( [ ...text.replaceAll( '\n', '' ) ].every( ( char ) => RAMP.includes( char ) ) );

	assert.deepEqual( await page.evaluate( () => [ document.querySelector( 'video' ).paused, document.querySelector( 'video' ).muted ] ), [ false, true ] );
	// The clip is 24 fps. Headless timing is loose, so allow for dropped frames.
	assert.ok( ( await countFrames( page, 2000 ) ) >= 30, 'converts most frames' );
	assert.deepEqual( errors, [] );
	await close();
} );

test( 'Pause stops conversion and Play resumes it', async () => {
	const { page, close } = await openDemo( 'ascii-cinema' );
	await firstFrame( page );

	await page.getByRole( 'button', { name: 'Pause' } ).click();
	assert.equal( await page.evaluate( () => document.querySelector( 'video' ).paused ), true );
	assert.equal( await countFrames( page, 500 ), 0 );

	await page.getByRole( 'button', { name: 'Play' } ).click();
	assert.ok( ( await countFrames( page, 500 ) ) > 0 );
	await close();
} );

test( 'toggles to the real video with its native controls and back, by click or keyboard', async () => {
	const { page, close } = await openDemo( 'ascii-cinema' );
	await firstFrame( page );
	const state = () =>
		page.evaluate( () => {
			const video = document.querySelector( 'video' );
			return { ascii: ! document.querySelector( 'div' ).shadowRoot.querySelector( 'pre' ).hidden, inert: video.inert, controls: video.controls };
		} );

	assert.deepEqual( await state(), { ascii: true, inert: true, controls: true } );
	await page.getByRole( 'img' ).click();
	assert.deepEqual( await state(), { ascii: false, inert: false, controls: true } );

	const toggle = page.getByRole( 'button', { name: 'Show ASCII' } );
	await toggle.focus();
	await page.keyboard.press( 'Enter' );
	assert.deepEqual( await state(), { ascii: true, inert: true, controls: true } );
	await close();
} );

test( 'pauses when scrolled out of view and resumes when back', async () => {
	const { page, close } = await openDemo( 'ascii-cinema', { viewport: { width: 400, height: 300 } } );
	await firstFrame( page );
	const paused = () => page.evaluate( () => document.querySelector( 'video' ).paused );

	await page.evaluate( () => {
		document.body.style.paddingBottom = '3000px';
		scrollTo( 0, 2000 );
	} );
	await page.waitForFunction( () => document.querySelector( 'video' ).paused );

	await page.evaluate( () => scrollTo( 0, 0 ) );
	await page.waitForFunction( () => ! document.querySelector( 'video' ).paused );
	assert.equal( await paused(), false );
	await close();
} );

test( 'does not autoplay with reduced motion', async () => {
	const { page, close } = await openDemo( 'ascii-cinema', { reducedMotion: 'reduce' } );
	await firstFrame( page );
	await page.waitForTimeout( 300 );
	assert.equal( await page.evaluate( () => document.querySelector( 'video' ).paused ), true );
	await page.getByRole( 'button', { name: 'Play' } ).click();
	await page.waitForFunction( () => ! document.querySelector( 'video' ).paused );
	await close();
} );

test( 'falls back to the plain video when the canvas cannot be read', async () => {
	const { page, errors, close } = await openDemo( 'ascii-cinema', {}, ( page ) =>
		page.addInitScript( () => {
			CanvasRenderingContext2D.prototype.getImageData = () => {
				throw new DOMException( 'Tainted canvas', 'SecurityError' );
			};
		} )
	);
	await page.waitForFunction( () => document.querySelector( 'video' ).readyState >= 2 );
	await page.waitForTimeout( 200 );

	const state = await page.evaluate( () => {
		const root = document.querySelector( 'div' ).shadowRoot;
		const shown = ( selector ) => getComputedStyle( root.querySelector( selector ) ).display !== 'none';
		return { ascii: shown( 'pre' ), bar: shown( '.bar' ), inert: document.querySelector( 'video' ).inert };
	} );
	assert.deepEqual( state, { ascii: false, bar: false, inert: false } );
	assert.deepEqual( errors, [] );
	await close();
} );

test( 'falls back to requestAnimationFrame without requestVideoFrameCallback', async () => {
	const { page, close } = await openDemo( 'ascii-cinema', {}, ( page ) =>
		page.addInitScript( () => delete HTMLVideoElement.prototype.requestVideoFrameCallback )
	);
	await firstFrame( page );
	assert.ok( ( await countFrames( page, 1000 ) ) > 10 );
	await close();
} );

test( 'enhances an existing video and keeps its captions', async () => {
	const { page, errors, close } = await openDemo( 'ascii-cinema' );
	// Same URL, so the relative paths resolve as on the demo page.
	await page.setContent( `<video id="clip" src="clip.mp4" controls loop playsinline>
		<track kind="captions" src="captions.vtt" srclang="en" label="English" default>
	</video>
	<script src="../../ascii.min.js" data-target="#clip" data-cols="40" data-ramp=" #"></script>` );
	await firstFrame( page );

	const text = await page.getByRole( 'img' ).textContent();
	assert.equal( text.split( '\n' )[ 0 ].length, 40 );
	assert.match( text, /^[ #\n]+$/ );

	await page.getByRole( 'button', { name: 'Show video' } ).click();
	const video = await page.evaluate( () => {
		const element = document.getElementById( 'clip' );
		return { inWidget: element.parentElement.shadowRoot !== null, controls: element.controls, tracks: element.textTracks.length, mode: element.textTracks[ 0 ].mode };
	} );
	assert.deepEqual( video, { inWidget: true, controls: true, tracks: 1, mode: 'showing' } );
	assert.deepEqual( errors, [] );
	await close();
} );
