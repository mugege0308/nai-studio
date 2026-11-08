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
let app,auth,db,storage=null;
try{
 app=firebase.apps.length?firebase.app():firebase.initializeApp(cfg);
 auth=app.auth();db=app.database();storage=firebase.storage?app.storage():null;
 availability.textContent='Firebaseに接続できます。最初に同期用アカウントでログインしてください。';
}catch(e){availability.textContent='Firebase初期化エラー：'+e.message;return}

let uid=null,root=null,profileRef=null,snapsRef=null,pngRef=null,artistRef=null,active=false,suppress=false;
let stateTimer=0,snapTimer=0,pngTimer=0,artistTimer=0,statePending=false,snapsPending=false,pngPending=false,artistPending=false;
let remoteSnapshots={},remotePngPromptSets={},remoteArtistTagPresets={},lastProfile=null; // data of latest server event
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
function dirtyPngPromptSets(){
 if(!active||suppress)return;
 pngPending=true;
 clearTimeout(pngTimer);pngTimer=setTimeout(()=>pushPngPromptSets(),550);
}
function dirtyArtistTagPresets(){
 if(!active||suppress)return;
 artistPending=true;clearTimeout(artistTimer);artistTimer=setTimeout(()=>pushArtistTagPresets(),550);
}
document.addEventListener('nai:statechanged',dirtyState);
document.addEventListener('nai:snapshotschanged',dirtySnapshots);
document.addEventListener('nai:pngpromptschanged',dirtyPngPromptSets);
document.addEventListener('nai:artisttagspresetschanged',dirtyArtistTagPresets);
function saveLocalIncoming(){
 try{localStorage.setItem(SNAPSHOTS_KEY,JSON.stringify(savedSnapshots));return true}catch(e){note('端末保存容量の上限に達しました。既存の保存データは維持しています。JSONバックアップを取ってください。',true);return false}
}
function cleanRemoteSnapObjects(remote){
 const output={};
 for(const [id,item] of Object.entries(remote||{})){
  if(!item||typeof item!=='object'||!item.state)continue;
  output[id]={id:item.id||id,name:item.name||'設定',date:item.date||'',state:item.state,imageData:item.imageData||'',imageId:item.imageId||'',imageName:item.imageName||'',mimeType:item.mimeType||'',width:Number(item.width)||0,height:Number(item.height)||0,metadata:item.metadata&&typeof item.metadata==='object'?item.metadata:null};
 }
 return output;
}
function cleanRemotePngPromptObjects(remote){
 const output={};
 for(const [id,item] of Object.entries(remote||{})){
  if(!item||typeof item!=='object')continue;
  const normalized=normalizePngPromptSet({...item,id:item.id||id});
  if(normalized)output[normalized.id]=normalized;
 }
 return output;
}
function cleanRemoteArtistTagPresetObjects(remote){
 const output=[];for(const item of Object.values(remote||{})){const normalized=normalizeArtistTagPreset(item);if(normalized.tags.length||normalized.referenceImages.length)output.push(normalized)}return output;
}
function assetPath(id){return 'users/'+uid+'/assets/'+encodeURIComponent(String(id))}
async function uploadSnapshotAsset(item){
 const imageId=item?.imageId||item?.sourceImageId;
 if(!imageId)return;
 if(!storage||!window.NAIImageStore)throw new Error('Firebase Storageまたは端末画像ストレージが利用できません');
 const asset=await window.NAIImageStore.get(imageId);if(!asset?.blob)throw new Error(`画像本体が見つかりません：${item.imageName||item.sourceFileName||imageId}`);
 await storage.ref(assetPath(imageId)).put(asset.blob,{contentType:item.mimeType||asset.mimeType||'application/octet-stream',customMetadata:{snapshotId:String(item.id||'')}});
}
async function uploadArtistPresetAssets(preset){for(const ref of preset?.referenceImages||[])if(ref.id)await uploadSnapshotAsset({id:preset.id,imageId:ref.id,imageName:ref.name,mimeType:ref.mimeType})}
async function hydrateRemoteAssets(items){
 if(!storage||!window.NAIImageStore||!uid)return;
 for(const item of Object.values(items||{})){
  const imageId=item?.imageId||item?.sourceImageId;
  if(!imageId)continue;
  try{if(await window.NAIImageStore.has(imageId))continue;const url=await storage.ref(assetPath(imageId)).getDownloadURL();const response=await fetch(url);if(!response.ok)throw new Error('画像本体の取得に失敗しました');const blob=await response.blob();await window.NAIImageStore.put(blob,{id:imageId,name:item.imageName||item.sourceFileName,mimeType:item.mimeType||'image/png',width:item.width,height:item.height})}
  catch(e){note('設定は同期しましたが、画像本体を取得できませんでした。サムネイルを表示します。',true)}
 }
}
async function hydrateRemoteArtistAssets(items){
 const flat={};for(const preset of Object.values(items||{}))for(const ref of preset?.referenceImages||[])if(ref.id)flat[ref.id]={imageId:ref.id,imageName:ref.name,mimeType:ref.mimeType,width:ref.width,height:ref.height};await hydrateRemoteAssets(flat);
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
   favoriteTags=value.favoriteTags.filter(x=>typeof x==='string').slice(0,200);
   if(!value.favoriteCollections){const known=new Set(favoriteEntries().map(x=>normalize(x.tag)));for(const tag of favoriteTags)if(!known.has(normalize(tag)))favoriteCollections.uncategorized.push({id:favoriteId('tag'),label:tag,tag});persistFavoriteCollections(false)}else saveFavorites();
   renderTagList();
  }
  if(value.favoriteCollections && typeof value.favoriteCollections==='object' && !Array.isArray(value.favoriteCollections)){
   const previous=favoriteCollections;favoriteCollections=mergeFavoriteCollections(favoriteCollections,value.favoriteCollections);if(!persistFavoriteCollections(false))favoriteCollections=previous;renderFavorites();renderTagList();
  }
  if(Array.isArray(value.extraTagPresets)){
   const previous=extraTagPresets;extraTagPresets=normalizeExtraTagPresets(value.extraTagPresets);if(!persistExtraTagPresets())extraTagPresets=previous;renderExtraTagPresetUI();
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
   hydrateRemoteAssets(all).then(()=>renderSnapshots()).catch(()=>{});
 }finally{suppress=false}
}
function applyIncomingPngPromptSets(value){
 if(value===null||value===undefined)return;
 suppress=true;
 try{
  const all=cleanRemotePngPromptObjects(value),previous=savedPngPromptSets;
  savedPngPromptSets=Object.values(all).sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));
  if(!persistPngPromptSets()){savedPngPromptSets=previous;return}
  if(activePngPromptSetId&&!savedPngPromptSets.some(item=>item.id===activePngPromptSetId))activePngPromptSetId='';
  renderPngPromptSets();
  hydrateRemoteAssets(all).catch(()=>{});
 }finally{suppress=false}
}
function applyIncomingArtistTagPresets(value){
 if(value===null||value===undefined)return;
 suppress=true;try{const incoming=cleanRemoteArtistTagPresetObjects(value),previous=artistTagPresets;artistTagPresets=incoming;if(!persistArtistState()){artistTagPresets=previous;return}renderArtistTagUI();hydrateRemoteArtistAssets(incoming).catch(()=>{})}finally{suppress=false}
}
function profilePayload(){return {state:captureSettings(),customLooks,favoriteTags,favoriteCollections,extraTagPresets:normalizeExtraTagPresets(extraTagPresets),draftImageData,updatedAt:firebase.database.ServerValue.TIMESTAMP,source:deviceId}}
function snapshotsPayload(){const out={};for(const s of savedSnapshots)out[s.id]={id:s.id,name:s.name,date:s.date,state:s.state,imageData:isSavedImage(s.imageData)?s.imageData:'',imageId:s.imageId||'',imageName:s.imageName||'',mimeType:s.mimeType||'',width:s.width||0,height:s.height||0,metadata:s.metadata||null};return out}
function pngPromptSetsPayload(){const out={};for(const item of savedPngPromptSets){const normalized=normalizePngPromptSet(item);if(normalized)out[normalized.id]=normalized}return out}
function artistTagPresetsPayload(){const out={};for(const item of normalizeArtistTagPresets(artistTagPresets))out[item.id]=item;return out}
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
    if(s===null){const old=remoteSnapshots[id];await snapsRef.child(id).remove();if(storage&&old?.imageId&&!Object.values(current).some(x=>x.imageId===old.imageId))storage.ref(assetPath(old.imageId)).delete().catch(()=>{});delete remoteSnapshots[id]}
    else{await uploadSnapshotAsset(s);await snapsRef.child(id).set(s);remoteSnapshots[id]=s}
   }
  note('画像付き保存セットをクラウドに同期しました。');
 }catch(e){snapsPending=true;note('保存セットの同期に失敗：'+e.message,true)}
}
async function pushPngPromptSets(){
 if(!active||!pngRef||suppress)return;
 if(!pngPending)return;
 pngPending=false;
 try{
  const current=pngPromptSetsPayload(),updates=[];
  for(const [id,item] of Object.entries(current))if(JSON.stringify(remotePngPromptSets[id])!==JSON.stringify(item))updates.push([id,item]);
  for(const id of Object.keys(remotePngPromptSets))if(!current[id])updates.push([id,null]);
  for(const [id,item] of updates){
   if(item===null){await pngRef.child(id).remove();delete remotePngPromptSets[id]}
   else{await uploadSnapshotAsset(item);await pngRef.child(id).set(item);remotePngPromptSets[id]=item}
  }
  if(!Object.keys(current).length&&updates.some(([,item])=>item===null))await pngRef.set({});
  note('PNGプロンプト編集セットをクラウドに同期しました。');
 }catch(e){pngPending=true;note('PNGプロンプト編集セットの同期に失敗：'+e.message,true)}
}
async function pushArtistTagPresets(){
 if(!active||!artistRef||suppress||!artistPending)return;artistPending=false;
 try{const current=artistTagPresetsPayload(),updates=[];for(const [id,item] of Object.entries(current))if(JSON.stringify(remoteArtistTagPresets[id])!==JSON.stringify(item))updates.push([id,item]);for(const id of Object.keys(remoteArtistTagPresets))if(!current[id])updates.push([id,null]);for(const [id,item] of updates){if(item===null){await artistRef.child(id).remove();delete remoteArtistTagPresets[id]}else{await uploadArtistPresetAssets(item);await artistRef.child(id).set(item);remoteArtistTagPresets[id]=item}}if(!Object.keys(current).length&&updates.some(([,item])=>item===null))await artistRef.set({});note('絵師タグセットをクラウドに同期しました。')}catch(e){artistPending=true;note('絵師タグセットの同期に失敗：'+e.message,true)}
}
function detach(){
 clearTimeout(stateTimer);clearTimeout(snapTimer);clearTimeout(pngTimer);clearTimeout(artistTimer);
 if(profileRef)profileRef.off();if(snapsRef)snapsRef.off();if(pngRef)pngRef.off();if(artistRef)artistRef.off();
 active=false;statePending=false;snapsPending=false;pngPending=false;
 artistPending=false;uid=null;root=null;profileRef=null;snapsRef=null;pngRef=null;artistRef=null;remoteSnapshots={};remotePngPromptSets={};remoteArtistTagPresets={};lastProfile=null;
 el('cloudLiveChoices').classList.add('hide');el('cloudFirstChoice').classList.add('hide');
}
function listen(){
 if(!uid||!root)return;
 profileRef=root.child('profile');snapsRef=root.child('snapshots');pngRef=root.child('pngPromptSets');artistRef=root.child('artistTagPresets');active=true;
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
 pngRef.on('value',s=>{
  const value=s.val();if(value===null)return;remotePngPromptSets=cleanRemotePngPromptObjects(value);
  if(pngPending)return;
  applyIncomingPngPromptSets(remotePngPromptSets);
 },e=>note('PNGプロンプト編集セットの受信に失敗：'+e.message,true));
 artistRef.on('value',s=>{
  const value=s.val()||{};remoteArtistTagPresets=Object.fromEntries(cleanRemoteArtistTagPresetObjects(value).map(item=>[item.id,item]));
  if(artistPending)return;applyIncomingArtistTagPresets(value);
 },e=>note('絵師タグセットの受信に失敗：'+e.message,true));
 localStorage.setItem('nai_cloud_active_'+uid,'1');
 note('クラウド同期ON。ほかの端末でも同じアカウントでログインしてください。');
}
function importCloudRoot(remote){
 suppress=true;
 try{
  if(remote.profile)applyIncomingProfile(remote.profile);
  applyIncomingSnapshots(remote.snapshots||{});
   if(Object.prototype.hasOwnProperty.call(remote,'pngPromptSets'))applyIncomingPngPromptSets(remote.pngPromptSets);
   if(Object.prototype.hasOwnProperty.call(remote,'artistTagPresets'))applyIncomingArtistTagPresets(remote.artistTagPresets);
 }finally{suppress=false}
}
async function cloudPull(){
 if(!root)return false;
 const s=await root.once('value'),val=s.val();
 if(!val||!val.profile){note('クラウドにデータがありません。最初のPCで「この端末の設定をクラウドに保存」を選んでください。',true);return false}
  importCloudRoot(val);remoteSnapshots=cleanRemoteSnapObjects(val.snapshots||{});if(Object.prototype.hasOwnProperty.call(val,'pngPromptSets'))remotePngPromptSets=cleanRemotePngPromptObjects(val.pngPromptSets);if(Object.prototype.hasOwnProperty.call(val,'artistTagPresets'))remoteArtistTagPresets=Object.fromEntries(cleanRemoteArtistTagPresetObjects(val.artistTagPresets).map(item=>[item.id,item]));
 return true;
}
async function cloudUpload(){
 if(!root)return false;
 // Bulk initial upload is explicit and confirmed; write snapshots individually to avoid oversized single writes.
 const remote=await root.child('snapshots').once('value');
 const remoteItems=remote.val()||{},existing=Object.keys(remoteItems),items=snapshotsPayload();
 const remotePng=await root.child('pngPromptSets').once('value');
 const remotePngItems=remotePng.val()||{},pngItems=pngPromptSetsPayload();
 const remoteArtist=await root.child('artistTagPresets').once('value');
 const remoteArtistItems=remoteArtist.val()||{},artistItems=artistTagPresetsPayload();
 await root.child('profile').set(profilePayload());
 // Upload each snapshot separately: avoids oversized multi-megabyte database writes.
 for(const id of existing)if(!items[id]){const old=remoteItems[id];await root.child('snapshots').child(id).remove();if(storage&&old?.imageId&&!Object.values(items).some(item=>item.imageId===old.imageId))storage.ref(assetPath(old.imageId)).delete().catch(()=>{})}
 for(const [id,s] of Object.entries(items)){await uploadSnapshotAsset(s);await root.child('snapshots').child(id).set(s)}
 for(const id of Object.keys(remotePngItems))if(!pngItems[id])await root.child('pngPromptSets').child(id).remove();
 for(const [id,item] of Object.entries(pngItems)){await uploadSnapshotAsset(item);await root.child('pngPromptSets').child(id).set(item)}
 if(!Object.keys(pngItems).length)await root.child('pngPromptSets').set({});
 for(const id of Object.keys(remoteArtistItems))if(!artistItems[id])await root.child('artistTagPresets').child(id).remove();
 for(const [id,item] of Object.entries(artistItems)){await uploadArtistPresetAssets(item);await root.child('artistTagPresets').child(id).set(item)}
 if(!Object.keys(artistItems).length)await root.child('artistTagPresets').set({});
 remoteSnapshots=items;
 remotePngPromptSets=pngItems;
 remoteArtistTagPresets=artistItems;
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
  suppress=true;statePending=false;snapsPending=false;pngPending=false;artistPending=false;clearTimeout(stateTimer);clearTimeout(snapTimer);clearTimeout(pngTimer);clearTimeout(artistTimer);
  if(await cloudPull())note('クラウドの内容を読み直しました。');
 }catch(e){note('読み込み失敗：'+e.message,true)}finally{suppress=false}
}
async function manualSave(){
 if(!confirm('クラウドの保存内容をこの端末の内容で上書きします。続行しますか？'))return;
  try{clearTimeout(stateTimer);clearTimeout(snapTimer);clearTimeout(pngTimer);clearTimeout(artistTimer);statePending=false;snapsPending=false;pngPending=false;artistPending=false;await cloudUpload();note('この端末の全設定と保存セットをクラウドへ上書きしました。')}
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
