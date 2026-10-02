/**
 * Filebase の鍵を 1Password の item JSON にして標準出力に流す。
 *
 *   print -r -- "$KEY\n$SECRET" | node scripts/setup/new-filebase.mjs <bucket> <title> \
 *     | op item create --vault=<vault> -
 *
 * 値は **標準入力**で受け取る。コマンドライン引数にすると `ps` で他のプロセスから
 * 見え、シェル履歴にも残るため (1Password 自身が argv を避けるよう警告している)。
 * 標準出力はそのまま op のパイプに入るので、端末には出ない。
 */
const bucket = process.argv[2];
const title = process.argv[3] ?? 'genji-witness filebase';
if (!bucket) throw new Error('bucket 名を渡してください');

let input = '';
for await (const chunk of process.stdin) input += chunk;
const [accessKey, secretKey] = input.split('\n').map((s) => s.trim());
if (!accessKey || !secretKey) throw new Error('Access Key と Secret Key を 2 行で渡してください');

process.stdout.write(JSON.stringify({
  title,
  category: 'API_CREDENTIAL',
  fields: [
    {id: 'username', type: 'STRING', label: 'access_key', value: accessKey},
    {id: 'credential', type: 'CONCEALED', label: 'secret_key', value: secretKey},
    {type: 'STRING', label: 'bucket', value: bucket},
    {type: 'STRING', label: 'endpoint', value: 'https://s3.filebase.com'},
    {id: 'notesPlain', type: 'STRING', purpose: 'NOTES', label: 'notesPlain',
      value: 'genji-witness の IPFS 置き場 (Filebase 無料枠)。'
        + ' scripts/08-ipfs.mjs が op run 経由で使う。'
        + ' ここに上げたものは後から消せる (取り消せないのは Arweave のほう)。'},
  ],
}));
process.stderr.write(`  access_key ${accessKey.slice(0, 6)}… / bucket ${bucket}\n`);
