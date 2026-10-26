const imageExtensions = [
  'jpg',
  'jpeg',
  'png',
  'svg',
  'gif',
  'bmp',
  'webp',
  'tiff',
] as const;

const audioExtensions = [
  'mp3',
  'wav',
  'flac',
  'aac',
  'ogg',
  'm4a',
] as const;

const textExtensions = [
  'txt',
  'rtf',
  'odt',
] as const;

const markdownExtensions = [
  'md',
  'markdown',
  'mdx',
] as const;

const videoExtensions = ['mp4', 'm4v', 'webm', 'ogv', 'mov'] as const;

export function getExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx !== -1 ? name.slice(idx + 1).toLowerCase() : '';
}

function isExtension(ext: string, list: readonly string[]): boolean {
  return (list as readonly string[]).includes(ext);
}

export function isImageExtension(ext: string): boolean {
  return isExtension(ext, imageExtensions);
}

export function isAudioExtension(ext: string): boolean {
  return isExtension(ext, audioExtensions);
}

export function isTextExtension(ext: string): boolean {
  return isExtension(ext, textExtensions);
}

export function isMarkdownExtension(ext: string): boolean {
  return isExtension(ext, markdownExtensions);
}

export function isPdfExtension(ext: string): boolean {
  return ext === 'pdf';
}

export function isVideoExtension(ext: string): boolean {
  return isExtension(ext, videoExtensions);
}
