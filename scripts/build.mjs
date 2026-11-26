/**
 * Builds every widget and the gallery site into `site/`.
 *
 *   site/<file>.min.js          Minified widget, the file users copy or link to.
 *   site/demos/<slug>/          Live demo page, shown in an iframe by the gallery.
 *   site/index.html             The gallery.
 *   site/posters/<slug>.png     Screenshots for the README, added by `scripts/posters.mjs`.
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
 * @param {string} options Script tag that applies option overrides, added to `<head>`.
 */
async function buildDemo( widget, article, options ) {
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
${ options }
<style>${ await readFile( path.join( ROOT, 'gallery/demo.css' ), 'utf8' ) }</style>
</head>
<body>
${ html }
</body>
</html>
`;
	} else {
		html = html.replace( /<head[^>]*>/i, ( head ) => `${ head }\n${ options }` );
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

/**
 * The snippet's options, which the gallery shows as editable values.
 *
 * @param {Object} widget Widget metadata.
 * @return {{name: string, value: string}[]} Every attribute of the script tag except `src`.
 */
const snippetAttributes = ( widget ) =>
	[ ...widget.snippet.matchAll( /\s([\w-]+)="([^"]*)"/g ) ]
		.map( ( [ , name, value ] ) => ( { name, value } ) )
		.filter( ( { name } ) => name !== 'src' );

/** Widgets grouped by category, in the order the gallery and the README list them. */
const groupByCategory = ( widgets ) =>
	Object.entries( CATEGORIES )
		.map( ( [ id, category ] ) => ( { id, ...category, widgets: widgets.filter( ( widget ) => widget.category === id ) } ) )
		.filter( ( section ) => section.widgets.length );

async function buildGallery( widgets ) {
	const sections = groupByCategory( widgets );

	const nav = sections
		.map(
			( section ) => `<section>
	<h2>${ escapeHtml( section.title ) }${ section.id === 'ai' ? ' <small>Chrome desktop</small>' : '' }</h2>
	<ul>${ section.widgets
		.map( ( widget ) => `<li><a href="#${ widget.slug }">${ escapeHtml( widget.name ) } <span>${ formatSize( widget.bytes ) }</span></a></li>` )
		.join( '' ) }</ul>
</section>`
		)
		.join( '\n' );

	// In rail order, so Previous and Next follow it. The code itself is fetched on demand.
	const data = {
		siteUrl: SITE_URL,
		repoUrl: REPO_URL,
		widgets: sections
			.flatMap( ( section ) => section.widgets )
			.map( ( { code, source, snippet, ...widget } ) => ( { ...widget, attrs: snippetAttributes( { snippet } ) } ) ),
	};

	const read = ( file ) => readFile( path.join( ROOT, 'gallery', file ), 'utf8' );
	const parts = {
		style: `<style>${ await read( 'gallery.css' ) }</style>`,
		nav,
		count: `${ widgets.length } small script${ widgets.length === 1 ? '' : 's' }`,
		// "<" is escaped so a description cannot close the JSON script element early.
		script: `<script type="application/json" id="widgets">${ JSON.stringify( data ).replaceAll( '<', '\\u003c' ) }</script>
<script>${ await read( 'gallery.js' ) }</script>`,
	};
	// A replacer function, so "$" sequences in the script are not read as patterns.
	const html = ( await read( 'index.html' ) ).replace( /<!-- gallery:(\w+) -->/g, ( match, part ) => parts[ part ] ?? match );
	await writeFile( path.join( SITE, 'index.html' ), html );
}

/**
 * Rewrites the widget list between the `widgets:start` and `widgets:end`
 * markers in README.md. CI runs this on `main`, so pull requests never touch
 * the list and cannot conflict over it.
 *
 * A README cannot run JavaScript, so each widget is a poster (a screenshot
 * published with the gallery, see `scripts/posters.mjs`) linking to its live
 * demo, and the snippets are code blocks, which GitHub gives a copy button.
 */
async function updateReadme( widgets ) {
	const file = path.join( ROOT, 'README.md' );
	const readme = await readFile( file, 'utf8' );
	const perRow = 3;

	const list = groupByCategory( widgets )
		.map( ( section ) => {
			const cells = section.widgets.map(
				( widget ) => `<td width="33%" valign="top">
<a href="${ SITE_URL }#${ widget.slug }"><img src="${ SITE_URL }posters/${ widget.slug }.png" alt="${ escapeHtml( widget.name ) } demo" width="100%"></a><br>
<b><a href="widgets/${ widget.slug }">${ escapeHtml( widget.name ) }</a></b> <sub>${ formatSize( widget.bytes ) }</sub><br>
<sub>${ escapeHtml( widget.description ) }</sub>
</td>`
			);
			const rows = [];
			for ( let i = 0; i < cells.length; i += perRow ) {
				rows.push( `<tr>\n${ cells.slice( i, i + perRow ).join( '\n' ) }\n</tr>` );
			}
			const snippets = section.widgets
				.map( ( widget ) => `**${ widget.name }** &nbsp; [options](widgets/${ widget.slug }#options)\n\n\`\`\`html\n${ hostedSnippet( widget ) }\n\`\`\`` )
				.join( '\n\n' );
			const note =
				section.id === 'ai'
					? '> [!NOTE]\n> These use Chrome\'s built-in AI, so they need a recent desktop Chrome. In other browsers they render nothing and the page works as before.\n\n'
					: '';
			return `### ${ section.title }\n\n${ section.description }\n\n${ note }<table>\n${ rows.join( '\n' ) }\n</table>\n\n<details>\n<summary>Copy a snippet</summary>\n\n${ snippets }\n\n</details>`;
		} )
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
	const options = `<script>${ await readFile( path.join( ROOT, 'gallery/demo-options.js' ), 'utf8' ) }</script>`;

	await rm( SITE, { recursive: true, force: true } );
	await mkdir( SITE, { recursive: true } );
	await all( widgets.map( buildWidget ) );
	await all( widgets.map( ( widget ) => buildDemo( widget, article, options ) ) );
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
