/**
 * Tag Cloud Sphere: arranges the links in an element on a rotating 3D globe.
 *
 * The links are moved, not copied, so they stay real, focusable links. Without
 * JavaScript the original list is left as it was.
 *
 * Options (data- attributes on the script tag):
 *   data-target  CSS selector for the element holding the links. Default ".wp-block-tag-cloud".
 *   data-radius  Largest sphere radius in pixels. Default 140. Shrinks to fit narrow containers.
 */
import { createHost, options, ready, reducedMotion } from '../../shared/embed.js';

const { target, radius } = options( { target: '.wp-block-tag-cloud', radius: '140' } );

/** Auto rotation speed, in radians per millisecond (about one turn every 30 seconds). */
const SPIN = 0.0002;

const CSS = `
	:host { display: block; }
	div { position: relative; touch-action: none; user-select: none; -webkit-user-select: none; cursor: grab; }
	.drag { cursor: grabbing; }
	a {
		position: absolute; left: 50%; top: 50%; max-width: 8em; padding: 2px 4px;
		overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
		color: inherit; font-weight: 600; text-decoration: none; -webkit-user-drag: none;
	}
	a:hover, a:focus-visible { text-decoration: underline; }
	a:focus-visible { opacity: 1 !important; outline: 2px solid; border-radius: 4px; }
	button { position: absolute; right: 0; bottom: 0; z-index: 99999; font: inherit; font-size: .8em; cursor: pointer; }
`;

/**
 * Spreads `count` points evenly over a unit sphere, on a Fibonacci spiral.
 *
 * @param {number} count Number of points.
 * @return {number[][]} `[ x, y, z ]` for each point.
 */
const spherePoints = ( count ) =>
	Array.from( { length: count }, ( _, i ) => {
		const y = 1 - ( 2 * ( i + 0.5 ) ) / count;
		const ring = Math.sqrt( 1 - y * y );
		const angle = i * Math.PI * ( 3 - Math.sqrt( 5 ) );
		return [ Math.cos( angle ) * ring, y, Math.sin( angle ) * ring ];
	} );

/** Returns the shortest signed angle from `from` to `to`. */
const turn = ( from, to ) => Math.atan2( Math.sin( to - from ), Math.cos( to - from ) );

/**
 * Replaces an element's content with a sphere made of its links.
 *
 * @param {Element} element Element containing the links.
 */
function sphere( element ) {
	const links = [ ...element.querySelectorAll( 'a[href]' ) ];
	if ( ! links.length ) {
		return;
	}

	// Existing font sizes carry the tag weights, eg. from the WordPress tag cloud.
	const sizes = links.map( ( link ) => parseFloat( getComputedStyle( link ).fontSize ) );
	const min = Math.min( ...sizes );
	const range = Math.max( ...sizes ) - min;

	const host = createHost( CSS );
	const stage = document.createElement( 'div' );
	links.forEach( ( link, i ) => {
		link.style.cssText = `font-size:${ range ? 0.7 + ( 0.6 * ( sizes[ i ] - min ) ) / range : 1 }em`;
		// Long names are cut short with an ellipsis, so keep the full name on hover.
		link.title ||= link.textContent.trim();
	} );
	stage.append( ...links );
	host.shadowRoot.append( stage );
	element.replaceChildren( host );

	const points = spherePoints( links.length );
	const still = reducedMotion();
	let r = 0;
	let yaw = 0;
	let pitch = -0.3;
	let velocity = [ 0, 0 ];
	let goal = null;
	let drag = null;
	let dragged = false;
	let hovered = false;
	let focused = false;
	let paused = still;
	let visible = true;
	let frame = 0;
	let last = 0;

	const spinning = () => ! paused && ! hovered && ! focused;

	function render() {
		const [ cy, sy, cp, sp ] = [ Math.cos( yaw ), Math.sin( yaw ), Math.cos( pitch ), Math.sin( pitch ) ];
		points.forEach( ( [ x, y, z ], i ) => {
			// Rotate around the vertical axis by yaw, then around the horizontal axis by pitch.
			const x1 = x * cy + z * sy;
			const z1 = z * cy - x * sy;
			const y2 = y * cp - z1 * sp;
			const z2 = y * sp + z1 * cp;
			const { style } = links[ i ];
			style.transform = `translate(-50%,-50%) translate3d(${ x1 * r }px,${ y2 * r }px,${ z2 * r }px)`;
			style.opacity = 0.25 + ( 0.75 * ( z2 + 1 ) ) / 2;
			// Without this, a tag at the back can cover a front one and catch its clicks.
			style.zIndex = Math.round( ( z2 + 1 ) * 100 );
		} );
	}

	function tick( now ) {
		const dt = Math.min( now - last, 50 );
		last = now;
		if ( goal ) {
			const ease = still ? 1 : Math.min( 1, dt / 150 );
			yaw += turn( yaw, goal[ 0 ] ) * ease;
			pitch += ( goal[ 1 ] - pitch ) * ease;
			if ( Math.abs( turn( yaw, goal[ 0 ] ) ) + Math.abs( goal[ 1 ] - pitch ) < 0.001 ) {
				goal = null;
			}
		} else if ( ! drag ) {
			yaw += velocity[ 0 ] * dt + ( spinning() ? SPIN * dt : 0 );
			pitch = Math.max( -1.5, Math.min( 1.5, pitch + velocity[ 1 ] * dt ) );
			const friction = 0.95 ** ( dt / 16 );
			velocity = velocity.map( ( v ) => ( Math.abs( v ) < 1e-5 ? 0 : v * friction ) );
		}
		render();
		const moving = goal || drag || spinning() || velocity.some( Boolean );
		frame = visible && moving ? requestAnimationFrame( tick ) : 0;
	}

	/** Starts the animation loop if it is not already running. */
	function wake() {
		if ( ! frame && visible ) {
			last = performance.now();
			frame = requestAnimationFrame( tick );
		}
	}

	new ResizeObserver( ( [ entry ] ) => {
		r = Math.max( 40, Math.min( Number( radius ) || 140, entry.contentRect.width / 2 - 40 ) );
		stage.style.height = `${ 2 * r + 40 }px`;
		stage.style.perspective = `${ 4 * r }px`;
		render();
	} ).observe( host );

	new IntersectionObserver( ( [ entry ] ) => {
		visible = entry.isIntersecting;
		wake();
	} ).observe( host );

	// Mouse hover pauses. A touch's enter and leave come with every tap, so it does not.
	stage.addEventListener( 'pointerenter', ( event ) => {
		hovered = event.pointerType === 'mouse';
	} );
	stage.addEventListener( 'pointerleave', () => {
		hovered = false;
		wake();
	} );

	stage.addEventListener( 'focusin', ( { target: link } ) => {
		focused = true;
		const i = links.indexOf( link );
		// Only keyboard focus turns the sphere: a mouse click also focuses, and would fight a drag.
		if ( i >= 0 && link.matches( ':focus-visible' ) ) {
			const [ x, y, z ] = points[ i ];
			const toFront = Math.atan2( -x, z );
			goal = [ toFront, Math.atan2( y, Math.hypot( x, z ) ) ];
			velocity = [ 0, 0 ];
			wake();
		}
	} );
	stage.addEventListener( 'focusout', ( event ) => {
		if ( ! stage.contains( event.relatedTarget ) ) {
			focused = false;
			wake();
		}
	} );

	stage.addEventListener( 'pointerdown', ( event ) => {
		if ( event.button === 0 && ! event.target.closest( 'button' ) ) {
			drag = { x: event.clientX, y: event.clientY, time: event.timeStamp };
			dragged = false;
			goal = null;
			velocity = [ 0, 0 ];
		}
	} );
	stage.addEventListener( 'pointermove', ( event ) => {
		if ( ! drag ) {
			return;
		}
		const dx = event.clientX - drag.x;
		const dy = event.clientY - drag.y;
		if ( ! dragged ) {
			if ( Math.hypot( dx, dy ) < 4 ) {
				return;
			}
			// Capture only once it is a drag, so a plain click still reaches the link.
			dragged = true;
			stage.setPointerCapture( event.pointerId );
			stage.classList.add( 'drag' );
		}
		const dt = Math.max( 1, event.timeStamp - drag.time );
		const step = [ dx / r, -dy / r ];
		yaw += step[ 0 ];
		pitch = Math.max( -1.5, Math.min( 1.5, pitch + step[ 1 ] ) );
		velocity = step.map( ( s ) => s / dt );
		Object.assign( drag, { x: event.clientX, y: event.clientY, time: event.timeStamp } );
		wake();
	} );
	const release = ( event ) => {
		if ( drag ) {
			// A pointer that stopped before letting go should not fling the sphere.
			if ( still || event.timeStamp - drag.time > 80 ) {
				velocity = [ 0, 0 ];
			}
			stage.classList.remove( 'drag' );
			drag = null;
			wake();
		}
	};
	stage.addEventListener( 'pointerup', release );
	stage.addEventListener( 'pointercancel', release );
	// A drag that ends on a link must not follow it. `dragged` outlives `drag` since click comes after pointerup.
	stage.addEventListener( 'click', ( event ) => dragged && event.preventDefault(), true );
	stage.addEventListener( 'dragstart', ( event ) => event.preventDefault() );

	if ( ! still ) {
		const button = document.createElement( 'button' );
		button.type = 'button';
		const label = () => {
			button.textContent = paused ? 'Play' : 'Pause';
			button.ariaLabel = `${ button.textContent } tag cloud rotation`;
		};
		button.addEventListener( 'click', () => {
			paused = ! paused;
			label();
			wake();
		} );
		label();
		stage.append( button );
	}

	render();
	wake();
}

ready( () => document.querySelectorAll( target ).forEach( sphere ) );
