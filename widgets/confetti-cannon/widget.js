/**
 * Confetti Cannon: fires a burst of confetti from a clicked element, or from
 * the bottom center of the screen on a `jsw:confetti` event.
 *
 * Options (data- attributes on the script tag):
 *   data-trigger  CSS selector for the elements that fire confetti when clicked.
 *   data-colors   Comma separated CSS colors. Default "#f60,#09f,#fc0,#e3c,#3c6".
 */
import { options, reducedMotion } from '../../shared/embed.js';

const { trigger, colors } = options( { colors: '#f60,#09f,#fc0,#e3c,#3c6' } );
const palette = colors.split( ',' ).map( ( color ) => color.trim() );

const PER_BURST = 120;
// Rapid bursts replace the oldest pieces instead of piling up past this.
const MAX_PIECES = 360;

let canvas, context, last;
let pieces = [];

/**
 * Adds a burst of confetti at a viewport point, starting the animation if it
 * is not already running. Does nothing when the visitor prefers reduced motion.
 *
 * @param {number} x Viewport x coordinate.
 * @param {number} y Viewport y coordinate.
 */
function fire( x, y ) {
	if ( reducedMotion() ) {
		return;
	}
	for ( let i = 0; i < PER_BURST; i++ ) {
		// Mostly upward, in a cone 120 degrees wide.
		const angle = -Math.PI / 2 + ( Math.random() - 0.5 ) * ( Math.PI * 2 / 3 );
		const speed = 6 + Math.random() * 10;
		pieces.push( {
			x,
			y,
			vx: Math.cos( angle ) * speed,
			vy: Math.sin( angle ) * speed,
			spin: Math.random() * 6,
			spinSpeed: ( Math.random() - 0.5 ) * 0.4,
			size: 6 + Math.random() * 6,
			color: palette[ i % palette.length ],
		} );
	}
	pieces = pieces.slice( -MAX_PIECES );

	if ( ! canvas ) {
		canvas = document.createElement( 'canvas' );
		canvas.setAttribute( 'aria-hidden', 'true' );
		canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2147483647';
		document.documentElement.append( canvas );
		context = canvas.getContext( '2d' );
		last = performance.now();
		requestAnimationFrame( frame );
	}
}

/**
 * Moves and draws every piece, and removes the canvas once all have fallen
 * off screen.
 *
 * @param {number} now Frame timestamp.
 */
function frame( now ) {
	// Steps are measured in 60 fps frames, so high refresh screens fall at the same speed.
	const step = Math.min( ( now - last ) / 16.7, 3 );
	last = now;

	// Capped, since a 3x canvas costs a lot of fill rate for no visible gain.
	const ratio = Math.min( devicePixelRatio, 2 );
	const width = innerWidth;
	const height = innerHeight;
	if ( canvas.width !== Math.round( width * ratio ) || canvas.height !== Math.round( height * ratio ) ) {
		canvas.width = Math.round( width * ratio );
		canvas.height = Math.round( height * ratio );
	}
	context.setTransform( ratio, 0, 0, ratio, 0, 0 );
	context.clearRect( 0, 0, width, height );

	pieces = pieces.filter( ( piece ) => {
		piece.vx *= 0.98 ** step;
		piece.vy = piece.vy * 0.98 ** step + 0.3 * step;
		piece.x += piece.vx * step;
		piece.y += piece.vy * step;
		piece.spin += piece.spinSpeed * step;

		context.save();
		context.translate( piece.x, piece.y );
		context.rotate( piece.spin );
		context.fillStyle = piece.color;
		// Scaling one side by cos(spin) makes the piece look like it is flipping over.
		context.fillRect( -piece.size / 2, -piece.size / 4, piece.size * Math.cos( piece.spin ), piece.size / 2 );
		context.restore();

		return piece.y < height + 20 && piece.x > -20 && piece.x < width + 20;
	} );

	if ( pieces.length ) {
		requestAnimationFrame( frame );
	} else {
		canvas.remove();
		canvas = null;
	}
}

if ( trigger ) {
	document.addEventListener( 'click', ( event ) => {
		const element = event.target.closest?.( trigger );
		if ( element ) {
			// The element's center, not the pointer, so keyboard activation fires from the same place.
			const rect = element.getBoundingClientRect();
			fire( rect.left + rect.width / 2, rect.top + rect.height / 2 );
		}
	} );
}

addEventListener( 'jsw:confetti', () => fire( innerWidth / 2, innerHeight ) );
