// Stages the player mid-read, with the second sentence highlighted in the article.
import { mockSpeech } from './mock-speech.mjs';

// Headless Chromium has no voices, so speech is faked and only moves on when told to.
export const setup = mockSpeech( [ { lang: 'en-US', default: true } ] );

export default async function poster( page ) {
	await page.getByRole( 'button', { name: 'Listen' } ).click();
	// Move past the heading so a sentence in the body text is the one lit up.
	await page.evaluate( () => window.speech.finish() );
	await page.getByRole( 'button', { name: 'Pause' } ).waitFor();
	await page.waitForFunction( () => CSS.highlights.get( 'jsw-listen' )?.size === 1 && window.speech.spoken.length === 2 );
}
