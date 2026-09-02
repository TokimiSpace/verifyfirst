## What changed

Describe the user problem and the smallest change that solves it.

## Product and trust boundary

- [ ] To C consumer product
- [ ] To B experimental enterprise lab
- [ ] Shared infrastructure, documentation, or tooling

Describe any browser → server → external-provider data flow, trust claim,
retention change, schema change, or new failure mode. Write “none” if there is
no change.

## Verification

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] Affected desktop and mobile flows were checked
- [ ] New third-party material has provenance and license notices
- [ ] Substantive non-bot commits include a DCO `Signed-off-by`

## Safety declaration

- [ ] No API keys, credentials, personal data, private documents, or production
      Evidence values are included
- [ ] LIVE, simulation, fixture, unsigned evidence, and `NOT_EXECUTED` states
      remain distinguishable
