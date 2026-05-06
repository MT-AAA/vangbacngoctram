import test from "node:test";
import { strict as assert } from "node:assert";
import { parseReportRange, bucketize, isoOf } from "../range";

const mid2026 = new Date(Date.UTC(2026, 4, 15));

test("parseReportRange: defaults to current month with month bucketing", () => {
  const r = parseReportRange({}, mid2026);
  assert.equal(r.period, "month");
  assert.equal(r.from, "2026-05-01");
  assert.equal(r.to, "2026-05-31");
  assert.equal(r.bucketKind, "month");
  assert.equal(r.buckets.length, 1);
  assert.equal(r.label, "Tháng 05/2026");
});

test("parseReportRange: period=quarter expands to current quarter", () => {
  const r = parseReportRange({ period: "quarter" }, mid2026);
  assert.equal(r.from, "2026-04-01");
  assert.equal(r.to, "2026-06-30");
  assert.equal(r.bucketKind, "quarter");
  assert.equal(r.buckets.length, 1);
  assert.equal(r.label, "Quý 2/2026");
});

test("parseReportRange: period=year expands to current year", () => {
  const r = parseReportRange({ period: "year" }, mid2026);
  assert.equal(r.from, "2026-01-01");
  assert.equal(r.to, "2026-12-31");
  assert.equal(r.bucketKind, "year");
  assert.equal(r.label, "Năm 2026");
});

test("parseReportRange: explicit from/to honoured verbatim", () => {
  const r = parseReportRange(
    { period: "day", from: "2026-03-01", to: "2026-03-07" },
    mid2026
  );
  assert.equal(r.from, "2026-03-01");
  assert.equal(r.to, "2026-03-07");
  assert.equal(r.bucketKind, "day");
  assert.equal(r.buckets.length, 7);
  assert.equal(r.buckets[0].start, "2026-03-01");
  assert.equal(r.buckets[6].end, "2026-03-07");
});

test("parseReportRange: invalid period falls back to month", () => {
  const r = parseReportRange({ period: "garbage" }, mid2026);
  assert.equal(r.period, "month");
});

test("bucketize: month spans across years correctly", () => {
  const b = bucketize("month", "2025-12-15", "2026-02-10");
  assert.equal(b.length, 3);
  assert.equal(b[0].start, "2025-12-15");
  assert.equal(b[0].end, "2025-12-31");
  assert.equal(b[1].start, "2026-01-01");
  assert.equal(b[1].end, "2026-01-31");
  assert.equal(b[2].start, "2026-02-01");
  assert.equal(b[2].end, "2026-02-10");
});

test("isoOf: pads month/day", () => {
  const d = new Date(Date.UTC(2026, 0, 5));
  assert.equal(isoOf(d), "2026-01-05");
});
