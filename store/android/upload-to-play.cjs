// AAB を Google Play にアップロードして、指定トラックのリリースにする。
//
// 手作業(Artifacts から zip をダウンロード → 展開 → Play Console で選択)を丸ごと置き換える。
// Play Console の「アプリのコンテンツ」の各申告には API が無いので、そこだけは Console で埋めること。
//
// 必要な環境変数:
//   PLAY_SERVICE_ACCOUNT_JSON  サービスアカウントの鍵(JSON文字列)。ログに出さないこと
//   AAB_PATH                   アップロードする .aab のパス
//   PACKAGE_NAME               例 com.cookiestrateger.game
//   TRACK                      internal / alpha / beta / production
//   RELEASE_NAME               リリース名(省略時は versionCode から自動)
//   RELEASE_NOTES              リリースノート(ja-JP)。空なら省略
//   RELEASE_STATUS             completed(即時公開) / draft(下書きのまま)

const fs = require("fs");
const { google } = require("googleapis");

function need(name) {
  const v = process.env[name];
  if (!v) throw new Error(`環境変数 ${name} が空です`);
  return v;
}

async function main() {
  const packageName = need("PACKAGE_NAME");
  const aabPath = need("AAB_PATH");
  const track = process.env.TRACK || "internal";
  const status = process.env.RELEASE_STATUS || "completed";

  if (!fs.existsSync(aabPath)) throw new Error(`${aabPath} がありません`);

  // 鍵は JSON 文字列で受け取る。ファイルに落とさないので後始末も要らない
  let creds;
  try {
    creds = JSON.parse(need("PLAY_SERVICE_ACCOUNT_JSON"));
  } catch (e) {
    throw new Error("PLAY_SERVICE_ACCOUNT_JSON が JSON として読めません。Secret に鍵ファイルの中身をそのまま貼っているか確認してください");
  }

  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/androidpublisher"]
  });
  const play = google.androidpublisher({ version: "v3", auth });

  console.log(`編集セッションを開きます (${packageName})`);
  const edit = await play.edits.insert({ packageName });
  const editId = edit.data.id;

  let versionCode;
  try {
    console.log(`AAB をアップロードします: ${aabPath}`);
    const up = await play.edits.bundles.upload({
      packageName,
      editId,
      media: { mimeType: "application/octet-stream", body: fs.createReadStream(aabPath) }
    });
    versionCode = up.data.versionCode;
    console.log(`アップロード完了: versionCode ${versionCode}`);

    const release = {
      versionCodes: [String(versionCode)],
      status,
      name: process.env.RELEASE_NAME || `${versionCode}`
    };
    const notes = (process.env.RELEASE_NOTES || "").trim();
    if (notes) release.releaseNotes = [{ language: "ja-JP", text: notes }];

    console.log(`トラック ${track} に割り当てます (status=${status})`);
    await play.edits.tracks.update({
      packageName,
      editId,
      track,
      requestBody: { track, releases: [release] }
    });

    await play.edits.commit({ packageName, editId });
    console.log("反映しました");
  } catch (e) {
    // 失敗した編集セッションは破棄する。残すと次回 insert が通らないことがある
    try { await play.edits.delete({ packageName, editId }); } catch (_) {}
    throw e;
  }

  // ワークフローのサマリー用
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `version_code=${versionCode}\ntrack=${track}\n`);
  }
}

main().catch(e => {
  // 鍵の中身が例外メッセージに混ざらないよう、message だけを出す
  console.error("アップロードに失敗しました:", e && e.message ? e.message : e);
  process.exit(1);
});
