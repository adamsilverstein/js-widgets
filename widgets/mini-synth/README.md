# Mini Synth

A small keyboard visitors can play, for music teachers, band sites and theory blogs. Sound comes from Web Audio oscillators, so there is nothing to download beyond the script.

```html
<script src="synth.min.js" data-octaves="2" data-wave="sine"></script>
```

## Options

| Attribute | Default | Description |
| --- | --- | --- |
| `data-octaves` | `2` | Number of octaves, `1` to `3`. The keyboard starts at middle C, or the C below it for three octaves, and ends on a C. |
| `data-wave` | `sine` | Starting waveform: `sine`, `triangle`, `square` or `sawtooth`. Visitors can change it. |
| `data-volume` | `50` | Starting volume, `0` to `100`. Visitors can change it. |

## Playing

- **Mouse and touch**: press a key, slide across keys, or hold several with more than one finger.
- **Computer keyboard**: focus any key (click it or Tab to it), then use the physical key positions below. The mapping is active only while a synth key has focus, so typing in a form or search box elsewhere on the page never plays notes. Enter and Space play the focused key.

  | Keys | Notes |
  | --- | --- |
  | `Z S X D C V G B H N J M` | Lower octave, C to B (`S D G H J` are the black keys) |
  | `, L . ; /` | Continue up from the next C |
  | `Q 2 W 3 E R 5 T 6 Y 7 U I 9 O 0 P` | One octave up, from the next C |

- **MIDI**: in browsers with Web MIDI, a "MIDI off" button appears. Turning it on asks for MIDI access, which may show a permission prompt, then any connected controller plays the synth, including one plugged in later.

## Notes

- No audio context is created and no sound is made until the visitor presses a key.
- Notes stop and audio is suspended when the tab is hidden.
- Keys are real buttons labelled with their note names (C4, C♯4, ...). On narrow layouts the black keys hide their visible text but keep their names for screen readers.
- Volume is capped per note, so a five note chord at full volume just reaches full scale.
- To embed the synth in an iframe and use MIDI, the iframe needs `allow="midi"`.
- No network requests.
