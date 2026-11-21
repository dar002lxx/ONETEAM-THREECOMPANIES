/* Supabase auth, worker management, profiles and realtime chat. */
const cloud=supabase.createClient('https://sipmasrwoqnzhqdbczva.supabase.co','sb_publishable_1j3sV1YzVToN3UYsvZzwqg_Ne4XDiNn');
let cloudSession=null,cloudMembers=[],cloudChannel=null,cloudBusy=false,cloudGeneration=0,cloudStatus='Холбогдож байна…';
async function cloudAccount(body){
 const {data:{session}}=await cloud.auth.getSession();
 const response=await fetch('https://sipmasrwoqnzhqdbczva.supabase.co/functions/v1/workspace-accounts',{method:'POST',headers:{'Content-Type':'application/json',apikey:'sb_publishable_1j3sV1YzVToN3UYsvZzwqg_Ne4XDiNn',...(session?{Authorization:'Bearer '+session.access_token}:{})},body:JSON.stringify(body)});
 const result=await response.json();if(!response.ok)throw Error(result.error||'Хүсэлт амжилтгүй.');return result;
}
function cloudError(e){toast(e?.message||'Холболтоо шалгаад дахин оролдоно уу.')}
function cloudNotice(){
 const el=$('.online-preview-status');if(el)el.innerHTML='<b>☁ Онлайн</b> Нэвтрэлт · профайл · чат синктэй. Ажил, ирц, пост, амжилт одоогоор энэ хөтөч дээр хадгалагдана.';
 const foot=$('#foot');if(foot)foot.textContent='SKS · DEED MOTORS · JAPANSHOP.mn · Нэвтрэлт, профайл, чат — онлайн · Бусад хэсэг — хөтчийн хадгалалт';
}
loginScreen=function(){
 $('#content').innerHTML='<div class="loginprefs">'+toolbar()+'</div><div class="login"><div class="loginlogos">'+companies.map(c=>'<img src="'+c.logo+'" alt="'+esc(c.name)+'">').join('')+'</div><div class="loginhero">ONE TEAM · THREE COMPANIES</div><h1>Багтайгаа холбогдоорой.</h1><p class="muted">Өөрийн ID эсвэл имэйл, нууц үгээр нэвтэрнэ үү.</p><form onsubmit="event.preventDefault();doLogin(this)"><label>ID / Имэйл<input name="loginId" required autocomplete="username" maxlength="254" autocapitalize="none" spellcheck="false"></label><label>Нууц үг<input name="password" type="password" required autocomplete="current-password" maxlength="128"></label><button class="primary" type="submit">Нэвтрэх →</button><p id="login-error" role="alert"></p></form><p class="notice">☁ Хамгаалалттай нэвтрэлт · Чат, хавсралт төхөөрөмж хооронд синк хийнэ. Ажилтны эрхийг админ үүсгэнэ.</p><button type="button" onclick="cloudAdminSetup()">Анхны админ эрхээ идэвхжүүлэх</button></div>';cloudNotice();
};
function cloudAdminSetup(){
 modal('<h2>Админ эрхээ идэвхжүүлэх</h2><p class="muted">Өөрийн шинэ нууц үгийг тохируулаарай.</p><form onsubmit="event.preventDefault();cloudRegister(this)"><label>Имэйл<input required type="email" name="email" autocomplete="email"></label><label>Шинэ нууц үг<input name="password" type="password" required minlength="10" maxlength="128" autocomplete="new-password"></label><label>Нууц үг давтах<input name="confirm" type="password" required minlength="10" autocomplete="new-password"></label><p id="cloud-setup-result" role="status"></p><button class="primary" type="submit">Эрх идэвхжүүлэх</button><button type="button" onclick="closeModal()">Хаах</button></form>');
}
async function cloudRegister(f){
 const b=f.querySelector('[type=submit]'),r=$('#cloud-setup-result');if(f.password.value!==f.confirm.value){r.textContent='Нууц үгийн давталт ижил байх ёстой.';return}b.disabled=true;
 try{const {error}=await cloud.auth.signUp({email:f.email.value.trim().toLowerCase(),password:f.password.value,options:{emailRedirectTo:location.origin+location.pathname}});if(error)throw error;f.reset();r.textContent='Баталгаажуулах имэйлээ шалгана уу. Имэйл дэх холбоосыг дарж баталгаажуулаад энэ веб рүү буцаж шинэ нууц үгээрээ нэвтэрнэ үү. Өмнө нь бүртгүүлсэн бол нэвтрэх хэсгийг ашиглана.'}catch(e){r.textContent=e.message}finally{b.disabled=false}
}
doLogin=async function(f){
 const b=f.querySelector('[type=submit]');if(b.disabled)return;b.disabled=true;$('#login-error').textContent='';
 try{const r=await cloudAccount({action:'login',login:f.loginId.value.trim(),password:f.password.value});const {error}=await cloud.auth.setSession(r.session);if(error)throw error;await cloudEnter(r.session)}catch(e){if($('#login-error'))$('#login-error').textContent=e.message}finally{b.disabled=false}
};
async function cloudDirectory(){
 const {data,error}=await cloud.from('members').select('*').order('created_at');if(error)throw error;
 cloudMembers=data;people.splice(0,people.length,...data.map(m=>({id:m.worker_id,authId:m.id,name:m.name,role:m.role==='admin'?'Удирдлага':'Ажилтан',initial:Array.from(m.name)[0]})));
 state.profiles={};state.credentials={};state.staffAssignments={};state.staffDirectory=[];
 for(const m of data){state.staffAssignments[m.worker_id]=m.company;state.credentials[m.worker_id]={login:m.worker_id};state.profiles[m.worker_id]={nickname:m.nickname,phone:m.phone,email:m.email,birthday:m.birthday||'',photo:m.photo};}
}
function cloudMerge(rows){
 const all=new Map(state.messages.map(m=>[m.id,m]));
 for(const r of rows){const sender=cloudMembers.find(p=>p.id===r.sender_id),recipient=cloudMembers.find(p=>p.id===r.recipient_id);if(!sender)continue;
 all.set(r.id,{id:r.id,senderId:sender.worker_id,name:sender.name,company:sender.company,channel:recipient?'@'+recipient.worker_id:r.channel,text:r.body,at:Date.parse(r.created_at),createdAt:r.created_at,attachments:r.attachments||[],reply:r.reply,...(recipient?{pair:[sender.worker_id,recipient.worker_id].sort().join(':')}:{})});}
 state.messages=[...all.values()].sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));
}
async function cloudGetChannels(){const {data,error}=await cloud.from('chat_channels').select('name').order('created_at');if(error)throw error;state.channels=data.map(c=>c.name)}
async function cloudGetMessages(target=null,before=null){
 const gen=cloudGeneration;let q=cloud.from('chat_messages').select('*').order('created_at',{ascending:false}).order('id',{ascending:false}).limit(100);
 if(target?.startsWith('@')){const p=people.find(p=>p.id===target.slice(1));if(!p)return [];q=q.or('and(sender_id.eq.'+cloudSession.user.id+',recipient_id.eq.'+p.authId+'),and(sender_id.eq.'+p.authId+',recipient_id.eq.'+cloudSession.user.id+')')}
 else if(target)q=q.eq('channel',target).is('recipient_id',null);
 if(before)q=q.lt('created_at',before);
 const {data,error}=await q;if(error)throw error;if(gen!==cloudGeneration)return [];cloudMerge(data);return data;
}
async function cloudEnter(session){
 if(cloudBusy)return;cloudBusy=true;
 try{cloudSession=session;state.messages=[];await cloudDirectory();await cloudGetChannels();user=people.find(p=>p.authId===session.user.id);if(!user)throw Error('Ажилтны бүртгэл олдсонгүй.');scope=isAdmin()?'all':assignedCompany(user.id);channel=state.channels[0]||'Бүгд';await cloudGetMessages();view='chat';render();cloudSubscribe();await cloudGetMessages(channel);cloudPaint()}finally{cloudBusy=false}
}
function cloudSubscribe(){
 if(cloudChannel)cloud.removeChannel(cloudChannel);
 cloudChannel=cloud.channel('workspace-'+cloudSession.user.id)
 .on('postgres_changes',{event:'INSERT',schema:'public',table:'chat_messages'},p=>{cloudMerge([p.new]);cloudPaint()})
 .on('postgres_changes',{event:'*',schema:'public',table:'chat_channels'},()=>cloudGetChannels().then(cloudPaint).catch(cloudError))
 .on('postgres_changes',{event:'*',schema:'public',table:'members'},async()=>{try{const id=cloudSession?.user.id;await cloudDirectory();user=people.find(p=>p.authId===id);if(!user)return logout();cloudPaint()}catch(e){cloudError(e)}})
 .subscribe(status=>{cloudStatus=status==='SUBSCRIBED'?'● Шууд холбогдсон':status==='CHANNEL_ERROR'||status==='TIMED_OUT'?'⚠ Дахин холбогдож байна…':'Холбогдож байна…';if($('#cloud-chat-status'))$('#cloud-chat-status').textContent=cloudStatus;if(status==='SUBSCRIBED')cloudGetMessages(channel).then(cloudPaint).catch(cloudError)});
}
const cloudRenderBase=render;render=function(){if(!cloudSession)user=null;cloudRenderBase();cloudNotice()};
const cloudChatBase=chat;chat=function(){
 if(!cloudSession||!user)return;cloudChatBase();const note=$('.ms-demo');if(note)note.innerHTML='<span id="cloud-chat-status">'+esc(cloudStatus)+'</span> · Мессеж, зураг, файл, дуу — төхөөрөмж хооронд синк хийнэ';
 $('#ms-messages')?.insertAdjacentHTML('afterbegin','<button class="tiny" id="cloud-older" onclick="cloudOlder(this)" type="button">Өмнөх мессежүүд</button>');
 document.querySelectorAll('.ms-message-meta [title]').forEach(e=>e.title='Серверт хадгалсан');
};
function cloudPaint(){
 if(view!=='chat'||!user)return;const input=$('#ms-text'),focused=document.activeElement===input,start=input?.selectionStart,end=input?.selectionEnd,list=$('#ms-messages'),top=list?.scrollTop||0,bottom=!list||list.scrollHeight-list.scrollTop-list.clientHeight<90;
 chat();if(focused){$('#ms-text')?.focus();$('#ms-text')?.setSelectionRange(start,end)}if(!bottom&&$('#ms-messages'))$('#ms-messages').scrollTop=top;
}
selectChannel=async function(c){if(!user)return;channel=c;messengerMobile=true;messengerFilter='';chat();try{await cloudGetMessages(c);if(channel===c)cloudPaint()}catch(e){cloudError(e)}};
async function cloudOlder(b){
 b.disabled=true;try{const target=channel,first=state.messages.filter(m=>messengerVisible(m,target))[0];if(!first){b.textContent='Мессеж алга';return}
 const rows=await cloudGetMessages(target,first.createdAt||new Date(first.at).toISOString());if(channel!==target)return;
 const box=$('#ms-messages'),height=box.scrollHeight,top=box.scrollTop;cloudPaint();$('#ms-messages').scrollTop=top+$('#ms-messages').scrollHeight-height;
 if(rows.length<100){$('#cloud-older').disabled=true;$('#cloud-older').textContent='Ярианы эхлэл'}}catch(e){cloudError(e);b.disabled=false}
}
newGroup=function(){modal('<h2>Шинэ групп</h2><p class="muted">Групп бүх гурван компанийн ажилтанд харагдана. Хувийн ярианд ажилтныг сонгоно уу.</p><form onsubmit="event.preventDefault();createGroup(this)"><label>Группийн нэр<input name="name" required maxlength="40"></label><button class="primary" type="submit">Үүсгэх</button><button type="button" onclick="closeModal()">Болих</button></form>')};
createGroup=async function(f){
 const name=f.elements.name.value.trim();if(!user||!name||name.length>40||name.startsWith('@'))return;
 const b=f.querySelector('[type=submit]');b.disabled=true;try{const {error}=await cloud.from('chat_channels').insert({name,created_by:cloudSession.user.id});if(error)throw Error('Нэр давхардсан эсвэл холболтын алдаа гарлаа.');await cloudGetChannels();closeModal();await selectChannel(name)}catch(e){cloudError(e)}finally{b.disabled=false}
};
sendMessage=async function(f){
 if(!user||!cloudSession||messengerSending||voiceSession)return;
 const d=messengerDraft(),text=f.elements.text.value.trim(),target=channel,owner=cloudSession.user.id,key=messengerKey(),uploaded=[];d.text=f.elements.text.value;
 if((!text&&!d.files.length)||text.length>3000)return;messengerSending=true;f.querySelector('[type=submit]').disabled=true;f.elements.text.readOnly=true;
 try{const attachments=[];for(const a of d.files){const path=owner+'/'+crypto.randomUUID();const {error}=await cloud.storage.from('chat-media').upload(path,a.blob,{contentType:a.blob.type||'application/octet-stream',upsert:false});if(error)throw error;uploaded.push(path);attachments.push({id:a.id,path,name:a.name,size:a.blob.size,type:a.blob.type,kind:a.kind})}
 if(cloudSession?.user.id!==owner)throw Error('Нэвтрэлт өөрчлөгдсөн.');
 const p=target.startsWith('@')?people.find(p=>p.id===target.slice(1)):null;if(target.startsWith('@')&&!p)throw Error('Ажилтан олдсонгүй.');
 const {data,error}=await cloud.from('chat_messages').insert({id:crypto.randomUUID(),sender_id:owner,recipient_id:p?.authId||null,channel:p?null:target,body:text,attachments,reply:d.reply||null}).select().single();if(error)throw error;
 cloudMerge([data]);for(const a of d.files)URL.revokeObjectURL(a.url);messengerDrafts.delete(key);messengerSending=false;if(view==='chat'&&channel===target)chat();
 }catch(e){if(uploaded.length)await cloud.storage.from('chat-media').remove(uploaded);cloudError(e);messengerSending=false;if(user&&view==='chat')cloudPaint()}finally{messengerSending=false;if(f.isConnected){f.elements.text.readOnly=false;f.querySelector('[type=submit]').disabled=false}}
};
messengerStore=async function(mode,id){
 if(mode!=='readonly')throw Error('Хавсралт серверт хадгалагдана.');const a=messengerFindAttachment(id);if(!a?.path)throw Error('Хавсралт олдсонгүй.');const {data,error}=await cloud.storage.from('chat-media').download(a.path);if(error)throw error;return data;
};
newWorker=function(){
 if(!isAdmin())return permissionDenied();modal('<h2>Ажилтны онлайн эрх үүсгэх</h2><form onsubmit="event.preventDefault();createWorker(this)"><label>Овог, нэр<input name="fullName" required maxlength="100"></label><label>Имэйл<input name="email" required type="email" autocomplete="off"></label><label>Нэвтрэх ID<input name="username" required pattern="[a-z][a-z0-9._-]{2,39}" maxlength="40" autocapitalize="none"></label><label>Компани<select name="company">'+companies.map(c=>'<option value="'+c.id+'">'+esc(c.name)+'</option>').join('')+'</select></label><label>Эхний нууц үг<input name="initialPassword" required type="password" minlength="10" maxlength="128" autocomplete="new-password"></label><label>Нууц үг давтах<input name="confirmPassword" required type="password" autocomplete="new-password"></label><p class="muted">Ажилтан ID эсвэл имэйлээрээ нэвтэрч, нууц үгээ өөрчилж болно.</p><p id="cloud-worker-error" role="alert"></p><button class="primary" type="submit">Эрх үүсгэх</button><button type="button" onclick="closeModal()">Болих</button></form>');
};
createWorker=async function(f){
 if(!isAdmin())return;const b=f.querySelector('[type=submit]');if(f.initialPassword.value!==f.confirmPassword.value){$('#cloud-worker-error').textContent='Нууц үгийн давталт ижил биш байна.';return}b.disabled=true;
 try{await cloudAccount({action:'create',worker_id:f.username.value,email:f.email.value,name:f.fullName.value,company:f.company.value,password:f.initialPassword.value});await cloudDirectory();closeModal();render();toast('Ажилтны онлайн эрх үүслээ.')}catch(e){$('#cloud-worker-error').textContent=e.message}finally{b.disabled=false}
};
saveCredentials=async function(f,id){
 if(!isAdmin())return;const p=people.find(p=>p.id===id);if(!p)return;
 if(f.newPassword.value!==f.confirmPassword.value)return toast('Нууц үгийн давталт ижил биш байна.');const b=f.querySelector('button');b.disabled=true;
 try{await cloudAccount({action:'credentials',id:p.authId,worker_id:f.loginId.value,password:f.newPassword.value});await cloudDirectory();user=people.find(p=>p.authId===cloudSession.user.id);closeModal();render();toast('Онлайн нэвтрэх эрх шинэчлэгдлээ.')}catch(e){cloudError(e)}finally{b.disabled=false}
};
changeMyPassword=async function(f){
 if(!cloudSession||profileSaveBusy)return;const error=$('#up-password-error'),b=f.querySelector('[type=submit]'),password=f.newPassword.value;
 if(password.length<10||password.length>128||password!==f.confirmPassword.value||password===f.currentPassword.value){error.textContent='10–128 тэмдэгттэй шинэ нууц үг болон давталтаа шалгана уу.';return}profileSaveBusy=true;b.disabled=true;
 try{const {error:e}=await cloud.auth.signInWithPassword({email:cloudSession.user.email,password:f.currentPassword.value});if(e)throw Error('Одоогийн нууц үг буруу.');const {error:update}=await cloud.auth.updateUser({password});if(update)throw update;closeModal();toast('Нууц үг серверт шинэчлэгдлээ.')}catch(e){error.textContent=e.message}finally{profileSaveBusy=false;b.disabled=false}
};
saveMyProfile=async function(f){
 if(!cloudSession||profilePhotoLoading||profileSaveBusy)return;profileSaveBusy=true;const b=f.querySelector('[type=submit]');b.disabled=true;
 try{const d=Object.fromEntries(new FormData(f));if(!validProfileBirthday(d.birthday)||d.nickname.length>40)throw Error('Нэр, төрсөн өдрөө шалгана уу.');
 const {error}=await cloud.from('members').update({nickname:d.nickname.trim(),phone:d.phone.trim(),email:d.email.trim(),birthday:d.birthday||null,photo:profilePhotoDraft}).eq('id',cloudSession.user.id);if(error)throw error;await cloudDirectory();closeModal();render();toast('Профайл синк хийгдлээ.')}catch(e){$('#up-profile-error').textContent=e.message}finally{profileSaveBusy=false;b.disabled=false}
};
const cloudProfileBase=openMyProfile;openMyProfile=function(){cloudProfileBase();const hint=$('.up-profile-hint');if(hint)hint.textContent='Энэ мэдээлэл багийн ажилтнуудад харагдана. Энд зассан имэйл нь холбоо барих хаяг; нэвтрэх имэйл өөрчлөгдөхгүй.'};
logout=async function(){
 cloudGeneration++;if(cloudChannel)await cloud.removeChannel(cloudChannel);cloudChannel=null;cloudSession=null;state.messages=[];state.profiles={};messengerDrafts.clear();messengerReleaseMedia();people.splice(0);user=null;closeUserMenu();if($('#modal').open)closeModal();await cloud.auth.signOut();render();
};
cloud.auth.onAuthStateChange((event,session)=>{
 if(event==='TOKEN_REFRESHED'&&session)cloudSession=session;
 if(event==='SIGNED_IN'&&session&&!cloudSession&&!cloudBusy)setTimeout(()=>cloudEnter(session).catch(cloudError),0);
 if(event==='SIGNED_OUT'){cloudGeneration++;cloudSession=null;user=null;state.messages=[];if(cloudChannel)cloud.removeChannel(cloudChannel);cloudChannel=null;render();}
});
window.addEventListener('online',()=>{if(cloudSession)cloudGetMessages(channel).then(cloudPaint).catch(cloudError)});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&cloudSession)cloudGetMessages(channel).then(cloudPaint).catch(cloudError)});
user=null;state.messages=[];state.session=null;render();
cloud.auth.getSession().then(async({data:{session},error})=>{if(error)throw error;if(session){const {error:verify}=await cloud.auth.getUser();if(verify)throw verify;await cloudEnter(session)}}).catch(e=>{cloudSession=null;user=null;render();cloudError(e)});

