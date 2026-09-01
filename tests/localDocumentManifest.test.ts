import { describe, expect, it, vi } from 'vitest';
import {
  MAX_LOCAL_DOCUMENT_BYTES,
  MAX_LOCAL_DOCUMENT_FILES,
  LocalDocumentManifestError,
  createLocalDocumentManifest,
  type LocalDocumentLabel,
} from '../services/localDocumentManifest';

const label = (displayName: string, category: LocalDocumentLabel['category'] = 'ROLE_EVIDENCE'): LocalDocumentLabel => ({
  displayName,
  category,
});

const fileStub = (size: number, arrayBuffer = vi.fn(async () => new ArrayBuffer(size))): File => ({
  size,
  type: 'application/pdf',
  arrayBuffer,
} as unknown as File);

describe('local document manifest', () => {
  it('hashes every file and exports only bounded metadata', async () => {
    const files = [
      new File(['hello'], 'internal-board-minutes.pdf', { type: 'application/pdf' }),
      new File(['role'], 'person-name.txt', { type: 'text/plain' }),
    ];

    const manifest = await createLocalDocumentManifest(files, [
      label('董事會授權紀錄', 'REPRESENTATIVE_AUTHORITY'),
      label('職務證明'),
    ]);

    expect(manifest[0]).toMatchObject({
      name: '董事會授權紀錄',
      type: 'application/pdf',
      category: 'REPRESENTATIVE_AUTHORITY',
      size: 5,
      digest: 'sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    });
    expect(manifest[0].checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(manifest[1].checkedAt).toBe(manifest[0].checkedAt);
    expect(Object.keys(manifest[0]).sort()).toEqual([
      'category', 'checkedAt', 'digest', 'name', 'size', 'type',
    ]);
  });

  it('does not expose raw text, local filenames, File objects, or object URLs', async () => {
    const secret = 'CONFIDENTIAL BOARD AUTHORIZATION CONTENT';
    const privateFilename = 'CEO-real-name-private-document.pdf';
    const source = new File([secret], privateFilename, { type: 'application/pdf' });

    const manifest = await createLocalDocumentManifest(
      [source],
      [label('授權證明', 'REPRESENTATIVE_AUTHORITY')],
    );
    const serialized = JSON.stringify(manifest);

    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain(privateFilename);
    expect(serialized).not.toContain('blob:');
    expect(serialized).not.toContain('objectURL');
    expect(Object.values(manifest[0])).not.toContain(source);
  });

  it('fails closed before reading when a file exceeds 2 MiB', async () => {
    const read = vi.fn(async () => new ArrayBuffer(0));
    const oversized = fileStub(MAX_LOCAL_DOCUMENT_BYTES + 1, read);

    const error = await createLocalDocumentManifest([oversized], [label('過大文件')]).catch(value => value);

    expect(error).toBeInstanceOf(LocalDocumentManifestError);
    expect(error).toMatchObject({ code: 'LOCAL_DOCUMENT_FILE_TOO_LARGE', fileIndex: 0 });
    expect(read).not.toHaveBeenCalled();
  });

  it('fails closed before reading when the total exceeds 8 MiB', async () => {
    const reads = Array.from({ length: 5 }, () => vi.fn(async () => new ArrayBuffer(MAX_LOCAL_DOCUMENT_BYTES)));
    const files = reads.map(read => fileStub(MAX_LOCAL_DOCUMENT_BYTES, read));

    const error = await createLocalDocumentManifest(
      files,
      files.map((_, index) => label(`文件 ${index + 1}`)),
    ).catch(value => value);

    expect(error).toBeInstanceOf(LocalDocumentManifestError);
    expect(error).toMatchObject({ code: 'LOCAL_DOCUMENT_TOTAL_TOO_LARGE', fileIndex: 4 });
    reads.forEach(read => expect(read).not.toHaveBeenCalled());
  });

  it('fails closed before reading when more than 12 files are selected', async () => {
    const reads = Array.from({ length: MAX_LOCAL_DOCUMENT_FILES + 1 }, () => vi.fn(async () => new ArrayBuffer(1)));
    const files = reads.map(read => fileStub(1, read));

    const error = await createLocalDocumentManifest(
      files,
      files.map((_, index) => label(`文件 ${index + 1}`)),
    ).catch(value => value);

    expect(error).toBeInstanceOf(LocalDocumentManifestError);
    expect(error).toMatchObject({ code: 'LOCAL_DOCUMENT_TOO_MANY_FILES' });
    reads.forEach(read => expect(read).not.toHaveBeenCalled());
  });

  it('rejects missing document labels instead of guessing metadata', async () => {
    const read = vi.fn(async () => new ArrayBuffer(1));
    const error = await createLocalDocumentManifest([fileStub(1, read)], []).catch(value => value);

    expect(error).toBeInstanceOf(LocalDocumentManifestError);
    expect(error).toMatchObject({ code: 'LOCAL_DOCUMENT_LABEL_COUNT_MISMATCH' });
    expect(read).not.toHaveBeenCalled();
  });
});
