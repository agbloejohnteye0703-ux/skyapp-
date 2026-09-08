/**
 * stars-catalog.js
 * -----------------------------------------------------------------------
 * A compact, hand-curated catalog of the brightest naked-eye stars.
 * Coordinates are J2000 epoch, in decimal degrees. Magnitude is visual
 * apparent magnitude (lower = brighter).
 *
 * This is an MVP-sized catalog (~65 stars) chosen to cover every star
 * commonly used for navigation/orientation plus enough stars to draw a
 * handful of recognizable constellations. For a production app, swap
 * this file for a trimmed Yale Bright Star Catalog / Hipparcos extract
 * (still only a few hundred KB for all naked-eye stars down to mag 6).
 * -----------------------------------------------------------------------
 */

const STAR_CATALOG = [
  { name: "Sirius",      ra: 101.287, dec: -16.716, mag: -1.46 },
  { name: "Canopus",     ra: 95.988,  dec: -52.696, mag: -0.74 },
  { name: "Alpha Centauri", ra: 219.900, dec: -60.834, mag: -0.27 },
  { name: "Arcturus",    ra: 213.916, dec: 19.182,  mag: -0.05 },
  { name: "Vega",        ra: 279.234, dec: 38.784,  mag: 0.03 },
  { name: "Capella",     ra: 79.172,  dec: 45.998,  mag: 0.08 },
  { name: "Rigel",       ra: 78.634,  dec: -8.202,  mag: 0.13 },
  { name: "Procyon",     ra: 114.825, dec: 5.225,   mag: 0.34 },
  { name: "Betelgeuse",  ra: 88.793,  dec: 7.407,   mag: 0.42 },
  { name: "Achernar",    ra: 24.429,  dec: -57.237, mag: 0.46 },
  { name: "Hadar",       ra: 210.956, dec: -60.373, mag: 0.61 },
  { name: "Altair",      ra: 297.696, dec: 8.868,   mag: 0.76 },
  { name: "Acrux",       ra: 186.650, dec: -63.099, mag: 0.77 },
  { name: "Aldebaran",   ra: 68.980,  dec: 16.509,  mag: 0.85 },
  { name: "Spica",       ra: 201.298, dec: -11.161, mag: 1.04 },
  { name: "Antares",     ra: 247.350, dec: -26.432, mag: 1.09 },
  { name: "Pollux",      ra: 116.329, dec: 28.026,  mag: 1.14 },
  { name: "Fomalhaut",   ra: 344.413, dec: -29.622, mag: 1.16 },
  { name: "Deneb",       ra: 310.358, dec: 45.280,  mag: 1.25 },
  { name: "Mimosa",      ra: 191.930, dec: -59.689, mag: 1.25 },
  { name: "Regulus",     ra: 152.093, dec: 11.967,  mag: 1.36 },
  { name: "Adhara",      ra: 104.656, dec: -28.972, mag: 1.50 },
  { name: "Castor",      ra: 113.650, dec: 31.888,  mag: 1.58 },
  { name: "Shaula",      ra: 263.400, dec: -37.104, mag: 1.62 },
  { name: "Gacrux",      ra: 187.790, dec: -57.113, mag: 1.64 },
  { name: "Bellatrix",   ra: 81.283,  dec: 6.350,   mag: 1.64 },
  { name: "Elnath",      ra: 81.573,  dec: 28.608,  mag: 1.65 },
  { name: "Miaplacidus", ra: 138.300, dec: -69.720, mag: 1.69 },
  { name: "Alnilam",     ra: 84.053,  dec: -1.202,  mag: 1.69 },
  { name: "Alnitak",     ra: 85.190,  dec: -1.943,  mag: 1.77 },
  { name: "Mintaka",     ra: 83.002,  dec: -0.299,  mag: 2.23 },
  { name: "Alioth",      ra: 193.507, dec: 55.960,  mag: 1.77 },
  { name: "Kaus Australis", ra: 276.043, dec: -34.385, mag: 1.85 },
  { name: "Mirfak",      ra: 51.081,  dec: 49.861,  mag: 1.79 },
  { name: "Dubhe",       ra: 165.932, dec: 61.751,  mag: 1.79 },
  { name: "Merak",       ra: 165.460, dec: 56.382,  mag: 2.37 },
  { name: "Phecda",      ra: 178.458, dec: 53.695,  mag: 2.44 },
  { name: "Megrez",      ra: 183.857, dec: 57.033,  mag: 3.31 },
  { name: "Alkaid",      ra: 206.885, dec: 49.313,  mag: 1.86 },
  { name: "Mizar",       ra: 200.981, dec: 54.925,  mag: 2.23 },
  { name: "Wezen",       ra: 107.098, dec: -26.393, mag: 1.83 },
  { name: "Sargas",      ra: 264.330, dec: -42.998, mag: 1.87 },
  { name: "Avior",       ra: 125.628, dec: -59.510, mag: 1.86 },
  { name: "Menkalinan",  ra: 89.882,  dec: 44.947,  mag: 1.90 },
  { name: "Atria",       ra: 252.166, dec: -69.028, mag: 1.91 },
  { name: "Alhena",      ra: 99.428,  dec: 16.399,  mag: 1.93 },
  { name: "Peacock",     ra: 306.412, dec: -56.735, mag: 1.94 },
  { name: "Polaris",     ra: 37.955,  dec: 89.264,  mag: 1.98 },
  { name: "Mirzam",      ra: 95.675,  dec: -17.956, mag: 1.98 },
  { name: "Alphard",     ra: 141.897, dec: -8.659,  mag: 1.98 },
  { name: "Hamal",       ra: 31.793,  dec: 23.462,  mag: 2.00 },
  { name: "Algieba",     ra: 154.993, dec: 19.842,  mag: 2.08 },
  { name: "Diphda",      ra: 10.897,  dec: -17.987, mag: 2.04 },
  { name: "Nunki",       ra: 283.816, dec: -26.297, mag: 2.05 },
  { name: "Menkent",     ra: 211.671, dec: -36.370, mag: 2.06 },
  { name: "Mirach",      ra: 17.433,  dec: 35.621,  mag: 2.07 },
  { name: "Alpheratz",   ra: 2.097,   dec: 29.091,  mag: 2.07 },
  { name: "Rasalhague",  ra: 263.734, dec: 12.560,  mag: 2.08 },
  { name: "Kochab",      ra: 222.677, dec: 74.156,  mag: 2.08 },
  { name: "Saiph",       ra: 86.939,  dec: -9.670,  mag: 2.09 },
  { name: "Denebola",    ra: 177.265, dec: 14.572,  mag: 2.14 },
  { name: "Algol",       ra: 47.042,  dec: 40.956,  mag: 2.12 },
  { name: "Schedar",     ra: 10.127,  dec: 56.537,  mag: 2.24 },
  { name: "Caph",        ra: 2.294,   dec: 59.150,  mag: 2.28 },
  { name: "Navi",        ra: 14.177,  dec: 60.717,  mag: 2.47 },
  { name: "Ruchbah",     ra: 21.454,  dec: 60.235,  mag: 2.68 },
  { name: "Segin",       ra: 28.599,  dec: 63.670,  mag: 3.35 },
  { name: "Imai",        ra: 183.786, dec: -58.749, mag: 2.79 },
  { name: "Dschubba",    ra: 240.083, dec: -22.622, mag: 2.32 },
  { name: "Graffias",    ra: 241.359, dec: -19.805, mag: 2.56 },
  { name: "Sadr",        ra: 305.557, dec: 40.257,  mag: 2.23 },
  { name: "Albireo",     ra: 292.680, dec: 27.960,  mag: 2.90 },
  { name: "Gienah Cygni", ra: 311.553, dec: 33.970, mag: 2.46 },
  { name: "Fawaris",     ra: 296.244, dec: 45.131,  mag: 2.87 },
  { name: "Markab",      ra: 346.190, dec: 15.205,  mag: 2.49 },
  { name: "Scheat",      ra: 345.944, dec: 28.083,  mag: 2.42 }
];
