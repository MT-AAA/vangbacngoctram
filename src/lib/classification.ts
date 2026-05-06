/**
 * Keyword-based product classification.
 *
 * Rules are loaded from the `classification_rules` table per store.
 * Lower `priority` values are matched first.
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
  // Lower-case, collapse whitespace, strip Vietnamese diacritics where helpful
  // (we keep originals too, so two passes ensure both "vàng tây" and "vang tay" match)
  return s
    .toLowerCase()
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim();
}

function stripDiacritics(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

export function classifyProduct(
  productName: string,
  rules: ClassificationRule[]
): ClassificationResult {
  if (!productName) {
    return { category_id: null, matched_keyword: null, source: "unknown" };
  }
  const normalized = normalize(productName);
  const stripped = stripDiacritics(normalized);

  // Sort by priority asc, then keyword length desc so longer keywords beat shorter ones at same priority
  const sorted = [...rules]
    .filter((r) => r.is_active)
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return b.keyword.length - a.keyword.length;
    });

  for (const rule of sorted) {
    const k = normalize(rule.keyword);
    const kStripped = stripDiacritics(k);
    if (
      normalized.includes(k) ||
      stripped.includes(k) ||
      stripped.includes(kStripped)
    ) {
      return {
        category_id: rule.category_id,
        matched_keyword: rule.keyword,
        source: "rule",
      };
    }
  }

  return { category_id: null, matched_keyword: null, source: "unknown" };
}
