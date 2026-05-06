import test from "node:test";
import assert from "node:assert/strict";

import { categoryCodeToSkuCode } from "../sku";

test("categoryCodeToSkuCode: maps spec category codes to short codes", () => {
  assert.equal(categoryCodeToSkuCode("vang_ta"), "VT");
  assert.equal(categoryCodeToSkuCode("vang_tay"), "VTAY");
  assert.equal(categoryCodeToSkuCode("bac"), "BAC");
});

test("categoryCodeToSkuCode: case-insensitive", () => {
  assert.equal(categoryCodeToSkuCode("VANG_TA"), "VT");
  assert.equal(categoryCodeToSkuCode("Vang_Tay"), "VTAY");
});

test("categoryCodeToSkuCode: falls back to stripped code for unknown categories", () => {
  assert.equal(categoryCodeToSkuCode("kim_cuong"), "KIMCUONG");
  assert.equal(categoryCodeToSkuCode("đá-quý"), "QU");
});

test("categoryCodeToSkuCode: empty / null produces SP fallback", () => {
  assert.equal(categoryCodeToSkuCode(""), "SP");
  assert.equal(categoryCodeToSkuCode(null), "SP");
  assert.equal(categoryCodeToSkuCode(undefined), "SP");
});
