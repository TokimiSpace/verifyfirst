# VerifyFirst Track 05–06 Demo 影片製作包

> 主題：普惠金融 × RBA 公平招募<br>
> 主角：阮文龍（合成角色）<br>
> 製作方式：真實 VerifyFirst Web 實拍為主，ComfyUI + MiniMax 補人物與轉場<br>
> Master：120 秒，16:9，1920×1080，24 或 30 fps<br>
> 文件版本：2026-08-29

## 先做這個版本

這支片不要求先重做網站。建議成片比例為：

- **55–65% 真實 Web 錄影**：直接操作目前上線的 [VerifyFirst Trust Pathways](https://jjfishjj.github.io/relayform/trust-pathways/)。
- **20–25% MiniMax 生成畫面**：阮文龍、工廠、招募鏈與鏡頭拉遠等網站無法呈現的敘事鏡頭。
- **10–15% 後製圖卡**：法規數字、三張憑證、`PROPOSED SANDBOX`、`SIMULATED MOL CHECK` 等必須精準呈現的文字。

不要讓 AI 影片模型生成網站畫面、法規文字、公司名稱、案件編號或憑證欄位。這些一律使用真實 Web、HTML 畫面或剪輯軟體疊字，避免亂碼，也讓評審看得出產品真的可以操作。

影片主句：

> **同一個人、兩條制度路徑、一條可撤銷、可追責的信任鏈。**

## 網站改動界線

### 必要改動：零

目前網站已經有足夠的真實畫面可以拍：

- Track 05 的人物／裝置／憑證綁定、`ALLOW_CREDENTIAL_ISSUANCE`、Evidence / Audit Timeline。
- Track 06 的 RBA 批次查驗、`35 筆通過，1 筆需人工複核`、遮罩揭露、撤銷與 `DENY · MANDATE_REVOKED`。
- vLEI 信任鏈、GLEIF LEI Search API、Training verifier、TEL revocation simulator。

### 若有 20 分鐘可做的選配微調

只改合成案例的文字資料，不改版型、互動或驗證邏輯：

1. Track 05 的 `Nguyễn An` 改成 `阮文龍／Nguyễn Văn Long`。
2. Track 06 的雇主名稱改成 `台鋼精密（化名）`，或反過來把影片雇主改成網站既有的 `東海電子（化名）`。
3. 在 Track 05 結果旁補一個小標籤：`監理沙盒提案／非現行開戶替代方案`。

如果不做微調，影片第一次出現 Web 畫面時加註：

> `LIVE PRODUCT DEMO · SYNTHETIC TEST ACCOUNT`<br>
> `影片角色與網站測試帳號名稱不同，流程相同`

最省事且不衝突的設定，是把 `LONG-2026-0417` 定義為網站 `RBA-2026-08／36 人` 批次中的其中一案；這樣 Track 06 的 `35 + 1` 真實畫面可直接使用。

## 拍攝前必須鎖定的事實邊界

這一段是整支影片的「不可說錯清單」。

### 1. 第三類帳戶與升級條件

現行《電子支付機構身分確認機制及交易限額管理辦法》下：

- 第三類個人電支帳戶並非絕對「不能收」，但**不能做一般收款**；同機構內直系血親或監護人的國內外小額匯兌收款有例外。
- 第三類帳戶的一般月付款額度為新臺幣 3 萬元，儲值餘額上限為新臺幣 1 萬元。
- 升為第二類帳戶時，依第 10 條要符合第 9 條第一項前三款：手機號碼、身分資料真實性，以及使用者本人金融支付工具。
- 「本人金融支付工具」目前指本人存款帳戶、信用卡，或主管機關認定的其他工具。**雇主在職憑證目前不是法定替代品。**

因此片中必須說：

> 「這不是宣稱現行法已經允許以在職憑證直接升級，而是送進監理沙盒驗證的替代核驗提案。」

不能說：

> 「VerifyFirst 已經依法讓阮文龍完成第二類開戶。」

### 2. 勞動部查驗介面

在沒有確認正式授權介面、權限與資料契約前，一律顯示：

> `SIMULATED MOL PERMIT CHECK · PROPOSED INTEGRATION`

不能在畫面或旁白中稱為「已串接的勞動部正式 API」。

### 3. vLEI 與簽章

較精準的說法是：

> 「在職憑證由雇主控制的 AID 簽章，發證權限可沿有效的 Legal Entity vLEI／ECR 授權鏈回溯。」

不要簡化成「用公司的 vLEI 私鑰簽署」。GLEIF LEI Search API 查的是法律實體參考資料與狀態；vLEI／ACDC verifier 才負責憑證、授權鏈與狀態驗證，兩者不要剪成同一支 API。

### 4. 撤銷的層級

- 阮文龍離職：撤銷**他的在職憑證**，只影響他的案件。
- 雇主或仲介出現系統性濫用：由有權的組織治理者或 QVI 暫停／撤銷適用的發證授權，所有依賴該授權的案件改標 `REVERIFY`。
- 帳戶降級、限制或凍結必須依業者政策與法律依據執行；影片用「自動轉入重驗／限制流程」最安全，不直接承諾必然凍結。

### 5. 不可否認不等於內容真實

簽章與 Evidence Packet 能證明：

- 誰簽發；
- 簽了什麼；
- 當時用哪個政策做決策；
- 後來是否撤銷或重驗。

它不能單獨證明：

- 零元收費一定如實；
- 私下現金沒有發生；
- 當事人沒有被脅迫。

影片結尾必須保留這個誠實局限，這會讓提案更可信。

### 6. PCO2566

公開資料目前無法可靠確認 `PCO2566` 的正式名稱、內容與適用關係。影片、字幕和 Web 都不要把它當成已查證法規。若必須碰到這一段，只能說：

> 「若主管機關在監理沙盒中同意此替代核驗方式……」

## 120 秒 Master 分鏡與逐鏡旁白

畫面類型：`WEB` 為真實網站錄影、`GEN` 為 MiniMax 生成、`COMP` 為網站或生成片加精準後製圖卡。

| 時間 | 類型 | 畫面與操作 | 定稿旁白 | 精準疊字／備註 |
|---|---|---|---|---|
| 00:00–00:06 | GEN | 阮文龍下班走出精密工廠，看見手機帳戶限制提示，停下腳步。 | 阮文龍月薪五萬五，卻仍卡在功能受限的第三類電支帳戶。 | `阮文龍｜越南籍移工｜月薪 NT$55,000`；不生成可讀手機文字。 |
| 00:06–00:13 | COMP | 黑底數字圖卡：一般收款受限、月付款 3 萬、餘額 1 萬；第三個檢核轉紅。 | 升級時，手機與居留證都過了，卻拿不出本人金融支付工具。 | `一般收款受限`、`月付款 NT$30,000`、`儲值餘額 NT$10,000`、`本人金融支付工具：缺少`。 |
| 00:13–00:19 | WEB | 首頁選 Track 05，停在案件背景與 Investigation Mandate。 | VerifyFirst 不假裝改寫法律；這是監理沙盒中的替代核驗提案。 | 左上固定 `LIVE WEB`；右下固定 `PROPOSED SANDBOX · NOT CURRENT LAW`。 |
| 00:19–00:26 | WEB | 切 Track 01 的 vLEI 區，點「驗證 vLEI 信任鏈」，依序帶到 GLEIF Root、QVI、Legal Entity、OOR/ECR。 | 先確認誰在授權。雇主法律實體查不到，流程立即關閉。 | 畫面旁加 `Principal → fail closed`。GLEIF 查詢成功才拍；失敗就錄 fail-closed 狀態。 |
| 00:26–00:33 | GEN + COMP | 雇主人資在工作站核發憑證；阮文龍手機收到一張無可讀字的 credential card。 | 再由雇主簽發在職憑證，綁定阮文龍本人錢包公鑰。 | 後製欄位：`到職日`、`聘僱許可字號（遮罩）`、`雇用類別`、`subject public key`、`issuer AID signature`。 |
| 00:33–00:40 | COMP | 三個檢核環同時對齊：ARC、permit、credential；其中一個短暫失敗，再恢復。 | 系統同時對齊居留、聘僱許可與簽章；任一失敗都不放行。 | `ARC CHECK`、`SIMULATED MOL PERMIT CHECK`、`CREDENTIAL SIGNATURE`、`POLICY: ALL MUST PASS`。 |
| 00:40–00:48 | WEB | 回 Track 05，點「執行可信查驗」，拍到 `ALLOW_CREDENTIAL_ISSUANCE` 與 `1:1:1 信任綁定完成`。 | 真實介面把現場觀察、交叉證據、模型推論與保留資料分開。 | 不把 `ALLOW_CREDENTIAL_ISSUANCE` 剪成「帳戶已升級」；它只表示 Demo 憑證核發政策通過。 |
| 00:48–00:56 | WEB | 緩慢下移到 Evidence / Audit Timeline，停在 `Audit event sealed`。 | 每次決策留下 Evidence Packet，誰授權、何時決定，都能回查。 | 放大 `event_hash`、`prev_hash`；可加 `EVIDENCE PACKET SEALED`。 |
| 00:56–01:03 | GEN + COMP | 阮文龍歸還識別證；個人憑證熄滅。背景另一路顯示雇主發證授權仍有效。 | 離職先撤銷個人憑證；系統性濫用才升級處理發證授權。 | `WORKER CREDENTIAL → REVOKED`；不要畫成公司 base vLEI 被任意刪除。 |
| 01:03–01:08 | GEN | 由阮文龍手機特寫快速拉遠，看到工廠、台灣仲介、越南招募商三個真實場景。 | 鏡頭拉遠，開戶只是招募鏈的最後一站。 | Track 05 → Track 06 轉場；這是全片視覺記憶點。 |
| 01:08–01:16 | WEB | 點 Track 06，停在 `RBA-2026-08／36 人` 與 `7 節點`。 | 案件 LONG-2026-0417，是這批三十六人中的其中一案。 | `LONG-2026-0417 ⊂ RBA-2026-08`；標 `LIVE WEB · SYNTHETIC DATA`。 |
| 01:16–01:24 | COMP | 三張憑證從左至右連成鏈：Việt Phát、台灣仲介、雇主。 | 海外招募商、台灣仲介與雇主，都聲明移工端收費為零。 | 每張卡都顯示 `DECLARED workerAmountTwd = 0`，特別保留 `DECLARED`。 |
| 01:24–01:32 | WEB | 拍 Track 06 Investigation Mandate 的 ALLOW／DENY，點「查看政策」或停在限定揭露。 | 規則不讀故事，只讀欄位；任一移工費用大於零，就轉人工複核。 | `POLICY GATE: workerAmountTwd > 0 → REVIEW`；人可以補證後重跑，不能直接覆寫 gate。 |
| 01:32–01:40 | WEB | 點「執行可信查驗」，拍到 `35 筆通過，1 筆需人工複核`。 | 真實介面保留三十五筆通過、一筆例外，也不揭露移工完整帳務。 | 放大 `WITHHELD｜移工身份保持遮罩`。 |
| 01:40–01:48 | WEB | 緩慢下移 Evidence / Audit Timeline，停在 `REQUIRE_EXCEPTION_REVIEW` 與 sealed event。 | 採購方不必等年度稽核，現在就能查到決策與證據時間軸。 | `CONTINUOUS AUDIT`、`CASE LINK: LONG-2026-0417`。 |
| 01:48–01:54 | WEB | 點「停止並撤銷」→「測試撤銷後呼叫」，拍到 `DENY · MANDATE_REVOKED`。 | 畫面實拍的是 Mandate 撤銷：授權一失效，後續工具就不執行。 | 務必拍到 `tool_execution=false`；不要把這一幕冒充 QVI 已撤銷正式 vLEI。 |
| 01:54–02:00 | GEN + END | 阮文龍直視鏡頭；畫面縮成 Evidence Packet，最後落到 VerifyFirst 標誌。 | 簽章不會自動抓出隱瞞，卻讓每次申報、決策與撤銷都能究責。 | `Accountable, not omniscient.`／`可驗證，不代表全知。` |

### 90 秒投稿版

若比賽只收 90 秒，刪除或縮短：

- 00:19–00:26 的 vLEI 教學只留 3 秒。
- 00:56–01:03 的離職撤銷縮成 3 秒。
- 01:16–01:24 三張憑證縮成 5 秒。
- Track 05、06 的兩段 Timeline 各縮成 4 秒。
- 旁白保留「監理沙盒提案」、「SIMULATED MOL CHECK」與最後誠實局限，這三項不可刪。

## 真實 Web 錄影 Shot List

### 錄影環境

- 使用乾淨的 Chromium／Chrome 視窗，1920×1080，瀏覽器縮放先測 80–90%，確保主卡與結果同框。
- 使用 OBS Window Capture；錄製 1080p、30 fps。滑鼠游標保留，點擊時加柔和圓環。
- 每一 take 前按「重置流程」，每個動作前後各留 2 秒，剪輯才有空間。
- 優先拍正式上線 URL；網路或外部 API 不穩時，改拍同一 commit 的本機 Web，但畫面標 `LOCAL PRODUCT BUILD`，不要假裝是 live API。
- 拍攝當下再確認頁首仍顯示「獨立合成資料 Demo · 不連接正式系統」。

### 建議錄製順序

1. `WEB-00-home-select-05.mp4`

   首頁停 2 秒 → 點 Track 05 → 停在案件背景。
2. `WEB-01-track05-mandate.mp4`

   Track 05 的目的、揭露範圍、ALLOW／DENY。
3. `WEB-02-track05-result.mp4`

   點「執行可信查驗」→ `ALLOW_CREDENTIAL_ISSUANCE` → `1:1:1 信任綁定完成`。
4. `WEB-03-track05-timeline.mp4`

   從四種證據類型平滑移到 Evidence / Audit Timeline。
5. `WEB-04-vlei-chain.mp4`

   Track 01 →「驗證 vLEI 信任鏈」→ 四個信任層。
6. `WEB-05-gleif-live.mp4`

   `GLEIF LEI Search API` 的真實查詢。先排練；外部服務失敗時保留 fail-closed 畫面也可以使用。
7. `WEB-06-tel-simulator.mp4`

   `ISSUED／ALLOW` →「模擬 TEL 撤銷」→ `REVOKED／DENY`，畫面必須保留「明確模擬」說明。
8. `WEB-07-track06-mandate.mp4`

   Track 06 的 36 人／7 節點／1 例外與 ALLOW／DENY。
9. `WEB-08-track06-result.mp4`

   點「執行可信查驗」→ `35 筆通過，1 筆需人工複核` → `WITHHELD`。
10. `WEB-09-track06-timeline.mp4`

    `REQUIRE_EXCEPTION_REVIEW` 與 Evidence / Audit Timeline。
11. `WEB-10-revoke-deny.mp4`

    「停止並撤銷」→ `REVOKED` →「測試撤銷後呼叫」→ `DENY · MANDATE_REVOKED` 與 `tool_execution=false`。

### 畫面真實性標籤

固定用以下六種，不要另造模糊標籤：

| 標籤 | 使用時機 |
|---|---|
| `LIVE WEB` | 真實上線頁面的互動畫面 |
| `LIVE · GLEIF API` | 畫面真的完成 GLEIF API 查詢時 |
| `TRAINING ONLY` | 固定測試金鑰／fixture 的密碼學訓練驗證器 |
| `SIMULATION · TEL` | 本機 TEL 狀態模擬器 |
| `PROPOSED SANDBOX` | 現行法尚未承認的替代核驗設計 |
| `SIMULATED MOL CHECK` | 尚未確認正式介面的聘僱許可查驗 |

## ComfyUI + MiniMax 製作方法

### 模型路徑

優先使用 ComfyUI 更新後可見的 MiniMax H3／Hailuo 03 Partner Nodes：

- Text-to-Video：環境與無固定人物的補景。
- First/Last Frame：Track 05 拉遠到 Track 06 的關鍵轉場。
- Reference／Context IR：固定阮文龍的臉、服裝與工廠語境。
- Regenerate／2K：只用於已選定的 final take。

如果另一台電腦更新後仍只有 `MinimaxHailuoVideoNode`，使用 Hailuo 02 的 first-frame image-to-video 做備援。節點名稱與輸入欄位會隨 ComfyUI 版本調整，因此**不要在這台電腦先手寫一份可能失效的 workflow JSON**；在製作電腦打開實際節點後再匯出。

### 三個 Workflow

#### WF-A：角色一致性

1. 載入核准的阮文龍 reference still。
2. 使用 H3 Reference 或 Context IR。
3. 輸入該 shot 的動作、場景與鏡頭提示。
4. 每鏡先出 3 個 5–6 秒版本。
5. 選定版本後才重生成高解析或 2K。
6. 匯出 workflow：`wf-a-character-reference-h3.json`。

#### WF-B：首尾幀轉場

1. First frame：阮文龍手機與臉的近景。
2. Last frame：工廠、台灣仲介、越南招募商的寬景構圖。
3. 使用 First/Last Frame node，提示詞只描述 camera pull-back 與自然空間連接。
4. 匯出 workflow：`wf-b-track05-to-06-transition.json`。

#### WF-C：無人物 B-roll

用 Text-to-Video 生成工廠夜景、稽核員看資料、越南招募辦公室等短景。任何儀表板、憑證卡、數字與標題都在後製疊上。

### 建議設定

- 比例：16:9。
- Draft：5–6 秒、768p 或當下最低可接受預覽解析度。
- Variants：每個生成鏡頭 3 版；轉場鏡頭可做 4 版。
- Final：只將 6–8 個入選鏡頭升到 1080p／2K。
- Prompt optimizer：可以在探索期開啟；角色與鏡頭鎖定後不要來回切換，以免畫面漂移。
- Seed：若目前節點提供 seed，final take 記錄並鎖定；若不提供，就以 prompt、reference、task ID 和檔名保存可追溯性。
- 不提交 API key、Comfy token、輸出影片或含帳號資訊的 workflow metadata 到 Git。

## 視覺 Bible

### 阮文龍

- 29 歲越南籍男性，偏瘦但結實，中等膚色，短黑髮。
- 深藍工作外套、灰色無字胸章、深灰工作褲；全片不換裝。
- 情緒克制：困惑、理解、恢復主體性，不拍成受害者凝視。
- 手機外觀固定；螢幕留白，後製再加正確 UI。

### 場景與色彩

- 當代台灣精密製造工廠、移工宿舍、一般企業 HR 空間。
- VerifyFirst 色彩：近黑、薄荷綠、琥珀色、拒絕紅。
- 紀錄片寫實、自然皮膚、克制的企業光線、細微顆粒。
- 禁止 cyberpunk、懸浮全息 UI、區塊鏈硬幣、霓虹城市、刻板「駭客」畫面。

### 全域 Prompt Prefix

每個 MiniMax prompt 前面加：

```text
cinematic documentary realism in contemporary Taiwan, natural skin texture,
restrained corporate lighting, charcoal with muted mint and amber accents,
35mm lens, subtle film grain, believable workplace, precise natural motion,
no readable text, no logos, no watermark, no sci-fi holograms, no crypto coins,
leave clean negative space for editorial overlays
```

## MiniMax 定稿提示詞

以下提示詞使用英文以降低歧義；人物鏡頭都要掛同一張 reference still。

### REF-01｜阮文龍角色定裝照

```text
Character reference sheet for Nguyen Van Long, a fictional 29-year-old
Vietnamese precision-factory worker living in Taiwan, lean build, medium warm
skin tone, short straight black hair, calm observant eyes, navy work jacket
with a blank gray chest patch, dark gray work trousers. Neutral gray studio
background, full body front view, three-quarter view, side profile and clean
headshot, consistent face and proportions, soft color-calibrated light.
No text, no company logo, no flag, no watermark.
```

### GEN-01｜受限帳戶開場

```text
Use the approved Nguyen Van Long reference. He exits a modern precision
factory in Taiwan at blue hour, checks his phone, then pauses with a restrained
worried expression. Coworkers move naturally in soft background focus. The
phone screen is blank and not readable. [slow dolly in] Documentary realism,
quiet dignity, negative space on the right for account-limit graphics.
```

### GEN-02｜人資簽發在職憑證

```text
A Taiwanese human-resources officer at a realistic compliance workstation
reviews an employment record and confirms issuance. Cut to Nguyen Van Long in
a modest dormitory receiving a neutral credential card on his phone. The phone
screen contains only abstract shapes with no readable text. Natural hand
motion, restrained confidence, two connected documentary moments, no logo.
```

### GEN-03｜離職撤銷個人憑證

```text
Use the approved Nguyen Van Long reference. In a quiet factory locker area he
places an employee badge into a return tray. His phone rests beside it and its
soft mint status light fades to neutral gray. The employer building remains
active in the background, making clear that only this worker credential has
ended. [static] Respectful, realistic, no readable text.
```

### GEN-04｜Track 05 拉遠到 Track 06

```text
Begin in a tight close-up on Nguyen Van Long holding his phone at the factory
gate. The camera pulls continuously backward through the factory floor, then
reveals a Taiwanese recruitment office and a Vietnamese recruitment office as
parts of one grounded cross-border employment chain. Smooth spatial reveal,
documentary realism, no floating UI, no map labels, no readable text.
```

搭配 First/Last Frame 時，首幀使用人物手機近景，尾幀先做一張三地寬景 reference；不要要求模型在同一幀生成三套正確公司招牌。

### GEN-05｜越南招募商零收費聲明

```text
A transparent worker orientation meeting in a contemporary Vietnamese
recruitment office. A counselor explains a simple fee disclosure to Nguyen Van
Long; no cash changes hands. Both parties remain attentive and professional.
Documents have blank fields with no readable text. [slow pan] Warm daylight,
observational documentary style, negative space for a declared-zero overlay.
```

### GEN-06｜持續稽核

```text
A responsible-sourcing auditor in a neutral office compares linked recruitment
case evidence across two monitors. The screens show abstract rows and status
blocks only, no readable text. One amber exception appears among calm mint
status lights. [slow push in] Realistic compliance work, no surveillance drama,
clean space for a continuous-audit overlay.
```

### GEN-07｜隱匿費用被發現

```text
A careful labor-compliance interview reveals an undeclared handwritten payment
receipt beside an otherwise orderly recruitment file. The auditor does not
accuse anyone; they preserve the evidence and mark the case for review. Faces
remain respectful and calm. No readable document text, no money close-up, no
police imagery, documentary realism.
```

### GEN-08｜結尾人物鏡頭

```text
Use the approved Nguyen Van Long reference. He stands outside the factory at
early morning, looks directly toward camera with calm agency rather than
victimhood. A subtle line of light travels from his phone toward the workplace
behind him, then stops. [static] Minimal, dignified documentary portrait,
negative space for the VerifyFirst end card, no readable text or logo.
```

## 後製圖卡資料

### Track 05 Evidence Packet

建議畫面欄位：

```text
caseId: LONG-2026-0417
subjectKey: did:key:…4f2a
employerLei: [DEMO LEI]
credentialSaid: E…
permitRef: ****-****-0417
arcCheck: PASS
permitCheck: PASS · SIMULATED
signatureCheck: PASS
policyDecision: ELIGIBLE_FOR_SANDBOX_REVIEW
sourceMode: SYNTHETIC + LIVE GLEIF REFERENCE
eventHash: sha256:…
```

`ELIGIBLE_FOR_SANDBOX_REVIEW` 比 `ACCOUNT_OPENED` 安全，因為它不宣稱替代方案已獲現行法承認。

### Track 06 三張憑證

共同欄位：

```text
caseId: LONG-2026-0417
issuerAid: E…
issuerLei: [DEMO LEI]
workerAmountTwd: 0
declaredBy: issuer
signedAt: 2026-04-17T…+08:00
status: ISSUED
```

三張卡的差異：

1. `Việt Phát Manpower Co., Ltd.`：招募費用揭露；`workerAmountTwd = 0`。
2. `美家人力（化名）`：跨境媒合服務費；`workerAmountTwd = 0`、`payer = EMPLOYER`。
3. `台鋼精密（化名）`：零額外收費確認；`recruitmentCostAbsorbed = true`。

若後續發現美家人力隱匿收費，精準狀態文字使用：

```text
ISSUER AUTHORIZATION REVOKED OR SUSPENDED
DEPENDENT CASES → REVERIFY
DECLARATION ATTRIBUTABLE · TRUTHFULNESS NOT AUTOMATICALLY PROVEN
```

## 另一台電腦的交接步驟

### 1. 取得文件與網站原始碼

```bash
git clone https://github.com/topben/cryptotruth.git
cd cryptotruth
git pull origin main
```

本文件位置：

```text
docs/demo-video/track-05-06-comfyui-minimax-production-plan.md
```

### 2. 準備 ComfyUI

1. 更新 ComfyUI 到製作當天的穩定版本。
2. 在節點搜尋 `Minimax`、`Hailuo03`、`Context IR`、`First Last Frame`。
3. 若 H3／Hailuo 03 可用，採本文件 WF-A／B；否則用 Hailuo 02 first-frame 備援。
4. 使用 ComfyUI Partner/API node 時，在該電腦登入或設定授權；若改走 MiniMax 官方 API，只在本機環境設定 `MINIMAX_API_KEY`。
5. 不把 token、API key、`.env` 或含敏感 metadata 的 workflow 上傳到 GitHub。

### 3. 建立 repo 外的影片工作目錄

大型生成檔不要放進 Git repo：

```text
VF-track05-06-video/
├── 00_reference/
│   ├── long-character-approved.png
│   └── transition-last-frame.png
├── 01_workflows/
├── 02_web-captures/
├── 03_generations/
│   ├── GEN-01/
│   └── ...
├── 04_audio/
├── 05_edit/
├── 06_exports/
└── shot-log.csv
```

檔名格式：

```text
GEN-01_v03_selected_5s_16x9.mp4
WEB-08_track06-result_take02.mp4
VO_zh-TW_master_v04.wav
VF_track05-06_master_120s_v07.mp4
```

### 4. Shot Log 最小欄位

```text
shot_id,source_type,prompt_version,reference_version,task_id,seed,
resolution,duration,selected,rights_note,source_mode,notes
```

`source_mode` 使用 `WEB_LIVE`、`WEB_LOCAL`、`GEN_MINIMAX`、`SIMULATION` 或 `OFFICIAL_API`。

## 兩日製作排程

### Day 1：鎖故事與素材

- 上午：確認旁白、法規警語、網站是否正常；錄完 11 段 Web 原始畫面。
- 中午：生成 REF-01，選定唯一角色 reference。
- 下午：生成 GEN-01～GEN-08，每鏡 3 版；只選片，不急著升解析。
- 晚上：粗剪 120 秒，確認每段旁白都有對應證據畫面。

### Day 2：精修與驗收

- 上午：只重做失敗鏡頭，將入選畫面升解析；做法規與憑證圖卡。
- 下午：錄旁白、字幕、音效與音樂；完成 120 秒 master。
- 晚上：輸出 90 秒投稿版、無字幕 clean version、SRT 字幕與封面圖。

建議生成量：8 個 AI shot × 3 個 draft = 24 次；最後只升級 6–8 個入選 take，避免把成本花在未入選素材。

## 最終驗收清單

### 故事

- [ ] 阮文龍從 Track 05 自然過渡到 Track 06。
- [ ] `LONG-2026-0417` 清楚標成網站 36 人批次中的一案。
- [ ] 雇主、海外招募商、台灣仲介三個角色可分辨。
- [ ] 結尾保留「可追責，不是全知」的限制。

### 真實 Web

- [ ] 成片至少一半時間是實際可操作 Web 畫面。
- [ ] `ALLOW_CREDENTIAL_ISSUANCE` 沒有被說成帳戶已依法升級。
- [ ] 拍到 `35 筆通過，1 筆需人工複核`。
- [ ] 拍到 `DENY · MANDATE_REVOKED` 與 `tool_execution=false`。
- [ ] GLEIF live、Training fixture、TEL simulation 標示沒有混淆。

### 法規與治理

- [ ] 說明是 `PROPOSED SANDBOX`，不是現行法已核准。
- [ ] 勞動部資料畫面標 `SIMULATED MOL CHECK`。
- [ ] 沒有宣稱雇主可自行撤銷 QVI 或 base vLEI。
- [ ] 沒有宣稱簽章能證明零元申報必然真實。
- [ ] 沒有引用未查證的 `PCO2566`。

### 畫面與資安

- [ ] AI 生成畫面沒有可讀的亂碼、假 logo 或真實證件資訊。
- [ ] 台鋼精密、美家人力與人物均標示為化名／合成案例。
- [ ] 所有介面文字由 Web 或後製生成，不由影片模型生成。
- [ ] workflow 與畫面中沒有 API key、token、帳號或本機路徑。
- [ ] 字幕逐字校對；越南姓名拼法全片一致。

## 已知未完成事項

1. `PCO2566` 的正式來源與適用關係尚未查證，暫不引用。
2. 勞動部聘僱許可的正式機器查驗介面、授權與資料契約尚未確認。
3. 在職憑證能否成為第 9 條所稱「主管機關認定之其他金融支付工具」，需由主管機關或監理沙盒驗證，不可自行宣告。
4. 若要做「仲介發證授權撤銷後，全案件連動重驗」的真實 Web 畫面，現有頁面只有 Mandate 與 TEL 模擬，必須另做小型 demo；本片暫以清楚標示的圖卡說明，不假裝已實作。
5. 正式成片前，決定網站名字沿用 `Nguyễn An／東海電子`，或做兩個純文字微調；不要在沒有說明時混用。

## 查證來源

- 金管會法規：[電子支付機構身分確認機制及交易限額管理辦法](https://law.fsc.gov.tw/LawContent.aspx?id=GL001538&media=print)（第 7、9、10、11、20 條）。
- 金管會法規：[電子支付機構管理條例](https://law.fsc.gov.tw/LawContent.aspx?id=GL001488&media=print)（第 57 條金融科技創新實驗）。
- 金管會法規：[金融機構辦理電子銀行業務安全控管作業基準](https://law.fsc.gov.tw/LawContent.aspx?id=GL001541&media=print)（本人存款帳戶／信用卡所有權確認）。
- GLEIF：[The Verifiable LEI (vLEI)](https://www.gleif.org/en/organizational-identity/lei-vlei/the-verifiable-lei-vlei)。
- GLEIF：[vLEI Ecosystem Governance Framework](https://www.gleif.org/en/organizational-identity/become-a-vlei-issuer-qvi/vlei-ecosystem-governance-framework)（EGF 4.0，2026-03-25）。
- GLEIF：[The Legal Entity Identifier](https://www.gleif.org/en/organizational-identity/lei-vlei/the-legal-entity-identifier-lei)。
- RBA：[Code of Conduct](https://www.responsiblebusiness.org/code-of-conduct/)（v8.0）。
- RBA：[Practical Guide to Due Diligence on Recruitment Fees](https://www.responsiblebusiness.org/publications/rba-practical-guide-no-fees/)。
- RBA Credentials：[Prohibition of Forced Labour credential vocabulary](https://vocab.credentials.responsiblebusiness.org/criterion/prohibition-of-forced-labour/1.0.0)。
- MiniMax：[H3 Video Generation Guide](https://platform.minimax.io/docs/guides/video-generation)。
- ComfyUI：[Official documentation](https://docs.comfy.org/) 與 [built-in nodes overview](https://docs.comfy.org/built-in-nodes/overview)。
- ComfyUI：[MiniMax Hailuo 02 node](https://docs.comfy.org/built-in-nodes/MinimaxHailuoVideoNode)（H3／Hailuo 03 不可用時的備援）。

## 一句話交接

> 先錄真實網站，再用 MiniMax 補人與空間；所有精準文字後製，所有尚未上線或尚未獲法規承認的能力都明確標示為 proposed／simulated。
