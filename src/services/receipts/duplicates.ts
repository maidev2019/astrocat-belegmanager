import { db, type Receipt } from "../../data";

/** SHA-256 identifies identical file bytes regardless of filename. */
export async function fingerprint(file:Blob):Promise<string>{
 const bytes=await file.arrayBuffer();
 const digest=await crypto.subtle.digest("SHA-256",bytes);
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
}
export async function findDuplicate(file:Blob,excludeId?:string):Promise<Receipt|undefined>{
 const target=await fingerprint(file);
 for(const receipt of await db.receipts.toArray()){
  if(receipt.id===excludeId)continue;
  if(receipt.file.size!==file.size)continue;
  if(await fingerprint(receipt.file)===target)return receipt;
 }
 return undefined;
}
