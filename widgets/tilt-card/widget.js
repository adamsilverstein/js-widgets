/**
 * Tilt Card: tilts elements toward the pointer, with a shine that moves with
 * the angle. On touch screens the tilt follows the device's orientation.
 *
 * Options (data- attributes on the script tag):
 *   data-target  CSS selector for the elements to tilt. Default ".tilt".
 *   data-max     Largest tilt in degrees. Default 15.
 *   data-shine   "holo", "gloss" or "none". Default "holo".
 */
import { options, ready } from '../../shared/embed.js';

const { target, max, shine } = options( { target: '.tilt', max: '15', shine: 'holo' } );
const maxDeg = Number( max ) || 15;
const motionQuery = matchMedia( '(prefers-reduced-motion: reduce)' );

/** Shine layers, positioned by the `--x` and `--y` properties on the overlay. */
const SHINES = {
	gloss: 'radial-gradient(circle at var(--x) var(--y),#fffa,#fff0 60%)',
	holo:
		'radial-gradient(circle at var(--x) var(--y),#fff9,#fff0 45%),' +
		'linear-gradient(115deg,#0000 15%,#f0a8 30%,#fd08 42%,#0fa8 54%,#0af8 66%,#a0f8 78%,#0000 92%) var(--x) var(--y)/300% 300%',
};

const clamp = ( value ) => Math.max( -1, Math.min( 1, value ) );

/** Every enhanced card, for device orientation and reduced motion changes. */
const cards = [];

/**
 * Enhances one element. Returns a function that sets where it should tilt to,
 * as x and y from -1 to 1, and whether the shine shows.
 *
 * @param {HTMLElement} el Element to tilt.
 * @return {Function} `( x, y, lit ) => void`.
 */
function enhance( el ) {
	// Keep any transform the page already gives the card, after the tilt.
	const base = getComputedStyle( el ).transform.replace( 'none', '' );
	const restingTransform = el.style.transform;
	let overlay;
	if ( SHINES[ shine ] ) {
		// The overlay is positioned against the card, so a static card needs a containing block.
		if ( getComputedStyle( el ).position === 'static' ) {
			el.style.position = 'relative';
		}
		// A custom tag, so page rules for div or span do not reach it.
		overlay = document.createElement( 'jsw-tilt-shine' );
		overlay.ariaHidden = 'true';
		overlay.style.cssText = `position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:0;mix-blend-mode:hard-light;background:${ SHINES[ shine ] }`;
		el.append( overlay );
	}

	const now = { x: 0, y: 0, glow: 0 };
	let goal = now;
	let frame = 0;

	const paint = () => {
		el.style.transform =
			now.x || now.y ? `perspective(800px) rotateX(${ -now.y * maxDeg }deg) rotateY(${ now.x * maxDeg }deg) ${ base }` : restingTransform;
		if ( overlay ) {
			overlay.style.setProperty( '--x', `${ 50 + now.x * 50 }%` );
			overlay.style.setProperty( '--y', `${ 50 + now.y * 50 }%` );
			overlay.style.opacity = now.glow * 0.7;
		}
	};

	// Eases toward the goal each frame, which also gives the ease back to rest.
	const step = () => {
		let moving = false;
		for ( const key in now ) {
			now[ key ] += ( goal[ key ] - now[ key ] ) * 0.15;
			if ( Math.abs( goal[ key ] - now[ key ] ) < 0.001 ) {
				now[ key ] = goal[ key ];
			} else {
				moving = true;
			}
		}
		paint();
		frame = moving ? requestAnimationFrame( step ) : 0;
	};

	const tiltTo = ( x, y, lit ) => {
		if ( motionQuery.matches ) {
			// Reduced motion turns the effect off at once, with no easing.
			cancelAnimationFrame( frame );
			frame = 0;
			Object.assign( now, { x: 0, y: 0, glow: 0 } );
			return paint();
		}
		goal = { x, y, glow: lit ? 1 : 0 };
		frame ||= requestAnimationFrame( step );
	};

	el.addEventListener( 'pointermove', ( event ) => {
		// Touch follows device orientation, so a finger scrolling past does not tilt the card.
		if ( event.pointerType === 'touch' ) {
			return;
		}
		const rect = el.getBoundingClientRect();
		const x = ( ( event.clientX - rect.left ) / rect.width ) * 2 - 1;
		const y = ( ( event.clientY - rect.top ) / rect.height ) * 2 - 1;
		tiltTo( clamp( x ), clamp( y ), true );
	} );
	// Keyboard focus gets a gentle fixed tilt. The pointer wins while it is over the card.
	const rest = () =>
		el.matches( ':focus-visible, :has(:focus-visible)' ) ? tiltTo( -0.3, -0.3, true ) : tiltTo( 0, 0, false );
	el.addEventListener( 'pointerleave', rest );
	el.addEventListener( 'focusin', () => el.matches( ':hover' ) || rest() );
	el.addEventListener( 'focusout', () => el.matches( ':hover' ) || rest() );

	return tiltTo;
}

/**
 * Tilts every card with the device, relative to how it was first held. The
 * resting angle drifts toward the current one, so a change of grip settles.
 */
function followOrientation() {
	let rest;
	addEventListener( 'deviceorientation', ( { beta, gamma } ) => {
		if ( beta === null ) {
			return;
		}
		rest ??= { beta, gamma };
		rest.beta += ( beta - rest.beta ) * 0.02;
		rest.gamma += ( gamma - rest.gamma ) * 0.02;
		// Whole degrees, so sensor noise on a still phone lets the animation settle.
		const x = clamp( Math.round( gamma - rest.gamma ) / 20 );
		const y = clamp( Math.round( beta - rest.beta ) / 20 );
		cards.forEach( ( tiltTo ) => tiltTo( x, y, true ) );
	} );
}

ready( () => {
	for ( const el of document.querySelectorAll( target ) ) {
		cards.push( enhance( el ) );
	}
	motionQuery.addEventListener( 'change', () => cards.forEach( ( tiltTo ) => tiltTo( 0, 0, false ) ) );

	// Never requests permission, so iOS, which needs it, sends no events and the cards stay still.
	if ( cards.length && matchMedia( '(hover: none)' ).matches ) {
		followOrientation();
	}
} );
