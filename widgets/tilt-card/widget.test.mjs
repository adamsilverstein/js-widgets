import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDemo } from '../../test/harness.mjs';

const transformOf = ( locator ) => locator.evaluate( ( el ) => el.style.transform );
const shineOpacity = ( locator ) => locator.evaluate( ( el ) => Number( el.querySelector( 'jsw-tilt-shine' ).style.opacity ) );

/** Moves the mouse to a point in a card, given as fractions of its size. */
async function pointAt( page, card, fx, fy ) {
	const box = await card.boundingBox();
	await page.mouse.move( box.x + box.width * fx, box.y + box.height * fy, { steps: 4 } );
	await page.waitForTimeout( 500 );
}

test( 'tilts toward the pointer, shines, and eases back to rest on leave', async () => {
	const { page, errors, close } = await openDemo( 'tilt-card' );
	const card = page.locator( '.profile' );
	assert.equal( await transformOf( card ), '' );

	await pointAt( page, card, 0.9, 0.5 );
	assert.match( await transformOf( card ), /rotateY\((?!-)[\d.]+deg\)/, 'pointer on the right tilts the right edge away' );
	assert.ok( ( await shineOpacity( card ) ) > 0.3 );

	await page.mouse.move( 2, 2 );
	await page.waitForTimeout( 1500 );
	assert.equal( await transformOf( card ), '' );
	assert.equal( await shineOpacity( card ), 0 );
	assert.deepEqual( errors, [] );
	await close();
} );

test( 'keeps the layout, and content stays clickable and selectable', async () => {
	const { page, close } = await openDemo( 'tilt-card' );
	const card = page.locator( '.badge' );
	const layout = ( el ) => [ el.offsetLeft, el.offsetTop, el.offsetWidth, el.offsetHeight ];
	const before = await card.evaluate( layout );

	await pointAt( page, card, 0.5, 0.6 );
	assert.deepEqual( await card.evaluate( layout ), before );
	// A real mouse click at the button's position, so the shine overlay would catch it if it could.
	await page.getByRole( 'button', { name: 'Claim' } ).click();
	assert.equal( await page.getByRole( 'button' ).textContent(), 'Clicked' );

	const text = page.getByText( 'Each card tilts' );
	await text.selectText();
	assert.match( await page.evaluate( () => getSelection().toString() ), /Each card tilts/ );
	await close();
} );

test( 'cards tilt independently', async () => {
	const { page, close } = await openDemo( 'tilt-card' );
	await pointAt( page, page.locator( '.profile' ), 0.2, 0.2 );
	assert.notEqual( await transformOf( page.locator( '.profile' ) ), '' );
	assert.equal( await transformOf( page.locator( '.badge' ) ), '' );
	await close();
} );

test( 'tilts slightly when keyboard focus moves into a card', async () => {
	const { page, close } = await openDemo( 'tilt-card' );
	await page.getByRole( 'button', { name: 'Claim' } ).focus();
	await page.waitForTimeout( 600 );
	assert.notEqual( await transformOf( page.locator( '.badge' ) ), '' );
	await page.getByRole( 'button', { name: 'Claim' } ).blur();
	await page.waitForTimeout( 1500 );
	assert.equal( await transformOf( page.locator( '.badge' ) ), '' );
	await close();
} );

test( 'does nothing with reduced motion', async () => {
	const { page, close } = await openDemo( 'tilt-card', { reducedMotion: 'reduce' } );
	const card = page.locator( '.profile' );
	await pointAt( page, card, 0.9, 0.1 );
	await page.getByRole( 'button', { name: 'Claim' } ).focus();
	await page.waitForTimeout( 300 );
	assert.equal( await transformOf( card ), '' );
	assert.equal( await transformOf( page.locator( '.badge' ) ), '' );
	assert.equal( await shineOpacity( card ), 0 );
	await close();
} );

test( 'follows device orientation on touch screens', async () => {
	const { page, close } = await openDemo( 'tilt-card', { isMobile: true, hasTouch: true, viewport: { width: 400, height: 700 } } );
	const tilt = ( beta, gamma ) =>
		page.evaluate( ( [ b, g ] ) => dispatchEvent( new DeviceOrientationEvent( 'deviceorientation', { beta: b, gamma: g } ) ), [ beta, gamma ] );
	await tilt( 40, 0 );
	await page.waitForTimeout( 100 );
	assert.equal( await transformOf( page.locator( '.profile' ) ), '', 'the first reading sets the resting angle' );

	await tilt( 40, 15 );
	await page.waitForTimeout( 600 );
	for ( const selector of [ '.profile', '.badge' ] ) {
		assert.match( await transformOf( page.locator( selector ) ), /rotateY\((?!-)[\d.]+deg\)/ );
	}
	// Sensor noise on a phone lying still must not keep the animation running.
	await page.evaluate( () => {
		let i = 0;
		setInterval( () => dispatchEvent( new DeviceOrientationEvent( 'deviceorientation', { beta: 40 + ( i++ % 2 ) * 0.2, gamma: 0 } ) ), 16 );
	} );
	await page.waitForTimeout( 1000 );
	const frames = await page.evaluate( async () => {
		const first = getComputedStyle( document.querySelector( '.profile' ) ).transform;
		await new Promise( ( resolve ) => setTimeout( resolve, 300 ) );
		return [ first, getComputedStyle( document.querySelector( '.profile' ) ).transform ];
	} );
	assert.equal( frames[ 0 ], frames[ 1 ] );
	await close();
} );
