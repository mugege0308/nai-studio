/* Browser-only NovelAI PNG metadata reader.
 * Supports ordinary PNG text chunks and NovelAI's stealth_pngcomp alpha-LSB
 * format. It never uploads the image or depends on an external service.
 * Format reference: NovelAI/novelai-image-metadata (MIT),
 * https://github.com/NovelAI/novelai-image-metadata
 */
(function(root, factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.NovelAIMetadata=factory();
})(typeof self!=='undefined'?self:this,function(){
 'use strict';
 const PNG_SIGNATURE=new Uint8Array([137,80,78,71,13,10,26,10]);
 const decoder=typeof TextDecoder==='function'?new TextDecoder():null;
 function bytes(value){return value instanceof Uint8Array?value:new Uint8Array(value)}
 function u32(a,i){return (((a[i]<<24)>>>0)|(a[i+1]<<16)|(a[i+2]<<8)|a[i+3])>>>0}
 function text(a,encoding='utf-8'){
  if(decoder){try{return new TextDecoder(encoding).decode(a)}catch(_){return decoder.decode(a)}}
  let out='';for(const n of a)out+=String.fromCharCode(n);return out;
 }
 function nul(a,start){for(let i=start;i<a.length;i++)if(a[i]===0)return i;return -1}
 async function inflate(data,format='deflate'){
  if(typeof DecompressionStream==='function'){
   const ds=new DecompressionStream(format);
   const stream=new Blob([data]).stream().pipeThrough(ds);
   return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  if(typeof require==='function'){
   const zlib=require('zlib');
   return new Uint8Array((format==='gzip'?zlib.gunzipSync:zlib.inflateSync)(Buffer.from(data)));
  }
  throw Error('圧縮されたPNGメタデータをこのブラウザで展開できません');
 }
 async function parsePNGTextChunks(input){
  const a=bytes(input);for(let i=0;i<PNG_SIGNATURE.length;i++)if(a[i]!==PNG_SIGNATURE[i])throw Error('PNG形式ではありません');
  const fields={},chunks=[];let offset=8;
  while(offset+12<=a.length){
   const length=u32(a,offset);const type=text(a.slice(offset+4,offset+8),'latin1');const start=offset+8,end=start+length;
   if(end+4>a.length)throw Error('PNGチャンクが途中で終わっています');
   const data=a.slice(start,end);offset=end+4;
   if(type==='tEXt'){
    const p=nul(data,0);if(p>0){const key=text(data.slice(0,p),'latin1');fields[key]=text(data.slice(p+1),'latin1');chunks.push({type,key,compressed:false})}
   }else if(type==='zTXt'){
    const p=nul(data,0);if(p>0&&data[p+1]===0){const key=text(data.slice(0,p),'latin1');const value=text(await inflate(data.slice(p+2),'deflate'),'latin1');fields[key]=value;chunks.push({type,key,compressed:true})}
   }else if(type==='iTXt'){
    const p=nul(data,0);if(p>0&&p+2<data.length){const key=text(data.slice(0,p),'utf-8');const compressed=data[p+1]===1;let cursor=p+3;const langEnd=nul(data,cursor);if(langEnd<0)continue;cursor=langEnd+1;const translatedEnd=nul(data,cursor);if(translatedEnd<0)continue;cursor=translatedEnd+1;const raw=compressed?await inflate(data.slice(cursor),'deflate'):data.slice(cursor);fields[key]=text(raw,'utf-8');chunks.push({type,key,compressed})}
   }
   if(type==='IEND')break;
  }
  return {fields,chunks};
 }
 function jsonMaybe(value){
  if(value&&typeof value==='object')return value;
  if(typeof value!=='string')return null;
  const source=value.trim();if(!source)return null;
  try{return JSON.parse(source)}catch(_){return null}
 }
 function commentObject(fields){
  let value=jsonMaybe(fields.Comment);
  if(value&&typeof value==='object'&&typeof value.Comment==='string')value=jsonMaybe(value.Comment)||value;
  return value&&typeof value==='object'&&!Array.isArray(value)?value:null;
 }
 function numberOrNull(value){const n=Number(value);return Number.isFinite(n)?n:null}
 function firstText(...values){for(const value of values)if(typeof value==='string'&&value.trim())return value;return ''}
 function normalize(fields,comment,source='png-text'){
  const raw=comment&&typeof comment==='object'?comment:{};
  const v4=raw.v4_prompt||raw.v5_prompt||{};
  const v4Caption=v4.caption||{};
  const negativeBlock=raw.v4_negative_prompt||raw.v5_negative_prompt||{};
  const negativeCaption=negativeBlock.caption||{};
  const chars=Array.isArray(v4Caption.char_captions)?v4Caption.char_captions.map((item,index)=>({
   index:index+1,caption:firstText(item?.char_caption),centers:Array.isArray(item?.centers)?item.centers.filter(x=>x&&Number.isFinite(Number(x.x))&&Number.isFinite(Number(x.y))).map(x=>({x:Number(x.x),y:Number(x.y)})):[]
  })).filter(item=>item.caption||item.centers.length):[];
  const base=firstText(v4Caption.base_caption,raw.prompt,fields.Description);
  const negative=firstText(negativeCaption.base_caption,raw.uc);
  const sourceLabel=firstText(fields.Source,fields.Software);
  const isNovelAI=/novelai/i.test(sourceLabel)||Boolean(raw.v4_prompt||raw.v5_prompt||raw.request_type&&/prompt|image/i.test(raw.request_type));
  const settings={
   model:firstText(raw.model_name,raw.model,fields.Source),width:numberOrNull(raw.width),height:numberOrNull(raw.height),steps:numberOrNull(raw.steps),guidance:numberOrNull(raw.scale??raw.cfg_scale),sampler:firstText(raw.sampler),scheduler:firstText(raw.noise_schedule,raw.scheduler),seed:numberOrNull(raw.seed),requestType:firstText(raw.request_type)
  };
  return {format:'NovelAI PNG metadata',source,sourceLabel,software:firstText(fields.Software),description:firstText(fields.Description),generationTime:firstText(fields['Generation time']),title:firstText(fields.Title),isNovelAI,basePrompt:base,negativePrompt:negative,characters:chars,settings,raw,fields};
 }
 function parseStealthBytes(raw){
  const a=bytes(raw),magic=new TextEncoder().encode('stealth_pngcomp');
  if(a.length<magic.length+4)return null;for(let i=0;i<magic.length;i++)if(a[i]!==magic[i])return null;
  const bitLength=u32(a,magic.length),length=Math.floor(bitLength/8),start=magic.length+4;if(length<=0||length>a.length-start)return null;
  return inflate(a.slice(start,start+length),'gzip').then(data=>{const outer=jsonMaybe(text(data));if(!outer)return null;const comment=typeof outer.Comment==='string'?(jsonMaybe(outer.Comment)||outer.Comment):outer.Comment;return {outer,comment}});
 }
 function extractAlphaBits(rgba,width,height){
  const total=Math.floor(width*height/8),out=new Uint8Array(total);let cursor=0,acc=0,bits=0;
  for(let x=0;x<width;x++)for(let y=0;y<height;y++){
   const alpha=rgba[(y*width+x)*4+3]&1;acc=(acc<<1)|alpha;if(++bits===8){out[cursor++]=acc;acc=0;bits=0;if(cursor===total)return out}
  }
  return out;
 }
 async function imageRGBA(file){
  if(typeof createImageBitmap==='function'){
   const bitmap=await createImageBitmap(file);const canvas=typeof OffscreenCanvas==='function'?new OffscreenCanvas(bitmap.width,bitmap.height):document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('画像を解析できません');ctx.drawImage(bitmap,0,0);const result=ctx.getImageData(0,0,bitmap.width,bitmap.height);bitmap.close?.();return {data:result.data,width:result.width,height:result.height};
  }
  if(typeof Image==='function'&&typeof document!=='undefined'){
   const url=URL.createObjectURL(file);try{const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=url});const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('画像を解析できません');ctx.drawImage(image,0,0);const result=ctx.getImageData(0,0,canvas.width,canvas.height);return {data:result.data,width:result.width,height:result.height}}finally{URL.revokeObjectURL(url)}
  }
  throw Error('この実行環境ではPNG画像を画素解析できません');
 }
 async function read(file){
  if(!file)throw Error('PNGを選択してください');
  const buffer=await file.arrayBuffer();const parsed=await parsePNGTextChunks(buffer);let comment=commentObject(parsed.fields),source='png-text';
  if(!comment){
   try{const image=await imageRGBA(file);const bits=extractAlphaBits(image.data,image.width,image.height);const stealth=await parseStealthBytes(bits);if(stealth){comment=stealth.comment;source='stealth_pngcomp'}}catch(_){/* Text metadata can still be reported below. */}
  }
  const metadata=normalize(parsed.fields,comment,source);metadata.hasMetadata=Boolean(comment||Object.keys(parsed.fields).length);metadata.textChunks=parsed.chunks;
  if(!metadata.isNovelAI&&source==='png-text'&&Object.keys(parsed.fields).length===0)metadata.hasMetadata=false;
  return metadata;
 }
 return {parsePNGTextChunks,parseStealthBytes,extractAlphaBits,normalize,read};
});
