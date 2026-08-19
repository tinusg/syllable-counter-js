/**
 * Splits a name into syllables based on vowel nuclei.
 *
 * A syllable has exactly one vowel nucleus. We determine the nuclei —
 * adjacent vowels form a single nucleus when they spell a Dutch (or common
 * international) diphthong or long vowel (e.g. "ie", "eu", "aa", "oe"), and
 * separate nuclei on hiatus (e.g. "ia" in So-phi-a, "eo" in Le-o) — and then
 * divide the consonants in between using the maximal onset principle: a
 * consonant cluster moves to the following syllable as far as it still forms a
 * valid Dutch onset.
 *
 * The result is the orthographic hyphenation (So-phi-a), not a phonetic
 * transcription.
 */

/** Vowels that always count as a nucleus on their own. */
const BASE_VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

/** Vowel trigraphs that form a single nucleus. */
const TRIGRAPHS = new Set(['aai', 'ooi', 'oei', 'eeu', 'ieu', 'eau']);

/**
 * Vowel digraphs (diphthongs and long vowels) that form a single nucleus.
 * Ambiguous pairs such as "ea"/"oe"/"ie" follow the most common Dutch
 * reading; an explicit diaeresis (ë/ï) still forces a split.
 */
const DIGRAPHS = new Set([
  'aa', 'ee', 'oo', 'uu',
  'ie', 'ei', 'ui', 'ou', 'au', 'oe', 'eu', 'ae',
  'ai', 'ay', 'ey', 'oy', 'uy', 'ij', 'oi',
]);

/**
 * Valid initial consonant clusters (onsets). A cluster between two nuclei
 * shifts as far as possible into the following syllable as long as its
 * trailing part is in this set (maximal onset); a single consonant is always a
 * valid onset.
 */
const ONSETS = new Set([
  'chr', 'phr', 'thr',
  'bl', 'br', 'ch', 'cl', 'cr',
  'dr', 'dw', 'fj', 'fl', 'fr',
  'gl', 'gn', 'gr', 'kl', 'kn',
  'kr', 'kw', 'pf', 'ph', 'pl',
  'pr', 'qu', 'sh', 'sj', 'th',
  'tj', 'tr', 'tw', 'vl', 'vr',
  'wr', 'zw',
]);

/**
 * Vowels carrying a diaeresis mark a forced hiatus: they always start a new
 * syllable.
 */
const DIAERESIS = new Map([
  ['ë', 'e'], ['ï', 'i'], ['ü', 'u'], ['ö', 'o'], ['ä', 'a'], ['ÿ', 'y'],
]);

/** Remaining diacritics reduced to their base letter. */
const ACCENTS = new Map([
  ['à', 'a'], ['á', 'a'], ['â', 'a'], ['ã', 'a'], ['å', 'a'],
  ['è', 'e'], ['é', 'e'], ['ê', 'e'],
  ['ì', 'i'], ['í', 'i'], ['î', 'i'],
  ['ò', 'o'], ['ó', 'o'], ['ô', 'o'], ['õ', 'o'],
  ['ù', 'u'], ['ú', 'u'], ['û', 'u'],
  ['ý', 'y'], ['ç', 'c'], ['ñ', 'n'],
]);

/**
 * Names that break every Dutch spelling rule and can only be handled as an
 * exception. Each entry lists the syllables in lower case; the original is cut
 * at those same lengths, so capitals and accents are preserved.
 */
const EXCEPTIONS = new Map([
  ['james', ['james']],
  ['george', ['george']],
  ['maeve', ['maeve']],
  ['sean', ['sean']],
  ['shane', ['shane']],
  ['blake', ['blake']],
  ['wayne', ['wayne']],
  ['dwayne', ['dwayne']],
  ['saoirse', ['saoir', 'se']],
  // French "ea" is a single sound here: "Zjan-ne", not "Je-an-ne".
  ['jeanne', ['jean', 'ne']],
  ['jean', ['jean']],
  // Without a diaeresis or accent, "oe" would be read as a digraph and end up
  // on a single syllable.
  ['zoe', ['zo', 'e']],
  ['chloe', ['chlo', 'e']],
  ['noe', ['no', 'e']],
  // Latin/Hebrew -iel names: the "ie" is a hiatus here, not a digraph.
  ['gabriel', ['ga', 'bri', 'el']],
  ['daniel', ['da', 'ni', 'el']],
  ['nathaniel', ['na', 'tha', 'ni', 'el']],
  ['muriel', ['mu', 'ri', 'el']],
  ['ariel', ['a', 'ri', 'el']],
  ['giulia', ['giu', 'lia']],
  ['giulio', ['giu', 'lio']],
  // Turkish names ending in -ce do pronounce the final e (the mirror image of
  // the mute-e rule).
  ['hatice', ['ha', 'ti', 'ce']],
  ['tugce', ['tug', 'ce']],
  ['gulce', ['gul', 'ce']],
  ['ece', ['e', 'ce']],
  ['sence', ['sen', 'ce']],
  ['bence', ['ben', 'ce']],
]);

/** Word boundaries: whitespace and hyphens. */
const BOUNDARIES = /[\s-]+/u;

/** Characters of a string, code point by code point. */
function characters(value) {
  return [...value];
}

export class SyllableCounter {
  /**
   * @param {Record<string, string[]>|Map<string, string[]>|Iterable<[string, string[]]>} [exceptions]
   *        Extra word => syllables pairs, e.g. `{ ilse: ['il', 'se'] }`. An
   *        entry overrides a built-in exception with the same key.
   */
  constructor(exceptions = {}) {
    this.exceptions = new Map(EXCEPTIONS);

    const entries = exceptions instanceof Map || Symbol.iterator in Object(exceptions)
      ? exceptions
      : Object.entries(exceptions);

    for (const [word, parts] of entries) {
      this.exceptions.set(String(word).toLowerCase(), [...parts]);
    }
  }

  /**
   * The number of syllables in a name. Runs through split() so counting and
   * hyphenating always agree.
   *
   * @param {string} value
   * @param {boolean|null} [muteFinalE] See split().
   * @returns {number}
   */
  count(value, muteFinalE = null) {
    return Math.max(1, this.split(value, muteFinalE).length);
  }

  /**
   * The name divided into syllables, preserving capitals and accents (e.g.
   * "Sophia" => ["So", "phi", "a"]). Word boundaries (spaces, hyphens) are
   * dropped; every word contributes its own syllables.
   *
   * @param {string} value
   * @param {boolean|null} [muteFinalE] Whether the final e of this name is
   *        mute. Whether a final e is pronounced depends on the origin of the
   *        name rather than on its spelling — Céline (mute) and Eline
   *        (pronounced) share the same "-ine" ending — so it can only be
   *        settled per name. `null` leaves the decision to the spelling
   *        heuristic.
   * @returns {string[]}
   */
  split(value, muteFinalE = null) {
    const syllables = [];
    const tokens = tokenize(value);
    const lastIndex = tokens.length - 1;

    tokens.forEach((token, index) => {
      // The final e of a name lives in its last word: "Marie-Alice".
      const mute = index === lastIndex ? muteFinalE : null;

      syllables.push(...(this.exceptionFor(token) ?? syllablesForToken(token, mute)));
    });

    return syllables;
  }

  /**
   * The name as hyphenated text, for example "So-phi-a".
   *
   * @param {string} value
   * @param {string} [separator]
   * @param {boolean|null} [muteFinalE]
   * @returns {string}
   */
  hyphenate(value, separator = '-', muteFinalE = null) {
    return this.split(value, muteFinalE).join(separator);
  }

  /**
   * The exception for this word, cut out of the original so capitals and
   * accents are kept; null when there is no exception or it does not fit the
   * name.
   *
   * @param {string} token
   * @returns {string[]|null}
   */
  exceptionFor(token) {
    const parts = this.exceptions.get(token.toLowerCase());

    if (parts === undefined) {
      return null;
    }

    const original = characters(token);
    const syllables = [];
    let offset = 0;

    for (const part of parts) {
      const length = characters(part).length;

      syllables.push(original.slice(offset, offset + length).join(''));
      offset += length;
    }

    return offset === original.length ? syllables : null;
  }
}

/**
 * Split on word boundaries (spaces and hyphens); empty parts are dropped.
 *
 * @param {string} value
 * @returns {string[]}
 */
function tokenize(value) {
  return String(value).split(BOUNDARIES).filter((token) => token !== '');
}

/**
 * @param {string} token
 * @param {boolean|null} muteFinalE
 * @returns {string[]}
 */
function syllablesForToken(token, muteFinalE = null) {
  const original = characters(token);
  const spans = nucleiSpans(token, muteFinalE);

  if (spans.length <= 1) {
    return token === '' ? [] : [token];
  }

  const { lower } = classify(token);

  // Determine the start index in the original word for every boundary.
  const boundaries = [];

  for (let k = 0; k < spans.length - 1; k++) {
    const gapStart = spans[k].end + 1;
    const gapEnd = spans[k + 1].start - 1;
    const gapLength = gapEnd - gapStart + 1;

    if (gapLength <= 0) {
      boundaries.push(spans[k + 1].start);

      continue;
    }

    const onset = onsetLength(lower.slice(gapStart, gapStart + gapLength));

    boundaries.push(spans[k + 1].start - onset);
  }

  // Cut the original word at those boundaries.
  const syllables = [];
  let previous = 0;

  for (const boundary of boundaries) {
    syllables.push(original.slice(previous, boundary).join(''));
    previous = boundary;
  }

  syllables.push(original.slice(previous).join(''));

  return syllables;
}

/**
 * The vowel nuclei of a word as index spans over the original characters.
 *
 * @param {string} token
 * @param {boolean|null} muteFinalE
 * @returns {{start: number, end: number}[]}
 */
function nucleiSpans(token, muteFinalE = null) {
  const { lower, forced } = classify(token);
  const count = lower.length;
  const spans = [];
  let index = 0;

  while (index < count) {
    if (!isVowel(lower, index, muteFinalE)) {
      index++;

      continue;
    }

    // Collect the indices of the adjacent vowels.
    const run = [];

    while (index < count && isVowel(lower, index, muteFinalE)) {
      run.push(index);
      index++;
    }

    spans.push(...splitRunIntoNuclei(run, lower, forced));
  }

  return spans;
}

/**
 * Divides a single vowel run into nuclei with a greedy match on the known tri-
 * and digraphs; a diaeresis always breaks a digraph open.
 *
 * @param {number[]} run Indices of the consecutive vowels.
 * @param {string[]} lower
 * @param {boolean[]} forced
 * @returns {{start: number, end: number}[]}
 */
function splitRunIntoNuclei(run, lower, forced) {
  const spans = [];
  const length = run.length;
  let position = 0;

  while (position < length) {
    let size = 1;

    const trigraph = position + 3 <= length
      ? lower[run[position]] + lower[run[position + 1]] + lower[run[position + 2]]
      : null;
    const digraph = position + 2 <= length
      ? lower[run[position]] + lower[run[position + 1]]
      : null;

    if (
      trigraph !== null
      && TRIGRAPHS.has(trigraph)
      && !forced[run[position + 1]]
      && !forced[run[position + 2]]
    ) {
      size = 3;
    } else if (
      digraph !== null
      && DIGRAPHS.has(digraph)
      && !forced[run[position + 1]]
    ) {
      size = 2;
    }

    spans.push({ start: run[position], end: run[position + size - 1] });
    position += size;
  }

  return spans;
}

/**
 * The length of the maximal valid onset at the end of a consonant cluster; at
 * least 1 (a single consonant always starts the next syllable, V-CV).
 *
 * @param {string[]} consonants
 * @returns {number}
 */
function onsetLength(consonants) {
  const length = consonants.length;

  for (let size = Math.min(3, length); size >= 2; size--) {
    if (ONSETS.has(consonants.slice(length - size).join(''))) {
      return size;
    }
  }

  return 1;
}

/**
 * Lower-cases a word and strips its accents, remembering which positions
 * carried a diaeresis (forced hiatus).
 *
 * @param {string} token
 * @returns {{lower: string[], forced: boolean[]}}
 */
function classify(token) {
  const lower = [];
  const forced = [];

  for (const character of characters(token.toLowerCase())) {
    if (DIAERESIS.has(character)) {
      lower.push(DIAERESIS.get(character));
      forced.push(true);

      continue;
    }

    // An accent marks its own, pronounced vowel too: without this flag "Chloé"
    // would be read as the digraph "oe" and end up on a single syllable.
    if (ACCENTS.has(character)) {
      lower.push(ACCENTS.get(character));
      forced.push(true);

      continue;
    }

    lower.push(character);
    forced.push(false);
  }

  return { lower, forced };
}

/**
 * Whether the character at this position counts as a vowel. "y" is a glide
 * (consonant) when a vowel follows directly (e.g. "Ya-ra", "Ma-ya"), and a
 * vowel otherwise (e.g. the "y" in "Ly-dia").
 *
 * @param {string[]} lower
 * @param {number} index
 * @param {boolean|null} muteFinalE
 * @returns {boolean}
 */
function isVowel(lower, index, muteFinalE = null) {
  const character = lower[index];

  // The "u" after a "q" belongs to the consonant /kw/ and is not a nucleus of
  // its own (Quinten, Monique).
  if (character === 'u' && index > 0 && lower[index - 1] === 'q') {
    return false;
  }

  if (character === 'e' && index === lower.length - 1 && index > 0) {
    // If we know this name, that knowledge beats the spelling.
    if (muteFinalE !== null && muteFinalE !== undefined) {
      return !muteFinalE;
    }

    // Otherwise only the heuristic that is safe: after "c" or "qu" the Dutch
    // final e (the one that does sound as a schwa) does not occur, so the e is
    // mute there (Alice, Florence, Monique). Wider endings such as -ne or -lle
    // would break Eline, Hanne and Jelle.
    const previous = lower[index - 1];

    if (previous === 'c' || (previous === 'u' && lower[index - 2] === 'q')) {
      return false;
    }
  }

  if (BASE_VOWELS.has(character)) {
    return true;
  }

  if (character === 'y') {
    return !BASE_VOWELS.has(lower[index + 1] ?? '');
  }

  return false;
}

/** A shared counter with the built-in exceptions, for the helper functions. */
const shared = new SyllableCounter();

/**
 * The number of syllables in a name, using the built-in exceptions.
 *
 * @param {string} value
 * @param {boolean|null} [muteFinalE]
 * @returns {number}
 */
export function countSyllables(value, muteFinalE = null) {
  return shared.count(value, muteFinalE);
}

/**
 * The syllables of a name, using the built-in exceptions.
 *
 * @param {string} value
 * @param {boolean|null} [muteFinalE]
 * @returns {string[]}
 */
export function splitSyllables(value, muteFinalE = null) {
  return shared.split(value, muteFinalE);
}

/**
 * The name as hyphenated text, using the built-in exceptions.
 *
 * @param {string} value
 * @param {string} [separator]
 * @param {boolean|null} [muteFinalE]
 * @returns {string}
 */
export function hyphenate(value, separator = '-', muteFinalE = null) {
  return shared.hyphenate(value, separator, muteFinalE);
}

export default SyllableCounter;
