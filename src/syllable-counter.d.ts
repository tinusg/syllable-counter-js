export type Exceptions =
  | Record<string, string[]>
  | Map<string, string[]>
  | Iterable<[string, string[]]>;

export declare class SyllableCounter {
  /**
   * @param exceptions Extra `word => syllables` pairs, e.g.
   *                   `{ ilse: ['il', 'se'] }`. An entry overrides a built-in
   *                   exception with the same key.
   */
  constructor(exceptions?: Exceptions);

  readonly exceptions: Map<string, string[]>;

  /** The number of syllables in a name, never less than 1. */
  count(value: string, muteFinalE?: boolean | null): number;

  /** The syllables of a name, casing and accents intact. */
  split(value: string, muteFinalE?: boolean | null): string[];

  /** The name as hyphenated text, for example "So-phi-a". */
  hyphenate(value: string, separator?: string, muteFinalE?: boolean | null): string;

  /** The exception for this word, or null when none applies. */
  exceptionFor(token: string): string[] | null;
}

export declare function countSyllables(value: string, muteFinalE?: boolean | null): number;
export declare function splitSyllables(value: string, muteFinalE?: boolean | null): string[];
export declare function hyphenate(
  value: string,
  separator?: string,
  muteFinalE?: boolean | null,
): string;

export default SyllableCounter;
