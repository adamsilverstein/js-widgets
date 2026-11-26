import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDemo } from '../../test/harness.mjs';

/** Highlighted match count, and the text of the active match. */
const state = ( page ) =>
	page.evaluate( () => ( {
		matches: CSS.highlights.get( 'jsw-find' )?.size ?? 0,
		active: [ ...( CSS.highlights.get( 'jsw-find-active' ) ?? [] ) ].map( ( range ) => range.toString() ),
	} ) );

test( 'highlights case insensitive matches as the visitor types, without changing the DOM', async () => {
	const { page, errors, close } = await openDemo( 'find-on-page' );
	const article = page.locator( 'article' );
	const before = await article.evaluate( ( el ) => el.innerHTML );

	await page.getByRole( 'searchbox', { name: 'Find on page' } ).fill( 'WIDGET' );
	const { matches, active } = await state( page );
	assert.ok( matches > 5, `expected several matches, got ${ matches }` );
	assert.deepEqual( active, [ 'widget' ] );
	assert.equal( await page.getByRole( 'status' ).textContent(), `1 of ${ matches }` );
	assert.equal( await article.evaluate( ( el ) => el.innerHTML ), before );

	await page.getByRole( 'searchbox' ).fill( 'no such phrase' );
	assert.equal( await page.getByRole( 'status' ).textContent(), 'No matches' );
	assert.deepEqual( errors, [] );
	await close();
} );

test( 'Enter and Shift+Enter step through matches, and Escape clears', async () => {
	const { page, close } = await openDemo( 'find-on-page' );
	const input = page.getByRole( 'searchbox' );
	const status = page.getByRole( 'status' );
	await input.fill( 'widget' );
	const { matches } = await state( page );

	await input.press( 'Enter' );
	assert.equal( await status.textContent(), `2 of ${ matches }` );
	await input.press( 'Shift+Enter' );
	await input.press( 'Shift+Enter' );
	assert.equal( await status.textContent(), `${ matches } of ${ matches }`, 'wraps back to the last match' );
	await page.getByRole( 'button', { name: 'Next match' } ).click();
	assert.equal( await status.textContent(), `1 of ${ matches }`, 'wraps forward to the first match' );

	await input.press( 'Escape' );
	assert.equal( await input.inputValue(), '' );
	assert.equal( await status.textContent(), '' );
	assert.deepEqual( await state( page ), { matches: 0, active: [] } );
	await close();
} );

test( 'scrolls the active match into view', async () => {
	const { page, close } = await openDemo( 'find-on-page', { viewport: { width: 400, height: 360 }, reducedMotion: 'reduce' } );
	await page.getByRole( 'searchbox' ).fill( 'small enough to understand' );
	const inView = await page.evaluate( () => {
		const { top, bottom } = [ ...CSS.highlights.get( 'jsw-find-active' ) ][ 0 ].getBoundingClientRect();
		return top >= 0 && bottom <= innerHeight;
	} );
	assert.ok( inView );
	assert.ok( ( await page.evaluate( () => scrollY ) ) > 0 );
	await close();
} );

test( 'matches across inline elements, and opens a closed details element to show one', async () => {
	const { page, close } = await openDemo( 'find-on-page' );
	const details = page.locator( 'details' );
	assert.equal( await details.evaluate( ( el ) => el.open ), false );

	await page.getByRole( 'searchbox' ).fill( 'cross bold text or a link?' );
	assert.deepEqual( ( await state( page ) ).active, [ 'cross bold text or a link?' ] );
	assert.equal( await details.evaluate( ( el ) => el.open ), true );
	await close();
} );

test( 'the hotkey focuses the box, but not while typing elsewhere', async () => {
	const { page, close } = await openDemo( 'find-on-page' );
	const input = page.getByRole( 'searchbox' );
	await page.keyboard.press( '/' );
	assert.ok( await input.evaluate( ( el ) => el.matches( ':focus' ) ) );

	// In its own box, "/" is just a character.
	await page.keyboard.type( 'a/b' );
	assert.equal( await input.inputValue(), 'a/b' );

	await page.evaluate( () => document.body.prepend( document.createElement( 'textarea' ) ) );
	await page.locator( 'textarea' ).focus();
	await page.keyboard.press( '/' );
	assert.equal( await page.locator( 'textarea' ).inputValue(), '/' );
	await close();
} );

test( 'stays responsive on a 10,000 word page', async () => {
	const { page, close } = await openDemo( 'find-on-page' );
	const result = await page.evaluate( () => {
		const words = 'the quick brown fox jumps over a lazy dog and keeps on running'.split( ' ' );
		const main = document.querySelector( 'main' );
		for ( let p = 0; p < 200; p++ ) {
			const paragraph = document.createElement( 'p' );
			// Some bold words, so the text is split across many nodes.
			paragraph.innerHTML = Array.from( { length: 50 }, ( _, i ) =>
				i % 5 ? words[ ( p + i ) % words.length ] : `<b>${ words[ i % words.length ] }</b>`
			).join( ' ' );
			main.append( paragraph );
		}
		const input = document.querySelector( '[data-jsw-corner] > div' ).shadowRoot.querySelector( 'input' );
		input.value = 'e';
		const start = performance.now();
		input.dispatchEvent( new Event( 'input' ) );
		return { ms: performance.now() - start, matches: CSS.highlights.get( 'jsw-find' ).size };
	} );
	assert.ok( result.matches > 3000 );
	assert.ok( result.ms < 150, `search took ${ result.ms }ms` );
	await close();
} );
