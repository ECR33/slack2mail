-- supabase/tests/database/claim_email_targets_test.sql

begin;

select plan(15);

-- ============================================================
-- Fixtures
-- ============================================================

insert into public.tenants (tenant_id, name, slug)
values ('11111111-1111-1111-1111-111111111111', 'Test Tenant', 'test-tenant-claim');

insert into public.event_config (tenant_id, event_name)
values ('11111111-1111-1111-1111-111111111111', 'test-event');

-- フィルタ条件: (grade in ('1','2')) AND (class = 'A') に一致するのは data_id 1,2 の2件
insert into public.event_data (tenant_id, event_name, data_id, email_addr, event_attr, embeded_values)
values
  ('11111111-1111-1111-1111-111111111111', 'test-event', '1', 'addr1@example.com', '{"grade":"1","class":"A"}', '{"nickname":"taro"}'),
  ('11111111-1111-1111-1111-111111111111', 'test-event', '2', 'addr2@example.com', '{"grade":"2","class":"A"}', '{"nickname":"hanako"}'),
  ('11111111-1111-1111-1111-111111111111', 'test-event', '3', 'addr3@example.com', '{"grade":"3","class":"A"}', null),
  ('11111111-1111-1111-1111-111111111111', 'test-event', '4', 'addr4@example.com', '{"grade":"1","class":"B"}', null),
  ('11111111-1111-1111-1111-111111111111', 'test-event', '5', 'addr5@example.com', '{"grade":"2","class":"B"}', null);

-- フィルタ指定ありのメール(承認済み)
insert into public.emails (
  email_id, tenant_id, subject, body, event_name, event_filter,
  status, approval_channel, approval_thread_ts
)
values (
  'email-claim-test-1', '11111111-1111-1111-1111-111111111111',
  'テスト件名', 'テスト本文', 'test-event',
  '[{"column_name":"grade","column_value":"1"},{"column_name":"grade","column_value":"2"},{"column_name":"class","column_value":"A"}]',
  'approved', 'C0000001', 'T0000001'
);

-- フィルタなし(全件対象)のメール
insert into public.emails (
  email_id, tenant_id, subject, body, event_name, event_filter,
  status, approval_channel, approval_thread_ts
)
values (
  'email-claim-test-2', '11111111-1111-1111-1111-111111111111',
  'テスト件名2', 'テスト本文2', 'test-event',
  null,
  'approved', 'C0000002', 'T0000002'
);

-- ============================================================
-- 1. 権限チェック: service_role以外は拒否される
-- ============================================================

select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$ select public.claim_and_expand_email_targets(
       '11111111-1111-1111-1111-111111111111'::uuid, 'email-claim-test-1', 'test-event', null
     ) $$,
  'claim_and_expand_email_targets is only allowed for service_role callers',
  'authenticatedロールからのclaim_and_expand_email_targets呼び出しは拒否される'
);

select throws_ok(
  $$ select public.claim_pending_sent_targets(
       '11111111-1111-1111-1111-111111111111'::uuid, 'email-claim-test-1'
     ) $$,
  'claim_pending_sent_targets is only allowed for service_role callers',
  'authenticatedロールからのclaim_pending_sent_targets呼び出しは拒否される'
);

-- 以後はservice_roleとして実行する
select set_config('request.jwt.claim.role', 'service_role', true);

-- ============================================================
-- 2. claim_and_expand_email_targets: フィルタ一致・実値コピーの検証
-- ============================================================

create temporary table t_claim1 as
select
  (result->>'claimed')::boolean as claimed,
  result->'targets' as targets
from (
  select public.claim_and_expand_email_targets(
    '11111111-1111-1111-1111-111111111111'::uuid, 'email-claim-test-1', 'test-event',
    '[{"column_name":"grade","column_value":"1"},{"column_name":"grade","column_value":"2"},{"column_name":"class","column_value":"A"}]'::jsonb
  ) as result
) s;

select ok(
  (select claimed from t_claim1),
  '1回目のclaimはclaimed=trueになる'
);

select is(
  (select jsonb_array_length(targets) from t_claim1),
  2,
  'フィルタ(grade in (1,2) AND class=A)に一致するevent_dataは2件展開される'
);

select is(
  (select status from public.emails where email_id = 'email-claim-test-1'),
  'expanded',
  'claim後にemails.statusはexpandedへ遷移する'
);

select is(
  (select count(*)::int from public.sent_emails where email_id = 'email-claim-test-1'),
  2,
  'sent_emailsへ2件だけ展開される(フィルタに一致しない3件は展開されない)'
);

select is(
  (select array_agg(event_email_addr order by event_email_addr) from public.sent_emails where email_id = 'email-claim-test-1'),
  array['addr1@example.com', 'addr2@example.com'],
  '展開された宛先が期待通り(addr1, addr2)である'
);

select is(
  (select embeded_values from public.sent_emails where email_id = 'email-claim-test-1' and event_email_addr = 'addr1@example.com'),
  '{"nickname":"taro"}'::jsonb,
  'embeded_valuesがevent_dataの実値としてコピーされる'
);

select is(
  (select status from public.sent_emails where email_id = 'email-claim-test-1' limit 1),
  'approved',
  '展開直後のsent_emailsはapproved(未送信)状態である'
);

-- ============================================================
-- 3. claim_and_expand_email_targets: 二重展開防止(同じemailを再度claim)
-- ============================================================

create temporary table t_claim1_retry as
select
  (result->>'claimed')::boolean as claimed,
  result->'targets' as targets
from (
  select public.claim_and_expand_email_targets(
    '11111111-1111-1111-1111-111111111111'::uuid, 'email-claim-test-1', 'test-event',
    '[{"column_name":"grade","column_value":"1"},{"column_name":"grade","column_value":"2"},{"column_name":"class","column_value":"A"}]'::jsonb
  ) as result
) s;

select ok(
  not (select claimed from t_claim1_retry),
  'status=sendingになったemailを再度claimしようとするとclaimed=falseになる(二重展開防止)'
);

select is(
  (select count(*)::int from public.sent_emails where email_id = 'email-claim-test-1'),
  2,
  '再claimしてもsent_emailsは増えない(重複展開されない)'
);

-- ============================================================
-- 4. claim_and_expand_email_targets: フィルタなし(全件対象)の検証
-- ============================================================

create temporary table t_claim2 as
select
  (result->>'claimed')::boolean as claimed,
  result->'targets' as targets
from (
  select public.claim_and_expand_email_targets(
    '11111111-1111-1111-1111-111111111111'::uuid, 'email-claim-test-2', 'test-event', null
  ) as result
) s;

select is(
  (select jsonb_array_length(targets) from t_claim2),
  5,
  'フィルタ指定なしの場合はevent_dataの全件(5件)が展開される'
);

-- ============================================================
-- 5. claim_pending_sent_targets: 宛先単位の原子的claimの検証
-- ============================================================

create temporary table t_pending1 as
select * from public.claim_pending_sent_targets(
  '11111111-1111-1111-1111-111111111111'::uuid, 'email-claim-test-1'
);

select is(
  (select count(*)::int from t_pending1),
  2,
  '1回目のclaim_pending_sent_targetsはapproved状態の2件をすべて取得する'
);

select is(
  (select count(*)::int from public.sent_emails where email_id = 'email-claim-test-1' and status = 'sending'),
  2,
  'claim後、対象行はDB上でsending状態に更新されている'
);

create temporary table t_pending1_retry as
select * from public.claim_pending_sent_targets(
  '11111111-1111-1111-1111-111111111111'::uuid, 'email-claim-test-1'
);

select is(
  (select count(*)::int from t_pending1_retry),
  0,
  '2回目のclaim_pending_sent_targetsは対象なし(0件)を返す(二重送信防止)'
);

select * from finish();
-- commit;
rollback;