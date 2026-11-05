import Dexie, { type EntityTable } from "dexie";
export interface Receipt { id:string; supplier:string; date:string; cents:number; category:string; payment:string; filename:string; file:Blob; archivedAt?:string; }
export interface ReceiptChange { id:string; receiptId:string; at:string; action:"created"|"updated"|"archived"|"restored"; before?:ReceiptSnapshot; after?:ReceiptSnapshot; }
export type ReceiptSnapshot = Pick<Receipt,"supplier"|"date"|"cents"|"category"|"payment"|"filename"|"archivedAt"> & {fileSha256?:string};
export interface Income { id:string; month:string; cents:number; channel:string; }
class Database extends Dexie {
 receipts!:EntityTable<Receipt,"id">;
 incomes!:EntityTable<Income,"id">;
 changes!:EntityTable<ReceiptChange,"id">;
 constructor(){super("astrocat-belegmanager");this.version(1).stores({receipts:"id,date,supplier,category",incomes:"id,month"});
 this.version(2).stores({receipts:"id,date,supplier,category,archivedAt",incomes:"id,month",changes:"id,receiptId,at"});}
}
export const db = new Database();
export const euro = (c:number) => new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(c/100);
export const cents = (s:string) => Math.round(Number(s.replace(",","."))*100);