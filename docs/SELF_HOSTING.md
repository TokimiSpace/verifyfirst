# Self-hosting VerifyFirst

VerifyFirst is MIT-licensed and designed so the verification logic, policy
decisions, failure modes, and Evidence formats can be inspected and rerun by
the operator. Vercel is the reference serverless adapter in this repository;
it is not required by the browser-side verification logic or Evidence schemas.

## Choose a runtime profile

| Profile | Private key required | Network dependencies | What works |
|---|---:|---|---|
| Static evaluation | No | No required API for non-OCR local flows; OCR assets may be remote unless vendored | To C examples, x402 simulation, local document manifests, pinned vLEI fixture checks, static deep dives |
| Enterprise live preflight | No private API key | GLEIF public API and/or IFF public API | Live LEI lookup, local CESR preflight, live x402 requirement comparison, deterministic policy, Evidence export |
| To C live AI | `GEMINI_API_KEY` | Gemini plus any optional anti-scam sources enabled by the operator | Live multilingual anti-scam analysis in addition to the other profiles |

The enterprise lab does not call an LLM to decide LEI, vLEI, document-manifest,
x402, or policy results. A separate LLM workflow or chatbot may consume bounded,
secret-free Evidence JSON. The model is never the verifier.

## Local development

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000/` for To C and
`http://localhost:3000/business/` for the enterprise lab.

Before a contribution or deployment:

```bash
npm run typecheck
npm test
npm run build
```

## Runtime routes

Deploy the Vite build output from `dist/` and provide a Node.js 20-compatible
serverless or server adapter for these endpoints:

| Route | Purpose | External dependency |
|---|---|---|
| `POST /api/analyze` | To C live AI analysis | Gemini; optional Safe Browsing, VirusTotal, Cofacts, content-free labeling metrics, and opt-in URL observation |
| `POST /api/agent-policy` | Legacy deterministic Agent policy test harness | None |
| `POST /api/x402-preflight` | Enterprise x402 policy comparison plus IFF evidence | IFF public API |

The SPA host must rewrite `/business` and `/business/` to `index.html`. Static
hosts without a server adapter still support local simulations and browser-only
workflows; LIVE server routes must report failure and must never silently return
simulation output.

## Environment variables

Copy `.env.example`. The source of truth for variables read by the application
is the table in the root README plus the comments in that example file.

- Keep all secret variables server-side. Never prefix them with `VITE_`.
- `IFF_BASE_URL` is optional and allows a compatible staging or self-hosted IFF
  endpoint. The default is the public `https://ifandonlyif.io` service. See the
  exact [IFF compatibility contract](IFF_COMPATIBILITY.md).
- `/api/x402-preflight` is same-origin by default. `X402_ALLOWED_ORIGIN` may name
  one exact HTTPS origin; wildcards and multiple origins are not supported.
- `BOT_API_KEY` permits trusted server-to-server callers to bypass the x402
  warm-instance rate limit through `X-Bot-Key`. Never ship this key to a browser.
- Browser analytics are opt-in. Set the public build flag
  `VITE_ENABLE_VERCEL_ANALYTICS=true` only if the operator intentionally wants
  Vercel Web Analytics; self-hosted builds default to no analytics component.
- The application bundles React, Tailwind, and its executable UI code from the
  reviewed lockfile and uses system fonts. Screenshot OCR is lazy-loaded; by
  default Tesseract may retrieve worker, core, and language data on first use.
  Set `VITE_TESSERACT_WORKER_PATH`, `VITE_TESSERACT_CORE_PATH`, and
  `VITE_TESSERACT_LANG_PATH` to operator-hosted public assets for a deployment
  that must not contact the default Tesseract asset CDN.
- No object-storage binding is required. Caches and rate limits are bounded to
  the warm serverless instance; browser Evidence exports are local downloads.
- `GOOGLE_SHEETS_WEBHOOK_URL` transmits content-free To C labeling metrics:
  submission id/time, language, input type and length, scores, final decision,
  and risk-signal types. It does not receive raw or sanitized input, narrative
  text, or quoted evidence. Leave it unset unless the operator has reviewed and
  disclosed that data flow.
- `ENABLE_URL_OBSERVATION` defaults off. Only the exact string `true` allows
  the API to fetch a caller-supplied URL and its redirects. This must run behind
  restricted outbound networking that denies internal, link-local, and cloud
  metadata destinations. The application hostname/DNS checks are defense in
  depth and cannot fully eliminate DNS rebinding.

## To C data flow

The consumer form does not isolate submitted content entirely on device.
Validated text, phone numbers, and URLs are sent to `/api/analyze`; Gemini
receives the input plus gathered evidence. Cofacts may receive the first 100
characters, enabled Safe Browsing receives the URL, and VirusTotal/RDAP/DNS
receive domain-level identifiers. ScamSniffer lists are downloaded by the
server. Browser OCR keeps the screenshot local, but its extracted text is sent
when the user submits the check.

The completed response can remain in a bounded warm-instance memory cache for
up to 72 hours and includes the normalized input. It is not written to Blob.
Operators must publish their own privacy notice, retention policy, enabled
provider list, and lawful basis before offering the To C flow publicly.

## Enterprise data flows

### vLEI

1. The 20-character LEI is sent to the official GLEIF API.
2. Raw CESR remains in browser memory during the local preflight.
3. Supporting documents are hashed locally. The handoff JSON contains only a
   caller-selected display label, category, MIME type, size, SHA-256 digest,
   and check time; document contents are not uploaded.
4. Production still needs a controlled backend verifier with live OOBI,
   witness, KEL/TEL status, duplicity detection, trust-root policy, and audit
   retention. VerifyFirst is not a QVI and does not issue vLEIs.

### x402

1. The browser submits an HTTPS endpoint identifier, x402 v2
   `PAYMENT-REQUIRED`, and the operator's network/asset/payee/amount policy to
   `/api/x402-preflight`.
2. The API removes credentials, query, and fragment. It does not fetch the
   caller-supplied merchant endpoint.
3. Local policy is evaluated before IFF is called. A mismatch prevents the IFF
   request; live evidence failure remains a fail-closed hold.
4. Output always records `NOT_BOUND` and `NOT_EXECUTED`. VerifyFirst never
   receives wallet keys, signs, pays, settles, or guarantees delivery.

The x402 route limits each hashed client IP to 30 POST requests per minute in a
bounded warm-instance map. This is best-effort abuse resistance, not a global or
durable quota: cold starts and parallel instances have independent counters.
Deployments that need enforceable tenant quotas must add a trusted gateway or
durable rate-limit service. Configure trusted-proxy handling so clients cannot
spoof the forwarded IP headers used by the runtime adapter.

## Evidence and compatibility

Current browser and API exports use these versioned schemas:

- `verifyfirst.enterprise-verification.v1`
- [`verifyfirst.vlei-handoff.v1`](../public/schemas/verifyfirst.vlei-handoff.v1.schema.json)
- [`verifyfirst.x402-preflight.v2`](../public/schemas/verifyfirst.x402-preflight.v2.schema.json)
- [`verifyfirst.x402-preflight-response.v2`](../public/schemas/verifyfirst.x402-preflight-response.v2.schema.json)
- `verifyfirst.agent-decision.v1`

The v1 x402 [Evidence](../public/schemas/verifyfirst.x402-preflight.v1.schema.json)
and [API response](../public/schemas/verifyfirst.x402-preflight-response.v1.schema.json)
schemas remain published for historical packets created with
`@ifandonlyif/x402-preflight@0.1.0`. Published schema versions are immutable;
new fields or verifier contracts require a new schema version.

The SHA-256 envelope is an unsigned self-check. It detects a changed body when
the expected digest is protected separately; it is not issuer authenticity,
non-repudiation, trusted time, or an append-only log. Downstream integrations
should reject unknown schema versions and preserve `limitations`, source
provenance, mode labels, and the original decision vocabulary.

## Open-source production checklist

- Use the repository `.nvmrc` and the `packageManager` version in
  `package.json`; install the reviewed lockfile with `npm ci`.
- Review `package-lock.json` whenever dependency versions change.
- Configure secret scanning and dependency alerts on the public repository.
- Keep fixtures synthetic or officially redistributable and pin upstream
  commits or content digests.
- Publish any local policy/schema changes with tests and migration notes.
- Keep simulation visibly labeled and fail closed when a live source is down.
- Review [Product Boundaries](PRODUCT_BOUNDARIES.md) and
  [Security Policy](../SECURITY.md) before deploying a production integration.
