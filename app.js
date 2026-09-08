/**
 * app.js
 * -----------------------------------------------------------------------
 * Ties camera + GPS + device orientation + astro-math together to draw
 * live sky labels over the camera feed.
 * -----------------------------------------------------------------------
 */

(() => {
  const video = document.getElementById('camera-feed');
  const canvas = document.getElementById('sky-overlay');
  const ctx = canvas.getContext('2d');
  const startScreen = document.getElementById('start-screen');
  const startBtn = document.getElementById('start-btn');
  const statusEl = document.getElementById('status');
  const hud = document.getElementById('hud');

  // Assumed camera field of view (degrees). Real phone cameras vary
  // roughly 55-70 deg horizontal - tune this per device if labels drift.
  const FOV_H = 62;
  const FOV_V = 45;

  const state = {
    lat: null,
    lon: null,
    heading: 0,   // compass heading, degrees, 0 = North, clockwise
    pitch: 0,     // degrees above horizon the camera is pointing
    ready: false
  };

  let staticEquatorialCache = null; // stars don't move (ignoring precession for MVP)
  let dynamicObjects = [];          // sun/moon/planets, recomputed periodically

  // ---- Permissions & setup -----------------------------------------------

  async function startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false
    });
    video.srcObject = stream;
    await video.play();
  }

  function startGeolocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      navigator.geolocation.watchPosition(
        (pos) => {
          state.lat = pos.coords.latitude;
          state.lon = pos.coords.longitude;
          resolve();
        },
        (err) => reject(err),
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
    });
  }

  function computeCompassHeading(alpha, beta, gamma) {
    // Tilt-compensated compass heading from device orientation angles.
    const d2r = Math.PI / 180;
    const aRad = alpha * d2r, bRad = beta * d2r, gRad = gamma * d2r;

    const cA = Math.cos(aRad), sA = Math.sin(aRad);
    const cB = Math.cos(bRad), sB = Math.sin(bRad);
    const cG = Math.cos(gRad), sG = Math.sin(gRad);

    const rA = -cA * sG - sA * sB * cG;
    const rB = -sA * sG + cA * sB * cG;

    let heading = Math.atan2(rA, rB);
    if (heading < 0) heading += 2 * Math.PI;
    return heading * (180 / Math.PI);
  }

  function handleOrientation(event) {
    if (event.webkitCompassHeading !== undefined) {
      // iOS Safari gives true compass heading directly.
      state.heading = event.webkitCompassHeading;
    } else if (event.alpha !== null) {
      state.heading = computeCompassHeading(event.alpha, event.beta || 0, event.gamma || 0);
    }
    // Approximate pitch above horizon for a phone held in portrait,
    // camera pointing "forward". Tune the offset if labels sit high/low.
    const beta = event.beta || 90;
    state.pitch = beta - 90;
  }

  async function startOrientation() {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      // iOS 13+ requires an explicit user-gesture-triggered permission request.
      const perm = await DeviceOrientationEvent.requestPermission();
      if (perm !== 'granted') throw new Error('Orientation permission denied');
    }
    window.addEventListener('deviceorientationabsolute', handleOrientation, true);
    window.addEventListener('deviceorientation', handleOrientation, true);
  }

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  // ---- Sky object computation --------------------------------------------

  function refreshDynamicObjects() {
    const jd = AstroMath.toJulianDate(new Date());
    dynamicObjects = [
      AstroMath.sunPosition(jd),
      AstroMath.moonPosition(jd),
      ...AstroMath.allPlanetPositions(jd)
    ];
  }

  function getAllObjectsWithAltAz() {
    const jd = AstroMath.toJulianDate(new Date());
    const lst = AstroMath.lstDegrees(jd, state.lon);
    const results = [];

    for (const star of STAR_CATALOG) {
      const { alt, az } = AstroMath.equatorialToHorizontal(star.ra, star.dec, state.lat, lst);
      results.push({ name: star.name, alt, az, mag: star.mag, type: 'star' });
    }
    for (const obj of dynamicObjects) {
      const { alt, az } = AstroMath.equatorialToHorizontal(obj.ra, obj.dec, state.lat, lst);
      results.push({ name: obj.name, alt, az, mag: -1, type: 'solar-system' });
    }
    return results;
  }

  function altAzToScreen(alt, az) {
    let deltaAz = az - state.heading;
    while (deltaAz > 180) deltaAz -= 360;
    while (deltaAz < -180) deltaAz += 360;
    const deltaAlt = alt - state.pitch;

    if (Math.abs(deltaAz) > FOV_H / 2 || Math.abs(deltaAlt) > FOV_V / 2) return null;

    const x = canvas.width / 2 + (deltaAz / (FOV_H / 2)) * (canvas.width / 2);
    const y = canvas.height / 2 - (deltaAlt / (FOV_V / 2)) * (canvas.height / 2);
    return { x, y };
  }

  // ---- Rendering ----------------------------------------------------------

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (state.ready) {
      const objects = getAllObjectsWithAltAz();

      // Constellation lines first, underneath star dots
      ctx.strokeStyle = 'rgba(255, 90, 60, 0.45)';
      ctx.lineWidth = 1.5;
      for (const [name, lines] of Object.entries(CONSTELLATIONS)) {
        for (const [aName, bName] of lines) {
          const a = objects.find(o => o.name === aName);
          const b = objects.find(o => o.name === bName);
          if (!a || !b) continue;
          const pa = altAzToScreen(a.alt, a.az);
          const pb = altAzToScreen(b.alt, b.az);
          if (!pa || !pb) continue;
          ctx.beginPath();
          ctx.moveTo(pa.x, pa.y);
          ctx.lineTo(pb.x, pb.y);
          ctx.stroke();
        }
      }

      for (const obj of objects) {
        if (obj.alt < -2) continue; // below horizon, small margin for refraction
        const pos = altAzToScreen(obj.alt, obj.az);
        if (!pos) continue;

        const isSolarSystem = obj.type === 'solar-system';
        const radius = isSolarSystem ? 6 : Math.max(1.2, 4 - obj.mag * 0.6);

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = isSolarSystem ? '#ffb37a' : '#fff3ea';
        ctx.fill();

        ctx.font = isSolarSystem ? 'bold 14px sans-serif' : '11px sans-serif';
        ctx.fillStyle = 'rgba(255, 200, 170, 0.9)';
        ctx.fillText(obj.name, pos.x + radius + 4, pos.y + 4);
      }

      hud.textContent = `Heading ${state.heading.toFixed(0)}°  |  Pitch ${state.pitch.toFixed(0)}°  |  Lat ${state.lat.toFixed(2)}  Lon ${state.lon.toFixed(2)}`;
    }

    requestAnimationFrame(draw);
  }

  // ---- Boot -----------------------------------------------------------------

  startBtn.addEventListener('click', async () => {
    statusEl.textContent = 'Requesting permissions…';
    try {
      await startOrientation();
      await startCamera();
      await startGeolocation();

      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);

      refreshDynamicObjects();
      setInterval(refreshDynamicObjects, 30000); // Sun/Moon/planets move slowly

      state.ready = true;
      startScreen.style.display = 'none';
      requestAnimationFrame(draw);
    } catch (err) {
      statusEl.textContent = 'Error: ' + err.message + ' — check permissions and try again.';
    }
  });
})();
