import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDemo } from '../../test/harness.mjs';

/** Returns the pet's state class and horizontal position. */
const read = ( page ) =>
	page.evaluate( () => {
		const pet = [ ...document.body.children ].find( ( el ) => el.shadowRoot )?.shadowRoot.querySelector( '.pet' );
		return pet && { state: pet.className, x: parseFloat( pet.style.translate ) || 0 };
	} );

test( 'draws a pet that is hidden from assistive technology, with a labelled hide button', async () => {
	const requests = [];
	const { page, close } = await openDemo( 'pet-companion', {}, ( p ) => p.on( 'request', ( r ) => requests.push( r.url() ) ) );
	await page.waitForTimeout( 200 );
	assert.equal( await page.locator( '.pet' ).getAttribute( 'aria-hidden' ), 'true' );
	assert.equal( await page.getByRole( 'button', { name: 'Hide the pet' } ).count(), 1 );
	// The page and the widget script, nothing else.
	assert.deepEqual( requests.map( ( url ) => new URL( url ).pathname ), [ '/demos/pet-companion/', '/pet.min.js' ] );
	await close();
} );

test( 'shows the cat for any data-pet value', async () => {
	const { page, errors, close } = await openDemo( 'pet-companion', {}, ( p ) =>
		p.route( '**/demos/pet-companion/', async ( route ) => {
			const body = ( await ( await route.fetch() ).text() ).replace( 'data-pet="cat"', 'data-pet="constructor"' );
			await route.fulfill( { body, contentType: 'text/html' } );
		} )
	);
	await page.waitForTimeout( 200 );
	assert.deepEqual( errors, [] );
	assert.equal( await page.locator( '.pet' ).count(), 1 );
	await close();
} );

test( 'walks on its own', async () => {
	const { page, close } = await openDemo( 'pet-companion' );
	const before = await read( page );
	await page.waitForTimeout( 1500 );
	const after = await read( page );
	assert.notEqual( after.x, before.x );
	await close();
} );

test( 'chases a nearby pointer, then sits by it', async () => {
	const { page, close } = await openDemo( 'pet-companion', { viewport: { width: 600, height: 300 } } );
	await page.waitForTimeout( 100 );
	const { x } = await read( page );
	const goal = Math.min( x + 120, 500 );
	await page.mouse.move( goal, 290 );
	await page.waitForTimeout( 100 );
	assert.match( ( await read( page ) ).state, /chase/ );
	await page.waitForTimeout( 1500 );
	const pet = await read( page );
	assert.match( pet.state, /sit/ );
	assert.ok( Math.abs( pet.x + 24 - goal ) < 4, `pet at ${ pet.x } should be centered on ${ goal }` );
	await close();
} );

test( 'shows a heart when clicked', async () => {
	const { page, close } = await openDemo( 'pet-companion' );
	await page.locator( '.pet' ).click( { force: true } );
	assert.equal( await page.locator( '.heart' ).textContent(), '♥' );
	assert.match( ( await read( page ) ).state, /love/ );
	await close();
} );

test( 'shows a heart when tapped on a touch screen', async () => {
	const { page, close } = await openDemo( 'pet-companion', { hasTouch: true, isMobile: true } );
	await page.locator( '.pet' ).tap( { force: true } );
	assert.equal( await page.locator( '.heart' ).count(), 1 );
	await close();
} );

test( 'naps when the page has been still', async () => {
	const { page, close } = await openDemo( 'pet-companion', {}, ( p ) => p.clock.install() );
	await page.clock.runFor( 21000 );
	assert.match( ( await read( page ) ).state, /sleep/ );
	await page.mouse.move( 10, 10 );
	await page.clock.runFor( 100 );
	assert.doesNotMatch( ( await read( page ) ).state, /sleep/ );
	await close();
} );

test( 'naps beside a pointer that stops moving, and stops animating while asleep', async () => {
	const { page, close } = await openDemo( 'pet-companion', { viewport: { width: 600, height: 300 } }, ( p ) => p.clock.install() );
	await page.clock.runFor( 100 );
	const { x } = await read( page );
	await page.mouse.move( x + 60, 290 );
	await page.clock.runFor( 21000 );
	assert.match( ( await read( page ) ).state, /sleep/ );
	await page.evaluate( () => {
		const request = requestAnimationFrame;
		window.frameCount = 0;
		window.requestAnimationFrame = ( fn ) => request( fn, window.frameCount++ );
	} );
	await page.clock.runFor( 1000 );
	assert.equal( await page.evaluate( () => window.frameCount ), 0 );
	await close();
} );

test( 'sits still with reduced motion', async () => {
	const { page, close } = await openDemo( 'pet-companion', { reducedMotion: 'reduce' } );
	const before = await read( page );
	await page.mouse.move( 60, 270 );
	await page.waitForTimeout( 1000 );
	assert.deepEqual( await read( page ), before );
	assert.match( before.state, /sit/ );
	await close();
} );

test( 'leaves the rest of the page clickable', async () => {
	const { page, close } = await openDemo( 'pet-companion' );
	await page.waitForTimeout( 100 );
	const hit = await page.evaluate( () => {
		const host = [ ...document.body.children ].find( ( el ) => el.shadowRoot );
		return {
			hostIgnoresPointer: getComputedStyle( host ).pointerEvents === 'none',
			// Bottom right corner, away from where the pet starts.
			corner: document.elementFromPoint( innerWidth - 2, innerHeight - 2 ) === host,
		};
	} );
	assert.deepEqual( hit, { hostIgnoresPointer: true, corner: false } );
	await close();
} );

test( 'stays hidden for the session once dismissed', async () => {
	const { page, close } = await openDemo( 'pet-companion' );
	await page.getByRole( 'button', { name: 'Hide the pet' } ).click( { force: true } );
	assert.equal( await page.locator( '.pet' ).count(), 0 );
	await page.reload();
	await page.waitForTimeout( 200 );
	assert.equal( await page.locator( '.pet' ).count(), 0 );
	await close();
} );
