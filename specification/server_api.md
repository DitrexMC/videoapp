
## ■ ログイン

```
POST /auth/login
```

* login_token で認証
* session 作成 + session_token 発行

---

## ■ ログアウト（単一セッション）

```
POST /auth/logout
```

* 現在のセッション削除

---

## ■ 全ログアウト

```
POST /auth/logout_all
```

* user_id配下の全session削除

---

## ■ login_token再発行

```
POST /auth/login-token/rotate
```

* login_token 更新
* 対象ユーザーの既存 session を全削除

---

## ■ 認証方式（共通）

```
Authorization: Bearer <session_token>
```

---

# 2. セッション内部仕様（APIというより共通レイヤ）

* session_token → ハッシュ化して照合
* sessionsテーブル参照
* expires_atチェック
* last_used_at更新
* user.status = disabled の場合は拒否

---

# 3. アップロードAPI

## ■ アップロード初期化

```
POST /upload/init
```

### 役割

* file_id と uploadId 発行
* files レコード先行作成
* chunkSize決定
* 最大チャンク数返却

---

## ■ チャンク送信

```
PUT /upload/{uploadId}/{index}
```

### 役割

* チャンク保存（/tmp）
* 同一 index の再送を許可
* 並列最大20制御はクライアント側

---

## ■ アップロード完了

```
POST /upload/complete
```

### 役割

* 欠番確認
* チャンク結合
* ハッシュ生成
* status を processing に更新
* 非同期処理開始（ffmpeg等）

---

## ■ アップロード状態取得

```
GET /upload/{uploadId}/status
```

### 役割

* 受信済み chunk 確認
* アップロード再開
* upload / processing progress 取得

---

# 4. ファイルAPI（メイン）

## ■ ファイルダウンロード

```
GET /files/{id}/download
```

### 仕様

* public = true なら認証任意
* public = false なら認証必須
* public / owner / admin 判定
* storage_pathへ直接アクセス禁止

---

## ■ ZIPダウンロード（複数）

```
POST /files/zip
```

### body

```json
{
  "file_ids": ["id1", "id2"]
}
```

### 仕様

* アクセス可能ファイルのみ含める
* 非公開は除外
* 0件ならエラー
* 最大2GB制限
* 最大ファイル数制限あり
* ready 状態のファイルのみ対象

---

# 5. ファイル管理API（推定必要領域）

仕様から必要だが未明示のため「自然に必要なもの」として整理

## ■ ファイル情報取得

```
GET /files/{id}
```

### 返却

* name
* safe_name
* size
* mime_type
* owner
* public
* status
* expires_at
* created_at など

---

## ■ ファイル一覧（ユーザー）

```
GET /files
```

### 目的

* 自分のファイル一覧
* フォルダ構造表示用
* status や expires_at を含めて表示制御する

---

## ■ 公開設定変更

```
PATCH /files/{id}/public
```

```json
{
  "public": true
}
```

---

## ■ ファイル削除

```
DELETE /files/{id}
```

### 仕様

* 論理削除（is_deleted）

---

# 6. 管理者API（admin_permission.md準拠）

## ■ ユーザー管理

```
POST /admin/users
DELETE /admin/users/{user_id}
PATCH /admin/users/{user_id}/disable
PATCH /admin/users/{user_id}/enable
PATCH /admin/users/{user_id}/username
PATCH /admin/users/{user_id}/icon/reset
```

---

## ■ セッション管理

```
GET /admin/users/{user_id}/sessions
POST /admin/users/{user_id}/login-token/rotate
```

### 仕様

* login_token 再発行時は対象 user_id の既存 session を全削除する

---

## ■ ストレージ制御

```
PATCH /admin/users/{user_id}/storage-limit
PATCH /admin/users/{user_id}/file-limit
```

---

## ■ ユーザー状態管理

```
PATCH /admin/users/{user_id}/disable
PATCH /admin/users/{user_id}/enable
```

### 仕様

* disable 時は対象 user_id の既存 session を全削除してよい
* disabled ユーザーは新規ログイン不可

---

## ■ ファイル管理（管理者）

```
GET /admin/files/{id}
DELETE /admin/files/{id}
PATCH /admin/files/{id}/expire
PATCH /admin/files/{id}/public
```

---

# 7. ストリーミング / プレビュー（暗黙API）

## ■ 動画・音楽ストリーミング

```
GET /files/{id}/stream
```

### 仕様

* Range対応必須
* ffmpeg生成後データ利用

---

## ■ プレビュー取得

```
GET /files/{id}/preview
```

### 仕様

* 画像サムネ
* 動画軽量サムネ
* 音声メタ情報

---

# 8. 状態設計（共通）

```
uploading
processing
ready
expired
```

---

# 9. API設計の全体構造まとめ

```
/auth        → 認証
/upload      → アップロード処理
/files       → ファイル操作
/admin       → 管理者操作
```

---

# 10. 設計上のポイント（重要な整理）

* 認証は token のみ（session駆動）
* login_token はログイン専用、session_token はログイン状態専用
* ファイルは必ずAPI経由
* storage_pathは完全非公開
* uploadは分離（init/chunk/complete）
* 非同期処理前提（processing状態必須）
* admin操作は完全分離ルート