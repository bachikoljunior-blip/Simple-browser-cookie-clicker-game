#!/usr/bin/env node
// promo/youtube/yt.mjs — 宣伝動画を YouTube に上げるための CLI。
//
//   node youtube/yt.mjs check      いまアップロードできる状態か確かめる
//   node youtube/yt.mjs auth       ブラウザでログインして更新トークンを取り出す
//   node youtube/yt.mjs upload     metadata.md の内容で動画を投稿する
//   node youtube/yt.mjs metadata   metadata.md を解釈した結果を表示する
//
// 依存は Node 18 以上だけです（fetch を使うため）。外部パッケージは使いません。

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import crypto from "node:crypto";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENV_FILE = path.join(HERE, ".env");
const METADATA_FILE = path.join(HERE, "metadata.md");

// YouTube 側の上限。文字数は UTF-16 単位で数えます（API の判定に合わせるため）。
const LIMIT_TITLE = 100;
const LIMIT_DESCRIPTION = 5000;
const LIMIT_TAGS_TOTAL = 500;
const LIMIT_THUMBNAIL_BYTES = 2 * 1024 * 1024;

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
];

const PRIVACY_VALUES = ["private", "unlisted", "public"];

// ---------------------------------------------------------------- 表示まわり

let ngCount = 0;
let warnCount = 0;

const ok = (msg) => console.log(`OK   ${msg}`);
const ng = (msg) => {
  ngCount += 1;
  console.log(`NG   ${msg}`);
};
const warn = (msg) => {
  warnCount += 1;
  console.log(`警告 ${msg}`);
};
const head = (msg) => console.log(`\n== ${msg} ==`);
const hint = (msg) => console.log(`     → ${msg}`);

const die = (msg) => {
  console.error(`エラー: ${msg}`);
  process.exit(1);
};

function humanBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

// ---------------------------------------------------------------- .env 読み書き

// 値がどこから来たかを覚えておきます（check で表示するため）。
const envSource = {};

// 値の優先順位は「.env に書かれた空でない値」→「環境変数」の順です。
// 環境変数は編集しても次のセッションからしか効かないので、
// 手元ですぐ直せる .env を勝たせています。食い違うときは check が知らせます。
const envConflicts = [];

// KEY=VALUE 形式だけを読みます。値の前後の引用符は外します。
function loadEnv() {
  const conf = {};
  const KEYS = [
    "YT_CLIENT_ID",
    "YT_CLIENT_SECRET",
    "YT_REFRESH_TOKEN",
    "YT_VIDEO",
    "YT_THUMBNAIL",
    "YT_PRIVACY",
    "YT_CATEGORY_ID",
  ];

  // 先に環境変数を土台として入れます（CI や環境設定から渡す用）。
  for (const key of KEYS) {
    if (process.env[key]) {
      conf[key] = process.env[key];
      envSource[key] = "環境変数";
    }
  }

  if (fs.existsSync(ENV_FILE)) {
    for (const line of fs.readFileSync(ENV_FILE, "utf8").split("\n")) {
      const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
      if (!m) continue;
      let value = m[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
        (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
      ) {
        value = value.slice(1, -1);
      }
      // 空の行（YT_CLIENT_ID= だけ）は「未設定」扱いにして、環境変数を消しません。
      if (!value) {
        if (!(m[1] in conf)) conf[m[1]] = "";
        continue;
      }
      if (process.env[m[1]] && process.env[m[1]] !== value) {
        envConflicts.push(m[1]);
      }
      conf[m[1]] = value;
      envSource[m[1]] = ".env";
    }
  }
  return conf;
}

// .env の中の 1 つのキーだけを差し替えます（無ければ末尾に足します）。
function saveEnvValue(key, value) {
  let text = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, "utf8") : "";
  const line = `${key}=${value}`;
  const re = new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=.*$`, "m");
  if (re.test(text)) {
    text = text.replace(re, line);
  } else {
    if (text && !text.endsWith("\n")) text += "\n";
    text += `${line}\n`;
  }
  fs.writeFileSync(ENV_FILE, text, { mode: 0o600 });
  try {
    fs.chmodSync(ENV_FILE, 0o600);
  } catch {
    /* Windows などでは失敗しても構いません */
  }
}

function resolveFromRepo(conf, key, fallback) {
  const value = conf[key] || fallback;
  if (!value) return null;
  return path.isAbsolute(value) ? value : path.resolve(HERE, "..", "..", value);
}

// ---------------------------------------------------------------- metadata.md

// 「## <名前>（…）」の直後から次の見出しまでにある ``` ブロックを拾います。
function sectionBlocks(md, name) {
  const section = new RegExp(`^## ${name}（[^\\n]*\\n(.*?)(?=^## |\\Z)`, "sm").exec(md);
  if (!section) return null;
  return [...section[1].matchAll(/```\n(.*?)\n```/gs)].map((m) => m[1]);
}

function parseMetadata() {
  if (!fs.existsSync(METADATA_FILE)) {
    die(`${path.relative(process.cwd(), METADATA_FILE)} がありません。`);
  }
  const md = fs.readFileSync(METADATA_FILE, "utf8");
  const titles = sectionBlocks(md, "タイトル");
  const descriptions = sectionBlocks(md, "説明");
  const tagBlocks = sectionBlocks(md, "タグ");

  const tags = tagBlocks && tagBlocks[0]
    ? tagBlocks[0]
        .split(/[,、\n]/)
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  return {
    titles: titles || [],
    descriptions: descriptions || [],
    tags,
    // 実際に投稿に使うのは各セクションの最初のブロックです。
    title: titles && titles[0] ? titles[0] : null,
    description: descriptions && descriptions[0] ? descriptions[0] : null,
  };
}

// YouTube のタグ合計文字数は、空白を含むタグが引用符で囲われる分だけ増えます。
function tagsTotalLength(tags) {
  return tags.reduce((sum, t) => sum + t.length + (/\s/.test(t) ? 2 : 0), 0);
}

// ---------------------------------------------------------------- API 呼び出し

async function fetchJson(url, init, what) {
  const res = await fetch(url, init);
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* JSON でない応答はそのまま扱います */
  }
  if (!res.ok) {
    const detail = body?.error?.message || body?.error_description || text.slice(0, 300);
    const err = new Error(`${what} に失敗しました (HTTP ${res.status}): ${detail}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

async function accessTokenFrom(conf) {
  const missing = ["YT_CLIENT_ID", "YT_CLIENT_SECRET", "YT_REFRESH_TOKEN"].filter((k) => !conf[k]);
  if (missing.length) {
    throw new Error(`${missing.join(", ")} が設定されていません。node youtube/yt.mjs auth を実行してください。`);
  }
  const body = await fetchJson(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: conf.YT_CLIENT_ID,
        client_secret: conf.YT_CLIENT_SECRET,
        refresh_token: conf.YT_REFRESH_TOKEN,
        grant_type: "refresh_token",
      }),
    },
    "アクセストークンの取得",
  );
  return body.access_token;
}

async function myChannel(token) {
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("part", "snippet,status,contentDetails");
  url.searchParams.set("mine", "true");
  const body = await fetchJson(url, { headers: { Authorization: `Bearer ${token}` } }, "チャンネル情報の取得");
  return body.items && body.items[0] ? body.items[0] : null;
}

// ---------------------------------------------------------------- check

async function cmdCheck(argv) {
  const offline = argv.includes("--offline");
  const conf = loadEnv();

  head("実行環境");
  const major = Number(process.versions.node.split(".")[0]);
  if (major >= 18) ok(`Node.js ${process.versions.node}`);
  else ng(`Node.js ${process.versions.node}（18 以上が必要です）`);

  head("設定ファイル");
  if (fs.existsSync(ENV_FILE)) {
    ok(`promo/youtube/.env があります`);
    const mode = fs.statSync(ENV_FILE).mode & 0o777;
    if (mode & 0o077) warn(`.env の権限が ${mode.toString(8)} です。chmod 600 promo/youtube/.env を推奨します`);
  } else {
    ng("promo/youtube/.env がありません");
    hint("bash promo/youtube/setup.sh を実行すると雛形が作られます");
  }
  for (const key of ["YT_CLIENT_ID", "YT_CLIENT_SECRET", "YT_REFRESH_TOKEN"]) {
    if (conf[key]) ok(`${key} が設定されています（${envSource[key]}）`);
    else ng(`${key} が空です`);
  }

  for (const key of envConflicts) {
    warn(`${key} は環境変数と .env で値が違います。.env の方を使います`);
  }

  // クライアント ID は形が決まっているので、貼り間違いをここで捕まえます。
  // 正しい形: 123456789012-xxxxxxxxxxxx.apps.googleusercontent.com
  const CLIENT_ID_FORM = /^[0-9]+-[0-9a-z]+\.apps\.googleusercontent\.com$/;
  if (conf.YT_CLIENT_ID && !CLIENT_ID_FORM.test(conf.YT_CLIENT_ID)) {
    ng("YT_CLIENT_ID の形が Google のクライアント ID と違います");
    hint("正しい形は 123456789012-xxxxxxxxxxxx.apps.googleusercontent.com です");
    const fixed = repairClientId(conf.YT_CLIENT_ID);
    if (fixed) hint(`「${fixed}」の貼り間違い（前後の重複）に見えます。設定し直してください`);
  }
  if (conf.YT_CLIENT_SECRET && !/^GOCSPX-/.test(conf.YT_CLIENT_SECRET)) {
    warn("YT_CLIENT_SECRET が GOCSPX- で始まっていません。別の値を貼っていないか確認してください");
  }

  if (!conf.YT_CLIENT_ID || !conf.YT_CLIENT_SECRET) {
    hint("Google Cloud コンソールで OAuth クライアント（種類: デスクトップアプリ）を作り、.env に貼ってください");
  } else if (!conf.YT_REFRESH_TOKEN) {
    hint("node youtube/yt.mjs auth を実行するとブラウザでログインして取得できます");
  }

  const privacy = conf.YT_PRIVACY || "private";
  if (PRIVACY_VALUES.includes(privacy)) ok(`公開設定 YT_PRIVACY=${privacy}`);
  else ng(`YT_PRIVACY=${privacy} は不正です（${PRIVACY_VALUES.join(" / ")} のいずれか）`);

  head("投稿テキスト（metadata.md）");
  const meta = parseMetadata();
  checkTextSection("タイトル", meta.titles, LIMIT_TITLE);
  checkTextSection("説明", meta.descriptions, LIMIT_DESCRIPTION);

  if (!meta.tags.length) {
    warn("タグが 1 つもありません");
  } else {
    const total = tagsTotalLength(meta.tags);
    const mark = total <= LIMIT_TAGS_TOTAL ? ok : ng;
    mark(`タグ: ${meta.tags.length} 個 / 合計 ${total} / ${LIMIT_TAGS_TOTAL} 文字`);
    const tooLong = meta.tags.filter((t) => t.length > 30);
    if (tooLong.length) warn(`30 文字を超えるタグがあります: ${tooLong.join(", ")}`);
  }

  head("動画ファイル");
  const video = resolveFromRepo(conf, "YT_VIDEO", "promo/youtube/video/promo.mp4");
  const shownVideo = path.relative(path.resolve(HERE, "..", ".."), video);
  if (fs.existsSync(video) && fs.statSync(video).isFile()) {
    const size = fs.statSync(video).size;
    if (size === 0) ng(`${shownVideo} が空ファイルです`);
    else ok(`${shownVideo}（${humanBytes(size)}）`);
  } else {
    ng(`${shownVideo} がありません`);
    hint("宣伝動画を書き出してこの場所に置くか、.env の YT_VIDEO でパスを指定してください");
  }

  const thumb = resolveFromRepo(conf, "YT_THUMBNAIL", "promo/youtube/thumbnail.png");
  if (fs.existsSync(thumb) && fs.statSync(thumb).isFile()) {
    const size = fs.statSync(thumb).size;
    if (size > LIMIT_THUMBNAIL_BYTES) ng(`サムネイルが ${humanBytes(size)} で 2MB を超えています`);
    else ok(`サムネイル ${path.relative(path.resolve(HERE, "..", ".."), thumb)}（${humanBytes(size)}）`);
  } else {
    warn("サムネイル画像はありません（省略可。YouTube が自動生成します）");
  }

  head("YouTube への接続");
  if (offline) {
    console.log("     --offline のため省略しました");
  } else if (!conf.YT_CLIENT_ID || !conf.YT_CLIENT_SECRET || !conf.YT_REFRESH_TOKEN) {
    ng("認証情報が揃っていないため確認できませんでした");
  } else {
    // クライアント ID が貼り間違いのときは、直した形で疎通だけ試して結果を知らせます。
    // （直った値をこちらで保存はしません。設定そのものを直してもらう必要があります）
    const repaired = CLIENT_ID_FORM.test(conf.YT_CLIENT_ID) ? null : repairClientId(conf.YT_CLIENT_ID);
    const probe = repaired ? { ...conf, YT_CLIENT_ID: repaired } : conf;
    if (repaired) console.log("     （貼り間違いを直した値で試します）");
    try {
      const token = await accessTokenFrom(probe);
      ok("アクセストークンを取得できました");
      const channel = await myChannel(token);
      if (!channel) {
        ng("このアカウントに YouTube チャンネルがありません");
        hint("YouTube でチャンネルを作成してから、もう一度 auth をやり直してください");
      } else {
        ok(`チャンネル: ${channel.snippet.title}（${channel.id}）`);
        if (!channel.contentDetails?.relatedPlaylists) warn("アップロード先プレイリストを確認できませんでした");
        if (repaired) {
          hint("疎通は取れました。あとは YT_CLIENT_ID を上の正しい値に直すだけです");
        }
      }
    } catch (e) {
      ng(e.message);
      if (e.status === 400 || e.status === 401) {
        hint("更新トークンが失効している可能性があります。node youtube/yt.mjs auth をやり直してください");
      }
    }
  }

  head("結果");
  if (ngCount === 0) {
    console.log(`問題なし（警告 ${warnCount} 件）。node youtube/yt.mjs upload で投稿できます。`);
  } else {
    console.log(`NG ${ngCount} 件 / 警告 ${warnCount} 件。上の NG を直してから upload してください。`);
  }
  process.exit(ngCount === 0 ? 0 : 1);
}

// 「雛形の前後にそのまま貼ってしまった」形の壊れ方だけを直して見せます（保存はしません）。
function repairClientId(raw) {
  const SUFFIX = ".apps.googleusercontent.com";
  const original = String(raw).trim();
  let v = original;
  while (v.endsWith(SUFFIX + SUFFIX)) v = v.slice(0, -SUFFIX.length);
  let local = v.endsWith(SUFFIX) ? v.slice(0, -SUFFIX.length) : v;
  const dup = /^([0-9]+)-\1-(.+)$/.exec(local); // 先頭のプロジェクト番号が二重
  if (dup) local = `${dup[1]}-${dup[2]}`;
  const fixed = local + SUFFIX;
  if (fixed === original) return null;
  return /^[0-9]+-[0-9a-z]+\.apps\.googleusercontent\.com$/.test(fixed) ? fixed : null;
}

function checkTextSection(name, blocks, limit) {
  if (!blocks.length) {
    ng(`${name}: metadata.md にコードブロックが見つかりません`);
    return;
  }
  blocks.forEach((body, i) => {
    const label = i === 0 ? `${name}（投稿に使う方）` : `${name}（案${i + 1}・未使用）`;
    const n = body.length;
    if (n > limit) ng(`${label}: ${n} / ${limit} 文字`);
    else ok(`${label}: ${n} / ${limit} 文字`);
    if (i === 0 && /[<>]/.test(body)) {
      ng(`${label}: < と > は YouTube に拒否されます。取り除いてください`);
    }
  });
}

// ---------------------------------------------------------------- auth

async function cmdAuth() {
  const conf = loadEnv();
  if (!conf.YT_CLIENT_ID || !conf.YT_CLIENT_SECRET) {
    die("YT_CLIENT_ID と YT_CLIENT_SECRET を promo/youtube/.env に設定してから実行してください。");
  }

  // インストール型アプリの推奨手順（ループバック + PKCE）で認可コードを受け取ります。
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const state = crypto.randomBytes(16).toString("hex");

  const server = http.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const redirectUri = `http://127.0.0.1:${port}`;

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", conf.YT_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPES.join(" "));
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("state", state);

  console.log("次の URL をブラウザで開いて、動画を上げたい Google アカウントでログインしてください。\n");
  console.log(authUrl.toString());
  console.log("\n（ログインが済むとこのコマンドが自動で続きます。中断するときは Ctrl+C）");

  const code = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("5 分以内に認可が完了しませんでした。")), 5 * 60 * 1000);
    server.on("request", (req, res) => {
      const url = new URL(req.url, redirectUri);
      const reply = (msg) => {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`<html><body style="font-family:sans-serif"><p>${msg}</p></body></html>`);
      };
      if (url.searchParams.get("error")) {
        reply("許可されませんでした。ターミナルに戻ってください。");
        clearTimeout(timer);
        reject(new Error(`認可が拒否されました: ${url.searchParams.get("error")}`));
        return;
      }
      const got = url.searchParams.get("code");
      if (!got) return reply("このタブは閉じて構いません。");
      if (url.searchParams.get("state") !== state) {
        reply("state が一致しませんでした。もう一度やり直してください。");
        clearTimeout(timer);
        reject(new Error("state が一致しませんでした。"));
        return;
      }
      reply("認可できました。このタブを閉じて、ターミナルに戻ってください。");
      clearTimeout(timer);
      resolve(got);
    });
  }).finally(() => server.close());

  const token = await fetchJson(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: conf.YT_CLIENT_ID,
        client_secret: conf.YT_CLIENT_SECRET,
        code,
        code_verifier: verifier,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    },
    "トークンの交換",
  );

  if (!token.refresh_token) {
    die("更新トークンが返りませんでした。Google アカウントのアプリ連携から一度解除して、やり直してください。");
  }
  saveEnvValue("YT_REFRESH_TOKEN", token.refresh_token);
  console.log("\nYT_REFRESH_TOKEN を promo/youtube/.env に保存しました。");

  const channel = await myChannel(token.access_token);
  if (channel) console.log(`ログイン先チャンネル: ${channel.snippet.title}（${channel.id}）`);
  console.log("node youtube/yt.mjs check で最終確認できます。");
}

// ---------------------------------------------------------------- upload

async function cmdUpload(argv) {
  const conf = loadEnv();
  const dryRun = argv.includes("--dry-run");

  const privacyArg = valueOf(argv, "--privacy");
  const privacy = privacyArg || conf.YT_PRIVACY || "private";
  if (!PRIVACY_VALUES.includes(privacy)) {
    die(`--privacy は ${PRIVACY_VALUES.join(" / ")} のいずれかです（受け取った値: ${privacy}）`);
  }

  const videoArg = valueOf(argv, "--video");
  const video = videoArg
    ? path.resolve(process.cwd(), videoArg)
    : resolveFromRepo(conf, "YT_VIDEO", "promo/youtube/video/promo.mp4");
  if (!fs.existsSync(video) || !fs.statSync(video).isFile()) {
    die(`動画ファイルが見つかりません: ${video}`);
  }
  const size = fs.statSync(video).size;
  if (size === 0) die(`動画ファイルが空です: ${video}`);

  if (conf.YT_CLIENT_ID && !/^[0-9]+-[0-9a-z]+\.apps\.googleusercontent\.com$/.test(conf.YT_CLIENT_ID)) {
    const fixed = repairClientId(conf.YT_CLIENT_ID);
    die(
      `YT_CLIENT_ID の形が正しくありません。${
        fixed ? `「${fixed}」の貼り間違い（前後の重複）に見えます。` : ""
      }設定を直してから、もう一度 check してください。`,
    );
  }

  const meta = parseMetadata();
  if (!meta.title) die("metadata.md の「タイトル」が読めませんでした。");
  if (!meta.description) die("metadata.md の「説明」が読めませんでした。");
  if (meta.title.length > LIMIT_TITLE) die(`タイトルが ${meta.title.length} 文字で上限 ${LIMIT_TITLE} を超えています。`);
  if (meta.description.length > LIMIT_DESCRIPTION) {
    die(`説明が ${meta.description.length} 文字で上限 ${LIMIT_DESCRIPTION} を超えています。`);
  }
  if (tagsTotalLength(meta.tags) > LIMIT_TAGS_TOTAL) {
    die(`タグの合計が ${tagsTotalLength(meta.tags)} 文字で上限 ${LIMIT_TAGS_TOTAL} を超えています。`);
  }

  const body = {
    snippet: {
      title: meta.title,
      description: meta.description,
      tags: meta.tags,
      categoryId: conf.YT_CATEGORY_ID || "20", // 20 = Gaming
      defaultLanguage: "ja",
      defaultAudioLanguage: "ja",
    },
    status: {
      privacyStatus: privacy,
      selfDeclaredMadeForKids: false,
    },
  };

  console.log(`動画      : ${video}（${humanBytes(size)}）`);
  console.log(`タイトル  : ${meta.title}`);
  console.log(`タグ      : ${meta.tags.join(", ") || "(なし)"}`);
  console.log(`公開設定  : ${privacy}`);

  if (dryRun) {
    console.log("\n--dry-run のため、ここで終了します（送信していません）。");
    return;
  }

  const token = await accessTokenFrom(conf);

  // 1) セッションを開始して、送信先 URL を受け取ります。
  const start = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": String(size),
        "X-Upload-Content-Type": "video/*",
      },
      body: JSON.stringify(body),
    },
  );
  if (!start.ok) {
    die(`アップロードの開始に失敗しました (HTTP ${start.status}): ${(await start.text()).slice(0, 500)}`);
  }
  const session = start.headers.get("location");
  if (!session) die("アップロード先 URL (Location) が返りませんでした。");

  // 2) 本体を送ります。途中で切れた場合は送信済みバイト数を問い合わせて続きから再開します。
  console.log("\nアップロード中…");
  let offset = 0;
  let video_id = null;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const res = await fetch(session, {
        method: "PUT",
        duplex: "half",
        headers: {
          "Content-Length": String(size - offset),
          "Content-Range": `bytes ${offset}-${size - 1}/${size}`,
        },
        body: Readable.toWeb(fs.createReadStream(video, { start: offset })),
      });
      if (res.ok) {
        video_id = (await res.json()).id;
        break;
      }
      if (res.status < 500) {
        die(`アップロードに失敗しました (HTTP ${res.status}): ${(await res.text()).slice(0, 500)}`);
      }
      await res.text();
    } catch (e) {
      if (attempt === 5) die(`アップロードに失敗しました: ${e.message}`);
    }

    // 再開位置を問い合わせます。
    const wait = 2 ** attempt;
    console.log(`  中断しました。${wait} 秒後に再開します（${attempt}/5 回目）`);
    await new Promise((r) => setTimeout(r, wait * 1000));
    const probe = await fetch(session, {
      method: "PUT",
      headers: { "Content-Length": "0", "Content-Range": `bytes */${size}` },
    });
    if (probe.status === 200 || probe.status === 201) {
      video_id = (await probe.json()).id;
      break;
    }
    const range = probe.headers.get("range");
    offset = range ? Number(range.split("-")[1]) + 1 : 0;
  }
  if (!video_id) die("アップロードを完了できませんでした。");

  console.log(`\n完了しました: https://youtu.be/${video_id}`);
  console.log(`YouTube Studio: https://studio.youtube.com/video/${video_id}/edit`);

  // 3) サムネイルがあれば続けて設定します。
  const thumb = valueOf(argv, "--thumbnail")
    ? path.resolve(process.cwd(), valueOf(argv, "--thumbnail"))
    : resolveFromRepo(conf, "YT_THUMBNAIL", "promo/youtube/thumbnail.png");
  if (thumb && fs.existsSync(thumb) && fs.statSync(thumb).isFile()) {
    const tSize = fs.statSync(thumb).size;
    if (tSize > LIMIT_THUMBNAIL_BYTES) {
      console.log(`サムネイルは ${humanBytes(tSize)} で 2MB を超えるため設定を飛ばしました。`);
    } else {
      const res = await fetch(
        `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${video_id}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": thumb.endsWith(".png") ? "image/png" : "image/jpeg",
            "Content-Length": String(tSize),
          },
          body: fs.readFileSync(thumb),
        },
      );
      if (res.ok) console.log("サムネイルを設定しました。");
      else console.log(`サムネイルの設定に失敗しました (HTTP ${res.status})。YouTube Studio から手で設定してください。`);
    }
  }

  if (privacy === "private") {
    console.log("\nいまは限定公開（private）です。確認できたら YouTube Studio で公開に切り替えてください。");
  }
}

function valueOf(argv, flag) {
  const i = argv.indexOf(flag);
  if (i === -1) return null;
  const v = argv[i + 1];
  if (!v || v.startsWith("--")) die(`${flag} には値が必要です。`);
  return v;
}

// ---------------------------------------------------------------- metadata

function cmdMetadata() {
  const meta = parseMetadata();
  console.log(
    JSON.stringify(
      {
        title: meta.title,
        titleLength: meta.title ? meta.title.length : 0,
        description: meta.description,
        descriptionLength: meta.description ? meta.description.length : 0,
        tags: meta.tags,
        tagsTotalLength: tagsTotalLength(meta.tags),
      },
      null,
      2,
    ),
  );
}

// ---------------------------------------------------------------- 入口

const USAGE = `使い方: node youtube/yt.mjs <コマンド>

  check [--offline]   いまアップロードできる状態か確かめる（--offline で通信を省略）
  auth                ブラウザでログインして更新トークンを .env に保存する
  upload [--dry-run] [--video <path>] [--privacy <private|unlisted|public>] [--thumbnail <path>]
                      metadata.md の内容で動画を投稿する
  metadata            metadata.md を解釈した結果を JSON で表示する
`;

const [, , command, ...rest] = process.argv;

try {
  switch (command) {
    case "check":
      await cmdCheck(rest);
      break;
    case "auth":
      await cmdAuth();
      break;
    case "upload":
      await cmdUpload(rest);
      break;
    case "metadata":
      cmdMetadata();
      break;
    case undefined:
    case "-h":
    case "--help":
    case "help":
      console.log(USAGE);
      break;
    default:
      console.error(`不明なコマンド: ${command}\n`);
      console.error(USAGE);
      process.exit(2);
  }
} catch (e) {
  die(e.message);
}
