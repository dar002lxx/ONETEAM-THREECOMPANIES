revoke all on public.attendance_logs,public.attendance_requests,public.feed_posts,public.feed_likes,public.feed_comments,public.workplace_offices,public.workspace_items from anon,authenticated;
grant select,insert,update,delete on public.workspace_items,public.workplace_offices to authenticated;
grant select on public.attendance_logs,public.attendance_requests,public.feed_posts,public.feed_likes,public.feed_comments to authenticated;
grant insert(id,owner_id,company,body) on public.attendance_requests to authenticated;
grant insert(id,author_id,company,title,body,media,pinned),delete on public.feed_posts to authenticated;
grant insert(post_id,owner_id),delete on public.feed_likes to authenticated;
grant insert(id,post_id,owner_id,body),delete on public.feed_comments to authenticated;
