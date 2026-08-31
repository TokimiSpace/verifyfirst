# VerifyFirst Product Boundaries

This repository contains one public consumer product and one experimental
enterprise lab. Keep their users, claims, data handling, and release standards
separate even when they share infrastructure.

## Product map

| Surface | Route | Owner in code | Status |
|---|---|---|---|
| Personal anti-scam assistant (To C) | `/` | `App.tsx`, `components/consumer/`, consumer result components, `api/analyze.ts` | Public product |
| Enterprise trust lab (To B) | `/business/` | `apps/business/`, `components/business/`, Agent and credential-response components, `api/agent-policy.ts` | Experimental |
| Trust Pathways module | `/trust-pathways/` | `public/trust-pathways/` | Experimental, mixed synthetic/live evidence |
| Update Trust module | `/update-trust/` | `public/update-trust/`, `services/vlei-verifier/` | Experimental, official fixture plus explicit simulation |

Stable legacy URLs are intentionally preserved. The enterprise landing page is
the canonical entry for all To B modules.

## To C invariants

- Traditional Chinese, English, and Vietnamese must remain first-class.
- Ask only for the incident state and content needed to help. Do not request a
  password, OTP, full card number, ID number, or secret key.
- The selected incident state changes the next steps. An already-paid case must
  prioritize the bank/payment provider and Taiwan's 165 hotline.
- Hard blocklist results and code-level safety floors outrank model prose.
- The safety conversation uses the completed analysis and incident stage. It is
  in-memory guidance, not an emergency service, financial institution, or
  police report.
- A result is an aid, never a guarantee that content is safe.

## To B invariants

- Every entry point must display `EXPERIMENTAL` or an equivalent localized
  label and state that it is not for production decisions.
- The local Agent grant demonstrates deterministic policy behavior. It is not a
  verified production Mandate.
- `POST /api/agent-policy` returns a decision and evidence with
  `execution.status: "NOT_EXECUTED"`; it never operates a tool or payment.
- Payment remains denied. IFF x402 preflight checks requirement consistency; it
  does not establish payment safety or delivery.
- vLEI, KERI, ACDC, and TEL claims must distinguish official fixtures, live
  checks, proposed schemas, and simulation.
- Raw CESR input stays in browser memory. Persist only a bounded verification
  summary and digest; do not place raw credentials in local storage or AI
  prompts.
- Production vLEI verification requires an explicit root AID, official schema
  allow-listing, required-field and edge-shape checks, signature verification,
  TEL/KEL anchoring, and proof that each credential issuer controls its TEL
  registry. Training-only bypasses must never be enabled for uploaded
  credentials.
- Every supplied credential and TEL event must be consumed by one unique,
  connected terminal chain. Unsupported KERI/TEL event families and unrelated
  invalid credentials fail closed instead of being ignored.
- Browser TEL status is a point-in-time snapshot of the supplied CESR stream.
  A revocation is authoritative only when its sequence, prior-event link, and
  exact issuer KEL seal all verify; current status still requires live backend
  retrieval.
- The represented LEI comes only from the single terminal credential. Never
  satisfy the cross-check with an upstream QVI or other issuer in the chain.
- Tool execution stays blocked unless the terminal LEI exactly matches a live
  GLEIF record whose entity and registration states are `ACTIVE` / `ISSUED`.
  A production-root browser result remains preflight evidence until a backend
  verifier checks live OOBI and witness state.
- The Enterprise Evidence Packet carries an unsigned SHA-256 self-check over
  the decision, root, checks, credential summaries, live LEI provenance and
  freshness result, and raw-input digest. It is not an authenticity proof:
  anyone replacing the packet can recompute the checksum unless the expected
  checksum is protected through an independent channel.
- A successful browser verification is evidence, not authorization. It cannot
  promote a caller-supplied sandbox grant into a production Mandate without
  server-side re-verification and organization policy.
- Fail closed when a required verification layer is unavailable.

## Shared infrastructure

The two products may share the design system, language type, deployment, and
selected evidence services. A feature is not shared merely because it is in the
same repository. Product-specific copy, state, and navigation belong to their
own entry point.

## Pull-request checklist

1. Name the product surface affected: To C, To B, or shared infrastructure.
2. State whether any data crosses the browser/server boundary.
3. Add or update tests for safety floors and failure behavior.
4. Verify `/`, `/business/`, `/trust-pathways/`, and `/update-trust/` when shared
   routing, styles, or deployment configuration changes.
5. Do not remove an experimental label or strengthen a trust claim without
   evidence and maintainer review.

## Open-source scope

The MIT license covers the source in this repository. Deployers supply and pay
for their own third-party services, comply with those providers' terms, and are
responsible for local privacy, consumer-protection, and incident-response
requirements. Never commit `.env` files, credentials, private fixtures, or user
submissions.
