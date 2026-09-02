# VerifyFirst open-source governance / 開源治理

## Repository model / Repository 模型

- **Public source of truth:** [`TokimiSpace/verifyfirst`](https://github.com/TokimiSpace/verifyfirst)
- **Private deployment/history mirror:** `topben/cryptotruth`
- **Production service:** [verify1st.tw](https://verify1st.tw/)

公開 repository 是 issue、pull request、release、tag、安全公告與社群協作的唯一
主來源。private mirror 只保留既有部署整合與歷史，不是隱藏的 proprietary
edition，也不能成為只存在於私有端的產品程式碼來源。

The public repository is the canonical source for issues, pull requests,
releases, tags, security advisories, and community work. The private mirror
exists only for established deployment integration and history. It is not a
proprietary edition and must not become the sole source of product code.

## Maintenance roles / 維護角色

- **Maintainers** triage issues, review trust-boundary changes, merge pull
  requests, manage releases, and handle security advisories.
- **Contributors** submit issues and signed-off pull requests under
  [CONTRIBUTING.md](../CONTRIBUTING.md).
- **CODEOWNERS** identifies the default review team; it does not transfer
  copyright or override repository permissions.

Maintainers make routine decisions through public pull requests. Changes to
licensing, security boundaries, Evidence schemas, data retention, external data
flows, production trust claims, or the To C/To B product split require explicit
maintainer review and written rationale.

## Branches, versions, and releases / 分支、版本與發布

1. `main` is the releasable branch.
2. Feature and fix work enters through focused pull requests whenever practical.
3. CI must pass typecheck, tests, and production build before release.
4. Published Evidence schemas are immutable. Breaking schema changes use a new
   version while historical validators remain available.
5. Releases use semantic versioning where practical and describe security,
   privacy, data-flow, migration, and trust-claim changes.
6. Security fixes may be prepared privately, but the fixed source and advisory
   are published after coordinated disclosure.

## Public-to-private mirroring / 公開至私有鏡像

Normal development starts from the public repository. A release-ready commit may
then be pushed to the private mirror so its established deployment integration
can deploy the identical Git object. Private-only product commits must be moved
back into a public pull request before release.

Recommended remotes for an authorized maintainer checkout:

```text
origin    git@github.com:TokimiSpace/verifyfirst.git
internal  git@github.com:topben/cryptotruth.git
```

Before deployment, compare the commit IDs on both remotes. Environment variables,
customer data, submitted documents, incident evidence, private credentials, API
keys, and deployment tokens stay outside Git in the hosting provider's secret
store. The mirror must not be used as a substitute for secret management.

## Licensing and provenance / 授權與來源

- Project-authored content follows [LICENSING.md](../LICENSING.md) and MIT.
- Third-party material follows [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).
- Names and logos follow [TRADEMARKS.md](../TRADEMARKS.md).
- Vulnerabilities follow [SECURITY.md](../SECURITY.md), not public issues.

Governance changes should be proposed in the public repository so users can
inspect when and why the policy changed.
