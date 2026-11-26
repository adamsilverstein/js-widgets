/**
 * Hello Widget: greets the visitor where the snippet is pasted.
 *
 * Options (data- attributes on the script tag):
 *   data-name  Who to greet. Default "world".
 */
import { mountInline, options } from '../../shared/embed.js';

const { name } = options( { name: 'world' } );

const root = mountInline( `
	button { font: inherit; padding: 6px 12px; border-radius: 6px; cursor: pointer; }
` );

const button = document.createElement( 'button' );
button.textContent = `Hello, ${ name }`;
button.addEventListener( 'click', () => {
	button.textContent = `Hello again, ${ name }`;
} );
root.append( button );
