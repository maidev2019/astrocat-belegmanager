/** Local contrast enhancement for faded thermal-paper receipts.
 * Only the OCR input is modified; the stored original remains unchanged.
 */
export async function enhanceReceiptImage(file:File):Promise<Blob>{
 const bitmap=await createImageBitmap(file);
 try{
  const scale=Math.min(2,1800/bitmap.width);
  const canvas=document.createElement("canvas");
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));
  canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  if(canvas.width*canvas.height>18000000)throw new Error("Bild zu groß für die Optimierung.");
  const ctx=canvas.getContext("2d",{willReadFrequently:true});
  if(!ctx)throw new Error("Bildoptimierung nicht verfügbar.");
  ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
  const image=ctx.getImageData(0,0,canvas.width,canvas.height);
  const pixels=image.data;
  // Percentile stretch removes uneven exposure without hard thresholding text.
  const hist=new Uint32Array(256);
  for(let i=0;i<pixels.length;i+=4){
   const gray=Math.round(.299*pixels[i]+.587*pixels[i+1]+.114*pixels[i+2]);
   hist[gray]++;
  }
  const count=canvas.width*canvas.height;
  let low=0,high=255,total=0;
  for(let i=0;i<256;i++){total+=hist[i];if(total>=count*.02){low=i;break;}}
  total=0;
  for(let i=255;i>=0;i--){total+=hist[i];if(total>=count*.02){high=i;break;}}
  const range=Math.max(40,high-low);
  for(let i=0;i<pixels.length;i+=4){
   const gray=.299*pixels[i]+.587*pixels[i+1]+.114*pixels[i+2];
   const value=Math.max(0,Math.min(255,Math.round((gray-low)*255/range)));
   pixels[i]=value;pixels[i+1]=value;pixels[i+2]=value;pixels[i+3]=255;
  }
  ctx.putImageData(image,0,0);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("Bildoptimierung fehlgeschlagen.")),"image/png"));
  canvas.width=0;canvas.height=0;
  return blob;
 }finally{bitmap.close();}
}
