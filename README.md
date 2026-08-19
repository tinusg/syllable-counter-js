# Syllable Counter

Counts and hyphenates the syllables of Dutch — and Dutch-spelled international — names and words, without a dictionary, a pattern file or an API call. Pure spelling rules, one small module, **zero dependencies**, plain ES modules that run in Node and in the browser.

```js
counter.count('Sophia');      // 3
counter.hyphenate('Sophia');  // "So-phi-a"
counter.split('Sophia');      // ['So', 'phi', 'a']
```

[**Try it in your browser →**](https://tinusg.github.io/syllable-counter-demo/)

This is a vanilla JavaScript port of the PHP package [tinusg/syllable-counter](https://github.com/tinusg/syllable-counter); the rules, the exception list and the test table are the same, and both produce identical output.

## Installation

```bash
npm install @tinusg-npm/syllable-counter
```

Or drop `src/syllable-counter.js` into your project — it is a single file with no build step and no dependencies.

## Usage

```js
import { SyllableCounter } from '@tinusg-npm/syllable-counter';

const counter = new SyllableCounter();

counter.count('Olivia');      // 4
counter.hyphenate('Olivia');  // 'O-li-vi-a'
counter.split('Olivia');      // ['O', 'li', 'vi', 'a']
```

If you do not need your own exceptions, use the helper functions, which share one instance:

```js
import { countSyllables, hyphenate, splitSyllables } from '@tinusg-npm/syllable-counter';

countSyllables('Sophia');   // 3
hyphenate('Sophia');        // 'So-phi-a'
hyphenate('Sophia', '·');   // 'So·phi·a'
splitSyllables('Sophia');   // ['So', 'phi', 'a']
```

In the browser, straight from the file — no bundler required:

```html
<script type="module">
  import { hyphenate } from './src/syllable-counter.js';

  document.querySelector('#name').textContent = hyphenate('Sophia');
</script>
```

| Method | Returns | Example |
| --- | --- | --- |
| `count(value, muteFinalE = null)` | Number of syllables, never less than 1 | `count('Olivia')` → `4` |
| `split(value, muteFinalE = null)` | The syllables, casing and accents intact | `split('Sophia')` → `['So', 'phi', 'a']` |
| `hyphenate(value, separator = '-', muteFinalE = null)` | The hyphenated word | `hyphenate('Olivia')` → `'O-li-vi-a'` |

`count()` runs through `split()`, so counting and hyphenating can never disagree.

Spaces and hyphens are word boundaries; every word contributes its own syllables:

```js
counter.count('Anne-Marie');  // 4
counter.split('Anne-Marie');  // ['An', 'ne', 'Ma', 'rie']
```

TypeScript declarations ship with the package (`src/syllable-counter.d.ts`); the source itself is plain JavaScript with JSDoc.

## How it works

The whole thing rests on one rule: **a syllable has exactly one vowel nucleus.** So finding the nuclei and dividing the consonants between them gives you both the count and the hyphenation.

### 1. Normalise, but remember the accents

The word is lower-cased and diacritics are reduced to their base letter (`é` → `e`, `ç` → `c`). Positions that carried a **diaeresis or an accent are flagged**, because those mark a vowel that is pronounced on its own. Without that flag `Chloë` and `Chloé` would both read as the digraph `oe` and come out as one syllable; with it they correctly split into `Chlo-ë` and `Chlo-é`.

### 2. Find the vowel nuclei

Adjacent vowels are collected into runs, and each run is cut into nuclei with a greedy match on known vowel groups:

- **Trigraphs** — `aai`, `ooi`, `oei`, `eeu`, `ieu`, `eau` → one nucleus.
- **Digraphs** — `aa`, `ee`, `oo`, `uu`, `ie`, `ei`, `ui`, `ou`, `au`, `oe`, `eu`, `ae`, `ai`, `ay`, `ey`, `oy`, `uy`, `ij`, `oi` → one nucleus. So `Thijs`, `Fleur` and `Loes` are one syllable, and `Marie` is two.
- **Anything else adjacent is a hiatus** — two nuclei. That is what makes `So-phi-a`, `Le-o`, `Mat-te-o` and `An-to-ni-o` come out right; naive vowel-group counters collapse these into one.
- A flagged vowel (step 1) always breaks a group open, so `Zoë` never becomes one nucleus.

Two letters get special treatment:

- **`y` is a glide, not a vowel, when a vowel follows it** — `Ya-ra` and `Ma-ya` (2), but `Ly-di-a` (3), where the `y` is the nucleus.
- **`u` after `q` belongs to the /kw/ consonant** — `Quin-ten` (2), `Mo-nique` (2).

### 3. Divide the consonants: maximal onset

For the consonant cluster between two nuclei, as much of it as possible moves to the *following* syllable, as long as the part that moves is a valid Dutch onset (`br`, `chr`, `kn`, `zw`, `th`, …). A single consonant is always a valid onset, so V-CV is the default:

```
So-phie      ph is a valid onset, so it moves along
An-dre-a     dr is valid → An-dre-a, not And-re-a
I-sa-bel-la  ll is not an onset → the split falls in the middle
Chris-ti-aan st is not an onset → only t moves
```

### 4. The final e

Whether a final `e` is pronounced is not a spelling question — `Céline` (mute) and `Eline` (pronounced) share the same `-ine` ending — so it cannot be derived from the letters. The module handles this in two layers:

- **The safe heuristic.** After a `c` or `qu` the Dutch schwa-e simply does not occur, so there the `e` is mute: `Flo-rence` (2), `A-lice` (2), `Grace` (1). Wider rules (`-ne`, `-lle`) are deliberately *not* applied, because they would break `Han-ne`, `Jel-le` and `E-li-ne`.
- **Your own knowledge wins.** Pass `muteFinalE` when you know the answer for that specific name — from a database column, an editor, a lookup, an LLM:

```js
counter.count('Céline', true);   // 2 → Cé-line
counter.count('Eline', false);   // 3 → E-li-ne
counter.count('Hatice', false);  // 3 → Ha-ti-ce, overriding the -ce rule
```

`null` (the default) means "no knowledge, use the heuristic". The flag applies to the last word only, so `hyphenate('Marie-Alice', '-', true)` gives `Ma-rie-A-lice`.

### 5. Exceptions, last

A handful of names break every rule Dutch spelling has — `James` is one syllable, `Ga-bri-el` splits where the digraph rule says it should not, Turkish `-ce` names pronounce their final e. Those live in a small exception list that is checked before the rules run.

An exception stores the syllables in lower case; the original is then cut at those same lengths, so **capitals and accents survive**: `GABRIEL` → `GA-BRI-EL`. If the exception does not match the length of the input, it is ignored and the normal rules apply.

Pass your own to the constructor (an entry overrides a built-in one with the same key):

```js
const counter = new SyllableCounter({
  ilse: ['il', 'se'],
});

counter.hyphenate('Ilse');  // 'Il-se'
```

A `Map` (or any iterable of `[word, syllables]` pairs) works too, which is handy when the exceptions come from a database or a JSON file:

```js
const counter = new SyllableCounter(new Map(Object.entries(await loadExceptions())));
```

### What it does not do

It produces **orthographic hyphenation** (`So-phi-a`), not a phonetic transcription, and it is tuned for **names**. The rules are Dutch, so an English word with an English-only spelling pattern can come out wrong. It is a rule set, not an oracle — when you need a specific word to be exact, add an exception.

## Testing

```bash
npm test
```

The suite runs on Node's built-in test runner (`node --test`), so there is nothing to install. It is a large table of real names — Dutch, Turkish, Arabic, French, Latin, English — with their expected counts and hyphenations. If you find a name that comes out wrong, a pull request with that name added to the table is the most useful thing you can send.

## Demo

**[tinusg.github.io/syllable-counter-demo](https://tinusg.github.io/syllable-counter-demo/)** — type a name, see it split live.

`demo/index.html` in this repository is a smaller, self-contained version of the same thing that imports the module directly. Serve the repository over http and open it:

```bash
npx serve .
```

## Thanks

This package was extracted from the code that powers two Dutch sites, and it exists because they needed it:

- **[Naampedia](https://www.naampedia.nl)** — baby names, meanings, origins and popularity. The syllable rules here were written for its name pages and tested against tens of thousands of real first names.
- **[Puzzelpedia](https://www.puzzelpedia.nl)** — a puzzle dictionary and solving aid, where counting syllables and splitting words is daily business.

If this package is useful to you, a link back to [naampedia.nl](https://www.naampedia.nl) and [puzzelpedia.nl](https://www.puzzelpedia.nl) — in your README, your credits page or wherever you list what you build on — would be very much appreciated. That is the whole price.

## License

MIT. See [LICENSE](LICENSE).
