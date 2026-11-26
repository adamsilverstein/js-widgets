/**
 * A minimal static file server for the built site, used by `npm run dev` and
 * the tests. It answers range requests so demo videos can seek.
 */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';

const TYPES = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.json': 'application/json',
	'.css': 'text/css',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.webp': 'image/webp',
	'.mp4': 'video/mp4',
	'.webm': 'video/webm',
	'.vtt': 'text/vtt',
	'.mp3': 'audio/mpeg',
};

/**
 * Streams a file into a response whose headers are already sent. A rebuild can
 * delete the file between `stat()` and the read, so a failed read drops the
 * response instead of crashing the server.
 *
 * @param {string}                         file     Path to the file.
 * @param {import('node:http').ServerResponse} response Response to write to.
 * @param {Object}                         [range]  `start` and `end` byte offsets.
 */
function send( file, response, range ) {
	createReadStream( file, range )
		.on( 'error', () => response.destroy() )
		.pipe( response );
}

/**
 * Serves a directory over HTTP.
 *
 * @param {string} dir    Directory to serve.
 * @param {number} [port] Port to listen on. 0 picks a free one.
 * @return {Promise<{url: string, close: Function}>} The server's address and a way to stop it.
 */
export function serve( dir, port = 0 ) {
	const root = path.resolve( dir );
	const server = createServer( async ( request, response ) => {
		try {
			const { pathname } = new URL( request.url, 'http://localhost' );
			let file = path.join( root, decodeURIComponent( pathname ) );
			// Compare whole path segments, so a sibling like "site-private" is not let through.
			if ( file !== root && ! file.startsWith( root + path.sep ) ) {
				throw new Error( 'Outside root' );
			}
			let info = await stat( file );
			if ( info.isDirectory() ) {
				file = path.join( file, 'index.html' );
				info = await stat( file );
			}

			const headers = {
				'Content-Type': TYPES[ path.extname( file ) ] || 'application/octet-stream',
				'Accept-Ranges': 'bytes',
				'Cache-Control': 'no-store',
			};
			const range = /^bytes=(\d*)-(\d*)$/.exec( request.headers.range || '' );
			if ( range && ( range[ 1 ] || range[ 2 ] ) ) {
				// "bytes=-N" asks for the last N bytes.
				const start = range[ 1 ] ? Number( range[ 1 ] ) : Math.max( 0, info.size - Number( range[ 2 ] ) );
				const end = range[ 1 ] && range[ 2 ] ? Math.min( Number( range[ 2 ] ), info.size - 1 ) : info.size - 1;
				if ( start > end ) {
					response.writeHead( 416, { 'Content-Range': `bytes */${ info.size }` } ).end();
					return;
				}
				response.writeHead( 206, {
					...headers,
					'Content-Range': `bytes ${ start }-${ end }/${ info.size }`,
					'Content-Length': end - start + 1,
				} );
				send( file, response, { start, end } );
				return;
			}
			response.writeHead( 200, { ...headers, 'Content-Length': info.size } );
			send( file, response );
		} catch {
			response.writeHead( 404, { 'Content-Type': 'text/plain' } ).end( 'Not found' );
		}
	} );

	return new Promise( ( resolve ) => {
		server.listen( port, '127.0.0.1', () => {
			resolve( {
				url: `http://127.0.0.1:${ server.address().port }/`,
				close: () =>
					new Promise( ( done ) => {
						server.close( done );
						// Keep-alive connections would otherwise hold close() open.
						server.closeAllConnections();
					} ),
			} );
		} );
	} );
}
