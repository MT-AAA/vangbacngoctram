import test from "node:test";
import { strict as assert } from "node:assert";
import { csvEscape, toCsv } from "../csv";

test("csvEscape: empty / null / undefined", () => {
  assert.equal(csvEscape(null), "");
  assert.equal(csvEscape(undefined), "");
  assert.equal(csvEscape(""), "");
});

test("csvEscape: numbers and booleans", () => {
  assert.equal(csvEscape(123), '"123"');
  assert.equal(csvEscape(0), '"0"');
  assert.equal(csvEscape(true), '"true"');
  assert.equal(csvEscape(false), '"false"');
  assert.equal(csvEscape(Number.NaN), "");
});

test("csvEscape: strings with quotes / commas / newlines", () => {
  assert.equal(csvEscape('he said "hi"'), '"he said ""hi"""');
  assert.equal(csvEscape("a,b"), '"a,b"');
  assert.equal(csvEscape("line1\nline2"), '"line1\nline2"');
});

test("toCsv: BOM + headers + rows + CRLF", () => {
  const csv = toCsv(
    [
      { a: 1, b: "x" },
      { a: 2, b: "y,z" },
    ],
    [
      { key: "a", header: "A" },
      { key: "b", header: "B" },
    ]
  );
  assert.equal(csv.charCodeAt(0), 0xfeff);
  const body = csv.slice(1);
  const lines = body.split("\r\n");
  assert.equal(lines[0], '"A","B"');
  assert.equal(lines[1], '"1","x"');
  assert.equal(lines[2], '"2","y,z"');
  // trailing CRLF after last row
  assert.equal(lines[3], "");
});

test("toCsv: prefixLines emitted before header", () => {
  const csv = toCsv(
    [{ k: 1 }],
    [{ key: "k", header: "K" }],
    { prefixLines: ["# meta line 1", "# meta line 2"] }
  );
  const body = csv.slice(1).split("\r\n");
  assert.equal(body[0], "# meta line 1");
  assert.equal(body[1], "# meta line 2");
  assert.equal(body[2], '"K"');
  assert.equal(body[3], '"1"');
});

test("toCsv: handles UTF-8 (Vietnamese diacritics) cleanly", () => {
  const csv = toCsv(
    [{ k: "Vàng ta" }, { k: "Trang sức bạc" }],
    [{ key: "k", header: "Nhóm" }]
  );
  assert.ok(csv.includes("Vàng ta"));
  assert.ok(csv.includes("Trang sức bạc"));
  assert.ok(csv.includes("Nhóm"));
});
