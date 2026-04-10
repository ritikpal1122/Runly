// Filler words to strip — ONLY truly useless ones
const FILLER_WORDS = new Set([
  'and', 'then', 'the', 'a', 'an', 'of',
  'that', 'this', 'should', 'please', 'now', 'also',
  'i', 'want', 'need', 'can', 'you', 'it',
]);

export function tokenize(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') return [];

  let input = rawInput.trim();

  // Extract quoted strings first and replace with placeholders
  const quoted = [];
  input = input.replace(/["'`]([^"'`]+)["'`]/g, (_, content) => {
    quoted.push(content.trim());
    return `__QUOTED_${quoted.length - 1}__`;
  });

  // Split on whitespace — keep ORIGINAL case
  const rawWords = input.split(/\s+/).filter(Boolean);

  // Build two arrays: lowercase (for matching) and original (for values)
  const tokens = [];
  for (let i = 0; i < rawWords.length; i++) {
    const original = rawWords[i];
    const lower = original.toLowerCase();

    // Restore quoted strings (original case preserved)
    if (lower.startsWith('__quoted_')) {
      const idx = parseInt(lower.match(/\d+/)?.[0], 10);
      if (idx >= 0 && idx < quoted.length) {
        tokens.push({ lower: quoted[idx].toLowerCase(), original: quoted[idx] });
        continue;
      }
    }

    // Skip filler words
    if (FILLER_WORDS.has(lower)) continue;

    tokens.push({ lower, original });
  }

  return tokens;
}

// Helper: get lowercase token array (for action matching)
export function toLowerTokens(tokens) {
  return tokens.map(t => t.lower);
}

// Helper: get original-case token array (for values like emails/passwords)
export function toOriginalTokens(tokens) {
  return tokens.map(t => t.original);
}
