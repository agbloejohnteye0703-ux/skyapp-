/**
 * constellations.js
 * -----------------------------------------------------------------------
 * Line segments for a handful of the most recognizable constellations,
 * expressed as pairs of star names that must exist in STAR_CATALOG.
 * Kept small on purpose - add more constellations by adding more line
 * arrays here, reusing stars already in the catalog or adding new ones.
 * -----------------------------------------------------------------------
 */

const CONSTELLATIONS = {
  "Ursa Major (Big Dipper)": [
    ["Dubhe", "Merak"], ["Merak", "Phecda"], ["Phecda", "Megrez"],
    ["Megrez", "Dubhe"], ["Megrez", "Alioth"], ["Alioth", "Mizar"],
    ["Mizar", "Alkaid"]
  ],
  "Orion": [
    ["Betelgeuse", "Bellatrix"], ["Bellatrix", "Mintaka"],
    ["Mintaka", "Alnilam"], ["Alnilam", "Alnitak"],
    ["Alnitak", "Saiph"], ["Saiph", "Rigel"], ["Rigel", "Mintaka"],
    ["Betelgeuse", "Alnitak"]
  ],
  "Cassiopeia": [
    ["Caph", "Schedar"], ["Schedar", "Navi"], ["Navi", "Ruchbah"], ["Ruchbah", "Segin"]
  ],
  "Crux (Southern Cross)": [
    ["Acrux", "Gacrux"], ["Mimosa", "Imai"]
  ],
  "Scorpius": [
    ["Graffias", "Dschubba"], ["Dschubba", "Antares"], ["Antares", "Sargas"], ["Sargas", "Shaula"]
  ],
  "Cygnus (Northern Cross)": [
    ["Deneb", "Sadr"], ["Sadr", "Albireo"], ["Fawaris", "Sadr"], ["Sadr", "Gienah Cygni"]
  ],
  "Leo": [
    ["Regulus", "Algieba"], ["Algieba", "Denebola"]
  ]
};
