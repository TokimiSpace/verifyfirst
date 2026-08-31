# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public issue
2. Email the maintainers or use GitHub's private vulnerability reporting feature
3. Include a detailed description of the vulnerability
4. Provide steps to reproduce if possible

We will acknowledge your report within 48 hours and work to address the issue promptly.

## Security Best Practices

When deploying VerifyFirst:

- Never commit API keys to version control
- Use environment variables for all secrets
- Keep dependencies updated
- Review the `robots.txt` to ensure sensitive paths are blocked
- Keep To B routes marked experimental and do not treat local sandbox grants as
  verified production authorization
- Do not include passwords, OTPs, card data, identity numbers, or secret values
  in issues, screenshots, fixtures, or test cases

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |

Thank you for helping keep CryptoTruth secure!
