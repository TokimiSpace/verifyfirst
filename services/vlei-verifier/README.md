# VerifyFirst vLEI live demo backend

This service packages the official
[GLEIF-IT/vlei-verifier](https://github.com/GLEIF-IT/vlei-verifier) at commit
`5850051b52dce24ed59eae486af76e7c73f6012c` for the two public legacy demo
pages. It is a **test-mode, non-durable live demo backend**, not a production
verifier and not a supported self-host production profile.

The public endpoint at `https://verifyfirst-vlei-verifier.vercel.app` belongs
to the VerifyFirst demo deployment. A self-hoster must not depend on it or
treat a response from it as a production authorization decision.

## Demo trust profile

- The GLEIF External root AID is selected as the demo trust-root policy.
- ECR and production ECR schemas are the only authorization schemas.
- TEL revocation checking is enabled.
- Presentation size is limited to 128 KiB.
- Response-body logging is disabled.
- The dynamic `/root_of_trust/{aid}` mutation endpoint is blocked.
- `VERIFIER_MODE=test` lets the static browser demo poll
  `/authorizations/{aid}` without KERI-signed HTTP headers. In this mode the
  witness allow-list is not enforced as a production control.
- Upstream state stores are initialized with temporary state. Authorization
  state is not durable across restarts or redeployments.
- The upstream demo server permits browser access broadly. Do not expose this
  profile as an enterprise verifier.

The cryptographic code still performs meaningful checks, and a regression
fixture should be rejected under the GLEIF root policy. Neither fact upgrades
the service to production: test-mode request handling, temporary state and the
public browser-facing endpoint remain outside a formal authorization boundary.

The configuration filename `verifyfirst-production.json` is retained only for
compatibility with the existing demo deployment. It is not a production-ready
configuration. Its schema URLs are pinned to the immutable
GLEIF-IT/vLEI-schema commit
`97850396f504bf8c4e19a42af3290e4b2618f50e` for reproducibility.

## API flow

1. `GET /health`
2. `PUT /presentations/{credentialSaid}` with `Content-Type: application/json+cesr`
3. Poll `GET /authorizations/{holderAid}`

The verifier returns `202` for accepted processing, then `200`, `401`, or `404` from the authorization endpoint.

## What production still requires

A real deployment needs a separately reviewed production-mode entrypoint,
signed request authentication, narrow CORS and network access, rate limits,
durable KERI/TEL/verifier state with backup and restart tests, an explicit root
and schema policy, live witness/OOBI/TEL retrieval, watcher-based duplicity
detection, protected audit evidence, and an upgrade/rotation process. The demo
Dockerfile intentionally does not pretend to provide these controls.

See the repository's `THIRD_PARTY_NOTICES.md` for source, license, archive
digest, schema provenance and the local port-parsing patch.
