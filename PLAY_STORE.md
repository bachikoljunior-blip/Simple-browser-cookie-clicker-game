# Google Play ストア公開手順（クッキーストラテジャー）

このサイトは PWA として完成しており、`play.html` には既に
Google Play 版の判定（`android-app://` referrer）と Digital Goods API による
`unlimited_start` 課金が実装済みです。したがって **TWA（Trusted Web Activity）** として
パッケージ化するのが最短ルートです。Web を更新すればアプリ側も自動で更新されます。

以下は「Play Console のアカウント登録が済んでいる」状態からの手順です。

> ### 📱 PC を持っていない場合
> **[PLAY_STORE_SMARTPHONE.md](PLAY_STORE_SMARTPHONE.md) を見てください。**
> GitHub Actions がビルドを代行するので、スマホのブラウザだけで公開まで進められます。
> このページの §1〜§3（ビルドと署名）は読み飛ばして構いません。
> §4以降（Play Console の入力）と §5・§7・§8 は共通です。

---

## 準備済みのもの / これから必要なもの

このリポジトリ側で用意できるものは生成・実装済みです。

| ファイル | 中身 |
|---|---|
| `store/listing.md` | アプリ名・簡単な説明・詳しい説明（文字数チェック済み・コピペ用） |
| `store/play-console-answers.md` | データセーフティ / レーティング / 対象年齢など**全申告フォームの回答** |
| `store/app_icon_512.png` | アプリアイコン 512×512 |
| `store/feature_graphic_1024x500.png` | フィーチャーグラフィック 1024×500 |
| `store/screenshots/01〜07*.png` | スマートフォン用スクリーンショット 1080×1920（実機相当・実画面） |
| `store/android/twa-manifest.json` | Bubblewrap 設定ファイル（署名鍵の項目だけ要記入） |
| `store/android/generate-project.cjs` | Android プロジェクトを非対話で生成するスクリプト（CI 用） |
| `.github/workflows/android-*.yml` | **スマホだけで署名鍵作成・AAB ビルド・assetlinks 更新ができる CI** |
| `.well-known/assetlinks.json` | Digital Asset Links（指紋だけ要記入） |
| `.nojekyll` | GitHub Pages で `.well-known/` を配信させるための必須ファイル |
| `privacy.html` §3 | アカウント削除の手順と削除リクエスト窓口（Play の必須要件） |
| `play.html` | アプリ内のアカウント削除ボタン、TWA でのログイン失敗時のリダイレクト切替 |

**あなたにしかできないこと**は次の6つだけです。すべてローカル環境か Play Console 上の操作で、
このリポジトリからは代行できません。

1. **署名鍵のパスフレーズを決めて Secret に登録**（PC 版なら鍵ファイルの管理）— 失うとアプリを更新できなくなります
2. **ビルドの実行** — PC なら `bubblewrap build`、スマホなら Actions の「2. Androidアプリをビルド」
3. **Play アプリ署名鍵の指紋を assetlinks.json に反映**（PC なら §3、スマホなら Actions の「3.」）
4. **Play Console での入力・アップロード**（`store/` の素材とテキストを貼るだけ）
5. **販売者アカウント（Payments profile）の設定**と `unlimited_start` の登録（§5）
6. **実機での動作確認**と**クローズドテストのテスター12人集め**（§6・§7）

---

## 0. 全体の流れ

| # | やること | 場所 | 所要 |
|---|---|---|---|
| 1 | ビルド環境の用意（Node / JDK） | PC | 30分 |
| 2 | Bubblewrap で TWA プロジェクト生成・AAB ビルド | PC | 1時間 |
| 3 | Digital Asset Links を本サイトに設置 | このリポジトリ | 15分 |
| 4 | Play Console でアプリ作成・掲載情報・各種申告 | Play Console | 2〜4時間 |
| 5 | アプリ内アイテム `unlimited_start` を登録 | Play Console | 30分 |
| 6 | 内部テストで実機確認（課金・ログイン・URLバー） | 実機 | 1時間 |
| 7 | クローズドテスト 12人 × 14日 → 製品版アクセス申請 | Play Console | **最短14日 + 審査** |
| 8 | 製品版公開 | Play Console | 審査数日 |

**個人（Personal）アカウントの場合、7 が必須で最低2週間かかります。** 詳細は §7。

---

## 1. ビルド環境（PC 側）

```bash
# Node.js 18 以上 と JDK 17 が必要（Android SDK は Bubblewrap が自動で落としてくる）
npm install -g @bubblewrap/cli
bubblewrap doctor        # 足りないものを教えてくれる
```

Windows / macOS / Linux どれでも可。初回は Android SDK のダウンロードで数 GB 使います。

> GUI で済ませたい場合は [PWABuilder](https://www.pwabuilder.com/) に
> `https://cookiestrateger.com/` を入れて「Android」でパッケージを作る方法もあります。
> 中身は同じ TWA ですが、`twa-manifest.json` を細かく調整したいので
> 以下は Bubblewrap 前提で書いています。

---

## 2. TWA プロジェクトの生成とビルド

```bash
mkdir cookiestrateger-android && cd cookiestrateger-android
bubblewrap init --manifest https://cookiestrateger.com/manifest.json
```

対話で聞かれる項目と、このアプリでの回答：

| 質問 | 回答 |
|---|---|
| Domain | `cookiestrateger.com` |
| URL path | `/play.html` （ゲーム本体を直接起動する） |
| Application name | `クッキーストラテジャー` |
| Short name | `クキスト` |
| Application ID (package) | `com.cookiestrateger.game` ← **公開後は永久に変更不可**。慎重に |
| Display mode | `standalone` |
| Orientation | `portrait` |
| Status bar / Nav bar color | `#1d130d` |
| Splash screen color | `#1d130d` |
| Icon URL | `https://cookiestrateger.com/icons/icon-512.png` |
| Maskable icon URL | `https://cookiestrateger.com/icons/icon-maskable-512.png` |
| Include support for Play Billing? | **Yes**（`unlimited_start` の課金に必須） |
| Signing key | 新規作成。**キーストアとパスワードは絶対に失くさない**（失うとアプリ更新不可） |

生成された `twa-manifest.json` は、**このリポジトリの `store/android/twa-manifest.json` と
見比べて差分を埋めてください**（値はすべてこのアプリ用に設定済みです）。特に重要なのは以下です。

| キー | 値 | 理由 |
|---|---|---|
| `startUrl` | `/play.html` | ゲーム本体を直接起動する |
| `orientation` | `portrait` | 縦持ち固定 |
| `features.playBilling.enabled` | `true` | `unlimited_start` の Play 課金に必須 |
| `alphaDependencies.enabled` | `true` | Play Billing 用の依存を有効化するために必要 |
| `enableNotifications` | **`true`** | Play Billing 有効時は必須。`false` だとビルドがエラーで止まります |
| `appVersion` | `"1.0.0"` | バージョン名のキーは `appVersion`。**`appVersionName` と書いても無視されます** |
| `fallbackType` | `customtabs` | TWA 非対応端末で Custom Tabs にフォールバック |
| `signingKey.path` / `alias` | **手元のキーストアに合わせる** | ここだけはこちらで埋められません |

`bubblewrap init` が生成する項目名はバージョンで変わることがあるので、
**生成されたファイルを土台にして値を移す**方向で作業してください
（こちらのファイルで丸ごと上書きしないほうが安全です）。

編集したら反映してビルド：

```bash
bubblewrap update
bubblewrap build
```

出力：
- `app-release-bundle.aab` … Play Console にアップロードするファイル
- `app-release-signed.apk` … 実機に直接入れて動作確認する用（**課金は動きません**、§8-3 参照）

### targetSdk の要件

**2026年8月31日以降、新規アプリ・アップデートは Android 16（API level 36）以上を
ターゲットにしないと提出できません**（11月1日までの延長申請は可能）。
`bubblewrap` を最新にした上で、生成された `app/build.gradle` の
`targetSdkVersion` が `36` になっているか確認してください。低い場合は手で上げます。

---

## 3. Digital Asset Links の設置（← 一番ハマるところ）

これを正しく置かないと、アプリ内に **Chrome の URL バーが出っぱなし**になり、
「ただのブラウザじゃないか」と審査で弾かれることもあります。

### 3-1. 登録すべき指紋は「2つ」

1. **アップロード鍵**の SHA-256（`bubblewrap init` で作った鍵）
2. **Play アプリ署名鍵**の SHA-256
   （Play Console → テストとリリース → 設定 → アプリの署名 → 「アプリ署名鍵の証明書」）

Play は AAB を受け取ると自分の鍵で再署名するため、**本番で効くのは 2 番**です。
1 番だけだと内部テストでも URL バーが出ます。両方入れてください。

```bash
# ローカルのアップロード鍵は自動で入る
bubblewrap fingerprint list
# Play Console からコピーした署名鍵の指紋を追加
bubblewrap fingerprint add AA:BB:CC:...:FF
bubblewrap fingerprint generateAssetLinks
```

### 3-2. このリポジトリに配置

生成された JSON の中身を **`.well-known/assetlinks.json`** に貼り付けて push します。
（現在はプレースホルダが入っています。`PLACEHOLDER_..._REPLACE_ME` を実際の指紋に置換してください）

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.cookiestrateger.game",
      "sha256_cert_fingerprints": ["<アップロード鍵>", "<Playアプリ署名鍵>"]
    }
  }
]
```

### 3-3. `.nojekyll` が必須（GitHub Pages 固有の落とし穴）

GitHub Pages は Jekyll でビルドされ、**Jekyll はドットで始まるディレクトリを
出力に含めません**。つまり `.nojekyll` が無いと `.well-known/assetlinks.json` は
push しても 404 になります。このリポジトリにはルートに空の `.nojekyll` を追加済みです
（サイトは素の HTML のみなので Jekyll を切っても影響はありません）。

### 3-4. 確認

```bash
curl -i https://cookiestrateger.com/.well-known/assetlinks.json
```

- `200` かつ `Content-Type: application/json` であること
- Google の検証ツール: `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://cookiestrateger.com&relation=delegate_permission/common.handle_all_urls`

---

## 4. Play Console でのアプリ作成と申告

「アプリを作成」→ アプリ名 / デフォルト言語 = 日本語 / **ゲーム** / **無料**。

### 4-1. ストアの掲載情報

**テキストは `store/listing.md` にコピペ用で用意済み**（文字数上限チェック済み。
`python3 store/check_listing.py` で再検証できます）。素材も生成済みです。

| 項目 | 使うファイル | 状態 |
|---|---|---|
| アプリ名 / 簡単な説明 / 詳しい説明 | `store/listing.md` | ✅ 作成済み |
| アプリアイコン 512×512 | `store/app_icon_512.png` | ✅ 生成済み |
| フィーチャーグラフィック 1024×500 | `store/feature_graphic_1024x500.png` | ✅ 生成済み |
| スクリーンショット（スマホ・最低2枚） | `store/screenshots/*.png` （1080×1920 が7枚） | ✅ 生成済み |
| タブレット用スクリーンショット | — | 任意。無くても公開できます |

### 4-2. 「アプリのコンテンツ」— 全項目の入力が公開の前提条件

**全フォームの回答は `store/play-console-answers.md` にまとめてあります。**
このアプリの実装（Google ログイン・Firestore・AdSense）に照らして選択肢まで確定させてあるので、
上から順に写していけば埋まります。要点だけ挙げると：

- **プライバシーポリシー**: `https://cookiestrateger.com/privacy.html`
- **広告**: 「**いいえ**」（Play 版は広告を出さないため。§8-1 参照）
- **アプリのアクセス権限**: 制限なし（テストアカウント提出は不要）
- **ターゲットユーザー**: **12歳以下を含めない**。含めるとファミリー向けプログラムの対象になり、
  審査項目とアプリ内購入まわりの要件が増えます
- **データセーフティ**: ユーザーID とセーブデータの収集、広告用の識別子の共有を申告
- **アカウント削除**: 実装済みです。アプリ内（⚙設定 → クラウド保存 →
  「アカウントとクラウドデータを削除」）と、Web の削除リクエスト URL
  `https://cookiestrateger.com/privacy.html#account-deletion` の両方が揃っています

---

## 5. アプリ内アイテム `unlimited_start` の登録

収益化 → アプリ内アイテム → アプリ内アイテムを作成：

| 項目 | 値 |
|---|---|
| 商品 ID | **`unlimited_start`** ← `play.html` にハードコードされているので完全一致必須 |
| 種類 | 1回限りの購入（買い切り） |
| 名前 / 説明 | 「スタート制限の解除」など |
| 価格 | 任意 |
| ステータス | **「有効」にする**（作っただけでは購入できません） |

前提として **販売者アカウント（Payments profile）の設定**が必要です。未設定だと
アプリ内アイテムのメニュー自体が出ません。

---

## 6. 内部テストで実機確認

まず **内部テスト**トラック（最大100人、審査ほぼ即時）に AAB を上げ、
テスターとして自分の Google アカウントを登録 → 配布リンクからインストールして確認：

- [ ] URL バーが出ていない（= assetlinks が効いている）
- [ ] `unlimited_start` の購入ダイアログが出て、購入後にスタート制限が消える
- [ ] 一度アンインストール→再インストールしても購入状態が復元される（`listPurchases` 経由）
- [ ] Google ログイン（クラウドセーブ）が成功する ← §8-2 参照
- [ ] ⚙設定 →「アカウントとクラウドデータを削除」が動く（Play の申告内容と一致すること）
- [ ] 広告（`adBreak`）が再生される
- [ ] 端末の戻るボタンでアプリが変な挙動をしない
- [ ] 転生 →「スキルツリーを確認する」でノードが表示される

課金テストは Play Console → 設定 → ライセンステスト にアカウントを登録すると
実際の課金なしでテストできます。

### AAB のアップロードを自動化する（任意）

「ビルド → Artifacts の zip をダウンロード → 展開 → Console で選択」を毎回やらずに済みます。
一度設定すれば、ワークフローの `upload_to_play` にチェックを入れるだけで内部テストまで届きます。

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作り、
   **Google Play Android Developer API** を有効化する
2. サービスアカウントを作り、**JSON 形式の鍵**をダウンロードする
3. Play Console →「ユーザーと権限」→ そのサービスアカウントのメールアドレスを招待し、
   対象アプリに「リリースを作成して製品版にデプロイ」相当の権限を与える
4. GitHub の `Settings → Secrets and variables → Actions` で
   **`PLAY_SERVICE_ACCOUNT_JSON`** を作り、鍵ファイルの中身をそのまま貼る

**このリポジトリは公開です。鍵ファイルは絶対にコミットしないこと。**
必ず Secret に入れてください。ワークフローもスクリプトも鍵の中身をログへ出しません。

権限の反映に最大24時間かかることがあります。それまでは 403 で弾かれます。

なお **「アプリのコンテンツ」の各申告（プライバシーポリシー・広告・レーティング・
ターゲットユーザー・データセーフティなど）には API がありません。** ここは Console で
手作業で埋めるしかないので、自動化の対象外です。

---

## 7. 製品版に出すまで（個人アカウントは最低14日）

**2023年11月13日以降に作成した「個人」開発者アカウント**は、製品版に出す前に

> **クローズドテストで 12人以上のテスターが 14日間連続でオプトイン**

が必須です。組織（Organization）アカウント、およびそれ以前に作った個人アカウントは免除されます。

- 「オプトイン」= 招待を受け取り、**そのアカウントで実際にインストールした**状態
- 14日のカウントはリリースが承認され、かつ12人が opt-in してから始まる
- エミュレータ・重複アカウント・ボットは無効
- 条件達成後に「製品版アクセスの申請」（3セクションのフォーム）→ 審査は通常7日以内

推奨する順序：**内部テスト（動作確認）→ クローズドテスト（12人×14日）→ 製品版アクセス申請 → 製品版公開**

---

## 8. このアプリ特有の注意点

### 8-1. 広告は Play 版だけ出さない（AdSense のリスクを回避）

当初は AdSense の H5 Games Ads をそのままアプリでも出す構成でしたが、
Google のポリシーは「自分が所有するアプリに埋め込むなら AdMob を使え」としており、
グレーゾーンでした。かといって **AdMob は TWA では技術的に使えません**
（AdMob は Android ネイティブ SDK で、Chrome が全画面を描画する TWA の上に
広告ビューを重ねる手段がありません）。

そこで **Play 版では広告を一切出さない**構成にしました。

- `play.html` の `<head>` で Play 版（TWA）と判定した場合、
  **AdSense のスクリプトそのものを読み込みません**（`window.isPlayStoreBuild`）
- 広告の代わりに「周回スタートは5時間に1回」の制限を設け、
  買い切りの `unlimited_start` で解除できるようにしています
- 制限は**初回の転生よりあとのスタートから**かかります。それまでは自由に遊べます
- 残り時間は `state.nextStartAt` に持ち、転生をまたいでも持ち越します

**ブラウザ版（cookiestrateger.com）は従来どおり AdSense を表示します。**
アプリ外のウェブサイトなので Play のポリシーには関係せず、収益もそのままです。

**時刻の判定はサーバー基準です。** 端末の時計をそのまま信じると、時計をクールダウンぶん進めるだけで
制限を飛ばせてしまいます。そこで同一オリジンへの HEAD リクエストのレスポンスヘッダ（`Date`）を
サーバー時刻として取得し、端末時計とのズレを補正した値で判定しています。

- 制限中にサーバー時刻を確認できないとき（オフライン・通信遮断）は**通しません**。
  通してしまうと、機内モードにして時計を進めるだけで抜けられるためです
- ただし**まだ一度も制限がかかっていない状態**（初回転生後の最初のスタート）は
  通信できなくても通ります。オフラインで遊び始められなくなるのを避けるためです
- HEAD なので Service Worker（GET のみ介入）を素通りし、キャッシュされた古い日時をつかみません

> 注意: 5時間に1回という制限です。ストアの説明文には
> `store/listing.md` で明記してありますが、レビューで不満が出やすい設計ではあります。
> 緩めたい場合は `play.html` の `START_COOLDOWN_MS` の値を変えれば調整できます。

### 8-2. TWA での Google ログイン（対応済み・要動作確認）

TWA からのポップアップは別タブ（Custom Tab）で開くため、opener への postMessage が返らず
ログインが完結しないことがあります。そこで `signInToCloud()` を、
**`signInWithPopup` が `auth/popup-blocked` などで失敗したら `signInWithRedirect` に
自動で切り替える**実装に変更済みです。

ただしリダイレクト方式は Firebase 側の設定が前提なので、**Firebase Console →
Authentication → 設定 → 承認済みドメイン に `cookiestrateger.com` が入っていることを
必ず確認してください**（入っていないとリダイレクト後に認証が拒否されます）。
そのうえで実機でのログイン確認をお願いします。

### 8-3. Digital Goods API は Play 経由のインストールでのみ動く

`app-release-signed.apk` を adb で直接入れたビルドでは
`getDigitalGoodsService` が使えず、課金導線は「購入は Google Play 版アプリでのみ
利用できます」になります。**課金の確認は必ず内部テスト配布のビルドで**行ってください。
（ブラウザでの UI 確認だけなら `?twa=1` を付けると Play 版判定を強制できます）

### 8-4. 更新の反映と `sw.js`

- **Web の更新（ゲーム内容・バランス・文言）はアプリを再ビルドせずに反映されます。**
  ただし Service Worker のキャッシュが効くので、`sw.js` の `CACHE` バージョン
  （現在 `cookie-strategist-v4`）を上げるのを忘れないでください
- **再ビルドが必要なのは**アイコン / アプリ名 / `targetSdkVersion` / Play Billing 設定など
  ネイティブ側を変えたときだけ。その場合は `twa-manifest.json` の
  `appVersionCode` を +1（`appVersionName` も更新）してから `bubblewrap build`

### 8-5. 課金の検証強度

現状の購入検証はクライアント側の `listPurchases` 照合のみです（`play.html` のコメント通り）。
より厳密にするならバックエンド + Play Developer API での検証が必要ですが、
買い切り1点であれば現状で実用上は十分です。

---

## 参考リンク

- [Meet Google Play's target API level requirement](https://developer.android.com/google/play/requirements/target-sdk)
- [Target API level requirements for Google Play apps (Play Console ヘルプ)](https://support.google.com/googleplay/android-developer/answer/11926878)
- [Bubblewrap CLI (GoogleChromeLabs)](https://github.com/GoogleChromeLabs/bubblewrap/blob/main/packages/cli/README.md)
- [Using a PWA in your Android app (web.dev)](https://web.dev/articles/using-a-pwa-in-your-android-app)
- [PWABuilder: Asset links の説明](https://github.com/pwa-builder/pwabuilder-google-play/blob/main/Asset-links.md)
- [Get started with AdSense H5 Games Ads](https://support.google.com/adsense/answer/9959170)
