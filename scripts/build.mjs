/**
 * Builds every widget and the gallery site into `site/`.
 *
 *   site/<file>.min.js          Minified widget, the file users copy or link to.
 *   site/demos/<slug>/          Live demo page, shown in an iframe by the gallery.
 *   site/index.html             The gallery.
 *   site/widgets.json           Manifest, read by the tests.
 *
 * Flags:
 *   --readme    Also rewrite the widget list in README.md.
 *   --template  Include `widgets/_template`, to try the scaffold out.
 */
import { build } from 'esbuild';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '..' );
const SITE = path.join( ROOT, 'site' );
const REPO_URL = 'https://github.com/adamsilverstein/js-widgets';

/** Where the built files are hosted. Snippets in the gallery point here. */
const SITE_URL = ( process.env.SITE_URL || 'https://adamsilverstein.github.io/js-widgets/' ).replace( /\/?$/, '/' );

/** Gallery sections, in display order. A widget picks one with `category` in widget.json. */
export const CATEGORIES = {
	fun: {
		title: 'Fun and effects',
		description: 'Small delights that give a page some personality.',
	},
	reading: {
		title: 'Reading tools',
		description: 'Help visitors get through long articles.',
	},
	utility: {
		title: 'Site utilities',
		description: 'Practical things most sites end up needing.',
	},
	ai: {
		title: 'On-device AI',
		description: 'Built on Chrome\'s built-in AI. No API key, no server, nothing leaves the device.',
	},
};

const escapeHtml = ( text ) =>
	String( text ).replace( /[&<>"]/g, ( char ) => ( { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ char ] ) );

const formatSize = ( bytes ) => `${ ( bytes / 1024 ).toFixed( 1 ) } KB`;

/**
 * Reads and validates every `widgets/<slug>/widget.json`.
 *
 * @param {boolean} includeTemplate Whether to include `widgets/_template`.
 * @return {Promise<Object[]>} Widget metadata, sorted by name.
 */
async function loadWidgets( includeTemplate ) {
	const dir = path.join( ROOT, 'widgets' );
	const slugs = ( await readdir( dir, { withFileTypes: true } ) )
		.filter( ( entry ) => entry.isDirectory() )
		.map( ( entry ) => entry.name )
		.filter( ( slug ) => ! slug.startsWith( '_' ) || ( includeTemplate && slug === '_template' ) );

	const widgets = [];
	for ( const slug of slugs ) {
		const source = path.join( dir, slug );
		const meta = JSON.parse( await readFile( path.join( source, 'widget.json' ), 'utf8' ) );
		const fail = ( message ) => {
			throw new Error( `widgets/${ slug }/widget.json: ${ message }` );
		};

		for ( const key of [ 'name', 'description', 'category', 'file', 'snippet' ] ) {
			if ( typeof meta[ key ] !== 'string' || ! meta[ key ] ) {
				fail( `"${ key }" is required` );
			}
		}
		if ( ! CATEGORIES[ meta.category ] ) {
			fail( `"category" must be one of ${ Object.keys( CATEGORIES ).join( ', ' ) }` );
		}
		if ( ! /^[a-z0-9-]+$/.test( meta.file ) ) {
			fail( '"file" must be lowercase letters, numbers and dashes' );
		}
		if ( ! meta.snippet.includes( ` src="${ meta.file }.min.js"` ) || ! meta.snippet.endsWith( '></script>' ) ) {
			fail( `"snippet" must be a <script src="${ meta.file }.min.js" ...></script> tag` );
		}
		if ( widgets.some( ( other ) => other.file === meta.file ) ) {
			fail( `"file" ${ meta.file } is already used by another widget` );
		}
		for ( const required of [ 'widget.js', 'demo.html' ] ) {
			if ( ! existsSync( path.join( source, required ) ) ) {
				throw new Error( `widgets/${ slug }/${ required } is missing` );
			}
		}
		widgets.push( { ...meta, slug, source } );
	}
	return widgets.sort( ( a, b ) => a.name.localeCompare( b.name ) );
}

/**
 * Bundles and minifies one widget, and enforces its size budget.
 *
 * @param {Object} widget Widget metadata. Gains `code`, `bytes` and `gzipBytes`.
 */
async function buildWidget( widget ) {
	const outfile = path.join( SITE, `${ widget.file }.min.js` );
	await build( {
		entryPoints: [ path.join( widget.source, 'widget.js' ) ],
		outfile,
		bundle: true,
		minify: true,
		format: 'iife',
		target: 'es2022',
		legalComments: 'none',
		logLevel: 'warning',
	} );
	widget.code = ( await readFile( outfile, 'utf8' ) ).trim();
	widget.bytes = Buffer.byteLength( widget.code );
	widget.gzipBytes = gzipSync( widget.code ).length;

	if ( widget.maxBytes && widget.bytes > widget.maxBytes ) {
		throw new Error( `${ widget.file }.min.js is ${ widget.bytes } bytes, over its ${ widget.maxBytes } byte budget` );
	}
}

/**
 * Writes a widget's demo page to `site/demos/<slug>/index.html`, along with
 * anything in its `assets/` directory.
 *
 * @param {Object} widget  Widget metadata.
 * @param {string} article Sample article that replaces `<!-- demo:article -->`.
 */
async function buildDemo( widget, article ) {
	const out = path.join( SITE, 'demos', widget.slug );
	await mkdir( out, { recursive: true } );

	let html = ( await readFile( path.join( widget.source, 'demo.html' ), 'utf8' ) )
		.replaceAll( '<!-- demo:article -->', article )
		// Demos reference the script exactly as the snippet does. It is built two levels up.
		.replaceAll( `src="${ widget.file }.min.js"`, `src="../../${ widget.file }.min.js"` );

	// A demo is a body fragment unless it needs control of <head>, eg. to load its script there.
	if ( ! /^\s*<!doctype/i.test( html ) ) {
		html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${ escapeHtml( widget.name ) } demo</title>
<style>${ await readFile( path.join( ROOT, 'gallery/demo.css' ), 'utf8' ) }</style>
</head>
<body>
${ html }
</body>
</html>
`;
	}
	await writeFile( path.join( out, 'index.html' ), html );

	const assets = path.join( widget.source, 'assets' );
	if ( existsSync( assets ) ) {
		await cp( assets, out, { recursive: true } );
	}
}

/** The snippet with its `src` pointing at the hosted file. */
const hostedSnippet = ( widget ) =>
	widget.snippet.replace( ` src="${ widget.file }.min.js"`, ` src="${ SITE_URL }${ widget.file }.min.js"` );

/** The snippet with the minified code inline, so the paste makes no extra request. */
const inlineSnippet = ( widget ) =>
	widget.snippet
		.replace( ` src="${ widget.file }.min.js"`, '' )
		// A replacer function, so "$" sequences in the code are not read as patterns.
		.replace( /><\/script>$/, () => `>${ widget.code }</script>` );

function renderCard( widget ) {
	const links = [
		`<a href="demos/${ widget.slug }/">Open demo</a>`,
		`<a href="${ REPO_URL }/tree/main/widgets/${ widget.slug }">Docs and source</a>`,
		widget.issue && `<a href="${ REPO_URL }/issues/${ widget.issue }">Issue #${ widget.issue }</a>`,
	].filter( Boolean );

	return `<article class="card" id="${ widget.slug }">
	<header>
		<h3><a href="#${ widget.slug }">${ escapeHtml( widget.name ) }</a></h3>
		<span class="size" title="${ widget.bytes } bytes minified, ${ widget.gzipBytes } gzipped">${ formatSize( widget.bytes ) }</span>
	</header>
	<p>${ escapeHtml( widget.description ) }</p>
	${ widget.requires ? `<p class="requires">Requires ${ escapeHtml( widget.requires ) }.</p>` : '' }
	<iframe src="demos/${ widget.slug }/" title="${ escapeHtml( widget.name ) } live demo" loading="lazy" style="height:${ Number( widget.demoHeight ) || 280 }px" allow="geolocation; midi; accelerometer; gyroscope; autoplay; clipboard-write"></iframe>
	<pre><code>${ escapeHtml( hostedSnippet( widget ) ) }</code></pre>
	<div class="actions">
		<button type="button" data-copy="snippet" data-widget="${ widget.slug }">Copy snippet</button>
		<button type="button" data-copy="inline" data-widget="${ widget.slug }" title="The whole widget in one script tag, with nothing loaded from another server">Copy inline JS</button>
		<span class="links">${ links.join( ' · ' ) }</span>
	</div>
</article>`;
}

async function buildGallery( widgets ) {
	const sections = Object.entries( CATEGORIES )
		.map( ( [ id, category ] ) => ( { id, ...category, widgets: widgets.filter( ( widget ) => widget.category === id ) } ) )
		.filter( ( section ) => section.widgets.length );

	const nav = sections
		.map(
			( section ) => `<li><a href="#${ section.id }">${ escapeHtml( section.title ) }</a>
			<ul>${ section.widgets.map( ( widget ) => `<li><a href="#${ widget.slug }">${ escapeHtml( widget.name ) }</a></li>` ).join( '' ) }</ul></li>`
		)
		.join( '\n' );

	const main = sections
		.map(
			( section ) => `<section id="${ section.id }">
	<h2>${ escapeHtml( section.title ) }</h2>
	<p class="lede">${ escapeHtml( section.description ) }</p>
	<div class="cards">
${ section.widgets.map( renderCard ).join( '\n' ) }
	</div>
</section>`
		)
		.join( '\n' );

	// What the copy buttons write to the clipboard, keyed by widget slug.
	const snippets = Object.fromEntries(
		widgets.map( ( widget ) => [ widget.slug, { snippet: hostedSnippet( widget ), inline: inlineSnippet( widget ) } ] )
	);

	const read = ( file ) => readFile( path.join( ROOT, 'gallery', file ), 'utf8' );
	const parts = {
		style: `<style>${ await read( 'gallery.css' ) }</style>`,
		nav,
		main: main || '<p>No widgets yet.</p>',
		count: `${ widgets.length } standalone JavaScript widget${ widgets.length === 1 ? '' : 's' }`,
		// "<" is escaped so widget code cannot close the JSON script element early.
		script: `<script type="application/json" id="snippets">${ JSON.stringify( snippets ).replaceAll( '<', '\\u003c' ) }</script>
<script>${ await read( 'gallery.js' ) }</script>`,
	};
	// A replacer function, so "$" sequences in widget code are not read as patterns.
	const html = ( await read( 'index.html' ) ).replace( /<!-- gallery:(\w+) -->/g, ( match, part ) => parts[ part ] ?? match );
	await writeFile( path.join( SITE, 'index.html' ), html );
}

/**
 * Rewrites the widget list between the `widgets:start` and `widgets:end`
 * markers in README.md. CI runs this on `main`, so pull requests never touch
 * the list and cannot conflict over it.
 */
async function updateReadme( widgets ) {
	const file = path.join( ROOT, 'README.md' );
	const readme = await readFile( file, 'utf8' );

	const list = Object.entries( CATEGORIES )
		.map( ( [ id, category ] ) => {
			const rows = widgets
				.filter( ( widget ) => widget.category === id )
				.map(
					( widget ) =>
						`| [${ widget.name }](widgets/${ widget.slug }) | ${ widget.description.replaceAll( '|', '\\|' ) } | ${ formatSize( widget.bytes ) } | [Live demo](${ SITE_URL }#${ widget.slug }) |`
				);
			return rows.length
				? `### ${ category.title }\n\n${ category.description }\n\n| Widget | What it does | Size | Try it |\n| --- | --- | --- | --- |\n${ rows.join( '\n' ) }`
				: '';
		} )
		.filter( Boolean )
		.join( '\n\n' );

	const updated = readme.replace(
		/(<!-- widgets:start -->)[\s\S]*(<!-- widgets:end -->)/,
		( match, start, end ) => `${ start }\n${ list || '_No widgets yet._' }\n${ end }`
	);
	if ( updated !== readme ) {
		await writeFile( file, updated );
	}
}

/**
 * Like `Promise.all`, but waits for every job before failing. A rebuild that
 * starts right after a failure would otherwise race the jobs still writing.
 *
 * @param {Promise[]} jobs Jobs to wait for.
 */
async function all( jobs ) {
	const failed = ( await Promise.allSettled( jobs ) ).find( ( job ) => job.status === 'rejected' );
	if ( failed ) {
		throw failed.reason;
	}
}

export async function buildAll( { readme = false, template = false } = {} ) {
	const widgets = await loadWidgets( template );
	const article = await readFile( path.join( ROOT, 'gallery/demo-article.html' ), 'utf8' );

	await rm( SITE, { recursive: true, force: true } );
	await mkdir( SITE, { recursive: true } );
	await all( widgets.map( buildWidget ) );
	await all( widgets.map( ( widget ) => buildDemo( widget, article ) ) );
	await buildGallery( widgets );
	await writeFile(
		path.join( SITE, 'widgets.json' ),
		JSON.stringify( widgets.map( ( { code, source, ...widget } ) => widget ), null, '\t' )
	);
	if ( readme ) {
		await updateReadme( widgets );
	}
	return widgets;
}

if ( process.argv[ 1 ] === fileURLToPath( import.meta.url ) ) {
	const widgets = await buildAll( {
		readme: process.argv.includes( '--readme' ),
		template: process.argv.includes( '--template' ),
	} );
	for ( const widget of widgets ) {
		const budget = widget.maxBytes ? ` (budget ${ widget.maxBytes })` : '';
		console.log( `${ `${ widget.file }.min.js`.padEnd( 24 ) } ${ String( widget.bytes ).padStart( 6 ) } bytes${ budget }, ${ widget.gzipBytes } gzipped` );
	}
	console.log( `Built ${ widgets.length } widget(s) into site/` );
}
