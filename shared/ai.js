/**
 * Helpers for Chrome's built-in, on-device AI APIs (`Summarizer`, `Translator`,
 * `LanguageDetector`, `LanguageModel`, ...). They all share the same
 * `availability()` and `create()` shape.
 *
 * @see https://developer.chrome.com/docs/ai/built-in-apis
 */

/**
 * Checks whether a built-in AI API can be used on this device.
 *
 * @param {string} api       Global class name, eg. `'Summarizer'`.
 * @param {Object} [options] The same options later passed to `create()`.
 * @return {Promise<string>} `unavailable`, `downloadable`, `downloading` or `available`.
 */
export async function availability( api, options ) {
	try {
		return api in self ? await self[ api ].availability( options ) : 'unavailable';
	} catch {
		return 'unavailable';
	}
}

/**
 * Creates a session, reporting model download progress. Call it from a click
 * handler: a download can only start after a user gesture.
 *
 * @param {string}   api          Global class name, eg. `'Summarizer'`.
 * @param {Object}   [options]    API options. Pass `signal` to let the visitor abandon a download.
 * @param {Function} [onProgress] Called with the downloaded fraction, 0 to 1.
 * @return {Promise<Object>} The session.
 */
export const create = ( api, options, onProgress ) =>
	self[ api ].create( {
		...options,
		monitor( monitor ) {
			monitor.addEventListener( 'downloadprogress', ( event ) =>
				onProgress?.( event.loaded )
			);
		},
	} );
