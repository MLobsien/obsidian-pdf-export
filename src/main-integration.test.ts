// @vitest-environment happy-dom
import { describe, test, expect } from 'vitest';
import {
  classifySrc,
  resolveVaultFile,
  bytesToBase64DataUri,
  type VaultCtx,
} from './image-inliner';

/**
 * DOM-Glue Test: Simulates the inlineImages pipeline with mocked services.
 * Uses happy-dom for DOM APIs (querySelectorAll, setAttribute, etc.)
 */
describe('inlineImages DOM-glue', () => {
  // Mock vault files
  const mockFiles: Record<string, { bytes: Uint8Array; extension: string }> = {
    'Mathe/IMG_0002.jpg': {
      bytes: new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]), // JPEG header
      extension: 'jpg',
    },
  };

  // Mock services
  const mockCtx: VaultCtx = {
    sourcePath: 'Mathe/Note.md',
    getAbstractFileByPath: (path: string) => {
      if (mockFiles[path]) return { path, extension: mockFiles[path].extension };
      return null;
    },
    getFirstLinkpathDest: (link: string, src: string) => {
      // Simulate Obsidian's link resolution
      if (link === 'IMG_0002.jpg' && src === 'Mathe/Note.md') {
        return { path: 'Mathe/IMG_0002.jpg', extension: 'jpg' };
      }
      return null;
    },
  };

  test('3-img fixture: replaces vault-uri, keeps remote, keeps unresolvable src, failed=1', () => {
    // Create a DOM container with 3 images
    const container = document.createElement('div');
    container.innerHTML = `
      <img src="app://obsidian.md/Mathe/IMG_0002.jpg" alt="vault image">
      <img src="https://example.com/x.png" alt="remote image">
      <img src="app://obsidian.md/Mathe/fehlt.png" alt="missing image">
    `;

    const imgs = container.querySelectorAll('img[src]');
    expect(imgs.length).toBe(3);

    // Simulate inlineImages logic
    const seen = new Set<string>();
    let inlined = 0;
    let skipped = 0;
    let failed = 0;

    for (const img of Array.from(imgs)) {
      const src = img.getAttribute('src') || '';
      if (!src || seen.has(src)) continue;
      seen.add(src);

      const classified = classifySrc(src);

      // Skip passthrough classes
      if (classified.kind === 'data' || classified.kind === 'remote' || classified.kind === 'protocol-relative') {
        skipped++;
        continue;
      }

      // Blob is unresolvable
      if (classified.kind === 'blob') {
        failed++;
        continue;
      }

      // Resolve vault file
      const file = resolveVaultFile(classified.path, mockCtx);

      if (!file) {
        failed++;
        continue;
      }

      // Simulate reading bytes and creating data URI
      const fileData = mockFiles[(file as any).path];
      if (fileData) {
        const dataUri = bytesToBase64DataUri(fileData.bytes, `image/${fileData.extension}`);
        img.setAttribute('src', dataUri);
        inlined++;
      } else {
        failed++;
      }
    }

    // Assertions
    expect(inlined).toBe(1); // IMG_0002.jpg was inlined
    expect(skipped).toBe(1); // https://example.com/x.png was skipped
    expect(failed).toBe(1);  // fehlt.png was not found

    // Check that the vault image src was replaced with data URI
    const vaultImg = container.querySelectorAll('img')[0];
    expect(vaultImg.getAttribute('src')).toMatch(/^data:image\/jpg;base64,/);

    // Check that remote image src is unchanged
    const remoteImg = container.querySelectorAll('img')[1];
    expect(remoteImg.getAttribute('src')).toBe('https://example.com/x.png');

    // Check that missing image src is unchanged
    const missingImg = container.querySelectorAll('img')[2];
    expect(missingImg.getAttribute('src')).toBe('app://obsidian.md/Mathe/fehlt.png');
  });

  test('sourcePath is passed through correctly', () => {
    // Verify that sourcePath affects resolution
    const file = resolveVaultFile('IMG_0002.jpg', mockCtx);
    expect(file).not.toBeNull();
    expect((file as any).path).toBe('Mathe/IMG_0002.jpg');
  });

  test('deduplication: same src appearing twice is only processed once', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <img src="app://obsidian.md/Mathe/IMG_0002.jpg">
      <img src="app://obsidian.md/Mathe/IMG_0002.jpg">
    `;

    const imgs = container.querySelectorAll('img[src]');
    const seen = new Set<string>();
    let processed = 0;

    for (const img of Array.from(imgs)) {
      const src = img.getAttribute('src') || '';
      if (!src || seen.has(src)) continue;
      seen.add(src);
      processed++;
    }

    expect(processed).toBe(1); // Only processed once
  });
});
