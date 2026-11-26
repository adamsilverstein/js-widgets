/**
 * Translate This Page: a language picker that translates an article in place
 * with Chrome's on-device Translator API, and puts the original back.
 *
 * Options (data- attributes on the script tag):
 *   data-target     CSS selector for the region to translate. Default "article".
 *   data-languages  Comma separated language codes to offer. Default "en,es,fr,de,ja,zh".
 */
import { mountInline, options, ready } from '../../shared/embed.js';
import { availability, create } from '../../shared/ai.js';

const config = options( { target: 'article', languages: 'en,es,fr,de,ja,zh' } );

// Text inside these keeps its original wording.
const SKIP = 'pre,code,kbd,samp,var,script,style,textarea';

/**
 * Returns a language's base subtag, eg. "en" for "en-US", or undefined when
 * the tag is not valid.
 *
 * @param {string} tag BCP 47 language tag.
 * @return {string|undefined} Base language.
 */
function baseLanguage( tag ) {
	try {
		return new Intl.Locale( tag ).language;
	} catch {}
}

/**
 * Finds the language the region is written in: the nearest `lang` attribute,
 * or the Language Detector API when it is ready to use without a download.
 *
 * @param {Element} region Region to translate.
 * @return {Promise<string|undefined>} Base language, if known.
 */
async function sourceLanguage( region ) {
	const declared = baseLanguage( region.closest( '[lang]' )?.lang );
	if ( declared ) {
		return declared;
	}
	// A download needs a click, and the picker cannot be built until the source language is known.
	if ( ( await availability( 'LanguageDetector' ) ) !== 'available' ) {
		return;
	}
	try {
		const [ best ] = await ( await self.LanguageDetector.create() ).detect( region.textContent );
		return best?.confidence > 0.5 ? baseLanguage( best.detectedLanguage ) : undefined;
	} catch {}
}

/**
 * Names a language in that language, eg. "español", falling back to its code.
 *
 * @param {string} code Language code.
 * @return {string} Display name.
 */
function endonym( code ) {
	try {
		return new Intl.DisplayNames( [ code ], { type: 'language' } ).of( code ) || code;
	} catch {
		return code;
	}
}

ready( async () => {
	const region = document.querySelector( config.target );
	const source = region && ( await sourceLanguage( region ) );
	if ( ! source ) {
		return;
	}

	const candidates = [ ...new Set( config.languages.split( ',' ).map( ( code ) => code.trim() ).filter( Boolean ) ) ]
		.filter( ( code ) => baseLanguage( code ) && baseLanguage( code ) !== source );
	const states = await Promise.all(
		candidates.map( ( targetLanguage ) => availability( 'Translator', { sourceLanguage: source, targetLanguage } ) )
	);
	const languages = candidates.filter( ( code, index ) => states[ index ] !== 'unavailable' );
	if ( ! languages.length ) {
		return;
	}

	// Collected once: content added after load is out of scope.
	const texts = new Map();
	const walker = document.createTreeWalker( region, NodeFilter.SHOW_TEXT, {
		acceptNode: ( node ) =>
			/\S/.test( node.data ) && node.parentElement.translate && ! node.parentElement.closest( SKIP )
				? NodeFilter.FILTER_ACCEPT
				: NodeFilter.FILTER_REJECT,
	} );
	while ( walker.nextNode() ) {
		texts.set( walker.currentNode, walker.currentNode.data );
	}

	// Inner `lang` attributes would otherwise keep screen readers on the source language.
	// Untranslated elements keep theirs, since their text stays in that language.
	const langs = new Map(
		[ region, ...region.querySelectorAll( '[lang]' ) ]
			.filter( ( element ) => element.translate && ! element.closest( SKIP ) )
			.map( ( element ) => [ element, element.getAttribute( 'lang' ) ] )
	);

	const root = mountInline( `
		:host { display: block; margin: 0 0 1em; }
		form { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font: inherit; }
		select, button { font: inherit; padding: 4px 10px; border-radius: 6px; }
		button { cursor: pointer; }
		[role=status]:empty, [hidden] { display: none; }
		[role=status] { flex-basis: 100%; font-size: .9em; opacity: .8; }
		progress { flex-basis: 100%; }
	` );
	// A snippet in <head> would render the picker where it cannot be seen.
	if ( root.host.closest( 'head' ) ) {
		region.before( root.host );
	}
	root.innerHTML += `<form>
		<label for="language">Translate to</label>
		<select id="language"></select>
		<button>Translate</button>
		<button type="button" hidden>Show original</button>
		<progress max="1" hidden></progress>
		<div role="status"></div>
	</form>`;
	const form = root.querySelector( 'form' );
	const [ , select, , original, progress, status ] = form.children;

	const visitor = baseLanguage( navigator.language );
	for ( const code of languages ) {
		const option = new Option( endonym( code ), code, false, baseLanguage( code ) === visitor );
		option.lang = code;
		select.append( option );
	}

	const translators = new Map();
	let run = 0;

	const restore = () => {
		run++;
		texts.forEach( ( text, node ) => ( node.data = text ) );
		langs.forEach( ( value, element ) =>
			value === null ? element.removeAttribute( 'lang' ) : element.setAttribute( 'lang', value )
		);
		progress.hidden = original.hidden = true;
		status.textContent = '';
	};

	form.addEventListener( 'submit', async ( event ) => {
		event.preventDefault();
		restore();
		const current = run;
		const language = select.value;
		const name = select.selectedOptions[ 0 ].text;

		try {
			// Cached per language, so switching back does not download or set up again.
			if ( ! translators.has( language ) ) {
				translators.set(
					language,
					create( 'Translator', { sourceLanguage: source, targetLanguage: language }, ( loaded ) => {
						if ( current === run ) {
							progress.hidden = false;
							progress.value = loaded;
							// Set once: the progress bar carries the percentage, so the live region is not repeated.
							status.textContent ||= `Downloading the ${ name } language pack…`;
						}
					} )
				);
			}
			const translator = await translators.get( language );
			if ( current !== run ) {
				return;
			}
			progress.hidden = true;
			status.textContent = `Translating to ${ name }…`;
			langs.forEach( ( value, element ) => ( element.lang = language ) );
			// Shown early so a long translation can be stopped.
			original.hidden = false;

			for ( const [ node, text ] of texts ) {
				// Whitespace around a node separates it from its inline neighbours, so it is kept as is.
				const [ , before, middle, after ] = text.match( /^(\s*)([\s\S]*?)(\s*)$/ );
				const translated = await translator.translate( middle );
				if ( current !== run ) {
					return;
				}
				node.data = before + translated + after;
			}
			status.textContent = `Translated to ${ name } on this device.`;
		} catch {
			translators.delete( language );
			if ( current === run ) {
				restore();
				status.textContent = `Could not translate to ${ name }.`;
			}
		}
	} );

	original.addEventListener( 'click', () => {
		restore();
		// The button hides itself, so focus moves somewhere useful.
		select.focus();
	} );
} );
