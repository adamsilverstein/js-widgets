import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDemo } from '../../test/harness.mjs';

/**
 * Counts audio contexts and sounding oscillators, and fakes Web MIDI with one
 * input the test can play through `window.__midi.send()`.
 */
const instrument = ( page ) =>
	page.addInitScript( () => {
		const stats = ( window.__audio = { contexts: 0, playing: 0, midiRequests: 0 } );
		const Base = window.AudioContext;
		window.AudioContext = class extends Base {
			constructor( ...args ) {
				super( ...args );
				stats.contexts++;
			}
		};
		const { start, stop } = OscillatorNode.prototype;
		OscillatorNode.prototype.start = function ( ...args ) {
			stats.playing++;
			return start.apply( this, args );
		};
		OscillatorNode.prototype.stop = function ( ...args ) {
			stats.playing--;
			return stop.apply( this, args );
		};
		const input = { onmidimessage: null };
		window.__midi = { send: ( data ) => input.onmidimessage?.( { data } ) };
		navigator.requestMIDIAccess = async () => {
			stats.midiRequests++;
			return { inputs: new Map( [ [ 'fake', input ] ] ), onstatechange: null };
		};
	} );

/**
 * Replaces the demo page with `body`, for options and layouts the demo does not use.
 *
 * @param {string} body Body markup. `synth.min.js` resolves as in the demo.
 */
const withBody = ( body ) => async ( page ) => {
	await instrument( page );
	await page.route( '**/demos/mini-synth/', ( route ) =>
		route.fulfill( { contentType: 'text/html', body: `<!doctype html><body>${ body.replaceAll( 'synth.min.js', '../../synth.min.js' ) }` } )
	);
};

const stats = ( page ) => page.evaluate( () => window.__audio );
const lit = ( page ) => page.evaluate( () => [ ...document.querySelector( 'script[src*="synth"]' ).nextElementSibling.shadowRoot.querySelectorAll( '.on' ) ].map( ( key ) => key.textContent ) );

test( 'renders two octaves of note buttons and no audio before interaction', async () => {
	const { page, errors, close } = await openDemo( 'mini-synth', {}, instrument );
	const keys = page.getByRole( 'group', { name: 'Piano keyboard' } ).getByRole( 'button' );
	assert.equal( await keys.count(), 25 );
	assert.equal( await keys.first().textContent(), 'C4' );
	assert.equal( await keys.nth( 1 ).textContent(), 'C♯4' );
	assert.equal( await keys.last().textContent(), 'C6' );

	// Typing outside the synth must not play.
	await page.keyboard.press( 'KeyZ' );
	const before = await stats( page );
	assert.equal( before.contexts, 0 );
	assert.equal( before.midiRequests, 0 );
	assert.deepEqual( errors, [] );
	await close();
} );

test( 'plays a chord from the computer keyboard while a key has focus', async () => {
	const { page, close } = await openDemo( 'mini-synth', {}, instrument );
	await page.getByRole( 'button', { name: 'C4', exact: true } ).focus();
	await page.keyboard.down( 'KeyZ' );
	await page.keyboard.down( 'KeyC' );
	await page.keyboard.down( 'KeyV' );
	await page.keyboard.down( 'KeyQ' );
	assert.deepEqual( await lit( page ), [ 'C4', 'E4', 'F4', 'C5' ] );
	assert.equal( ( await stats( page ) ).playing, 4 );
	await page.keyboard.up( 'KeyC' );
	assert.deepEqual( await lit( page ), [ 'C4', 'F4', 'C5' ] );

	// Leaving the keyboard releases held keys, so nothing sticks.
	await page.getByRole( 'combobox' ).focus();
	assert.deepEqual( await lit( page ), [] );
	assert.equal( ( await stats( page ) ).playing, 0 );
	await close();
} );

test( 'plays with the mouse and slides between keys', async () => {
	const { page, close } = await openDemo( 'mini-synth', {}, instrument );
	const box = async ( name ) => page.getByRole( 'button', { name, exact: true } ).boundingBox();
	const c = await box( 'C4' );
	const e = await box( 'E4' );
	await page.mouse.move( c.x + c.width / 2, c.y + c.height - 10 );
	await page.mouse.down();
	assert.deepEqual( await lit( page ), [ 'C4' ] );
	assert.equal( ( await stats( page ) ).contexts, 1 );
	await page.mouse.move( e.x + e.width / 2, e.y + e.height - 10, { steps: 4 } );
	assert.deepEqual( await lit( page ), [ 'E4' ] );
	await page.mouse.up();
	assert.deepEqual( await lit( page ), [] );
	await close();
} );

test( 'plays several notes with multi touch', async () => {
	const { page, close } = await openDemo( 'mini-synth', { hasTouch: true }, instrument );
	const centre = async ( name ) => {
		const b = await page.getByRole( 'button', { name, exact: true } ).boundingBox();
		return { x: b.x + b.width / 2, y: b.y + b.height - 10 };
	};
	const points = [ { ...( await centre( 'C4' ) ), id: 1 }, { ...( await centre( 'G4' ) ), id: 2 } ];
	const cdp = await page.context().newCDPSession( page );
	await cdp.send( 'Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points } );
	assert.deepEqual( await lit( page ), [ 'C4', 'G4' ] );
	assert.equal( ( await stats( page ) ).playing, 2 );
	await cdp.send( 'Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] } );
	assert.deepEqual( await lit( page ), [] );
	await close();
} );

test( 'stops all sound when the tab is hidden', async () => {
	const { page, close } = await openDemo( 'mini-synth', {}, instrument );
	await page.getByRole( 'button', { name: 'D4', exact: true } ).focus();
	await page.keyboard.down( 'KeyZ' );
	await page.keyboard.down( 'KeyX' );
	assert.equal( ( await stats( page ) ).playing, 2 );
	await page.evaluate( () => {
		Object.defineProperty( document, 'hidden', { value: true, configurable: true } );
		document.dispatchEvent( new Event( 'visibilitychange' ) );
	} );
	assert.equal( ( await stats( page ) ).playing, 0 );
	assert.deepEqual( await lit( page ), [] );
	await close();
} );

test( 'requests MIDI only when turned on, then plays from it', async () => {
	const { page, close } = await openDemo( 'mini-synth', {}, instrument );
	const toggle = page.getByRole( 'button', { name: 'MIDI off' } );
	assert.equal( ( await stats( page ) ).midiRequests, 0 );
	await toggle.click();
	await page.getByRole( 'button', { name: 'MIDI on' } ).waitFor();
	assert.equal( ( await stats( page ) ).midiRequests, 1 );

	await page.evaluate( () => window.__midi.send( [ 0x90, 64, 100 ] ) );
	assert.deepEqual( await lit( page ), [ 'E4' ] );
	// Note on with velocity 0 is a note off.
	await page.evaluate( () => window.__midi.send( [ 0x90, 64, 0 ] ) );
	assert.deepEqual( await lit( page ), [] );

	await page.getByRole( 'button', { name: 'MIDI on' } ).click();
	await page.evaluate( () => window.__midi.send( [ 0x90, 60, 100 ] ) );
	assert.deepEqual( await lit( page ), [] );
	await close();
} );

test( 'falls back to defaults for bad options', async () => {
	const { page, errors, close } = await openDemo(
		'mini-synth',
		{},
		withBody( '<script src="synth.min.js" data-octaves="many" data-wave="organ" data-volume="loud"></script>' )
	);
	assert.equal( await page.getByRole( 'group', { name: 'Piano keyboard' } ).getByRole( 'button' ).count(), 25 );
	assert.equal( await page.getByRole( 'combobox' ).inputValue(), 'sine' );
	assert.equal( await page.getByRole( 'slider' ).inputValue(), '50' );
	assert.deepEqual( errors, [] );
	await close();
} );
