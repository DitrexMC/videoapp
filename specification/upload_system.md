
# 📦 ファイルアップローダー仕様書（確定版）

---

# 1. システム概要

身内〜小規模向けファイルアップロード・共有サービス。

特徴：

```txt id="s1"
・全ファイル対応
・最大5GB
・チャンクアップロード必須
・init 時に file_id ベースのURLを即発行
・非同期処理（結合・解析・プレビュー）
・完全ユーザー管理あり
・ローカルストレージ運用
```

---

# 2. ファイル仕様

## 2.1 対応ファイル

```txt id="f1"
制限なし（全形式対応）
```

---

## 2.2 サイズ制限

```txt id="f2"
最大：5GB / ファイル
```

---

# 3. アップロード方式

## 3.1 チャンク方式（必須）

```txt id="u1"
チャンクサイズ：可変（初期10MB、5MB〜50MB）
1ファイル内では固定
```

---

## 3.2 クライアント制御

```txt id="u2"
・チャンク数を超えないようqueue管理
・並列数：最大20
```

---

## 3.3 並列制御

```txt id="u3"
最大同時送信：20
```

---

# 4. API設計

## 4.1 init

```http id="a1"
POST /upload/init
```

### リクエスト例

```json
{
  "name": "movie.mp4",
  "size": 1073741824,
  "mime_type": "video/mp4",
  "chunkSize": 10485760,
  "folderContext": {
    "mode": "single"
  },
  "expiresAt": null,
  "public": true
}
```

### 処理

1. 認証済みユーザーと利用制限を確認する
2. file_id と upload_id を発行する
3. files テーブルに uploading 状態で先行レコードを作成する
4. chunkSize を決定する。未指定時は 10MB とする
5. 1ファイル内では init で確定した chunkSize を固定とする
6. 受け入れ可能な maxChunks を返す

```json id="a2"
{
  "fileId": "uuid",
  "uploadId": "uuid",
  "chunkSize": 10485760,
  "maxChunks": 512,
  "status": "uploading",
  "url": "/file/uuid"
}
```

---

## 4.2 chunk

```
PUT /upload/{uploadId}/{index}
```

### リクエスト要件

* index は 0 始まり
* 各 chunk は init で確定した chunkSize に従う
* 最終 chunk のみ chunkSize 未満を許可する
* 同一 index の再送は上書き保存を許可する

### リクエストヘッダ例

```http
Content-Type: application/octet-stream
X-File-Id: uuid
X-Chunk-Size: 10485760
X-Total-Chunks: 103
X-Total-Size: 1073741824
```

### レスポンス例

```json
{
  "received": true,
  "index": 8,
  "storedSize": 10485760
}
```

---

## 4.3 complete

```
POST /upload/complete
```

### リクエスト例

```json
{
  "fileId": "uuid",
  "uploadId": "uuid",
  "totalChunks": 103,
  "totalSize": 1073741824
}
```

### 処理

1. 受信済み chunk 一覧を確認する
2. 欠番がある場合はエラーとする
3. chunk を結合し storage_path へ移動する
4. checksum を計算する
5. status を processing に更新する
6. preview 生成などの非同期処理を開始する

### レスポンス例

```json
{
  "fileId": "uuid",
  "status": "processing",
  "missingChunks": []
}
```

---

## 4.4 status

```http
GET /upload/{uploadId}/status
```

### 用途

* 再送前に受信済み chunk を確認する
* UI の upload progress / processing progress の両方に使う

### レスポンス例

```json
{
  "fileId": "uuid",
  "uploadId": "uuid",
  "status": "uploading",
  "chunkSize": 10485760,
  "totalChunks": 103,
  "receivedChunks": [0, 1, 2, 3],
  "uploadProgress": 38,
  "processingProgress": 0
}
```

---

# 5. 状態管理

```
uploading → processing → ready → expired
```

---

## 重要仕様

```
・init 完了時点で file_id ベースURLを確定する
・processing中でもURL自体は有効
・processing中はメタ情報ページを返せるが、ダウンロード可否は status で判定する
```

---

# 6. URL設計

```
/file/{id}
```

---

## タイミング

```
init時：URL発行
copy許可：クライアント制御
complete後：status を processing に更新
ready後：通常ダウンロードとプレビューを許可
```

---

# 7. プログレス設計

## 7.1 第一段階

```
0〜100% = アップロード進捗
```

---

## 7.2 第二段階

```
0〜100% = 処理進捗（結合・ハッシュ・プレビュー）
```

---

## 7.3 UI挙動

```
100% → processing → 100%
```

（リセットではなくフェーズ切替）

---

# 8. 処理フロー

```txt id="f1"
① init
② files テーブルへ先行レコード作成
② chunk upload
③ complete
④ 欠番検証
⑤ 結合
⑥ ハッシュ
⑦ status を processing に更新
⑧ プレビュー
⑨ ready へ遷移
```

---

# 9. ストレージ設計

```
/storage/
  /ab/
    /cd/
      filehash
```

---

## 一時領域

```
/tmp/{uploadId}/chunks
```

### 補足

* 受信済み chunk の index 一覧を upload セッション側で保持する
* complete 成功後に一時領域を削除する

---

# 10. プレビュー設計

## 10.1 レベル

```
・画像：プレビュー生成
・動画：軽量プレビュー + 再生対応
・音楽：プレイヤー対応（高品質）
```

---

## 10.2 方針

```txt id="pr2"
バックグラウンドで生成
（complete後、processing中）
```

---

# 11. ストリーミング設計

## 11.1 動画/音楽

```
・HTTP Range必須
・音楽プレイヤー対応
```

---

## 11.2 クオリティ要件

```
・シーク対応
・シームレス再生
・バッファ制御
```

---

# 12. Discord対応

```
完全OGP対応
キャッシュ非依存
```

---

## 仕様

```
・URL即発行
・OGは常に更新される前提
```

### 補足

* file_id が init 時に確定しているため、OGP対象URLは初回から固定できる

---

# 13. 削除ポリシー

```
・自動期限削除
・無期限指定可能
```

---

# 14. ユーザー管理

```
完全ユーザー管理あり
```

---

## 想定

* upload制御
* file ownership
* access control

---

# 15. クライアント仕様

## 15.1 queue設計

```
・チャンクqueue管理必須
・並列20制御
```

---

## 15.2 URLコピー

```
init時生成だがコピーは制御
```

---

## 15.3 再開と再送

```txt
・通信断時は GET /upload/{uploadId}/status を参照して未受信 chunk のみ再送する
・同一 index の再送は許可する
・chunkSize は同一 file 内で変更不可
```

---

# 16. PWA 方針

## 16.1 対象範囲

* PWA で保持するのは UI シェル、テーマ、静的アセット、ログイン後の基本画面構成のみ
* ファイル一覧、詳細、進捗、セッション情報は毎回サーバーから取得する
* 大容量ファイル本体や一覧データをオフラインキャッシュしない

## 16.2 実装方針

* manifest と service worker を用意する
* 初回表示に必要な HTML / CSS / JS / アイコンのみを事前キャッシュする
* API レスポンスは原則 network-first とする
* アップロード中の chunk データ永続化までは必須要件に含めない

## 16.3 注意点

* PWA は「オフラインで全機能を使える」の意味ではない
* 今回はインストール可能なフロントUIと高速な再訪問を主目的とする
