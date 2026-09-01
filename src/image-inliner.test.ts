import { describe, test, expect } from 'vitest';
import {
  classifySrc,
  resolveVaultFile,
  mimeForExt,
  isRasterMime,
  type VaultCtx,
  type ClassifiedSrc,
} from './image-inliner';

describe('classifySrc', () => {
  test('data: URI → data', () => {
    const result = classifySrc('data:image/png;base64,abc123');
    expect(result.kind).toBe('data');
    expect(result.path).toBe('');
  });

  test('https:// remote URL → remote', () => {
    const result = classifySrc('https://example.com/image.png');
    expect(result.kind).toBe('remote');
    expect(result.path).toBe('https://example.com/image.png');
  });

  test('http:// remote URL → remote', () => {
    const result = classifySrc('http://example.com/image.png');
    expect(result.kind).toBe('remote');
    expect(result.path).toBe('http://example.com/image.png');
  });

  test('protocol-relative //cdn.example.com/a.png → protocol-relative', () => {
    const result = classifySrc('//cdn.example.com/a.png');
    expect(result.kind).toBe('protocol-relative');
    expect(result.path).toBe('//cdn.example.com/a.png');
  });

  test('blob:xyz → blob (unresolvable)', () => {
    const result = classifySrc('blob:abc123');
    expect(result.kind).toBe('blob');
    expect(result.path).toBe('');
  });

  test('app://obsidian.md/Mathe/IMG_0002.jpg → vault-uri, extracts path', () => {
    const result = classifySrc('app://obsidian.md/Mathe/IMG_0002.jpg');
    expect(result.kind).toBe('vault-uri');
    expect(result.path).toBe('Mathe/IMG_0002.jpg');
  });

  test('app://obsidian.md/ with percent-encoded spaces → vault-uri, decodes', () => {
    const src = 'app://obsidian.md/Mathe/Bildschirmfoto%202026-08-25%20um%2010.20.50.png';
    const result = classifySrc(src);
    expect(result.kind).toBe('vault-uri');
    expect(result.path).toBe('Mathe/Bildschirmfoto 2026-08-25 um 10.20.50.png');
  });

  test('app://obsidian.md/ with query suffix → vault-uri, strips query', () => {
    const result = classifySrc('app://obsidian.md/path/to/file.jpg?1678876');
    expect(result.kind).toBe('vault-uri');
    expect(result.path).toBe('path/to/file.jpg');
  });

  test('app://obsidian.md/ with hash suffix → vault-uri, strips hash', () => {
    const result = classifySrc('app://obsidian.md/path/to/file.png#section');
    expect(result.kind).toBe('vault-uri');
    expect(result.path).toBe('path/to/file.png');
  });

  test('app://local/ with absolute path → vault-absolute', () => {
    const result = classifySrc('app://local//home/mad5/Schule/Mathe/IMG_0002.jpg');
    expect(result.kind).toBe('vault-absolute');
    expect(result.path).toBe('home/mad5/Schule/Mathe/IMG_0002.jpg');
  });

  test('bare filename IMG_0002.jpg → vault-path', () => {
    const result = classifySrc('IMG_0002.jpg');
    expect(result.kind).toBe('vault-path');
    expect(result.path).toBe('IMG_0002.jpg');
  });

  test('backslashes normalized to forward slashes', () => {
    const result = classifySrc('app://obsidian.md/Mathe\\image.jpg');
    expect(result.kind).toBe('vault-uri');
    expect(result.path).toBe('Mathe/image.jpg');
  });

  test('bare file with any extension → vault-path', () => {
    const result = classifySrc('file.xyz');
    expect(result.kind).toBe('vault-path');
    expect(result.path).toBe('file.xyz');
  });

  test('path without extension → unknown', () => {
    const result = classifySrc('some/random/path');
    expect(result.kind).toBe('unknown');
  });
});

describe('resolveVaultFile', () => {
  test('direct getAbstractFileByPath match → returns file', () => {
    const mockFile = { path: 'Mathe/IMG_0002.jpg' };
    const ctx: VaultCtx = {
      sourcePath: 'Mathe/Note.md',
      getAbstractFileByPath: (p: string) => p === 'Mathe/IMG_0002.jpg' ? mockFile : null,
      getFirstLinkpathDest: () => null,
    };
    expect(resolveVaultFile('Mathe/IMG_0002.jpg', ctx)).toBe(mockFile);
  });

  test('fallback: join with sourcePath dir → returns file', () => {
    const mockFile = { path: 'Mathe/sub/image.jpg' };
    const ctx: VaultCtx = {
      sourcePath: 'Mathe/Note.md',
      getAbstractFileByPath: (p: string) => p === 'Mathe/sub/image.jpg' ? mockFile : null,
      getFirstLinkpathDest: () => null,
    };
    // Direct lookup fails, but joining "sub/image.jpg" with "Mathe/" succeeds
    expect(resolveVaultFile('sub/image.jpg', ctx)).toBe(mockFile);
  });

  test('fallback: getFirstLinkpathDest → returns file', () => {
    const mockFile = { path: 'resolved.jpg' };
    const ctx: VaultCtx = {
      sourcePath: 'Note.md',
      getAbstractFileByPath: () => null,
      getFirstLinkpathDest: (link: string, src: string) =>
        link === 'image.jpg' && src === 'Note.md' ? mockFile : null,
    };
    expect(resolveVaultFile('image.jpg', ctx)).toBe(mockFile);
  });

  test('all paths return null → returns null', () => {
    const ctx: VaultCtx = {
      sourcePath: 'Note.md',
      getAbstractFileByPath: () => null,
      getFirstLinkpathDest: () => null,
    };
    expect(resolveVaultFile('missing.jpg', ctx)).toBeNull();
  });
});

describe('mimeForExt', () => {
  test('known extensions return correct MIME types', () => {
    expect(mimeForExt('.png')).toBe('image/png');
    expect(mimeForExt('.jpg')).toBe('image/jpeg');
    expect(mimeForExt('.jpeg')).toBe('image/jpeg');
    expect(mimeForExt('.gif')).toBe('image/gif');
    expect(mimeForExt('.webp')).toBe('image/webp');
    expect(mimeForExt('.bmp')).toBe('image/bmp');
    expect(mimeForExt('.svg')).toBe('image/svg+xml');
    expect(mimeForExt('.avif')).toBe('image/avif');
  });

  test('extension without dot works', () => {
    expect(mimeForExt('png')).toBe('image/png');
    expect(mimeForExt('JPG')).toBe('image/jpeg');
  });

  test('unknown extension returns null', () => {
    expect(mimeForExt('.xyz')).toBeNull();
    expect(mimeForExt('.pdf')).toBeNull();
  });
});

describe('isRasterMime', () => {
  test('image/svg+xml → false (vector, not raster)', () => {
    expect(isRasterMime('image/svg+xml')).toBe(false);
  });

  test('image/jpeg → true', () => {
    expect(isRasterMime('image/jpeg')).toBe(true);
  });

  test('image/png → true', () => {
    expect(isRasterMime('image/png')).toBe(true);
  });

  test('image/gif → true', () => {
    expect(isRasterMime('image/gif')).toBe(true);
  });

  test('image/webp → true', () => {
    expect(isRasterMime('image/webp')).toBe(true);
  });

  test('image/avif → true', () => {
    expect(isRasterMime('image/avif')).toBe(true);
  });
});
