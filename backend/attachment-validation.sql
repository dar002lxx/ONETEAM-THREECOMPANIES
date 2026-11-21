-- Applied after schema.sql. Only paths owned by the sender can be attached.
create or replace function private.valid_attachments(items jsonb) returns boolean language sql stable security invoker set search_path='' as $$
 select (select auth.uid()) is not null and not exists(
 select 1 from jsonb_array_elements(items) a
 where jsonb_typeof(a)<>'object' or a->>'path' is null
 or split_part(a->>'path','/',1)<>(select auth.uid())::text
 or length(a->>'path')>500
 or coalesce(a->>'name','')='' or length(a->>'name')>255
 or coalesce(a->>'kind','') not in ('image','file','audio','voice','video')
 ) $$;
revoke all on function private.valid_attachments(jsonb) from public,anon;
grant execute on function private.valid_attachments(jsonb) to authenticated;
alter policy messages_send on public.chat_messages with check(private.is_member() and sender_id=(select auth.uid()) and private.valid_attachments(attachments));

