#!/usr/bin/env node
/*
 * twa-manifest.json から Android プロジェクトを生成する。
 *
 * `bubblewrap init` は必ず対話プロンプトを出すため CI では使えない。
 * このスクリプトは bubblewrap が init の内部で呼んでいるのと同じ
 * TwaGenerator.createTwaProject() を直接叩き、あわせて
 * manifest-checksum.txt も書き出す。チェックサムが一致していれば
 * 続く `bubblewrap build` は一切プロンプトを出さずに完了する。
 *
 * 使い方: node generate-project.cjs <プロジェクトディレクトリ>
 */
const { createHash } = require('crypto');
const fs = require('fs');
const path = require('path');
const { TwaManifest, TwaGenerator, ConsoleLog } = require('@bubblewrap/core');

async function main() {
  const dir = path.resolve(process.argv[2] || '.');
  const manifestFile = path.join(dir, 'twa-manifest.json');

  if (!fs.existsSync(manifestFile)) {
    throw new Error(`twa-manifest.json が見つかりません: ${manifestFile}`);
  }

  const twaManifest = await TwaManifest.fromFile(manifestFile);

  // bubblewrap の updateProject は Play Billing 有効時に enableNotifications を必須にしている。
  // ここで先に落として、gradle まで進んでから失敗するのを防ぐ
  if (twaManifest.features && twaManifest.features.playBilling
      && twaManifest.features.playBilling.enabled && !twaManifest.enableNotifications) {
    throw new Error('Play Billing を使うには twa-manifest.json の enableNotifications を true にしてください');
  }

  console.log(`パッケージ: ${twaManifest.packageId}`);
  console.log(`起動URL   : https://${twaManifest.host}${twaManifest.startUrl}`);
  console.log(`バージョン: ${twaManifest.appVersionName} (versionCode ${twaManifest.appVersionCode})`);

  await new TwaGenerator().createTwaProject(dir, twaManifest, new ConsoleLog('generate'));

  const sum = createHash('sha1').update(fs.readFileSync(manifestFile)).digest('hex');
  fs.writeFileSync(path.join(dir, 'manifest-checksum.txt'), sum);
  console.log(`manifest-checksum.txt を書き出しました (${sum})`);
}

main().catch(e => {
  console.error(String((e && e.message) || e));
  process.exit(1);
});
