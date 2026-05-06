import test from "node:test";
import assert from "node:assert/strict";

import {
  formatNumberForInput,
  parseVietnameseNumber,
} from "../utils";

test("formatNumberForInput renders integers without thousands separators", () => {
  assert.equal(formatNumberForInput(4200000), "4200000");
  assert.equal(formatNumberForInput(0), "0");
});

test("formatNumberForInput renders decimals with Vietnamese comma", () => {
  assert.equal(formatNumberForInput(1.5), "1,5");
  assert.equal(formatNumberForInput(0.123, 4), "0,123");
});

test("formatNumberForInput round-trips losslessly through parseVietnameseNumber (regression for /customer-purchases edit decimal inflation)", () => {
  for (const n of [0, 1, 1.5, 1.25, 4200000, 6300000, 0.001]) {
    const formatted = formatNumberForInput(n);
    const parsed = parseVietnameseNumber(formatted);
    assert.equal(parsed, n, `round-trip failed for ${n} → "${formatted}"`);
  }
});

test("parseVietnameseNumber accepts both raw integers and VN-formatted decimals", () => {
  assert.equal(parseVietnameseNumber("4200000"), 4200000);
  assert.equal(parseVietnameseNumber("4.200.000"), 4200000);
  assert.equal(parseVietnameseNumber("1,5"), 1.5);
  assert.equal(parseVietnameseNumber("6.500.000"), 6500000);
});
