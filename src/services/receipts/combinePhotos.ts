/** Combines receipt photos in order into one high-resolution PNG for local storage. */
const MAX_IMAGES=5;
const MAX_IMAGE_BYTES=12*1024*1024;
const OUTPUT_WIDTH=1600;
function loadImage(file:File):Promise<HTMLImageElement>{
 return new Promise((resolve,reject)=>{
  const url=URL.createObjectURL(file);
  const img=new Image();
  img.onload=()=>{URL.revokeObjectURL(url);resolve(img);};
  img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("Foto konnte nicht gelesen werden."));};
  img.src=url;
 });
}
export async function combineReceiptPhotos(files:File[]):Promise<File>{
 if(files.length===0||files.length>MAX_IMAGES)throw new Error("Bitte 1 bis 5 Fotos auswählen.");
 for(const file of files){
  if(!file.type.startsWith("image/")||file.size>MAX_IMAGE_BYTES)throw new Error("Nur Bilddateien bis 12 MB je Foto sind erlaubt.");
 }
 const images=await Promise.all(files.map(loadImage));
 const sizes=images.map(img=>({width:OUTPUT_WIDTH,height:Math.round(img.naturalHeight*OUTPUT_WIDTH/img.naturalWidth)}));
 const height=sizes.reduce((sum,s)=>sum+s.height,0);
 if(height>14000)throw new Error("Die Fotos sind insgesamt zu lang. Bitte weniger Abschnitte verwenden.");
 const canvas=document.createElement("canvas");
 canvas.width=OUTPUT_WIDTH;canvas.height=height;
 const ctx=canvas.getContext("2d");
 if(!ctx)throw new Error("Bildverarbeitung ist nicht verfügbar.");
 ctx.fillStyle="#ffffff";ctx.fillRect(0,0,canvas.width,canvas.height);
 let y=0;
 images.forEach((img,i)=>{ctx.drawImage(img,0,y,sizes[i].width,sizes[i].height);y+=sizes[i].height;});
 const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("Bild konnte nicht gespeichert werden.")),"image/png"));
 canvas.width=0;canvas.height=0;
 if(blob.size>25*1024*1024)throw new Error("Zusammengesetzter Beleg ist größer als 25 MB.");
 return new File([blob],"kassenbon-"+new Date().toISOString().replace(/[:.]/g,"-")+".png",{type:"image/png"});
}
