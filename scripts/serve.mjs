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
			if ( ! file.startsWith( root ) ) {
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
				response.writeHead( 206, {
					...headers,
					'Content-Range': `bytes ${ start }-${ end }/${ info.size }`,
					'Content-Length': end - start + 1,
				} );
				createReadStream( file, { start, end } ).pipe( response );
				return;
			}
			response.writeHead( 200, { ...headers, 'Content-Length': info.size } );
			createReadStream( file ).pipe( response );
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
