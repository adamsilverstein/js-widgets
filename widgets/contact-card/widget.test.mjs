import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDemo } from '../../test/harness.mjs';

const ENDPOINT = 'https://example.com/contact';
const CORS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'content-type',
};

/**
 * Opens the demo with a real network path to a mocked endpoint.
 *
 * @param {Object}   [options]
 * @param {Function} [options.edit]    Rewrites the demo HTML, eg. to change the script tag.
 * @param {number}   [options.status]  Status the mocked endpoint answers with.
 * @param {Object}   [options.context] Playwright context options.
 * @return {Promise<Object>} openDemo's result, plus the request bodies the endpoint received.
 */
async function open( { edit, status = 200, context } = {} ) {
	const received = [];
	const demo = await openDemo( 'contact-card', context, async ( page ) => {
		// Skip the demo's stand-in backend so requests reach the route below.
		await page.route( '**/demo-endpoint.js', ( route ) => route.fulfill( { body: '' } ) );
		await page.route( ENDPOINT, ( route ) => {
			if ( route.request().method() === 'POST' ) {
				received.push( route.request().postDataJSON() );
			}
			return route.fulfill( { status, headers: CORS, body: '{}' } );
		} );
		if ( edit ) {
			await page.route( '**/demos/contact-card/', async ( route ) => {
				const response = await route.fetch();
				route.fulfill( { response, body: edit( await response.text() ) } );
			} );
		}
	} );
	return { ...demo, received };
}

const shadow = ( page, fn ) =>
	page.evaluate( `(${ fn })(document.querySelector('[data-jsw-corner] > div').shadowRoot)` );

const fill = async ( page, email = 'ada@example.com' ) => {
	await page.getByLabel( 'Name' ).fill( 'Ada' );
	await page.getByRole( 'textbox', { name: 'Email' } ).fill( email );
	await page.getByLabel( 'Message' ).fill( 'Hello there' );
};

test( 'opens and closes from the keyboard, moving focus in and back', async () => {
	const { page, errors, close } = await open();
	const toggle = page.getByRole( 'button', { name: 'Contact us' } );

	await page.keyboard.press( 'Tab' );
	await page.keyboard.press( 'Enter' );
	// Playwright reads aria-expanded from attributes, but popovertarget sets it only in the accessibility tree.
	const cdp = await page.context().newCDPSession( page );
	const { nodes } = await cdp.send( 'Accessibility.getFullAXTree' );
	const button = nodes.find( ( node ) => node.role.value === 'button' && node.name?.value === 'Contact us' );
	assert.equal( button.properties.find( ( prop ) => prop.name === 'expanded' )?.value.value, true );
	assert.equal( await page.getByRole( 'dialog', { name: 'Contact us' } ).isVisible(), true );
	assert.equal( await shadow( page, ( root ) => root.activeElement.textContent ), 'Call+15415550100' );

	await page.keyboard.press( 'Escape' );
	assert.equal( await page.getByRole( 'dialog' ).isVisible(), false );
	assert.equal( await shadow( page, ( root ) => root.activeElement.className ), 'toggle' );

	await page.keyboard.press( 'Enter' );
	await page.getByRole( 'button', { name: 'Close' } ).click();
	assert.equal( await page.getByRole( 'dialog' ).isVisible(), false );
	assert.equal( await shadow( page, ( root ) => root.activeElement.className ), 'toggle' );

	assert.deepEqual( errors, [] );
	await close();
} );

test( 'shows only call and email links without an endpoint', async () => {
	const { page, close } = await open( { edit: ( html ) => html.replace( /\s*data-endpoint="[^"]*"/, '' ) } );
	await page.getByRole( 'button', { name: 'Contact us' } ).click();

	assert.equal( await page.getByRole( 'link', { name: /Call/ } ).getAttribute( 'href' ), 'tel:+15415550100' );
	assert.equal( await page.getByRole( 'link', { name: /Email/ } ).getAttribute( 'href' ), 'mailto:hello@example.com' );
	assert.equal( await shadow( page, ( root ) => !! root.querySelector( 'form' ) ), false );
	await close();
} );

test( 'posts the form as JSON and shows sending, then success', async () => {
	const { page, received, close } = await open();
	await page.getByRole( 'button', { name: 'Contact us' } ).click();
	await fill( page );
	await page.getByRole( 'button', { name: 'Send' } ).click();

	await page.getByText( 'Thanks, your message was sent.' ).waitFor();
	assert.deepEqual( received, [ { name: 'Ada', email: 'ada@example.com', message: 'Hello there' } ] );
	assert.equal( await page.getByLabel( 'Name' ).inputValue(), '', 'form is reset' );
	assert.equal( await page.getByRole( 'dialog' ).isVisible(), true, 'no page reload or close' );
	await close();
} );

test( 'shows a sending state while the request is in flight', async () => {
	const { page, close } = await open();
	// Hold the response until the sending state has been checked.
	let release;
	await page.route( ENDPOINT, async ( route ) => {
		await new Promise( ( resolve ) => ( release = resolve ) );
		route.fulfill( { headers: CORS, body: '{}' } );
	} );
	await page.getByRole( 'button', { name: 'Contact us' } ).click();
	await fill( page );
	const send = page.getByRole( 'button', { name: 'Send' } );
	await send.click();

	await page.getByText( 'Sending…' ).waitFor();
	assert.equal( await send.getAttribute( 'aria-disabled' ), 'true' );
	release();
	await page.getByText( 'Thanks, your message was sent.' ).waitFor();
	assert.equal( await send.getAttribute( 'aria-disabled' ), null );
	await close();
} );

test( 'shows an error and keeps the message when the endpoint fails', async () => {
	const { page, close } = await open( { status: 500 } );
	await page.getByRole( 'button', { name: 'Contact us' } ).click();
	await fill( page );
	await page.getByRole( 'button', { name: 'Send' } ).click();

	await page.getByText( /did not send/ ).waitFor();
	assert.equal( await page.getByLabel( 'Message' ).inputValue(), 'Hello there' );
	await close();
} );

test( 'drops submissions that fill the honeypot', async () => {
	const { page, received, close } = await open();
	await page.getByRole( 'button', { name: 'Contact us' } ).click();
	await fill( page );
	await shadow( page, ( root ) => ( root.querySelector( '[name=_gotcha]' ).value = 'spam' ) );
	await page.getByRole( 'button', { name: 'Send' } ).click();

	await page.getByText( 'Thanks, your message was sent.' ).waitFor();
	assert.deepEqual( received, [] );
	await close();
} );

test( 'does not send an invalid email address', async () => {
	const { page, received, close } = await open();
	await page.getByRole( 'button', { name: 'Contact us' } ).click();
	await fill( page, 'not-an-email' );
	await page.getByRole( 'button', { name: 'Send' } ).click();
	await page.waitForTimeout( 200 );

	assert.deepEqual( received, [] );
	assert.equal( await shadow( page, ( root ) => root.activeElement.name ), 'email' );
	await close();
} );

test( 'takes its corner and accent color from the script tag', async () => {
	const { page, close } = await open( {
		edit: ( html ) => html.replace( 'data-phone', 'data-position="bottom-left" data-color="rgb(200, 0, 0)" data-phone' ),
	} );
	const toggle = page.getByRole( 'button', { name: 'Contact us' } );
	const box = await toggle.boundingBox();
	assert.ok( box.x < 100, 'button is on the left' );
	assert.equal( await toggle.evaluate( ( el ) => getComputedStyle( el ).backgroundColor ), 'rgb(200, 0, 0)' );

	await toggle.click();
	const card = await page.getByRole( 'dialog' ).boundingBox();
	assert.ok( card.x < 100, 'card opens on the left too' );
	await close();
} );

test( 'fits a small phone screen without covering the button', async () => {
	const { page, close } = await open( { context: { viewport: { width: 320, height: 480 }, hasTouch: true } } );
	const toggle = page.getByRole( 'button', { name: 'Contact us' } );
	await toggle.tap();

	const card = await page.getByRole( 'dialog' ).boundingBox();
	const button = await toggle.boundingBox();
	assert.ok( card.x >= 16 && card.x + card.width <= 304, 'card keeps a side margin' );
	assert.ok( card.y >= 16, 'card stays on screen' );
	assert.ok( card.y + card.height <= button.y, 'card sits above the button' );
	await close();
} );

test( 'keeps a bad accent color from breaking out of the styles', async () => {
	const { page, errors, close } = await open( {
		edit: ( html ) =>
			html.replace( 'data-phone', 'data-color="red}&lt;/style&gt;&lt;img src=x onerror=window.injected=1&gt;" data-phone' ),
	} );
	const toggle = page.getByRole( 'button', { name: 'Contact us' } );
	await toggle.click();

	assert.equal( await page.evaluate( () => window.injected ), undefined );
	assert.equal( await shadow( page, ( root ) => root.querySelectorAll( 'img' ).length ), 0 );
	assert.equal( await page.getByRole( 'dialog' ).isVisible(), true );
	assert.deepEqual( errors, [] );
	await close();
} );
