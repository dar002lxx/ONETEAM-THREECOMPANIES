begin;
insert into private.directory(email,worker_id,name,company) values
('qa-a@oneteam.invalid','qa_test_a','QA A','deed'),('qa-b@oneteam.invalid','qa_test_b','QA B','sks'),('qa-c@oneteam.invalid','qa_test_c','QA C','japan');
insert into auth.users(id,email,aud,role) values
('11000000-0000-4000-8000-000000000001','qa-a@oneteam.invalid','authenticated','authenticated'),
('11000000-0000-4000-8000-000000000002','qa-b@oneteam.invalid','authenticated','authenticated'),
('11000000-0000-4000-8000-000000000003','qa-c@oneteam.invalid','authenticated','authenticated');
insert into public.chat_channels(name) values('QA rollback only');
insert into public.chat_messages(sender_id,recipient_id,channel,body,attachments) values
('11000000-0000-4000-8000-000000000001',null,'QA rollback only','group','[]'),
('11000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000002',null,'private','[{"path":"11000000-0000-4000-8000-000000000001/qa-file"}]');
insert into storage.objects(bucket_id,name) values('chat-media','11000000-0000-4000-8000-000000000001/qa-file');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$ begin
 if (select count(*) from public.chat_messages where body in ('group','private'))<>2 then raise exception 'Sender access failed';end if;
 if (select count(*) from storage.objects where bucket_id='chat-media')<>1 then raise exception 'Owner file access failed';end if;
 begin update public.members set role='admin' where id=auth.uid();raise exception 'Role escalation allowed';exception when insufficient_privilege then null;end;
 begin insert into public.chat_messages(sender_id,channel,body) values('11000000-0000-4000-8000-000000000002','QA rollback only','spoof');raise exception 'Spoof allowed';exception when insufficient_privilege then null;end;
 begin insert into public.chat_messages(sender_id,channel,body,attachments) values(auth.uid(),'QA rollback only','stolen reference','[{"path":"11000000-0000-4000-8000-000000000002/private-file","name":"stolen"}]');raise exception 'Foreign file republishing allowed';exception when insufficient_privilege then null;end;
 insert into public.chat_messages(sender_id,channel,body,attachments) values(auth.uid(),'QA rollback only','valid attachment','[{"path":"11000000-0000-4000-8000-000000000001/own-file","name":"own","kind":"file"}]');
 begin perform public.workspace_prepare_worker('forbidden@oneteam.invalid','forbidden','Bad','deed');raise exception 'Admin RPC exposed';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"11000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$ begin
 if (select count(*) from public.chat_messages where body in ('group','private'))<>2 then raise exception 'Recipient access failed';end if;
 if (select count(*) from storage.objects where bucket_id='chat-media')<>1 then raise exception 'Recipient file access failed';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"11000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $$ begin
 if (select count(*) from public.chat_messages where body in ('group','private'))<>1 then raise exception 'Private DM leaked';end if;
 if (select count(*) from storage.objects where bucket_id='chat-media')<>0 then raise exception 'Private file leaked';end if;
 update public.members set nickname='QA changed' where id='11000000-0000-4000-8000-000000000001';
 if found then raise exception 'Changed another profile';end if;
end $$;
reset role;
rollback;
select 'PASS: DM and file isolation; spoofing, role escalation and privileged RPC blocked; fixtures rolled back' as result;
