// Generador autónomo y ligero de códigos QR en TypeScript (versiones 1-14, modo Byte UTF-8, Corrección Nivel M)
// 100% libre de dependencias externas

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
let x = 1;
for (let i = 0; i < 255; i++) {
  GF_EXP[i] = x;
  GF_LOG[x] = i;
  x = (x << 1) ^ (x & 128 ? 0x11d : 0);
}
for (let i = 255; i < 512; i++) {
  GF_EXP[i] = GF_EXP[i - 255];
}

function gfMul(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGenPoly(nsym: number): number[] {
  let g = [1];
  for (let i = 0; i < nsym; i++) {
    const ng = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      ng[j] ^= g[j];
      ng[j + 1] ^= gfMul(g[j], GF_EXP[i]);
    }
    g = ng;
  }
  return g;
}

function rsEncode(data: number[], nsym: number): number[] {
  const gen = rsGenPoly(nsym);
  const result = new Array(data.length + nsym).fill(0);
  for (let i = 0; i < data.length; i++) result[i] = data[i];
  for (let i = 0; i < data.length; i++) {
    const coef = result[i];
    if (coef !== 0) {
      for (let j = 1; j < gen.length; j++) {
        result[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return result.slice(data.length);
}

// Máscaras de formato precomputadas para corrección M (00)
const FORMAT_INFO_M = [
  0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0,
];

type QrSpec = {
  ver: number;
  size: number;
  total: number;
  ecPerBlock: number;
  g1Blocks: number;
  g1Data: number;
  g2Blocks: number;
  g2Data: number;
};

const SPECS_M: (QrSpec | null)[] = [
  null,
  { ver: 1, size: 21, total: 26, ecPerBlock: 10, g1Blocks: 1, g1Data: 16, g2Blocks: 0, g2Data: 0 },
  { ver: 2, size: 25, total: 44, ecPerBlock: 16, g1Blocks: 1, g1Data: 28, g2Blocks: 0, g2Data: 0 },
  { ver: 3, size: 29, total: 70, ecPerBlock: 26, g1Blocks: 1, g1Data: 44, g2Blocks: 0, g2Data: 0 },
  { ver: 4, size: 33, total: 100, ecPerBlock: 18, g1Blocks: 2, g1Data: 32, g2Blocks: 0, g2Data: 0 },
  { ver: 5, size: 37, total: 134, ecPerBlock: 24, g1Blocks: 2, g1Data: 43, g2Blocks: 0, g2Data: 0 },
  { ver: 6, size: 41, total: 172, ecPerBlock: 16, g1Blocks: 4, g1Data: 27, g2Blocks: 0, g2Data: 0 },
  { ver: 7, size: 45, total: 196, ecPerBlock: 18, g1Blocks: 4, g1Data: 31, g2Blocks: 0, g2Data: 0 },
  { ver: 8, size: 49, total: 242, ecPerBlock: 22, g1Blocks: 2, g1Data: 38, g2Blocks: 2, g2Data: 39 },
  { ver: 9, size: 53, total: 292, ecPerBlock: 22, g1Blocks: 3, g1Data: 36, g2Blocks: 2, g2Data: 37 },
  { ver: 10, size: 57, total: 346, ecPerBlock: 26, g1Blocks: 4, g1Data: 43, g2Blocks: 1, g2Data: 44 },
  { ver: 11, size: 61, total: 404, ecPerBlock: 30, g1Blocks: 1, g1Data: 50, g2Blocks: 4, g2Data: 51 },
  { ver: 12, size: 65, total: 466, ecPerBlock: 22, g1Blocks: 6, g1Data: 36, g2Blocks: 2, g2Data: 37 },
  { ver: 13, size: 69, total: 532, ecPerBlock: 22, g1Blocks: 8, g1Data: 37, g2Blocks: 4, g2Data: 38 },
  { ver: 14, size: 73, total: 581, ecPerBlock: 24, g1Blocks: 4, g1Data: 40, g2Blocks: 5, g2Data: 41 },
];

const ALIGN_POS: number[][] = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
];

const VERSION_INFO: (number | null)[] = [
  null, null, null, null, null, null, null,
  0x07c94, // 7
  0x085bc, // 8
  0x09a99, // 9
  0x0a4d3, // 10
  0x0bbf6, // 11
  0x0c762, // 12
  0x0d847, // 13
  0x0e60d, // 14
];

function encodeData(text: string, spec: QrSpec): number[] {
  const encoder = new TextEncoder();
  const rawBytes = Array.from(encoder.encode(text));
  const totalDataBytes = spec.g1Blocks * spec.g1Data + spec.g2Blocks * spec.g2Data;
  const countBits = spec.ver < 10 ? 8 : 16;

  const bits: number[] = [];
  function pushBits(val: number, numBits: number) {
    for (let i = numBits - 1; i >= 0; i--) {
      bits.push((val >>> i) & 1);
    }
  }

  // Modo Byte (0100)
  pushBits(0b0100, 4);
  // Conteo de caracteres
  pushBits(rawBytes.length, countBits);
  // Datos
  for (const b of rawBytes) {
    pushBits(b, 8);
  }
  // Terminador
  const remainingBits = totalDataBytes * 8 - bits.length;
  pushBits(0, Math.min(4, Math.max(0, remainingBits)));

  // Alinear a byte
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  // Convertir a bytes
  const bytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byteVal = 0;
    for (let j = 0; j < 8; j++) {
      byteVal = (byteVal << 1) | bits[i + j];
    }
    bytes.push(byteVal);
  }

  // Relleno alternante 0xEC y 0x11
  let padByte = 0xec;
  while (bytes.length < totalDataBytes) {
    bytes.push(padByte);
    padByte = padByte === 0xec ? 0x11 : 0xec;
  }

  // Dividir en bloques y calcular corrección de error
  const dataBlocks: number[][] = [];
  let offset = 0;
  for (let i = 0; i < spec.g1Blocks; i++) {
    dataBlocks.push(bytes.slice(offset, offset + spec.g1Data));
    offset += spec.g1Data;
  }
  for (let i = 0; i < spec.g2Blocks; i++) {
    dataBlocks.push(bytes.slice(offset, offset + spec.g2Data));
    offset += spec.g2Data;
  }

  const ecBlocks = dataBlocks.map((block) => rsEncode(block, spec.ecPerBlock));

  // Intercalar datos
  const finalCodewords: number[] = [];
  const maxDataLen = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < maxDataLen; i++) {
    for (const block of dataBlocks) {
      if (i < block.length) finalCodewords.push(block[i]);
    }
  }

  // Intercalar corrección de error
  for (let i = 0; i < spec.ecPerBlock; i++) {
    for (const ec of ecBlocks) {
      finalCodewords.push(ec[i]);
    }
  }

  return finalCodewords;
}

function createMatrix(spec: QrSpec) {
  const size = spec.size;
  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const isFunction: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  function setFunction(r: number, c: number, val: boolean) {
    matrix[r][c] = val;
    isFunction[r][c] = true;
  }

  function drawFinder(topRow: number, leftCol: number) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const row = topRow + r;
        const col = leftCol + c;
        if (row < 0 || row >= size || col < 0 || col >= size) continue;
        const isDark =
          (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
          (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        setFunction(row, col, isDark);
      }
    }
  }

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Patrones de sincronización
  for (let i = 8; i < size - 8; i++) {
    const val = i % 2 === 0;
    if (!isFunction[6][i]) setFunction(6, i, val);
    if (!isFunction[i][6]) setFunction(i, 6, val);
  }

  // Patrones de alineación
  const positions = ALIGN_POS[spec.ver] || [];
  for (const r of positions) {
    for (const c of positions) {
      if ((r <= 8 && c <= 8) || (r <= 8 && c >= size - 8) || (r >= size - 8 && c <= 8)) {
        continue;
      }
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const isDark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          setFunction(r + dr, c + dc, isDark);
        }
      }
    }
  }

  // Módulo oscuro
  setFunction(4 * spec.ver + 9, 8, true);

  // Información de formato reservada
  for (let i = 0; i <= 8; i++) {
    if (!isFunction[8][i]) setFunction(8, i, false);
    if (!isFunction[i][8]) setFunction(i, 8, false);
  }
  for (let i = 0; i < 8; i++) {
    if (!isFunction[8][size - 1 - i]) setFunction(8, size - 1 - i, false);
    if (!isFunction[size - 1 - i][8]) setFunction(size - 1 - i, 8, false);
  }

  // Información de versión reservada (versión >= 7)
  if (spec.ver >= 7) {
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 3; j++) {
        setFunction(size - 11 + j, i, false);
        setFunction(i, size - 11 + j, false);
      }
    }
  }

  return { matrix, isFunction };
}

function placeData(matrix: boolean[][], isFunction: boolean[][], codewords: number[]) {
  const size = matrix.length;
  const bits: number[] = [];
  for (const byte of codewords) {
    for (let i = 7; i >= 0; i--) {
      bits.push((byte >>> i) & 1);
    }
  }

  let bitIdx = 0;
  let upwards = true;

  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--;
    const left = right - 1;

    for (let i = 0; i < size; i++) {
      const r = upwards ? size - 1 - i : i;
      for (const c of [right, left]) {
        if (!isFunction[r][c]) {
          matrix[r][c] = bitIdx < bits.length ? bits[bitIdx++] === 1 : false;
        }
      }
    }
    upwards = !upwards;
  }
}

function applyMask(matrix: boolean[][], isFunction: boolean[][], mask: number): boolean[][] {
  return matrix.map((row, r) =>
    row.map((val, c) => {
      if (isFunction[r][c]) return val;
      let invert = false;
      switch (mask) {
        case 0: invert = (r + c) % 2 === 0; break;
        case 1: invert = r % 2 === 0; break;
        case 2: invert = c % 3 === 0; break;
        case 3: invert = (r + c) % 3 === 0; break;
        case 4: invert = (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; break;
        case 5: invert = ((r * c) % 2) + ((r * c) % 3) === 0; break;
        case 6: invert = (((r * c) % 2) + ((r * c) % 3)) % 2 === 0; break;
        case 7: invert = (((r + c) % 2) + ((r * c) % 3)) % 2 === 0; break;
      }
      return invert ? !val : val;
    })
  );
}

function writeFormatAndVersion(matrix: boolean[][], spec: QrSpec, mask: number) {
  const size = matrix.length;
  const format = FORMAT_INFO_M[mask];

  for (let i = 0; i < 15; i++) {
    const bit = ((format >>> (14 - i)) & 1) === 1;
    if (i < 6) matrix[8][i] = bit;
    else if (i === 6) matrix[8][7] = bit;
    else if (i === 7) matrix[8][8] = bit;
    else if (i === 8) matrix[7][8] = bit;
    else matrix[14 - i][8] = bit;

    // The bottom copy has seven bits; row size-8 is the fixed dark module.
    if (i < 7) matrix[size - 1 - i][8] = bit;
    else matrix[8][size - 15 + i] = bit;
  }

  if (spec.ver >= 7) {
    const vinfo = VERSION_INFO[spec.ver] ?? 0;
    for (let i = 0; i < 18; i++) {
      const bit = ((vinfo >>> i) & 1) === 1;
      const r = Math.floor(i / 3);
      const c = size - 11 + (i % 3);
      matrix[c][r] = bit;
      matrix[r][c] = bit;
    }
  }
}

function evaluatePenalty(matrix: boolean[][]): number {
  const size = matrix.length;
  let penalty = 0;

  for (let r = 0; r < size; r++) {
    let runColor = matrix[r][0];
    let runLen = 1;
    for (let c = 1; c < size; c++) {
      if (matrix[r][c] === runColor) {
        runLen++;
      } else {
        if (runLen >= 5) penalty += 3 + (runLen - 5);
        runColor = matrix[r][c];
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += 3 + (runLen - 5);
  }

  for (let c = 0; c < size; c++) {
    let runColor = matrix[0][c];
    let runLen = 1;
    for (let r = 1; r < size; r++) {
      if (matrix[r][c] === runColor) {
        runLen++;
      } else {
        if (runLen >= 5) penalty += 3 + (runLen - 5);
        runColor = matrix[r][c];
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += 3 + (runLen - 5);
  }

  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = matrix[r][c];
      if (v === matrix[r + 1][c] && v === matrix[r][c + 1] && v === matrix[r + 1][c + 1]) {
        penalty += 3;
      }
    }
  }

  return penalty;
}

export function generateQR(text: string): boolean[][] {
  const encoder = new TextEncoder();
  const rawLen = encoder.encode(text).length;

  let spec: QrSpec | null = null;
  for (let v = 1; v < SPECS_M.length; v++) {
    const s = SPECS_M[v];
    if (!s) continue;
    const totalData = s.g1Blocks * s.g1Data + s.g2Blocks * s.g2Data;
    const countBits = s.ver < 10 ? 8 : 16;
    const headerBytes = Math.ceil((4 + countBits) / 8);
    if (rawLen + headerBytes <= totalData) {
      spec = s;
      break;
    }
  }
  if (!spec) throw new Error("El contenido es demasiado extenso para el código QR");

  const codewords = encodeData(text, spec);
  const { matrix, isFunction } = createMatrix(spec);
  placeData(matrix, isFunction, codewords);

  let bestPenalty = Infinity;
  let bestMatrix: boolean[][] = matrix;

  for (let mask = 0; mask < 8; mask++) {
    const masked = applyMask(matrix, isFunction, mask);
    writeFormatAndVersion(masked, spec, mask);
    const penalty = evaluatePenalty(masked);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestMatrix = masked;
    }
  }

  return bestMatrix;
}

export function generateQrSvg(
  text: string,
  options: { size?: number; margin?: number; darkColor?: string; lightColor?: string } = {}
): string {
  const { size = 240, margin = 4, darkColor = "#000000", lightColor = "#ffffff" } = options;
  const matrix = generateQR(text);
  const matrixSize = matrix.length;
  const totalCells = matrixSize + margin * 2;

  let paths = "";
  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      if (matrix[r][c]) {
        const x = c + margin;
        const y = r + margin;
        paths += `M${x},${y}h1v1h-1z `;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalCells} ${totalCells}" width="${size}" height="${size}" shape-rendering="crispEdges">
  <rect width="${totalCells}" height="${totalCells}" fill="${lightColor}"/>
  <path d="${paths.trim()}" fill="${darkColor}"/>
</svg>`;
}
