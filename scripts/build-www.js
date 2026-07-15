// index.html はWeb(GitHub Pages)とAndroid/iOSアプリ(Capacitor)の共有ソース。
// このスクリプトはアプリのビルド直前に www/ へ静的資産をコピーするだけで、
// index.html自体はコピーするのみ(中身の書き換えはしない。Web/アプリの分岐は
// index.html内のwindow.Capacitor判定で実行時に行われる)。
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const WWW = path.join(ROOT, "www");

fs.rmSync(WWW, { recursive: true, force: true });
fs.mkdirSync(WWW, { recursive: true });

for (const file of ["index.html", "privacy.html", "terms.html"]) {
  fs.copyFileSync(path.join(ROOT, file), path.join(WWW, file));
}

fs.cpSync(path.join(ROOT, "images"), path.join(WWW, "images"), { recursive: true });

console.log("www/ built from index.html + images/ + privacy.html + terms.html");
