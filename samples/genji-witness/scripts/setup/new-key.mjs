/**
 * 使い捨てのテストネット鍵をその場で作り、**1Password の item JSON を標準出力に流す**。
 *
 *   node scripts/setup/new-key.mjs "<title>" | op item create --vault=<vault> -
 *
 * 秘密鍵をディスクにもコマンドライン引数にも置かないための形。標準出力は
 * そのまま op のパイプに入るので、端末にもシェル履歴にも残らない。
 * 人が読む情報 (アドレス) は**標準エラー**に出す。
 *
 * 鍵は node:crypto の randomBytes で作り、secp256k1 の範囲に入っているかを確かめる。
 */
import {randomBytes} from 'node:crypto';
import {addressOf} from '../../lib/tx.mjs';
import {N} from '../../lib/secp256k1.mjs';

const title = process.argv[2] ?? 'genji-witness sepolia';

let priv;
for (let i = 0; i < 100; i++) {
  const buf = randomBytes(32);
  const v = BigInt('0x' + buf.toString('hex'));
  if (v > 0n && v < N) {            // 範囲外はほぼ出ないが、出たら捨てる
    priv = '0x' + buf.toString('hex');
    break;
  }
}
if (!priv) throw new Error('鍵を作れませんでした');

const address = addressOf(priv);

process.stdout.write(JSON.stringify({
  title,
  category: 'API_CREDENTIAL',
  fields: [
    {id: 'credential', type: 'CONCEALED', label: 'private_key', value: priv},
    {id: 'username', type: 'STRING', label: 'address', value: address},
    {type: 'STRING', label: 'chain', value: 'sepolia (11155111)'},
    {id: 'notesPlain', type: 'STRING', purpose: 'NOTES', label: 'notesPlain',
      value: 'genji-witness の公開テストネット用。テストネット専用で、資金価値のある鍵にしないこと。'
        + ' 署名は lib/secp256k1.mjs (一定時間ではない自前実装) が行う。'},
  ],
}));

process.stderr.write(`  作ったアドレス  ${address}\n`);
