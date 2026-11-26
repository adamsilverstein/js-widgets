/**
 * Pet Companion: a pixel cat that lives along the bottom edge of the window.
 * It wanders and sits, chases the pointer when it comes close, naps when the
 * page has been still for a while, and shows a heart when clicked.
 *
 * Options (data- attributes on the script tag):
 *   data-pet  Which pet. Only "cat" for now.
 */
import { createHost, options, ready } from '../../shared/embed.js';

/** Pixel colors, keyed by the letters used in the frames below. */
const PALETTE = { f: '#f0a040', d: '#a8611f', w: '#fff6e6', k: '#2a1d14', p: '#ef7f95' };

/** Frames of a 16 by 10 pixel cat facing right. "." is transparent. */
const BODY = [
	'..........f...f.',
	'f.........fffff.',
	'f.........fkfkf.',
	'.f........ffpff.',
	'.fffffffffffff..',
	'..fdffdffdfffw..',
	'..fffffffffffw..',
	'..ffffffffffff..',
];
const CAT = {
	walk: [ ...BODY, '..f.f.....f.f...', '..w.w.....w.w...' ],
	step: [ ...BODY, '...f.f...f.f....', '...w.w...w.w....' ],
	sit: [
		'..........f...f.',
		'..........fffff.',
		'..........fkfkf.',
		'..........ffpff.',
		'.........ffffff.',
		'........ffdfffw.',
		'.......ffdffffw.',
		'......ffdfffffw.',
		'f.....fffffffff.',
		'.fffffffffw.w.w.',
	],
	sleep: [
		'',
		'',
		'',
		'',
		'..........f...f.',
		'...ffffff.fffff.',
		'..fffffffffdfdf.',
		'.fffdffdffffpff.',
		'.ffffffffffffff.',
		'ffffffffffffww..',
	],
};
const PETS = { cat: CAT };

const SCALE = 3;
const WIDTH = 16 * SCALE;
const WALK_SPEED = 40; // px per second
const CHASE_SPEED = 130;
const NOTICE_DISTANCE = 140; // How close the pointer comes before the pet chases it.
const SLEEP_AFTER = 20000; // ms without page activity before a nap.
const STORAGE_KEY = 'jsw-pet-hidden';

const CSS = `
:host { position: fixed; left: 0; right: 0; bottom: 0; z-index: 2147482000; pointer-events: none; }
.pet { position: absolute; bottom: 0; left: 0; width: ${ WIDTH }px; pointer-events: auto; cursor: pointer; }
canvas { display: block; width: 100%; image-rendering: pixelated; }
.left canvas { scale: -1 1; }
.heart, .pet.sleep::before { position: absolute; left: 60%; bottom: 100%; pointer-events: none; }
.heart { color: #e6456d; font: 18px/1 system-ui, sans-serif; }
.pet.sleep::before { content: "z"; color: #8a8f99; font: bold 14px/1 system-ui, sans-serif; }
button { position: absolute; bottom: 34px; left: 0; width: 22px; height: 22px; padding: 0; border: 1px solid #0003; border-radius: 50%;
	background: #fff; color: #333; font: 14px/1 system-ui, sans-serif; cursor: pointer; opacity: .6; pointer-events: auto; }
button:hover, button:focus-visible { opacity: 1; }
@media (prefers-reduced-motion: no-preference) {
	.heart { animation: rise 1.2s ease-out forwards; }
	.pet.sleep::before { animation: rise 2s ease-out infinite; }
}
@keyframes rise { to { translate: 0 -24px; opacity: 0; } }
`;

/** Reads the session flag set when the visitor hides the pet. Storage can throw when blocked. */
function isHidden() {
	try {
		return sessionStorage.getItem( STORAGE_KEY ) === '1';
	} catch {
		return false;
	}
}

const { pet: kind } = options( { pet: 'cat' } );
const frames = PETS[ kind ] || CAT;

ready( () => {
	if ( isHidden() ) {
		return;
	}

	const host = createHost( CSS );
	const root = host.shadowRoot;
	root.innerHTML += `<div class="pet" aria-hidden="true"><canvas width="16" height="10"></canvas></div>
		<button type="button" aria-label="Hide the pet" title="Hide the pet">×</button>`;
	const pet = root.querySelector( '.pet' );
	const button = root.querySelector( 'button' );
	const context = pet.firstChild.getContext( '2d' );
	document.body.append( host );

	const still = matchMedia( '(prefers-reduced-motion: reduce)' );
	let x = 16;
	let target = x;
	let state = '';
	let drawn = '';
	let left = false;
	let until = 0; // When the current sit or heart ends.
	let lastActive = performance.now();
	let pointer = null;
	let running = false;
	let last = 0;

	/** Draws a frame and records the state on the element, for styles and tests. */
	function pose( name, frame = name ) {
		state = name;
		pet.className = `pet ${ name }${ left ? ' left' : '' }`;
		if ( frame === drawn ) {
			return;
		}
		drawn = frame;
		context.clearRect( 0, 0, 16, 10 );
		frames[ frame ].forEach( ( row, y ) =>
			[ ...row ].forEach( ( pixel, column ) => {
				if ( PALETTE[ pixel ] ) {
					context.fillStyle = PALETTE[ pixel ];
					context.fillRect( column, y, 1, 1 );
				}
			} )
		);
	}

	/** Moves the pet and its hide button to `x`. */
	function place() {
		pet.style.translate = `${ x }px 0`;
		button.style.translate = `${ Math.max( 0, x - 8 ) }px 0`;
	}

	function tick( now ) {
		if ( still.matches || ! host.isConnected ) {
			running = false;
			return;
		}
		const dt = Math.min( now - ( last || now ), 100 ) / 1000;
		last = now;
		const maxX = document.documentElement.clientWidth - WIDTH;
		const near = pointer && Math.abs( pointer.x - x - WIDTH / 2 ) < NOTICE_DISTANCE && innerHeight - pointer.y < NOTICE_DISTANCE;
		let speed = WALK_SPEED;

		if ( state === 'love' && now < until ) {
			speed = 0;
		} else if ( button.matches( ':focus-visible' ) ) {
			// Hold still so a keyboard user can see what the button hides.
			speed = 0;
			pose( 'sit' );
		} else if ( near ) {
			target = pointer.x - WIDTH / 2;
			speed = CHASE_SPEED;
		} else if ( now - lastActive > SLEEP_AFTER ) {
			speed = 0;
			if ( state !== 'sleep' ) {
				pose( 'sleep' );
			}
		} else if ( Math.abs( target - x ) < 1 && state !== 'sit' ) {
			pose( 'sit' );
			until = now + 2000 + Math.random() * 4000;
		} else if ( state === 'sit' && now > until ) {
			target = Math.random() * maxX;
		}

		target = Math.max( 0, Math.min( maxX, target ) );
		const step = Math.min( Math.abs( target - x ), speed * dt );
		if ( step > 0.5 ) {
			left = target < x;
			x += Math.sign( target - x ) * step;
			// Alternate the two walking frames, faster when running.
			pose( near ? 'chase' : 'walk', Math.floor( now / ( near ? 100 : 180 ) ) % 2 ? 'step' : 'walk' );
		} else if ( speed && state !== 'sit' ) {
			pose( 'sit' );
			until = now + 2000 + Math.random() * 4000;
		}
		place();
		requestAnimationFrame( tick );
	}

	function start() {
		if ( still.matches ) {
			pose( 'sit' );
		} else if ( ! running ) {
			running = true;
			last = 0;
			requestAnimationFrame( tick );
		}
	}

	const wake = () => ( lastActive = performance.now() );
	addEventListener( 'pointermove', ( event ) => {
		pointer = event;
		wake();
	}, { passive: true } );
	addEventListener( 'scroll', wake, { passive: true } );
	addEventListener( 'keydown', wake );
	document.documentElement.addEventListener( 'pointerleave', () => ( pointer = null ) );
	still.addEventListener( 'change', start );

	pet.addEventListener( 'click', () => {
		wake();
		target = x;
		pose( 'love', 'sit' );
		until = performance.now() + 1500;
		const heart = document.createElement( 'span' );
		heart.className = 'heart';
		heart.textContent = '♥';
		pet.append( heart );
		setTimeout( () => heart.remove(), 1200 );
	} );

	button.addEventListener( 'click', () => {
		host.remove();
		try {
			sessionStorage.setItem( STORAGE_KEY, '1' );
		} catch {}
	} );

	pose( 'sit' );
	place();
	start();
} );
