import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clampPage,
  pageOffset,
  paginationRange,
  totalPagesOf,
} from "../pagination";

test("clampPage: defaults missing/invalid to 1", () => {
  assert.equal(clampPage(undefined, 9), 1);
  assert.equal(clampPage(null, 9), 1);
  assert.equal(clampPage(0, 9), 1);
  assert.equal(clampPage(-3, 9), 1);
  assert.equal(clampPage(Number.NaN, 9), 1);
});

test("clampPage: clamps above totalPages", () => {
  assert.equal(clampPage(10, 9), 9);
  assert.equal(clampPage(99, 1), 1);
});

test("clampPage: passes valid page through", () => {
  assert.equal(clampPage(5, 9), 5);
  assert.equal(clampPage(1, 9), 1);
  assert.equal(clampPage(9, 9), 9);
});

test("totalPagesOf: zero rows still gives one page", () => {
  assert.equal(totalPagesOf(0, 50), 1);
  assert.equal(totalPagesOf(null, 50), 1);
});

test("totalPagesOf: rounds up partial page", () => {
  assert.equal(totalPagesOf(50, 50), 1);
  assert.equal(totalPagesOf(51, 50), 2);
  assert.equal(totalPagesOf(406, 50), 9);
});

test("pageOffset: page 1 → [0, pageSize-1]", () => {
  assert.deepEqual(pageOffset({ page: 1, pageSize: 50 }), { from: 0, to: 49 });
});

test("pageOffset: page 2 → [pageSize, 2*pageSize-1]", () => {
  assert.deepEqual(pageOffset({ page: 2, pageSize: 50 }), { from: 50, to: 99 });
});

test("pageOffset: page 9 (mobile pageSize=20) → [160, 179]", () => {
  assert.deepEqual(pageOffset({ page: 9, pageSize: 20 }), { from: 160, to: 179 });
});

test("paginationRange: small total renders every page", () => {
  assert.deepEqual(paginationRange({ page: 1, totalPages: 5 }), [1, 2, 3, 4, 5]);
});

test("paginationRange: large total with current at start", () => {
  assert.deepEqual(paginationRange({ page: 1, totalPages: 9, siblings: 1 }), [
    1, 2, "…", 9,
  ]);
});

test("paginationRange: large total with current in middle uses both ellipses", () => {
  assert.deepEqual(paginationRange({ page: 5, totalPages: 9, siblings: 1 }), [
    1, "…", 4, 5, 6, "…", 9,
  ]);
});

test("paginationRange: large total with current near end", () => {
  assert.deepEqual(paginationRange({ page: 9, totalPages: 9, siblings: 1 }), [
    1, "…", 8, 9,
  ]);
});

test("paginationRange: zero total falls back to [1]", () => {
  assert.deepEqual(paginationRange({ page: 1, totalPages: 0 }), [1]);
});
