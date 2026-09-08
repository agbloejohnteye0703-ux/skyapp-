// Major annual meteor showers: fixed calendar events, no live data needed.
// start/end/peak are [month, day] (peak month/day repeated across years is a
// reasonable approximation for this purpose).
const METEOR_SHOWERS = [
  { name: 'Quadrantids', radiant: 'Boötes', start: [12, 28], end: [1, 12], peak: [1, 3] },
  { name: 'Lyrids', radiant: 'Lyra', start: [4, 14], end: [4, 30], peak: [4, 22] },
  { name: 'Eta Aquariids', radiant: 'Aquarius', start: [4, 19], end: [5, 28], peak: [5, 5] },
  { name: 'Southern Delta Aquariids', radiant: 'Aquarius', start: [7, 12], end: [8, 23], peak: [7, 30] },
  { name: 'Perseids', radiant: 'Perseus', start: [7, 17], end: [8, 24], peak: [8, 12] },
  { name: 'Orionids', radiant: 'Orion', start: [10, 2], end: [11, 7], peak: [10, 21] },
  { name: 'Southern Taurids', radiant: 'Taurus', start: [9, 10], end: [11, 20], peak: [11, 5] },
  { name: 'Leonids', radiant: 'Leo', start: [11, 6], end: [11, 30], peak: [11, 17] },
  { name: 'Geminids', radiant: 'Gemini', start: [12, 4], end: [12, 20], peak: [12, 14] },
  { name: 'Ursids', radiant: 'Ursa Minor', start: [12, 17], end: [12, 26], peak: [12, 22] },
];

// Short static facts for the tap-to-identify panel. Distances for planets are
// average Sun distance (AU); actual Earth-planet distance varies constantly,
// which is why it's phrased as "orbits at" rather than "is currently at."
const BODY_FACTS = {
  Sun: 'Our star. About 149.6 million km (1 AU) from Earth on average.',
  Moon: "Earth's only natural satellite. Averages 384,400 km away.",
  Mercury: 'Smallest planet, closest to the Sun. Orbits at 0.39 AU.',
  Venus: "Earth's near-twin in size, but with a crushing, scorching atmosphere. Orbits at 0.72 AU.",
  Mars: 'The "Red Planet," named for iron oxide on its surface. Orbits at 1.52 AU.',
  Jupiter: 'Largest planet in the solar system. Its four biggest moons are visible with binoculars. Orbits at 5.2 AU.',
  Saturn: 'Famous for its ring system, made of ice and rock. Orbits at 9.5 AU.',
};

function getActiveMeteorShowers(date) {
  const m = date.getMonth() + 1, d = date.getDate();
  const inRange = (start, end) => {
    const val = m * 100 + d;
    const s = start[0] * 100 + start[1];
    const e = end[0] * 100 + end[1];
    return s <= e ? (val >= s && val <= e) : (val >= s || val <= e); // handles wrap over New Year
  };
  return METEOR_SHOWERS.filter(sh => inRange(sh.start, sh.end));
}

// Days until the next shower's peak, wrapping to next year if this year's
// peak has already passed. Used when nothing is actively in-range right now.
function getNextMeteorShower(date) {
  const msPerDay = 86400000;
  let best = null, bestDays = Infinity;
  for (const sh of METEOR_SHOWERS) {
    let peak = new Date(date.getFullYear(), sh.peak[0] - 1, sh.peak[1]);
    if (peak < date) peak = new Date(date.getFullYear() + 1, sh.peak[0] - 1, sh.peak[1]);
    const days = Math.ceil((peak - date) / msPerDay);
    if (days < bestDays) { bestDays = days; best = sh; }
  }
  return best ? { shower: best, days: bestDays } : null;
}
