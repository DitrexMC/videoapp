# 認証・ユーザー管理仕様

# 1. ユーザー定義

## 1.1 ユーザー情報

| フィールド名 | 型 | 説明 |
| --- | --- | --- |
| user_id | UUID | ユーザー識別子（公開可） |
| login_token_hash | string | ログイン用トークンのハッシュ。生値は再発行時に一度だけ表示する |
| username | string | 表示名（任意変更可） |
| icon | string | プロフィール画像URL（任意変更可） |
| status | enum | active / disabled |
| created_at | datetime | 作成日時 |
| updated_at | datetime | 更新日時 |

---

## 1.2 トークン定義

| 名称 | 所属 | 用途 |
| --- | --- | --- |
| user_id | アカウント固有 | 公開可能なユーザー識別子 |
| login_token | アカウント固有 | ログイン時に入力する秘密値 |
| session_token | セッション固有 | ログイン後の認証状態を表す秘密値 |

### 補足

* login_token はアカウントに紐づく固定系の秘密値であり、必要時のみ再発行する
* session_token は各ログイン状態ごとに新規生成する
* session_token 自体の更新は行わず、必要な場合は session を破棄する

---

# 2. セッション管理

## 2.1 セッション情報

| フィールド名 | 型 | 説明 |
| --- | --- | --- |
| session_id | string | セッション識別子 |
| user_id | UUID | 対象ユーザー |
| session_token_hash | string | session_token のハッシュ |
| created_at | datetime | 作成日時 |
| last_used_at | datetime | 最終アクセス日時 |
| expires_at | datetime | 有効期限 |
| user_agent | string | クライアント情報 |
| ip_address | string | IPアドレス |

---

# 3. 認証仕様

## 3.1 ログイン

### リクエスト

```
POST /auth/login
Content-Type: application/json

{
  "login_token": "string"
}
```

### 処理

1. login_token をハッシュ化する
2. users テーブルの login_token_hash と照合する
3. 一致しない場合は認証失敗
4. status が disabled の場合は認証失敗
5. 一致した場合:
   * ランダムな session_token を生成する
   * session_token をハッシュ化して保存する
   * sessions に新規レコードを作成する

### レスポンス

```
200 OK

{
  "session_token": "string",
  "user": {
    "user_id": "uuid",
    "username": "string",
    "icon": "string",
    "status": "active"
  }
}
```

---

## 3.2 認証（共通）

### リクエストヘッダ

```
Authorization: Bearer <session_token>
```

### 処理

1. session_token をハッシュ化する
2. sessions テーブルから一致検索する
3. 存在しない場合は 401 Unauthorized
4. expires_at をチェックする
5. user を取得する
6. user.status が disabled の場合は 403 Forbidden とし、必要に応じて当該 session を削除する
7. 有効な場合は last_used_at を更新する

---

## 3.3 ログアウト

### リクエスト

```
POST /auth/logout
```

### 処理

* 現在の session を削除する

---

## 3.4 全ログアウト

### リクエスト

```
POST /auth/logout_all
```

### 処理

* user_id に紐づく session を全削除する

---

# 4. login_token 管理

## 4.1 再発行

### リクエスト

```
POST /auth/login-token/rotate
```

### 処理

* 新しいランダム文字列を生成する
* login_token_hash を更新する
* user_id に紐づく既存 session を全削除する

### 備考

* 旧 login_token は即時無効
* 旧 session_token も同時にすべて無効
* 生の login_token は更新時に一度だけ表示する

---

# 5. login_token 仕様

* ユーザー名、パスワードは廃止
* login_token のみでログインする
* login_token はユーザー側と管理者側の両方で更新可能
* サーバーは login_token のハッシュのみ保持する

---

# 6. 無効化仕様

* disabled のユーザーは新規ログイン不可
* disabled のユーザーは既存 session でも保護 API を使用不可
* 管理者が無効化した時点で既存 session を全削除してよい

---

# 7. セキュリティ仕様

* login_token はランダム生成とする
* session_token はランダム生成とする
* login_token と session_token はサーバー側でハッシュ化して保存する
* クライアントには生 token のみ保持させる
* HTTPS 前提

---

# 8. エラーレスポンス

| ステータス | 内容 |
| --- | --- |
| 401 | 認証失敗 |
| 403 | 権限なし、または無効化ユーザー |
| 404 | リソースなし |

---

# 9. 補足

* user_id は認証には使用しない
* login_token はログイン用途のみ
* session_token が唯一のセッション識別手段
* セッション1行 = 1ログイン状態
* セキュリティ上の問題があるのは把握しているが、ユーザビリティとロマンの観点からこれを採用するため、不要な変更はしない

---