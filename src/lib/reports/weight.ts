/**
 * Weight conversion helpers used by reports that aggregate by weight (the
 * average-selling-price report, future inventory rollups, etc.).
 *
 * The shop's preferred unit is "chỉ" (Vietnamese gold mass — 3.75g). The DB
 * stores weight + weight_unit, but for grouping we normalise everything to
 * "chỉ" so the average selling price per chỉ can be compared across rows
 * with mixed source units.
 *
 *   1 chỉ        = 1.0 chỉ
 *   1 lượng      = 10 chỉ      (= 37.5g)
 *   1 gram       = 1/3.75 chỉ
 *   1 kg         = 1000 g      (≈ 266.667 chỉ)
 *
 * Unknown / missing units return 0 so they're silently excluded from
 * weight-based averages — callers should also branch on the returned value.
 */

const GRAMS_PER_CHI = 3.75;

export type WeightUnit =
  | "chỉ"
  | "chi"
  | "lượng"
  | "luong"
  | "gram"
  | "g"
  | "kg"
  | string;

export function toChi(value: number, unit: WeightUnit | null | undefined): number {
  if (!Number.isFinite(value) || value === 0) return 0;
  if (!unit) return 0;
  const u = unit.trim().toLowerCase();
  switch (u) {
    case "chỉ":
    case "chi":
      return value;
    case "lượng":
    case "luong":
      return value * 10;
    case "gram":
    case "g":
      return value / GRAMS_PER_CHI;
    case "kg":
      return (value * 1000) / GRAMS_PER_CHI;
    default:
      return 0;
  }
}

export function toGram(value: number, unit: WeightUnit | null | undefined): number {
  if (!Number.isFinite(value) || value === 0) return 0;
  if (!unit) return 0;
  const u = unit.trim().toLowerCase();
  switch (u) {
    case "chỉ":
    case "chi":
      return value * GRAMS_PER_CHI;
    case "lượng":
    case "luong":
      return value * 10 * GRAMS_PER_CHI;
    case "gram":
    case "g":
      return value;
    case "kg":
      return value * 1000;
    default:
      return 0;
  }
}
