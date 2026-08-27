# VerifyFirst vLEI Verifier container

This service packages the official [GLEIF-IT/vlei-verifier](https://github.com/GLEIF-IT/vlei-verifier) at commit `5850051b52dce24ed59eae486af76e7c73f6012c` for Vercel's container runtime.

## Security and trust profile

- GLEIF External root-of-trust verification is enabled.
- ECR and production ECR schemas are the only authorization schemas.
- TEL revocation checking is enabled.
- Presentation size is limited to 128 KiB.
- Response-body logging is disabled.
- The dynamic `/root_of_trust/{aid}` mutation endpoint is blocked.
- `VERIFIER_MODE=test` is intentionally used only to let the static browser Demo poll `/authorizations/{aid}` without KERI-signed HTTP headers. It does not replace ACDC/CESR cryptographic verification.

The service is intended for a low-traffic hackathon Demo. Vercel containers are stateless, while the upstream verifier keeps transient KERI/TEL authorization state locally. A production deployment needs durable external state or a single persistent container service.

## API flow

1. `GET /health`
2. `PUT /presentations/{credentialSaid}` with `Content-Type: application/json+cesr`
3. Poll `GET /authorizations/{holderAid}`

The verifier returns `202` for accepted processing, then `200`, `401`, or `404` from the authorization endpoint.
