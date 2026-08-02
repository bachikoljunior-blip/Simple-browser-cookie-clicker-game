# YouTube 連携の準備（1回だけ）

自動投稿と分析の読み取りには、Google の OAuth 認証情報が要ります。
ここで作るのは3つの値だけです。

```
YT_CLIENT_ID
YT_CLIENT_SECRET
YT_REFRESH_TOKEN
```

> **この3つは秘密情報です。リポジトリにコミットしないでください。**
> 渡し方は最後の「4. 環境変数として設定する」を見てください。
> チャットに直接貼らずに済む方法を書いています。

---

## 1. Google Cloud 側の準備

1. [Google Cloud Console](https://console.cloud.google.com/) で**新しいプロジェクト**を作る（名前は何でも可）
2. 「APIとサービス」→「ライブラリ」で、次の**2つ**を有効にする
   - **YouTube Data API v3** … 投稿に使う
   - **YouTube Analytics API** … 再生回数などの読み取りに使う
3. 「APIとサービス」→「OAuth同意画面」
   - User Type は **外部**
   - アプリ名・メールアドレスを埋める（審査は不要です）
   - **テストユーザー**に、YouTube チャンネルを持っている自分の Google アカウントを追加する
   - 公開ステータスは「テスト」のままで構いません

> テストのままだと refresh token は **7日で失効**します。継続運用するなら、
> 同意画面を「本番環境」に**公開**してください（審査なしで公開できます。
> 未審査だと認可時に「確認されていないアプリ」の警告が出ますが、
> 自分のアカウントなら「詳細」→「移動」で進めます）。

## 2. OAuth クライアントを作る

「APIとサービス」→「認証情報」→「認証情報を作成」→「OAuth クライアント ID」

- アプリケーションの種類：**ウェブ アプリケーション**
- 承認済みのリダイレクト URI に次を**そのまま**追加：
  ```
  https://developers.google.com/oauthplayground
  ```

作成すると **クライアント ID** と **クライアント シークレット** が出ます。これが1つ目と2つ目です。

## 3. refresh token を取る

[OAuth 2.0 Playground](https://developers.google.com/oauthplayground/) を開きます。

1. 右上の**歯車アイコン**を押して
   - **Use your own OAuth credentials** にチェック
   - さきほどの Client ID / Client secret を貼る
2. 左の「Step 1」の入力欄に、次の3つのスコープを**改行または空白区切りで**貼る
   ```
   https://www.googleapis.com/auth/youtube.upload
   https://www.googleapis.com/auth/youtube.readonly
   https://www.googleapis.com/auth/yt-analytics.readonly
   ```
3. **Authorize APIs** → チャンネルを持っている Google アカウントでログイン → 許可
4. 「Step 2」の **Exchange authorization code for tokens** を押す
5. 表示された **Refresh token**（`1//` で始まる長い文字列）をコピー。これが3つ目です

> ここで出た **Access token** の方は1時間で切れます。使うのは **Refresh token** です。

## 4. 環境変数として設定する

Claude Code on the web の**環境設定**（Environments → この環境 → Environment variables）に
3つを登録してください。ここに入れておけば、定期実行で立ち上がるセッションにも自動で渡り、
リポジトリにも会話にも残りません。

| 名前 | 値 |
|---|---|
| `YT_CLIENT_ID` | `...apps.googleusercontent.com` |
| `YT_CLIENT_SECRET` | `GOCSPX-...` |
| `YT_REFRESH_TOKEN` | `1//...` |

設定できたら、次で疎通を確認できます。

```sh
cd promo/youtube
node yt.mjs check
```

チャンネル名と、直近28日の再生回数が出れば準備完了です。

---

## 補足

- **アップロードの quota**：既定は1日10,000ユニット、投稿1本で1,600ユニットです。
  1日1本なら余裕があります（分析の読み取りは1ユニット）。
- **初回の投稿は「非公開」で出ます**（`autopost.mjs` の既定）。
  中身を確認してから公開に切り替える運用にしています。
  毎回そのまま公開にしたい場合は `--privacy public` を付けてください。
- **チャンネルの概要欄**（テスター募集文）は自動化に含めていません。
  動画が「応募方法は概要欄に」と言うので、先に一度だけ更新しておいてください。
  文面は [`../script_ja.md`](../script_ja.md) の §5 にあります。
