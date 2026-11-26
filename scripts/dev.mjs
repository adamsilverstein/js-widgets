/**
 * `npm run dev`: builds the site, serves it, and rebuilds when a source file
 * changes. Set PORT to change the port (default 8080).
 */
import { watch } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildAll } from './build.mjs';
import { serve } from './serve.mjs';

const root = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '..' );
const template = process.argv.includes( '--template' );

let building = false;
let queued = false;
async function rebuild() {
	if ( building ) {
		queued = true;
		return;
	}
	building = true;
	try {
		await buildAll( { template } );
		console.log( `Built at ${ new Date().toLocaleTimeString() }` );
	} catch ( error ) {
		console.error( error.message );
	}
	building = false;
	if ( queued ) {
		queued = false;
		rebuild();
	}
}

await rebuild();
const { url } = await serve( path.join( root, 'site' ), Number( process.env.PORT ) || 8080 );
console.log( `Gallery: ${ url }` );

for ( const dir of [ 'widgets', 'shared', 'gallery' ] ) {
	watch( path.join( root, dir ), { recursive: true }, rebuild );
}
