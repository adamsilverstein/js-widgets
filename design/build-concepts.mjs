/**
 * Design prototypes for the gallery and the README. Not part of the build.
 *
 *   npm run build && node design/shoot.mjs thumbs && node design/build-concepts.mjs
 *   python3 -m http.server -d site 8080
 *
 * Run it with the widget directories from the widget PRs checked out, so there is something to show.
 *
 * Writes, from the real widgets in site/widgets.json:
 *   site/concept-workbench.html   Concept A: one widget on a stage, options you can edit.
 *   site/concept-catalog.html     Concept B: every widget on one page, demos open in place.
 *   design/README-wall.md         README mock: a wall of posters, with snippets to copy.
 */
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { CATEGORIES } from '../scripts/build.mjs';

const ROOT = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '..' );
const SITE = path.join( ROOT, 'site' );
const SITE_URL = 'https://adamsilverstein.github.io/js-widgets/';
const REPO_URL = 'https://github.com/adamsilverstein/js-widgets';

const widgets = JSON.parse( await readFile( path.join( SITE, 'widgets.json' ), 'utf8' ) );
const esc = ( text ) =>
	String( text ).replace( /[&<>"]/g, ( char ) => ( { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ char ] ) );
const kb = ( bytes ) => `${ ( bytes / 1024 ).toFixed( 1 ) } KB`;
const sections = Object.entries( CATEGORIES )
	.map( ( [ id, category ] ) => ( { id, ...category, widgets: widgets.filter( ( widget ) => widget.category === id ) } ) )
	.filter( ( section ) => section.widgets.length );
const attributes = ( widget ) =>
	[ ...widget.snippet.matchAll( /\s([\w-]+)="([^"]*)"/g ) ].map( ( [ , name, value ] ) => ( { name, value } ) );
const hosted = ( widget ) => widget.snippet.replace( ` src="${ widget.file }.min.js"`, ` src="${ SITE_URL }${ widget.file }.min.js"` );

/*
 * Lets a demo take option overrides from its URL fragment, eg.
 * demos/googly-eyes/#data-size=96. The observer runs after the parser inserts
 * the script tag and before the script executes, so the widget reads the new
 * values. In the real build this would be part of the demo page wrapper.
 */
const OVERRIDES = `<script>(()=>{const p=[...new URLSearchParams(location.hash.slice(1))].filter(([k])=>k.startsWith("data-"));if(!p.length)return;new MutationObserver((m,o)=>{for(const s of document.scripts)if(/\\.min\\.js$/.test(s.getAttribute("src")||"")){for(const[k,v]of p)s.setAttribute(k,v);o.disconnect()}}).observe(document.documentElement,{childList:true,subtree:true})})()</script>`;
for ( const widget of widgets ) {
	const file = path.join( SITE, 'demos', widget.slug, 'index.html' );
	const html = await readFile( file, 'utf8' );
	if ( ! html.includes( 'URLSearchParams(location.hash' ) ) {
		await writeFile( file, html.replace( /<head[^>]*>/i, ( head ) => head + OVERRIDES ) );
	}
}

await mkdir( path.join( SITE, 'fonts' ), { recursive: true } );
for ( const font of [ 'bricolage-grotesque-latin-wght-normal.woff2', 'jetbrains-mono-latin-wght-normal.woff2' ] ) {
	await copyFile( path.join( ROOT, 'design/fonts', font ), path.join( SITE, 'fonts', font ) );
}

const BASE_CSS = `
@font-face { font-family: "Bricolage Grotesque"; src: url(fonts/bricolage-grotesque-latin-wght-normal.woff2) format("woff2"); font-weight: 200 800; font-display: swap; }
@font-face { font-family: "JetBrains Mono"; src: url(fonts/jetbrains-mono-latin-wght-normal.woff2) format("woff2"); font-weight: 100 800; font-display: swap; }
:root {
	color-scheme: light dark;
	--paper: light-dark(#ffffff, #0f151e);
	--wash: light-dark(#eef1f5, #161e2a);
	--ink: light-dark(#16202e, #e9edf3);
	--muted: light-dark(#5b6676, #9aa6b6);
	--line: light-dark(#d5dae1, #2b3644);
	--tag: light-dark(#2447d8, #9db4ff);
	--mark: #ffe94a;
	--on-mark: #16202e;
	--sans: "Bricolage Grotesque", system-ui, sans-serif;
	--mono: "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace;
}
* { box-sizing: border-box; }
[hidden] { display: none !important; }
body { margin: 0; background: var(--paper); color: var(--ink); font: 400 17px/1.5 var(--sans); }
a { color: var(--tag); text-underline-offset: 3px; }
:focus-visible { outline: 3px solid var(--tag); outline-offset: 2px; border-radius: 4px; }
h1, h2, h3, p { margin: 0; }
button, .button {
	display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px;
	border: 1.5px solid var(--ink); border-radius: 8px; background: var(--paper); color: var(--ink);
	font: 600 1rem/1.2 var(--sans); text-decoration: none; cursor: pointer;
}
button.primary { background: var(--ink); color: var(--paper); }
button:hover, .button:hover { box-shadow: 3px 3px 0 var(--mark); }
button small { font-weight: 400; opacity: 0.75; }
.snippet {
	margin: 0; padding: 20px 22px; overflow-x: auto; border-radius: 10px;
	background: var(--wash); font: 500 clamp(0.85rem, 0.7rem + 0.5vw, 1.05rem)/1.9 var(--mono); white-space: pre;
}
.snippet .url { color: var(--muted); }
.snippet .name { color: var(--tag); }
/* The parts of a snippet you are meant to change are marked like a highlighter pen. */
.snippet mark, .snippet input.value {
	padding: 2px 5px; border: 0; border-radius: 3px; background: var(--mark); color: var(--on-mark); font: inherit;
}
.requires { display: flex; gap: 10px; max-width: 62ch; padding: 10px 14px; border-left: 4px solid var(--mark); background: var(--wash); font-size: 0.95rem; }
.status { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
@media (prefers-reduced-motion: no-preference) { button, .button { transition: box-shadow 0.12s; } }
`;

/* ---------- Concept A: Workbench ---------- */

const workbenchCss = `
.app { display: grid; grid-template-columns: 300px minmax(0, 1fr); min-height: 100vh; }
.rail { position: sticky; top: 0; align-self: start; height: 100vh; overflow: auto; padding: 28px 16px 28px 28px; background: var(--wash); }
.rail h1 { font: 800 1.9rem/1 var(--sans); letter-spacing: -0.03em; }
.rail h1 a { color: inherit; text-decoration: none; }
.rail .pitch { margin: 10px 12px 22px 0; color: var(--muted); font-size: 0.95rem; line-height: 1.4; }
.rail h2 { display: flex; align-items: baseline; justify-content: space-between; margin: 20px 12px 6px 0; font: 700 0.95rem/1.3 var(--sans); }
.rail h2 small { color: var(--muted); font-weight: 400; font-size: 0.8rem; }
.rail ul { margin: 0; padding: 0; list-style: none; }
.rail li a { display: flex; justify-content: space-between; gap: 12px; margin-left: -10px; padding: 5px 12px 5px 10px; border-radius: 6px; color: var(--ink); text-decoration: none; }
.rail li a span { color: var(--muted); font-size: 0.82rem; font-variant-numeric: tabular-nums; white-space: nowrap; align-self: center; }
.rail li a:hover { background: color-mix(in srgb, var(--ink) 8%, transparent); }
.rail li a[aria-current] { background: var(--mark); color: var(--on-mark); font-weight: 700; }
.rail li a[aria-current] span { color: var(--on-mark); }
.rail .source { display: block; margin-top: 26px; font-size: 0.9rem; }

.stage { display: grid; gap: 22px; align-content: start; max-width: 1080px; padding: 36px clamp(20px, 4vw, 56px) 56px; }
.stage header { display: grid; gap: 10px; }
.stage h2 { font: 800 clamp(2.3rem, 1.4rem + 3.4vw, 4rem)/0.95 var(--sans); letter-spacing: -0.035em; }
.stage .description { max-width: 58ch; font-size: 1.2rem; line-height: 1.4; }
.facts { display: flex; flex-wrap: wrap; gap: 4px 22px; color: var(--muted); font-size: 0.95rem; }
.facts b { color: var(--ink); font-variant-numeric: tabular-nums; }

.frame { border: 1.5px solid var(--ink); border-radius: 12px; overflow: hidden; background: var(--wash); }
.frame .bar { display: flex; align-items: center; gap: 6px; padding: 6px 8px 6px 14px; border-bottom: 1.5px solid var(--ink); background: var(--paper); font-size: 0.9rem; }
.frame .bar strong { margin-right: auto; font-weight: 600; }
.frame .bar button { padding: 5px 10px; border-color: transparent; border-radius: 6px; font-weight: 500; font-size: 0.9rem; }
.frame .bar button[aria-pressed="true"] { border-color: var(--ink); }
.frame iframe { display: block; width: 100%; margin: 0 auto; border: 0; background: #fff; color-scheme: light; }
.frame.phone iframe { width: 390px; max-width: 100%; border-inline: 1.5px solid var(--ink); }

.tune { display: grid; gap: 12px; }
.tune h3 { font: 700 1.05rem/1.3 var(--sans); }
.tune h3 span { color: var(--muted); font-weight: 400; }
.snippet input.value { field-sizing: content; min-width: 2ch; max-width: 46ch; outline-offset: 1px; }
.snippet input[type="color"] { width: 1.3em; height: 1.3em; margin-right: 6px; padding: 0; border: 1.5px solid var(--ink); border-radius: 50%; background: none; vertical-align: -0.25em; cursor: pointer; }
.snippet input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
.snippet input[type="color"]::-webkit-color-swatch { border: 0; border-radius: 50%; }
.actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.actions .links { display: flex; gap: 18px; margin-left: auto; font-size: 0.95rem; }
.pager { display: flex; justify-content: space-between; gap: 12px; margin-top: 18px; padding-top: 22px; border-top: 1.5px solid var(--line); }
.pager a { color: var(--ink); font-weight: 600; text-decoration: none; }
.pager a small { display: block; color: var(--muted); font-weight: 400; }
.pager a:last-child { text-align: right; margin-left: auto; }

@media (max-width: 860px) {
	.app { display: block; }
	.rail { position: static; height: auto; padding: 18px 0 12px 18px; }
	.rail .pitch { margin-bottom: 12px; }
	.rail nav { display: flex; gap: 22px; overflow-x: auto; padding: 0 18px 8px 0; scroll-snap-type: x proximity; }
	.rail section { flex: none; scroll-snap-align: start; }
	.rail h2 { position: sticky; left: 0; width: max-content; margin-top: 4px; gap: 10px; }
	.frame .bar button { white-space: nowrap; }
	.frame .bar [data-do="phone"] { display: none; }
	.rail ul { display: flex; gap: 6px; }
	.rail li a { margin: 0; border: 1.5px solid var(--line); white-space: nowrap; }
	.rail li a span, .rail .source { display: none; }
	.stage { padding-top: 24px; }
	.actions .links { margin-left: 0; width: 100%; }
}
`;

const workbenchJs = `
const widgets = JSON.parse( document.getElementById( 'widgets' ).textContent );
const SITE_URL = ${ JSON.stringify( SITE_URL ) };
const REPO_URL = ${ JSON.stringify( REPO_URL ) };
const stage = document.querySelector( '.stage' );
const status = document.querySelector( '.status' );
const esc = ( text ) => String( text ).replace( /[&<>"]/g, ( c ) => ( { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ c ] ) );
const kb = ( bytes ) => ( bytes / 1024 ).toFixed( 1 ) + ' KB';
const isColor = ( value ) => /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test( value );
const hex6 = ( value ) => ( value.length === 4 ? '#' + [ ...value.slice( 1 ) ].map( ( c ) => c + c ).join( '' ) : value );
let current, values, timer, phone = false;

const tag = ( inner ) => {
	const attrs = current.attrs.map( ( { name } ) => name + '="' + values[ name ] + '"' ).join( ' ' );
	return '<script ' + ( inner === undefined ? 'src="' + SITE_URL + current.file + '.min.js" ' : '' ) + attrs + '>' + ( inner ?? '' ) + '</' + 'script>';
};
const changed = () => current.attrs.some( ( { name, value } ) => values[ name ] !== value );

function loadDemo() {
	const frame = stage.querySelector( '.frame' );
	const params = new URLSearchParams( current.attrs.filter( ( { name, value } ) => values[ name ] !== value ).map( ( { name } ) => [ name, values[ name ] ] ) );
	const iframe = document.createElement( 'iframe' );
	iframe.title = current.name + ' live demo';
	iframe.allow = 'geolocation; midi; accelerometer; gyroscope; autoplay; clipboard-write';
	iframe.style.height = Math.max( current.demoHeight || 280, 300 ) + 'px';
	iframe.src = 'demos/' + current.slug + '/' + ( params.size ? '#' + params : '' );
	frame.querySelector( 'iframe' )?.remove();
	frame.append( iframe );
	frame.classList.toggle( 'phone', phone );
	stage.querySelector( '[data-do="reset"]' ).hidden = ! changed();
}

function show( slug, focus ) {
	const index = Math.max( 0, widgets.findIndex( ( widget ) => widget.slug === slug ) );
	current = widgets[ index ];
	values = Object.fromEntries( current.attrs.map( ( { name, value } ) => [ name, value ] ) );
	const previous = widgets[ ( index + widgets.length - 1 ) % widgets.length ];
	const next = widgets[ ( index + 1 ) % widgets.length ];
	document.title = current.name + ' | JS Widgets';
	for ( const link of document.querySelectorAll( '.rail li a' ) ) {
		link.toggleAttribute( 'aria-current', link.hash === '#' + current.slug );
		if ( link.hasAttribute( 'aria-current' ) ) { link.setAttribute( 'aria-current', 'page' ); link.scrollIntoView( { block: 'nearest', inline: 'center' } ); }
	}
	const lines = current.attrs.map( ( { name, value } ) =>
		'  <span class="name">' + name + '</span>="' +
		( isColor( value ) ? '<input type="color" data-for="' + name + '" value="' + hex6( value ) + '" aria-label="Pick ' + name + '">' : '' ) +
		'<input class="value" name="' + name + '" value="' + esc( value ) + '" aria-label="' + name + '" spellcheck="false" autocomplete="off" size="' + Math.max( 2, value.length ) + '">"'
	);
	stage.innerHTML =
		'<header><h2 tabindex="-1">' + esc( current.name ) + '</h2>' +
		'<p class="description">' + esc( current.description ) + '</p>' +
		'<p class="facts"><span><b>' + kb( current.bytes ) + '</b> minified</span><span><b>' + kb( current.gzipBytes ) + '</b> gzipped</span><span>No dependencies</span></p>' +
		( current.requires ? '<p class="requires">Needs ' + esc( current.requires ) + '. In other browsers it stays out of the way.</p>' : '' ) +
		'</header>' +
		'<div class="frame"><div class="bar"><strong>Live demo</strong>' +
		'<button type="button" data-do="phone" aria-pressed="' + phone + '">Phone width</button>' +
		'<button type="button" data-do="reload">Restart</button>' +
		'<button type="button" data-do="open">Open full page</button></div></div>' +
		'<section class="tune"><h3>Paste this where you want it. <span>Change a highlighted value and the demo follows.</span></h3>' +
		'<pre class="snippet"><code>&lt;script\\n  <span class="name">src</span>="<span class="url">' + SITE_URL + current.file + '.min.js</span>"\\n' + lines.join( '\\n' ) + '\\n&gt;&lt;/script&gt;</code></pre>' +
		'<div class="actions"><button type="button" class="primary" data-do="copy">Copy snippet</button>' +
		'<button type="button" data-do="inline">Copy inline JS <small>' + kb( current.bytes ) + ', no request</small></button>' +
		'<button type="button" data-do="reset" hidden>Reset options</button>' +
		'<span class="links"><a href="' + REPO_URL + '/tree/main/widgets/' + current.slug + '#options">All options</a>' +
		'<a href="' + current.file + '.min.js" download>Download ' + current.file + '.min.js</a></span></div></section>' +
		'<nav class="pager" aria-label="More widgets"><a href="#' + previous.slug + '"><small>Previous</small>' + esc( previous.name ) + '</a>' +
		'<a href="#' + next.slug + '"><small>Next</small>' + esc( next.name ) + '</a></nav>';
	loadDemo();
	if ( focus ) { scrollTo( 0, 0 ); stage.querySelector( 'h2' ).focus( { preventScroll: true } ); }
}

stage.addEventListener( 'input', ( event ) => {
	const input = event.target;
	if ( input.type === 'color' ) {
		stage.querySelector( 'input.value[name="' + input.dataset.for + '"]' ).value = input.value;
		values[ input.dataset.for ] = input.value;
	} else if ( input.name ) {
		values[ input.name ] = input.value;
		const swatch = stage.querySelector( 'input[data-for="' + input.name + '"]' );
		if ( swatch && isColor( input.value ) ) { swatch.value = hex6( input.value ); }
	}
	clearTimeout( timer );
	timer = setTimeout( loadDemo, 350 );
} );

stage.addEventListener( 'click', async ( event ) => {
	const button = event.target.closest( 'button[data-do]' );
	if ( ! button ) { return; }
	const action = button.dataset.do;
	if ( action === 'reload' ) { loadDemo(); }
	if ( action === 'phone' ) { phone = ! phone; button.setAttribute( 'aria-pressed', phone ); stage.querySelector( '.frame' ).classList.toggle( 'phone', phone ); }
	if ( action === 'open' ) { open( stage.querySelector( 'iframe' ).src ); }
	if ( action === 'reset' ) { show( current.slug ); }
	if ( action === 'copy' || action === 'inline' ) {
		const label = button.innerHTML;
		let message = 'Copied';
		try {
			const text = action === 'copy' ? tag() : tag( ( await ( await fetch( current.file + '.min.js' ) ).text() ).trim() );
			await navigator.clipboard.writeText( text );
		} catch { message = 'Copy failed'; }
		button.textContent = message;
		status.textContent = message;
		setTimeout( () => { button.innerHTML = label; }, 1500 );
	}
} );

addEventListener( 'hashchange', () => show( location.hash.slice( 1 ), true ) );
show( location.hash.slice( 1 ) || 'googly-eyes' );
`;

const rail = sections
	.map(
		( section ) => `<section><h2>${ esc( section.title ) }${ section.id === 'ai' ? ' <small>Chrome desktop</small>' : '' }</h2>
<ul>${ section.widgets.map( ( widget ) => `<li><a href="#${ widget.slug }">${ esc( widget.name ) } <span>${ kb( widget.bytes ) }</span></a></li>` ).join( '' ) }</ul></section>`
	)
	.join( '\n' );

// In reading order of the rail, so Previous and Next follow it.
const ordered = sections.flatMap( ( section ) => section.widgets ).map( ( widget ) => ( { ...widget, attrs: attributes( widget ).filter( ( { name } ) => name !== 'src' ) } ) );

await writeFile(
	path.join( SITE, 'concept-workbench.html' ),
	`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>JS Widgets</title>
<style>${ BASE_CSS }${ workbenchCss }</style>
</head>
<body>
<div class="app">
<div class="rail">
	<h1><a href="./concept-workbench.html">JS Widgets</a></h1>
	<p class="pitch">${ widgets.length } small scripts for any website. Try one, set its options, paste one line.</p>
	<nav aria-label="Widgets">
${ rail }
	</nav>
	<a class="source" href="${ REPO_URL }">Source on GitHub</a>
</div>
<main class="stage"></main>
</div>
<div class="status" role="status" aria-live="polite"></div>
<script type="application/json" id="widgets">${ JSON.stringify( ordered ).replaceAll( '<', '\\u003c' ) }</script>
<script>${ workbenchJs }</script>
</body>
</html>
`
);

/* ---------- Concept B: Catalog ---------- */

const catalogCss = `
.page { max-width: 1040px; margin: 0 auto; padding: 44px clamp(16px, 4vw, 40px) 72px; }
.masthead { display: grid; gap: 14px; margin-bottom: 30px; }
.masthead h1 { font: 800 clamp(2.6rem, 1.6rem + 4.5vw, 4.6rem)/0.92 var(--sans); letter-spacing: -0.04em; }
.masthead p { max-width: 52ch; font-size: 1.2rem; line-height: 1.4; }
.jump { display: flex; flex-wrap: wrap; gap: 8px 22px; padding: 12px 0; border-block: 1.5px solid var(--ink); font-weight: 600; }
.jump a { color: var(--ink); text-decoration: none; }
.jump a:hover { text-decoration: underline; }
.jump a span { color: var(--muted); font-weight: 400; }
.jump .source { margin-left: auto; font-weight: 400; }
.group { margin-top: 44px; }
.group > h2 { font: 800 1.7rem/1.1 var(--sans); letter-spacing: -0.02em; }
.group > p { margin: 4px 0 14px; color: var(--muted); }
details { border-top: 1.5px solid var(--line); }
details:last-child { border-bottom: 1.5px solid var(--line); }
summary { display: grid; grid-template-columns: 132px minmax(0, 1fr) auto auto; align-items: center; gap: 18px; padding: 12px 8px 12px 0; cursor: pointer; list-style: none; }
summary::-webkit-details-marker { display: none; }
summary img { display: block; width: 132px; height: 82px; object-fit: cover; object-position: top left; border: 1.5px solid var(--line); border-radius: 6px; background: #fff; }
summary h3 { font: 700 1.25rem/1.2 var(--sans); }
summary p { color: var(--muted); font-size: 0.98rem; line-height: 1.35; }
summary .size { color: var(--muted); font-size: 0.9rem; font-variant-numeric: tabular-nums; white-space: nowrap; }
summary .try { padding: 8px 14px; border: 1.5px solid var(--ink); border-radius: 8px; font-weight: 600; white-space: nowrap; }
summary .try::before { content: "Try it"; }
details[open] summary .try { background: var(--mark); color: var(--on-mark); }
details[open] summary .try::before { content: "Close"; }
summary:hover h3 { text-decoration: underline; text-decoration-color: var(--mark); text-decoration-thickness: 4px; text-underline-offset: 3px; }
details[open] summary img { visibility: hidden; height: 0; border: 0; }
.open { display: grid; gap: 14px; padding: 4px 0 26px; }
.open iframe { display: block; width: 100%; border: 1.5px solid var(--ink); border-radius: 12px; background: #fff; color-scheme: light; }
.actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.actions .links { display: flex; gap: 18px; margin-left: auto; font-size: 0.95rem; }
@media (max-width: 640px) {
	summary { grid-template-columns: minmax(0, 1fr) auto; gap: 4px 12px; }
	summary img, summary .size { display: none; }
	.jump .source { margin-left: 0; }
}
`;

const catalogJs = `
const status = document.querySelector( '.status' );
document.addEventListener( 'click', async ( event ) => {
	const button = event.target.closest( 'button[data-copy]' );
	if ( ! button ) { return; }
	const label = button.innerHTML;
	let message = 'Copied';
	try {
		const snippet = button.closest( '.open' ).querySelector( 'code' ).textContent.replace( /\\n\\s*/g, ' ' ).replace( ' ><', '><' );
		const text = button.dataset.copy === 'snippet' ? snippet
			: snippet.replace( / src="[^"]*"/, '' ).replace( '><', '>' + ( await ( await fetch( button.dataset.file ) ).text() ).trim() + '<' );
		await navigator.clipboard.writeText( text );
	} catch { message = 'Copy failed'; }
	button.textContent = message;
	status.textContent = message;
	setTimeout( () => { button.innerHTML = label; }, 1500 );
} );
// A link to #slug opens that row.
const openTarget = () => { const row = document.getElementById( location.hash.slice( 1 ) ); if ( row?.matches( 'details' ) ) { row.open = true; row.scrollIntoView(); } };
addEventListener( 'hashchange', openTarget );
openTarget();
`;

// Shown one attribute per line so nothing is cut off. The copy buttons write it as one line.
const markedSnippet = ( widget ) =>
	`&lt;script\n  <span class="name">src</span>="<span class="url">${ SITE_URL }${ widget.file }.min.js</span>"\n${ attributes( widget )
		.filter( ( { name } ) => name !== 'src' )
		.map( ( { name, value } ) => `  <span class="name">${ name }</span>="<mark>${ esc( value ) }</mark>"` )
		.join( '\n' ) }\n&gt;&lt;/script&gt;`;

const row = ( widget ) => `<details name="widget" id="${ widget.slug }">
<summary>
	<img src="posters/${ widget.slug }.png" alt="" loading="lazy" width="132" height="82">
	<div><h3>${ esc( widget.name ) }</h3><p>${ esc( widget.description ) }</p></div>
	<span class="size">${ kb( widget.bytes ) }</span>
	<span class="try" aria-hidden="true"></span>
</summary>
<div class="open">
	${ widget.requires ? `<p class="requires">Needs ${ esc( widget.requires ) }. In other browsers it stays out of the way.</p>` : '' }
	<iframe src="demos/${ widget.slug }/" title="${ esc( widget.name ) } live demo" loading="lazy" style="height:${ Math.max( Number( widget.demoHeight ) || 280, 320 ) }px" allow="geolocation; midi; accelerometer; gyroscope; autoplay; clipboard-write"></iframe>
	<pre class="snippet"><code>${ markedSnippet( widget ) }</code></pre>
	<div class="actions">
		<button type="button" class="primary" data-copy="snippet">Copy snippet</button>
		<button type="button" data-copy="inline" data-file="${ widget.file }.min.js">Copy inline JS <small>${ kb( widget.bytes ) }, no request</small></button>
		<span class="links"><a href="demos/${ widget.slug }/">Open full page</a><a href="${ REPO_URL }/tree/main/widgets/${ widget.slug }#options">All options</a></span>
	</div>
</div>
</details>`;

await writeFile(
	path.join( SITE, 'concept-catalog.html' ),
	`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>JS Widgets</title>
<style>${ BASE_CSS }${ catalogCss }</style>
</head>
<body>
<div class="page">
<header class="masthead">
	<h1>JS Widgets</h1>
	<p>${ widgets.length } small scripts for any website. Open one to try it, then paste one line. No dependencies, no build step, no account.</p>
	<nav class="jump" aria-label="Categories">
		${ sections.map( ( section ) => `<a href="#${ section.id }">${ esc( section.title ) } <span>${ section.widgets.length }</span></a>` ).join( '\n\t\t' ) }
		<a class="source" href="${ REPO_URL }">Source on GitHub</a>
	</nav>
</header>
<main>
${ sections
	.map(
		( section ) => `<section class="group" id="${ section.id }">
<h2>${ esc( section.title ) }</h2>
<p>${ esc( section.description ) }</p>
${ section.widgets.map( row ).join( '\n' ) }
</section>`
	)
	.join( '\n' ) }
</main>
</div>
<div class="status" role="status" aria-live="polite"></div>
<script>${ catalogJs }</script>
</body>
</html>
`
);

/* ---------- README options ---------- */

// On main these would be `${ SITE_URL }posters/<slug>.png`, published with the gallery.
const poster = ( widget ) => `posters/${ widget.slug }.png`;
const demoUrl = ( widget ) => `${ SITE_URL }#${ widget.slug }`;
const aiNote = `> [!NOTE]\n> These use Chrome's built-in AI, so they need a recent desktop Chrome. In other browsers they render nothing and the page works as before.`;

const wall = sections
	.map( ( section ) => {
		const cells = section.widgets.map(
			( widget ) => `<td width="33%" valign="top">
<a href="${ demoUrl( widget ) }"><img src="${ poster( widget ) }" alt="${ esc( widget.name ) } demo" width="100%"></a><br>
<b><a href="../widgets/${ widget.slug }">${ esc( widget.name ) }</a></b> <sub>${ kb( widget.bytes ) }</sub><br>
<sub>${ esc( widget.description ) }</sub>
</td>`
		);
		const rows = [];
		for ( let i = 0; i < cells.length; i += 3 ) {
			rows.push( `<tr>\n${ cells.slice( i, i + 3 ).join( '\n' ) }\n</tr>` );
		}
		// GitHub adds a copy button to every code block, so the snippets can be copied without leaving the README.
		const drawer = `<details>\n<summary>Copy a snippet</summary>\n\n${ section.widgets
			.map( ( widget ) => `**${ widget.name }** &nbsp; [options](../widgets/${ widget.slug }#options)\n\n\`\`\`html\n${ hosted( widget ) }\n\`\`\`` )
			.join( '\n\n' ) }\n\n</details>`;
		return `### ${ section.title }\n\n${ section.description }\n\n${ section.id === 'ai' ? aiNote + '\n\n' : '' }<table>\n${ rows.join( '\n' ) }\n</table>\n\n${ drawer }`;
	} )
	.join( '\n\n' );

const intro = ( note ) => `# JS Widgets

Standalone JavaScript widgets you can add to any site with one paste. No dependencies, no build step, no account.

**[Try every widget in the live gallery](${ SITE_URL })**. ${ note }

`;
await writeFile(
	path.join( ROOT, 'design/README-wall.md' ),
	intro( 'Click a picture to open that widget\'s live demo, or open "Copy a snippet" under any group and use the copy button on the code.' ) + wall + '\n'
);
console.log( 'Wrote 2 gallery concepts and the README mock.' );
