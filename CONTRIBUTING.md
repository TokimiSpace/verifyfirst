# Contributing to VerifyFirst

Thank you for your interest in contributing to the public
[`TokimiSpace/verifyfirst`](https://github.com/TokimiSpace/verifyfirst)
repository. This project accepts code, documentation, tests, translations, and
design improvements through public issues and pull requests.

## Code of Conduct

By participating, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## How to Contribute

### Reporting Bugs

- Check existing issues to avoid duplicates
- Include a clear title and description
- Provide steps to reproduce
- Include screenshots if applicable

### Pull Requests

1. Fork the repository and create your branch from `main`
2. Run `npm ci` to install the reviewed lockfile exactly
3. Read [Product Boundaries](docs/PRODUCT_BOUNDARIES.md) and identify whether
   the change affects To C, To B, or shared infrastructure
4. Make your changes following the code style
5. Run `npm run typecheck`, `npm test`, and `npm run build`
6. Test the affected desktop and mobile flows locally
7. Submit a pull request describing data-flow, trust-claim, and failure-mode changes
8. Sign off every substantive commit as described in [Developer Certificate of Origin](#developer-certificate-of-origin-dco)

## Development Setup

```bash
git clone https://github.com/YOUR-ACCOUNT/verifyfirst.git
cd verifyfirst
npm ci
cp .env.example .env.local
# Add GEMINI_API_KEY only when testing live To C AI analysis
npm run dev
```

## Code Style

- Use TypeScript for all code
- Use functional React components with hooks
- Reuse the design tokens and component classes in `styles.css`; keep To C and
  To B responsive and accessible in Traditional Chinese, English, and Vietnamese
- Write clear commit messages

## Licensing of Contributions

Unless a file clearly states a different upstream license, contributions are
submitted under the repository's [MIT License](LICENSE). By opening a pull
request, you agree that the contribution may be distributed under that license.
Do not submit code, fixtures, screenshots, fonts, data, or other material unless
you created it or have permission to redistribute it.

When adapting third-party material:

- identify the upstream project and exact source revision;
- record its license and modification status in
  [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md);
- include any required license or NOTICE text; and
- never replace the upstream license with MIT.

See [LICENSING.md](LICENSING.md) for the project's complete licensing strategy
and [TRADEMARKS.md](TRADEMARKS.md) for use of project names and logos.

## Developer Certificate of Origin (DCO)

Substantive non-bot commits must include a `Signed-off-by` line confirming the
[Developer Certificate of Origin 1.1](https://developercertificate.org/). Add it
with Git's sign-off option:

```bash
git commit -s -m "Describe the change"
```

The sign-off uses your real name and an email address you are entitled to use.
It certifies the origin and redistribution rights of the contribution; it is
not a copyright assignment. Automated dependency-update commits are exempt.
Maintainers may ask contributors to repair missing sign-offs before merge.

## Project Structure

```
apps/business/       # To B experimental enterprise entry
api/                 # Serverless API endpoints
components/consumer/ # To C guided intake and safety conversation
components/          # Shared and feature UI
services/            # Analysis, policy, and evidence services
public/              # Static enterprise lab modules and assets
```

Thank you for contributing!
