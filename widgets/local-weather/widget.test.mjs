import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDemo } from '../../test/harness.mjs';

const FORECAST = {
	current: { temperature_2m: 71.6, weather_code: 61, is_day: 1 },
	daily: {
		time: [ '2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04' ],
		weather_code: [ 61, 0, 3, 95 ],
		temperature_2m_max: [ 75.2, 80, 66.4, 70 ],
		temperature_2m_min: [ 50, 52.6, 48, 49 ],
	},
};

/**
 * Stubs Open-Meteo and records the URL of every request to it.
 *
 * @param {Object} [options]        Stub options.
 * @param {number} [options.status] HTTP status to answer with.
 * @return {{requests: URL[], setup: Function}} Requests seen, and an openDemo setup callback.
 */
function stubApi( { status = 200 } = {} ) {
	const requests = [];
	const setup = async ( page ) => {
		await page.route( 'https://api.open-meteo.com/**', ( route ) => {
			requests.push( new URL( route.request().url() ) );
			return route.fulfill( { status, contentType: 'application/json', body: JSON.stringify( FORECAST ), headers: { 'Access-Control-Allow-Origin': '*' } } );
		} );
	};
	return { requests, setup };
}

const fixedCard = ( page ) => page.getByRole( 'region', { name: 'Weather in Bend, OR' } );

test( 'shows current conditions and three days for the configured location', async () => {
	const { requests, setup } = stubApi();
	const { page, errors, close } = await openDemo( 'local-weather', {}, setup );
	const card = fixedCard( page );
	await card.getByText( '72°' ).waitFor();
	assert.match( await card.textContent(), /Rain/ );
	assert.match( await card.textContent(), /High 75° · Low 50°/ );

	const days = card.getByRole( 'list', { name: 'Next three days' } ).getByRole( 'listitem' );
	assert.equal( await days.count(), 3 );
	assert.match( await days.nth( 0 ).textContent(), /^Tue80° 53°$/ );
	assert.equal( await days.nth( 2 ).getByRole( 'img' ).getAttribute( 'aria-label' ), 'Thunderstorm' );

	assert.equal( requests.length, 1, 'only the fixed card fetches on load' );
	assert.equal( requests[ 0 ].searchParams.get( 'latitude' ), '44.05' );
	assert.equal( requests[ 0 ].searchParams.get( 'temperature_unit' ), 'fahrenheit' );
	assert.deepEqual( errors, [] );
	await close();
} );

test( 'serves repeat views from sessionStorage without a request', async () => {
	const { requests, setup } = stubApi();
	const { page, close } = await openDemo( 'local-weather', {}, setup );
	await fixedCard( page ).getByText( '72°' ).waitFor();
	await page.reload();
	await fixedCard( page ).getByText( '72°' ).waitFor();
	assert.equal( requests.length, 1 );
	await close();
} );

test( 'never asks for a location until the button is clicked', async () => {
	const { requests, setup } = stubApi();
	const { page, close } = await openDemo( 'local-weather', {}, async ( p ) => {
		await setup( p );
		await p.addInitScript( () => {
			window.geoCalls = 0;
			navigator.geolocation.getCurrentPosition = ( success ) => {
				window.geoCalls++;
				success( { coords: { latitude: 51.5074, longitude: -0.1278 } } );
			};
		} );
	} );
	const button = page.getByRole( 'button', { name: 'Use my location' } );
	await button.waitFor();
	assert.equal( await page.evaluate( () => window.geoCalls ), 0 );

	await button.click();
	await page.getByRole( 'region', { name: 'Weather', exact: true } ).getByText( '72°' ).waitFor();
	assert.equal( await page.evaluate( () => window.geoCalls ), 1 );
	const here = requests.at( -1 );
	assert.equal( here.searchParams.get( 'latitude' ), '51.51', 'rounded to two decimals' );
	assert.equal( here.searchParams.get( 'temperature_unit' ), 'celsius' );

	// Both forecasts are cached, so a reload shows them with no prompt and no request.
	const before = requests.length;
	await page.reload();
	await page.getByRole( 'region', { name: 'Weather', exact: true } ).getByText( '72°' ).waitFor();
	assert.equal( await page.evaluate( () => window.geoCalls ), 0 );
	assert.equal( requests.length, before );
	await close();
} );

test( 'fails quietly when the request fails', async () => {
	const { setup } = stubApi( { status: 500 } );
	const { page, errors, close } = await openDemo( 'local-weather', {}, setup );
	await fixedCard( page ).getByText( 'Weather is unavailable right now.' ).waitFor();
	assert.deepEqual( errors, [] );
	await close();
} );

test( 'draws icons inline and animates only without reduced motion', async () => {
	for ( const [ reducedMotion, expected ] of [ [ 'no-preference', true ], [ 'reduce', false ] ] ) {
		const { setup } = stubApi();
		const images = [];
		const { page, close } = await openDemo( 'local-weather', { reducedMotion }, async ( p ) => {
			await setup( p );
			p.on( 'request', ( request ) => request.resourceType() === 'image' && images.push( request.url() ) );
		} );
		await fixedCard( page ).getByText( '72°' ).waitFor();
		const animated = await page.evaluate( () =>
			[ ...document.querySelectorAll( 'div' ) ].some( ( host ) => host.shadowRoot?.getAnimations().length )
		);
		assert.equal( animated, expected, `animated with reducedMotion: ${ reducedMotion }` );
		assert.deepEqual( images, [] );
		await close();
	}
} );
