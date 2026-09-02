# VerifyFirst licensing strategy / 授權策略

本文件說明 repository 內不同材料的授權、外部貢獻如何進入專案，以及
MIT 授權與 VerifyFirst 品牌之間的界線。若個別檔案明確標示不同授權，
以該檔案及其上游授權為準。

This document explains how repository content is licensed, how contributions
enter the project, and where the MIT copyright license ends and the VerifyFirst
brand policy begins. An explicit per-file upstream license takes precedence.

## 1. 專案原創內容 / Project-authored content

VerifyFirst 原始程式碼、文件與專案自製素材採 [MIT License](LICENSE)。使用者
可以使用、修改、自架、商用與再散布，但必須在所有副本或重要部分保留
MIT 的著作權與授權聲明。MIT 不提供保固，也不代表 VerifyFirst 對衍生服務
提供 SLA、認證、法遵結論或背書。

Original VerifyFirst code, documentation, and project-created assets are
licensed under [MIT](LICENSE). They may be used, modified, self-hosted,
commercialized, and redistributed as long as the MIT copyright and permission
notice is retained in copies or substantial portions. MIT provides no warranty,
SLA, certification, compliance conclusion, or endorsement.

## 2. 第三方材料 / Third-party material

第三方套件、fixture、schema、範例資料、字型、圖示或容器內容不會因為被放進
本 repository 就改成 MIT。其來源、固定版本、修改狀態與授權記錄在
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)；需要隨附的授權全文放在
[`LICENSES/`](LICENSES/)。`package-lock.json` 中的依賴各自保留 npm package
提供的授權。

Third-party packages, fixtures, schemas, samples, fonts, icons, and container
inputs retain their upstream licenses. Provenance, pinned revisions, and local
modifications are recorded in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md),
with required license texts under [`LICENSES/`](LICENSES/). Dependencies in
`package-lock.json` retain the licenses distributed by their packages.

## 3. 品牌與商標 / Brand and trademarks

MIT 是著作權授權，不是官方身分或商標授權。VerifyFirst、TokimiSpace、相關
網域與識別標誌的使用方式見 [TRADEMARKS.md](TRADEMARKS.md)。Fork 可以誠實
說明來源，但不得讓使用者誤以為它是官方服務、通過官方稽核或獲得背書。

MIT is a copyright license, not permission to claim official identity or
endorsement. Use of VerifyFirst and TokimiSpace names, domains, and visual marks
is governed by [TRADEMARKS.md](TRADEMARKS.md). Forks may state their origin but
must not imply that they are an official or endorsed service.

## 4. 外部貢獻 / Contributions

除非檔案已清楚標示其他上游授權，提交到本 repository 的貢獻以 MIT 進入、
也以 MIT 對外發布（inbound = outbound）。專案目前不要求簽 CLA；實質性的
非機器人 commit 必須依 [DCO 1.1](https://developercertificate.org/) 加上
`Signed-off-by`。這是來源與再散布權利聲明，不是著作權讓渡。細節見
[CONTRIBUTING.md](CONTRIBUTING.md)。

Unless a file carries a different upstream license, contributions are accepted
and distributed under MIT (inbound = outbound). No CLA is currently required.
Substantive non-bot commits require a DCO 1.1 `Signed-off-by`; this certifies
origin and redistribution rights without assigning copyright. See
[CONTRIBUTING.md](CONTRIBUTING.md).

## 5. 變更授權 / Changing the license

新增第三方材料前必須確認可再散布、補齊 provenance 與必要 notice。專案不得
在未取得權利人同意時，將第三方或既有貢獻者的內容改授權。任何 repository
層級的未來授權變更都需要 maintainer 明確審查、盤點著作權來源，並以新的
pull request 與 release note 公開記錄；既有版本已經取得的 MIT 權利不會被
追溯撤回。

New third-party material requires redistribution review, provenance, and all
required notices. Third-party or contributor-owned content cannot be relicensed
without the necessary permission. Any repository-wide license change requires
explicit maintainer review, a rights-holder audit, a public pull request, and
release notes. MIT rights already granted for earlier versions are not
retroactively withdrawn.

## 6. 實務判斷 / Practical examples

| 情境 / Scenario | 結論 / Result |
|---|---|
| 企業 fork 後自架或整合內部系統 | 可以，保留 MIT notice，並自行承擔部署、資料處理與法遵責任。 |
| 提供付費託管或顧問服務 | 可以；MIT 不要求公開私有部署設定，但修改後再散布的程式仍須附 MIT notice。 |
| 使用 GLEIF-IT fixture 或 Apache-2.0 內容 | 保留 Apache-2.0 條款、provenance 與修改聲明，不可改標為 MIT。 |
| 以原 Logo 發布第三方服務 | 需要遵守 TRADEMARKS.md；一般 fork 應改名與更換識別標誌。 |
| 把 API key、真實證件或客戶資料提交到 issue | 不可以；依 SECURITY.md 使用私密回報管道且移除秘密值。 |

This strategy is a repository policy, not legal advice. Organizations should
have counsel review licensing, privacy, financial, identity, and regulatory
obligations for their own deployment.
