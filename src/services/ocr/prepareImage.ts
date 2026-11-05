/** Downscale only the OCR working copy; never modify the stored receipt photo. */
export async function prepareOcrImage(file:File,maxSide=1900):Promise<Blob>{
 const bitmap=await createImageBitmap(file);
 try{
  const ratio=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height));
  if(ratio===1)return file;
  const canvas=document.createElement("canvas");
  canvas.width=Math.max(1,Math.round(bitmap.width*ratio));
  canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
  const ctx=canvas.getContext("2d");
  if(!ctx)throw new Error("Bildskalierung nicht verfügbar.");
  ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("Bildskalierung fehlgeschlagen.")),"image/jpeg",.9));
  canvas.width=0;canvas.height=0;
  return blob;
 }finally{bitmap.close();}
}
