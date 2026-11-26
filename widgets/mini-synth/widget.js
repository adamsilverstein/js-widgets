/**
 * Mini Synth: a small playable keyboard, rendered where the snippet is pasted.
 *
 * Options (data- attributes on the script tag):
 *   data-octaves  Number of octaves, 1 to 3. Default 2.
 *   data-wave     Starting waveform: sine, triangle, square or sawtooth. Default sine.
 *   data-volume   Starting volume, 0 to 100. Default 50.
 */
import { mountInline, options } from '../../shared/embed.js';

const opts = options( { octaves: '2', wave: 'sine', volume: '50' } );
const WAVES = [ 'sine', 'triangle', 'square', 'sawtooth' ];
const NAMES = [ 'C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B' ];

// Physical key codes, so the layout matches on non-QWERTY keyboards. The bottom
// row plays from the lowest C and the top row from the C above it.
const LOWER = 'Z S X D C V G B H N J M Comma L Period Semicolon Slash';
const UPPER = 'Q 2 W 3 E R 5 T 6 Y 7 U I 9 O 0 P';
const KEYMAP = new Map();
[ [ LOWER, 0 ], [ UPPER, 12 ] ].forEach( ( [ row, offset ] ) =>
	row.split( ' ' ).forEach( ( key, i ) => {
		const code = /^\d$/.test( key ) ? `Digit${ key }` : key.length === 1 ? `Key${ key }` : key;
		KEYMAP.set( code, offset + i );
	} )
);

const octaves = Math.min( 3, Math.max( 1, parseInt( opts.octaves, 10 ) || 2 ) );
// MIDI note number of the lowest key: middle C, or the C below it for three octaves.
const low = 60 - 12 * Math.floor( ( octaves - 1 ) / 2 );
const high = low + octaves * 12;
let wave = WAVES.includes( opts.wave ) ? opts.wave : 'sine';
const startVolume = parseFloat( opts.volume );
let volume = Math.min( 100, Math.max( 0, Number.isNaN( startVolume ) ? 50 : startVolume ) ) / 100;

// Peak gain of one note. Five notes at full volume sum to 1, so chords rarely clip.
const VOICE_GAIN = 0.2;

const isBlack = ( note ) => NAMES[ note % 12 ].length > 1;
const noteName = ( note ) => NAMES[ note % 12 ] + ( Math.floor( note / 12 ) - 1 );

const root = mountInline( `
:host{display:block;max-width:720px;margin:1em 0;font:14px/1.4 system-ui,sans-serif;color-scheme:light dark}
.bar{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;margin-bottom:8px}
label{display:flex;gap:6px;align-items:center}
select,input,button{font:inherit}
.midi[aria-pressed=true]{font-weight:600}
.keys{display:grid;grid-template-rows:3fr 2fr;height:150px;touch-action:none;user-select:none;-webkit-user-select:none;container-type:inline-size}
.keys button{grid-row:1/3;display:grid;place-items:end center;min-width:0;padding:0 0 6px;border:1px solid #555;border-radius:0 0 5px 5px;background:#fff;color:#333;font-size:11px;cursor:pointer;-webkit-tap-highlight-color:transparent}
.keys .b{grid-row:1;z-index:1;background:#222;color:#ddd;font-size:9px;border-color:#000}
.keys .on{background:#7ab8ff;color:#000}
.keys button:focus-visible{outline:3px solid #1a73e8;outline-offset:-3px}
@container (width < 520px){.keys .b{color:transparent}}
.hint{margin:6px 0 0;font-size:12px;opacity:.75}
` );

root.innerHTML += `<div class="bar">
	<label>Wave <select>${ WAVES.map( ( w ) => `<option${ w === wave ? ' selected' : '' }>${ w }</option>` ).join( '' ) }</select></label>
	<label>Volume <input type="range" min="0" max="100" value="${ volume * 100 }"></label>
	${ navigator.requestMIDIAccess ? '<button type="button" class="midi" aria-pressed="false">MIDI off</button>' : '' }
</div>
<div class="keys" role="group" aria-label="Piano keyboard"></div>
<p class="hint">Focus a key to play from your keyboard: Z to M for the lower octave, Q to U for the next.</p>`;

const keyboard = root.querySelector( '.keys' );
const midiButton = root.querySelector( '.midi' );
const buttons = new Map();

// Four grid columns per white key, so a black key can straddle two white keys.
let whites = 0;
for ( let note = low; note <= high; note++ ) {
	const button = document.createElement( 'button' );
	button.type = 'button';
	button.textContent = noteName( note );
	button.dataset.note = note;
	if ( isBlack( note ) ) {
		button.className = 'b';
		button.style.gridColumn = `${ whites * 4 } / span 2`;
	} else {
		button.style.gridColumn = `${ whites * 4 + 1 } / span 4`;
		whites++;
	}
	buttons.set( note, button );
	keyboard.append( button );
}
keyboard.style.gridTemplateColumns = `repeat(${ whites * 4 },1fr)`;

let ctx, master, idle;
/** Sounding notes, keyed by what holds them: a pointer, a computer key or a MIDI note. */
const voices = new Map();

/** Lights a key while any source holds its note. */
const light = ( note ) =>
	buttons.get( note )?.classList.toggle( 'on', [ ...voices.values() ].some( ( voice ) => voice.note === note ) );

/**
 * Starts a note for `source`, replacing any note that source already holds.
 * The audio context is created here, so nothing exists before the first press.
 *
 * @param {string} source Voice id, eg. `p1` for pointer 1 or `kKeyZ`.
 * @param {number} note   MIDI note number.
 */
function noteOn( source, note ) {
	noteOff( source );
	if ( ! ctx ) {
		ctx = new AudioContext();
		master = new GainNode( ctx, { gain: volume } );
		master.connect( ctx.destination );
	}
	clearTimeout( idle );
	ctx.resume();
	const t = ctx.currentTime;
	const osc = new OscillatorNode( ctx, { type: wave, frequency: 440 * 2 ** ( ( note - 69 ) / 12 ) } );
	const gain = new GainNode( ctx, { gain: 0 } );
	// A short ramp in and out keeps notes from clicking.
	gain.gain.setTargetAtTime( VOICE_GAIN, t, 0.005 );
	osc.connect( gain ).connect( master );
	osc.start( t );
	voices.set( source, { note, osc, gain } );
	light( note );
}

/**
 * Releases the note `source` holds, if any.
 *
 * @param {string} source Voice id.
 */
function noteOff( source ) {
	const voice = voices.get( source );
	if ( ! voice ) {
		return;
	}
	voices.delete( source );
	const t = ctx.currentTime;
	voice.gain.gain.cancelScheduledValues( t );
	voice.gain.gain.setTargetAtTime( 0, t, 0.04 );
	voice.osc.stop( t + 0.3 );
	light( voice.note );
	// A running context keeps the audio thread busy, so suspend it once the last note has faded.
	if ( ! voices.size ) {
		idle = setTimeout( () => ctx.suspend(), 1000 );
	}
}

const stopAll = ( prefix = '' ) => {
	for ( const source of [ ...voices.keys() ] ) {
		if ( source.startsWith( prefix ) ) {
			noteOff( source );
		}
	}
};

// Pointers: each finger or mouse is its own voice, and sliding across keys plays them.
const noteAt = ( x, y ) => {
	const el = root.elementFromPoint( x, y );
	return el?.parentNode === keyboard ? Number( el.dataset.note ) : null;
};
const follow = ( event ) => {
	const source = `p${ event.pointerId }`;
	if ( event.type !== 'pointerdown' && ! voices.has( source ) && ! keyboard.hasPointerCapture( event.pointerId ) ) {
		return;
	}
	const note = noteAt( event.clientX, event.clientY );
	if ( note === null ) {
		noteOff( source );
	} else if ( voices.get( source )?.note !== note ) {
		noteOn( source, note );
	}
};
keyboard.addEventListener( 'pointerdown', ( event ) => {
	if ( event.button !== 0 ) {
		return;
	}
	// Capture keeps pointermove coming after the pointer leaves the keyboard.
	keyboard.setPointerCapture( event.pointerId );
	follow( event );
} );
keyboard.addEventListener( 'pointermove', follow );
for ( const type of [ 'pointerup', 'pointercancel', 'lostpointercapture' ] ) {
	keyboard.addEventListener( type, ( event ) => noteOff( `p${ event.pointerId }` ) );
}

// Computer keyboard. Only active while a synth key has focus, so typing elsewhere on the page is untouched.
keyboard.addEventListener( 'keydown', ( event ) => {
	if ( event.ctrlKey || event.metaKey || event.altKey ) {
		return;
	}
	const isActivate = event.key === 'Enter' || event.key === ' ';
	const note = isActivate ? Number( event.target.dataset.note ) : low + KEYMAP.get( event.code );
	if ( note >= low && note <= high ) {
		// Also stops Enter and Space from firing a click.
		event.preventDefault();
		if ( ! event.repeat ) {
			noteOn( `k${ event.code }`, note );
		}
	}
} );
keyboard.addEventListener( 'keyup', ( event ) => {
	if ( event.key === ' ' ) {
		// Space fires its click on keyup.
		event.preventDefault();
	}
	noteOff( `k${ event.code }` );
} );
keyboard.addEventListener( 'focusout', ( event ) => {
	if ( ! keyboard.contains( event.relatedTarget ) ) {
		stopAll( 'k' );
	}
} );

// A click with no pointer or key behind it comes from assistive technology: play a short note.
keyboard.addEventListener( 'click', ( event ) => {
	if ( event.detail === 0 && event.target.dataset.note ) {
		noteOn( 'a', Number( event.target.dataset.note ) );
		setTimeout( () => noteOff( 'a' ), 400 );
	}
} );

root.querySelector( 'select' ).addEventListener( 'change', ( event ) => {
	wave = event.target.value;
} );
root.querySelector( 'input' ).addEventListener( 'input', ( event ) => {
	volume = event.target.value / 100;
	master?.gain.setTargetAtTime( volume, ctx.currentTime, 0.02 );
} );

document.addEventListener( 'visibilitychange', () => {
	if ( document.hidden && ctx ) {
		stopAll();
		ctx.suspend();
	}
} );

// MIDI is requested only when the visitor turns it on, since it can show a permission prompt.
let midi;
let midiOn = false;
const onMidi = ( { data: [ status, note, velocity ] } ) => {
	const type = status & 0xf0;
	if ( type === 0x90 && velocity > 0 ) {
		noteOn( `m${ note }`, note );
	} else if ( type === 0x80 || type === 0x90 ) {
		noteOff( `m${ note }` );
	}
};
// Listeners rather than `onmidimessage`, so several synths on a page can share a controller.
const listen = () =>
	midi.inputs.forEach( ( input ) => input[ midiOn ? 'addEventListener' : 'removeEventListener' ]( 'midimessage', onMidi ) );

midiButton?.addEventListener( 'click', async () => {
	if ( ! midi ) {
		try {
			midi = await navigator.requestMIDIAccess();
		} catch {
			midiButton.textContent = 'MIDI blocked';
			return;
		}
		// A controller plugged in later plays without toggling again.
		midi.addEventListener( 'statechange', listen );
	}
	midiOn = ! midiOn;
	if ( ! midiOn ) {
		stopAll( 'm' );
	}
	listen();
	midiButton.setAttribute( 'aria-pressed', midiOn );
	midiButton.textContent = midiOn ? 'MIDI on' : 'MIDI off';
} );
