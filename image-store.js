/* Browser-local original image storage for NAI Prompt Studio.
 * Settings and thumbnails remain in the existing snapshot format; original
 * image bytes live in IndexedDB and are referenced by imageId.
 */
(()=>{
 'use strict';
 const DB_NAME='nai-prompt-studio-assets-v1';
 const STORE='images';
 const MAX_BYTES=50*1024*1024;
 let dbPromise=null;
 function open(){
  if(!('indexedDB' in window))return Promise.reject(new Error('このブラウザは画像本体の保存に対応していません'));
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
   const req=indexedDB.open(DB_NAME,1);
   req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:'id'})};
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('画像ストレージを開けません'));
  });
  return dbPromise;
 }
 function safeId(value){return typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value)?value:''}
 function newId(){return 'img-'+(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2))}
 async function put(source,meta={}){
  const blob=source instanceof Blob?source:new Blob([source],{type:meta.mimeType||'application/octet-stream'});
  if(!blob.size||blob.size>MAX_BYTES)throw new Error('画像本体は50MB以下にしてください');
  const id=safeId(meta.id)||newId();
  const record={id,blob,name:String(meta.name||'画像').slice(0,160),mimeType:blob.type||String(meta.mimeType||'application/octet-stream'),size:blob.size,width:Number(meta.width)||0,height:Number(meta.height)||0,createdAt:meta.createdAt||new Date().toISOString()};
  const db=await open();await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(record);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('画像本体を保存できません'))});return record;
 }
 async function get(id){const key=safeId(id);if(!key)return null;const db=await open();return new Promise((resolve,reject)=>{const req=db.transaction(STORE,'readonly').objectStore(STORE).get(key);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error||new Error('画像本体を読み込めません'))})}
 async function remove(id){const key=safeId(id);if(!key)return;const db=await open();await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('画像本体を削除できません'))})}
 async function has(id){return Boolean(await get(id))}
 window.NAIImageStore={put,get,remove,has,MAX_BYTES};
})();
