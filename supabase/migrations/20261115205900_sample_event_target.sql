-- supabase/migrations/20261115205900_sample_event_target.sql
-- 件名・本文プレビュー用: 検索条件(AND/OR)に一致するevent_dataの1レコードを取得する。
-- count_email_targets / claim_and_expand_email_targets と同じ条件式を使用する。

CREATE OR REPLACE FUNCTION public.get_sample_event_target(
  p_tenant_id uuid,
  p_event_name text,
  p_filter jsonb DEFAULT NULL::jsonb,
  p_filter_mode text DEFAULT 'and'::text
)
 RETURNS TABLE(email_addr text, embeded_values jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$declare
  v_role text := auth.role();
  v_mode text := coalesce(p_filter_mode, 'and'::text);
begin
  if v_role <> 'service_role' then
    raise exception 'get_sample_event_target is only allowed for service_role callers';
  end if;

  if v_mode not in ('and', 'or') then
    raise exception 'filter_mode must be ''and'' or ''or''';
  end if;

  -- count_email_targets と同じ条件式。data_id昇順の先頭1件を返す(決定論的)。
  -- and モード: 全カラム条件に一致(交差)。 or モード: いずれかのカラム条件に一致(union)。
  -- 属性キーが存在しない行は coalesce で「不一致」として扱う。
  return query
  select ed.email_addr, ed.embeded_values
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
  order by ed.data_id
  limit 1;
end;$function$
;

REVOKE ALL ON FUNCTION "public"."get_sample_event_target"("uuid", "text", "jsonb", "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_sample_event_target"("uuid", "text", "jsonb", "text") TO "service_role";
