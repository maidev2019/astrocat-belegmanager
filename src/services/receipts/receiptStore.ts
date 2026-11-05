import {db,type Receipt,type ReceiptChange,type ReceiptSnapshot} from "../../data";
import {fingerprint} from "./duplicates";

export async function snapshot(r:Receipt):Promise<ReceiptSnapshot>{
 const {supplier,date,cents,category,payment,filename,archivedAt}=r;
 return {supplier,date,cents,category,payment,filename,...(archivedAt?{archivedAt}:{}),fileSha256:await fingerprint(r.file)};
}
function change(receiptId:string,action:ReceiptChange["action"],before?:ReceiptSnapshot,after?:ReceiptSnapshot):ReceiptChange{
 return {id:crypto.randomUUID(),receiptId,at:new Date().toISOString(),action,before,after};
}
export async function createReceipt(receipt:Receipt):Promise<void>{
 const after=await snapshot(receipt);
 await db.transaction("rw",db.receipts,db.changes,async()=>{
  await db.receipts.add(receipt);
  await db.changes.add(change(receipt.id,"created",undefined,after));
 });
}
export async function updateReceipt(original:Receipt,patch:Pick<Receipt,"supplier"|"date"|"cents"|"category"|"payment">):Promise<void>{
 const before=await snapshot(original);
 const updated={...original,...patch};
 const after=await snapshot(updated);
 await db.transaction("rw",db.receipts,db.changes,async()=>{
  const current=await db.receipts.get(original.id);
  if(!current)throw new Error("Beleg wurde inzwischen entfernt.");
  await db.receipts.update(original.id,patch);
  await db.changes.add(change(original.id,"updated",before,after));
 });
}
export async function setArchived(original:Receipt,archive:boolean):Promise<void>{
 const before=await snapshot(original);
 const next:Receipt={...original,archivedAt:archive?new Date().toISOString():undefined};
 const after=await snapshot(next);
 await db.transaction("rw",db.receipts,db.changes,async()=>{
  const current=await db.receipts.get(original.id);
  if(!current)throw new Error("Beleg wurde inzwischen entfernt.");
  await db.receipts.update(original.id,{archivedAt:next.archivedAt});
  await db.changes.add(change(original.id,archive?"archived":"restored",before,after));
 });
}
export async function getHistory(receiptId:string):Promise<ReceiptChange[]>{
 return (await db.changes.where("receiptId").equals(receiptId).toArray()).sort((a,b)=>b.at.localeCompare(a.at));
}

/** Permanent removal is only allowed for archived receipts. Audit records are removed too. */
export async function permanentlyDeleteReceipt(receiptId:string):Promise<void>{
 await db.transaction("rw",db.receipts,db.changes,async()=>{
  const receipt=await db.receipts.get(receiptId);
  if(!receipt)throw new Error("Beleg existiert nicht mehr.");
  if(!receipt.archivedAt)throw new Error("Beleg muss vor dem Löschen archiviert werden.");
  await db.changes.where("receiptId").equals(receiptId).delete();
  await db.receipts.delete(receiptId);
 });
}
