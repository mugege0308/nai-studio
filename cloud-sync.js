/* NAI Prompt Studio v13 - Firebase Realtime Database private sync.
   No sync is performed until the user signs in and explicitly chooses an initial direction.
   Data uses /users/{uid}/profile and /users/{uid}/snapshots/{id} with owner-only rules.
*/
(()=>{
'use strict';
const el=id=>document.getElementById(id);
const note=(message,error=false)=>{el('cloudStatus').textContent=message;el('cloudStatus').style.color=error?'#ffc2c4':'var(--good)'};
const availability=el('cloudAvailability');
const cfg=window.NAI_FIREBASE_CONFIG;
if(!cfg || !cfg.apiKey || !cfg.authDomain || !cfg.databaseURL || !cfg.projectId || !cfg.appId){
 availability.textContent='クラウド未設定。現在はローカル保存で使えます。公開版を使うには firebase-config.js を設定してください。';
 return;
}
if(!window.firebase || !firebase.auth || !firebase.database){
 availability.textContent='Firebase SDKを読み込めませんでした。接続を確認してください。ローカル保存は使えます。';
 return;
}
if(location.protocol!=='https:' && location.hostname!=='localhost' && location.hostname!=='127.0.0.1'){
 availability.textContent='クラウド同期はHTTPSで公開したサイト、またはlocalhostから使ってください。現在はローカル保存です。';
 return;
}
let app,auth,db;
try{
 app=firebase.apps.length?firebase.app():firebase.initializeApp(cfg);
 auth=app.auth();db=app.database();
 availability.textContent='Firebaseに接続できます。最初に同期用アカウントでログインしてください。';
}catch(e){availability.textContent='Firebase初期化エラー：'+e.message;return}

let uid=null,root=null,profileRef=null,snapsRef=null,active=false,suppress=false;
let stateTimer=0,snapTimer=0,statePending=false,snapsPending=false;
let remoteSnapshots={},lastProfile=null; // data of latest server event
let lastLocalEditAt=0;
const deviceId=(()=>{
 try{let x=localStorage.getItem('nai_device_id_v13');if(!x){x='dev-'+Math.random().toString(36).slice(2)+'-'+Date.now().toString(36);localStorage.setItem('nai_device_id_v13',x)}return x}catch(e){return 'dev-'+Math.random().toString(36).slice(2)}
})();
function dirtyState(){
 if(!active||suppress)return;
 statePending=true;lastLocalEditAt=Date.now();
 clearTimeout(stateTimer);stateTimer=setTimeout(()=>pushProfile(),5500);
}
function dirtySnapshots(){
 if(!active||suppress)return;
 snapsPending=true;
 clearTimeout(snapTimer);snapTimer=setTimeout(()=>pushSnapshots(),550);
}
document.addEventListener('nai:statechanged',dirtyState);
document.addEventListener('nai:snapshotschanged',dirtySnapshots);
function saveLocalIncoming(){
 try{localStorage.setItem(SNAPSHOTS_KEY,JSON.stringify(savedSnapshots));return true}catch(e){note('端末保存容量の上限に達しました。既存の保存データは維持しています。JSONバックアップを取ってください。',true);return false}
}
function cleanRemoteSnapObjects(remote){
 const output={};
 for(const [id,item] of Object.entries(remote||{})){
  if(!item||typeof item!=='object'||!item.state)continue;
  output[id]={id:item.id||id,name:item.name||'設定',date:item.date||'',state:item.state,imageData:item.imageData||''};
 }
 return output;
}
function applyIncomingProfile(value){
 if(!value||!value.state)return;
 suppress=true;
 try{
  applySettings(value.state); // v12 compatibility: also saves all form fields locally
  if(value.customLooks && typeof value.customLooks==='object' && !Array.isArray(value.customLooks)){
   const previousLooks=customLooks;customLooks=normalizeCustomLooks(value.customLooks);if(!persistCustomLooks())customLooks=previousLooks;renderCustomLooks();
  }
  if(Array.isArray(value.favoriteTags)){
   favoriteTags=value.favoriteTags;saveFavorites();renderTagList();
  }
  if(typeof value.draftImageData==='string')setDraftImage(isSavedImage(value.draftImageData)?value.draftImageData:'');
 }finally{suppress=false}
}
function applyIncomingSnapshots(value){
 suppress=true;
 try{
  const all=cleanRemoteSnapObjects(value);
   const previous=savedSnapshots;
   savedSnapshots=validateSnapshots(Object.values(all).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))));
   if(!saveLocalIncoming()){savedSnapshots=previous;return}
   renderSnapshots();
 }finally{suppress=false}
}
function profilePayload(){return {state:captureSettings(),customLooks,favoriteTags,draftImageData,updatedAt:firebase.database.ServerValue.TIMESTAMP,source:deviceId}}
function snapshotsPayload(){const out={};for(const s of savedSnapshots)out[s.id]={id:s.id,name:s.name,date:s.date,state:s.state,imageData:isSavedImage(s.imageData)?s.imageData:''};return out}
async function pushProfile(){
 if(!active||!profileRef||suppress)return;
 if(!statePending)return;
 statePending=false;
 try{
  await profileRef.set(profilePayload());
  note('編集内容をクラウドに同期しました。');
 }catch(e){statePending=true;note('編集中の設定を同期できません：'+e.message,true)}
}
async function pushSnapshots(){
 if(!active||!snapsRef||suppress)return;
 if(!snapsPending)return;
 snapsPending=false;
 try{
   const current=snapshotsPayload(),updates=[];
   for(const [id,s] of Object.entries(current))if(JSON.stringify(remoteSnapshots[id])!==JSON.stringify(s))updates.push([id,s]);
   for(const id of Object.keys(remoteSnapshots))if(!current[id])updates.push([id,null]);
   // Write one snapshot per request so 200 image-bearing entries do not become one oversized RTDB update.
   for(const [id,s] of updates){
    if(s===null){await snapsRef.child(id).remove();delete remoteSnapshots[id]}
    else{await snapsRef.child(id).set(s);remoteSnapshots[id]=s}
   }
  note('画像付き保存セットをクラウドに同期しました。');
 }catch(e){snapsPending=true;note('保存セットの同期に失敗：'+e.message,true)}
}
function detach(){
 clearTimeout(stateTimer);clearTimeout(snapTimer);
 if(profileRef)profileRef.off();if(snapsRef)snapsRef.off();
 active=false;statePending=false;snapsPending=false;
 uid=null;root=null;profileRef=null;snapsRef=null;remoteSnapshots={};lastProfile=null;
 el('cloudLiveChoices').classList.add('hide');el('cloudFirstChoice').classList.add('hide');
}
function listen(){
 if(!uid||!root)return;
 profileRef=root.child('profile');snapsRef=root.child('snapshots');active=true;
 el('cloudFirstChoice').classList.add('hide');el('cloudLiveChoices').classList.remove('hide');
 profileRef.on('value',s=>{
  const value=s.val();lastProfile=value;
  if(!value||value.source===deviceId)return;
  if(statePending){note('別端末の変更を検出。編集中のため反映を保留しています。必要なら「クラウドから読み直す」を押してください。',true);return}
  applyIncomingProfile(value);note('別端末で保存された設定を受信しました。');
 },e=>note('設定の受信に失敗：'+e.message,true));
 snapsRef.on('value',s=>{
  const value=s.val()||{};remoteSnapshots=cleanRemoteSnapObjects(value);
  if(snapsPending)return;
  applyIncomingSnapshots(remoteSnapshots);
 },e=>note('保存セットの受信に失敗：'+e.message,true));
 localStorage.setItem('nai_cloud_active_'+uid,'1');
 note('クラウド同期ON。ほかの端末でも同じアカウントでログインしてください。');
}
function importCloudRoot(remote){
 suppress=true;
 try{
  if(remote.profile)applyIncomingProfile(remote.profile);
  applyIncomingSnapshots(remote.snapshots||{});
 }finally{suppress=false}
}
async function cloudPull(){
 if(!root)return false;
 const s=await root.once('value'),val=s.val();
 if(!val||!val.profile){note('クラウドにデータがありません。最初のPCで「この端末の設定をクラウドに保存」を選んでください。',true);return false}
 importCloudRoot(val);remoteSnapshots=cleanRemoteSnapObjects(val.snapshots||{});
 return true;
}
async function cloudUpload(){
 if(!root)return false;
 // Bulk initial upload is explicit and confirmed; write snapshots individually to avoid oversized single writes.
 const remote=await root.child('snapshots').once('value');
 const existing=Object.keys(remote.val()||{}),items=snapshotsPayload();
 await root.child('profile').set(profilePayload());
 // Upload each snapshot separately: avoids oversized multi-megabyte database writes.
 for(const id of existing)if(!items[id])await root.child('snapshots').child(id).remove();
 for(const [id,s] of Object.entries(items))await root.child('snapshots').child(id).set(s);
 remoteSnapshots=items;
 return true;
}
async function beginInitial(kind){
 if(!root)return;
 if(kind==='upload' && !confirm('クラウドの既存データを、この端末の設定・画像付き保存セットで上書きします。JSONバックアップは作成しましたか？'))return;
 if(kind==='download' && !confirm('この端末の編集中データ・保存セットをクラウド側の内容で置き換えます。先にJSONバックアップを作ることをおすすめします。続けますか？'))return;
 try{
  note('クラウドと通信しています…');
  if(kind==='upload')await cloudUpload();else if(!await cloudPull())return;
  listen();
 }catch(e){note('初回同期に失敗：'+e.message,true)}
}
async function manualReload(){
 if(!confirm('この端末の編集中データをクラウドの内容で置き換えます。続行しますか？'))return;
 try{
  suppress=true;statePending=false;snapsPending=false;clearTimeout(stateTimer);clearTimeout(snapTimer);
  if(await cloudPull())note('クラウドの内容を読み直しました。');
 }catch(e){note('読み込み失敗：'+e.message,true)}finally{suppress=false}
}
async function manualSave(){
 if(!confirm('クラウドの保存内容をこの端末の内容で上書きします。続行しますか？'))return;
 try{clearTimeout(stateTimer);clearTimeout(snapTimer);statePending=false;snapsPending=false;await cloudUpload();note('この端末の全設定と保存セットをクラウドへ上書きしました。')}
 catch(e){note('保存失敗：'+e.message,true)}
}
el('cloudFirstUpload').onclick=()=>beginInitial('upload');
el('cloudFirstDownload').onclick=()=>beginInitial('download');
el('cloudManualPull').onclick=manualReload;
el('cloudManualPush').onclick=manualSave;
el('cloudSignIn').onclick=async()=>{
 try{
  note('ログイン中…');await auth.signInWithEmailAndPassword(el('cloudEmail').value.trim(),el('cloudPassword').value);
  el('cloudPassword').value='';
 }catch(e){note('ログインできません：'+e.message,true)}
};
el('cloudSignUp').onclick=async()=>{
 if(!confirm('入力したメールアドレスで同期用アカウントを新規作成します。続けますか？'))return;
 try{
  note('アカウント作成中…');await auth.createUserWithEmailAndPassword(el('cloudEmail').value.trim(),el('cloudPassword').value);
  el('cloudPassword').value='';
 }catch(e){note('アカウント作成に失敗：'+e.message,true)}
};
el('cloudSignOut').onclick=async()=>{try{await auth.signOut();note('ログアウトしました。端末内の設定は残っています。')}catch(e){note(e.message,true)}};
auth.onAuthStateChanged(async user=>{
 detach();
 if(!user){
  el('cloudLoginArea').classList.remove('hide');el('cloudLoggedArea').classList.add('hide');
  availability.textContent='未ログイン。クラウド同期を使うにはログインしてください。';return;
 }
 uid=user.uid;root=db.ref('users/'+uid);
 el('cloudLoginArea').classList.add('hide');el('cloudLoggedArea').classList.remove('hide');
 el('cloudAccount').textContent='ログイン中：'+(user.email||'アカウント');
 availability.textContent='ログイン済み。設定は同じアカウントの端末間で同期します。';
 try{
  if(localStorage.getItem('nai_cloud_active_'+uid)==='1'){
   const ok=await cloudPull();if(ok){listen();return}
  }
  el('cloudFirstChoice').classList.remove('hide');el('cloudLiveChoices').classList.add('hide');
  note('初回同期の方向を選んでください。');
 }catch(e){el('cloudFirstChoice').classList.remove('hide');note('クラウドの読み込みに失敗：'+e.message,true)}
},e=>note('ログイン状態を確認できません：'+e.message,true));
})();
