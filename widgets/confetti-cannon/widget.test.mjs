import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDemo } from '../../test/harness.mjs';

const canvasCount = ( page ) => page.locator( 'canvas' ).count();

/**
 * Returns the center of the painted pixels on the confetti canvas, in CSS pixels.
 *
 * @param {import('playwright').Page} page
 * @return {Promise<{x: number, y: number}|null>} Null when nothing is painted.
 */
const paintedCenter = ( page ) =>
	page.evaluate( () => {
		const canvas = document.querySelector( 'canvas' );
		const { data, width, height } = canvas.getContext( '2d' ).getImageData( 0, 0, canvas.width, canvas.height );
		let x = 0, y = 0, count = 0;
		for ( let i = 3; i < data.length; i += 4 ) {
			if ( data[ i ] ) {
				x += ( ( i - 3 ) / 4 ) % width;
				y += Math.floor( ( i - 3 ) / 4 / width );
				count++;
			}
		}
		const ratio = canvas.width / innerWidth;
		return count && height ? { x: x / count / ratio, y: y / count / ratio } : null;
	} );

/** Waits until the canvas has drawn a couple of frames. */
const afterFrames = ( page ) =>
	page.evaluate( () => new Promise( ( resolve ) => requestAnimationFrame( () => requestAnimationFrame( resolve ) ) ) );

test( 'fires from the clicked element, then removes the overlay', async () => {
	const { page, errors, close } = await openDemo( 'confetti-cannon' );
	const button = page.getByRole( 'button', { name: 'Celebrate' } );
	await button.click();
	await afterFrames( page );

	assert.equal( await canvasCount( page ), 1 );
	const box = await button.boundingBox();
	const center = await paintedCenter( page );
	assert.ok( center, 'confetti is drawn' );
	assert.ok( Math.abs( center.x - ( box.x + box.width / 2 ) ) < 60, `x ${ center.x } is near the button` );
	assert.ok( Math.abs( center.y - ( box.y + box.height / 2 ) ) < 80, `y ${ center.y } is near the button` );

	await page.locator( 'canvas' ).waitFor( { state: 'detached', timeout: 10000 } );
	assert.deepEqual( errors, [] );
	await close();
} );

test( 'fires from the bottom center on jsw:confetti', async () => {
	const { page, close } = await openDemo( 'confetti-cannon' );
	await page.getByRole( 'button', { name: 'Subscribe' } ).click();
	await afterFrames( page );

	const { width, height } = page.viewportSize();
	const center = await paintedCenter( page );
	assert.ok( center, 'confetti is drawn' );
	assert.ok( Math.abs( center.x - width / 2 ) < 60, `x ${ center.x } is near the middle` );
	assert.ok( center.y > height - 100, `y ${ center.y } is near the bottom` );
	await close();
} );

test( 'the overlay never blocks clicks', async () => {
	const { page, close } = await openDemo( 'confetti-cannon' );
	const button = page.getByRole( 'button', { name: 'Celebrate' } );
	await button.click();
	assert.equal( await canvasCount( page ), 1 );

	const { x, y, width, height } = await button.boundingBox();
	const hit = await page.evaluate( ( [ px, py ] ) => document.elementFromPoint( px, py ).textContent, [ x + width / 2, y + height / 2 ] );
	assert.equal( hit, 'Celebrate' );
	await close();
} );

test( 'fires on keyboard activation and on tap', async () => {
	const { page, close } = await openDemo( 'confetti-cannon', { hasTouch: true } );
	await page.getByRole( 'button', { name: 'Celebrate' } ).focus();
	await page.keyboard.press( 'Enter' );
	assert.equal( await canvasCount( page ), 1 );
	await page.locator( 'canvas' ).waitFor( { state: 'detached', timeout: 10000 } );

	await page.getByRole( 'button', { name: 'Celebrate' } ).tap();
	assert.equal( await canvasCount( page ), 1 );
	await close();
} );

test( 'rapid repeats share one overlay and still finish', async () => {
	const { page, close } = await openDemo( 'confetti-cannon' );
	const button = page.getByRole( 'button', { name: 'Celebrate' } );
	for ( let i = 0; i < 20; i++ ) {
		await button.click( { delay: 0 } );
	}
	assert.equal( await canvasCount( page ), 1 );
	await page.locator( 'canvas' ).waitFor( { state: 'detached', timeout: 10000 } );
	await close();
} );

test( 'does nothing with reduced motion', async () => {
	const { page, close } = await openDemo( 'confetti-cannon', { reducedMotion: 'reduce' } );
	await page.getByRole( 'button', { name: 'Celebrate' } ).click();
	await page.getByRole( 'button', { name: 'Subscribe' } ).click();
	await afterFrames( page );
	assert.equal( await canvasCount( page ), 0 );
	await close();
} );
