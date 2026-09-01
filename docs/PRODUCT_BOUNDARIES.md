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
| Update Trust module | `/update-trust/` | `public/update-trust/`, `services/vlei-verifier/` | Experimental, pinned upstream test fixture plus explicit simulation |

Stable legacy URLs are intentionally preserved. The enterprise landing page is
the canonical entry for all To B modules.

The enterprise lab has two primary verification tracks. They can feed a shared
policy gate and Evidence workflow, but they must not be merged into one trust
score or described as proving the same thing:

| Track | Verifies | Does not verify |
|---|---|---|
| **vLEI legal entity and authority** | The submitted legal-entity record, credential chain, represented terminal LEI, cryptographic relationships, and status visible in the supplied material | General trustworthiness, legal compliance, production-fresh revocation state by itself, or permission for an Agent action |
| **x402 payment requirement** | Whether an x402 v2 requirement is supported by IFF evidence and matches the enterprise's stated network, asset, payee, and maximum amount | Merchant safety, delivery, wallet ownership in every case, payment authorization, settlement, or transaction success |

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

### Shared enterprise boundaries

- Guided adoption and technical integration use the same deterministic
  verification core. The guided path may simplify input and provide examples;
  it must not weaken a trust check or relabel simulation as live evidence.
- An API, LLM workflow, or chatbot may consume bounded, secret-free Evidence
  output. The model is not the verifier and must never receive raw supporting
  documents, private keys, tokens, CESR retained beyond the in-memory check, or
  authority to convert a preflight into execution.

- Every entry point must display `EXPERIMENTAL` or an equivalent localized
  label and state that it is not for production decisions.
- The local Agent grant demonstrates deterministic policy behavior. It is not a
  verified production Mandate.
- `POST /api/agent-policy` returns a decision and evidence with
  `execution.status: "NOT_EXECUTED"`; it never operates a tool or payment.
- vLEI authority evidence and x402 payment evidence remain separate inputs to
  policy. Passing one track can never compensate for a failure or missing check
  in the other.
- Evidence envelopes use an unsigned SHA-256 self-check unless an independent
  signing channel is explicitly added. A digest is not source authenticity,
  non-repudiation, an append-only timestamp, or a production audit log.
- Never request or persist passwords, API tokens, wallet private keys, seed
  phrases, OTPs, or unrelated personal records in an enterprise workspace.
- Fail closed when a required verification layer is unavailable. Simulation
  output must be visibly labeled and cannot silently replace live evidence.

### vLEI legal-entity and representative-authority track

**Submitted material**

- A 20-character LEI is sent to the official GLEIF API for a bounded,
  fail-closed Golden Copy lookup.
- The operator pastes or chooses a CESR stream up to 128 KiB and explicitly
  selects the production or regression-fixture trust root.
- A separate implementation intake may hash up to 12 bounded local files and
  export display labels, categories, MIME types, sizes, and SHA-256 digests for
  QVI / engineering handoff. It does not upload content or validate document
  truth, authority, or QVI acceptance.
- Raw CESR input stays in browser memory. Persist only a bounded verification
  summary and digest; do not place raw credentials in local storage or AI
  prompts.

**Output and mode labels**

- The output separates GLEIF provenance, terminal-credential LEI resolution,
  cryptographic checks, the machine-readable decision, limitations, and an
  unsigned Enterprise Evidence Packet.
- The live-data browser path queries GLEIF and evaluates the supplied stream
  against the production root, but it remains a production preflight.
- The self-test path uses a commit-pinned upstream regression fixture and test
  root from `GLEIF-IT/vlei-verifier`.
  It must say `FIXTURE`, `TEST`, or `SIMULATION`; it is not a credential held by
  the named company and it is not production authorization.
- vLEI, KERI, ACDC, and TEL claims must distinguish upstream test fixtures,
  live checks, proposed schemas, and simulation.

**Production gap and safety boundary**

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
- VerifyFirst is not a QVI. It does not apply for, issue, sign, renew, or revoke
  a vLEI. Any issuance or revocation shown in a demo is a sandbox event that
  does not affect a real KEL, TEL, credential, or legal entity.

### x402 payment-requirement consistency track

**Submitted material**

- The operator supplies an endpoint identifier and pastes or chooses an x402
  v2 `Payment-Required` JSON object. The workspace also accepts the enterprise
  policy fields `network`, `asset`, `payee`, and `maxAmount`.
- In **Live** mode, URL credentials, query parameters, and fragments are
  removed before the sanitized endpoint identifier and payment requirement go
  through the VerifyFirst API to IFF. This workflow does not fetch the merchant
  endpoint.
- In **Simulation** mode, the workspace produces an explicitly labeled
  synthetic IFF verdict and does not contact IFF. Simulation is for UI,
  integration, and policy testing only.

**Output and decision separation**

- Preserve IFF's `consistent`, `diverged`, `stale`, and `unobserved` evidence
  without converting it into a hidden safety score.
- Display the IFF result independently from the local enterprise-policy
  comparison. The latter checks the requirement's network, asset, payee, and
  amount against the submitted policy.
- Export may contain the sanitized source, input digest, IFF evidence, local
  comparison, limitations, decision, and an unsigned SHA-256 self-check. It
  must always record `execution.status: "NOT_EXECUTED"`.

**Production gap and safety boundary**

- Payment remains denied in the Agent policy gate. VerifyFirst does not hold a
  wallet key, sign a transaction, move funds, facilitate settlement, or invoke
  a payment execution adapter.
- An x402 `consistent` result is evidence that the requirement agrees with the
  available observation. It does not establish merchant safety, authorize
  payment, guarantee settlement, or promise delivery.
- `diverged`, `stale`, `unobserved`, malformed, and unavailable evidence must
  not become an implicit pass. The interface must retain the specific state and
  actionable reason.
- Production adoption still requires enterprise authorization, budget and
  payee governance, wallet / signer isolation, network-specific settlement,
  monitoring, retention policy, and an execution layer outside VerifyFirst.

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
