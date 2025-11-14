# Threads_Post_Project（GAS で Threads 予約投稿）

Google Apps Script（GAS）で、スプレッドシートの予約行を Threads へ自動投稿します。`clasp` を用いたローカル開発・デプロイに対応しています。

## 機能概要
- スプレッドシート `Posts` の予約データ（投稿日・スロット・本文）を監視し、当日の指定スロット時刻で自動投稿
- 画像添付対応（最大10枚、公開URLまたはDriveファイル）
- 投稿後のインサイト自動集計（エンゲージメント数）
- 成否をシートへ記録
- 二重起動防止（Lock）と連投間隔（1.5秒）を実装

## ディレクトリ構成
```
Threads_Post_Project/
├── .clasp.json         # clasp 設定（scriptId, rootDir=src）
├── .claspignore        # push 対象のフィルタ
├── README.md
└── src/                # push 対象（rootDir）
    ├── appsscript.json # GAS マニフェスト
    ├── config.gs       # 設定/共通ユーティリティ
    ├── threads.gs      # Threads API への投稿処理
    ├── scheduler.gs    # 予約投稿スケジューラ本体
    └── sheet.gs        # シート読み書き
```

## 前提
- Node.js / npm がインストール済み
- Google アカウント（Apps Script 利用権限）
- Threads API（Meta/Facebook Developer アカウント）と以下の認証情報
  - THREADS_ACCESS_TOKEN（OAuth 2.0 アクセストークン）
  - THREADS_USER_ID（Threads ユーザーID）
- Google スプレッドシート（シート名: `Posts`）

## Threads API のセットアップ
1. [Meta for Developers](https://developers.facebook.com/) にアクセス
2. アプリを作成し、Threads API の権限を取得
3. OAuth 2.0 アクセストークンを取得（`threads_basic`, `threads_content_publish` スコープが必要）
4. Threads ユーザーIDを取得

詳細は [Threads API ドキュメント](https://developers.facebook.com/docs/threads) を参照してください。

## セットアップ（clasp）
1) clasp をインストール
```bash
npm i -g @google/clasp
```

2) PATH が通っていない場合は一時的に通す（必要時）
```bash
export PATH="$(npm prefix -g)/bin:$PATH"
```

3) ログイン
```bash
clasp login
```
ブラウザで許可後、ログイン完了の表示を確認します。

4) このプロジェクトへ移動して状態確認・push
```bash
cd "/Users/kudoumasatoshi/NaTRIUM Dropbox/NaTRIUM/自社-8/mywebsite/GAS/Threads_Post_Project"
clasp status
clasp push
```
`.clasp.json` は既に `scriptId` と `rootDir: "src"` が設定済みです。差分が表示されれば `clasp push` でアップロードできます。

## スクリプトプロパティ（必須）
Apps Script の「プロジェクトのプロパティ > スクリプトのプロパティ」に以下を設定してください。
- THREADS_ACCESS_TOKEN（OAuth 2.0 アクセストークン）
- THREADS_USER_ID（Threads ユーザーID）
- SPREADSHEET_ID（対象スプレッドシートのID）

いずれかが未設定だと起動時にエラーになります。

### オプション設定
- INSIGHT_DELAY_HOURS: インサイト取得待機時間（時間単位、デフォルト24時間）。投稿後この時間経過後にインサイトを取得します。

## スプレッドシート仕様（スロット型 + 画像対応 + インサイト自動集計）
対象シート: `Posts`
- A列（投稿日）: yyyy/MM/dd（JST）
- B列（スロット）: `morning` / `noon` / `evening` / `night`（拡張可）
- C列（本文）: Threads投稿本文
- D列（投稿済）: TRUE/空（自動更新）
- E列（結果）: `OK: <threadId>` または `ERR: <message>`（自動更新）
- F列（画像）: 画像ソース（カンマ または 改行 区切り・最大10件）
  - URL 例: `https://example.com/a.jpg, https://example.com/b.png`（公開URLである必要があります）
  - Drive 例: `drive:FILE_ID1, drive:FILE_ID2`（ファイルを「リンクを知っている全員」に共有する必要があります）
- G列（インサイト取得予定時刻）: yyyy/MM/dd HH:mm:ss（自動更新、投稿成功時に記録）
- H列（インサイト結果）: エンゲージメント数（自動更新、`collectInsights()` 実行時に記録）
  - 形式: `👍<エンゲージメント数> 👁️<インプレッション数> 📊<リーチ数>`

行の例:
```
| A(2025/01/01) | B(morning) | C(新年のご挨拶) | D() | E() | F(https://.../a.jpg) | G() | H() |
```

スロット→時刻の初期マッピングは `src/config.gs` の `SLOT_TO_TIME` で定義しています（編集可）。

## トリガー設定
### 投稿トリガー（必須）
時間主導トリガーで `runScheduler` を定期実行してください（例: 1分/5分ごと）。
1. スクリプトエディタ > 時計アイコン（トリガー） > トリガーを追加
2. 実行する関数を `runScheduler` に設定
3. 時間ベースで任意の間隔を設定

### インサイト集計トリガー（推奨）
時間主導トリガーで `collectInsights` を定期実行してください（例: 1時間/6時間ごと）。
1. スクリプトエディタ > 時計アイコン（トリガー） > トリガーを追加
2. 実行する関数を `collectInsights` に設定
3. 時間ベースで任意の間隔を設定

補足: `src/appsscript.json` の `timeZone` はトリガー実行時刻の解釈に影響します。コード内では現在時刻を `Asia/Tokyo` で評価しています。トリガーの時刻も日本時間に合わせたい場合は、マニフェストの `timeZone` を `Asia/Tokyo` に変更してください。

## 主なコマンド
```bash
clasp status    # 差分の確認
clasp push      # ローカル -> Apps Script へ反映
clasp pull      # Apps Script -> ローカルへ取得
```

## テスト実行
`testThreadOnce()` を実行すると、単発のテスト投稿が可能です（本文はハードコードされています）。

## 仕組みの概要
- `scheduler.gs` の `runScheduler()` がシートの各行を走査し、「A=今日(JST)」「Bスロットの時刻 <= 現在」「未投稿」「本文あり」の行を投稿
- 画像があれば `threads.gs` で Instagram Graph API にメディアをアップロード → `media_ids` を得て Threads API `POST /v1.0/{user-id}/threads` に添付
- 成功時は D=TRUE, E=`OK: <threadId>`, G=インサイト取得予定時刻（投稿時刻 + 待機時間）、失敗時は E=`ERR: <message>`
- 連投抑止のため 1.5 秒スリープ
- `scheduler.gs` の `collectInsights()` が G列の時刻が過ぎた行のインサイトを取得し、H列に記録
- 投稿は `threads.gs` から Threads API エンドポイント `https://graph.threads.net/v1.0/{user-id}/threads` へ URLパラメータで POST
- インサイト取得は `threads.gs` から Instagram Graph API エンドポイント `GET /{thread-id}/insights` で取得
- 認証は OAuth 2.0 アクセストークンを使用（Bearer token として URLパラメータに含める）

## トラブルシュート
- clasp が見つからない: `export PATH="$(npm prefix -g)/bin:$PATH"` を実行し、`clasp -v` を確認
- 401/403 エラー: Threads API 権限（`threads_basic`, `threads_content_publish`）とトークンの有効性を確認。必要に応じて再発行
- 429（Rate limit）: 実行間隔を伸ばす、対象行数を減らす等の調整
- タイムゾーンずれ: `src/appsscript.json` の `timeZone` とシートの日時、コード内 `JPN_TZ` の整合を確認
- 画像アップロード失敗: 画像URLが公開されていることを確認。Driveファイルの場合は「リンクを知っている全員」に共有設定が必要です

## 注意
- 認証情報はスクリプトプロパティに保存し、リポジトリにコミットしないでください。
- 実運用前にテスト用シート/テストアカウントで動作確認を推奨します。
- Threads API は画像URLが公開されている必要があります。Driveファイルを使用する場合は、適切な共有設定を行ってください。
- Instagram Graph API のメディアアップロードは2段階（作成→公開）のプロセスが必要です。

## ライセンス
社内利用向け（必要に応じて記載を更新してください）。

