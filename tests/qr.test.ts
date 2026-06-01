import assert from "node:assert/strict";
import { test } from "node:test";
import { buildQrSvg, createQrMatrix } from "@/utils/qr";

test("createQrMatrix returns a version 2 QR matrix", () => {
  const matrix = createQrMatrix("PLT:PALLET-001");

  assert.equal(matrix.length, 25);
  for (const row of matrix) {
    assert.equal(row.length, 25);
    for (const cell of row) {
      assert.ok(cell === 0 || cell === 1);
    }
  }

  // Finder pattern sanity checks.
  assert.equal(matrix[0][0], 1);
  assert.equal(matrix[3][3], 1);
  assert.equal(matrix[1][1], 0);
});

test("buildQrSvg wraps the matrix in SVG markup", () => {
  const svg = buildQrSvg("TASK:TASK-001");

  assert.match(svg, /^<svg[\s\S]*<\/svg>$/);
  assert.match(svg, /viewBox="0 0 33 33"/);
  assert.match(svg, /<rect x="/);
});
