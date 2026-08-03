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
2. 次の**2つ**を有効にする（リンクから直接飛べます）
   - [**YouTube Data API v3** を有効にする](https://console.cloud.google.com/apis/library/youtube.googleapis.com) … 投稿に使う
   - [**YouTube Analytics API** を有効にする](https://console.cloud.google.com/apis/library/youtubeanalytics.googleapis.com) … 再生回数などの読み取りに使う
3. [**OAuth同意画面**](https://console.cloud.google.com/apis/credentials/consent)
   - User Type は **外部**
   - アプリ名・メールアドレスを埋める（審査は不要です）
   - **テストユーザー**に、YouTube チャンネルを持っている自分の Google アカウントを追加する
   - 公開ステータスは「テスト」のままで構いません

> テストのままだと refresh token は **7日で失効**します。継続運用するなら、
> 同意画面を「本番環境」に**公開**してください（審査なしで公開できます。
> 未審査だと認可時に「確認されていないアプリ」の警告が出ますが、
> 自分のアカウントなら「詳細」→「移動」で進めます）。

## 2. OAuth クライアントを作る

[**認証情報**](https://console.cloud.google.com/apis/credentials) →「認証情報を作成」→「OAuth クライアント ID」

- アプリケーションの種類：**ウェブ アプリケーション**
  > ⚠️ **「デスクトップ」ではありません。** デスクトップ型にはリダイレクト URI の
  > 欄が無く、次の手順で使う OAuth Playground が利用できません。
- 承認済みのリダイレクト URI に次を**そのまま**追加：
  ```
  https://developers.google.com/oauthplayground
  ```

作成すると **クライアント ID** と **クライアント シークレット** が出ます。これが1つ目と2つ目です。

## 3. refresh token を取る

[**OAuth 2.0 Playground を開く**](https://developers.google.com/oauthplayground/)

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

> **環境変数は、設定したあとに始まるセッションから有効になります。**
> 動いているセッションには反映されません。定期実行は毎回新しいセッションで
> 走るので問題ありませんが、先に疎通を確かめたい場合は新しい会話を始めて
> 次を実行してもらってください。

```sh
bash promo/youtube/setup.sh
cd promo && node youtube/yt.mjs check
```

チャンネル名と、直近28日の再生回数が出れば準備完了です。

---

## スコープを広げる（既存動画を編集できるようにする）

上の3スコープでできるのは**投稿とサムネイルの差し替えだけ**です。すでに公開した
動画の説明欄・タイトル・タグは編集できません（`videos.update` が
`403 insufficientPermissions`）。再生リストと固定コメントも同じ理由で使えません。

**これが効くのは、いちばん見られている動画に導線が無いときです。** いま
`UUCI_m2Xqus`（「テスター募集！クッキーストラテジャー」）は説明欄が空で、
チャンネルの再生の大半をこの1本が集めています。開けば、そこに参加リンクを
入れられます。

やることは**手順3をもう一度、スコープを1つ足してやり直すだけ**です。
Google Cloud 側（手順1・2）は触りません。

1. [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/) を開く
2. 歯車 → **Use your own OAuth credentials** → 同じ Client ID / Client secret を貼る
   （**新しく作らないこと。** 作ると `YT_CLIENT_ID` と `YT_CLIENT_SECRET` も
   差し替えになります）
3. Step 1 に次の**4つ**を貼る（`youtube.force-ssl` が増えた1つ）
   ```
   https://www.googleapis.com/auth/youtube.upload
   https://www.googleapis.com/auth/youtube.readonly
   https://www.googleapis.com/auth/youtube.force-ssl
   https://www.googleapis.com/auth/yt-analytics.readonly
   ```
4. **Authorize APIs** → 同じ Google アカウントで許可
   （「このアプリは確認されていません」が出たら「詳細」→「安全でないページに移動」）
5. **Exchange authorization code for tokens** → 新しい **Refresh token**（`1//`…）をコピー

> `youtube.force-ssl` は読み取りと管理を両方含みます。既存の3つは残したままで
> 構いません。**古い refresh token は無効になりません** —— 新しいほうに
> 差し替えるまで、いままでどおり動き続けます。

### 差し替え先は2つあり、意味が違います

| 置き場所 | 反映されるタイミング |
|---|---|
| 環境変数（Environments → Environment variables） | **次に始まるセッションから。** 動いているセッションには入らない |
| `promo/youtube/.env` | **次のコマンドから即座に。** 実行のたびに読み直している |

常駐セッションが動き続けている間に切り替えたいなら `.env` のほうです。
コンテナの中に置くだけで、`.gitignore` 済みなのでコミットされません。

```sh
cat > promo/youtube/.env <<'EOF'
YT_CLIENT_ID=...apps.googleusercontent.com
YT_CLIENT_SECRET=GOCSPX-...
YT_REFRESH_TOKEN=1//...
EOF
```

> コンテナは作り直されると消えるので、**環境変数のほうにも同じ値を入れておいてください。**
> `.env` はいま動いているセッションに届けるための一時的な口です。

### 効いたか確かめる

```sh
cd promo && node youtube/yt.mjs check
```

最後の3行に出どころとスコープが出ます。こうなれば成功です。

```
スコープ: youtube.readonly youtube.upload youtube.force-ssl yt-analytics.readonly
  → 既存動画の編集・再生リスト・固定コメントも可能
```

## 補足

- **アップロードの quota**：既定は1日10,000ユニット、投稿1本で1,600ユニットです。
  1日1本なら余裕があります（分析の読み取りは1ユニット）。
- **投稿は既定で「非公開」です。** 自動で公開したくなったら、環境変数に
  `YT_PRIVACY=public` を足してください。認証情報と同じで、公開は既定値ではなく
  意思決定として置いています。
- **チャンネルの概要欄**（テスター募集文）は自動化に含めていません。
  動画が「応募方法は概要欄に」と言うので、先に一度だけ更新しておいてください。
  文面は [`../script_ja.md`](../script_ja.md) の §5 にあります。
