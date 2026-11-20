-- イベントメールアドレスの無効化(ダミー化)をテナント単位・イベント単位に制限する
--
-- 旧 randomize_emails() は引数も tenant_id条件も is_member_of_tenant チェックを持たず、
-- SECURITY DEFINER で RLS の tenant_isolation_* ポリシーを通せず、
-- 1テナントの操作が他テナントの event_data のメールアドレスも無効化していました。
--
-- 新しいsignature:
--   randomize_emails(p_tenant_id uuid, p_event_names text[] default null)
--     - p_tenant_id 必須(テナント会員のみ実行可能)
--     - p_event_names が NULL または 空配列 のときはそのテナントの全イベントを対象
--     - 戻り値はイベント単位の変更件数
--     - email_addr が空の行は変更しない

DROP FUNCTION IF EXISTS "public"."randomize_emails"();

CREATE OR REPLACE FUNCTION "public"."randomize_emails"("p_tenant_id" uuid, "p_event_names" text[] DEFAULT NULL) RETURNS TABLE("event_name" text, "changed" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$#variable_conflict use_column
declare
  target_events text[];
begin
  if p_tenant_id is null then
    raise exception 'p_tenant_id is required';
  end if;

  if not public.is_member_of_tenant(p_tenant_id) then
    raise exception 'not authorized to modify event data of this tenant';
  end if;

  -- NULL・空配列は「そのテナントの全イベント」として扱う(APIのeventNamesと同じ解釈)
  if coalesce(array_length(p_event_names, 1), 0) = 0 then
    target_events := null;
  else
    target_events := p_event_names;
  end if;

  return query
  with randomized as (
    update public.event_data
    set email_addr = lower(substring(md5(random()::text), 1, 8)) || '@example.com'
    where tenant_id = p_tenant_id
      and (target_events is null or event_name = any(target_events))
      and coalesce(email_addr, '') <> ''
    returning event_name
  )
  select r.event_name, count(*)::integer as changed
  from randomized r
  group by r.event_name;
end;$$;


ALTER FUNCTION "public"."randomize_emails"("p_tenant_id" uuid, "p_event_names" text[]) OWNER TO "postgres";

COMMENT ON FUNCTION "public"."randomize_emails"("p_tenant_id" uuid, "p_event_names" text[]) IS '指定テナント(任意で指定イベント)のevent_dataのメールアドレスを無効な値に置き換える。イベント単位の変更件数を返す';


GRANT ALL ON FUNCTION "public"."randomize_emails"("p_tenant_id" uuid, "p_event_names" text[]) TO "authenticated";

GRANT ALL ON FUNCTION "public"."randomize_emails"("p_tenant_id" uuid, "p_event_names" text[]) TO "service_role";
