# SkyAR — MVP

Point your phone's camera at the sky and see stars, planets, the Sun and
Moon labeled in real time, using your camera + GPS + motion sensors.
No native app build, no npm install — plain HTML/CSS/JS.

## What's inside

```
skyar/
  index.html          the app shell
  css/style.css        night-vision-friendly (dim red/amber) UI
  js/astro-math.js      self-contained astronomy math (Sun/Moon/planets)
  js/stars-catalog.js  ~70 bright naked-eye stars (J2000 RA/Dec, magnitude)
  js/constellations.js line data for a handful of recognizable constellations
  js/app.js            camera + GPS + compass wiring, and rendering loop
```

## Run it

**On a laptop first (fastest way to check it's alive):**
1. Open this folder in VS Code.
2. Install the "Live Server" extension (if you don't have it).
3. Right-click `index.html` → "Open with Live Server".
4. Click **Start**, allow camera + location. You won't get a real compass
   heading on a laptop, but you'll see stars/planets render and move as
   you change the system clock — confirms the math and rendering work.

**On your phone (the real use case):**
Camera, GPS, and motion-sensor APIs only work over **HTTPS** (or
`localhost`) in mobile browsers — this is a browser security rule, not
something in this code. Easiest ways to get there:
- Deploy the folder as a static site (Netlify, Vercel, GitHub Pages —
  all free, drag-and-drop the folder) and open that URL on your phone.
- Or run `npx serve` / VS Code Live Server on your laptop and tunnel it
  with `ngrok http <port>` to get a temporary HTTPS URL.

Once loaded on your phone: tap **Start**, allow all three permission
prompts (motion/orientation, camera, location), then hold the phone
upright and point it at the sky.

## How it works

- **`astro-math.js`** computes where the Sun, Moon, and planets are
  right now using standard orbital mechanics (Keplerian elements +
  Kepler's equation), and converts any object's sky coordinates
  (RA/Dec) into "how high above the horizon, and which compass
  direction" (altitude/azimuth) for your exact location and the
  current time. No external data files or network calls needed.
- **`stars-catalog.js`** is a small embedded list of bright stars —
  their sky coordinates don't change on human timescales, so they're
  just hardcoded.
- **`app.js`** reads your phone's compass heading and tilt (device
  orientation sensors), figures out where the camera is currently
  pointing, and draws a dot + label on the canvas for every object
  that falls within the camera's approximate field of view.

## Known MVP limitations (things to tighten up next)

- **Field of view is hardcoded** (`FOV_H` / `FOV_V` in `app.js`) — real
  phone cameras vary. If labels drift from real objects, adjust these
  first.
- **Projection is a simple linear mapping**, not a true perspective/lens
  projection — fine near the center of frame, gets less accurate near
  the edges.
- **Pitch calibration** (`state.pitch = beta - 90`) assumes the phone is
  held upright in portrait mode. Landscape use, or how "beta" behaves
  across Android vendors, will need per-device tuning.
- **Star catalog is ~70 stars**, hand-picked for brightness and
  constellation coverage — swap in a full Yale Bright Star Catalog or
  Hipparcos extract (still just a few hundred KB) for denser skies.
- **Moon position accuracy is ~0.1–0.3°** (a few Moon-widths) — fine
  for pointing a phone at it, not for precision work.
- No offline caching / service worker yet — add one if you want it to
  work without a network connection once loaded.

## Extending it

- More constellations: add star entries to `stars-catalog.js`, then
  add a line list to `constellations.js`.
- Deep-sky objects (nebulae, star clusters): add a similar static
  catalog file and merge it into `getAllObjectsWithAltAz()` in
  `app.js`.
- Tap-to-identify: since everything's already drawn as canvas shapes
  with known screen coordinates, add a `click`/`touch` listener that
  finds the nearest rendered object to the tap point.
