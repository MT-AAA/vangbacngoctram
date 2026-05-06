import test from "node:test";
import { strict as assert } from "node:assert";
import { toChi, toGram } from "../weight";

test("toChi: identity for chi unit", () => {
  assert.equal(toChi(2.5, "chỉ"), 2.5);
  assert.equal(toChi(2.5, "chi"), 2.5);
});

test("toChi: 1 luong = 10 chi", () => {
  assert.equal(toChi(1, "lượng"), 10);
  assert.equal(toChi(2, "luong"), 20);
});

test("toChi: gram → chi at 3.75 g/chi", () => {
  assert.equal(toChi(3.75, "g"), 1);
  assert.equal(toChi(7.5, "gram"), 2);
});

test("toChi: kg → chi", () => {
  assert.equal(toChi(0.0375, "kg"), 10);
});

test("toChi: unknown unit returns 0", () => {
  assert.equal(toChi(5, "ounce"), 0);
  assert.equal(toChi(5, null), 0);
  assert.equal(toChi(5, ""), 0);
});

test("toChi: 0 / NaN inputs return 0", () => {
  assert.equal(toChi(0, "chỉ"), 0);
  assert.equal(toChi(Number.NaN, "chỉ"), 0);
});

test("toGram: round-trip with toChi", () => {
  assert.equal(toGram(2, "chỉ"), 7.5);
  assert.equal(toGram(1, "lượng"), 37.5);
  assert.equal(toGram(5, "g"), 5);
  assert.equal(toGram(2, "kg"), 2000);
});
