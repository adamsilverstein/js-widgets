/*
 * The gallery: one widget at a time on the stage, picked from the rail or the
 * URL fragment (`#mini-synth`). Only the widget on stage has a running demo.
 * The build inlines the widget list as JSON.
 */
const { widgets, siteUrl, repoUrl } = JSON.parse( document.getElementById( 'widgets' ).textContent );
const stage = document.querySelector( '.stage' );
const status = document.querySelector( '.status' );

const escapeHtml = ( text ) =>
	String( text ).replace( /[&<>"]/g, ( char ) => ( { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ char ] ) );
const formatSize = ( bytes ) => `${ ( bytes / 1024 ).toFixed( 1 ) } KB`;
const isColor = ( value ) => /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test( value );
/** Expands `#abc` to `#aabbcc`, the only form a color input accepts. */
const longHex = ( value ) => ( value.length === 4 ? `#${ [ ...value.slice( 1 ) ].map( ( char ) => char + char ).join( '' ) }` : value );

/** The widget on stage. */
let current;
/** Its option values as edited so far, by attribute name. */
let values;
let phone = false;
let reloadTimer;

const changed = () => current.attrs.some( ( { name, value } ) => values[ name ] !== value );

/**
 * Builds the script tag for the widget on stage, with the edited options.
 *
 * @param {string} [code] Minified widget code to put inline. Omit for a tag that loads the hosted file.
 * @return {string} The snippet to copy.
 */
function snippet( code ) {
	const attrs = current.attrs.map( ( { name } ) => ` ${ name }="${ values[ name ].replaceAll( '"', '&quot;' ) }"` ).join( '' );
	const src = code === undefined ? ` src="${ siteUrl }${ current.file }.min.js"` : '';
	// "<\/" because this file is inlined in a script element, which a literal closing tag would end.
	return `<script${ src }${ attrs }>${ code ?? '' }<\/script>`;
}

/** Loads the demo afresh, passing edited options in the URL fragment for the demo page to apply. */
function loadDemo() {
	const frame = stage.querySelector( '.frame' );
	const overrides = new URLSearchParams(
		current.attrs.filter( ( { name, value } ) => values[ name ] !== value ).map( ( { name } ) => [ name, values[ name ] ] )
	);
	const iframe = document.createElement( 'iframe' );
	iframe.title = `${ current.name } live demo`;
	iframe.allow = 'geolocation; midi; accelerometer; gyroscope; autoplay; clipboard-write';
	iframe.style.height = `${ Math.max( current.demoHeight || 280, 300 ) }px`;
	iframe.src = `demos/${ current.slug }/${ current.poster || '' }${ overrides.size ? `#${ overrides }` : '' }`;
	// A new iframe, not a new src: changing only the fragment would not reload the page.
	frame.querySelector( 'iframe' )?.remove();
	frame.append( iframe );
	stage.querySelector( '[data-do="reset"]' ).hidden = ! changed();
}

/**
 * Puts a widget on stage.
 *
 * @param {string}  slug    Widget to show. Falls back to the first one.
 * @param {boolean} [focus] Move focus to the heading, for navigation after the first load.
 */
function show( slug, focus ) {
	const index = Math.max( 0, widgets.findIndex( ( widget ) => widget.slug === slug ) );
	current = widgets[ index ];
	values = Object.fromEntries( current.attrs.map( ( { name, value } ) => [ name, value ] ) );
	const previous = widgets.at( index - 1 );
	const next = widgets[ ( index + 1 ) % widgets.length ];

	document.title = `${ current.name } | JS Widgets`;
	for ( const link of document.querySelectorAll( '.rail li a' ) ) {
		if ( link.hash === `#${ current.slug }` ) {
			link.setAttribute( 'aria-current', 'page' );
			link.scrollIntoView( { block: 'nearest', inline: 'center' } );
		} else {
			link.removeAttribute( 'aria-current' );
		}
	}

	const lines = current.attrs.map( ( { name, value } ) => {
		const swatch = isColor( value )
			? `<input type="color" data-for="${ name }" value="${ longHex( value ) }" aria-label="Pick ${ name }">`
			: '';
		return `  <span class="name">${ name }</span>="${ swatch }<input class="value" name="${ name }" value="${ escapeHtml( value ) }" aria-label="${ name }" spellcheck="false" autocomplete="off">"\n`;
	} );

	stage.innerHTML = `<header>
	<h2 tabindex="-1">${ escapeHtml( current.name ) }</h2>
	<p class="description">${ escapeHtml( current.description ) }</p>
	<p class="facts"><span><b>${ formatSize( current.bytes ) }</b> minified</span><span><b>${ formatSize( current.gzipBytes ) }</b> gzipped</span><span>No dependencies</span></p>
	${ current.requires ? `<p class="requires">Needs ${ escapeHtml( current.requires ) }. In other browsers it stays out of the way.</p>` : '' }
	${ current.api ? `<div class="unavailable" hidden><p></p><img src="posters/${ current.slug }.png" alt="${ escapeHtml( current.name ) } as it looks where it works" onerror="this.remove()"></div>` : '' }
</header>
<div class="frame">
	<div class="bar">
		<strong>Live demo</strong>
		<button type="button" data-do="phone" aria-pressed="${ phone }">Phone width</button>
		<button type="button" data-do="reload">Restart</button>
		<button type="button" data-do="open">Open full page</button>
	</div>
</div>
<section class="tune">
	<h3>Paste this where you want it. ${ lines.length ? '<span>Change a highlighted value and the demo follows.</span>' : '' }</h3>
	<pre class="snippet"><code>&lt;script
  <span class="name">src</span>="<span class="url">${ siteUrl }${ current.file }.min.js</span>"
${ lines.join( '' ) }&gt;&lt;/script&gt;</code></pre>
	<div class="actions">
		<button type="button" class="primary" data-do="copy">Copy snippet</button>
		<button type="button" data-do="inline" title="The whole widget in one script tag, with nothing loaded from another server">Copy inline JS <small>${ formatSize( current.bytes ) }, no request</small></button>
		<button type="button" data-do="reset" hidden>Reset options</button>
		<span class="links">
			<a href="${ repoUrl }/tree/main/widgets/${ current.slug }#options">All options</a>
			<a href="${ current.file }.min.js" download>Download ${ current.file }.min.js</a>
		</span>
	</div>
</section>
<nav class="pager" aria-label="More widgets">
	<a href="#${ previous.slug }"><small>Previous</small>${ escapeHtml( previous.name ) }</a>
	<a href="#${ next.slug }"><small>Next</small>${ escapeHtml( next.name ) }</a>
</nav>`;

	stage.querySelector( '.frame' ).classList.toggle( 'phone', phone );
	loadDemo();
	explainIfUnavailable( current );
	if ( focus ) {
		scrollTo( 0, 0 );
		stage.querySelector( 'h2' ).focus( { preventScroll: true } );
	}
}

/**
 * Tells the visitor when their browser cannot run a built-in AI widget. Such a
 * widget shows little or nothing, so without this the demo just looks broken.
 * A screenshot stands in for it.
 *
 * @param {Object} widget The widget just put on stage.
 */
async function explainIfUnavailable( widget ) {
	const { api } = widget;
	// Captured now: by the time the check answers, the stage may have been rebuilt.
	const note = stage.querySelector( '.unavailable' );
	if ( ! api || ! note ) {
		return;
	}
	let state = 'missing';
	if ( api in self ) {
		// One call per set of options the demo depends on. The widget works if any of them can run.
		const states = await Promise.all(
			( widget.apiOptions || [ undefined ] ).map( ( options ) => self[ api ].availability( options ).catch( () => 'unavailable' ) )
		);
		state = states.find( ( each ) => each !== 'unavailable' ) || 'unavailable';
	}
	if ( ! note.isConnected || ( state !== 'missing' && state !== 'unavailable' ) ) {
		return;
	}
	const reason =
		state === 'missing'
			? `It has no built-in ${ api } API.`
			: `Chrome reports that its built-in ${ api } model is unavailable on this device.`;
	note.querySelector( 'p' ).innerHTML = `<strong>Your browser cannot run the AI in this one.</strong> ${ reason } The AI part is missing from the demo below, as it would be for visitors in a browser like yours. This is what it looks like where it works:`;
	note.hidden = false;
	// The note appears some time after the heading took focus, so it is announced too.
	status.textContent = `Your browser cannot run the AI in ${ widget.name }. ${ reason }`;
}

/**
 * Writes text to the clipboard. The text may be a promise: passing it to the
 * clipboard unresolved keeps the write inside the click's user gesture, which
 * Safari requires.
 *
 * @param {string|Promise<string>} text Text to copy.
 */
async function copy( text ) {
	if ( typeof text !== 'string' && window.ClipboardItem ) {
		const blob = text.then( ( resolved ) => new Blob( [ resolved ], { type: 'text/plain' } ) );
		await navigator.clipboard.write( [ new ClipboardItem( { 'text/plain': blob } ) ] );
	} else {
		await navigator.clipboard.writeText( await text );
	}
}

stage.addEventListener( 'input', ( { target } ) => {
	const name = target.dataset.for || target.name;
	if ( ! name ) {
		return;
	}
	values[ name ] = target.value;
	// A color option has a swatch and a text field. Keep the other one in step.
	if ( target.type === 'color' ) {
		stage.querySelector( `input.value[name="${ name }"]` ).value = target.value;
	} else if ( isColor( target.value ) ) {
		const swatch = stage.querySelector( `input[data-for="${ name }"]` );
		if ( swatch ) {
			swatch.value = longHex( target.value );
		}
	}
	// Wait for a pause in typing before restarting the demo.
	clearTimeout( reloadTimer );
	reloadTimer = setTimeout( loadDemo, 350 );
} );

stage.addEventListener( 'click', async ( event ) => {
	const button = event.target.closest( 'button[data-do]' );
	if ( ! button ) {
		return;
	}
	const action = button.dataset.do;
	if ( action === 'reload' ) {
		loadDemo();
	} else if ( action === 'phone' ) {
		phone = ! phone;
		button.setAttribute( 'aria-pressed', phone );
		stage.querySelector( '.frame' ).classList.toggle( 'phone', phone );
	} else if ( action === 'open' ) {
		open( stage.querySelector( 'iframe' ).src );
	} else if ( action === 'reset' ) {
		show( current.slug );
	} else {
		// Kept from the first click: by the second, the button may read "Copied".
		const label = ( button.dataset.label ??= button.innerHTML );
		let message = 'Copied';
		try {
			await copy(
				action === 'copy'
					? snippet()
					: fetch( `${ current.file }.min.js` )
							.then( ( response ) => response.text() )
							.then( ( code ) => snippet( code.trim() ) )
			);
		} catch {
			message = 'Copy failed';
		}
		button.textContent = message;
		status.textContent = message;
		clearTimeout( button.resetTimer );
		button.resetTimer = setTimeout( () => {
			button.innerHTML = label;
		}, 1500 );
	}
} );

if ( widgets.length ) {
	addEventListener( 'hashchange', () => show( location.hash.slice( 1 ), true ) );
	show( location.hash.slice( 1 ) );
} else {
	stage.innerHTML = '<p>No widgets yet.</p>';
}
