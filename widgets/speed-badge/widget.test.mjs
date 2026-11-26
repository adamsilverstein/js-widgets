import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDemo } from '../../test/harness.mjs';

/** Serves the demo with `data-metric="lcp"` on its script tag replaced by `attributes`. */
const withAttributes = ( attributes ) => ( page ) =>
	page.route(
		( url ) => url.pathname.endsWith( '/demos/speed-badge/' ),
		async ( route ) => {
			const response = await route.fetch();
			const body = ( await response.text() ).replace( 'data-metric="lcp"', attributes );
			await route.fulfill( { response, body } );
		}
	);

/** Hides entry types from the widget, as a browser that lacks them would. */
const without = ( ...types ) => ( page ) =>
	page.addInitScript( ( hidden ) => {
		const all = PerformanceObserver.supportedEntryTypes.filter( ( type ) => ! hidden.includes( type ) );
		Object.defineProperty( PerformanceObserver, 'supportedEntryTypes', { get: () => all } );
	}, types );

test( 'shows LCP in the badge soon after load', async () => {
	const { page, close } = await openDemo( 'speed-badge' );
	await page.getByRole( 'button', { name: /^Loaded in \d+\.\d\ds$/ } ).waitFor( { timeout: 2000 } );
	await close();
} );

test( 'the panel rates LCP, CLS and INP, and updates after an interaction', async () => {
	const { page, close } = await openDemo( 'speed-badge' );
	await page.getByRole( 'button', { name: 'Slow click' } ).click();
	await page.getByRole( 'button', { name: /^Loaded in/ } ).click();

	const panel = page.locator( 'table' );
	// The demo's slow button blocks for 300ms, between INP's 200ms and 500ms thresholds.
	await panel.getByText( 'needs improvement' ).waitFor();
	const text = await panel.innerText();
	assert.match( text, /LCP\s+\d+\.\d\ds\s+good/ );
	assert.match( text, /CLS\s+0\.00\s+good/ );
	assert.match( text, /INP\s+\d+ms\s+needs improvement/ );

	await page.keyboard.press( 'Escape' );
	assert.equal( await panel.isVisible(), false );
	await close();
} );

test( 'opens and closes from the keyboard', async () => {
	const { page, close } = await openDemo( 'speed-badge' );
	const badge = page.getByRole( 'button', { name: /^Loaded in/ } );
	await badge.focus();
	await page.keyboard.press( 'Enter' );
	assert.equal( await page.locator( 'table' ).isVisible(), true );
	await page.keyboard.press( 'Escape' );
	assert.equal( await page.locator( 'table' ).isVisible(), false );
	await close();
} );

test( 'the badge causes no layout shift as it updates', async () => {
	const { page, close } = await openDemo( 'speed-badge', {}, ( setupPage ) =>
		setupPage.addInitScript( () => {
			window.shifts = 0;
			new PerformanceObserver( ( list ) => ( window.shifts += list.getEntries().length ) ).observe( {
				type: 'layout-shift',
				buffered: true,
			} );
		} )
	);
	const badge = page.getByRole( 'button', { name: /^Loaded in/ } );
	const before = await badge.boundingBox();
	await page.getByRole( 'button', { name: /^Loaded in \d/ } ).waitFor();
	await page.waitForTimeout( 300 );
	assert.equal( await page.evaluate( () => window.shifts ), 0 );
	assert.deepEqual( await badge.boundingBox(), before );
	await close();
} );

test( 'leaves out metrics the browser does not support', async () => {
	const { page, close } = await openDemo( 'speed-badge', {}, without( 'layout-shift' ) );
	await page.getByRole( 'button', { name: /^Loaded in/ } ).click();
	const text = await page.locator( 'table' ).innerText();
	assert.match( text, /LCP/ );
	assert.match( text, /INP\s+waiting/ );
	assert.doesNotMatch( text, /CLS/ );
	await close();
} );

test( 'falls back to a supported headline metric', async () => {
	const { page, close } = await openDemo( 'speed-badge', {}, without( 'largest-contentful-paint' ) );
	await page.getByRole( 'button', { name: 'Layout shift 0.00' } ).waitFor();
	assert.doesNotMatch( await page.locator( 'table' ).innerHTML(), /LCP/ );
	await close();
} );

test( 'data-metric picks the headline', async () => {
	const { page, close } = await openDemo( 'speed-badge', {}, withAttributes( 'data-metric="inp"' ) );
	await page.getByRole( 'button', { name: 'Responds in …' } ).waitFor();
	await page.getByRole( 'button', { name: 'Slow click' } ).click();
	await page.getByRole( 'button', { name: /^Responds in \d+ms$/ } ).waitFor();
	await close();
} );

test( 'data-param shows the badge only with that query parameter', async () => {
	const { page, close } = await openDemo( 'speed-badge', {}, withAttributes( 'data-param="speed"' ) );
	const badge = page.getByRole( 'button', { name: /^Loaded in/ } );
	assert.equal( await badge.count(), 0 );

	await page.goto( `${ page.url() }?speed` );
	assert.equal( await badge.count(), 1 );
	await close();
} );
