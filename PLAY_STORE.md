# Google Play ストア公開手順（クッキーストラテジャー）

このサイトは PWA として完成しており、`play.html` には既に
Google Play 版の判定（`android-app://` referrer）と Digital Goods API による
`ad_free` 課金が実装済みです。したがって **TWA（Trusted Web Activity）** として
パッケージ化するのが最短ルートです。Web を更新すればアプリ側も自動で更新されます。

以下は「Play Console のアカウント登録が済んでいる」状態からの手順です。

---

## 0. 全体の流れ

| # | やること | 場所 | 所要 |
|---|---|---|---|
| 1 | ビルド環境の用意（Node / JDK） | PC | 30分 |
| 2 | Bubblewrap で TWA プロジェクト生成・AAB ビルド | PC | 1時間 |
| 3 | Digital Asset Links を本サイトに設置 | このリポジトリ | 15分 |
| 4 | Play Console でアプリ作成・掲載情報・各種申告 | Play Console | 2〜4時間 |
| 5 | アプリ内アイテム `ad_free` を登録 | Play Console | 30分 |
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
| Application ID (package) | `com.cookiestrateger.app` ← **公開後は永久に変更不可**。慎重に |
| Display mode | `standalone` |
| Orientation | `portrait` |
| Status bar / Nav bar color | `#1d130d` |
| Splash screen color | `#1d130d` |
| Icon URL | `https://cookiestrateger.com/icons/icon-512.png` |
| Maskable icon URL | `https://cookiestrateger.com/icons/icon-maskable-512.png` |
| Include support for Play Billing? | **Yes**（`ad_free` の課金に必須） |
| Signing key | 新規作成。**キーストアとパスワードは絶対に失くさない**（失うとアプリ更新不可） |

生成された `twa-manifest.json` で以下を確認・修正します：

```jsonc
{
  "packageId": "com.cookiestrateger.app",
  "host": "cookiestrateger.com",
  "startUrl": "/play.html",
  "appVersionCode": 1,
  "appVersionName": "1.0.0",
  "orientation": "portrait",
  "display": "standalone",
  "fallbackType": "customtabs",
  "alphaDependencies": { "enabled": true },      // Play Billing に必要
  "features": { "playBilling": { "enabled": true } }
}
```

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
      "package_name": "com.cookiestrateger.app",
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

| 項目 | 内容 |
|---|---|
| アプリ名 | 30文字以内（例: `クッキーストラテジャー`） |
| 簡単な説明 | 80文字以内 |
| 詳しい説明 | 4000文字以内（`index.html` の説明文を流用できます） |
| アプリアイコン | 512×512 PNG → `icons/icon-512.png` がそのまま使えます |
| フィーチャーグラフィック | **1024×500 PNG/JPG。新規に作る必要あり** |
| スクリーンショット（スマホ） | **最低2枚**、推奨4〜8枚。9:16 の 1080×1920 など |

### 4-2. 「アプリのコンテンツ」— 全項目の入力が公開の前提条件

- **プライバシーポリシー**: `https://cookiestrateger.com/privacy.html`（設置済み）
- **広告**: 「はい、広告が含まれています」
- **アプリのアクセス権限**: ログイン無しで全機能が遊べるので「制限なし」。テスト用アカウント提出は不要
- **コンテンツのレーティング**: IARC 質問票に回答（このゲームなら全年齢相当）
- **ターゲットユーザーとコンテンツ**: 対象年齢層を選択。
  **13歳未満を含めるとファミリー向けポリシー＋広告規制が一気に厳しくなる**ので、
  意図が無ければ含めない方が通しやすいです
- **データセーフティ**: Google ログインでクラウドセーブを使うので、正直に申告が必要です。
  - 収集する: 「個人情報 → ユーザー ID」（Firebase の uid）、「アプリのアクティビティ → アプリ内のアクション」（セーブデータ）
  - 用途: アプリの機能（セーブ同期）
  - 転送時に暗号化される: はい
  - ユーザーがデータ削除をリクエストできる: はい
- **アカウント削除**: Google ログイン機能があるため、
  **アプリ内の削除導線＋Web 上の削除リクエスト URL** の提出を求められます。
  `privacy.html` に削除手順と連絡先を書き、その URL を申告するのが手軽です
- 政府/ 金融 / 健康アプリ: いずれも「いいえ」

---

## 5. アプリ内アイテム `ad_free` の登録

収益化 → アプリ内アイテム → アプリ内アイテムを作成：

| 項目 | 値 |
|---|---|
| 商品 ID | **`ad_free`** ← `play.html` にハードコードされているので完全一致必須 |
| 種類 | 1回限りの購入（買い切り） |
| 名前 / 説明 | 「広告非表示」など |
| 価格 | 任意 |
| ステータス | **「有効」にする**（作っただけでは購入できません） |

前提として **販売者アカウント（Payments profile）の設定**が必要です。未設定だと
アプリ内アイテムのメニュー自体が出ません。

---

## 6. 内部テストで実機確認

まず **内部テスト**トラック（最大100人、審査ほぼ即時）に AAB を上げ、
テスターとして自分の Google アカウントを登録 → 配布リンクからインストールして確認：

- [ ] URL バーが出ていない（= assetlinks が効いている）
- [ ] `ad_free` の購入ダイアログが出て、購入後に広告ゲートが消える
- [ ] 一度アンインストール→再インストールしても購入状態が復元される（`listPurchases` 経由）
- [ ] Google ログイン（クラウドセーブ）が成功する ← §8-2 参照
- [ ] 広告（`adBreak`）が再生される
- [ ] 端末の戻るボタンでアプリが変な挙動をしない

課金テストは Play Console → 設定 → ライセンステスト にアカウントを登録すると
実際の課金なしでテストできます。

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

### 8-1. AdSense H5 Games Ads とアプリ配信（要確認・重要）

現在の広告は AdSense の H5 Games Ads（`adBreak` / `adConfig`, `ca-pub-3280484274197291`）です。
Google のポリシー上、**自分が所有するアプリにゲームを埋め込んで配信する場合は
AdMob を使うのが正規ルート**とされています。TWA は WebView ではなく Chrome の実体なので
グレーゾーンではありますが、AdSense アカウント側の措置リスクがあります。
公開前に AdSense サポートに「TWA での Play 配信」について確認しておくことを勧めます。
（Play 側の審査というより AdSense 側の規約の問題です）

### 8-2. TWA での Google ログイン

`play.html` は `signInWithPopup` を使っています。TWA からのポップアップは
別タブ（Custom Tab）で開くため、**opener への postMessage が返らずログインが
完結しないことがあります**。内部テストの実機で必ず確認し、失敗するようなら
`signInWithRedirect` に切り替えてください。あわせて Firebase Console →
Authentication → 設定 → 承認済みドメイン に `cookiestrateger.com` が
入っていることも確認を。

### 8-3. Digital Goods API は Play 経由のインストールでのみ動く

`app-release-signed.apk` を adb で直接入れたビルドでは
`getDigitalGoodsService` が使えず、課金導線は「購入は Google Play 版アプリでのみ
利用できます」になります。**課金の確認は必ず内部テスト配布のビルドで**行ってください。
（ブラウザでの UI 確認だけなら `?twa=1` を付けると Play 版判定を強制できます）

### 8-4. 更新の反映と `sw.js`

- **Web の更新（ゲーム内容・バランス・文言）はアプリを再ビルドせずに反映されます。**
  ただし Service Worker のキャッシュが効くので、`sw.js` の `CACHE` バージョン
  （現在 `cookie-strategist-v3`）を上げるのを忘れないでください
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
