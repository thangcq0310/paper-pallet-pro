const VERSION = 2;
const SIZE = 25;
const DATA_CODEWORDS = 28;
const EC_CODEWORDS = 16;
const ECC_LEVEL_BITS = 0b00; // M
const MAX_PAYLOAD_BYTES = 26;

const GF_EXP = new Array<number>(512);
const GF_LOG = new Array<number>(256);

for (let i = 0, x = 1; i < 255; i += 1) {
  GF_EXP[i] = x;
  GF_LOG[x] = i;
  x <<= 1;
  if (x & 0x100) x ^= 0x11d;
}
for (let i = 255; i < 512; i += 1) {
  GF_EXP[i] = GF_EXP[i - 255];
}

function gfMul(a: number, b: number) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function polyMul(a: number[], b: number[]) {
  const result = new Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i += 1) {
    for (let j = 0; j < b.length; j += 1) {
      result[i + j] ^= gfMul(a[i], b[j]);
    }
  }
  return result;
}

function buildGeneratorPoly(degree: number) {
  let poly = [1];
  for (let i = 0; i < degree; i += 1) {
    poly = polyMul(poly, [1, GF_EXP[i]]);
  }
  return poly;
}

function rsEncode(data: number[], ecCodewords: number) {
  const generator = buildGeneratorPoly(ecCodewords);
  const buffer = [...data, ...new Array(ecCodewords).fill(0)];
  for (let i = 0; i < data.length; i += 1) {
    const factor = buffer[i];
    if (factor === 0) continue;
    for (let j = 0; j < generator.length; j += 1) {
      buffer[i + j] ^= gfMul(generator[j], factor);
    }
  }
  return buffer.slice(data.length);
}

function appendBits(bits: number[], value: number, length: number) {
  for (let i = length - 1; i >= 0; i -= 1) {
    bits.push((value >>> i) & 1);
  }
}

function bytesToBits(bytes: number[]) {
  const bits: number[] = [];
  for (const byte of bytes) {
    appendBits(bits, byte, 8);
  }
  return bits;
}

function bitsToBytes(bits: number[]) {
  const bytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let value = 0;
    for (let j = 0; j < 8; j += 1) {
      value = (value << 1) | (bits[i + j] ?? 0);
    }
    bytes.push(value);
  }
  return bytes;
}

function encodeData(value: string) {
  const bytes = new TextEncoder().encode(value);
  if (bytes.length > MAX_PAYLOAD_BYTES) {
    throw new Error("QR content quá dài cho version 2");
  }

  const bits: number[] = [];
  appendBits(bits, 0b0100, 4);
  appendBits(bits, bytes.length, 8);
  for (const byte of bytes) appendBits(bits, byte, 8);

  const capacityBits = DATA_CODEWORDS * 8;
  const terminator = Math.min(4, capacityBits - bits.length);
  appendBits(bits, 0, terminator);
  while (bits.length % 8 !== 0) bits.push(0);

  const dataBytes = bitsToBytes(bits);
  const padBytes = [0xec, 0x11];
  let padIndex = 0;
  while (dataBytes.length < DATA_CODEWORDS) {
    dataBytes.push(padBytes[padIndex % 2]);
    padIndex += 1;
  }

  return dataBytes;
}

type Matrix = (0 | 1 | null)[][];

function createEmptyMatrix() {
  return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => null as 0 | 1 | null));
}

function createReservedMatrix() {
  return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => false));
}

function setModule(matrix: Matrix, reserved: boolean[][], x: number, y: number, value: 0 | 1, lock = true) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  matrix[y][x] = value;
  if (lock) reserved[y][x] = true;
}

function markReserved(reserved: boolean[][], x: number, y: number) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  reserved[y][x] = true;
}

function drawFinder(matrix: Matrix, reserved: boolean[][], left: number, top: number) {
  for (let dy = -1; dy <= 7; dy += 1) {
    for (let dx = -1; dx <= 7; dx += 1) {
      const x = left + dx;
      const y = top + dy;
      const inCore = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
      if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) continue;
      markReserved(reserved, x, y);
      if (!inCore) {
        matrix[y][x] = 0;
        continue;
      }
      const isBorder = dx === 0 || dx === 6 || dy === 0 || dy === 6;
      const isCenter = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
      matrix[y][x] = isBorder || isCenter ? 1 : 0;
    }
  }
}

function drawAlignment(matrix: Matrix, reserved: boolean[][], centerX: number, centerY: number) {
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const x = centerX + dx;
      const y = centerY + dy;
      if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) continue;
      markReserved(reserved, x, y);
      const isBorder = Math.abs(dx) === 2 || Math.abs(dy) === 2;
      const isCenter = dx === 0 && dy === 0;
      matrix[y][x] = isBorder || isCenter ? 1 : 0;
    }
  }
}

function drawTimingPatterns(matrix: Matrix, reserved: boolean[][]) {
  for (let i = 8; i < SIZE - 8; i += 1) {
    const value = i % 2 === 0 ? 1 : 0;
    setModule(matrix, reserved, i, 6, value);
    setModule(matrix, reserved, 6, i, value);
  }
}

function reserveFormatAreas(reserved: boolean[][]) {
  const positionsA = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8],
    [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  const positionsB = [
    [SIZE - 1, 8], [SIZE - 2, 8], [SIZE - 3, 8], [SIZE - 4, 8], [SIZE - 5, 8], [SIZE - 6, 8], [SIZE - 7, 8], [SIZE - 8, 8],
    [8, SIZE - 8], [8, SIZE - 7], [8, SIZE - 6], [8, SIZE - 5], [8, SIZE - 4], [8, SIZE - 3], [8, SIZE - 2],
  ];
  for (const [x, y] of [...positionsA, ...positionsB]) {
    markReserved(reserved, x, y);
  }
}

function getFormatBits(mask: number) {
  let data = ((ECC_LEVEL_BITS << 3) | mask) & 0x1f;
  let bits = data << 10;
  const generator = 0x537;

  for (let i = 14; i >= 10; i -= 1) {
    if ((bits >>> i) & 1) {
      bits ^= generator << (i - 10);
    }
  }

  return (bits ^ 0x5412) & 0x7fff;
}

function maskBit(mask: number, x: number, y: number) {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
    case 5: return ((x * y) % 2 + (x * y) % 3) === 0;
    case 6: return (((x * y) % 2 + (x * y) % 3) % 2) === 0;
    case 7: return (((x + y) % 2 + (x * y) % 3) % 2) === 0;
    default: return false;
  }
}

function placeFormatBits(matrix: Matrix, mask: number) {
  const bits = getFormatBits(mask);
  const primary = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8],
    [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  const secondary = [
    [SIZE - 1, 8], [SIZE - 2, 8], [SIZE - 3, 8], [SIZE - 4, 8], [SIZE - 5, 8], [SIZE - 6, 8], [SIZE - 7, 8], [SIZE - 8, 8],
    [8, SIZE - 8], [8, SIZE - 7], [8, SIZE - 6], [8, SIZE - 5], [8, SIZE - 4], [8, SIZE - 3], [8, SIZE - 2],
  ];

  for (let i = 0; i < 15; i += 1) {
    const bit = ((bits >>> (14 - i)) & 1) as 0 | 1;
    const [x1, y1] = primary[i];
    const [x2, y2] = secondary[i];
    matrix[y1][x1] = bit;
    matrix[y2][x2] = bit;
  }
}

function placeDarkModule(matrix: Matrix, reserved: boolean[][]) {
  const x = 8;
  const y = 4 * VERSION + 9;
  setModule(matrix, reserved, x, y, 1);
}

function placeDataBits(matrix: Matrix, reserved: boolean[][], bits: number[], mask: number) {
  let index = 0;
  let upward = true;

  for (let x = SIZE - 1; x > 0; x -= 2) {
    if (x === 6) x -= 1;

    for (let y = upward ? SIZE - 1 : 0; upward ? y >= 0 : y < SIZE; y += upward ? -1 : 1) {
      for (let dx = 0; dx < 2; dx += 1) {
        const col = x - dx;
        if (reserved[y][col]) continue;
        const bit = bits[index] ?? 0;
        index += 1;
        matrix[y][col] = (bit ^ (maskBit(mask, col, y) ? 1 : 0)) as 0 | 1;
      }
    }

    upward = !upward;
  }
}

function penaltyScore(matrix: Matrix) {
  let score = 0;

  for (let y = 0; y < SIZE; y += 1) {
    let runColor = matrix[y][0];
    let runLength = 1;
    for (let x = 1; x < SIZE; x += 1) {
      if (matrix[y][x] === runColor) {
        runLength += 1;
      } else {
        if (runLength >= 5) score += 3 + (runLength - 5);
        runColor = matrix[y][x];
        runLength = 1;
      }
    }
    if (runLength >= 5) score += 3 + (runLength - 5);
  }

  for (let x = 0; x < SIZE; x += 1) {
    let runColor = matrix[0][x];
    let runLength = 1;
    for (let y = 1; y < SIZE; y += 1) {
      if (matrix[y][x] === runColor) {
        runLength += 1;
      } else {
        if (runLength >= 5) score += 3 + (runLength - 5);
        runColor = matrix[y][x];
        runLength = 1;
      }
    }
    if (runLength >= 5) score += 3 + (runLength - 5);
  }

  for (let y = 0; y < SIZE - 1; y += 1) {
    for (let x = 0; x < SIZE - 1; x += 1) {
      const value = matrix[y][x];
      if (value !== matrix[y][x + 1] || value !== matrix[y + 1][x] || value !== matrix[y + 1][x + 1]) continue;
      score += 3;
    }
  }

  const patterns = [
    [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1],
  ];

  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x <= SIZE - 11; x += 1) {
      const slice = matrix[y].slice(x, x + 11);
      if (patterns.some((pattern) => pattern.every((bit, idx) => slice[idx] === bit))) score += 40;
    }
  }

  for (let x = 0; x < SIZE; x += 1) {
    for (let y = 0; y <= SIZE - 11; y += 1) {
      const slice = Array.from({ length: 11 }, (_, idx) => matrix[y + idx][x]);
      if (patterns.some((pattern) => pattern.every((bit, idx) => slice[idx] === bit))) score += 40;
    }
  }

  let dark = 0;
  for (const row of matrix) {
    for (const cell of row) {
      if (cell === 1) dark += 1;
    }
  }
  const total = SIZE * SIZE;
  const percent = (dark / total) * 100;
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;

  return score;
}

function makeBaseTemplate() {
  const matrix = createEmptyMatrix();
  const reserved = createReservedMatrix();

  drawFinder(matrix, reserved, 0, 0);
  drawFinder(matrix, reserved, SIZE - 7, 0);
  drawFinder(matrix, reserved, 0, SIZE - 7);
  drawTimingPatterns(matrix, reserved);
  drawAlignment(matrix, reserved, 18, 18);
  placeDarkModule(matrix, reserved);
  reserveFormatAreas(reserved);

  return { matrix, reserved };
}

export function createQrMatrix(value: string) {
  const data = encodeData(value);
  const ecc = rsEncode(data, EC_CODEWORDS);
  const codewords = [...data, ...ecc];
  const bits = bytesToBits(codewords);

  let bestMatrix: Matrix | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let mask = 0; mask < 8; mask += 1) {
    const { matrix, reserved } = makeBaseTemplate();
    placeDataBits(matrix, reserved, bits, mask);
    placeFormatBits(matrix, mask);
    const score = penaltyScore(matrix);
    if (score < bestScore) {
      bestScore = score;
      bestMatrix = matrix;
    }
  }

  if (!bestMatrix) throw new Error("Không thể tạo QR");
  return bestMatrix.map((row) => row.map((cell) => (cell === 1 ? 1 : 0)));
}

export function buildQrSvg(value: string, options?: { margin?: number }) {
  const margin = options?.margin ?? 4;
  const matrix = createQrMatrix(value);
  const size = matrix.length + margin * 2;
  const cells: string[] = [];

  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix.length; x += 1) {
      if (matrix[y][x] !== 1) continue;
      cells.push(`<rect x="${x + margin}" y="${y + margin}" width="1" height="1" />`);
    }
  }

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges" aria-label="QR code">
  <rect width="100%" height="100%" fill="white" />
  <g fill="black">${cells.join("")}</g>
</svg>`.trim();
}
