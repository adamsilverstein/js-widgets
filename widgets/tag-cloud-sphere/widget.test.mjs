import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDemo } from '../../test/harness.mjs';

const SLUG = 'tag-cloud-sphere';

/** Transform of every tag, in order. */
const transforms = ( page ) => page.locator( 'a' ).evaluateAll( ( links ) => links.map( ( link ) => link.style.transform ) );

/** Center of the sphere in page coordinates. */
async function center( page ) {
	const box = await page.locator( '.wp-block-tag-cloud' ).boundingBox();
	return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test( 'leaves the list alone without JavaScript', async () => {
	const { page, close } = await openDemo( SLUG, { javaScriptEnabled: false } );
	assert.equal( await page.locator( '.wp-block-tag-cloud > a' ).count(), 50 );
	await close();
} );

test( 'moves the same links onto the sphere', async () => {
	const { page, errors, close } = await openDemo( SLUG );
	const links = page.locator( 'a' );
	assert.equal( await links.count(), 50 );
	// The links now live in the widget's shadow root, still with their hrefs.
	assert.equal( await page.locator( '.wp-block-tag-cloud > a' ).count(), 0 );
	assert.equal( await links.first().getAttribute( 'href' ), '#javascript' );
	assert.match( ( await transforms( page ) )[ 0 ], /translate3d/ );
	assert.deepEqual( errors, [] );
	await close();
} );

test( 'rotates on its own, and pauses on hover and with the pause button', async () => {
	const { page, close } = await openDemo( SLUG );
	const before = await transforms( page );
	await page.waitForTimeout( 200 );
	assert.notDeepEqual( await transforms( page ), before, 'rotates' );

	const { x, y } = await center( page );
	await page.mouse.move( x, y );
	await page.waitForTimeout( 50 );
	const hovered = await transforms( page );
	await page.waitForTimeout( 200 );
	assert.deepEqual( await transforms( page ), hovered, 'paused on hover' );

	await page.mouse.move( 0, 0 );
	const button = page.getByRole( 'button', { name: 'Pause tag cloud rotation' } );
	await button.click();
	await page.mouse.move( 0, 0 );
	await page.waitForTimeout( 50 );
	const paused = await transforms( page );
	await page.waitForTimeout( 200 );
	assert.deepEqual( await transforms( page ), paused, 'paused by button' );
	await page.getByRole( 'button', { name: 'Play tag cloud rotation' } ).click();
	await close();
} );

test( 'stands still with reduced motion', async () => {
	const { page, close } = await openDemo( SLUG, { reducedMotion: 'reduce' } );
	// Let the first layout size the sphere.
	await page.waitForTimeout( 100 );
	const before = await transforms( page );
	await page.waitForTimeout( 300 );
	assert.deepEqual( await transforms( page ), before );
	assert.equal( await page.getByRole( 'button' ).count(), 0, 'nothing to pause' );
	await close();
} );

test( 'turns a tag focused with the keyboard to the front', async () => {
	const { page, close } = await openDemo( SLUG );
	await page.keyboard.press( 'Tab' );
	await page.keyboard.press( 'Tab' );
	await page.waitForTimeout( 1200 );
	const { focused, front } = await page.locator( 'a' ).evaluateAll( ( links ) => {
		const active = document.querySelector( '.wp-block-tag-cloud > div' ).shadowRoot.activeElement;
		return {
			focused: Number( active.style.zIndex ),
			front: Math.max( ...links.map( ( link ) => Number( link.style.zIndex ) ) ),
		};
	} );
	assert.equal( focused, front );
	assert.equal( focused, 200 );
	await close();
} );

test( 'spins on drag without following the link under the pointer', async () => {
	// Reduced motion, so only the drag can turn the sphere.
	const { page, close } = await openDemo( SLUG, { reducedMotion: 'reduce' } );
	const { x, y } = await center( page );
	await page.mouse.move( x, y );
	const before = await transforms( page );
	await page.mouse.down();
	await page.mouse.move( x + 80, y + 30, { steps: 5 } );
	await page.mouse.up();
	assert.notDeepEqual( await transforms( page ), before );
	assert.equal( await page.evaluate( () => location.hash ), '' );
	await close();
} );

test( 'resumes rotating after a drag that starts on a tag', async () => {
	const { page, close } = await openDemo( SLUG );
	await page.waitForTimeout( 100 );
	const { x, y } = await page.locator( 'a' ).evaluateAll( ( links ) => {
		const front = links.reduce( ( a, b ) => ( Number( b.style.zIndex ) > Number( a.style.zIndex ) ? b : a ) );
		const box = front.getBoundingClientRect();
		return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
	} );
	await page.mouse.move( x, y );
	await page.mouse.down();
	await page.mouse.move( x + 60, y, { steps: 5 } );
	await page.waitForTimeout( 120 );
	await page.mouse.up();
	await page.mouse.move( 0, 0 );
	await page.waitForTimeout( 50 );
	const before = await transforms( page );
	await page.waitForTimeout( 200 );
	assert.notDeepEqual( await transforms( page ), before );
	await close();
} );

test( 'spins on touch drag', async () => {
	const { page, close } = await openDemo( SLUG, { hasTouch: true, reducedMotion: 'reduce' } );
	const { x, y } = await center( page );
	await page.waitForTimeout( 100 );
	const before = await transforms( page );
	const cdp = await page.context().newCDPSession( page );
	const touch = ( type, px ) =>
		cdp.send( 'Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [ { x: px, y } ] } );
	await touch( 'touchStart', x );
	for ( let step = 1; step <= 5; step++ ) {
		await touch( 'touchMove', x + step * 15 );
	}
	await touch( 'touchEnd' );
	await page.waitForTimeout( 50 );
	assert.notDeepEqual( await transforms( page ), before );
	await close();
} );

test( 'a plain click still follows the link', async () => {
	const { page, close } = await openDemo( SLUG, { reducedMotion: 'reduce' } );
	const front = page.locator( 'a' ).evaluateAll( ( links ) =>
		links.reduce( ( a, b ) => ( Number( b.style.zIndex ) > Number( a.style.zIndex ) ? b : a ) ).getAttribute( 'href' )
	);
	const href = await front;
	await page.locator( `a[href="${ href }"]` ).click();
	assert.equal( await page.evaluate( () => location.hash ), href );
	await close();
} );

test( 'keeps up with 50 tags', async () => {
	const { page, close } = await openDemo( SLUG );
	const frames = await page.evaluate(
		() =>
			new Promise( ( resolve ) => {
				let count = 0;
				const start = performance.now();
				const step = () => ( ++count, performance.now() - start < 1000 ? requestAnimationFrame( step ) : resolve( count ) );
				requestAnimationFrame( step );
			} )
	);
	// Headless Chromium runs at 60fps. Leave room for a busy CI machine.
	assert.ok( frames >= 40, `${ frames } frames in a second` );
	await close();
} );
