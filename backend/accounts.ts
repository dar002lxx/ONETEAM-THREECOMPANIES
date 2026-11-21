import { createClient } from 'npm:@supabase/supabase-js@2.89.0';
const url=Deno.env.get('SUPABASE_URL')!, key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const allowed='https://dar002lxx.github.io';
const headers={'Access-Control-Allow-Origin':allowed,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
Deno.serve(async req=>{
 const respond=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{headers});
 if(req.method!=='POST')return respond({error:'Method not allowed'},405);
 if(req.headers.get('origin')&&req.headers.get('origin')!==allowed)return respond({error:'Forbidden'},403);
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 try {
  const body=await req.json();
  if(body.action==='login'){
   const login=String(body.login||'').trim().toLowerCase();
   if(!login||typeof body.password!=='string'||body.password.length>128)return respond({error:'ID эсвэл нууц үг буруу.'},400);
   let email=login;
   if(!login.includes('@')){const {data}=await db.from('members').select('id').eq('worker_id',login).maybeSingle();const account=data?await db.auth.admin.getUserById(data.id):null;email=account?.data?.user?.email||'invalid@example.invalid';}
   const client=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
   const {data,error}=await client.auth.signInWithPassword({email,password:body.password});
   if(error||!data.session)return respond({error:'ID эсвэл нууц үг буруу, эсвэл имэйл баталгаажаагүй байна.'},401);
   return respond({session:data.session});
  }
  const token=(req.headers.get('Authorization')||'').replace(/^Bearer /,'');
  const {data:{user},error}=await db.auth.getUser(token);
  if(error||!user)return respond({error:'Нэвтэрнэ үү.'},401);
  const {data:actor}=await db.from('members').select('role').eq('id',user.id).single();
  if(actor?.role!=='admin')return respond({error:'Админ эрх шаардлагатай.'},403);
  const workerId=String(body.worker_id||'').trim().toLowerCase();
  if(!/^[a-z][a-z0-9._-]{2,39}$/.test(workerId))return respond({error:'ID: 3–40 латин тэмдэгт.'},400);
  if(body.action==='create'){
   const email=String(body.email||'').trim().toLowerCase(),name=String(body.name||'').trim();
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!name||name.length>100||!['deed','sks','japan'].includes(body.company)||typeof body.password!=='string'||body.password.length<10||body.password.length>128)return respond({error:'Мэдээлэл болон 10–128 тэмдэгттэй нууц үгээ шалгана уу.'},400);
   // Only this endpoint can enroll workers; the directory is never exposed to clients.
   const {error:enroll}=await db.rpc('workspace_prepare_worker',{p_email:email,p_worker:workerId,p_name:name,p_company:body.company});
   if(enroll)return respond({error:'Имэйл эсвэл ID бүртгэлтэй байна.'},409);
   const {data:created,error:createError}=await db.auth.admin.createUser({email,password:body.password,email_confirm:true});
   if(createError){await db.rpc('workspace_cancel_worker',{p_email:email});return respond({error:'Эрх үүсгэж чадсангүй. Имэйл бүртгэлтэй эсэхийг шалгана уу.'},400);}
   return respond({id:created.user.id});
  }
  if(body.action==='credentials'){
   const {data:target}=await db.from('members').select('id,email').eq('id',body.id).single();
   if(!target)return respond({error:'Ажилтан олдсонгүй.'},404);
   if(body.password&&(typeof body.password!=='string'||body.password.length<10||body.password.length>128))return respond({error:'Нууц үг 10–128 тэмдэгт байна.'},400);
   const {error:changed}=await db.rpc('workspace_change_worker_id',{p_id:target.id,p_worker:workerId});
   if(changed)return respond({error:'ID бүртгэлтэй байна.'},409);
   if(body.password){const {error:e}=await db.auth.admin.updateUserById(target.id,{password:body.password});if(e)return respond({error:'ID шинэчлэгдсэн. Нууц үг шинэчлэхэд алдаа гарлаа.'},400);}
   return respond({success:true});
  }
  return respond({error:'Unknown action'},400);
 }catch{return respond({error:'Хүсэлт амжилтгүй. Дахин оролдоно уу.'},400);}
});

