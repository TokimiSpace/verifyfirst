# Vercel Blob retirement checklist

VerifyFirst no longer reads from or writes to Vercel Blob at runtime. Analysis
results and rate-limit counters now use bounded warm-instance memory only. This
removes new Blob operations, but deploying the code does not remove objects or
tokens created by older releases.

## One-time production cleanup

1. Deploy the Blob-free release and run the normal analysis smoke test first.
2. In the Vercel project, open **Storage → Blob** and inventory the store that
   was connected to VerifyFirst. Specifically review the historical prefixes
   `cache/`, `ml-data/`, and `ratelimit/`.
3. If legal or incident-retention policy requires an archive, export only the
   approved records to an access-controlled location. Treat anything under
   `ml-data/` as potentially sensitive. Do not copy it into the repository.
4. After confirming the retention decision and exact store, delete the legacy
   objects. This is intentionally a manual production action because deletion
   is irreversible.
5. Remove `BLOB_READ_WRITE_TOKEN` from Production, Preview, and Development
   environment settings. Disconnect and delete the unused Blob store if no
   other application owns it.

## Verification after cleanup

- The Vercel Blob dashboard reports zero remaining objects for the retired
  store, or the store is deleted.
- A sample of previously public object URLs returns HTTP `404` or `410` without
  authentication. Do not paste private URLs or tokens into tickets or logs.
- `/api/analyze` still succeeds and repeated identical requests can use the
  warm-instance memory cache.
- Function logs contain no Blob SDK requests or `BLOB_READ_WRITE_TOKEN` errors.
- `npm ls @vercel/blob --all` returns an empty dependency tree.

The in-memory request limiter is best-effort per warm serverless instance. It
reduces accidental bursts but is not a global quota or abuse-control boundary;
provider-side AI budgets and alerts remain necessary.
