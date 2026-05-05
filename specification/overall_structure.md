# 全体構造

## 1. レイヤー構成

```txt
UI層
	↓
通信層
	↓
サーバーAPI層
	↓
アプリケーション層
	↓
インフラ層(DB / Storage / ffmpeg)
```

---

## 2. 各層の責務

### UI層

* 画面表示
* 進捗表示
* テーマ切替
* PWA のインストール導線

### 通信層

* auth / upload / files / admin API 呼び出し
* session_token の付与
* public ファイル取得時の認証ヘッダ省略
* 再送時のアップロード状態確認

### サーバーAPI層

* リクエスト検証
* 認証、認可
* file_id ベースのルーティング
* レスポンス整形

### アプリケーション層

* アップロード開始時の files レコード先行作成
* chunk 受信、欠番確認、結合
* status 遷移管理
* フォルダ一覧や ZIP 対象解決

### インフラ層

* DB 永続化
* ローカルストレージ保存
* ffmpeg 実行
* 一時領域掃除

---

## 3. 主要データの流れ

### ログイン

1. login_token を送信する
2. session_token を発行する
3. 以降は session_token で保護APIを呼ぶ

### アップロード

1. upload/init で file_id と upload_id を発行する
2. files に uploading レコードを先行作成する
3. chunk を並列送信する
4. complete 後に processing へ遷移する
5. 非同期処理完了後に ready へ遷移する

### ファイル閲覧

1. /file/{file_id} を基点にページを開く
2. public = true の取得系APIは認証なしでも利用可能
3. public = false の取得系APIは session_token が必要

---

## 4. フォルダ設計の扱い

* folders テーブル方式を第一候補とする
* upload_batch 方式、仮想グループ方式も候補として file_service.md に併記する
* 最終採用案が決まるまでは files 側で folder_id または同等の参照を保持できる設計にする

---

## 5. PWAの扱い

* PWAは UI の高速再訪問とインストール性を高めるために使う
* 業務データやファイル本体を持つための仕組みとしては使わない
* オフライン完全対応は対象外とする
