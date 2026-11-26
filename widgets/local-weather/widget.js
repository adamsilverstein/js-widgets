/**
 * Local Weather: current conditions and a three day forecast from Open-Meteo,
 * with no API key.
 *
 * Options (data- attributes on the script tag):
 *   data-lat, data-lon  Coordinates to show. Without them the card offers a
 *                       "Use my location" button instead.
 *   data-units          `c` or `f`. Default from the visitor's locale.
 *   data-label          Place name shown on the card, eg. "Bend, OR".
 */
import { mountInline, options } from '../../shared/embed.js';

const API = 'https://api.open-meteo.com/v1/forecast';
const CACHE_MINUTES = 30;

/* Icon parts in a 32 unit box, drawn with currentColor strokes. */
const RAYS = 'M16 3v3M16 26v3M3 16h3M26 16h3M6.8 6.8l2.1 2.1M23.1 23.1l2.1 2.1M6.8 25.2l2.1-2.1M23.1 8.9l2.1-2.1';
const SUN = `<g class="sun"><circle cx="16" cy="16" r="6"/><path class="rays" d="${ RAYS }"/></g>`;
const MOON = '<path class="sun" d="M20 5a11 11 0 1 0 8 15A9 9 0 0 1 20 5z"/>';
const CLOUD = '<path class="cloud" d="M9 25h14a5 5 0 0 0 .5-10A7 7 0 0 0 10 14.5 5.3 5.3 0 0 0 9 25z"/>';
const SMALL = ( part ) => `<g transform="translate(0 -1) scale(.7)">${ part }</g>`;
const DROPS = '<path class="fall" d="M11 27l-1 3M16 27l-1 3M21 27l-1 3"/>';
const FLAKES = '<path class="fall" d="M11 28h.01M16 30h.01M21 28h.01"/>';
const BOLT = '<path class="bolt" d="M17 22l-3 5h4l-2 4"/>';
const FOG = '<path class="cloud" d="M6 13h20M4 18h24M7 23h18"/>';

/* Open-Meteo returns WMO weather codes. Each group maps to a label and an icon. */
const CONDITIONS = [
	[ [ 0, 1 ], 'Clear', ( day ) => ( day ? SUN : MOON ) ],
	[ [ 2 ], 'Partly cloudy', ( day ) => SMALL( day ? SUN : MOON ) + CLOUD ],
	[ [ 3 ], 'Cloudy', () => CLOUD ],
	[ [ 45, 48 ], 'Fog', () => FOG ],
	[ [ 51, 53, 55, 56, 57 ], 'Drizzle', () => CLOUD + DROPS ],
	[ [ 61, 63, 65, 66, 67, 80, 81, 82 ], 'Rain', () => CLOUD + DROPS ],
	[ [ 71, 73, 75, 77, 85, 86 ], 'Snow', () => CLOUD + FLAKES ],
	[ [ 95, 96, 99 ], 'Thunderstorm', () => CLOUD + BOLT ],
];

/**
 * Returns the label and icon markup for a weather code.
 *
 * @param {number}  code WMO weather code.
 * @param {boolean} day  Whether the sun is up, to pick a sun or moon.
 * @return {{label: string, svg: Function}} The label, and a function that takes the
 *         svg element's attributes and returns its markup.
 */
function condition( code, day = true ) {
	const [ , label, draw ] = CONDITIONS.find( ( [ codes ] ) => codes.includes( code ) ) ?? CONDITIONS[ 2 ];
	return {
		label,
		svg: ( attrs = 'aria-hidden="true"' ) => `<svg viewBox="0 0 32 32" ${ attrs }>${ draw( day ) }</svg>`,
	};
}

/** Whether the visitor's region uses Fahrenheit. */
function localeUsesFahrenheit() {
	try {
		return [ 'US', 'LR', 'MM', 'BS', 'BZ', 'KY', 'PW' ].includes( new Intl.Locale( navigator.language ).maximize().region );
	} catch {
		return false;
	}
}

const config = options( { units: localeUsesFahrenheit() ? 'f' : 'c', label: '' } );
const units = config.units.toLowerCase() === 'f' ? 'f' : 'c';
const lat = parseFloat( config.lat );
const lon = parseFloat( config.lon );
const fixed = Number.isFinite( lat ) && Number.isFinite( lon );

/* A visitor's location is cached under one key, so a later page view can show it without asking again. */
const cacheKey = ( coords ) => `jsw-weather:${ coords ? coords.join() : 'here' }:${ units }`;

/**
 * Fetches the forecast, or returns a cached copy younger than CACHE_MINUTES.
 *
 * @param {number[]} coords Latitude and longitude.
 * @param {string}   key    sessionStorage key.
 * @return {Promise<Object>} Open-Meteo response.
 */
async function forecast( coords, key ) {
	const cached = read( key );
	if ( cached ) {
		return cached;
	}
	const params = new URLSearchParams( {
		latitude: coords[ 0 ],
		longitude: coords[ 1 ],
		current: 'temperature_2m,weather_code,is_day',
		daily: 'weather_code,temperature_2m_max,temperature_2m_min',
		temperature_unit: units === 'f' ? 'fahrenheit' : 'celsius',
		timezone: 'auto',
		forecast_days: 4,
	} );
	const response = await fetch( `${ API }?${ params }`, { signal: AbortSignal.timeout( 8000 ) } );
	if ( ! response.ok ) {
		throw new Error( response.status );
	}
	const data = await response.json();
	try {
		sessionStorage.setItem( key, JSON.stringify( { time: Date.now(), data } ) );
	} catch {}
	return data;
}

/**
 * Returns cached forecast data if it is fresh enough.
 *
 * @param {string} key sessionStorage key.
 * @return {?Object} Open-Meteo response, or null.
 */
function read( key ) {
	try {
		const { time, data } = JSON.parse( sessionStorage.getItem( key ) );
		return Date.now() - time < CACHE_MINUTES * 60e3 ? data : null;
	} catch {
		return null;
	}
}

const root = mountInline( `
:host { display: block; max-width: 320px; }
.card { padding: 14px 16px; border: 1px solid color-mix(in srgb, currentColor 18%, transparent); border-radius: 14px; background: color-mix(in srgb, currentColor 4%, transparent); font: 15px/1.4 system-ui, sans-serif; }
h2 { margin: 0 0 4px; font-size: .9em; font-weight: 600; opacity: .75; }
.now { display: flex; align-items: center; gap: 12px; }
.now svg { width: 64px; height: 64px; flex: none; }
.temp { font-size: 2.6em; font-weight: 300; line-height: 1; }
.temp small { font-size: .4em; vertical-align: top; }
.range, .status, a { font-size: .85em; opacity: .75; }
ul { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 12px 0 0; padding: 10px 0 0; border-top: 1px solid color-mix(in srgb, currentColor 15%, transparent); list-style: none; text-align: center; font-size: .85em; }
ul svg { display: block; width: 32px; height: 32px; margin: 2px auto; }
svg { fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.sun { stroke: #e8a317; }
.fall { stroke: #3b82f6; stroke-width: 2.4; }
.bolt { stroke: #e8a317; }
.status { margin: 4px 0 10px; }
button { font: inherit; padding: 6px 12px; border: 1px solid currentColor; border-radius: 8px; background: none; color: inherit; cursor: pointer; }
a { display: block; margin-top: 10px; color: inherit; }
@media (prefers-reduced-motion: no-preference) {
	/* Each animation stops within five seconds, so no pause control is needed. */
	.now .rays { transform-box: fill-box; transform-origin: center; animation: spin 4s ease-in-out; }
	.now .cloud { animation: drift 2s ease-in-out 2; }
	.now .fall { animation: fall 1s linear 4; }
}
@keyframes spin { to { rotate: 45deg; } }
@keyframes drift { 50% { translate: 1.5px; } }
@keyframes fall { from { translate: 0 -4px; opacity: 0; } }
` );

const card = document.createElement( 'section' );
card.className = 'card';
card.setAttribute( 'aria-label', config.label ? `Weather in ${ config.label }` : 'Weather' );
card.innerHTML = `${ config.label ? '<h2></h2>' : '' }<div></div>
<a href="https://open-meteo.com/" target="_blank" rel="noopener">Weather data by Open-Meteo</a>`;
card.querySelector( 'h2' )?.append( config.label );
const body = card.querySelector( 'div' );
root.append( card );

/**
 * Shows a short status line in place of the forecast.
 *
 * @param {string}      text     Message.
 * @param {HTMLElement} [button] Button to show below it.
 */
function status( text, button ) {
	body.innerHTML = '<p class="status"></p>';
	body.firstChild.textContent = text;
	if ( button ) {
		body.append( button );
	}
}

/**
 * Renders current conditions and the next three days.
 *
 * @param {Object} data Open-Meteo response.
 */
function render( { current, daily } ) {
	const deg = ( value ) => `${ Math.round( value ) }°`;
	const now = condition( current.weather_code, current.is_day );
	// Dates arrive as `YYYY-MM-DD`, which parses as UTC midnight.
	const weekday = new Intl.DateTimeFormat( undefined, { weekday: 'short', timeZone: 'UTC' } );
	const days = [ 1, 2, 3 ].map( ( i ) => {
		const day = condition( daily.weather_code[ i ] );
		return `<li><span>${ weekday.format( new Date( daily.time[ i ] ) ) }</span>${ day.svg(
			`role="img" aria-label="${ day.label }"`
		) }${ deg( daily.temperature_2m_max[ i ] ) } <span class="range">${ deg( daily.temperature_2m_min[ i ] ) }</span></li>`;
	} );
	body.innerHTML = `<div class="now">${ now.svg() }<div>
<div class="temp">${ deg( current.temperature_2m ) }<small>${ units.toUpperCase() }</small></div>
<div>${ now.label }</div>
<div class="range">High ${ deg( daily.temperature_2m_max[ 0 ] ) } · Low ${ deg( daily.temperature_2m_min[ 0 ] ) }</div>
</div></div><ul aria-label="Next three days">${ days.join( '' ) }</ul>`;
}

/**
 * Loads and renders a forecast, showing a short message if it fails.
 *
 * @param {number[]} [coords] Latitude and longitude. Omitted to show the visitor's cached location.
 * @param {string}   key      sessionStorage key.
 * @return {Promise<boolean>} Whether a forecast was shown.
 */
async function show( coords, key ) {
	try {
		render( coords ? await forecast( coords, key ) : read( key ) );
		return true;
	} catch {
		return false;
	}
}

/** Shows the configured location, or the visitor's once they ask for it. */
async function start() {
	if ( fixed ) {
		status( 'Loading weather…' );
		if ( ! ( await show( [ lat, lon ], cacheKey( [ lat, lon ] ) ) ) ) {
			status( 'Weather is unavailable right now.' );
		}
		return;
	}
	if ( await show( null, cacheKey() ) ) {
		return;
	}
	// Geolocation is only requested from this click, never on load.
	const button = document.createElement( 'button' );
	button.type = 'button';
	button.textContent = 'Use my location';
	// Replacing the status removes the focused button, so a retry puts focus back on it.
	const retry = ( text ) => {
		status( text, button );
		button.focus();
	};
	button.addEventListener( 'click', () => {
		// Announce only the results of the click, not the forecast or messages shown on load.
		body.setAttribute( 'aria-live', 'polite' );
		if ( ! navigator.geolocation ) {
			return status( 'Your location is not available.' );
		}
		status( 'Finding your location…' );
		navigator.geolocation.getCurrentPosition(
			async ( { coords } ) => {
				// Two decimals, about 1 km, is plenty for weather and shares less with the API.
				const here = [ coords.latitude, coords.longitude ].map( ( n ) => Math.round( n * 100 ) / 100 );
				if ( ! ( await show( here, cacheKey() ) ) ) {
					retry( 'Weather is unavailable right now.' );
				}
			},
			() => retry( 'Your location is not available.' ),
			{ maximumAge: CACHE_MINUTES * 60e3, timeout: 10000 }
		);
	} );
	status( 'Show the weather where you are.', button );
}

start();
