# スマホだけで Google Play に公開する手順

PC を使わずに、スマホのブラウザだけで AAB のビルドから公開まで進められるようにしました。
ビルドは GitHub Actions（GitHub のサーバー）が代わりに実行します。

前提として `PLAY_STORE.md` の内容（TWA 方式・素材・申告内容）は用意済みです。
このページは「スマホで何を押すか」だけに絞っています。

---

## 用意されているワークフロー

リポジトリの **Actions** タブから、3つを手動で実行します。

| ワークフロー | 何をするか | 実行回数 |
|---|---|---|
| **1. 署名鍵をつくる** | アプリの署名鍵（アップロード鍵）を生成 | **1回だけ** |
| **2. Androidアプリをビルド** | AAB（Play用）と APK（実機確認用）を作る | 更新のたび |
| **3. assetlinks.json を更新** | 署名鍵の指紋を `.well-known/assetlinks.json` に書いて commit | 2回（後述） |

---

## Step 0. Actions を使える状態にする

GitHub のリポジトリ → **Settings → Actions → General** →
「Allow all actions and reusable workflows」を選んで Save。

（画面が狭いときは、ブラウザのメニューから「PC版サイト」に切り替えると操作しやすくなります。
以降の Play Console も同じです。）

---

## Step 1. 署名鍵をつくる（1回だけ）

1. **Actions** タブ → 左の一覧から **「1. 署名鍵をつくる」** を選ぶ
2. **Run workflow** を押し、入力する
   - `keystore_password`: 6文字以上の好きなパスワード。**絶対に忘れないこと**
   - `key_alias`: `upload`（そのままでOK）
3. **Run workflow** を押して、完了（緑のチェック）を待つ（1分ほど）
4. 実行結果のページを開くと、上部のサマリーに **SHA-256 指紋** が出ます
5. ページ下部の **Artifacts → `upload-keystore`** をタップしてダウンロード

> ### ⚠️ ここが一番大事です
> ダウンロードした zip の中の **`upload-keystore.jks` を必ず自分で保管してください。**
> Google ドライブなど、スマホを買い替えても残る場所に置くのが安全です。
> **この鍵を失うと、公開後のアプリを永久に更新できなくなります。**
> パスワードも一緒にメモしておいてください。

### Secrets を3つ登録する

**Settings → Secrets and variables → Actions → New repository secret** で3つ作ります。

| Secret 名 | 入れる値 |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | zip の中の `upload-keystore.base64.txt` を開き、**全部選択してコピペ**（1行の長い文字列） |
| `ANDROID_KEYSTORE_PASSWORD` | Step 1 で入力したパスワード |
| `ANDROID_KEY_ALIAS` | `upload` |

> zip の解凍は Android の「Files」アプリや「ファイル」アプリで開けます。
> `.txt` は同じアプリから開いて、長押し → 全選択 → コピーできます。

登録が終わったら、Step 1 の実行ページの Artifacts は削除して構いません
（base64 が GitHub 上に残り続けるのを避けるため）。

---

## Step 2. AAB をビルドする

1. **Actions** → **「2. Androidアプリをビルド」** → **Run workflow**
2. 入力
   - `version_name`: `1.0.0`
   - `version_code`: `1` ← **アップロードするたびに必ず +1**（同じ数字は二度と使えません）
   - `target_sdk`: `36`（そのままでOK）
3. 完了を待つ（初回は5〜10分ほど）
4. **Artifacts** から `android-1.0.0-1` をダウンロード

zip の中身：

| ファイル | 用途 |
|---|---|
| `app-release-bundle.aab` | **Play Console にアップロードするのはこれ** |
| `app-release-signed.apk` | 実機に直接入れて見た目を確認する用（課金は動きません） |

---

## Step 3. Play Console でアプリを作る

Play Console（`play.google.com/console`）をスマホのブラウザで開きます。

1. **アプリを作成**
   - アプリ名: `クッキーストラテジャー`
   - デフォルトの言語: 日本語
   - アプリまたはゲーム: **ゲーム**
   - 無料または有料: **無料**
2. **テストとリリース → テスト → 内部テスト → 新しいリリースを作成**
3. `app-release-bundle.aab` をアップロード（Android のファイル選択から選べます）
4. リリースノートを適当に入れて保存 → 「公開の概要」から審査に送る

> **1回目のアップロードは必ずここで手動でやる必要があります。**
> Play のアプリ署名鍵は、最初の AAB を受け取った時点で発行されるためです。

---

## Step 4. assetlinks.json を仕上げる（超重要）

これを飛ばすと、アプリを開いたときに **Chrome の URL バーが出たまま**になります。

1. Play Console → **テストとリリース → 設定 → アプリの署名**
2. **「アプリ署名鍵の証明書」** の **SHA-256 証明書フィンガープリント** をコピー
   （`AA:BB:CC:...` の形式）
3. GitHub の **Actions → 「3. assetlinks.json を更新」 → Run workflow**
4. `play_signing_sha256` にコピーした指紋を貼って実行

これで `.well-known/assetlinks.json` に**アップロード鍵と Play アプリ署名鍵の両方**が
自動で書き込まれ、commit されます。1〜2分後に次の URL が JSON を返すか確認してください。

```
https://cookiestrateger.com/.well-known/assetlinks.json
```

> Step 1 のあと（Play にアップロードする前）にこのワークフローを空欄で実行しておくと、
> アップロード鍵の分だけ先に書き込まれます。Play の指紋が出てからもう一度実行すれば完成です。

---

## Step 5. ストアの掲載情報を入れる

**テキストは `store/listing.md` にコピペ用で置いてあります。** GitHub でファイルを開いて、
コードブロックをそのままコピーしてください。

画像は GitHub の該当ファイルを開いて **「Download raw file」** でスマホに保存できます。

| Play Console の項目 | 使うファイル |
|---|---|
| アプリアイコン | `store/app_icon_512.png` |
| フィーチャーグラフィック | `store/feature_graphic_1024x500.png` |
| スクリーンショット（スマートフォン） | `store/screenshots/01〜07` の7枚 |

## Step 6. 「アプリのコンテンツ」を埋める

**`store/play-console-answers.md` の通りに選ぶだけです。**
データセーフティ、コンテンツのレーティング、対象年齢、広告、アカウント削除まで
選択肢レベルで確定させてあります。

## Step 7. 実機で確認

内部テストの配布リンクから自分の端末にインストールして、以下を確認します。

- [ ] URL バーが出ていない（出ていたら Step 4 を見直す）
- [ ] 広告非表示の購入ダイアログが出る（先に `ad_free` の登録が必要 → `PLAY_STORE.md` §5）
- [ ] Google ログイン（クラウドセーブ）が通る
- [ ] ⚙設定 → 「アカウントとクラウドデータを削除」が動く
- [ ] 転生 → スキルツリーが表示される

## Step 8. 製品版へ

個人アカウントの場合、**クローズドテストで12人が14日間連続オプトイン**してから
製品版アクセスを申請します（詳細は `PLAY_STORE.md` §7）。

---

## 更新のしかた

| 変えたもの | やること |
|---|---|
| ゲーム内容・文言・バランス（Web のコード） | push するだけ。アプリ側も自動で反映（`sw.js` の `CACHE` を上げる） |
| アイコン・アプリ名・targetSdk・課金設定 | 「2. Androidアプリをビルド」を `version_code` を +1 して再実行 → 新しい AAB をアップロード |

---

## 詰まったときに見るところ

| 症状 | 原因と対処 |
|---|---|
| ビルドが `Secret が未登録です` で止まる | Step 1 の Secrets 3つを登録し直す（名前のスペルに注意） |
| ビルドが署名で失敗する | `ANDROID_KEYSTORE_PASSWORD` が Step 1 で入れたものと違う |
| アプリに URL バーが出る | Step 4 未実施、または Play アプリ署名鍵の指紋が入っていない |
| `assetlinks.json` が 404 | `.nojekyll` がリポジトリのルートに無い（自動で作られますが確認を） |
| 購入ボタンが「Google Play 版アプリでのみ」と出る | APK 直インストールでは正常。内部テスト配布のビルドで確認する |
| `version_code` が重複してアップロードできない | 同じ数字は再利用できません。+1 して再ビルド |
