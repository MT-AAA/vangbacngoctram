/**
 * Keyword-based product classification.
 *
 * Rules are loaded from the `classification_rules` table per store. Lower
 * `priority` values are matched first.
 *
 * Matching is whole-word (regex with `\b` boundaries) on the lowercased,
 * whitespace-collapsed product name. We do NOT fall back to a diacritic-
 * stripped form, because that turns short ambiguous keywords like "tây"
 * (west) into matches against unrelated Vietnamese words like "tay" (hand) —
 * e.g. "Lắc tay" should remain unclassified, but a stripped match would
 * incorrectly tag it as Vàng tây.
 *
 * Stripped-form keywords are explicitly seeded in `seed_store_defaults`
 * (e.g. both `"vàng tây"` and `"vang tay"`), so users typing without
 * diacritics still match.
 */

export type ClassificationRule = {
  id: string;
  category_id: string;
  keyword: string;
  priority: number;
  is_active: boolean;
};

export type ClassificationResult = {
  category_id: string | null;
  matched_keyword: string | null;
  source: "rule" | "unknown";
};

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFC").replace(/\s+/g, " ").trim();
}

/**
 * Build a regex that matches `keyword` as a whole-word, case-insensitively.
 * "Whole word" here means: the character before the keyword (if any) is not
 * `[a-z0-9]`, and the character after (if any) is not `[a-z0-9]`.
 *
 * Vietnamese diacritic vowels (e.g. `ầ`, `ư`) are NOT in `[a-z0-9]`, so a
 * pure `\b` would fire incorrectly between a Latin letter and a diacritic
 * vowel. We therefore use explicit lookaround on `[a-z0-9]`.
 */
function wholeWordRegex(keyword: string): RegExp {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?=[^a-z0-9]|$)`, "i");
}

export function classifyProduct(
  productName: string,
  rules: ClassificationRule[]
): ClassificationResult {
  if (!productName) {
    return { category_id: null, matched_keyword: null, source: "unknown" };
  }
  const normalized = normalize(productName);

  // Sort by priority asc, then keyword length desc so longer keywords beat shorter ones at same priority
  const sorted = [...rules]
    .filter((r) => r.is_active)
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return b.keyword.length - a.keyword.length;
    });

  for (const rule of sorted) {
    const k = normalize(rule.keyword);
    if (!k) continue;
    if (wholeWordRegex(k).test(normalized)) {
      return {
        category_id: rule.category_id,
        matched_keyword: rule.keyword,
        source: "rule",
      };
    }
  }

  return { category_id: null, matched_keyword: null, source: "unknown" };
}
