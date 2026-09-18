BEGIN;
CREATE extension IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(20);
-- =========================================================
-- 1. テスト用ログインユーザーを直接作成(ローカル専用)
--    実際のGoogle OAuthを経由せず、auth.usersに直接INSERTすることで
--    「Googleログイン済みでauth.uid()が取得できる状態」を再現する
-- =========================================================
insert into auth.users (id, email)
values (
    'bbbbbbbb-0000-0000-0000-000000000001',
    'owner_a@example.com'
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000002',
    'member_a1@example.com'
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000003',
    'member_a2@example.com'
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000004',
    'owner_b@example.com'
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000005',
    'outsider@example.com'
  );
-- =========================================================
-- 2. テナント作成 + オーナーの事前登録
--    login-flow.md「テナント作成(当面は手動運用)」の手順を再現する。
--    ここはpostgres(管理者ロール、RLSをバイパス)で実行する想定
-- =========================================================
insert into public.tenants (tenant_id, name, slug)
values (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'PTA A',
    'pta-a'
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000002',
    'PTA B',
    'pta-b'
  );
-- オーナーはメールアドレスのみ事前登録(user_idはまだNULL)
insert into public.tenant_users (tenant_id, name, email_addr)
values (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'オーナーA',
    'owner_a@example.com'
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000002',
    'オーナーB',
    'owner_b@example.com'
  );
select ok(
    (
      select user_id
      from public.tenant_users
      where email_addr = 'owner_a@example.com'
    ) is null,
    'この時点でuser_idがNULLであること'
  );
-- =========================================================
-- 3. owner_a が初回ログイン → link_my_tenant_user() で自動紐付け
-- =========================================================
set role authenticated;
set request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000001';
select public.link_my_tenant_user();
reset role;
reset request.jwt.claim.sub;
-- 確認(postgresロールでRLSをバイパスして確認): owner_aのuser_idが埋まっているはず
select ok(
    (
      select user_id
      from public.tenant_users
      where email_addr = 'owner_a@example.com'
    ) is not null,
    'この時点でuser_idに値があること'
  );
-- =========================================================
-- 4. owner_a が役員一覧Spreadsheetの内容を同期(sync_tenant_members)
--    今回はオーナー自身・member_a1・member_a2 の3名を同期する
-- =========================================================
set role authenticated;
set request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000001';
select results_eq(
    $$
    select *
    from public.sync_tenant_members(
        'aaaaaaaa-0000-0000-0000-000000000001',
        '[
    {"email": "owner_a@example.com",  "name": "オーナーA"},
    {"email": "member_a1@example.com", "name": "メンバーA1"},
    {"email": "member_a2@example.com", "name": "メンバーA2"}
  ]'::jsonb
      ) $$,
      $$
    values ('synced', 'owner_a@example.com'),
      ('synced', 'member_a1@example.com'),
      ('synced', 'member_a2@example.com') $$,
      'action=synced が3件返る(全員新規または既存)'
  );
reset role;
reset request.jwt.claim.sub;
-- 確認(postgresロール): tenant Aに3件登録されていること。member_a1/a2はまだuser_id NULL
select results_eq(
    $$
    select tenant_id,
      name,
      email_addr,
      user_id
    from public.tenant_users
    where tenant_id = 'aaaaaaaa-0000-0000-0000-000000000001'
    order by email_addr $$,
      $$
    values (
        'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
        'メンバーA1',
        'member_a1@example.com',
        NULL
      ),
      (
        'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
        'メンバーA2',
        'member_a2@example.com',
        NULL
      ),
      (
        'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
        'オーナーA',
        'owner_a@example.com',
        'bbbbbbbb-0000-0000-0000-000000000001'::uuid
      ) $$,
      '確認(postgresロール): tenant Aに3件登録されていること。member_a1/a2はまだuser_id NULL'
  );
-- =========================================================
-- 5. member_a1 が初回ログイン
-- =========================================================
set role authenticated;
set request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';
select public.link_my_tenant_user();
reset role;
reset request.jwt.claim.sub;
select results_eq(
    $$
    select tenant_id,
      email_addr,
      user_id
    from public.tenant_users
    where email_addr = 'member_a1@example.com' $$,
      $$
    values (
        'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
        'member_a1@example.com',
        'bbbbbbbb-0000-0000-0000-000000000002'::uuid
      ) $$,
      '確認: member_a1のuser_idがtenant Aで埋まっていること'
  );
-- =========================================================
-- 6. 横展開(横のリンク)の確認
--    tenant BのオーナーがSpreadsheet同期で member_a1 を招待する。
--    member_a1は既にtenant Aでログイン済み(user_id確定済み)なので、
--    tenant B側では再ログイン不要でuser_idがそのまま流用されるはず
-- =========================================================
-- 6-1. owner_bが初回ログイン
set role authenticated;
set request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000004';
select public.link_my_tenant_user();
-- 6-2. owner_bがtenant Bのメンバーを同期(自分 + member_a1)
select *
from public.sync_tenant_members(
    'aaaaaaaa-0000-0000-0000-000000000002',
    '[
    {"email": "owner_b@example.com",   "name": "オーナーB"},
    {"email": "member_a1@example.com", "name": "メンバーA1(兼務)"}
  ]'::jsonb
  );
reset role;
reset request.jwt.claim.sub;
select results_eq(
    $$
    select tenant_id,
      email_addr,
      user_id
    from public.tenant_users
    where email_addr = 'member_a1@example.com'
    order by tenant_id $$,
      $$
    values (
        'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
        'member_a1@example.com',
        'bbbbbbbb-0000-0000-0000-000000000002'::uuid
      ),
      (
        'aaaaaaaa-0000-0000-0000-000000000002'::uuid,
        'member_a1@example.com',
        'bbbbbbbb-0000-0000-0000-000000000002'::uuid
      ) $$,
      '確認: tenant B側のmember_a1行にも、ログインなしでuser_idが入っているはず(横展開が機能している証拠)'
  );
-- =========================================================
-- 7. テナント境界(RLS)の確認
--    owner_a が tenant B のデータにアクセスできないことを確認する
-- =========================================================
set role authenticated;
set request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000001';
-- 7-1. tenant Bのtenant_usersは見えないはず(0件)
select ok(
    (
      select count(*) as should_be_zero
      from public.tenant_users
      where tenant_id = 'aaaaaaaa-0000-0000-0000-000000000002'
    ) = 0,
    'tenant Bのtenant_usersは見えないはず(0件)'
  );
-- 7-2. tenant Bに対してsync_tenant_membersを呼んでも拒否されるはず(例外が発生する)
select throws_ok(
    $$
    select *
    from public.sync_tenant_members(
        'aaaaaaaa-0000-0000-0000-000000000002',
        '[]'::jsonb
      ) $$,
      'P0001',
      'not authorized to modify members of this tenant'
  );
reset role;
reset request.jwt.claim.sub;
-- =========================================================
-- 8. tenant_usersのself-selectポリシーの確認
--    「自分の行しか見えない」設計のため、owner_aとしてtenant Aを検索しても
--    自分自身の1行しか返らないことを確認する(他の2名は見えない)
-- =========================================================
set role authenticated;
set request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000001';
select results_eq(
    $$
    select tenant_id,
      email_addr
    from public.tenant_users
    where tenant_id = 'aaaaaaaa-0000-0000-0000-000000000001';
$$,
$$
values (
    'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
    'owner_a@example.com'
  ) $$,
  '期待結果: owner_a自身の1行のみ(member_a1/a2は見えない)'
);
reset role;
reset request.jwt.claim.sub;
-- =========================================================
-- 9. Google Service Account登録(Vault連携)の確認
-- =========================================================
set role authenticated;
set request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000001';
-- 9-1. ダミーのサービスアカウントJSONを登録
select public.upsert_tenant_google_credential(
    'aaaaaaaa-0000-0000-0000-000000000001',
    '{
    "client_email": "sa-tenant-a@dummy-project.iam.gserviceaccount.com",
    "private_key_id": "dummy-key-id-12345",
    "private_key": "-----BEGIN PRIVATE KEY-----\nDUMMY\n-----END PRIVATE KEY-----\n"
  }'::jsonb
  );
-- 9-2. 登録内容の確認(private_keyは含まれず、email/鍵IDのみ見える)
select results_eq(
    $$
    select tenant_id,
      service_account_email,
      private_key_id
    from public.tenant_google_credentials
    where tenant_id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
      $$
    values (
        'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
        'sa-tenant-a@dummy-project.iam.gserviceaccount.com',
        'dummy-key-id-12345'
      ) $$,
      'google credentials 登録内容の確認'
  );
-- -- 9-3. authenticatedロールではvault.decrypted_secretsを直接読めない(権限エラーになる)ことを確認
select throws_ok(
    $$
    select *
    from vault.decrypted_secrets
    limit 1 $$, 42501, 'permission denied for schema vault'
  );
reset role;
reset request.jwt.claim.sub;
-- 9-4. service_roleでのみ復号取得できることを確認
set role service_role;
select is(
    (
      select public.get_tenant_google_credential('aaaaaaaa-0000-0000-0000-000000000001')
    ),
    '{    "client_email": "sa-tenant-a@dummy-project.iam.gserviceaccount.com",
    "private_key_id": "dummy-key-id-12345",
    "private_key": "-----BEGIN PRIVATE KEY-----\nDUMMY\n-----END PRIVATE KEY-----\n"  }'::jsonb,
    '期待結果: private_keyを含む元のJSONがそのまま返る'
  );
-- 期待結果: private_keyを含む元のJSONがそのまま返る
reset role;
-- =========================================================
-- 10. event_config / event_data の全件同期と道連れ削除(CASCADE)の確認
-- =========================================================
set role authenticated;
set request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000001';
-- 10-1. 2つのイベントを登録
select results_eq(
    $$
    select *
    from public.sync_event_configs(
        'aaaaaaaa-0000-0000-0000-000000000001',
        '[
    {"event_name": "夏祭り2026", "sheet_id": "sheet-natsu", "sheet_name": "参加者",
     "header": 1, "id_column": "ID", "email_column": "メール", "filter_columns": "学年",
     "embeded_columns": "氏名", "sender_name": "総務", "sender_email_addr": "soumu@example.com"},
    {"event_name": "総会2026", "sheet_id": "sheet-soukai", "sheet_name": "参加者",
     "header": 1, "id_column": "ID", "email_column": "メール", "filter_columns": "組",
     "embeded_columns": "氏名", "sender_name": "総務", "sender_email_addr": "soumu@example.com"}
  ]'::jsonb
      ) $$,
      $$
    values ('synced', '夏祭り2026'),
      ('synced', '総会2026') $$,
      '2つのイベントを登録'
  );
-- 10-2. それぞれのイベントに参加者データを登録
select results_eq(
    $$
    select *
    from public.sync_event_data(
        'aaaaaaaa-0000-0000-0000-000000000001',
        '夏祭り2026',
        '[
    {"data_id": "1", "email_addr": "p1@example.com", "event_attr": {"氏名": "参加者1"}},
    {"data_id": "2", "email_addr": "p2@example.com", "event_attr": {"氏名": "参加者2"}}
  ]'::jsonb
      ) $$,
      $$
    values ('synced', '1'),
      ('synced', '2') $$,
      '夏祭り2026に参加者データを登録'
  );
select results_eq(
    $$
    select *
    from public.sync_event_data(
        'aaaaaaaa-0000-0000-0000-000000000001',
        '総会2026',
        '[
    {"data_id": "1", "email_addr": "p3@example.com", "event_attr": {"氏名": "参加者3"}}
  ]'::jsonb
      ) $$,
      $$
    values('synced', '1') $$,
      '総会2026に参加者データを登録'
  );
-- 確認: 夏祭り2026に2件、総会2026に1件、合計3件のはず
select results_eq(
    $$select event_name,
    count(*)
    from public.event_data
    where tenant_id = 'aaaaaaaa-0000-0000-0000-000000000001'
    group by event_name
    order by event_name $$,
      $$
    values ('夏祭り2026', 2::bigint),
      ('総会2026', 1::bigint) $$,
      '確認: 夏祭り2026に2件、総会2026に1件、合計3件'
  );
-- 10-3. Spreadsheet(slack2mail設定ファイル)から「夏祭り2026」のシートが削除されたことを再現
--       (「総会2026」だけを含めて再度同期する)
select results_eq(
    $$select *
    from public.sync_event_configs(
        'aaaaaaaa-0000-0000-0000-000000000001',
        '[
    {"event_name": "総会2026", "sheet_id": "sheet-soukai", "sheet_name": "参加者",
     "header": 1, "id_column": "ID", "email_column": "メール", "filter_columns": "組",
     "embeded_columns": "氏名", "sender_name": "総務", "sender_email_addr": "soumu@example.com"}
  ]'::jsonb
      ) $$,
      $$
    values ('removed', '夏祭り2026'),
      ('synced', '総会2026') $$,
      '期待結果: action=removed event_name=夏祭り2026 総会2026はsynced'
  );
-- 期待結果: action=removed で event_name=夏祭り2026 が1件返る
reset role;
reset request.jwt.claim.sub;
-- 確認(postgresロール): 夏祭り2026のevent_dataがCASCADEで自動的に消えているはず(0件)
-- 総会2026のevent_dataは影響を受けず1件残っているはず
select results_eq(
    $$select event_name,
    count(*)
    from public.event_data
    where tenant_id = 'aaaaaaaa-0000-0000-0000-000000000001'
    group by event_name
    order by event_name $$,
      $$
    values ('総会2026', 1::bigint) $$,
      '夏祭り2026のevent_dataが消え、総会20261件のみ'
  );
-- =========================================================
-- 11. member_a2 がSpreadsheetから消えた場合の削除確認
-- =========================================================
set role authenticated;
set request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000001';
-- member_a2を含めずに再同期する(=Spreadsheetから退会者として削除された状態を再現)
select results_eq(
    $$select *
    from public.sync_tenant_members(
        'aaaaaaaa-0000-0000-0000-000000000001',
        '[
    {"email": "owner_a@example.com",  "name": "オーナーA"},
    {"email": "member_a1@example.com", "name": "メンバーA1"}
  ]'::jsonb
      );
$$,
$$
values ('removed', 'member_a2@example.com'),
  ('synced', 'owner_a@example.com'),
  ('synced', 'member_a1@example.com') $$,
  'member_a2を含めずに再同期する removed'
);
-- 期待結果: action=removed で email_addr=member_a2@example.com が1件返る
reset role;
reset request.jwt.claim.sub;
-- 確認(postgresロール): tenant Aのtenant_usersからmember_a2が消えていること(2件のみ)
select results_eq(
    $$select email_addr
    from public.tenant_users
    where tenant_id = 'aaaaaaaa-0000-0000-0000-000000000001'
    order by email_addr $$,
      $$
    values ('member_a1@example.com'),
      ('owner_a@example.com') $$,
      'tenant Aのtenant_usersからmember_a2が消えている'
  );
SELECT *
FROM finish();
ROLLBACK;