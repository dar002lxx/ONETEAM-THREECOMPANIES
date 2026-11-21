const {JSDOM}=require('jsdom'),fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(__dirname+'/public/index.html','utf8'),dom=new JSDOM(html,{url:'https://dar002lxx.github.io/ONETEAM-THREECOMPANIES/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,c=dom.getInternalVMContext();
Object.defineProperty(w,'crypto',{value:require('crypto').webcrypto});w.matchMedia=()=>({matches:false,addEventListener(){}});w.ResizeObserver=class{observe(){}disconnect(){}};w.URL.createObjectURL=()=> 'blob:qa';w.URL.revokeObjectURL=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
const members=[{id:'11000000-0000-4000-8000-000000000001',worker_id:'temuulen',name:'Тэмүүлэн',role:'admin',company:'deed',email:'qa@oneteam.invalid',nickname:'QA'},{id:'11000000-0000-4000-8000-000000000002',worker_id:'worker',name:'Ажилтан',role:'worker',company:'sks',email:'qa2@oneteam.invalid'}];let rows=[],session=null,inserted=[],uploads=[];
const mock={auth:{getSession:async()=>({data:{session}}),getUser:async()=>({data:{user:session?.user}}),onAuthStateChange(){},signUp:async()=>({}),signOut:async()=>{},signInWithPassword:async()=>({}),updateUser:async()=>({})},from(table){let mode='read',row;const q={select(){return q},order(){return q},limit(){return q},or(){return q},eq(){return q},is(){return q},lt(){return q},insert(r){mode='insert';row=r;return q},update(r){mode='update';row=r;return q},single:async()=>{if(mode==='insert'){row={...row,created_at:new Date().toISOString()};rows.push(row);inserted.push(row);return {data:row}}return {data:null}},then(resolve,reject){return Promise.resolve({data:table==='members'?members:table==='chat_channels'?[{name:'Бүгд'}]:rows}).then(resolve,reject)}};return q},channel(){const ch={on(){return ch},subscribe(){return ch}};return ch},removeChannel:async()=>{},storage:{from(){return {upload:async path=>{uploads.push(path);return {}},remove:async()=>({}),download:async()=>({data:new w.Blob(['file'])})}}}};
w.supabase={createClient:()=>mock};
(async()=>{
 vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],c);
 assert(!w.document.querySelector('input[name=loginId]'),'SDK failure must fail closed');
 vm.runInContext(fs.readFileSync(__dirname+'/public/online.js','utf8'),c);await new Promise(r=>setTimeout(r,60));
 assert(w.document.querySelector('input[name=loginId]'));assert(!w.document.querySelector('#content').textContent.includes('demo123'));
 vm.runInContext('cloudAdminSetup()',c);assert.equal(w.document.querySelector('input[name=email]').value,'');w.document.querySelector('input[name=email]').value='admin@example.invalid';w.document.querySelector('#modal').close();
 session={user:{id:members[0].id,email:members[0].email}};w.qaSession=session;await vm.runInContext('cloudEnter(qaSession)',c);assert(w.document.querySelector('#cloud-chat-status'));
 w.document.querySelector('#ms-text').value='group QA';await vm.runInContext("sendMessage(document.querySelector('.ms-composer'))",c);assert.equal(inserted[0].sender_id,members[0].id);assert.equal(inserted[0].channel,'Бүгд');
 await vm.runInContext("selectChannel('@worker')",c);w.document.querySelector('#ms-text').value='DM QA';await vm.runInContext("sendMessage(document.querySelector('.ms-composer'))",c);assert.equal(inserted[1].recipient_id,members[1].id);assert.equal(inserted[1].channel,null);
 vm.runInContext("messengerDraft().files.push({id:crypto.randomUUID(),name:'voice.webm',kind:'voice',blob:new Blob(['voice'],{type:'audio/webm'}),url:'blob:qa'})",c);
 await vm.runInContext("sendMessage(document.querySelector('.ms-composer'))",c);assert.equal(inserted[2].attachments[0].kind,'voice');assert(uploads[0].startsWith(members[0].id+'/'));
 vm.runInContext('newWorker()',c);assert(w.document.querySelector('input[name=email]'));assert(w.document.querySelector('input[name=initialPassword]'));w.document.querySelector('#modal').close();
 await vm.runInContext('logout()',c);assert(w.document.querySelector('input[name=loginId]'));assert.equal(vm.runInContext('state.messages.length',c),0);
 console.log('PASS: fail-closed auth, admin setup, roster, group/DM routing, cloud voice upload, worker form, logout clearing');process.exit(0)
})().catch(e=>{console.error(e);process.exit(1)});

