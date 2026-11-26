/**
 * Embed helpers shared by every widget. esbuild bundles only the helpers a
 * widget imports, so unused ones cost no bytes.
 */

/** The `<script>` tag that loaded the widget. Only readable while the script first runs. */
export const script = document.currentScript;

/**
 * Reads the widget's options from the script tag's `data-` attributes.
 *
 * @param {Object<string, string>} defaults Values used for attributes that are not set.
 * @return {Object<string, string>} Options, always strings, as `dataset` returns them.
 */
export const options = ( defaults = {} ) => ( { ...defaults, ...script?.dataset } );

/** Whether the visitor asked for reduced motion. */
export const reducedMotion = () =>
	matchMedia( '(prefers-reduced-motion: reduce)' ).matches;

/**
 * Runs `fn` once the document is parsed. Widgets that enhance existing markup
 * or attach to `<body>` need this, since the snippet may sit in `<head>`.
 *
 * @param {Function} fn Callback.
 */
export function ready( fn ) {
	if ( document.readyState === 'loading' ) {
		addEventListener( 'DOMContentLoaded', fn, { once: true } );
	} else {
		fn();
	}
}

/**
 * Creates a host element with an open shadow root, so widget and page styles
 * cannot leak into each other.
 *
 * @param {string} css Styles for the shadow root.
 * @return {HTMLElement} The host. Its content goes in `host.shadowRoot`.
 */
export function createHost( css ) {
	const host = document.createElement( 'div' );
	host.attachShadow( { mode: 'open' } ).innerHTML = `<style>${ css }</style>`;
	return host;
}

/**
 * Renders a widget where its snippet was pasted.
 *
 * @param {string} css Styles for the shadow root.
 * @return {ShadowRoot} Root to render into.
 */
export function mountInline( css ) {
	const host = createHost( css );
	script.after( host );
	return host.shadowRoot;
}

/**
 * Renders a floating widget in a corner of the viewport. Widgets sharing a
 * corner stack in one container instead of covering each other. Call it inside
 * `ready()`, since it needs `<body>`.
 *
 * @param {string} css        Styles for the shadow root.
 * @param {string} [position] `top-left`, `top-right`, `bottom-left` or `bottom-right` (the default,
 *                            also used for any other value).
 * @return {ShadowRoot} Root to render into.
 */
export function mountCorner( css, position ) {
	// The value comes from a data- attribute, and an unknown one would leave the widget unplaced.
	if ( ! /^(top|bottom)-(left|right)$/.test( position ) ) {
		position = 'bottom-right';
	}
	const [ y, x ] = position.split( '-' );
	let stack = document.querySelector( `[data-jsw-corner="${ position }"]` );
	if ( ! stack ) {
		stack = document.createElement( 'div' );
		stack.dataset.jswCorner = position;
		// The stack ignores the pointer so only the widgets in it catch clicks.
		stack.style.cssText = `position:fixed;${ y }:16px;${ x }:16px;z-index:2147483000;display:flex;flex-direction:column${
			y === 'bottom' ? '-reverse' : ''
		};align-items:${
			x === 'left' ? 'start' : 'end'
		};gap:12px;pointer-events:none`;
		document.body.append( stack );
	}
	const host = createHost( css );
	host.style.pointerEvents = 'auto';
	stack.append( host );
	return host.shadowRoot;
}
