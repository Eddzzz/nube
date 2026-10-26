require('./register-ts.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getShareOrigin, shareExpiry } = require('../src/lib/shareOrigin.ts');
const { generateQR, generateQrSvg } = require('../src/features/share/lib/qr.ts');
const request = (url, host, forwarded = 'evil.example') => ({ url, headers: new Headers({ host, 'x-forwarded-host': forwarded, 'x-forwarded-proto': 'https' }) });
const ethernet = { address: '192.168.100.142', family: 'IPv4', internal: false, netmask: '', cidr: null, mac: '' };
test('localhost QR chooses LAN address and keeps actual HTTP port, ignores forwarded headers', () => {
  assert.equal(getShareOrigin(request('http://localhost:3000/api/share', 'localhost:3000'), { baseUrl: '', interfaces: { Ethernet: [ethernet] } }), 'http://192.168.100.142:3000');
});
test('prefers physical private network over virtual adapters', () => {
  assert.equal(getShareOrigin(request('http://127.0.0.1:3000/', '127.0.0.1:3000'), { baseUrl: '', interfaces: { 'vEthernet (WSL)': [{ ...ethernet, address: '172.20.0.1' }], WiFi: [ethernet] } }), 'http://192.168.100.142:3000');
});
test('uses actual LAN Host without forwarded spoofing', () => assert.equal(getShareOrigin(request('http://localhost:3000/', '192.168.1.20:3000'), { baseUrl: '' }), 'http://192.168.1.20:3000'));
test('explicit network URL overrides detection and strips path', () => assert.equal(getShareOrigin(request('http://localhost/', 'localhost'), { baseUrl: 'https://files.example.org/path' }), 'https://files.example.org'));
test('invalid configured origins and missing network fail rather than creating localhost QR', () => {
  for (const baseUrl of ['http://localhost:3000', 'http://127.0.0.1', 'ftp://files.example.org', 'https://user:password@example.org']) assert.throws(() => getShareOrigin(request('http://localhost/', 'localhost'), { baseUrl }));
  assert.throws(() => getShareOrigin(request('http://localhost/', 'localhost'), { baseUrl: '', interfaces: {} }), /IP local/);
});
test('expiration accepts only supported durations', () => {
  assert.equal(shareExpiry('never', 0), '');
  assert.equal(shareExpiry('24h', 0), '1970-01-02T00:00:00.000Z');
  assert.equal(shareExpiry('7d', 0), '1970-01-08T00:00:00.000Z');
  assert.equal(shareExpiry('30d', 0), '1970-01-31T00:00:00.000Z');
  for (const value of ['public', null, false, 7]) assert.throws(() => shareExpiry(value, 0));
});
test('QR is generated locally with quiet zone and square finder patterns', () => {
  const value = 'http://192.168.100.142:3000/share/abcdefghijklmnopqrstuvwxyz123456';
  const matrix = generateQR(value);
  assert.equal(matrix.length, matrix[0].length);
  assert.equal((matrix.length - 17) % 4, 0);
  assert.equal(matrix[0][0], true);
  assert.equal(matrix[1][1], false);
  assert.equal(matrix[3][3], true);
  const svg = generateQrSvg(value, { size: 300, margin: 4 });
  assert.match(svg, /<svg/);
  assert.match(svg, /#fff|#ffffff|white/);
  assert.doesNotMatch(svg, /<image/);
});
test('both QR format copies agree and never overwrite the fixed dark module', () => {
  for (const text of ['a', 'hello', 'http://192.168.100.142:3000/share/abcdefghijklmnopqrstuvwxyz123456', 'x'.repeat(250)]) {
    const matrix = generateQR(text), size = matrix.length;
    assert.equal(matrix[size - 8][8], true);
    for (let i = 0; i < 15; i++) {
      const first = i < 6 ? matrix[8][i] : i === 6 ? matrix[8][7] : i === 7 ? matrix[8][8] : i === 8 ? matrix[7][8] : matrix[14 - i][8];
      const second = i < 7 ? matrix[size - 1 - i][8] : matrix[8][size - 15 + i];
      assert.equal(first, second, `format bit ${i} for ${text.length} bytes`);
    }
  }
});
