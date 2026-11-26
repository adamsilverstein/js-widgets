import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDemo } from '../../test/harness.mjs';

/**
 * Installs a fake `Translator` that prefixes text with the target language,
 * eg. "[fr] Hello". Headless Chromium has no built-in AI.
 *
 * @param {Object} availability Availability per target language. Unlisted ones are "unavailable".
 */
const mockTranslator = ( availability ) => ( page ) =>
	page.addInitScript( ( states ) => {
		window.translatorCalls = [];
		window.Translator = {
			availability: async ( { targetLanguage } ) => states[ targetLanguage ] ?? 'unavailable',
			async create( { sourceLanguage, targetLanguage, monitor } ) {
				window.translatorCalls.push( { sourceLanguage, targetLanguage, activated: navigator.userActivation.isActive } );
				if ( states[ targetLanguage ] === 'downloadable' ) {
					const target = new EventTarget();
					monitor?.( target );
					for ( const loaded of [ 0, 0.5, 1 ] ) {
						target.dispatchEvent( Object.assign( new Event( 'downloadprogress' ), { loaded } ) );
						await new Promise( ( resolve ) => setTimeout( resolve, 50 ) );
					}
				}
				return { translate: async ( text ) => `[${ targetLanguage }] ${ text }` };
			},
		};
	}, availability );

const articleSnapshot = ( page ) =>
	page.evaluate( () => ( {
		html: document.querySelector( 'article' ).innerHTML,
		tags: [ ...document.querySelectorAll( 'article *' ) ].map( ( element ) => element.tagName ).join(),
	} ) );

test( 'renders nothing where the Translator API is missing', async () => {
	const { page, errors, close } = await openDemo( 'translate-page' );
	await page.waitForTimeout( 300 );
	assert.equal( await page.getByRole( 'combobox' ).count(), 0 );
	assert.deepEqual( errors, [] );
	await close();
} );

test( 'renders nothing when no configured language is available', async () => {
	const { page, close } = await openDemo( 'translate-page', {}, mockTranslator( {} ) );
	await page.waitForTimeout( 300 );
	assert.equal( await page.getByRole( 'combobox' ).count(), 0 );
	await close();
} );

test( 'offers only available languages, and preselects the visitor language', async () => {
	const { page, close } = await openDemo( 'translate-page', { locale: 'fr-FR' }, mockTranslator( { es: 'available', fr: 'downloadable' } ) );
	const select = page.getByLabel( 'Translate to' );
	await select.waitFor();
	assert.deepEqual( await select.locator( 'option' ).evaluateAll( ( options ) => options.map( ( option ) => option.value ) ), [ 'es', 'fr' ] );
	assert.equal( await select.inputValue(), 'fr' );
	assert.equal( await select.locator( 'option[value=es]' ).textContent(), 'español' );
	await close();
} );

test( 'translates text nodes only, sets lang, and restores the exact original', async () => {
	const { page, close } = await openDemo( 'translate-page', { locale: 'en-US' }, mockTranslator( { es: 'available' } ) );
	await page.getByLabel( 'Translate to' ).waitFor();
	const before = await articleSnapshot( page );

	await page.getByRole( 'button', { name: 'Translate', exact: true } ).click();
	await page.getByText( 'Translated to español on this device.' ).waitFor();

	const article = page.locator( 'article' );
	assert.equal( await article.getAttribute( 'lang' ), 'es' );
	assert.equal( ( await page.locator( 'h1' ).textContent() ).trim(), '[es] A short history of the sidebar widget' );
	const after = await articleSnapshot( page );
	assert.equal( after.tags, before.tags, 'markup is unchanged' );

	const calls = await page.evaluate( () => window.translatorCalls );
	assert.deepEqual( calls, [ { sourceLanguage: 'en', targetLanguage: 'es', activated: true } ] );

	await page.getByRole( 'button', { name: 'Show original' } ).click();
	const restored = await articleSnapshot( page );
	assert.equal( restored.html, before.html );
	assert.equal( await article.getAttribute( 'lang' ), 'en' );
	assert.equal( await page.getByRole( 'button', { name: 'Show original' } ).count(), 0 );
	await close();
} );

test( 'leaves code and translate="no" alone, lang included', async () => {
	const { page, close } = await openDemo( 'translate-page', {}, async ( page ) => {
		await mockTranslator( { de: 'available' } )( page );
		// Runs before the widget's ready() callback, so the extra markup is collected.
		await page.addInitScript( () =>
			document.addEventListener( 'DOMContentLoaded', () =>
				document.querySelector( 'article' ).insertAdjacentHTML(
					'beforeend',
					'<p id="mixed">Run <code lang="en">npm test</code> on <span translate="no">JS Widgets</span> <a href="#x">today</a>.</p><pre>const a = 1;</pre>'
				)
			)
		);
	} );
	await page.getByLabel( 'Translate to' ).waitFor();
	await page.getByRole( 'button', { name: 'Translate', exact: true } ).click();
	await page.getByText( /Translated to/ ).waitFor();

	assert.equal( await page.locator( '#mixed' ).innerHTML(), '[de] Run <code lang="en">npm test</code> [de] on <span translate="no">JS Widgets</span> <a href="#x">[de] today</a>[de] .' );
	assert.equal( await page.locator( 'pre' ).textContent(), 'const a = 1;' );
	await close();
} );

test( 'shows download progress when a language pack is needed', async () => {
	const { page, close } = await openDemo( 'translate-page', { locale: 'ja-JP' }, mockTranslator( { ja: 'downloadable' } ) );
	await page.getByLabel( 'Translate to' ).waitFor();
	await page.getByRole( 'button', { name: 'Translate', exact: true } ).click();
	await page.getByText( /Downloading the 日本語 language pack/ ).waitFor();
	assert.equal( await page.getByRole( 'progressbar' ).isVisible(), true );
	await page.getByText( /Translated to/ ).waitFor();
	assert.equal( await page.getByRole( 'progressbar' ).isVisible(), false );
	await close();
} );

test( 'works from the keyboard', async () => {
	const { page, close } = await openDemo( 'translate-page', {}, mockTranslator( { es: 'available', de: 'available' } ) );
	const select = page.getByLabel( 'Translate to' );
	await select.waitFor();
	await select.focus();
	await select.selectOption( 'de' );
	await page.keyboard.press( 'Tab' );
	await page.keyboard.press( 'Enter' );
	await page.getByText( 'Translated to Deutsch on this device.' ).waitFor();
	await page.keyboard.press( 'Tab' );
	await page.keyboard.press( 'Enter' );
	assert.equal( await page.locator( 'article' ).getAttribute( 'lang' ), 'en' );
	assert.equal( await select.evaluate( ( element ) => element.matches( ':focus' ) ), true );
	await close();
} );

test( 'falls back to the Language Detector when the page has no lang', async () => {
	const { page, close } = await openDemo( 'translate-page', {}, async ( page ) => {
		await mockTranslator( { es: 'available' } )( page );
		await page.addInitScript( () => {
			window.LanguageDetector = {
				availability: async () => 'available',
				create: async () => ( { detect: async () => [ { detectedLanguage: 'en', confidence: 0.98 } ] } ),
			};
			document.addEventListener( 'DOMContentLoaded', () =>
				document.querySelectorAll( '[lang]' ).forEach( ( element ) => element.removeAttribute( 'lang' ) )
			);
		} );
	} );
	await page.getByLabel( 'Translate to' ).waitFor();
	await page.getByRole( 'button', { name: 'Translate', exact: true } ).click();
	await page.getByText( /Translated to/ ).waitFor();
	assert.equal( ( await page.evaluate( () => window.translatorCalls ) )[ 0 ].sourceLanguage, 'en' );

	await page.getByRole( 'button', { name: 'Show original' } ).click();
	assert.equal( await page.locator( 'article' ).getAttribute( 'lang' ), null );
	await close();
} );
