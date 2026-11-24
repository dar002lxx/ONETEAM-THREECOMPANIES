alter table public.workspace_items drop constraint workspace_items_kind_check;
alter table public.workspace_items add constraint workspace_items_kind_check check(kind in ('task','board','report','inbox','note','shift','milestone','feedback','audit'));
alter policy items_read on public.workspace_items using(private.is_member()
 and (kind<>'note' or owner_id=(select auth.uid()))
 and (kind not in ('audit','feedback') or owner_id=(select auth.uid()) or private.is_admin() or (kind='feedback' and body->>'recipient'=(select worker_id from public.members where id=(select auth.uid())))));

