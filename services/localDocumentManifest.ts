export const MAX_LOCAL_DOCUMENT_FILES = 12;
export const MAX_LOCAL_DOCUMENT_BYTES = 2 * 1024 * 1024;
export const MAX_LOCAL_DOCUMENT_TOTAL_BYTES = 8 * 1024 * 1024;

export type LocalDocumentCategory =
  | 'LEGAL_ENTITY_IDENTITY'
  | 'OWNERSHIP_RELATIONSHIP'
  | 'REPRESENTATIVE_IDENTITY'
  | 'REPRESENTATIVE_AUTHORITY'
  | 'ROLE_EVIDENCE'
  | 'OTHER';

export interface LocalDocumentLabel {
  /** Human-readable label exported instead of the potentially sensitive local filename. */
  displayName: string;
  category: LocalDocumentCategory;
}

export interface LocalDocumentManifestEntry {
  name: string;
  type: string;
  category: LocalDocumentCategory;
  size: number;
  digest: `sha256:${string}`;
  checkedAt: string;
}

export type LocalDocumentManifestErrorCode =
  | 'LOCAL_DOCUMENT_INVALID_INPUT'
  | 'LOCAL_DOCUMENT_LABEL_COUNT_MISMATCH'
  | 'LOCAL_DOCUMENT_INVALID_LABEL'
  | 'LOCAL_DOCUMENT_TOO_MANY_FILES'
  | 'LOCAL_DOCUMENT_FILE_TOO_LARGE'
  | 'LOCAL_DOCUMENT_TOTAL_TOO_LARGE'
  | 'LOCAL_DOCUMENT_READ_FAILED'
  | 'LOCAL_DOCUMENT_SIZE_MISMATCH'
  | 'LOCAL_DOCUMENT_CRYPTO_UNAVAILABLE';

export class LocalDocumentManifestError extends Error {
  readonly code: LocalDocumentManifestErrorCode;
  readonly fileIndex?: number;

  constructor(code: LocalDocumentManifestErrorCode, message: string, fileIndex?: number) {
    super(message);
    this.name = 'LocalDocumentManifestError';
    this.code = code;
    this.fileIndex = fileIndex;
  }
}

const DOCUMENT_CATEGORIES = new Set<LocalDocumentCategory>([
  'LEGAL_ENTITY_IDENTITY',
  'OWNERSHIP_RELATIONSHIP',
  'REPRESENTATIVE_IDENTITY',
  'REPRESENTATIVE_AUTHORITY',
  'ROLE_EVIDENCE',
  'OTHER',
]);

const isFileLike = (value: unknown): value is File => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<File>;
  return typeof candidate.size === 'number'
    && Number.isSafeInteger(candidate.size)
    && candidate.size >= 0
    && typeof candidate.type === 'string'
    && typeof candidate.arrayBuffer === 'function';
};

const normalizeLabels = (
  files: readonly File[],
  labels: readonly LocalDocumentLabel[],
): Array<{ displayName: string; category: LocalDocumentCategory }> => {
  if (labels.length !== files.length) {
    throw new LocalDocumentManifestError(
      'LOCAL_DOCUMENT_LABEL_COUNT_MISMATCH',
      'Every local document must have exactly one category and display name.',
    );
  }

  return labels.map((label, index) => {
    const displayName = typeof label?.displayName === 'string' ? label.displayName.trim() : '';
    if (
      !displayName
      || displayName.length > 160
      || !DOCUMENT_CATEGORIES.has(label?.category)
    ) {
      throw new LocalDocumentManifestError(
        'LOCAL_DOCUMENT_INVALID_LABEL',
        'Document display names must contain 1–160 characters and use a supported category.',
        index,
      );
    }
    return { displayName, category: label.category };
  });
};

const digestSha256 = async (bytes: ArrayBuffer): Promise<`sha256:${string}`> => {
  if (!globalThis.crypto?.subtle) {
    throw new LocalDocumentManifestError(
      'LOCAL_DOCUMENT_CRYPTO_UNAVAILABLE',
      'Web Crypto SHA-256 is required to build a local document manifest.',
    );
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  const hex = [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
  return `sha256:${hex}`;
};

/**
 * Hash local files in the browser and return metadata only. The returned
 * manifest never contains file contents, File/Blob references, or object URLs.
 * Labels correspond to files by array index so duplicate local filenames are
 * handled without ambiguity.
 */
export const createLocalDocumentManifest = async (
  files: readonly File[],
  labels: readonly LocalDocumentLabel[],
): Promise<LocalDocumentManifestEntry[]> => {
  if (!Array.isArray(files) || !Array.isArray(labels) || files.some(file => !isFileLike(file))) {
    throw new LocalDocumentManifestError(
      'LOCAL_DOCUMENT_INVALID_INPUT',
      'Local documents and their labels must be supplied as arrays.',
    );
  }
  if (files.length > MAX_LOCAL_DOCUMENT_FILES) {
    throw new LocalDocumentManifestError(
      'LOCAL_DOCUMENT_TOO_MANY_FILES',
      `A manifest may contain at most ${MAX_LOCAL_DOCUMENT_FILES} files.`,
    );
  }

  const normalizedLabels = normalizeLabels(files, labels);
  let declaredTotal = 0;
  files.forEach((file, index) => {
    if (file.size > MAX_LOCAL_DOCUMENT_BYTES) {
      throw new LocalDocumentManifestError(
        'LOCAL_DOCUMENT_FILE_TOO_LARGE',
        `Document ${index + 1} exceeds the 2 MiB per-file limit.`,
        index,
      );
    }
    declaredTotal += file.size;
    if (declaredTotal > MAX_LOCAL_DOCUMENT_TOTAL_BYTES) {
      throw new LocalDocumentManifestError(
        'LOCAL_DOCUMENT_TOTAL_TOO_LARGE',
        'The selected documents exceed the 8 MiB total limit.',
        index,
      );
    }
  });

  const checkedAt = new Date().toISOString();
  const manifest: LocalDocumentManifestEntry[] = [];
  let actualTotal = 0;

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    let bytes: ArrayBuffer;
    try {
      bytes = await file.arrayBuffer();
    } catch {
      throw new LocalDocumentManifestError(
        'LOCAL_DOCUMENT_READ_FAILED',
        `Document ${index + 1} could not be read locally.`,
        index,
      );
    }

    if (bytes.byteLength !== file.size || bytes.byteLength > MAX_LOCAL_DOCUMENT_BYTES) {
      throw new LocalDocumentManifestError(
        'LOCAL_DOCUMENT_SIZE_MISMATCH',
        `Document ${index + 1} did not match its declared safe size.`,
        index,
      );
    }
    actualTotal += bytes.byteLength;
    if (actualTotal > MAX_LOCAL_DOCUMENT_TOTAL_BYTES) {
      throw new LocalDocumentManifestError(
        'LOCAL_DOCUMENT_TOTAL_TOO_LARGE',
        'The selected documents exceed the 8 MiB total limit.',
        index,
      );
    }

    manifest.push({
      name: normalizedLabels[index].displayName,
      type: file.type,
      category: normalizedLabels[index].category,
      size: bytes.byteLength,
      digest: await digestSha256(bytes),
      checkedAt,
    });
  }

  return manifest;
};
