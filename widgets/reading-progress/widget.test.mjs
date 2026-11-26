import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDemo } from '../../test/harness.mjs';

/** Records which events the page listens for on `window`. */
const recordListeners = ( page ) =>
	page.addInitScript( () => {
		window.listened = [];
		const add = window.addEventListener;
		window.addEventListener = function ( type, ...rest ) {
			window.listened.push( type );
			return add.call( this, type, ...rest );
		};
	} );

/** Scrolls so `edge` of the article lines up with the same edge of the viewport, or to the page end. */
async function scrollTo( page, edge ) {
	await page.evaluate( ( where ) => {
		const { top, bottom } = document.querySelector( 'article' ).getBoundingClientRect();
		const y = { top: scrollY + top, bottom: scrollY + bottom - innerHeight, end: document.body.scrollHeight }[ where ];
		scrollTo( 0, y );
	}, edge );
	// Scroll-driven animations update on the next frame.
	await page.evaluate( () => new Promise( ( resolve ) => requestAnimationFrame( () => requestAnimationFrame( resolve ) ) ) );
}

/** The widget's host element, appended to the body. */
const HOST = 'body > div[aria-hidden="true"]';

/** The bar's horizontal scale, 0 to 1. */
const progress = ( page ) =>
	page.locator( `${ HOST } div` ).evaluate( ( bar ) => new DOMMatrix( getComputedStyle( bar ).transform ).a );

/** The minutes the pill shows. */
const minutesLeft = ( page ) =>
	page.locator( `${ HOST } b` ).evaluate( ( pill ) => Number( getComputedStyle( pill ).getPropertyValue( '--jsw-min' ) ) );

async function assertTracksArticle( page ) {
	await scrollTo( page, 'top' );
	assert.ok( ( await progress( page ) ) < 0.01, 'empty at the top of the article' );
	const start = await minutesLeft( page );
	assert.ok( start >= 2, `shows the full estimate at the start, got ${ start }` );

	await page.evaluate( () => scrollBy( 0, ( document.querySelector( 'article' ).offsetHeight - innerHeight ) / 2 ) );
	await page.evaluate( () => new Promise( ( resolve ) => requestAnimationFrame( () => requestAnimationFrame( resolve ) ) ) );
	const half = await progress( page );
	assert.ok( half > 0.4 && half < 0.6, `about half full in the middle, got ${ half }` );
	assert.ok( ( await minutesLeft( page ) ) < start, 'the estimate counts down' );

	await scrollTo( page, 'bottom' );
	assert.ok( ( await progress( page ) ) > 0.99, 'full at the end of the article' );
	await scrollTo( page, 'end' );
	assert.ok( ( await progress( page ) ) > 0.99, 'the footer and comments do not change it' );
}

test( 'tracks the article with a scroll-driven animation and no scroll listener', async () => {
	const { page, errors, close } = await openDemo( 'reading-progress', {}, recordListeners );
	assert.ok( await page.evaluate( () => 'ViewTimeline' in window ), 'test browser supports view timelines' );
	await assertTracksArticle( page );
	assert.ok( ! ( await page.evaluate( () => window.listened ) ).includes( 'scroll' ), 'no scroll listener' );
	assert.deepEqual( errors, [] );
	await close();
} );

test( 'falls back to a scroll listener without scroll-driven animations', async () => {
	const { page, errors, close } = await openDemo( 'reading-progress', {}, async ( p ) => {
		await p.addInitScript( () => delete window.ViewTimeline );
		await recordListeners( p );
	} );
	await assertTracksArticle( page );
	assert.ok( ( await page.evaluate( () => window.listened ) ).includes( 'scroll' ) );
	assert.deepEqual( errors, [] );
	await close();
} );

test( 'hides the bar and pill from assistive technology', async () => {
	const { page, close } = await openDemo( 'reading-progress' );
	assert.equal( await page.locator( `${ HOST } b` ).count(), 1, 'shows the pill' );
	const session = await page.context().newCDPSession( page );
	const { nodes } = await session.send( 'Accessibility.getFullAXTree' );
	const exposed = nodes.filter( ( node ) => ! node.ignored && node.name?.value?.includes( 'min left' ) );
	assert.deepEqual( exposed, [] );
	await close();
} );

test( 'leaves the time left out for a short article', async () => {
	const { page, close } = await openDemo( 'reading-progress', {}, ( p ) =>
		p.addInitScript( () =>
			// Runs before the widget's own DOMContentLoaded handler.
			addEventListener( 'DOMContentLoaded', () => document.querySelector( 'article' ).replaceChildren( 'A short note.' ) )
		)
	);
	assert.equal( await page.locator( `${ HOST } div` ).count(), 1, 'still shows the bar' );
	assert.equal( await page.locator( `${ HOST } b` ).count(), 0 );
	await close();
} );

test( 'lets clicks through to the page under the bar and pill', async () => {
	const { page, close } = await openDemo( 'reading-progress' );
	await scrollTo( page, 'bottom' );
	const hits = await page.evaluate( ( selector ) => {
		const host = document.querySelector( selector );
		return [ ...host.shadowRoot.querySelectorAll( 'div,b' ) ].map( ( element ) => {
			const { x, y, width, height } = element.getBoundingClientRect();
			return document.elementFromPoint( x + width / 2, y + height / 2 ) === host;
		} );
	}, HOST );
	assert.deepEqual( hits, [ false, false ] );
	await close();
} );
