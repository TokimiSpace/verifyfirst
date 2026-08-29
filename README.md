# VerifyFirst Sandbox (verify1st.tw)

A shared safety gateway for people and AI Agents. Suspicious messages, links,
identities, and Agent actions enter one sandbox before anything consequential
happens. The interface returns one of three human-readable decisions: continue,
confirm, or stop.

The consumer verification tool remains intact. A deterministic Agent Filter
now adds identity, scoped authorization, high-risk action interception, human
confirmation, revocation, and a Trust Timeline for enterprise workflows.

Live at **[verify1st.tw](https://verify1st.tw)**.

## Features

- **Multi-input analysis** — scam SMS text, suspicious URLs (including bare
  domains), phone numbers, screenshots (client-side OCR), and `.txt` files
- **Objective pre-checks before AI** — RDAP domain age, Google Safe Browsing,
  ScamSniffer crypto-phishing blocklist, VirusTotal, DNS resolution
- **Agent sandbox** — server-side page observation: follows redirect chains
  (HTTP + meta-refresh/JS), detects login/OTP/payment/APK-download asks
- **Agent Filter** — deterministic authorization policy runs before model or
  tool execution; read-only checks can pass, personal-data submission requires
  confirmation, and login/payment/OTP/download actions are denied
- **Revocable authorization** — a visible control surface shows which Agent is
  acting for whom, its purpose, expiry, allowed scope, and forbidden scope
- **Trust Timeline** — records grants, policy decisions, user confirmation,
  denial, and revocation with evidence identifiers
- **Migrant-worker demo** — Traditional Chinese, English, and Vietnamese flow
  for verifying recruiters without exposing residency data
- **IFF x402 preflight** — uses the official
  [`@ifandonlyif/x402-preflight`](https://ifandonlyif.io/sdk) SDK whenever the
  sandbox observes an x402 `402 Payment Required`; it compares the received
  requirement with independent evidence before any payment policy could run
- **Hard blocklist floors** — confirmed Safe Browsing/ScamSniffer/VirusTotal
  hits clamp the verdict in code; the LLM cannot be talked out of them
- **Cofacts integration** — crowd-sourced Taiwanese fact-check reports
- **Google Search grounding** — Gemini researches reputation in real time
- **Graceful degradation** — L0–L5 severity levels when upstream services fail
- **165 reporting** — pre-filled report modal for Taiwan's anti-fraud hotline
- **Multi-language** — Traditional Chinese, English, Vietnamese
- **Senior Mode** — larger text, simplified results

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Vite
- **AI**: Google Gemini 2.5 Flash with Google Search grounding
- **Backend**: Vercel Serverless Functions
- **Caching**: bounded in-memory L1 + hot-entry Vercel Blob L2 (72h)
- **OCR**: tesseract.js (lazy-loaded, in-browser)

## How an Analysis Works

1. Input is classified (URL / SMS text / phone) and sanitized
2. Known example chips and allowlisted domains short-circuit with canned
   responses (zero upstream quota)
3. Objective facts are gathered in parallel: RDAP, Safe Browsing, ScamSniffer,
   VirusTotal, DNS, Cofacts, plus live page observation for URLs. An x402
   `402` response is preflighted through IFF before it is surfaced.
4. Gemini analyzes with search grounding, receiving the facts as ground truth
5. Code-level post-processing: blocklist verdict floors, low-evidence
   normalization, and PII masking
6. The result enters a bounded memory cache immediately; only entries requested
   twice are promoted to the shared 72-hour Blob cache, avoiding writes for
   one-off messages

## How the Agent Filter Works

1. Resolve the Agent identity and the user it represents
2. Reject a mismatched, expired, or revoked grant before any tool runs
3. Compare the requested action with the grant's allow / confirm / deny lists
4. Keep URL observation and public-data checks read-only inside the sandbox
5. Require a human before any personal data can be submitted
6. Log the decision and evidence identifier in the Trust Timeline

The policy gate is deterministic by design: model output can explain a risk,
but it cannot expand permissions or override a denial. The browser demo includes
a reset control so judges can replay the full grant → confirm → revoke → denied
sequence without external accounts.

### IFF x402 preflight boundary

The URL sandbox calls `@ifandonlyif/x402-preflight` only after receiving a
valid x402 v2 payment requirement. VerifyFirst preserves IFF's four verdicts —
`consistent`, `diverged`, `stale`, and `unobserved` — without turning them into
a hidden trust score. A matching requirement is evidence of consistency, not a
guarantee that payment is safe or that the endpoint will deliver afterward.
The integration never holds a wallet key or executes a payment. Public checks
need no API key; `IFF_BASE_URL` exists only for staging or local IFF instances.

## Trust Pathways and Update Trust (hackathon demo pages)

Two standalone static pages under `public/` back the Trustworthy AI Hackathon
2026 submission (no React, no build step, synthetic data only):

- **`/trust-pathways/`** — five pain-point pathways (manufacturing, payment,
  government, migrant trust, RBA), a replayable 90-second judge tour, the GLEIF
  vLEI trust-chain explainer, live GLEIF LEI lookup, GoPlus address risk, and a
  call into the deployed keripy vLEI verifier (`services/vlei-verifier`).
- **`/update-trust/`** — the vLEI *lifecycle* page. It loads the pinned
  GLEIF-IT/vlei-verifier regression fixture (GLEIF → QVI → Legal Entity → ECR),
  recomputes every Blake3 SAID, verifies Ed25519 KEL signatures with WebCrypto,
  walks ACDC edges with the I2I rule, pins schema SAIDs to GLEIF-IT/vLEI-schema,
  then issues a *proposed* short-lived Agent Delegation ACDC chained to the real
  ECR credential, lets the supplier issue a carbon-footprint credential with
  ACDC most-compact SAIDs so a presentation can disclose only the carbon block
  (process／audit stay withheld as SAIDs yet every SAID still recomputes), and
  shows how revocation, expiry, tampering and a production root-of-trust policy
  each flip the decision to a machine-readable `DENY_*`.
  All verifier logic lives in `public/update-trust/said.js` and is unit-tested
  against the official BLAKE3 vectors and the fixture (`tests/update-trust.test.ts`).
  Witness receipts, live key state and duplicity detection are explicitly left
  to the backend verifier.

## Getting Started

### Prerequisites

- Node.js 20+
- Google Gemini API key ([get one here](https://aistudio.google.com/app/apikey))

### Installation

1. Clone and install:
   ```bash
   git clone https://github.com/topben/verify1st.git
   cd verify1st
   npm install
   ```

2. Configure environment:
   ```bash
   cp .env.example .env.local
   ```
   Then edit `.env.local` and add your Gemini API key.

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000).

### Tests

```bash
npm test
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Your Google Gemini API key |
| `GEMINI_MODEL` | No | Analysis model override (default `gemini-2.5-flash`) |
| `GEMINI_THINKING_BUDGET` | No | Unset = model default; `0` disables thinking (cheaper/faster) |
| `BLOB_READ_WRITE_TOKEN` | For production | Vercel Blob storage token (auto-configured on Vercel) |
| `BLOB_CACHE_ENABLED` | No | `true` by default; set `false` to disable Blob persistence (bounded memory cache remains active) |
| `BLOB_CACHE_MIN_HITS` | No | Blob admission threshold (default `2`); `1` restores write-on-first-miss, `0` disables Blob cache writes |
| `MEMORY_CACHE_MAX_ENTRIES` | No | Maximum warm-instance analysis entries (default `200`, capped at `2000`) |
| `RATE_LIMIT_BACKEND` | No | `memory` (default) or `blob` for shared limits; `blob` consumes `list`/`put` advanced operations |
| `ML_DATA_BLOB_ENABLED` | No | `false` by default; `true` writes full ML records to Blob |
| `ML_DATA_SAMPLE_RATE` | No | `0`–`1` sampling rate for ML Blob records when enabled (default `0.1`) |
| `BLOB_PUBLIC_BASE_URL` | No | Optional public Blob base URL override for cache reads |
| `GOOGLE_SAFE_BROWSING_KEY` | No | Enables Google Safe Browsing pre-check |
| `VIRUSTOTAL_API_KEY` | No | Enables VirusTotal pre-check |
| `GOOGLE_SHEETS_WEBHOOK_URL` | No | Logs flat analysis summaries for human labeling |
| `BOT_API_KEY` | No | `X-Bot-Key` header value that bypasses per-IP rate limiting |
| `COFACTS_APP_ID` | No | App id sent to the Cofacts API (default `VERIFYFIRST_AI`) |
| `IFF_BASE_URL` | No | IFF API override for staging/local testing; production defaults to `https://ifandonlyif.io` and needs no API key |

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import the repository in [Vercel](https://vercel.com)
3. Add your `GEMINI_API_KEY` as an environment variable
4. Deploy

`vercel.json` raises `api/analyze.ts` to a 60s max duration — page observation
plus grounded generation can exceed the default.

### Manual Build

```bash
npm run build
npm run preview
```

## Project Structure

```
verify1st/
├── api/
│   ├── analyze.ts            # Serverless endpoint: pre-checks → Gemini → post-processing
│   ├── example-responses.ts  # Canned responses for demo chips (zero quota)
│   └── safe-domains.ts       # Self/known-safe allowlist short-circuit
├── components/               # React UI (results panels, search, senior mode)
├── services/
│   ├── agentPolicy.ts        # Deterministic Agent authorization gate
│   └── geminiService.ts      # Frontend client for /api/analyze
├── tests/                    # Vitest unit + handler integration tests
├── public/
│   ├── trust-pathways/       # Hackathon demo: five pathways + judge tour + vLEI lab
│   └── update-trust/         # vLEI lifecycle page: said.js verifier + pinned fixture
├── App.tsx
├── index.tsx
├── types.ts
└── vite.config.ts
```

## API Rate Limits

- **10 requests per hour** per IP address (cache hits don't count)
- Results enter a warm-instance cache immediately; repeated entries are promoted
  to the shared Blob cache for **72 hours**

## Disclaimer

This tool provides AI-generated analysis based on publicly available
information. It is a first-step aid, not a guarantee — when in doubt, call
Taiwan's 165 anti-fraud hotline. Accuracy depends on the AI model and
available web data.

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## Security

For security vulnerabilities, please see our [Security Policy](SECURITY.md).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Powered by [Google Gemini](https://ai.google.dev/) with Google Search grounding
- Community fact-checks from [Cofacts 真的假的](https://cofacts.tw)
- Blocklists from [ScamSniffer](https://scamsniffer.io) and [VirusTotal](https://virustotal.com)
- Built with [React](https://react.dev/) and [Vite](https://vitejs.dev/), deployed on [Vercel](https://vercel.com/)
