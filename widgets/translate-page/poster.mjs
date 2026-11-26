// Stages the picker with the article's heading and opening paragraph translated into Spanish.

// Spanish for the text in view. Anything else is returned as is.
const SPANISH = {
	'A short history of the sidebar widget': 'Una breve historia del widget de la barra lateral',
	'Long before anyone said "component", websites had widgets. A hit counter in the footer, a guestbook link, a clock that followed the mouse. They were small, a little silly, and you added one by pasting a few lines of code somebody else had written. That last part was the magic: you did not need to understand the code, only where to put it.':
		'Mucho antes de que alguien dijera "componente", los sitios web tenían widgets. Un contador de visitas en el pie de página, un enlace al libro de visitas, un reloj que seguía al ratón. Eran pequeños, un poco tontos, y se añadían pegando unas pocas líneas de código que otra persona había escrito. Eso último era la magia: no hacía falta entender el código, solo saber dónde ponerlo.',
	'The copy and paste years': 'Los años de copiar y pegar',
};

export async function setup( page ) {
	await page.addInitScript( ( spanish ) => {
		self.Translator = {
			availability: async () => 'available',
			create: async () => ( { translate: async ( text ) => spanish[ text ] ?? text } ),
		};
		self.LanguageDetector = {
			availability: async () => 'available',
			create: async () => ( { detect: async () => [ { detectedLanguage: 'en', confidence: 1 } ] } ),
		};
	}, SPANISH );
}

export default async function poster( page ) {
	const select = page.getByLabel( 'Translate to' );
	await select.selectOption( 'es' );
	await page.getByRole( 'button', { name: 'Translate', exact: true } ).click();
	await page.getByText( 'Translated to español on this device.' ).waitFor();
	// Put the picker near the top of the frame, nudged so the bottom edge falls between lines of text.
	await select.evaluate( ( element ) => {
		const range = document.createRange();
		range.selectNodeContents( document.querySelector( 'article p' ).firstChild );
		const lines = [ ...range.getClientRects() ].map( ( rect ) => [ rect.top + scrollY, rect.bottom + scrollY ] );
		const top = element.getRootNode().host.getBoundingClientRect().top + scrollY;
		let gap = 8;
		const cuts = ( bottom ) => lines.some( ( [ from, to ] ) => bottom > from - 2 && bottom < to + 2 );
		while ( gap < 40 && cuts( top - gap + innerHeight ) ) {
			gap++;
		}
		scrollTo( 0, top - gap );
	} );
}
