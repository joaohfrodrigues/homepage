/**
 * A small profanity filter for leaderboard names, in English and Portuguese.
 * It only has to stop the obvious: names are 16 characters at most, and
 * anything that slips through can be hidden by hand (see the moderation route).
 */

/** Rude enough to reject wherever they turn up inside a name ("xXfuckXx"). */
const ANYWHERE = [
  'fuck',
  'shit',
  'cunt',
  'bitch',
  'whore',
  'slut',
  'nigg',
  'fagg',
  'retard',
  'nazi',
  'hitler',
  'penis',
  'vagina',
  'dildo',
  'porra',
  'caralh',
  'foder',
  'fodid',
  'fodase',
  'merda',
  'buceta',
  'paneleir',
  'cabrao',
  'otario',
]

/** Too short to search for inside other words ("class", "grapes", "computador"), so only rejected whole. */
const WHOLE_WORDS = new Set(['ass', 'arse', 'rape', 'puta', 'cock', 'dick', 'fag', 'tit', 'tits', 'cu', 'pila', 'cona', 'fdp', 'pqp', 'crl', 'sex'])

/** Digits and symbols people swap in for letters. */
const LOOKALIKES: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', $: 's', '!': 'i' }

/** Lowercase, accents stripped and lookalikes swapped back: "Fóda-S3" becomes "foda-se". */
function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[0134578@$!]/g, (c) => LOOKALIKES[c] ?? c)
}

export function isProfane(name: string): boolean {
  const folded = fold(name)
  const words = folded.split(/[^a-z]+/).filter(Boolean)
  // Separators are a common dodge ("f.u.c.k"), so also look at the letters run together.
  const squashed = words.join('')
  if (ANYWHERE.some((word) => squashed.includes(word))) return true
  return words.some((word) => WHOLE_WORDS.has(word))
}
