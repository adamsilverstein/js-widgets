import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDemo } from '../../test/harness.mjs';

const theme = ( page ) => page.evaluate( () => document.documentElement.dataset.theme );
// The view transition applies the theme asynchronously.
const waitForTheme = ( page, expected ) =>
	page.waitForFunction( ( value ) => document.documentElement.dataset.theme === value, expected );
const stored = ( page ) => page.evaluate( () => localStorage.getItem( 'jsw-theme' ) );

test( 'first visit follows prefers-color-scheme', async () => {
	for ( const colorScheme of [ 'light', 'dark' ] ) {
		const { page, errors, close } = await openDemo( 'dark-mode-toggle', { colorScheme } );
		assert.equal( await theme( page ), colorScheme );
		assert.equal( await page.evaluate( () => document.documentElement.style.colorScheme ), colorScheme );
		assert.equal( await page.getByRole( 'button', { name: 'Dark mode' } ).getAttribute( 'aria-pressed' ), String( colorScheme === 'dark' ) );
		assert.deepEqual( errors, [] );
		await close();
	}
} );

test( 'toggles, persists across reloads, and toggling back follows the system again', async () => {
	const { page, errors, close } = await openDemo( 'dark-mode-toggle', { colorScheme: 'light' } );
	const button = page.getByRole( 'button', { name: 'Dark mode' } );
	assert.equal( await button.getAttribute( 'aria-pressed' ), 'false' );

	await button.click();
	await waitForTheme( page, 'dark' );
	assert.equal( await button.getAttribute( 'aria-pressed' ), 'true' );
	assert.equal( await stored( page ), 'dark' );

	await page.reload();
	assert.equal( await theme( page ), 'dark' );

	await button.click();
	await waitForTheme( page, 'light' );
	assert.equal( await stored( page ), null );
	assert.deepEqual( errors, [] );
	await close();
} );

test( 'a choice made in one tab reaches the others', async () => {
	const { page, close } = await openDemo( 'dark-mode-toggle', { colorScheme: 'light' } );
	const other = await page.context().newPage();
	await other.goto( page.url() );

	await page.getByRole( 'button', { name: 'Dark mode' } ).click();
	await waitForTheme( other, 'dark' );
	assert.equal( await other.getByRole( 'button', { name: 'Dark mode' } ).getAttribute( 'aria-pressed' ), 'true' );
	await close();
} );

test( 'the stored theme is set before the body is parsed, so there is no flash', async () => {
	const { page, close } = await openDemo( 'dark-mode-toggle', { colorScheme: 'light' }, ( page ) =>
		page.addInitScript( () => {
			localStorage.setItem( 'jsw-theme', 'dark' );
			// Records the theme at the moment <body> enters the document.
			new MutationObserver( ( records, observer ) => {
				if ( document.body ) {
					window.themeAtBody = document.documentElement.dataset.theme ?? 'unset';
					observer.disconnect();
				}
			} ).observe( document, { childList: true, subtree: true } );
		} )
	);
	assert.equal( await page.evaluate( () => window.themeAtBody ), 'dark' );
	await close();
} );

/** Counts calls to document.startViewTransition. */
const countTransitions = ( page ) =>
	page.addInitScript( () => {
		window.transitions = 0;
		const start = document.startViewTransition?.bind( document );
		if ( start ) {
			document.startViewTransition = ( update ) => {
				window.transitions++;
				return start( update );
			};
		}
	} );

test( 'reveals with a view transition, and switches instantly with reduced motion', async () => {
	for ( const [ reducedMotion, expected ] of [ [ 'no-preference', 1 ], [ 'reduce', 0 ] ] ) {
		const { page, errors, close } = await openDemo( 'dark-mode-toggle', { colorScheme: 'light', reducedMotion }, countTransitions );
		await page.getByRole( 'button', { name: 'Dark mode' } ).click();
		assert.equal( await page.evaluate( () => window.transitions ), expected );
		await waitForTheme( page, 'dark' );
		// The reveal's temporary style is cleaned up once the transition ends.
		await page.waitForFunction( () => ! [ ...document.querySelectorAll( 'style' ) ].some( ( style ) => style.textContent.includes( 'view-transition-new' ) ) );
		assert.deepEqual( errors, [] );
		await close();
	}
} );

test( 'works from the keyboard', async () => {
	const { page, close } = await openDemo( 'dark-mode-toggle', { colorScheme: 'dark', reducedMotion: 'reduce' } );
	await page.getByRole( 'button', { name: 'Dark mode' } ).focus();
	await page.keyboard.press( 'Enter' );
	assert.equal( await theme( page ), 'light' );
	await page.keyboard.press( 'Space' );
	assert.equal( await theme( page ), 'dark' );
	await close();
} );
