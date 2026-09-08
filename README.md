# SkyAR — extended build

Point your phone's camera at the sky and see stars, constellations, the Sun,
Moon, planets, and the ISS labeled live — plus search, time travel, a
Stellarium-style zoomed close-up view, and more.

## Files (all flat in the repo root — no subfolders, matches your existing repo)

```
index.html            page shell + all UI controls
style.css              styling, incl. night-vision red mode
app.js                  all app logic
astronomy-engine.js     Astronomy Engine (MIT) — Sun/Moon/planet positions
star-data.js            ~1,600 stars, mag <= 5.0 (d3-celestial, BSD-3-Clause)
named-star-data.js      ~60 famous bright stars with labels
constellation-data.js   89 constellation stick-figure lines
almanac-data.js         meteor shower calendar + short planet/Moon/Sun facts
```

To update your live site: replace each file in your GitHub repo with the
matching file here (same filenames, so no path changes needed), then give
GitHub Pages a minute or two to rebuild.

## What's new since the MVP

- **Calibration** - tap "calibrate," center the crosshair on the Sun or Moon
  (whichever is above the horizon), tap "confirm." Corrects compass drift;
  the offset is saved on your device (localStorage) so it persists.
- **Tap-to-identify** - tap any rendered star, planet, or the ISS to see its
  name and a short fact/detail panel.
- **Night-vision mode** (moon button) - tints the whole UI red to protect
  your night vision outdoors.
- **Search** (magnifier button) - type a planet or named star, and either it
  highlights on screen if it's in view, or an arrow shows which way to turn.
- **Time travel** (clock button) - a slider to preview the sky up to 2 days
  before/after now, without moving the phone. "Reset to now" snaps back.
- **Meteor shower banner** - flags major annual showers (Perseids, Geminids,
  etc.) automatically when today's date falls in their active window; when
  none are active, shows a countdown to the next one instead.
- **ISS** - live position from a public API (api.wheretheiss.at), plotted
  like any other object when it's above your horizon.
- **Screenshot / share** (camera button) - composites the live camera +
  overlay into one image and opens the share sheet (or downloads it).
- **Pinch-to-zoom** - pinch on the sky view (or use the +/- buttons) to
  digitally zoom up to 6x. Past 3x zoom, centering on the Moon, Saturn, or
  Jupiter switches to an illustrative close-up: Moon shows its current
  phase shading, Saturn shows its rings, Jupiter shows its four Galilean
  moons in their current positions.

## Two things worth knowing

- **This isn't real optical/telescope zoom.** iOS Safari doesn't expose
  camera zoom control through the web camera API, so "zoom" here digitally
  scales the live video (like pinch-zooming a photo) - it doesn't add real
  resolution. The planet close-ups are illustrative renders (phase, rings,
  moon positions computed for real), not actual photographs - a phone
  camera physically can't resolve a planetary disk regardless of software.
- **ISS shows live position only, not upcoming visible passes.** True pass
  prediction (which nights it'll be bright enough to see, from your exact
  location) needs orbital propagation over time (SGP4), not just a current
  position fix. That's a reasonable next feature if you want it.

## Known limitations carried over from the MVP

- Orientation uses a simplified heading+pitch model rather than a full
  3-axis rotation matrix, so accuracy degrades a bit at extreme tilt angles.
- Compass accuracy still depends on the phone's magnetometer - the
  calibration feature helps but won't fix magnetic interference nearby.
- No atmospheric refraction correction near the horizon.
