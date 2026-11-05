/** Browser-side text extraction. No document is sent to an application server.
 * Tesseract language assets may be fetched from its CDN on first use.
 */
import { createWorker,type Worker } from "tesseract.js";
import { prepareOcrImage } from "./prepareImage";
import { enhanceReceiptImage } from "./enhanceImage";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc=workerUrl;
export interface ScanResult { text:string; method:"pdf-text"|"ocr"; pages:number; }
const MAX_PAGES=8;
const MAX_BYTES=15*1024*1024;
export async function extractText(file:File,onProgress?:(message:string)=>void,enhance=false,sharedWorker?:Worker):Promise<ScanResult>{
 if(file.size>MAX_BYTES)throw new Error("Datei ist größer als 15 MB.");
 const isPdf=file.type==="application/pdf"||file.name.toLowerCase().endsWith(".pdf");
 if(!isPdf&&!file.type.startsWith("image/"))throw new Error("Nur PDFs und Bilder werden unterstützt.");
 if(!isPdf){
  onProgress?.("Foto wird für mobile OCR vorbereitet …");
  const input=await prepareOcrImage(file);
  const worker=sharedWorker??await createWorker("deu+eng");
  try{
   onProgress?.("Foto wird gelesen …");
   // Exactly one recognition per image. A second pass is deliberately
   // disabled to avoid long mobile hangs and excess memory use.
   let source:Blob=input;
   if(enhance){
    onProgress?.("Kontrast wird optimiert …");
    try{source=await enhanceReceiptImage(new File([input],"ocr.jpg",{type:input.type}));}
    catch{source=input;}
   }
   const result=await worker.recognize(source);
   return {text:result.data.text,method:"ocr",pages:1};
  }finally{if(!sharedWorker)await worker.terminate();}
 }
 onProgress?.("PDF wird geöffnet …");
 const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
 try{
  const count=Math.min(pdf.numPages,MAX_PAGES);
  const parts:string[]=[];
  for(let n=1;n<=count;n++){
   onProgress?.("PDF-Seite "+n+" von "+count+" wird gelesen …");
   const page=await pdf.getPage(n);
   const content=await page.getTextContent();
   parts.push(content.items.map(item=>("str" in item?item.str:"")).join(" "));
  }
  const plain=parts.join("\n");
  if(plain.trim().length>=35)return {text:plain,method:"pdf-text",pages:count};
  onProgress?.("PDF enthält wenig Text. OCR wird gestartet …");
  const worker=await createWorker("deu+eng");
  try{
   const ocr:string[]=[];
   for(let n=1;n<=count;n++){
    onProgress?.("OCR für Seite "+n+" von "+count+" …");
    const page=await pdf.getPage(n);
    const viewport=page.getViewport({scale:1.6});
    const canvas=document.createElement("canvas");
    canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
    const ctx=canvas.getContext("2d");
    if(!ctx)throw new Error("Canvas konnte nicht erzeugt werden.");
    await page.render({canvasContext:ctx,viewport}).promise;
    const result=await worker.recognize(canvas);
    ocr.push(result.data.text);
    canvas.width=0;canvas.height=0;
   }
   return {text:ocr.join("\n"),method:"ocr",pages:count};
  }finally{await worker.terminate();}
 }finally{await pdf.destroy();}
}
