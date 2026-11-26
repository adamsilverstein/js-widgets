/**
 * ASCII Cinema: plays a video as live ASCII art, with a click back to the real picture.
 *
 * Options (data- attributes on the script tag):
 *   data-src       Video to play. Must be same-origin, or the plain video shows instead.
 *   data-target    CSS selector for a <video> already on the page, used instead of data-src.
 *   data-cols      Characters per row. Default 100.
 *   data-ramp      Characters from darkest to brightest. Default " .:-=+*#%@".
 *   data-color     Character color. Default "#33ff66".
 *   data-autoplay  "false" to wait for Play. Otherwise plays muted once in view.
 */
import { createHost, options, ready, reducedMotion, script } from '../../shared/embed.js';

const opts = options( {
	cols: '100',
	ramp: ' .:-=+*#%@',
	color: '#33ff66',
	autoplay: 'true',
} );

const columns = Math.max( 1, parseInt( opts.cols, 10 ) || 100 );
const chars = [ ...opts.ramp ];

// Monospace glyphs are about 0.6em wide and lines are 1em tall, so each character
// cell covers a 0.6:1 patch of the picture.
const CELL_ASPECT = 0.6;

const CSS = `
:host { display: block; }
.stage { position: relative; container-type: inline-size; background: #000; }
::slotted(video) { display: block; width: 100%; height: auto; }
pre {
	position: absolute; inset: 0; margin: 0; overflow: hidden; display: grid; place-content: center;
	background: #000; color: var(--color); cursor: pointer;
	font: calc(100cqi / var(--cols) / ${ CELL_ASPECT })/1 ui-monospace, Menlo, Consolas, monospace;
}
[hidden] { display: none !important; }
.bar { display: flex; gap: 8px; margin-top: 8px; }
button { font: inherit; padding: 4px 12px; border-radius: 6px; cursor: pointer; }
`;

ready( () => {
	const video = opts.target
		? document.querySelector( opts.target )
		: opts.src &&
			Object.assign( document.createElement( 'video' ), {
				src: opts.src,
				controls: true,
				loop: true,
				playsInline: true,
				preload: 'auto',
			} );
	if ( ! ( video instanceof HTMLVideoElement ) ) {
		return;
	}

	const host = createHost( CSS );
	host.style.setProperty( '--cols', columns );
	host.style.setProperty( '--color', opts.color );
	if ( opts.target ) {
		video.before( host );
	} else {
		script.after( host );
	}
	// The video stays in the light DOM, slotted under the ASCII layer, so it keeps
	// its own tracks, controls and page styles.
	host.append( video );

	const root = host.shadowRoot;
	root.innerHTML += `<div class="stage"><slot></slot><pre role="img" aria-label="Video shown as ASCII art"></pre></div>
<div class="bar"><button type="button"></button><button type="button">Show video</button></div>`;
	const pre = root.querySelector( 'pre' );
	const bar = root.querySelector( '.bar' );
	const [ playButton, viewButton ] = bar.children;

	const canvas = document.createElement( 'canvas' );
	const context = canvas.getContext( '2d', { willReadFrequently: true } );

	/** Matches the canvas to the video's shape, one pixel per character. */
	const resize = () => {
		if ( video.videoWidth ) {
			canvas.width = columns;
			canvas.height = Math.max( 1, Math.round( ( columns * video.videoHeight * CELL_ASPECT ) / video.videoWidth ) );
			draw();
		}
	};

	/** Converts the current video frame to text. */
	function draw() {
		if ( pre.hidden || video.readyState < 2 || ! video.videoWidth ) {
			return;
		}
		context.drawImage( video, 0, 0, canvas.width, canvas.height );
		let data;
		try {
			data = context.getImageData( 0, 0, canvas.width, canvas.height ).data;
		} catch {
			// A cross-origin video without CORS taints the canvas. Show it as is.
			setView( false );
			bar.hidden = true;
			return;
		}
		let text = '';
		for ( let i = 0; i < data.length; i += 4 ) {
			const luma = 0.2126 * data[ i ] + 0.7152 * data[ i + 1 ] + 0.0722 * data[ i + 2 ];
			text += chars[ Math.round( ( luma / 255 ) * ( chars.length - 1 ) ) ];
			if ( ( i / 4 + 1 ) % columns === 0 ) {
				text += '\n';
			}
		}
		pre.textContent = text;
	}

	// Frame callbacks keep conversion in step with the video's own frame rate.
	const nextFrame = ( fn ) =>
		video.requestVideoFrameCallback ? video.requestVideoFrameCallback( fn ) : requestAnimationFrame( fn );
	let pending = false;
	function schedule() {
		if ( pending ) {
			return;
		}
		pending = true;
		nextFrame( () => {
			pending = false;
			draw();
			if ( ! video.paused ) {
				schedule();
			}
		} );
	}

	/**
	 * Switches between the ASCII layer and the real video.
	 *
	 * @param {boolean} ascii Whether to show ASCII.
	 */
	function setView( ascii ) {
		pre.hidden = ! ascii;
		// Keeps the covered video's controls out of the tab order.
		video.inert = ascii;
		viewButton.textContent = ascii ? 'Show video' : 'Show ASCII';
		draw();
	}

	const updatePlayButton = () => {
		playButton.textContent = video.paused ? 'Play' : 'Pause';
	};

	video.addEventListener( 'loadedmetadata', resize );
	video.addEventListener( 'loadeddata', draw );
	video.addEventListener( 'seeked', draw );
	video.addEventListener( 'play', schedule );
	video.addEventListener( 'play', updatePlayButton );
	video.addEventListener( 'pause', updatePlayButton );
	playButton.addEventListener( 'click', () => ( video.paused ? video.play().catch( () => {} ) : video.pause() ) );
	viewButton.addEventListener( 'click', () => setView( pre.hidden ) );
	pre.addEventListener( 'click', () => setView( false ) );

	// `resume` means play when next in view: on first sight when autoplaying, and
	// after a pause caused by scrolling away. Browsers only autoplay muted video.
	let resume = opts.autoplay !== 'false' && ! reducedMotion();
	if ( resume ) {
		video.muted = true;
	}
	new IntersectionObserver( ( [ entry ] ) => {
		if ( entry.isIntersecting ) {
			if ( resume ) {
				video.play().catch( () => {} );
			}
			resume = false;
		} else if ( ! video.paused ) {
			video.pause();
			resume = true;
		}
	} ).observe( host );

	updatePlayButton();
	setView( true );
	resize();
	if ( ! video.paused ) {
		schedule();
	}
} );
