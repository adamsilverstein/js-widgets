/**
 * Reading Progress: a bar across the top of the page that fills as the reader
 * moves through an article, and a pill with the minutes left.
 *
 * Options (data- attributes on the script tag):
 *   data-target  CSS selector for the article. Default "article".
 *   data-color   Bar color. Default "#f60".
 *   data-wpm     Reading speed in words per minute. Default 230.
 *   data-time    "false" turns the time left pill off.
 */
import { options, ready } from '../../shared/embed.js';

const { target, color, wpm, time } = options( { target: 'article', color: '#f60', wpm: 230 } );

ready( () => {
	const article = document.querySelector( target );
	if ( ! article ) {
		return;
	}

	const minutes = Math.ceil( ( article.innerText.match( /\S+/g ) || [] ).length / wpm );
	const showTime = time !== 'false' && minutes > 1;
	if ( showTime ) {
		try {
			// Registered as an integer so the pill counts down in whole minutes.
			CSS.registerProperty( { name: '--jsw-min', syntax: '<integer>', inherits: true, initialValue: '0' } );
		} catch {} // Already registered by another copy of the widget.
	}

	const host = document.createElement( 'div' );
	// Both parts repeat the scroll position, and screen readers do not read counter values.
	host.ariaHidden = true;
	const root = document.body.appendChild( host ).attachShadow( { mode: 'open' } );
	root.innerHTML = `<style>*{position:fixed;z-index:2147483001}div{inset:0 0 auto;height:4px;background:${ color };transform-origin:0;transform:scaleX(0)}p{margin:16px;bottom:0;right:0;padding:4px 9px;border-radius:9px;background:#222d;color:#fff;font:13px sans-serif;counter-reset:m var(--jsw-min)}p::before{content:counter(m) " min left"}</style><div></div>${
		showTime ? '<p></p>' : ''
	}`;
	const [ bar, pill ] = root.querySelectorAll( 'div,p' );

	// A view timeline on the article keeps comments and footers out of the progress.
	const timeline = self.ViewTimeline && new ViewTimeline( { subject: article } );
	const animate = ( element, keyframes ) =>
		element.animate( keyframes, {
			fill: 'both',
			...( timeline ? { timeline, rangeStart: 'contain', rangeEnd: 'contain' } : { duration: 1 } ),
		} );
	const animations = [ animate( bar, { transform: [ 'scaleX(0)', 'scaleX(1)' ] } ) ];
	if ( pill ) {
		// Fades out over the last tenth, instead of reading "0 min left".
		animations.push(
			animate( pill, [ { '--jsw-min': minutes, opacity: 1 }, { opacity: 1, offset: 0.9 }, { '--jsw-min': 0, opacity: 0 } ] )
		);
	}

	// Without scroll-driven animations, scrolling scrubs paused animations instead.
	if ( ! timeline ) {
		const update = () => {
			const { top, height } = article.getBoundingClientRect();
			for ( const animation of animations ) {
				animation.pause();
				animation.currentTime = Math.min( 1, Math.max( 0, -top / Math.max( 1, height - innerHeight ) ) );
			}
		};
		addEventListener( 'scroll', update, { passive: true } );
		addEventListener( 'resize', update );
		update();
	}
} );
