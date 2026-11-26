/**
 * Replaces speechSynthesis with a fake that records what is spoken, since
 * headless Chromium has no voices. `window.speech.finish()` ends the current
 * utterance, as if it had been read to the end.
 *
 * @param {Object[]} voices Voices to report, eg. `[ { lang: 'en-US', default: true } ]`.
 */
export const mockSpeech = ( voices ) => ( page ) =>
	page.addInitScript( ( list ) => {
		const speech = {
			spoken: [],
			cancels: 0,
			current: null,
			finish() {
				const utterance = speech.current;
				speech.current = null;
				utterance?.onend?.();
			},
		};
		window.speech = speech;
		window.SpeechSynthesisUtterance = class {
			constructor( text ) {
				this.text = text;
			}
		};
		Object.defineProperty( window, 'speechSynthesis', {
			configurable: true,
			value: {
				getVoices: () => list.map( ( voice ) => ( { name: voice.lang, localService: true, default: false, ...voice } ) ),
				addEventListener() {},
				speak( utterance ) {
					speech.current = utterance;
					speech.spoken.push( utterance );
					utterance.onstart?.();
				},
				cancel() {
					speech.cancels++;
					const utterance = speech.current;
					speech.current = null;
					// Chrome reports a cancelled utterance as an "interrupted" error.
					utterance?.onerror?.( { error: 'interrupted' } );
				},
			},
		} );
	}, voices );
