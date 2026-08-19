import assert from 'node:assert/strict';
import test from 'node:test';

import SyllableCounter, {
  countSyllables,
  hyphenate,
  splitSyllables,
} from '../src/syllable-counter.js';

const counter = new SyllableCounter();

/** Runs one subtest per row of a table. */
function table(t, rows, assertion) {
  return Promise.all(rows.map((row) => t.test(String(row[0]), () => assertion(...row))));
}

const counts = (t, rows) => table(t, rows, (name, expected) => {
  assert.equal(counter.count(name), expected);
});

const hyphenations = (t, rows) => table(t, rows, (name, expected) => {
  assert.equal(counter.hyphenate(name), expected);
});

test('counts syllables by vowel nucleus', (t) => counts(t, [
  // Simple Dutch names / controls
  ['Anne', 2],
  ['Emma', 2],
  ['Noah', 2],
  ['Liam', 2],
  ['Bo', 1],
  ['Guus', 1],
  ['Sem', 1],
  ['Julia', 3],
  ['Lucas', 2],
  ['Sanne', 2],
  ['Fenna', 2],

  // ph digraph (foreign /f/ spelling)
  ['Sophie', 2],
  ['Stephan', 2],
  ['Daphne', 2],

  // -ie ending stays a single nucleus
  ['Marie', 2],
  ['Rosalie', 3],
  ['Melanie', 3],
  ['Steffie', 2],
  ['Bonnie', 2],

  // Latinate/Greek vowel hiatus (ia/io/eo/ea)
  ['Sophia', 3],
  ['Maria', 3],
  ['Olivia', 4],
  ['Amelia', 4],
  ['Victoria', 4],
  ['Mia', 2],
  ['Leo', 2],
  ['Theo', 2],
  ['Matteo', 3],
  ['Rio', 2],
  ['Mario', 3],
  ['Antonio', 4],
  ['Andrea', 3],
  ['Thea', 2],
  ['Isabella', 4],
  ['Elena', 3],
  ['Nathan', 2],

  // Dutch diphthongs stay a single nucleus
  ['Thijs', 1],
  ['Fleur', 1],
  ['Marijn', 2],
  ['Bauke', 2],
  ['Loes', 1],

  // y as glide vs vowel
  ['Yara', 2],
  ['Maya', 2],
  ['Kayla', 2],
  ['Lydia', 3],

  // Diaeresis forces a hiatus split
  ['Zoë', 2],
  ['Chloë', 2],
  ['Cataleya', 4],
]));

test('splits a name into orthographic syllables', (t) => hyphenations(t, [
  // Single syllable / controls
  ['Bram', 'Bram'],
  ['Guus', 'Guus'],
  ['Thijs', 'Thijs'],
  ['Fleur', 'Fleur'],
  ['Emma', 'Em-ma'],
  ['Willem', 'Wil-lem'],
  ['Noah', 'No-ah'],

  // Maximal onset: single consonant to the next syllable
  ['Sophie', 'So-phie'],
  ['Lydia', 'Ly-di-a'],
  ['Julia', 'Ju-li-a'],

  // Latinate hiatus splits between the vowels
  ['Sophia', 'So-phi-a'],
  ['Olivia', 'O-li-vi-a'],
  ['Amelia', 'A-me-li-a'],
  ['Antonio', 'An-to-ni-o'],
  ['Matteo', 'Mat-te-o'],

  // Double consonant splits down the middle
  ['Isabella', 'I-sa-bel-la'],

  // Cluster kept together as a valid onset
  ['Andrea', 'An-dre-a'],
  ['Rachel', 'Ra-chel'],

  // Diaeresis forces a split and stays in the output
  ['Zoë', 'Zo-ë'],
  ['Chloë', 'Chlo-ë'],

  // y as glide vs vowel
  ['Maya', 'Ma-ya'],
  ['Cataleya', 'Ca-ta-le-ya'],
]));

test('treats qu as a single consonant cluster', (t) => table(t, [
  ['Quinten', 2, 'Quin-ten'],
  ['Quentin', 2, 'Quen-tin'],
  ['Monique', 2, 'Mo-nique'],
  ['Dominique', 3, 'Do-mi-nique'],
  ['Jacqueline', 4, 'Jac-que-li-ne'],
], (name, expected, hyphenated) => {
  assert.equal(counter.count(name), expected);
  assert.equal(counter.hyphenate(name), hyphenated);
}));

test('drops the mute final e after c or qu', (t) => counts(t, [
  ['Florence', 2],
  ['Alice', 2],
  ['Grace', 1],
  ['Maurice', 2],
  ['Constance', 2],
  ['Vince', 1],
]));

test('keeps the pronounced dutch final e', (t) => counts(t, [
  ['Anne', 2],
  ['Jelle', 2],
  ['Hanne', 2],
  ['Eline', 3],
  ['Lotte', 2],
  ['Elise', 3],
  ['Femke', 2],
  // Turkish names ending in -ce do pronounce the final e
  ['Hatice', 3],
  ['Ece', 2],
]));

test('treats an accented vowel as its own nucleus', (t) => table(t, [
  // Without the accent flag, "oé" would be read as the digraph "oe" and end up
  // on a single syllable.
  ['Chloé', 2, 'Chlo-é'],
  ['Zoé', 2, 'Zo-é'],
  ['Léa', 2, 'Lé-a'],
  // But "ée" stays a single nucleus: the accent sits on the first vowel.
  ['Renée', 2, 'Re-née'],
  ['Aurélie', 3, 'Au-ré-lie'],
], (name, expected, hyphenated) => {
  assert.equal(counter.count(name), expected);
  assert.equal(counter.hyphenate(name), hyphenated);
}));

test('falls back to the exception list for irregular names', (t) => table(t, [
  ['James', 1, 'James'],
  ['Maeve', 1, 'Maeve'],
  ['Gabriel', 3, 'Ga-bri-el'],
  ['Daniel', 3, 'Da-ni-el'],
], (name, expected, hyphenated) => {
  assert.equal(counter.count(name), expected);
  assert.equal(counter.hyphenate(name), hyphenated);
}));

test('keeps the original casing and accents when an exception applies', () => {
  assert.equal(counter.hyphenate('GABRIEL'), 'GA-BRI-EL');
});

test('lets a known mute final e override the spelling heuristic', (t) => table(t, [
  // Same ending, different answer: only per-name knowledge can settle this.
  ['Céline', true, 2, 'Cé-line'],
  ['Eline', false, 3, 'E-li-ne'],
  ['Maxime', true, 2, 'Ma-xime'],
  ['Guillaume', true, 2, 'Guil-laume'],
  ['Océane', true, 3, 'O-cé-ane'],
  // And the other way around: false overrides the -ce rule for Turkish names.
  ['Hatice', false, 3, 'Ha-ti-ce'],
], (name, mute, expected, hyphenated) => {
  assert.equal(counter.count(name, mute), expected);
  assert.equal(counter.hyphenate(name, '-', mute), hyphenated);
}));

test('applies the mute final e to the last word only', () => {
  assert.equal(counter.hyphenate('Marie-Alice', '-', true), 'Ma-rie-A-lice');
});

test('keeps s-clusters closed when splitting inside a word', (t) => hyphenations(t, [
  ['Jasmijn', 'Jas-mijn'],
  ['Esmee', 'Es-mee'],
  ['Kasper', 'Kas-per'],
  ['Christiaan', 'Chris-ti-aan'],
  ['Sebastiaan', 'Se-bas-ti-aan'],
]));

test('returns the syllables as an array', () => {
  assert.deepEqual(counter.split('Sophia'), ['So', 'phi', 'a']);
  assert.deepEqual(counter.split('Anne-Marie'), ['An', 'ne', 'Ma', 'rie']);
});

test('sums syllables across multi-word names', () => {
  assert.equal(counter.count('Anne-Marie'), 4);
  assert.equal(counter.count('Mary Lou'), 3);
});

test('never returns less than one syllable', () => {
  assert.equal(counter.count('-'), 1);
  assert.equal(counter.count(''), 1);
});

test('accepts extra exceptions, overriding the built-in ones', () => {
  const custom = new SyllableCounter({ ilse: ['il', 'se'], james: ['ja', 'mes'] });

  assert.equal(custom.hyphenate('Ilse'), 'Il-se');
  assert.equal(custom.hyphenate('James'), 'Ja-mes');
  // The built-in list is untouched for other instances.
  assert.equal(counter.hyphenate('James'), 'James');
});

test('accepts extra exceptions as a Map', () => {
  const custom = new SyllableCounter(new Map([['ilse', ['il', 'se']]]));

  assert.equal(custom.count('Ilse'), 2);
});

test('ignores an exception that does not match the length of the input', () => {
  const custom = new SyllableCounter({ noor: ['no', 'or', 'tje'] });

  assert.equal(custom.hyphenate('Noor'), 'Noor');
});

test('exposes helper functions using the built-in exceptions', () => {
  assert.equal(countSyllables('Sophia'), 3);
  assert.deepEqual(splitSyllables('Sophia'), ['So', 'phi', 'a']);
  assert.equal(hyphenate('Olivia'), 'O-li-vi-a');
  assert.equal(hyphenate('Sophia', '·'), 'So·phi·a');
  assert.equal(countSyllables('Céline', true), 2);
});
