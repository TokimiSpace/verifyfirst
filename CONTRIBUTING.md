# Contributing to VerifyFirst

Thank you for your interest in contributing! This document provides guidelines for contributing.

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

## Development Setup

```bash
git clone https://github.com/your-username/cryptotruth.git
cd cryptotruth
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
