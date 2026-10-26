require('./register-ts.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getExtension, isPdfExtension, isVideoExtension, isImageExtension } = require('../src/lib/fileTypes.ts');

test('PDF and browser video formats are previewable without treating Office documents as images', () => {
  assert.equal(isPdfExtension(getExtension('Informe.Academico.PDF')), true);
  for (const filename of ['Demostración.MP4', 'captura.webm', 'movil.mov', 'video.m4v', 'libre.ogv']) {
    assert.equal(isVideoExtension(getExtension(filename)), true, filename);
  }
  for (const filename of ['informe.docx', 'hoja.xlsx', 'sin-extension', 'video.mp4.exe']) {
    const extension = getExtension(filename);
    assert.equal(isPdfExtension(extension), false, filename);
    assert.equal(isVideoExtension(extension), false, filename);
    assert.equal(isImageExtension(extension), false, filename);
  }
});
