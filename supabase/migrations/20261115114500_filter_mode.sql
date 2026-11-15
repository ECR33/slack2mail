-- supabase/migrations/20261115114500_filter_mode.sql
-- 宛先グループ選択のAND/OR選択(emails.filter_mode)と
-- 属性欠落行が条件を満たした扱いになる3値論理バグの修正

alter table "public"."emails"
    add column if not exists "filter_mode" text not null default 'and'::text
    check (("filter_mode" = any (array['and'::text, 'or'::text])));

drop function if exists "public"."claim_and_expand_email_targets"("uuid", "text", "text", "jsonb");

CREATE OR REPLACE FUNCTION public.claim_and_expand_email_targets(
  p_tenant_id uuid,
  p_email_id text,
  p_event_name text,
  p_filter jsonb DEFAULT NULL::jsonb,
  p_filter_mode text DEFAULT 'and'::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$declare
  v_role text := auth.role();
  v_claimed_id text;
  v_targets jsonb;
  v_inserted_count int;
  v_mode text := coalesce(p_filter_mode, 'and');
begin
  if v_role <> 'service_role' then
    raise exception 'claim_and_expand_email_targets is only allowed for service_role callers';
  end if;

  if v_mode not in ('and', 'or') then
    raise exception 'filter_mode must be ''and'' or ''or''';
  end if;

  update public.emails
  set status = 'expanded'
  where email_id = p_email_id
    and tenant_id = p_tenant_id
    and status = 'approved'
  returning email_id into v_claimed_id;

  if v_claimed_id is null then
    return jsonb_build_object('claimed', false, 'targets', '[]'::jsonb);
  end if;

  -- フィルタ条件(called from service_role only):
  --   and モード: 全カラム条件に一致(交差)。カラム内複数値はOR。
  --   or  モード: いずれかのカラム条件に一致(union)。カラム内複数値はOR。
  -- 属性キーが存在しない行(event_attr->>col がNULL)は coalesce で
  -- 「不一致」として扱う(従来の3値論理では条件を満たした扱いになっていた)。
  select count(distinct ed.email_addr)
  into v_inserted_count
  from public.event_data ed
  where ed.tenant_id = p_tenant_id
    and ed.event_name = p_event_name
    and ed.email_addr is not null
    and trim(ed.email_addr) != ''
    and (
      p_filter is null
      or jsonb_array_length(p_filter) = 0
      or (
        case v_mode
          when 'or' then exists (
            select 1
            from (
              select f->>'column_name' as col, array_agg(f->>'column_value') as vals
              from jsonb_array_elements(p_filter) as f
              group by f->>'column_name'
            ) grouped
            where coalesce(ed.event_attr->>grouped.col = any (grouped.vals), false)
          )
          else not exists (
            select 1
            from (
              select f->>'column_name' as col, array_agg(f->>'column_value') as vals
              from jsonb_array_elements(p_filter) as f
              group by f->>'column_name'
            ) grouped
            where not coalesce(ed.event_attr->>grouped.col = any (grouped.vals), false)
          )
        end
      )
    );

  update public.emails
  set num_of_target = v_inserted_count
  where email_id = p_email_id
    and tenant_id = p_tenant_id;

  with ins as (
    insert into public.sent_emails (
      tracking_token, tenant_id, email_id, event_email_addr, embeded_values, status
    )
    select distinct on (ed.email_addr)
      encode(extensions.gen_random_bytes(16), 'hex'),
      p_tenant_id,
      p_email_id,
      ed.email_addr,
      ed.embeded_values,
      'approved'
    from public.event_data ed
    where ed.tenant_id = p_tenant_id
      and ed.event_name = p_event_name
      and ed.email_addr is not null
      and trim(ed.email_addr) != ''
      and (
        p_filter is null
        or jsonb_array_length(p_filter) = 0
        or (
          case v_mode
            when 'or' then exists (
              select 1
              from (
                select f->>'column_name' as col, array_agg(f->>'column_value') as vals
                from jsonb_array_elements(p_filter) as f
                group by f->>'column_name'
              ) grouped
              where coalesce(ed.event_attr->>grouped.col = any (grouped.vals), false)
            )
            else not exists (
              select 1
              from (
                select f->>'column_name' as col, array_agg(f->>'column_value') as vals
                from jsonb_array_elements(p_filter) as f
                group by f->>'column_name'
              ) grouped
              where not coalesce(ed.event_attr->>grouped.col = any (grouped.vals), false)
            )
          end
        )
      )
    order by
      ed.email_addr,
      ed.numerical_data_id desc nulls last,
      ed.data_id desc
    ON CONFLICT (tenant_id, email_id, event_email_addr)
    DO NOTHING
    returning *
  )
  select coalesce(jsonb_agg(to_jsonb(ins)), '[]'::jsonb) into v_targets from ins;

  return jsonb_build_object('claimed', true, 'targets', v_targets);
end;$function$
;

REVOKE ALL ON FUNCTION "public"."claim_and_expand_email_targets"("uuid", "text", "text", "jsonb", "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_and_expand_email_targets"("uuid", "text", "text", "jsonb", "text") TO "service_role";
