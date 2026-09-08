/* =========================================================================
   SkyAR — AR sky viewer, extended build
   Data/engine credits: Astronomy Engine (MIT, cosinekitty) for Sun/Moon/
   planet positions; trimmed d3-celestial catalog (BSD-3-Clause, Olaf Frohn)
   for stars & constellations.
   ========================================================================= */

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
const BASE_FOV_DEG = 65; // assumed rear-camera horizontal FOV at 1x zoom

const state = {
  lat: null, lon: null,
  rawHeading: 0, heading: 0, pitch: 0, roll: 0,
  headingOffset: parseFloat(localStorage.getItem('skyar_heading_offset') || '0'),
  magLimit: 5.0,
  showLines: true,
  nightMode: localStorage.getItem('skyar_night_mode') === '1',
  zoom: 1,
  timeOffsetMin: 0,
  searchTarget: null,   // { name, kind: 'planet'|'star' }
  calibArmed: false,
  iss: null,            // { lat, lon, altKm, fetchedAt }
  lastRendered: [],     // objects drawn this frame, for tap-to-identify
};

const el = (id) => document.getElementById(id);
const video = el('camera-feed');
const canvas = el('sky-overlay');
const ctx = canvas.getContext('2d');

function effectiveNow() {
  return new Date(Date.now() + state.timeOffsetMin * 60000);
}
function effectiveFovDeg() {
  return Math.max(4, BASE_FOV_DEG / state.zoom);
}
function norm360(x) { return ((x % 360) + 360) % 360; }
function normPM180(x) { return ((x + 540) % 360) - 180; }

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resizeCanvas);

function showBanner(elm, msg, ms) {
  elm.textContent = msg;
  elm.classList.remove('hidden');
  clearTimeout(elm._t);
  elm._t = setTimeout(() => elm.classList.add('hidden'), ms || 4000);
}
function showError(msg) { showBanner(el('error-banner'), msg, 5000); }

/* ---------------------------------------------------------------------
   Camera
   --------------------------------------------------------------------- */
async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' } },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
}

/* ---------------------------------------------------------------------
   Location
   --------------------------------------------------------------------- */
function startLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation not supported'));
    navigator.geolocation.getCurrentPosition(
      (pos) => { state.lat = pos.coords.latitude; state.lon = pos.coords.longitude; resolve(); },
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000 }
    );
    navigator.geolocation.watchPosition(
      (pos) => { state.lat = pos.coords.latitude; state.lon = pos.coords.longitude; },
      () => {}, { enableHighAccuracy: true }
    );
  });
}

/* ---------------------------------------------------------------------
   Device orientation -> heading / pitch / roll (simplified model; see
   README for the fuller rotation-matrix upgrade path)
   --------------------------------------------------------------------- */
async function startOrientation() {
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    const perm = await DeviceOrientationEvent.requestPermission();
    if (perm !== 'granted') throw new Error('Motion/orientation permission denied');
  }
  const handler = (event) => {
    let heading;
    if (typeof event.webkitCompassHeading === 'number') {
      heading = event.webkitCompassHeading;
    } else if (event.alpha !== null) {
      heading = 360 - event.alpha;
      const angle = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
      heading += angle;
    } else return;
    state.rawHeading = norm360(heading);
    state.heading = norm360(state.rawHeading + state.headingOffset);
    state.pitch = (event.beta || 0) - 90;
    state.roll = event.gamma || 0;
  };
  const eventName = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
  window.addEventListener(eventName, handler, true);
}

/* ---------------------------------------------------------------------
   Star Alt/Az math
   --------------------------------------------------------------------- */
function localSiderealTimeDeg(date, lonDeg) {
  const JD = date.getTime() / 86400000 + 2440587.5;
  const T = (JD - 2451545.0) / 36525;
  let gmst = 280.46061837 + 360.98564736629 * (JD - 2451545.0) +
             0.000387933 * T * T - (T * T * T) / 38710000;
  return norm360(norm360(gmst) + lonDeg);
}
function raDecToAltAz(raDeg, decDeg, lstDeg, latDeg) {
  const H = normPM180(lstDeg - raDeg) * DEG;
  const dec = decDeg * DEG, lat = latDeg * DEG;
  const sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(H);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  let cosAz = (Math.sin(dec) - Math.sin(alt) * Math.sin(lat)) / (Math.cos(alt) * Math.cos(lat));
  cosAz = Math.max(-1, Math.min(1, cosAz));
  let az = Math.acos(cosAz);
  if (Math.sin(H) > 0) az = 2 * Math.PI - az;
  return { alt: alt * RAD, az: az * RAD };
}

/* ---------------------------------------------------------------------
   Projection: alt/az -> screen x/y (pinhole model, FOV shrinks with zoom)
   --------------------------------------------------------------------- */
function project(targetAlt, targetAz) {
  const az = targetAz * DEG, alt = targetAlt * DEG;
  const camAz = state.heading * DEG, camAlt = state.pitch * DEG;
  const dAz = az - camAz;
  const x = Math.cos(alt) * Math.sin(dAz);
  const y = Math.sin(alt);
  const z = Math.cos(alt) * Math.cos(dAz);
  const cosP = Math.cos(camAlt), sinP = Math.sin(camAlt);
  const yr = y * cosP - z * sinP;
  const zr = y * sinP + z * cosP;
  const xr = x;
  if (zr <= 0.02) return null;
  const f = (window.innerWidth / 2) / Math.tan((effectiveFovDeg() * DEG) / 2);
  let sx = (xr / zr) * f, sy = -(yr / zr) * f;
  const roll = -state.roll * DEG;
  const cosR = Math.cos(roll), sinR = Math.sin(roll);
  const rx = sx * cosR - sy * sinR, ry = sx * sinR + sy * cosR;
  return { x: window.innerWidth / 2 + rx, y: window.innerHeight / 2 + ry, angDist: Math.acos(Math.max(-1,Math.min(1,zr))) * RAD };
}

/* ---------------------------------------------------------------------
   ISS live position (real-time lat/lon/alt from a public API, converted
   to observer-relative alt/az with plain ECEF->ENU geometry — no SGP4
   needed since the API already gives current ground position)
   --------------------------------------------------------------------- */
async function pollISS() {
  try {
    const r = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
    const d = await r.json();
    state.iss = { lat: d.latitude, lon: d.longitude, altKm: d.altitude, fetchedAt: Date.now() };
  } catch (e) { /* non-critical; silently skip this cycle */ }
}
function issTopo() {
  if (!state.iss || Date.now() - state.iss.fetchedAt > 30000 || state.lat === null) return null;
  const Re = 6371;
  const obsLat = state.lat * DEG, obsLon = state.lon * DEG;
  const satLat = state.iss.lat * DEG, satLon = state.iss.lon * DEG;
  const rSat = Re + state.iss.altKm;
  const ox = Re * Math.cos(obsLat) * Math.cos(obsLon);
  const oy = Re * Math.cos(obsLat) * Math.sin(obsLon);
  const oz = Re * Math.sin(obsLat);
  const sx = rSat * Math.cos(satLat) * Math.cos(satLon);
  const sy = rSat * Math.cos(satLat) * Math.sin(satLon);
  const sz = rSat * Math.sin(satLat);
  const dx = sx - ox, dy = sy - oy, dz = sz - oz;
  const east = -Math.sin(obsLon) * dx + Math.cos(obsLon) * dy;
  const north = -Math.sin(obsLat) * Math.cos(obsLon) * dx - Math.sin(obsLat) * Math.sin(obsLon) * dy + Math.cos(obsLat) * dz;
  const up = Math.cos(obsLat) * Math.cos(obsLon) * dx + Math.cos(obsLat) * Math.sin(obsLon) * dy + Math.sin(obsLat) * dz;
  const range = Math.sqrt(dx*dx + dy*dy + dz*dz);
  const alt = Math.asin(up / range) * RAD;
  const az = norm360(Math.atan2(east, north) * RAD);
  return { alt, az };
}

/* ---------------------------------------------------------------------
   Load catalogs (now plain globals from the data .js files, no fetch)
   --------------------------------------------------------------------- */
const PLANETS = [
  { name: 'Sun', body: 'Sun', color: '#ffdd55', radius: 8 },
  { name: 'Moon', body: 'Moon', color: '#dddddd', radius: 7 },
  { name: 'Mercury', body: 'Mercury', color: '#bbbbbb', radius: 3 },
  { name: 'Venus', body: 'Venus', color: '#ffe9c2', radius: 4 },
  { name: 'Mars', body: 'Mars', color: '#ff8866', radius: 3 },
  { name: 'Jupiter', body: 'Jupiter', color: '#ffcc99', radius: 5 },
  { name: 'Saturn', body: 'Saturn', color: '#ffe6b3', radius: 4 },
];

/* ---------------------------------------------------------------------
   Close-up "telescope mode" renderers (illustrative, not real optical
   resolution — a phone camera can't resolve planetary disks; this mimics
   what Stellarium shows when you zoom into an object)
   --------------------------------------------------------------------- */
function drawMoonCloseup(cx, cy, r, now) {
  const ill = Astronomy.Illumination('Moon', now);
  const phaseCycle = Astronomy.MoonPhase(now);
  const fraction = ill.phase_fraction;
  const waxing = phaseCycle < 180;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = '#e8e6df';
  ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  const offset = r * (1 - 2 * fraction);
  const dir = waxing ? -1 : 1;
  ctx.beginPath(); ctx.arc(cx + dir * offset, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#14141a';
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
}
function drawSaturnCloseup(cx, cy, r) {
  ctx.save();
  ctx.strokeStyle = '#d8c79a'; ctx.lineWidth = Math.max(2, r * 0.22);
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 2.1, r * 0.55, -0.3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffe6b3';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.font = '10px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('rings not to scale', cx - r, cy + r * 2.4);
}
function drawJupiterCloseup(cx, cy, r, now) {
  ctx.fillStyle = '#ffcc99';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  try {
    const jm = Astronomy.JupiterMoons(now);
    const geoDist = Astronomy.Equator('Jupiter', now, new Astronomy.Observer(state.lat, state.lon, 0), true, true).dist;
    const f = (window.innerWidth / 2) / Math.tan((effectiveFovDeg() * DEG) / 2);
    const scale = Math.max(f * 6, 900); // exaggerate separation so moons are visible at typical zoom
    const moons = [jm.io, jm.europa, jm.ganymede, jm.callisto];
    const names = ['Io', 'Europa', 'Ganymede', 'Callisto'];
    ctx.fillStyle = '#fff8e0'; ctx.font = '9px sans-serif';
    moons.forEach((m, i) => {
      const dxDeg = (m.x / geoDist) * RAD;
      const dyDeg = (m.y / geoDist) * RAD;
      const mx = cx + dxDeg * DEG * scale;
      const my = cy - dyDeg * DEG * scale;
      ctx.beginPath(); ctx.arc(mx, my, 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillText(names[i], mx + 4, my + 3);
    });
  } catch (e) { /* skip moons if calc fails */ }
}

/* ---------------------------------------------------------------------
   Render loop
   --------------------------------------------------------------------- */
function drawFrame() {
  const now = effectiveNow();
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  state.lastRendered = [];

  if (state.lat === null) { requestAnimationFrame(drawFrame); return; }

  const lst = localSiderealTimeDeg(now, state.lon);
  const observer = new Astronomy.Observer(state.lat, state.lon, 0);
  const zoomedIn = state.zoom >= 3;

  // constellation lines
  if (state.showLines) {
    ctx.strokeStyle = 'rgba(120,170,255,0.45)'; ctx.lineWidth = 1;
    for (const c of CONSTELLATION_DATA) {
      for (const seg of c.lines) {
        let started = false; ctx.beginPath();
        for (const [ra, dec] of seg) {
          const { alt, az } = raDecToAltAz(ra, dec, lst, state.lat);
          if (alt < -5) { started = false; continue; }
          const p = project(alt, az);
          if (!p) { started = false; continue; }
          if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }
    }
  }

  // background stars
  ctx.fillStyle = '#ffffff';
  for (const [ra, dec, mag] of STAR_DATA) {
    if (mag > state.magLimit) continue;
    const { alt, az } = raDecToAltAz(ra, dec, lst, state.lat);
    if (alt < -2) continue;
    const p = project(alt, az);
    if (!p) continue;
    const r = Math.max(0.6, 2.6 - mag * 0.4);
    ctx.globalAlpha = Math.max(0.35, 1 - mag / 6);
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // named bright stars
  ctx.font = '12px -apple-system, sans-serif';
  for (const [name, ra, dec, mag] of NAMED_STAR_DATA) {
    const { alt, az } = raDecToAltAz(ra, dec, lst, state.lat);
    if (alt < -2) continue;
    const p = project(alt, az);
    if (!p) continue;
    ctx.beginPath(); ctx.fillStyle = '#ffffff';
    ctx.arc(p.x, p.y, Math.max(1.5, 3 - mag * 0.4), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#cfe6ff'; ctx.fillText(name, p.x + 6, p.y + 4);
    state.lastRendered.push({ name, kind: 'star', x: p.x, y: p.y, alt, az, mag });
  }

  // sun/moon/planets
  ctx.font = 'bold 12px -apple-system, sans-serif';
  for (const p of PLANETS) {
    try {
      const eq = Astronomy.Equator(p.body, now, observer, true, true);
      const hor = Astronomy.Horizon(now, observer, eq.ra * 15, eq.dec, 'normal');
      if (hor.altitude < -2) continue;
      const pt = project(hor.altitude, hor.azimuth);
      if (!pt) continue;

      if (zoomedIn && pt.angDist < 3) {
        const r = Math.max(p.radius * 2, 26);
        if (p.name === 'Moon') drawMoonCloseup(pt.x, pt.y, r, now);
        else if (p.name === 'Saturn') drawSaturnCloseup(pt.x, pt.y, r);
        else if (p.name === 'Jupiter') drawJupiterCloseup(pt.x, pt.y, r, now);
        else { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = '#fff';
        ctx.fillText(p.name, pt.x + r + 4, pt.y + 4);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, p.radius, 0, Math.PI * 2); ctx.fill();
        ctx.fillText(p.name, pt.x + p.radius + 4, pt.y + 4);
      }
      state.lastRendered.push({ name: p.name, kind: 'planet', x: pt.x, y: pt.y, alt: hor.altitude, az: hor.azimuth });
    } catch (e) { /* skip on calc edge case */ }
  }

  // ISS
  const iss = issTopo();
  if (iss && iss.alt > 0) {
    const pt = project(iss.alt, iss.az);
    if (pt) {
      ctx.fillStyle = '#9be8ff';
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillText('ISS', pt.x + 8, pt.y + 4);
      state.lastRendered.push({ name: 'ISS', kind: 'satellite', x: pt.x, y: pt.y, alt: iss.alt, az: iss.az });
    }
  }

  // search target: highlight if in view, else draw a directional arrow
  if (state.searchTarget) {
    const hit = state.lastRendered.find(o => o.name === state.searchTarget.name);
    if (hit) {
      el('find-arrow').classList.add('hidden'); el('find-label').classList.add('hidden');
      ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 2;
      const pulse = 14 + 4 * Math.sin(Date.now() / 200);
      ctx.beginPath(); ctx.arc(hit.x, hit.y, pulse, 0, Math.PI * 2); ctx.stroke();
    } else {
      updateFindArrow(now, observer);
    }
  }

  // center crosshair
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
  const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
  ctx.beginPath(); ctx.moveTo(cx - 8, cy); ctx.lineTo(cx + 8, cy);
  ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy + 8); ctx.stroke();

  el('hud-time').textContent = state.timeOffsetMin === 0 ? now.toLocaleTimeString() : now.toLocaleString();
  el('hud-coords').textContent = `${state.lat.toFixed(2)}°, ${state.lon.toFixed(2)}°`;

  requestAnimationFrame(drawFrame);
}

function findTargetAltAz(target, now, lst, observer) {
  if (target.kind === 'planet') {
    const p = PLANETS.find(pp => pp.name === target.name);
    const eq = Astronomy.Equator(p.body, now, observer, true, true);
    const hor = Astronomy.Horizon(now, observer, eq.ra * 15, eq.dec, 'normal');
    return { alt: hor.altitude, az: hor.azimuth };
  }
  const star = NAMED_STAR_DATA.find(s => s[0] === target.name);
  if (!star) return null;
  return raDecToAltAz(star[1], star[2], lst, state.lat);
}

function updateFindArrow(now, observer) {
  const lst = localSiderealTimeDeg(now, state.lon);
  const pos = findTargetAltAz(state.searchTarget, now, lst, observer);
  if (!pos) return;
  const dAz = normPM180(pos.az - state.heading);
  const dAlt = pos.alt - state.pitch;
  const screenAngle = Math.atan2(dAz, dAlt) * RAD; // 0 = up, +90 = right
  const arrow = el('find-arrow'), label = el('find-label');
  const cx = window.innerWidth / 2, cy = window.innerHeight / 2 - 40;
  arrow.style.left = (cx - 16) + 'px'; arrow.style.top = (cy - 16) + 'px';
  arrow.style.transform = `rotate(${screenAngle}deg)`;
  arrow.classList.remove('hidden');
  label.textContent = `${state.searchTarget.name} — ${Math.round(Math.hypot(dAz, dAlt))}° away`;
  label.style.left = (cx - 60) + 'px'; label.style.top = (cy + 24) + 'px';
  label.classList.remove('hidden');
}

/* ---------------------------------------------------------------------
   Meteor shower banner
   --------------------------------------------------------------------- */
function updateShowerBanner() {
  const active = getActiveMeteorShowers(new Date());
  const banner = el('shower-banner');
  if (active.length > 0) {
    banner.textContent = '🌠 ' + active.map(s => `${s.name} (radiant: ${s.radiant})`).join(', ') + ' — active now';
    banner.classList.remove('hidden');
    return;
  }
  const next = getNextMeteorShower(new Date());
  if (next) {
    banner.textContent = `🌠 Next: ${next.shower.name} in ${next.days} day${next.days === 1 ? '' : 's'} (peaks ${next.shower.peak[0]}/${next.shower.peak[1]}, radiant: ${next.shower.radiant})`;
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

/* ---------------------------------------------------------------------
   Tap-to-identify
   --------------------------------------------------------------------- */
canvas.addEventListener('click', (e) => {
  const x = e.clientX, y = e.clientY;
  let best = null, bestD = 30;
  for (const o of state.lastRendered) {
    const d = Math.hypot(o.x - x, o.y - y);
    if (d < bestD) { bestD = d; best = o; }
  }
  if (!best) return;
  el('info-name').textContent = best.name;
  let detail = `Altitude ${best.alt.toFixed(1)}°, azimuth ${best.az.toFixed(1)}°`;
  if (best.kind === 'planet' && BODY_FACTS[best.name]) detail = BODY_FACTS[best.name] + ' ' + detail;
  if (best.kind === 'star') detail = `Magnitude ${best.mag}. ` + detail;
  if (best.kind === 'satellite') detail = 'The International Space Station, live position. ' + detail;
  el('info-detail').textContent = detail;
  el('info-panel').classList.remove('hidden');
});
el('info-close').onclick = () => el('info-panel').classList.add('hidden');

/* ---------------------------------------------------------------------
   Calibration (heading offset against Sun or Moon)
   --------------------------------------------------------------------- */
el('calib-btn').onclick = () => {
  const now = effectiveNow();
  const observer = new Astronomy.Observer(state.lat, state.lon, 0);
  let target = null;
  for (const name of ['Moon', 'Sun']) {
    const p = PLANETS.find(pp => pp.name === name);
    const eq = Astronomy.Equator(p.body, now, observer, true, true);
    const hor = Astronomy.Horizon(now, observer, eq.ra * 15, eq.dec, 'normal');
    if (hor.altitude > 10) { target = { name, az: hor.azimuth }; break; }
  }
  if (!target) {
    showBanner(el('error-banner'), 'Moon and Sun are both below the horizon right now — can\'t calibrate.', 4000);
    return;
  }
  if (!state.calibArmed) {
    state.calibArmed = true;
    el('calib-btn').textContent = 'confirm';
    showBanner(el('calib-banner'), `Center the crosshair exactly on the ${target.name}, then tap "confirm."`, 8000);
  } else {
    const offset = normPM180(target.az - state.rawHeading);
    state.headingOffset = offset;
    localStorage.setItem('skyar_heading_offset', String(offset));
    state.calibArmed = false;
    el('calib-btn').textContent = 'calibrate';
    showBanner(el('calib-banner'), `Calibrated using the ${target.name}. Offset saved.`, 3000);
  }
};

/* ---------------------------------------------------------------------
   Search
   --------------------------------------------------------------------- */
function searchCandidates() {
  return [...PLANETS.map(p => ({ name: p.name, kind: 'planet' })),
          ...NAMED_STAR_DATA.map(s => ({ name: s[0], kind: 'star' }))];
}
el('search-toggle').onclick = () => { el('search-bar').classList.remove('hidden'); el('search-input').focus(); };
el('search-close').onclick = () => {
  el('search-bar').classList.add('hidden');
  state.searchTarget = null;
  el('find-arrow').classList.add('hidden'); el('find-label').classList.add('hidden');
};
el('search-go').onclick = () => {
  const q = el('search-input').value.trim().toLowerCase();
  if (!q) return;
  const match = searchCandidates().find(c => c.name.toLowerCase().includes(q));
  if (!match) { showError(`No object matching "${q}" in the catalog.`); return; }
  state.searchTarget = match;
  el('search-bar').classList.add('hidden');
};

/* ---------------------------------------------------------------------
   Time travel
   --------------------------------------------------------------------- */
el('time-toggle').onclick = () => el('time-panel').classList.toggle('hidden');
el('time-slider').oninput = (e) => {
  state.timeOffsetMin = parseInt(e.target.value, 10);
  const t = effectiveNow();
  el('time-readout').textContent = state.timeOffsetMin === 0 ? 'Now' : t.toLocaleString();
};
el('time-reset').onclick = () => {
  state.timeOffsetMin = 0;
  el('time-slider').value = 0;
  el('time-readout').textContent = 'Now';
};

/* ---------------------------------------------------------------------
   Zoom (digital crop via CSS transform + shrinking effective FOV; a
   phone's web camera API can't request true optical zoom on iOS Safari)
   --------------------------------------------------------------------- */
function applyZoom() {
  video.style.transform = `scale(${state.zoom})`;
  el('zoom-level').textContent = state.zoom.toFixed(1) + '×';
}
el('zoom-in').onclick = () => { state.zoom = Math.min(6, +(state.zoom + 0.5).toFixed(1)); applyZoom(); };
el('zoom-out').onclick = () => { state.zoom = Math.max(1, +(state.zoom - 0.5).toFixed(1)); applyZoom(); };

let pinchStartDist = null, pinchStartZoom = 1;
canvas.addEventListener('touchstart', (e) => {
  if (e.touches.length === 2) {
    pinchStartDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    pinchStartZoom = state.zoom;
  }
});
canvas.addEventListener('touchmove', (e) => {
  if (e.touches.length === 2 && pinchStartDist) {
    const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    state.zoom = Math.max(1, Math.min(6, pinchStartZoom * (d / pinchStartDist)));
    applyZoom();
  }
});
canvas.addEventListener('touchend', () => { pinchStartDist = null; });

/* ---------------------------------------------------------------------
   Night mode
   --------------------------------------------------------------------- */
function applyNightMode() {
  document.body.classList.toggle('night-mode', state.nightMode);
}
el('night-toggle').onclick = () => {
  state.nightMode = !state.nightMode;
  localStorage.setItem('skyar_night_mode', state.nightMode ? '1' : '0');
  applyNightMode();
};

/* ---------------------------------------------------------------------
   Screenshot / share (composites live video + overlay canvas)
   --------------------------------------------------------------------- */
el('shot-btn').onclick = async () => {
  try {
    const w = window.innerWidth, h = window.innerHeight;
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    const octx = out.getContext('2d');
    const vw = video.videoWidth, vh = video.videoHeight;
    if (vw && vh) {
      const scale = Math.max(w / vw, h / vh) * state.zoom;
      const dw = vw * scale, dh = vh * scale;
      octx.drawImage(video, (w - dw) / 2, (h - dh) / 2, dw, dh);
    }
    octx.drawImage(canvas, 0, 0, w, h);
    out.toBlob(async (blob) => {
      const file = new File([blob], `skyar-${Date.now()}.png`, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'SkyAR snapshot' });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = file.name; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
    }, 'image/png');
  } catch (e) { showError('Could not save snapshot.'); }
};

/* ---------------------------------------------------------------------
   Simple HUD wiring
   --------------------------------------------------------------------- */
el('mag-up').onclick = () => { state.magLimit = Math.min(6, state.magLimit + 0.5); el('hud-mag').textContent = `mag ${state.magLimit.toFixed(1)}`; };
el('mag-down').onclick = () => { state.magLimit = Math.max(2, state.magLimit - 0.5); el('hud-mag').textContent = `mag ${state.magLimit.toFixed(1)}`; };
el('toggle-lines').onclick = () => { state.showLines = !state.showLines; };

/* ---------------------------------------------------------------------
   Start flow
   --------------------------------------------------------------------- */
el('start-btn').addEventListener('click', async () => {
  el('start-btn').disabled = true;
  const status = el('status');
  try {
    status.textContent = 'Requesting camera…';
    await startCamera();
    status.textContent = 'Requesting location…';
    await startLocation();
    status.textContent = 'Requesting motion/orientation…';
    await startOrientation();

    resizeCanvas();
    applyNightMode();
    applyZoom();
    updateShowerBanner();
    pollISS();
    setInterval(pollISS, 15000);

    el('start-screen').classList.add('hidden');
    ['hud', 'search-toggle', 'time-travel', 'zoom-controls'].forEach(id => el(id).classList.remove('hidden'));
    requestAnimationFrame(drawFrame);
  } catch (err) {
    console.error(err);
    status.textContent = err.message || 'Something went wrong. Check permissions and try again.';
    el('start-btn').disabled = false;
  }
});

/* =========================================================================
   NEXT STEPS
   1. Full rotation-matrix orientation fusion for better accuracy at odd
      tilt angles (current model is simplified heading+pitch).
   2. Calibration currently only corrects heading (compass); a second
      pitch-calibration step would help too.
   3. ISS shows live position only, not upcoming visible-pass predictions
      (would need orbital propagation over time, not just current fix).
   4. Screenshot compositing approximates the video's on-screen crop; it
      may not pixel-match the zoomed view exactly in every case.
   ========================================================================= */
