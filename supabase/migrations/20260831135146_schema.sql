


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."check_slug_available"("p_slug" "text", "p_tenant_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_slug text := lower(coalesce(p_slug, ''));
begin
  -- 空文字
  if v_slug = '' then
    return jsonb_build_object('available', false, 'reason', 'empty');
  end if;

  -- フォーマット不正
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(v_slug) not between 3 and 63 then
    return jsonb_build_object('available', false, 'reason', 'invalid_format');
  end if;

  -- 予約語
  if exists (select 1 from public.reserved_slugs where slug = v_slug) then
    return jsonb_build_object('available', false, 'reason', 'reserved');
  end if;

  -- 重複チェック(自分自身は除外)
  if exists (
    select 1
    from public.tenants
    where slug = v_slug
      and (p_tenant_id is null or tenant_id <> p_tenant_id)
  ) then
    return jsonb_build_object('available', false, 'reason', 'duplicate');
  end if;

  return jsonb_build_object('available', true, 'reason', null);
end;
$_$;


ALTER FUNCTION "public"."check_slug_available"("p_slug" "text", "p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_tenant_google_credential"("p_tenant_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_secret_id uuid;
begin
  if not public.is_member_of_tenant(p_tenant_id) then
    raise exception 'not authorized to modify credentials for this tenant';
  end if;

  select secret_id into v_secret_id
  from public.tenant_google_credentials
  where tenant_id = p_tenant_id;

  if v_secret_id is null then
    raise exception 'no google credential found for this tenant';
  end if;

  delete from public.tenant_google_credentials
  where tenant_id = p_tenant_id;

  delete from vault.secrets
  where id = v_secret_id;
end;
$$;


ALTER FUNCTION "public"."delete_tenant_google_credential"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_event_filters"("p_tenant_id" "uuid" DEFAULT NULL::"uuid", "p_event_name" "text" DEFAULT NULL::"text", "p_team_id" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_tenant_id uuid;
  v_role text := auth.role();
  result_array jsonb;
begin
  if p_tenant_id is null and p_team_id is null then
    raise exception 'either p_tenant_id or p_team_id must be provided';
  end if;

  if p_tenant_id is not null then
    v_tenant_id := p_tenant_id;

    -- authenticated(WebUI)経由の場合のみメンバーチェックを行う。
    -- service_role(サーバ内部処理)経由は信頼して素通りする。
    if v_role = 'authenticated' and not public.is_member_of_tenant(v_tenant_id) then
      raise exception 'not authorized to access this tenant';
    end if;

  else
    -- p_team_id経由はSlack Webhook(service_role)からの呼び出しのみ許可する。
    -- authenticatedからの呼び出しを許すと、is_member_of_tenantを経由せず
    -- team_id→tenant_id変換だけで他テナントのevent_dataにアクセスできてしまうため明示的に拒否する。
    if v_role <> 'service_role' then
      raise exception 'p_team_id is only allowed for service_role callers';
    end if;

    select tenant_id into v_tenant_id
    from public.slack_workspaces
    where team_id = p_team_id;

    if v_tenant_id is null then
      raise exception 'no tenant found for team_id %', p_team_id;
    end if;
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'column_name', key,
      'column_values', values
    )
  )
  into result_array
  from (
    select
      key,
      jsonb_agg(distinct value order by value) as values
    from public.event_data,
    lateral jsonb_each(event_attr)
    where tenant_id = v_tenant_id and event_name = p_event_name
    group by key
  ) sub;

  return coalesce(result_array, '[]'::jsonb);
end;
$$;


ALTER FUNCTION "public"."get_event_filters"("p_tenant_id" "uuid", "p_event_name" "text", "p_team_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_event_names"("p_tenant_id" "uuid" DEFAULT NULL::"uuid", "p_team_id" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_tenant_id uuid;
  v_role text := auth.role();
  result_array jsonb;
begin
  if p_tenant_id is null and p_team_id is null then
    raise exception 'either p_tenant_id or p_team_id must be provided';
  end if;

  if p_tenant_id is not null then
    v_tenant_id := p_tenant_id;

    -- authenticated(WebUI)経由の場合のみメンバーチェックを行う。
    -- service_role(サーバ内部処理)経由は信頼して素通りする。
    if v_role = 'authenticated' and not public.is_member_of_tenant(v_tenant_id) then
      raise exception 'not authorized to access this tenant';
    end if;

  else
    -- p_team_id経由はSlack Webhook(service_role)からの呼び出しのみ許可する。
    -- authenticatedからの呼び出しを許すと、is_member_of_tenantを経由せず
    -- team_id→tenant_id変換だけで他テナントのevent_dataにアクセスできてしまうため明示的に拒否する。
    if v_role <> 'service_role' then
      raise exception 'p_team_id is only allowed for service_role callers';
    end if;

    select tenant_id into v_tenant_id
    from public.slack_workspaces
    where team_id = p_team_id;

    if v_tenant_id is null then
      raise exception 'no tenant found for team_id %', p_team_id;
    end if;
  end if;

  select jsonb_agg(distinct event_name order by event_name)
  into result_array
  from public.event_data
  where tenant_id = v_tenant_id;

  return coalesce(result_array, '[]'::jsonb);
end;
$$;


ALTER FUNCTION "public"."get_event_names"("p_tenant_id" "uuid", "p_team_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_tenant_google_credential"("p_tenant_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_secret_id uuid;
  v_decrypted text;
begin
  select secret_id into v_secret_id
  from public.tenant_google_credentials
  where tenant_id = p_tenant_id;

  if v_secret_id is null then
    return null;
  end if;

  select decrypted_secret into v_decrypted
  from vault.decrypted_secrets
  where id = v_secret_id;

  return v_decrypted::jsonb;
end;
$$;


ALTER FUNCTION "public"."get_tenant_google_credential"("p_tenant_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_tenant_google_credential"("p_tenant_id" "uuid") IS 'Google Service Account JSON鍵を復号取得する。Spreadsheet/Excel同期バッチ(service_role)専用';



CREATE OR REPLACE FUNCTION "public"."is_member_of_tenant"("check_tenant_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.tenant_users
    where tenant_id = check_tenant_id
      and user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_member_of_tenant"("check_tenant_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_member_of_tenant"("check_tenant_id" "uuid") IS '自分がcheck_tenant_idのテナントに所属しているかを判定する。RLS・各種関数の権限チェックで共通利用';



CREATE OR REPLACE FUNCTION "public"."link_my_tenant_user"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  my_email text;
begin
  select email into my_email
  from auth.users
  where id = auth.uid();

  if my_email is null then
    return;
  end if;

  update public.tenant_users
  set user_id = auth.uid(),
      updated_at = now()
  where user_id is null
    and lower(email_addr) = lower(my_email);
end;
$$;


ALTER FUNCTION "public"."link_my_tenant_user"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."link_my_tenant_user"() IS '初回ログイン時に、事前登録済み(user_id未確定)のtenant_users行を本人のemailで探して自動的にuser_idを紐付ける';



CREATE OR REPLACE FUNCTION "public"."randomize_emails"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE event_data
  SET email_addr = LOWER(SUBSTRING(MD5(RANDOM()::text), 1, 8)) || '@example.com'
  WHERE email_addr<>'';
END;
$$;


ALTER FUNCTION "public"."randomize_emails"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_created_and_updated"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    -- Insert時はcreated_byとupdated_byを設定
    NEW.created_by := auth.uid();
    NEW.created_at := now();
    NEW.updated_by := auth.uid();
    NEW.updated_at := now();
  ELSIF (TG_OP = 'UPDATE') THEN
    -- Update時はupdated_byのみ設定（created_byは変更させない）
    NEW.updated_by := auth.uid();
    New.updated_at := now();
    -- 安全のためcreated_byは古い値に固定
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_created_and_updated"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_event_configs"("p_tenant_id" "uuid", "p_configs" "jsonb") RETURNS TABLE("action" "text", "event_name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$#variable_conflict use_column
declare
  incoming_event_names text[];
begin
  if not public.is_member_of_tenant(p_tenant_id) then
    raise exception 'not authorized to modify event configs of this tenant';
  end if;

  select array_agg(c->>'event_name')
  into incoming_event_names
  from jsonb_array_elements(p_configs) as c;

  return query
  with removed as (
    delete from public.event_config
    where tenant_id = p_tenant_id
      and public.event_config.event_name != all(coalesce(incoming_event_names, array[]::text[]))
    returning public.event_config.event_name
  ),
  upserted as (
    insert into public.event_config (
      tenant_id, event_name, sheet_id, sheet_name, header,
      id_column, email_column, filter_columns, embeded_columns,
      include_flg_column_name, include_flg_column_values,
      sender_name, sender_email_addr
    )
    select
      p_tenant_id,
      c->>'event_name', c->>'sheet_id', c->>'sheet_name', (c->>'header')::int,
      c->>'id_column', c->>'email_column', c->'filter_columns', c->'embeded_columns',
      c->>'include_flg_column_name', c->'include_flg_column_values',
      c->>'sender_name', c->>'sender_email_addr'
    from jsonb_array_elements(p_configs) as c
    on conflict (tenant_id, event_name)
    do update set
      sheet_id = excluded.sheet_id,
      sheet_name = excluded.sheet_name,
      header = excluded.header,
      id_column = excluded.id_column,
      email_column = excluded.email_column,
      filter_columns = excluded.filter_columns,
      embeded_columns = excluded.embeded_columns,
      include_flg_column_name = excluded.include_flg_column_name,
      include_flg_column_values = excluded.include_flg_column_values,
      sender_name = excluded.sender_name,
      sender_email_addr = excluded.sender_email_addr
    returning public.event_config.event_name
  )
  select 'removed'::text, r.event_name as event_name from removed r
  union all
  select 'synced'::text, u.event_name as event_name from upserted u;
end;$$;


ALTER FUNCTION "public"."sync_event_configs"("p_tenant_id" "uuid", "p_configs" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sync_event_configs"("p_tenant_id" "uuid", "p_configs" "jsonb") IS 'slack2mail設定ファイルの内容でevent_configをテナント全体で全件同期する。消えたイベントのevent_dataはON DELETE CASCADEで道連れ削除される';



CREATE OR REPLACE FUNCTION "public"."sync_event_data"("p_tenant_id" "uuid", "p_event_name" "text", "p_rows" "jsonb") RETURNS TABLE("action" "text", "data_id" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$#variable_conflict use_column
declare
  incoming_data_ids text[];
begin
  if not public.is_member_of_tenant(p_tenant_id) then
    raise exception 'not authorized to modify event data of this tenant';
  end if;

  select array_agg(distinct r->>'data_id')
  into incoming_data_ids
  from jsonb_array_elements(p_rows) as r;

  return query
  with parsed_rows as (
    -- DISTINCT ON と WITH ORDINALITY を使い、重複する data_id は配列の後ろ（最新）の要素を採用
    select distinct on (r.elem->>'data_id')
      r.elem->>'data_id' as data_id,
      r.elem->>'email_addr' as email_addr,
      r.elem->'event_attr' as event_attr,
      r.elem->'embeded_values' as embeded_values
    from jsonb_array_elements(p_rows) with ordinality as r(elem, ord)
    order by r.elem->>'data_id', r.ord desc
  ),
  removed as (
    delete from public.event_data
    where tenant_id = p_tenant_id
      and event_name = p_event_name
      and data_id != all(coalesce(incoming_data_ids, array[]::text[]))
    returning data_id
  ),
  upserted as (
    insert into public.event_data (tenant_id, event_name, data_id, email_addr, event_attr, embeded_values)
    select
      p_tenant_id, p_event_name, data_id, email_addr, event_attr, embeded_values
    from parsed_rows
    on conflict (tenant_id, event_name, data_id)
    do update set
      email_addr = excluded.email_addr,
      event_attr = excluded.event_attr,
      embeded_values = excluded.embeded_values
    returning data_id
  )
  select 'removed'::text, removed.data_id from removed
  union all
  select 'synced'::text, upserted.data_id from upserted;
end;$$;


ALTER FUNCTION "public"."sync_event_data"("p_tenant_id" "uuid", "p_event_name" "text", "p_rows" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sync_event_data"("p_tenant_id" "uuid", "p_event_name" "text", "p_rows" "jsonb") IS 'イベント参加者一覧Spreadsheetの内容でevent_dataをイベント単位(p_event_nameの行のみ)で全件同期する';



CREATE OR REPLACE FUNCTION "public"."sync_tenant_members"("p_tenant_id" "uuid", "p_members" "jsonb") RETURNS TABLE("action" "text", "email_addr" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  incoming_emails text[];
begin
  if not public.is_member_of_tenant(p_tenant_id) then
    raise exception 'not authorized to modify members of this tenant';
  end if;

  select array_agg(lower(m->>'email'))
  into incoming_emails
  from jsonb_array_elements(p_members) as m;

  return query
  with removed as (
    delete from public.tenant_users t
    where tenant_id = p_tenant_id
      and lower(t.email_addr) != all(coalesce(incoming_emails, array[]::text[]))
    returning t.email_addr
  ),
  existing_links as (
    select distinct on (lower(t.email_addr)) lower(t.email_addr) as email_key, t.user_id
    from public.tenant_users t
    where t.user_id is not null
  ),
  upserted as (
    insert into public.tenant_users (tenant_id, email_addr, name, user_id, created_by, updated_by)
    select
      p_tenant_id,
      m->>'email',
      m->>'name',
      existing_links.user_id,
      auth.uid(),
      auth.uid()
    from jsonb_array_elements(p_members) as m
    left join existing_links on existing_links.email_key = lower(m->>'email')
    on conflict (tenant_id, lower(public.tenant_users.email_addr))
    do update set
      name = excluded.name,
      user_id = coalesce(public.tenant_users.user_id, excluded.user_id),
      updated_by = auth.uid(),
      updated_at = now()
    returning public.tenant_users.email_addr
  )
  select 'removed'::text, removed.email_addr from removed
  union all
  select 'synced'::text, upserted.email_addr from upserted;
end;
$$;


ALTER FUNCTION "public"."sync_tenant_members"("p_tenant_id" "uuid", "p_members" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sync_tenant_members"("p_tenant_id" "uuid", "p_members" "jsonb") IS '役員一覧Spreadsheetの内容でtenant_usersを全件同期する(消えた人を削除、残り/増えた人をupsert)';



CREATE OR REPLACE FUNCTION "public"."tenants_slug_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  new.slug := lower(new.slug);

  if exists (select 1 from public.reserved_slugs where slug = new.slug) then
    raise exception 'slug "%" is reserved', new.slug
      using errcode = '23514';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."tenants_slug_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_slack_workspace"("p_tenant_id" "uuid", "p_team_id" "text", "p_team_name" "text", "p_bot_token" "text", "p_installed_user_id" "text", "p_enterprise_id" "text" DEFAULT NULL::"text", "p_bot_user_id" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_existing_tenant_id uuid;
begin
  if not public.is_member_of_tenant(p_tenant_id) then
    raise exception 'not authorized to link slack workspace for this tenant';
  end if;

  if p_team_id is null or p_bot_token is null then
    raise exception 'invalid slack oauth response: required fields missing';
  end if;

  select tenant_id into v_existing_tenant_id
  from public.slack_workspaces
  where team_id = p_team_id;

  -- 既に別テナントにリンク済みのワークスペースを黙って奪わない。
  -- (例: テナントAが使っているSlackワークスペースへ、テナントBのオーナーが
  --  誤って/悪意を持ってインストールボタンを押した場合など)
  if v_existing_tenant_id is not null and v_existing_tenant_id <> p_tenant_id then
    raise exception 'slack_team_already_linked_to_other_tenant';
  end if;

  insert into public.slack_workspaces (
    tenant_id, team_id, team_name, enterprise_id,
    bot_user_id, bot_token, installed_user_id, installed_at
  )
  values (
    p_tenant_id, p_team_id, p_team_name, p_enterprise_id,
    p_bot_user_id, p_bot_token, p_installed_user_id, now()
  )
  on conflict (team_id) do update
  set team_name         = excluded.team_name,
      enterprise_id      = excluded.enterprise_id,
      bot_user_id        = excluded.bot_user_id,
      bot_token          = excluded.bot_token,
      installed_user_id  = excluded.installed_user_id,
      installed_at       = now(),
      updated_at         = now();
end;
$$;


ALTER FUNCTION "public"."upsert_slack_workspace"("p_tenant_id" "uuid", "p_team_id" "text", "p_team_name" "text", "p_bot_token" "text", "p_installed_user_id" "text", "p_enterprise_id" "text", "p_bot_user_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_tenant_google_credential"("p_tenant_id" "uuid", "p_service_account_json" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_email text;
  v_key_id text;
  v_existing_secret_id uuid;
begin
  if not public.is_member_of_tenant(p_tenant_id) then
    raise exception 'not authorized to modify credentials for this tenant';
  end if;

  v_email := p_service_account_json->>'client_email';
  v_key_id := p_service_account_json->>'private_key_id';
  if v_email is null or v_key_id is null or (p_service_account_json->>'private_key') is null then
    raise exception 'invalid service account json: required fields missing';
  end if;

  select secret_id into v_existing_secret_id
  from public.tenant_google_credentials
  where tenant_id = p_tenant_id;

  if v_existing_secret_id is not null then
    perform vault.update_secret(v_existing_secret_id, p_service_account_json::text);

    update public.tenant_google_credentials
    set service_account_email = v_email,
        private_key_id = v_key_id,
        updated_by = auth.uid(),
        updated_at = now()
    where tenant_id = p_tenant_id;
  else
    insert into public.tenant_google_credentials (
      tenant_id, service_account_email, private_key_id, secret_id, created_by, updated_by
    )
    values (
      p_tenant_id, v_email, v_key_id,
      vault.create_secret(p_service_account_json::text, 'tenant_google_sa:' || p_tenant_id::text || ':' || gen_random_uuid()::text),
      auth.uid(), auth.uid()
    );
  end if;
end;
$$;


ALTER FUNCTION "public"."upsert_tenant_google_credential"("p_tenant_id" "uuid", "p_service_account_json" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."upsert_tenant_google_credential"("p_tenant_id" "uuid", "p_service_account_json" "jsonb") IS 'テナントのGoogle Service Account JSON鍵を登録・更新する。private_key本体はVaultへ暗号化保存する';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."emails" (
    "email_id" "text" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "subject" "text",
    "body" "text",
    "event_name" "text",
    "event_filter" "jsonb",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "approval_count" integer DEFAULT 0 NOT NULL,
    "approval_border" integer DEFAULT 3 NOT NULL,
    "approved_by" "text"[],
    "attachments" "bytea"[],
    "created_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "team_id" "text",
    "approval_channel" "text" NOT NULL,
    "approval_thread_ts" "text" NOT NULL,
    "schedule" timestamp with time zone,
    "sent_at" timestamp with time zone,
    "num_of_received" integer,
    "num_of_sent" integer,
    "aborted_by" "text",
    "aborted_at" timestamp with time zone,
    "edited_by" "text",
    "edited_at" timestamp with time zone,
    "mail_account_id" "uuid",
    "mail_account_name" "text",
    CONSTRAINT "emails_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'sending'::"text", 'sent'::"text", 'aborted'::"text"])))
);


ALTER TABLE "public"."emails" OWNER TO "postgres";


COMMENT ON TABLE "public"."emails" IS 'Slack画面から作成したメールの内容や管理用属性値';



CREATE TABLE IF NOT EXISTS "public"."event_config" (
    "tenant_id" "uuid" NOT NULL,
    "event_name" "text" NOT NULL,
    "sheet_id" "text",
    "sheet_name" "text",
    "header" integer,
    "id_column" "text",
    "email_column" "text",
    "filter_columns" "jsonb",
    "embeded_columns" "jsonb",
    "sender_name" "text",
    "sender_email_addr" "text",
    "include_flg_column_name" "text",
    "include_flg_column_values" "jsonb"
);


ALTER TABLE "public"."event_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."event_config" IS 'イベントシートの取込み定義。slack2mail設定ファイルを原本としテナント全体を全件同期する(sync_event_configs)';



CREATE TABLE IF NOT EXISTS "public"."event_data" (
    "id" bigint NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "event_name" "text" NOT NULL,
    "data_id" "text" NOT NULL,
    "email_addr" "text",
    "event_attr" "jsonb",
    "numerical_data_id" bigint GENERATED ALWAYS AS (
CASE
    WHEN ("data_id" ~ '^[0-9]+$'::"text") THEN ("data_id")::bigint
    ELSE NULL::bigint
END) STORED,
    "embeded_values" "jsonb"
);


ALTER TABLE "public"."event_data" OWNER TO "postgres";


COMMENT ON TABLE "public"."event_data" IS 'イベントシートから取り込んだ宛先データ。event_configが削除されるとON DELETE CASCADEで道連れ削除される';



ALTER TABLE "public"."event_data" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."event_data_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."mail_account" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text",
    "email_addr" "text",
    "password" "text",
    "description" "text",
    "default" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."mail_account" OWNER TO "postgres";


COMMENT ON TABLE "public"."mail_account" IS 'メールの送信者名と送信済みメールを保存するアカウントの設定';



CREATE TABLE IF NOT EXISTS "public"."mail_server" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text",
    "description" "text",
    "smtp_server" "text",
    "smtp_port" smallint,
    "smtp_secure" boolean,
    "imap_server" "text",
    "imap_port" smallint,
    "imap_secure" boolean,
    "available" boolean
);


ALTER TABLE "public"."mail_server" OWNER TO "postgres";


COMMENT ON TABLE "public"."mail_server" IS '送信に使用するメールサーバの情報';



CREATE TABLE IF NOT EXISTS "public"."members_sheet_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "sheet_id" "text",
    "email_column_name" "text",
    "name_column_name" "text",
    "filter_column_name" "text",
    "filter_column_values" "jsonb",
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sheet_name" "text"
);


ALTER TABLE "public"."members_sheet_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."members_sheet_config" IS 'テナントメンバーが記載されたGoogle Spreadsheetの情報。場所と読み込むカラムなどの設定';



CREATE TABLE IF NOT EXISTS "public"."reserved_slugs" (
    "slug" "text" NOT NULL
);


ALTER TABLE "public"."reserved_slugs" OWNER TO "postgres";


COMMENT ON TABLE "public"."reserved_slugs" IS '予約語登録: システムなどですでに使用しているパス文字列が登録されないように制御するためのテーブル';



CREATE TABLE IF NOT EXISTS "public"."sent_emails" (
    "tracking_token" "text" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "email_id" "text" NOT NULL,
    "event_email_addr" "text",
    "sent_at" timestamp with time zone,
    "receive_checked_at" timestamp with time zone,
    "received" boolean DEFAULT false NOT NULL,
    "imap_written_at" timestamp with time zone,
    "message_id" "text"
);


ALTER TABLE "public"."sent_emails" OWNER TO "postgres";


COMMENT ON TABLE "public"."sent_emails" IS '送信したメールの送達・受信状況。event_dataが削除されても送達記録は影響を受けない(送信時点の値を実値コピー)';



CREATE TABLE IF NOT EXISTS "public"."slack2mail_sheet_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "sheet_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_by" "uuid"
);


ALTER TABLE "public"."slack2mail_sheet_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."slack2mail_sheet_config" IS 'slack2mail.configシートのID(場所)。slack2mail.configはイベントシートの情報が記載されているシート。';



CREATE TABLE IF NOT EXISTS "public"."slack_workspaces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "team_id" "text" NOT NULL,
    "team_name" "text",
    "enterprise_id" "text",
    "bot_user_id" "text",
    "bot_token" "text",
    "installed_user_id" "text",
    "installed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."slack_workspaces" OWNER TO "postgres";


COMMENT ON TABLE "public"."slack_workspaces" IS 'テナントに紐付いたSlackワークスペースの情報。team_idとtenant_idを紐付ける';



COMMENT ON COLUMN "public"."slack_workspaces"."team_id" IS '1ワークスペース=1テナントを保証するためUNIQUE制約を付与';



CREATE TABLE IF NOT EXISTS "public"."tenant_google_credentials" (
    "tenant_id" "uuid" NOT NULL,
    "service_account_email" "text",
    "private_key_id" "text",
    "secret_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tenant_google_credentials" OWNER TO "postgres";


COMMENT ON TABLE "public"."tenant_google_credentials" IS 'テナントごとのGoogle Service Account情報。private_key本体はSupabase Vaultに暗号化保存する';



COMMENT ON COLUMN "public"."tenant_google_credentials"."private_key_id" IS 'JSON鍵に含まれるkey ID(公開情報)。手元の鍵ファイルとの同一性確認用に一部を画面表示する';



COMMENT ON COLUMN "public"."tenant_google_credentials"."secret_id" IS 'vault.secrets.idへの参照。private_key本体はここを経由してのみ復号取得できる';



CREATE TABLE IF NOT EXISTS "public"."tenant_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "name" "text",
    "email_addr" "text" NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tenant_users" OWNER TO "postgres";


COMMENT ON TABLE "public"."tenant_users" IS 'slack2mailの利用者一覧。この一覧に登録されたユーザがWebUIを使用できる';



COMMENT ON COLUMN "public"."tenant_users"."user_id" IS 'supabase auth.users.id / NULLABLE: 事前登録時点では未確定なため。初回ログイン時にlink_my_tenant_user()で自動的に埋まる';



CREATE TABLE IF NOT EXISTS "public"."tenants" (
    "tenant_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "brand_name" "text",
    "brand_icon_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tenants_slug_format_check" CHECK ((("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::"text") AND (("length"("slug") >= 3) AND ("length"("slug") <= 63))))
);


ALTER TABLE "public"."tenants" OWNER TO "postgres";


COMMENT ON TABLE "public"."tenants" IS 'テナント管理用。Slackの場合、1ワークスペース=1テナントとする';



COMMENT ON COLUMN "public"."tenants"."slug" IS 'テナント略称。例: /pta-a のURLに使用する';



ALTER TABLE ONLY "public"."emails"
    ADD CONSTRAINT "emails_pkey" PRIMARY KEY ("email_id");



ALTER TABLE ONLY "public"."event_config"
    ADD CONSTRAINT "event_config_pkey" PRIMARY KEY ("tenant_id", "event_name");



ALTER TABLE ONLY "public"."event_data"
    ADD CONSTRAINT "event_data_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_data"
    ADD CONSTRAINT "event_data_tenant_id_event_name_data_id_key" UNIQUE ("tenant_id", "event_name", "data_id");



ALTER TABLE ONLY "public"."mail_account"
    ADD CONSTRAINT "mail_account_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mail_server"
    ADD CONSTRAINT "mail_server_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."members_sheet_config"
    ADD CONSTRAINT "members_sheet_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."members_sheet_config"
    ADD CONSTRAINT "members_sheet_config_tenant_id_key" UNIQUE ("tenant_id");



ALTER TABLE ONLY "public"."reserved_slugs"
    ADD CONSTRAINT "reserved_slugs_pkey" PRIMARY KEY ("slug");



ALTER TABLE ONLY "public"."sent_emails"
    ADD CONSTRAINT "sent_emails_pkey" PRIMARY KEY ("tracking_token");



ALTER TABLE ONLY "public"."slack2mail_sheet_config"
    ADD CONSTRAINT "slack2mail_sheet_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."slack2mail_sheet_config"
    ADD CONSTRAINT "slack2mail_sheet_config_tenant_id_key" UNIQUE ("tenant_id");



ALTER TABLE ONLY "public"."slack_workspaces"
    ADD CONSTRAINT "slack_workspaces_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."slack_workspaces"
    ADD CONSTRAINT "slack_workspaces_team_id_key" UNIQUE ("team_id");



ALTER TABLE ONLY "public"."tenant_google_credentials"
    ADD CONSTRAINT "tenant_google_credentials_pkey" PRIMARY KEY ("tenant_id");



ALTER TABLE ONLY "public"."tenant_users"
    ADD CONSTRAINT "tenant_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_pkey" PRIMARY KEY ("tenant_id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_slug_key" UNIQUE ("slug");



CREATE INDEX "emails_tenant_status_idx" ON "public"."emails" USING "btree" ("tenant_id", "status");



CREATE INDEX "sent_emails_tenant_email_id_idx" ON "public"."sent_emails" USING "btree" ("tenant_id", "email_id");



CREATE UNIQUE INDEX "tenant_users_tenant_email_uniq" ON "public"."tenant_users" USING "btree" ("tenant_id", "lower"("email_addr"));



CREATE INDEX "tenant_users_user_id_idx" ON "public"."tenant_users" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE OR REPLACE TRIGGER "handle_created_and_updated" BEFORE INSERT OR UPDATE ON "public"."members_sheet_config" FOR EACH ROW EXECUTE FUNCTION "public"."set_created_and_updated"();



CREATE OR REPLACE TRIGGER "handle_created_and_updated" BEFORE INSERT OR UPDATE ON "public"."slack2mail_sheet_config" FOR EACH ROW EXECUTE FUNCTION "public"."set_created_and_updated"();



CREATE OR REPLACE TRIGGER "trg_tenants_slug_guard" BEFORE INSERT OR UPDATE ON "public"."tenants" FOR EACH ROW EXECUTE FUNCTION "public"."tenants_slug_guard"();



ALTER TABLE ONLY "public"."emails"
    ADD CONSTRAINT "emails_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_config"
    ADD CONSTRAINT "event_config_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_data"
    ADD CONSTRAINT "event_data_tenant_id_event_name_fkey" FOREIGN KEY ("tenant_id", "event_name") REFERENCES "public"."event_config"("tenant_id", "event_name") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_data"
    ADD CONSTRAINT "event_data_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mail_account"
    ADD CONSTRAINT "mail_account_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mail_server"
    ADD CONSTRAINT "mail_server_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."members_sheet_config"
    ADD CONSTRAINT "members_sheet_config_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."members_sheet_config"
    ADD CONSTRAINT "members_sheet_config_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."members_sheet_config"
    ADD CONSTRAINT "members_sheet_config_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sent_emails"
    ADD CONSTRAINT "sent_emails_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."slack2mail_sheet_config"
    ADD CONSTRAINT "slack2mail_sheet_config_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."slack2mail_sheet_config"
    ADD CONSTRAINT "slack2mail_sheet_config_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."slack2mail_sheet_config"
    ADD CONSTRAINT "slack2mail_sheet_config_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."slack_workspaces"
    ADD CONSTRAINT "slack_workspaces_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_google_credentials"
    ADD CONSTRAINT "tenant_google_credentials_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tenant_google_credentials"
    ADD CONSTRAINT "tenant_google_credentials_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_google_credentials"
    ADD CONSTRAINT "tenant_google_credentials_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tenant_users"
    ADD CONSTRAINT "tenant_users_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tenant_users"
    ADD CONSTRAINT "tenant_users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_users"
    ADD CONSTRAINT "tenant_users_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tenant_users"
    ADD CONSTRAINT "tenant_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."emails" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_data" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mail_account" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mail_server" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."members_sheet_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reserved_slugs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reserved_slugs select for all users" ON "public"."reserved_slugs" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."sent_emails" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."slack2mail_sheet_config" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "slack2mail_sheet_config_policy" ON "public"."slack2mail_sheet_config" USING ("public"."is_member_of_tenant"("tenant_id")) WITH CHECK ("public"."is_member_of_tenant"("tenant_id"));



ALTER TABLE "public"."slack_workspaces" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenant_google_credentials" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_isolation_all" ON "public"."members_sheet_config" USING ("public"."is_member_of_tenant"("tenant_id")) WITH CHECK ("public"."is_member_of_tenant"("tenant_id"));



CREATE POLICY "tenant_isolation_delete" ON "public"."emails" FOR DELETE USING ("public"."is_member_of_tenant"("tenant_id"));



CREATE POLICY "tenant_isolation_delete" ON "public"."event_config" FOR DELETE USING ("public"."is_member_of_tenant"("tenant_id"));



CREATE POLICY "tenant_isolation_delete" ON "public"."event_data" FOR DELETE USING ("public"."is_member_of_tenant"("tenant_id"));



CREATE POLICY "tenant_isolation_delete" ON "public"."mail_account" FOR DELETE USING ("public"."is_member_of_tenant"("tenant_id"));



CREATE POLICY "tenant_isolation_delete" ON "public"."mail_server" FOR DELETE USING ("public"."is_member_of_tenant"("tenant_id"));



CREATE POLICY "tenant_isolation_delete" ON "public"."sent_emails" FOR DELETE USING ("public"."is_member_of_tenant"("tenant_id"));



CREATE POLICY "tenant_isolation_delete" ON "public"."slack_workspaces" FOR DELETE USING ("public"."is_member_of_tenant"("tenant_id"));



CREATE POLICY "tenant_isolation_delete" ON "public"."tenant_users" FOR DELETE USING ("public"."is_member_of_tenant"("tenant_id"));



CREATE POLICY "tenant_isolation_delete" ON "public"."tenants" FOR DELETE USING ("public"."is_member_of_tenant"("tenant_id"));



CREATE POLICY "tenant_isolation_insert" ON "public"."emails" FOR INSERT WITH CHECK ("public"."is_member_of_tenant"("tenant_id"));



CREATE POLICY "tenant_isolation_insert" ON "public"."event_config" FOR INSERT WITH CHECK ("public"."is_member_of_tenant"("tenant_id"));



CREATE POLICY "tenant_isolation_insert" ON "public"."event_data" FOR INSERT WITH CHECK ("public"."is_member_of_tenant"("tenant_id"));



CREATE POLICY "tenant_isolation_insert" ON "public"."mail_account" FOR INSERT WITH CHECK ("public"."is_member_of_tenant"("tenant_id"));



CREATE POLICY "tenant_isolation_insert" ON "public"."mail_server" FOR INSERT WITH CHECK ("public"."is_member_of_tenant"("tenant_id"));



CREATE POLICY "tenant_isolation_insert" ON "public"."sent_emails" FOR INSERT WITH CHECK ("public"."is_member_of_tenant"("tenant_id"));



CREATE POLICY "tenant_isolation_insert" ON "public"."slack_workspaces" FOR INSERT WITH CHECK ("public"."is_member_of_tenant"("tenant_id"));



CREATE POLICY "tenant_isolation_insert" ON "public"."tenant_users" FOR INSERT WITH CHECK ("public"."is_member_of_tenant"("tenant_id"));



CREATE POLICY "tenant_isolation_insert" ON "public"."tenants" FOR INSERT WITH CHECK ("public"."is_member_of_tenant"("tenant_id"));



CREATE POLICY "tenant_isolation_select" ON "public"."emails" FOR SELECT USING ("public"."is_member_of_tenant"("tenant_id"));



CREATE POLICY "tenant_isolation_select" ON "public"."event_config" FOR SELECT USING ("public"."is_member_of_tenant"("tenant_id"));



CREATE POLICY "tenant_isolation_select" ON "public"."event_data" FOR SELECT USING ("public"."is_member_of_tenant"("tenant_id"));



CREATE POLICY "tenant_isolation_select" ON "public"."mail_account" FOR SELECT USING ("public"."is_member_of_tenant"("tenant_id"));



CREATE POLICY "tenant_isolation_select" ON "public"."mail_server" FOR SELECT USING ("public"."is_member_of_tenant"("tenant_id"));



CREATE POLICY "tenant_isolation_select" ON "public"."sent_emails" FOR SELECT USING ("public"."is_member_of_tenant"("tenant_id"));



CREATE POLICY "tenant_isolation_select" ON "public"."slack_workspaces" FOR SELECT USING ("public"."is_member_of_tenant"("tenant_id"));



CREATE POLICY "tenant_isolation_select" ON "public"."tenant_google_credentials" FOR SELECT USING ("public"."is_member_of_tenant"("tenant_id"));



CREATE POLICY "tenant_isolation_select" ON "public"."tenants" FOR SELECT USING ("public"."is_member_of_tenant"("tenant_id"));



CREATE POLICY "tenant_isolation_update" ON "public"."emails" FOR UPDATE USING ("public"."is_member_of_tenant"("tenant_id")) WITH CHECK ("public"."is_member_of_tenant"("tenant_id"));



CREATE POLICY "tenant_isolation_update" ON "public"."event_config" FOR UPDATE USING ("public"."is_member_of_tenant"("tenant_id")) WITH CHECK ("public"."is_member_of_tenant"("tenant_id"));



CREATE POLICY "tenant_isolation_update" ON "public"."event_data" FOR UPDATE USING ("public"."is_member_of_tenant"("tenant_id")) WITH CHECK ("public"."is_member_of_tenant"("tenant_id"));



CREATE POLICY "tenant_isolation_update" ON "public"."mail_account" FOR UPDATE USING ("public"."is_member_of_tenant"("tenant_id")) WITH CHECK ("public"."is_member_of_tenant"("tenant_id"));



CREATE POLICY "tenant_isolation_update" ON "public"."mail_server" FOR UPDATE USING ("public"."is_member_of_tenant"("tenant_id")) WITH CHECK ("public"."is_member_of_tenant"("tenant_id"));



CREATE POLICY "tenant_isolation_update" ON "public"."sent_emails" FOR UPDATE USING ("public"."is_member_of_tenant"("tenant_id")) WITH CHECK ("public"."is_member_of_tenant"("tenant_id"));



CREATE POLICY "tenant_isolation_update" ON "public"."slack_workspaces" FOR UPDATE USING ("public"."is_member_of_tenant"("tenant_id")) WITH CHECK ("public"."is_member_of_tenant"("tenant_id"));



CREATE POLICY "tenant_isolation_update" ON "public"."tenant_users" FOR UPDATE USING ("public"."is_member_of_tenant"("tenant_id")) WITH CHECK ("public"."is_member_of_tenant"("tenant_id"));



CREATE POLICY "tenant_isolation_update" ON "public"."tenants" FOR UPDATE USING ("public"."is_member_of_tenant"("tenant_id")) WITH CHECK ("public"."is_member_of_tenant"("tenant_id"));



ALTER TABLE "public"."tenant_users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_users_self_select" ON "public"."tenant_users" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."tenants" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";




























































































































































REVOKE ALL ON FUNCTION "public"."check_slug_available"("p_slug" "text", "p_tenant_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_slug_available"("p_slug" "text", "p_tenant_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_event_filters"("p_tenant_id" "uuid", "p_event_name" "text", "p_team_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_event_filters"("p_tenant_id" "uuid", "p_event_name" "text", "p_team_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_event_names"("p_tenant_id" "uuid", "p_team_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_event_names"("p_tenant_id" "uuid", "p_team_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_tenant_google_credential"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."link_my_tenant_user"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."sync_event_configs"("p_tenant_id" "uuid", "p_configs" "jsonb") TO "authenticated";



GRANT ALL ON FUNCTION "public"."sync_event_data"("p_tenant_id" "uuid", "p_event_name" "text", "p_rows" "jsonb") TO "authenticated";



GRANT ALL ON FUNCTION "public"."sync_tenant_members"("p_tenant_id" "uuid", "p_members" "jsonb") TO "authenticated";



GRANT ALL ON FUNCTION "public"."upsert_tenant_google_credential"("p_tenant_id" "uuid", "p_service_account_json" "jsonb") TO "authenticated";


















GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."emails" TO "anon";
GRANT ALL ON TABLE "public"."emails" TO "authenticated";
GRANT ALL ON TABLE "public"."emails" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."event_config" TO "anon";
GRANT ALL ON TABLE "public"."event_config" TO "authenticated";
GRANT ALL ON TABLE "public"."event_config" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."event_data" TO "anon";
GRANT ALL ON TABLE "public"."event_data" TO "authenticated";
GRANT ALL ON TABLE "public"."event_data" TO "service_role";



GRANT UPDATE ON SEQUENCE "public"."event_data_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."event_data_id_seq" TO "authenticated";
GRANT UPDATE ON SEQUENCE "public"."event_data_id_seq" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."mail_account" TO "anon";
GRANT ALL ON TABLE "public"."mail_account" TO "authenticated";
GRANT ALL ON TABLE "public"."mail_account" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."mail_server" TO "anon";
GRANT ALL ON TABLE "public"."mail_server" TO "authenticated";
GRANT ALL ON TABLE "public"."mail_server" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."members_sheet_config" TO "anon";
GRANT ALL ON TABLE "public"."members_sheet_config" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."members_sheet_config" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reserved_slugs" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reserved_slugs" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reserved_slugs" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."sent_emails" TO "anon";
GRANT ALL ON TABLE "public"."sent_emails" TO "authenticated";
GRANT ALL ON TABLE "public"."sent_emails" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."slack2mail_sheet_config" TO "anon";
GRANT ALL ON TABLE "public"."slack2mail_sheet_config" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."slack2mail_sheet_config" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."slack_workspaces" TO "anon";
GRANT ALL ON TABLE "public"."slack_workspaces" TO "authenticated";
GRANT ALL ON TABLE "public"."slack_workspaces" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."tenant_google_credentials" TO "anon";
GRANT ALL ON TABLE "public"."tenant_google_credentials" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_google_credentials" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."tenant_users" TO "anon";
GRANT ALL ON TABLE "public"."tenant_users" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_users" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."tenants" TO "anon";
GRANT ALL ON TABLE "public"."tenants" TO "authenticated";
GRANT ALL ON TABLE "public"."tenants" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "service_role";
































--
-- Dumped schema changes for auth and storage
--

