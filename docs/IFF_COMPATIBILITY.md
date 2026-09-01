# IFF-compatible x402 evidence service

VerifyFirst uses `@ifandonlyif/x402-preflight@0.2.0` to compare a caller-supplied
x402 v2 payment requirement with an independent observation. The package is
MIT-licensed and locked by version, registry URL, and integrity digest in
`package-lock.json`.

Version 0.2.0 also provides the canonical amount-blind payee fingerprint.
VerifyFirst computes both canonical requirement and payee fingerprints locally,
then requires the evidence service's `received` fingerprint to match the local
SDK result. A mismatch fails closed as
`UNAVAILABLE / IFF_RECEIVED_FINGERPRINT_MISMATCH`. The payee fingerprint helps
separate an amount-only change from a change of recipient without implying that
either recipient is trustworthy.

Evidence created by this integration uses
`verifyfirst.x402-preflight.v2` and API responses use
`verifyfirst.x402-preflight-response.v2`. The original v1 schemas remain
available unchanged for historical evidence created with SDK 0.1.0. Consumers
must select a validator by the packet's `schema` value instead of treating the
new version as a backward-compatible mutation.

The default evidence service is `https://ifandonlyif.io`. A self-hoster may set
`IFF_BASE_URL` to a compatible service. An override changes the Evidence source
to `IFF_CUSTOM_API`; it is never labeled as the public IFF service.
Custom services must use HTTPS; plaintext HTTP is accepted only for explicit
loopback development hosts (`localhost`, `127.0.0.1`, or `::1`).

## Required HTTP contract

The configured base URL must expose:

```text
POST {IFF_BASE_URL}/api/v3/verify
Content-Type: application/json
```

Request body:

```json
{
  "url": "https://merchant.example/paid-resource",
  "payment_required": {
    "x402Version": 2,
    "accepts": [
      {
        "scheme": "exact",
        "network": "eip155:8453",
        "asset": "0x0000000000000000000000000000000000000000",
        "amount": "1000",
        "payTo": "0x1111111111111111111111111111111111111111"
      }
    ]
  }
}
```

VerifyFirst removes URL credentials, query parameters, and fragments before the
request. The enterprise API accepts HTTPS merchant identifiers only. It does not
fetch the merchant endpoint, hold a wallet key, bind an option, or execute a
payment.

The evidence service must return JSON with this minimum shape:

```json
{
  "url": "https://merchant.example/paid-resource",
  "verdict": "consistent",
  "received": {
    "set_fingerprint": "base64url-or-service-defined-string",
    "option_fingerprints": ["option-fingerprint"]
  },
  "observed": {
    "set_fingerprint": "observed-set-fingerprint",
    "option_fingerprints": ["observed-option-fingerprint"],
    "observation_id": "observation-id",
    "observed_at": "2026-09-01T00:00:00.000Z",
    "probe_type": "scheduled",
    "monitor_id": "monitor-id",
    "monitor_public_key": "public-key",
    "report_hash": "report-hash",
    "monitor_signature": "signature"
  },
  "history": [],
  "unmatched_received_options": [],
  "ownership": {
    "status": "verified"
  },
  "inclusion": null,
  "disclaimer": "Requirement consistency is not a payment-safety guarantee."
}
```

`verdict` must be exactly one of `consistent`, `diverged`, `stale`, or
`unobserved`. `observed` may be absent. When present, all fields shown above are
required. `inclusion` may be `null`; when present it must contain `tree_size`,
`log_index`, `audit_path`, and an `sth` object with `log_id`, `tree_size`,
`timestamp`, `root_hash`, `signature`, and `public_key`.

Optional fields supported by the current contract are `tier`, `window_seconds`,
`stable_since`, `matches_last_observed`, `known`, `divergence_kind`, and the
ownership fields `method`, `verified_at`, and `last_verified_at`.

## Failure and resource limits

- The complete evidence response, including a chunked body, must arrive within
  five seconds by default.
- VerifyFirst buffers at most 256 KiB of decoded response data. A larger declared
  or streamed body becomes `UNAVAILABLE / IFF_RESPONSE_TOO_LARGE`.
- Malformed JSON, unknown verdicts, or invalid required shapes become
  `UNAVAILABLE / IFF_INVALID_RESPONSE`.
- A `received` fingerprint that differs from the local v0.2 canonical result
  becomes `UNAVAILABLE / IFF_RECEIVED_FINGERPRINT_MISMATCH`.
- HTTP errors, timeouts, and incompatible services remain explicit unavailable
  states. They never become `READY_FOR_HUMAN_APPROVAL`.
- The custom service currently receives no API key or custom authorization
  header. Protect a private deployment with network policy or a same-contract
  gateway rather than placing credentials in `IFF_BASE_URL`.

VerifyFirst preserves returned monitor signatures and transparency-log material
in Evidence JSON, but it does not independently validate those signatures or
inclusion proofs. HTTPS transport plus the configured evidence-source trust is
therefore distinct from a locally verified cryptographic proof.

## VerifyFirst API exposure

`POST /api/x402-preflight` is same-origin by default. Set one exact HTTPS origin
in `X402_ALLOWED_ORIGIN` only when a separate browser application must call it.
The endpoint never emits `Access-Control-Allow-Origin: *`.

Each warm function instance applies a bounded best-effort limit of 30 POST
requests per hashed client IP per minute. This is not a global or durable quota:
cold starts and parallel instances have separate counters. Trusted
server-to-server callers may send `X-Bot-Key` matching `BOT_API_KEY`; comparison
uses SHA-256 digests and a constant-time byte comparison. Never expose this key
in browser code.

Run the compatibility and policy tests with:

```bash
npm test -- --run tests/iffX402.test.ts tests/x402PreflightApi.test.ts tests/x402Policy.test.ts
```
