/**
 * `npm test`: runs the shared tests in `test/` and each widget's own
 * `widgets/<slug>/*.test.mjs` with Node's test runner.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '..' );
const testsIn = ( dir ) =>
	readdirSync( path.join( root, dir ) )
		.filter( ( file ) => file.endsWith( '.test.mjs' ) )
		.map( ( file ) => path.join( dir, file ) );

const files = [
	...testsIn( 'test' ),
	...readdirSync( path.join( root, 'widgets' ) )
		.filter( ( slug ) => ! slug.startsWith( '_' ) )
		.flatMap( ( slug ) => testsIn( path.join( 'widgets', slug ) ) ),
];

const { status } = spawnSync( process.execPath, [ '--test', ...files ], { cwd: root, stdio: 'inherit' } );
process.exit( status ?? 1 );
