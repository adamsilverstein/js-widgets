/**
 * Alt Text Helper: lists images that have no `alt` attribute and drafts a one
 * sentence description for each with Chrome's on-device Prompt API. It is a
 * tool for site owners and does nothing unless the page URL has the audit
 * parameter, eg. `?alt-audit`.
 *
 * Options (data- attributes on the script tag):
 *   data-param     URL parameter that turns the audit on. Default "alt-audit".
 *   data-position  Corner for the audit panel. Default "bottom-right".
 *
 * @see https://developer.chrome.com/docs/ai/prompt-api
 */
import { mountCorner, createHost, options, ready, reducedMotion } from '../../shared/embed.js';
import { availability, create } from '../../shared/ai.js';

const { param, position } = options( { param: 'alt-audit', position: 'bottom-right' } );

/** Prompt API options. `availability()` must get the same ones as `create()`. */
const MODEL_OPTIONS = {
	expectedInputs: [ { type: 'image' }, { type: 'text', languages: [ 'en' ] } ],
	expectedOutputs: [ { type: 'text', languages: [ 'en' ] } ],
};

const INSTRUCTIONS =
	'You write alt text for images on web pages. Reply with one plain sentence of at most 20 words that describes what the image shows. Do not start with "Image of" or "Picture of".';

const CSS = `
:host { color-scheme: light dark; font: 14px/1.4 system-ui, sans-serif; }
* { box-sizing: border-box; }
details { width: min(300px, calc(100vw - 32px)); background: light-dark(#fff, #1e1e1e); color: light-dark(#1a1a1a, #eee); border: 1px solid light-dark(#ccc, #555); border-radius: 10px; box-shadow: 0 4px 16px #0003; }
summary { padding: 8px 12px; font-weight: 600; cursor: pointer; }
.body { max-height: min(50vh, 420px); overflow: auto; padding: 0 12px 12px; }
p { margin: 0 0 8px; }
.note { color: light-dark(#6b4c00, #f3c96b); }
ol { margin: 0; padding: 0; list-style: none; display: grid; gap: 12px; }
li { display: grid; grid-template-columns: 48px 1fr; gap: 4px 8px; padding-top: 12px; border-top: 1px solid light-dark(#ddd, #444); }
li:focus-within { outline: 2px solid #d4380d; outline-offset: 4px; border-radius: 4px; }
li > img { width: 48px; height: 48px; object-fit: cover; border-radius: 4px; grid-row: span 2; }
.name { overflow-wrap: anywhere; font-weight: 600; }
textarea { grid-column: 1 / -1; width: 100%; min-height: 3.5em; font: inherit; resize: vertical; }
.row { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
button { font: inherit; min-height: 28px; padding: 2px 10px; border-radius: 6px; border: 1px solid currentColor; background: none; color: inherit; cursor: pointer; }
button:disabled { opacity: .6; cursor: progress; }
[role=status] { font-size: 13px; color: light-dark(#555, #bbb); }
`;

const BADGE_CSS = `
button { position: absolute; min-width: 28px; height: 28px; padding: 0 6px; border: 2px solid #fff; border-radius: 14px; background: #d4380d; color: #fff; font: 700 14px/1 system-ui, sans-serif; cursor: pointer; box-shadow: 0 1px 4px #0006; }
button:focus-visible { outline: 3px solid #1a1a1a; outline-offset: 2px; }
`;

if ( new URLSearchParams( location.search ).has( param ) ) {
	ready( audit );
}

/** Lists the images without alt text in a corner panel and badges each one. */
async function audit() {
	// `img:not([alt])` skips `alt=""`, which marks an image as decorative.
	const images = [ ...document.querySelectorAll( 'img:not([alt])' ) ];
	const status = await availability( 'LanguageModel', MODEL_OPTIONS );
	const root = mountCorner( CSS, position );
	followPageTheme( root.host );

	const panel = document.createElement( 'details' );
	panel.open = true;
	panel.innerHTML = `<summary>Alt text audit: ${ images.length } image${ images.length === 1 ? '' : 's' } missing alt</summary><div class="body"></div>`;
	const body = panel.querySelector( '.body' );
	root.append( panel );

	if ( ! images.length ) {
		body.innerHTML = '<p>Every image has an alt attribute.</p>';
		return;
	}
	body.innerHTML = status === 'unavailable'
		? '<p class="note">Suggestions need the Prompt API with image input, in Chrome 148 or later on desktop. You can still write and copy alt text here.</p>'
		: '<p>Ask for a suggestion, edit it, then copy it into your CMS.</p>';

	const list = document.createElement( 'ol' );
	const items = images.map( ( image, index ) => {
		const item = renderItem( image, index + 1, status !== 'unavailable' );
		list.append( item );
		return item;
	} );
	body.append( list );
	addBadges( images, ( index ) => {
		panel.open = true;
		items[ index ].scrollIntoView( { block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' } );
		( items[ index ].querySelector( '[data-suggest]' ) || items[ index ].querySelector( 'textarea' ) ).focus( { preventScroll: true } );
	} );
}

/**
 * Renders one panel entry: thumbnail, name, editable suggestion and buttons.
 *
 * @param {HTMLImageElement} image      Image missing alt text.
 * @param {number}           number     Position in the list, matching its badge.
 * @param {boolean}          canSuggest Whether the Prompt API may be usable.
 * @return {HTMLLIElement} The entry.
 */
function renderItem( image, number, canSuggest ) {
	const item = document.createElement( 'li' );
	const name = `${ number }. ${ imageName( image ) }`;
	item.innerHTML = `<img alt=""><span class="name"></span><span class="where"><button type="button" data-show>Show on page</button></span>
		<textarea placeholder="Describe the image in one sentence"></textarea>
		<div class="row">${ canSuggest ? '<button type="button" data-suggest>Suggest</button>' : '' }<button type="button" data-copy>Copy</button><span role="status"></span></div>`;
	item.querySelector( 'img' ).src = image.currentSrc || image.src;
	item.querySelector( '.name' ).textContent = name;

	const field = item.querySelector( 'textarea' );
	const report = item.querySelector( '[role=status]' );
	field.setAttribute( 'aria-label', `Alt text for image ${ name }` );

	item.querySelector( '[data-show]' ).addEventListener( 'click', () => {
		image.scrollIntoView( { block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' } );
	} );

	item.querySelector( '[data-copy]' ).addEventListener( 'click', async () => {
		try {
			await navigator.clipboard.writeText( field.value.trim() );
			report.textContent = 'Copied';
		} catch {
			report.textContent = 'Copy failed. Select the text and copy it.';
		}
	} );

	const suggest = item.querySelector( '[data-suggest]' );
	suggest?.addEventListener( 'click', async () => {
		suggest.disabled = true;
		report.textContent = 'Writing a suggestion…';
		try {
			field.value = await describe( image, ( loaded ) => {
				report.textContent = `Downloading the model: ${ Math.round( loaded * 100 ) }%`;
			} );
			report.textContent = 'Suggestion ready. Check it, edit it if needed, then copy.';
			field.focus();
		} catch {
			// Cross-origin images that the page cannot read land here too.
			report.textContent = 'Could not describe this image.';
		}
		suggest.disabled = false;
		suggest.textContent = 'Suggest again';
	} );
	return item;
}

/**
 * A short, readable name for an image, usually its file name.
 *
 * @param {HTMLImageElement} image Image to name.
 * @return {string} The name.
 */
function imageName( image ) {
	const src = image.currentSrc || image.src;
	if ( ! src ) {
		return 'Image with no src';
	}
	if ( src.startsWith( 'data:' ) ) {
		return 'Inline image';
	}
	const file = new URL( src ).pathname.split( '/' ).pop();
	try {
		return decodeURIComponent( file ) || src;
	} catch {
		// A stray `%`, as in `100%.png`, is not valid percent-encoding.
		return file;
	}
}

let baseSession;

/**
 * Asks the model for a one sentence description of an image. The first call
 * creates the session, which may download the model.
 *
 * @param {HTMLImageElement} image      Image to describe.
 * @param {Function}         onProgress Called with the downloaded fraction, 0 to 1.
 * @return {Promise<string>} The description.
 */
async function describe( image, onProgress ) {
	baseSession ??= create(
		'LanguageModel',
		{ ...MODEL_OPTIONS, initialPrompts: [ { role: 'system', content: INSTRUCTIONS } ] },
		onProgress
	).catch( ( error ) => {
		// Let the next click try again after a failed download.
		baseSession = undefined;
		throw error;
	} );
	// A clone per image keeps earlier images out of the context.
	const session = await ( await baseSession ).clone();
	try {
		// A copy, because `decode()` on an offscreen `loading="lazy"` image
		// waits until it is scrolled into view.
		const copy = new Image();
		copy.src = image.currentSrc || image.src;
		await copy.decode();
		const answer = await session.prompt( [
			{
				role: 'user',
				content: [
					{ type: 'text', value: 'Write alt text for this image.' },
					{ type: 'image', value: copy },
				],
			},
		] );
		return answer.trim();
	} finally {
		session.destroy();
	}
}

/**
 * Places a numbered badge on the top left corner of each image.
 *
 * @param {HTMLImageElement[]} images  Images to badge.
 * @param {Function}           onClick Called with the image's index.
 */
function addBadges( images, onClick ) {
	const host = createHost( BADGE_CSS );
	// The host spans no area, so the page below stays clickable around the badges.
	host.style.cssText = 'position:absolute;top:0;left:0;z-index:2147482999';
	document.body.append( host );

	const badges = images.map( ( image, index ) => {
		const badge = document.createElement( 'button' );
		badge.type = 'button';
		badge.textContent = index + 1;
		badge.setAttribute( 'aria-label', `Image ${ index + 1 } has no alt text` );
		badge.addEventListener( 'click', () => onClick( index ) );
		host.shadowRoot.append( badge );
		return badge;
	} );

	const place = () => {
		// Badges sit in document coordinates, so they scroll with the page.
		const origin = host.getBoundingClientRect();
		images.forEach( ( image, index ) => {
			const rect = image.getBoundingClientRect();
			badges[ index ].hidden = ! rect.width;
			badges[ index ].style.left = `${ rect.left - origin.left + 4 }px`;
			badges[ index ].style.top = `${ rect.top - origin.top + 4 }px`;
		} );
	};
	const observer = new ResizeObserver( place );
	images.forEach( ( image ) => observer.observe( image ) );
	observer.observe( document.body );
}

/** Follows the page's `data-theme` when set, otherwise the system setting. */
function followPageTheme( host ) {
	const sync = () => {
		const theme = document.documentElement.dataset.theme;
		host.style.colorScheme = theme === 'light' || theme === 'dark' ? theme : '';
	};
	sync();
	new MutationObserver( sync ).observe( document.documentElement, { attributes: true, attributeFilter: [ 'data-theme' ] } );
}
