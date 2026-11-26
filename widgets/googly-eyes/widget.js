/**
 * Googly Eyes: a pair of eyes, rendered where the snippet is pasted, that
 * follows the pointer, blinks, and goes wide on click.
 *
 * Options (data- attributes on the script tag):
 *   data-size   Diameter of each eye in pixels. Default 64.
 *   data-color  Pupil and outline color. Default #222.
 */
import { mountInline, options, reducedMotion } from '../../shared/embed.js';

const { size, color } = options( { size: '64', color: '#222' } );

const root = mountInline( `
:host{display:inline-block;--s:${ Number( size ) || 64 }px}
p{display:flex;gap:calc(var(--s)/8);margin:0;padding:4px}
i{display:grid;place-items:center;box-sizing:border-box;width:var(--s);height:var(--s);border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff 55%,#ddd);border:calc(var(--s)/20) solid var(--c)}
b{width:40%;height:40%;border-radius:50%;background:radial-gradient(circle at 30% 30%,#fff 12%,var(--c) 14%)}
.w i{scale:1.2}
@media (prefers-reduced-motion:no-preference){i{transition:scale .15s}b{transition:translate .12s ease-out}}
` );

const wrap = document.createElement( 'p' );
// Decoration only, so assistive technology skips it.
wrap.setAttribute( 'aria-hidden', 'true' );
wrap.style.setProperty( '--c', color );
wrap.innerHTML = '<i><b></b></i><i><b></b></i>';
root.append( wrap );

const eyes = [ ...wrap.children ];
let target, frame, idle, wide;

/** Points both pupils at `target`, a viewport point, as far as each eye allows. */
function render() {
	frame = 0;
	if ( ! target ) {
		return;
	}
	for ( const eye of eyes ) {
		const { left, top, width } = eye.getBoundingClientRect();
		const dx = target[ 0 ] - left - width / 2;
		const dy = target[ 1 ] - top - width / 2;
		// 0.27 of the eye keeps the pupil just inside the rim.
		const k = Math.min( 1, ( width * 0.27 ) / ( Math.hypot( dx, dy ) || 1 ) );
		eye.firstChild.style.translate = `${ dx * k }px ${ dy * k }px`;
	}
}

/**
 * Looks at a viewport point on the next frame, and restarts the idle timer.
 *
 * @param {number} x Viewport x.
 * @param {number} y Viewport y.
 */
function look( x, y ) {
	target = [ x, y ];
	frame ||= requestAnimationFrame( render );
	clearTimeout( idle );
	idle = setTimeout( wander, 3000 + Math.random() * 2000 );
}

/** Glances at a random point after a few idle seconds, unless motion is reduced. */
function wander() {
	if ( ! reducedMotion() ) {
		look( Math.random() * innerWidth, Math.random() * innerHeight );
	}
}

/** Blinks every two to six seconds, unless motion is reduced. */
function blink() {
	setTimeout( () => {
		if ( ! reducedMotion() ) {
			for ( const eye of eyes ) {
				eye.animate( [ {}, { transform: 'scaleY(.1)' }, {} ], 150 );
			}
		}
		blink();
	}, 2000 + Math.random() * 4000 );
}

// Pointer events cover mouse, pen and touch. A touch only sends pointermove
// until the page starts scrolling, so pointerdown catches each new touch point.
const onPointer = ( event ) => look( event.clientX, event.clientY );
addEventListener( 'pointermove', onPointer, { passive: true } );
addEventListener( 'pointerdown', ( event ) => {
	onPointer( event );
	wrap.className = 'w';
	clearTimeout( wide );
	wide = setTimeout( () => ( wrap.className = '' ), 400 );
} );
// The eyes move when the page scrolls, so re-aim them at the same point.
addEventListener( 'scroll', () => ( frame ||= requestAnimationFrame( render ) ), { passive: true, capture: true } );

blink();
idle = setTimeout( wander, 3000 );
