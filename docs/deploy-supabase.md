# supabaseメモ

## supabase local マイグレーションファイル作成

### 初期ファイル作成
```
supabase migration new init_schema
```
↓
```supabase/migrations/```

```[タイムスタンプ]_init_schema.sql```


### 差分データ書き込み
```
supabase db diff --local -f init_schema
```

### 現状のschemaをダンプする方法

```
supabase db dump --local -f supabase/migrations/20260718000000_combined_schema.sql
```

## supabase cloud 反映

### 本番supabaseとlink

```
supabase link --project-ref [本番のProject ID]
```

### push

```
supabase db push
```

### データも移す場合

```
supabase db dump --local --data-only > supabase/seed.sql
```

## 型定義

### 型定義ファイル生成
```
supabase gen types typescript --local > app/types/database.types.ts
```

### 型を認識したclient生成

```typescript
import { createClient } from '@supabase/supabase-js'
import { Database } from '/types/database.types'

const supabaseUrl = 'https://xxxxxxx'
const supabaseKey = 'YOUR_ANOIN_KEY'

const supabase = createClient<Database>(supabaseUrl, supabaseKey)

```

### マイグレーションファイルの統合

1. ファイルの統合
    今までの履歴を統合して新しいファイルが作成される。古いファイルは削除される

```
supabase migration squash --local
```
2. ローカルDBリセット
    ローカルのDockerコンテナ側のマイグレーション履歴もリセットしてファイルと同期させる必要がある。この際、データはクリアされる

```
supabase db reset
```


> 注意点：すでに本番（リモート）環境に適用している場合もし、統合しようとしている古いマイグレーションファイル群がすでに本番環境（Supabaseのクラウド側など）に db push 済みである場合は、少し注意が必要です。リモート側は古いファイル名で履歴を記録しているため、ローカル側だけファイルを1つにまとめて db push しようとすると「履歴が一致しない」というエラーが起きてしまいます。  もしすでに本番に適用済みのファイルをまとめたい場合は、統合後に以下のコマンドで本番側の履歴テーブルを「このファイルは適用済みだよ」とダミーで上書き（修復）してあげる必要があります。
> ```
> supabase migration repair --status applied <新しい統合ファイルのバージョン>
> ```

### データダンプと初期データ(シードデータ)の作成

seed.sqlがあると db reset した際に自動で読み込まれる


```
supabase db dump --local --data-only > supabase/seed.sql
```

#### 特定のテーブルのみダンプ

supabaseコマンドでは対応しないのでpg_dumpを使用する  
pg_dumpが環境依存しないようにsupabase内のpostgresqlコンテナ内で実行する  
また、supabase db resetで読み込めるようにINSERT文で書き出すオプション```--inserts```を指定する

```
docker exec -it <CONTAINER ID> pg_dump -U postgres --data-only --inserts -t public.reserved_slugs > supabase/seed.sql
```

書き込み後```\restrict ```で始まる行をコメントアウトしておく。supabase db resetでは```\```があるとエラーとなる。


## テスト

テストテンプレート作成

```
supabase test new verify_multitenant_flow_test
```

テスト実行

```
supabase db test
```

## psql

```
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

または

```
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres
```
パスワードはpostgres