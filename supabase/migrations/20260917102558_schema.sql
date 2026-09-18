alter table "public"."emails" drop constraint "emails_status_check";

alter table "public"."emails" add column "num_of_target" integer;

alter table "public"."sent_emails" add column "embeded_values" jsonb;

alter table "public"."sent_emails" add column "sending_at" timestamp with time zone;

alter table "public"."sent_emails" add column "status" text not null default 'approved'::text;

CREATE UNIQUE INDEX sent_emails_upsert_constraint ON public.sent_emails USING btree (tenant_id, email_id, event_email_addr);

alter table "public"."sent_emails" add constraint "sent_emails_fkey" FOREIGN KEY (email_id) REFERENCES public.emails(email_id) ON DELETE CASCADE not valid;

alter table "public"."sent_emails" validate constraint "sent_emails_fkey";

alter table "public"."sent_emails" add constraint "sent_emails_status_check" CHECK ((status = ANY (ARRAY['approved'::text, 'sending'::text, 'sent'::text, 'failed'::text]))) not valid;

alter table "public"."sent_emails" validate constraint "sent_emails_status_check";

alter table "public"."sent_emails" add constraint "sent_emails_upsert_constraint" UNIQUE using index "sent_emails_upsert_constraint";

alter table "public"."emails" add constraint "emails_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'expanded'::text, 'sent'::text, 'aborted'::text]))) not valid;

alter table "public"."emails" validate constraint "emails_status_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.claim_and_expand_email_targets(p_tenant_id uuid, p_email_id text, p_event_name text, p_filter jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$declare
  v_role text := auth.role();
  v_claimed_id text;
  v_targets jsonb;
  v_inserted_count int;
begin
  if v_role <> 'service_role' then
    raise exception 'claim_and_expand_email_targets is only allowed for service_role callers';
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
      or not exists (
        select 1
        from (
          select f->>'column_name' as col, array_agg(f->>'column_value') as vals
          from jsonb_array_elements(p_filter) as f
          group by f->>'column_name'
        ) grouped
        where not (ed.event_attr->>grouped.col = any (grouped.vals))
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
      encode(extensions.gen_random_bytes(16), 'hex'),   -- ← スキーマ修飾
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
        or not exists (
          select 1
          from (
            select f->>'column_name' as col, array_agg(f->>'column_value') as vals
            from jsonb_array_elements(p_filter) as f
            group by f->>'column_name'
          ) grouped
          where not (ed.event_attr->>grouped.col = any (grouped.vals))
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

CREATE OR REPLACE FUNCTION public.claim_pending_sent_targets(p_tenant_id uuid, p_email_id text)
 RETURNS SETOF public.sent_emails
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$begin
  if auth.role() <> 'service_role' then
    raise exception 'claim_pending_sent_targets is only allowed for service_role callers';
  end if;

  -- 'approved'(未送信)の宛先から最大100件だけを原子的に'sending'へ遷移させて返す。
  -- UPDATEの行ロックにより、この関数を同時に何回呼んでも
  -- 各宛先行はどれか1回しか claim できない(=同じ宛先への二重送信を防止)
  return query
  with targets as (
    select tracking_token
    from public.sent_emails
    where tenant_id = p_tenant_id
      and email_id = p_email_id
      and status = 'approved'
    limit 100
    for update skip locked -- 同時実行時のデッドロックと待機を防止
  )
  update public.sent_emails
  set status = 'sending'
  from targets
  where public.sent_emails.tracking_token = targets.tracking_token
  returning public.sent_emails.*;
end;$function$
;


