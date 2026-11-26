/**
 * Dark Mode Toggle: a sun/moon button that switches the page between light
 * and dark, with a circular reveal spreading out from the button.
 *
 * Sets `data-theme="light|dark"` and `color-scheme` on `<html>`. Place the
 * snippet in `<head>` so the theme is set before the page paints.
 *
 * Options (data- attributes on the script tag):
 *   data-position  Corner for the button. Default "top-right".
 */
import { mountCorner, options, ready, reducedMotion } from '../../shared/embed.js';

const KEY = 'jsw-theme';
const html = document.documentElement;
const system = matchMedia( '(prefers-color-scheme: dark)' );
const { position } = options( { position: 'top-right' } );

const systemTheme = () => ( system.matches ? 'dark' : 'light' );

/** Returns the visitor's stored choice, or null when they follow the system. */
function stored() {
	try {
		const theme = localStorage.getItem( KEY );
		return theme === 'light' || theme === 'dark' ? theme : null;
	} catch {
		// Storage can be blocked. The toggle still works for this page view.
		return null;
	}
}

let button;

/**
 * Applies a theme to the page and the button.
 *
 * @param {string} theme `light` or `dark`.
 */
function apply( theme ) {
	html.dataset.theme = theme;
	// Inline, so it wins over a `color-scheme: light dark` in the site's CSS.
	html.style.colorScheme = theme;
	button?.setAttribute( 'aria-pressed', theme === 'dark' );
}

apply( stored() ?? systemTheme() );

/**
 * Saves a choice. Choosing the system's own theme clears the stored value, so
 * the page follows the system again instead of pinning that theme.
 *
 * @param {string} theme `light` or `dark`.
 */
function save( theme ) {
	try {
		if ( theme === systemTheme() ) {
			localStorage.removeItem( KEY );
		} else {
			localStorage.setItem( KEY, theme );
		}
	} catch {}
}

/** Switches to the other theme, with a circular reveal from the button when motion is allowed. */
function toggle() {
	const theme = html.dataset.theme === 'dark' ? 'light' : 'dark';
	save( theme );

	if ( ! document.startViewTransition || reducedMotion() ) {
		apply( theme );
		return;
	}

	const { left, top, width, height } = button.getBoundingClientRect();
	const x = left + width / 2;
	const y = top + height / 2;
	const radius = Math.hypot( Math.max( x, innerWidth - x ), Math.max( y, innerHeight - y ) );

	// Replaces the default cross-fade for this transition only, so the site's own view transitions keep theirs.
	const style = document.head.appendChild( document.createElement( 'style' ) );
	style.textContent = '::view-transition-old(root),::view-transition-new(root){animation:none;mix-blend-mode:normal}';

	const transition = document.startViewTransition( () => apply( theme ) );
	transition.ready
		.then( () =>
			html.animate(
				{ clipPath: [ `circle(0 at ${ x }px ${ y }px)`, `circle(${ radius }px at ${ x }px ${ y }px)` ] },
				{ duration: 500, easing: 'ease-in-out', pseudoElement: '::view-transition-new(root)' }
			)
		)
		// A transition is skipped when another starts. The theme is applied either way.
		.catch( () => {} );
	transition.finished.then( () => style.remove(), () => style.remove() );
}

// Follow the system while the visitor has not chosen a theme.
system.addEventListener( 'change', () => stored() || apply( systemTheme() ) );

// Follow a choice made in another tab.
addEventListener( 'storage', ( event ) => {
	if ( event.key === KEY || event.key === null ) {
		apply( stored() ?? systemTheme() );
	}
} );

ready( () => {
	const root = mountCorner(
		`button{display:grid;place-items:center;width:44px;height:44px;padding:0;border:1px solid color-mix(in srgb,CanvasText 25%,transparent);border-radius:50%;background:Canvas;color:CanvasText;box-shadow:0 2px 8px rgb(0 0 0/.2);cursor:pointer}
button:focus-visible{outline:3px solid Highlight;outline-offset:2px}
svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}
[aria-pressed=true] .sun,[aria-pressed=false] .moon{display:none}`,
		position
	);
	root.innerHTML += `<button type="button" aria-label="Dark mode">
<svg class="sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
<svg class="moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
</button>`;
	button = root.querySelector( 'button' );
	button.addEventListener( 'click', toggle );
	apply( html.dataset.theme );
} );
