# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public issue
2. Use [GitHub private vulnerability reporting](https://github.com/topben/cryptotruth/security/advisories/new)
3. Include a detailed description of the vulnerability
4. Provide steps to reproduce if possible

We will acknowledge your report within 48 hours and work to address the issue promptly.

## Security Best Practices

When deploying VerifyFirst:

- Never commit API keys to version control
- Use environment variables for all secrets
- Keep dependencies updated
- Never rely on `robots.txt` as access control; do not deploy sensitive files
- Keep To B routes marked experimental and do not treat local sandbox grants as
  verified production authorization
- Do not include passwords, OTPs, card data, identity numbers, or secret values
  in issues, screenshots, fixtures, or test cases
- Do not send raw supporting documents, CESR retained beyond the in-memory
  verification step, wallet keys, payment signatures, or API tokens to an LLM
  workflow
- Treat x402 endpoints and requirements as untrusted structured input. The
  enterprise preflight passes a sanitized endpoint identifier to IFF and must
  never fetch the caller-supplied endpoint from `/api/x402-preflight`
- To C server-side URL observation is disabled unless
  `ENABLE_URL_OBSERVATION=true`. If enabled, isolate outbound networking and
  deny internal, link-local, and cloud metadata destinations at the network
  layer; application DNS checks alone cannot fully prevent rebinding
- Keep `GOOGLE_SHEETS_WEBHOOK_URL` unset unless the deployment discloses the
  labeling data flow. The maintained payload must remain content-free and must
  never regain raw input, narrative text, or quoted evidence

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |

Thank you for helping keep VerifyFirst secure!
