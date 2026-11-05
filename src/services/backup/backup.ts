import { db, type Income, type Receipt } from "../../data";

type StoredReceipt = Omit<Receipt,"file"> & { fileBase64:string; fileType:string };
interface Backup { format:"astrocat-belegmanager"; version:1; exportedAt:string; receipts:StoredReceipt[]; incomes:Income[]; }
const MAX_FILE_BYTES=25*1024*1024;
const MAX_BACKUP_BYTES=100*1024*1024;

function blobToBase64(blob:Blob):Promise<string> {
 return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});
}
function base64ToBlob(base64:string,type:string):Blob {
 const binary=atob(base64);const bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 return new Blob([bytes],{type});
}
function saveFile(content:Blob,filename:string){
 const url=URL.createObjectURL(content);const link=document.createElement("a");link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
export async function exportBackup():Promise<{receipts:number;incomes:number}>{
 const [receipts,incomes]=await Promise.all([db.receipts.toArray(),db.incomes.toArray()]);
 const stored:StoredReceipt[]=[];
 for(const receipt of receipts){
  if(receipt.file.size>MAX_FILE_BYTES)throw new Error("Ein Beleg überschreitet 25 MB.");
  const {file,...meta}=receipt;
  stored.push({...meta,fileBase64:await blobToBase64(file),fileType:file.type});
 }
 const backup:Backup={format:"astrocat-belegmanager",version:1,exportedAt:new Date().toISOString(),receipts:stored,incomes};
 saveFile(new Blob([JSON.stringify(backup,null,2)],{type:"application/json"}),"astrocat-backup-"+new Date().toISOString().slice(0,10)+".json");
 return {receipts:receipts.length,incomes:incomes.length};
}
function validIncome(x:unknown):x is Income {
 if(!x||typeof x!=="object")return false;
 const i=x as Record<string,unknown>;
 return typeof i.id==="string"&&i.id.length>0&&typeof i.month==="string"&&/^\d{4}-\d{2}$/.test(i.month)&&typeof i.channel==="string"&&typeof i.cents==="number"&&Number.isSafeInteger(i.cents)&&i.cents>=0;
}
function validReceipt(x:unknown):x is StoredReceipt{
 if(!x||typeof x!=="object")return false;
 const r=x as Record<string,unknown>;
 return typeof r.id==="string"&&r.id.length>0&&typeof r.supplier==="string"&&typeof r.date==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&typeof r.cents==="number"&&Number.isSafeInteger(r.cents)&&r.cents>=0&&typeof r.category==="string"&&typeof r.payment==="string"&&typeof r.filename==="string"&&typeof r.fileBase64==="string"&&r.fileBase64.length<=Math.ceil(MAX_FILE_BYTES*4/3)+8&&typeof r.fileType==="string";
}
export async function importBackup(file:File):Promise<{receipts:number;incomes:number;skipped:number}>{
 if(file.size>MAX_BACKUP_BYTES)throw new Error("Backup ist größer als 100 MB.");
 let raw:unknown;try{raw=JSON.parse(await file.text());}catch{throw new Error("Keine gültige JSON-Datei.");}
 if(!raw||typeof raw!=="object")throw new Error("Ungültiges Backup.");
 const b=raw as Record<string,unknown>;
 if(b.format!=="astrocat-belegmanager"||b.version!==1||!Array.isArray(b.receipts)||!Array.isArray(b.incomes))throw new Error("Backup-Format oder Version nicht unterstützt.");
 if(b.receipts.length>10000||b.incomes.length>10000||!b.receipts.every(validReceipt)||!b.incomes.every(validIncome))throw new Error("Backup enthält ungültige Datensätze.");
 const receipts:Receipt[]=b.receipts.map((r:StoredReceipt)=>{const {fileBase64,fileType,...meta}=r;const blob=base64ToBlob(fileBase64,fileType);if(blob.size>MAX_FILE_BYTES)throw new Error("Beleg überschreitet 25 MB.");return {...meta,file:blob};});
 const incomes:Income[]=b.incomes;
 let addedReceipts=0,addedIncomes=0,skipped=0;
 await db.transaction("rw",db.receipts,db.incomes,async()=>{
  for(const receipt of receipts){if(await db.receipts.get(receipt.id)){skipped++;continue;}await db.receipts.add(receipt);addedReceipts++;}
  for(const income of incomes){if(await db.incomes.get(income.id)){skipped++;continue;}await db.incomes.add(income);addedIncomes++;}
 });
 return {receipts:addedReceipts,incomes:addedIncomes,skipped};
}
