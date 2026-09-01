export type SrcKind = 'data' | 'remote' | 'protocol-relative' | 'blob' | 'vault-uri' | 'vault-absolute' | 'vault-path' | 'unknown';

export interface VaultCtx<TFile = unknown> {
  readonly basePath?: string;
  getAbstractFileByPath(path: string): TFile | null;
  getFirstLinkpathDest(linkpath: string, sourcePath: string): TFile | null;
  readonly sourcePath: string;
}

export interface ClassifiedSrc {
  readonly kind: SrcKind;
  readonly path: string;
}

/**
 * Classify an image src string into its source kind.
 * Pure function — no obsidian imports, no DOM, no fetch.
 */
export function classifySrc(src: string): ClassifiedSrc {
  let s = src;
  try {
    s = decodeURIComponent(src);
  } catch {
    // use raw src if decode fails
  }

  // Strip query and hash suffixes (before classification)
  s = s.replace(/\?.*$/, '').replace(/#.*$/, '');

  // Normalize backslashes (before classification)
  s = s.replace(/\\/g, '/');

  // Strip app://obsidian.md/ (mobile)
  const mobileMatch = s.match(/^app:\/\/obsidian\.md\//iu);
  if (mobileMatch) {
    s = s.slice(mobileMatch[0].length);
    return { kind: 'vault-uri', path: s };
  }

  // Strip app://local/ + basePath prefix (desktop)
  if (s.startsWith('app://local/')) {
    s = s.slice('app://local/'.length);
    if (s.startsWith('/')) s = s.slice(1);
    return { kind: 'vault-absolute', path: s };
  }

  // Protocol-relative
  if (s.startsWith('//')) {
    return { kind: 'protocol-relative', path: s };
  }

  // Blob (unresolvable)
  if (s.startsWith('blob:')) {
    return { kind: 'blob', path: '' };
  }

  // Data URI
  if (s.startsWith('data:')) {
    return { kind: 'data', path: '' };
  }

  // Remote HTTP(S)
  if (s.startsWith('http:') || s.startsWith('https:')) {
    return { kind: 'remote', path: s };
  }

  // Bare filename (vault-path) — no slash but has extension
  if (!s.includes('/') && s.includes('.')) {
    return { kind: 'vault-path', path: s };
  }

  return { kind: 'unknown', path: s };
}

/**
 * Resolve a vault file path using Obsidian's resolution chain.
 * Pure function — services injected via ctx parameter.
 */
export function resolveVaultFile<TFile>(path: string, ctx: VaultCtx<TFile>): TFile | null {
  // 1. Direct lookup
  const file = ctx.getAbstractFileByPath(path);
  if (file) return file;

  // 2. Join with sourcePath directory and retry
  const dir = ctx.sourcePath.split('/').slice(0, -1).join('/');
  const joined = dir ? `${dir}/${path}` : path;
  const file2 = ctx.getAbstractFileByPath(joined);
  if (file2) return file2;

  // 3. Fallback to getFirstLinkpathDest
  return ctx.getFirstLinkpathDest(path, ctx.sourcePath);
}

/** Extension-to-MIME mapping for supported image types */
export const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
};

/**
 * Get MIME type for a file extension.
 * Returns null for unknown extensions.
 */
export function mimeForExt(ext: string): string | null {
  const key = ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
  return MIME_BY_EXT[key] ?? null;
}

/**
 * Check if a MIME type represents a raster image (not SVG).
 * SVG is the only vector format we handle; everything else is raster.
 */
export function isRasterMime(mime: string): boolean {
  return mime !== 'image/svg+xml';
}
/**
 * Convert bytes to a data URI with chunked base64 encoding.
 * Uses 0x8000 (32768) byte chunks to avoid call-stack overflow.
 */
export function bytesToBase64DataUri(bytes: Uint8Array, mime: string): string {
  const chunks: string[] = [];
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + chunkSize)));
  }
  return `data:${mime};base64,${btoa(chunks.join(''))}`;
}

export type DownscaleSetting = 'original' | 'kompakt' | 'klein';

/**
 * Decide whether an image needs downscaling based on size and setting.
 * SVG is NEVER downscaled (vector format, kept as-is).
 * GIF is treated as raster (PDF is static, animation lost in print).
 */
export function needsDownscale(
  byteLength: number,
  width: number,
  height: number,
  setting: DownscaleSetting,
  mime?: string,
): boolean {
  // SVG never needs downscaling
  if (mime === 'image/svg+xml') return false;

  const maxEdge = Math.max(width, height);

  switch (setting) {
    case 'original':
      return false;
    case 'kompakt':
      return byteLength > 300_000 || maxEdge > 1600;
    case 'klein':
      return byteLength > 300_000 || maxEdge > 1024;
    default:
      return false;
  }
}

/**
 * Keep-Smaller-Guard: use raster result only if it's actually smaller.
 * Prevents useless re-encoding when original is already compact.
 */
export function shouldUseRasterResult(
  rasterBytes: Uint8Array,
  originalBytes: Uint8Array,
): boolean {
  return rasterBytes.byteLength < originalBytes.byteLength;
}

export interface Stats {
  inlined: number;
  skipped: number;
  failed: number;
}
