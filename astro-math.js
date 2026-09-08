/**
 * astro-math.js
 * -----------------------------------------------------------------------
 * Self-contained, dependency-free astronomical position calculator.
 *
 * Scope / accuracy (deliberately "miniaturized" for a phone app):
 *   - Sun position:      accurate to roughly ~0.01 deg
 *   - Planet positions:  accurate to roughly a few arcminutes (1800-2050)
 *   - Moon position:     accurate to roughly 0.1-0.3 deg (good enough to
 *                         point a phone at it, not for occultation timing)
 *
 * This trades the "hundreds of MB of ephemeris files" approach (what
 * real observatory software / full NOVAS uses) for compact closed-form
 * approximations using standard Keplerian orbital elements. That's the
 * same tradeoff libraries like "Astronomy Engine" and "suncalc" make -
 * small code, no external data files, plenty accurate for a naked-eye
 * sky viewer.
 * -----------------------------------------------------------------------
 */

const AstroMath = (() => {

  const DEG2RAD = Math.PI / 180;
  const RAD2DEG = 180 / Math.PI;

  function sind(deg) { return Math.sin(deg * DEG2RAD); }
  function cosd(deg) { return Math.cos(deg * DEG2RAD); }
  function tand(deg) { return Math.tan(deg * DEG2RAD); }
  function atan2d(y, x) { return Math.atan2(y, x) * RAD2DEG; }
  function asind(x) { return Math.asin(x) * RAD2DEG; }
  function acosd(x) { return Math.acos(x) * RAD2DEG; }

  // Normalize an angle in degrees to [0, 360)
  function norm360(deg) {
    let d = deg % 360;
    if (d < 0) d += 360;
    return d;
  }

  // ---- Time -------------------------------------------------------------

  // Julian Date from a JS Date object (UTC)
  function toJulianDate(date) {
    return date.getTime() / 86400000 + 2440587.5;
  }

  // Julian centuries since J2000.0
  function julianCenturies(jd) {
    return (jd - 2451545.0) / 36525;
  }

  // Greenwich Mean Sidereal Time, in degrees
  function gmstDegrees(jd) {
    const T = julianCenturies(jd);
    let gmst = 280.46061837 +
      360.98564736629 * (jd - 2451545.0) +
      0.000387933 * T * T -
      (T * T * T) / 38710000;
    return norm360(gmst);
  }

  // Local Sidereal Time in degrees, given longitude in degrees (east positive)
  function lstDegrees(jd, lonDeg) {
    return norm360(gmstDegrees(jd) + lonDeg);
  }

  // ---- Coordinate transforms ---------------------------------------------

  // Equatorial (RA in degrees, Dec in degrees) -> Horizontal (Alt, Az in degrees)
  // latDeg: observer latitude, lstDeg: local sidereal time in degrees
  function equatorialToHorizontal(raDeg, decDeg, latDeg, lstDeg) {
    const haDeg = norm360(lstDeg - raDeg); // Hour angle
    const alt = asind(sind(decDeg) * sind(latDeg) + cosd(decDeg) * cosd(latDeg) * cosd(haDeg));
    let az = atan2d(
      -sind(haDeg),
      tand(decDeg) * cosd(latDeg) - sind(latDeg) * cosd(haDeg)
    );
    az = norm360(az);
    return { alt, az };
  }

  // Ecliptic (lon, lat in degrees) -> Equatorial (RA, Dec in degrees)
  function eclipticToEquatorial(lonDeg, latDeg, obliquityDeg) {
    const ra = atan2d(
      sind(lonDeg) * cosd(obliquityDeg) - tand(latDeg) * sind(obliquityDeg),
      cosd(lonDeg)
    );
    const dec = asind(
      sind(latDeg) * cosd(obliquityDeg) + cosd(latDeg) * sind(obliquityDeg) * sind(lonDeg)
    );
    return { ra: norm360(ra), dec };
  }

  function obliquityOfEcliptic(T) {
    // Mean obliquity, IAU 1980-ish approximation, good to arcseconds
    return 23.4392911 - 0.0130042 * T - 1.64e-7 * T * T + 5.04e-7 * T * T * T;
  }

  // ---- Sun ----------------------------------------------------------------

  function sunPosition(jd) {
    const T = julianCenturies(jd);
    const L0 = norm360(280.46646 + 36000.76983 * T + 0.0003032 * T * T); // mean longitude
    const M = norm360(357.52911 + 35999.05029 * T - 0.0001537 * T * T);  // mean anomaly
    const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * sind(M) +
              (0.019993 - 0.000101 * T) * sind(2 * M) +
              0.000289 * sind(3 * M);
    const trueLon = L0 + C;
    const obliquity = obliquityOfEcliptic(T);
    const eq = eclipticToEquatorial(trueLon, 0, obliquity);
    return { ra: eq.ra, dec: eq.dec, name: 'Sun' };
  }

  // ---- Moon (low-precision periodic-term approximation) -------------------

  function moonPosition(jd) {
    const T = julianCenturies(jd);
    const Lp = norm360(218.3164477 + 481267.88123421 * T); // mean longitude
    const D = norm360(297.8501921 + 445267.1114034 * T);   // mean elongation
    const M = norm360(357.5291092 + 35999.0502909 * T);    // sun mean anomaly
    const Mp = norm360(134.9633964 + 477198.8675055 * T);  // moon mean anomaly
    const F = norm360(93.2720950 + 483202.0175233 * T);    // argument of latitude

    // Dominant periodic terms only (a handful of the largest, out of ~60
    // used by full lunar theory) - enough for pointing accuracy.
    let lon = Lp
      + 6.288774 * sind(Mp)
      + 1.274027 * sind(2 * D - Mp)
      + 0.658314 * sind(2 * D)
      + 0.213618 * sind(2 * Mp)
      - 0.185116 * sind(M)
      - 0.114332 * sind(2 * F);

    let lat = 5.128122 * sind(F)
      + 0.280602 * sind(Mp + F)
      + 0.277693 * sind(Mp - F)
      + 0.173237 * sind(2 * D - F);

    lon = norm360(lon);

    const obliquity = obliquityOfEcliptic(T);
    const eq = eclipticToEquatorial(lon, lat, obliquity);
    return { ra: eq.ra, dec: eq.dec, name: 'Moon' };
  }

  // ---- Planets (approximate Keplerian elements, JPL-style) ----------------
  // Elements at J2000 plus linear rates per Julian century.
  // a: semi-major axis (AU), e: eccentricity, I: inclination (deg)
  // L: mean longitude (deg), varpi: longitude of perihelion (deg)
  // Omega: longitude of ascending node (deg)
  const PLANET_ELEMENTS = {
    Mercury: { a: [0.38709927, 0.00000037], e: [0.20563593, 0.00001906], I: [7.00497902, -0.00594749],
      L: [252.25032350, 149472.67411175], varpi: [77.45779628, 0.16047689], Omega: [48.33076593, -0.12534081] },
    Venus:   { a: [0.72333566, 0.00000390], e: [0.00677672, -0.00004107], I: [3.39467605, -0.00078890],
      L: [181.97909950, 58517.81538729], varpi: [131.60246718, 0.00268329], Omega: [76.67984255, -0.27769418] },
    Mars:    { a: [1.52371034, 0.00001847], e: [0.09339410, 0.00007882], I: [1.84969142, -0.00813131],
      L: [-4.55343205, 19140.30268499], varpi: [-23.94362959, 0.44441088], Omega: [49.55953891, -0.29257343] },
    Jupiter: { a: [5.20288700, -0.00011607], e: [0.04838624, -0.00013253], I: [1.30439695, -0.00183714],
      L: [34.39644051, 3034.74612775], varpi: [14.72847983, 0.21252668], Omega: [100.47390909, 0.20469106] },
    Saturn:  { a: [9.53667594, -0.00125060], e: [0.05386179, -0.00050991], I: [2.48599187, 0.00193609],
      L: [49.95424423, 1222.49362201], varpi: [92.59887831, -0.41897216], Omega: [113.66242448, -0.28867794] },
    Uranus:  { a: [19.18916464, -0.00196176], e: [0.04725744, -0.00004397], I: [0.77263783, -0.00242939],
      L: [313.23810451, 428.48202785], varpi: [170.95427630, 0.40805281], Omega: [74.01692503, 0.04240589] },
    Neptune: { a: [30.06992276, 0.00026291], e: [0.00859048, 0.00005105], I: [1.77004347, 0.00035372],
      L: [-55.12002969, 218.45945325], varpi: [44.96476227, -0.32241464], Omega: [131.78422574, -0.00508664] }
  };

  function solveKepler(Mdeg, e) {
    let M = Mdeg * DEG2RAD;
    let E = M;
    for (let i = 0; i < 8; i++) {
      E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    }
    return E * RAD2DEG;
  }

  function heliocentricPosition(elements, T) {
    const a = elements.a[0] + elements.a[1] * T;
    const e = elements.e[0] + elements.e[1] * T;
    const I = elements.I[0] + elements.I[1] * T;
    const L = elements.L[0] + elements.L[1] * T;
    const varpi = elements.varpi[0] + elements.varpi[1] * T;
    const Omega = elements.Omega[0] + elements.Omega[1] * T;

    const M = norm360(L - varpi);
    const w = varpi - Omega; // argument of perihelion
    const E = solveKepler(M, e);

    const xOrb = a * (cosd(E) - e);
    const yOrb = a * Math.sqrt(1 - e * e) * sind(E);

    // Rotate to ecliptic coordinates (J2000)
    const cosO = cosd(Omega), sinO = sind(Omega);
    const cosw = cosd(w), sinw = sind(w);
    const cosI = cosd(I), sinI = sind(I);

    const x = (cosw * cosO - sinw * sinO * cosI) * xOrb + (-sinw * cosO - cosw * sinO * cosI) * yOrb;
    const y = (cosw * sinO + sinw * cosO * cosI) * xOrb + (-sinw * sinO + cosw * cosO * cosI) * yOrb;
    const z = (sinw * sinI) * xOrb + (cosw * sinI) * yOrb;

    return { x, y, z };
  }

  function planetPosition(name, jd) {
    const T = julianCenturies(jd);
    const elements = PLANET_ELEMENTS[name];

    const planetHelio = heliocentricPosition(elements, T);
    const earthHelio = heliocentricPosition(PLANET_ELEMENTS.__EarthProxy || earthElements(), T);

    // geocentric ecliptic rectangular coordinates
    const x = planetHelio.x - earthHelio.x;
    const y = planetHelio.y - earthHelio.y;
    const z = planetHelio.z - earthHelio.z;

    const lon = norm360(atan2d(y, x));
    const dist = Math.sqrt(x * x + y * y + z * z);
    const lat = asind(z / dist);

    const obliquity = obliquityOfEcliptic(T);
    const eq = eclipticToEquatorial(lon, lat, obliquity);
    return { ra: eq.ra, dec: eq.dec, name };
  }

  // Earth's own elements (needed to compute geocentric planet positions)
  function earthElements() {
    return {
      a: [1.00000261, 0.00000562], e: [0.01671123, -0.00004392], I: [-0.00001531, -0.01294668],
      L: [100.46457166, 35999.37244981], varpi: [102.93768193, 0.32327364], Omega: [0.0, 0.0]
    };
  }

  function allPlanetPositions(jd) {
    return Object.keys(PLANET_ELEMENTS).map(name => planetPosition(name, jd));
  }

  return {
    toJulianDate,
    julianCenturies,
    lstDegrees,
    equatorialToHorizontal,
    sunPosition,
    moonPosition,
    allPlanetPositions,
    norm360
  };
})();
