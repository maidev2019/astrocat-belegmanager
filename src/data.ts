import Dexie, { type EntityTable } from "dexie";
export interface Receipt { id:string; supplier:string; date:string; cents:number; category:string; payment:string; filename:string; file:Blob; }
export interface Income { id:string; month:string; cents:number; channel:string; }
class Database extends Dexie {
 receipts!:EntityTable<Receipt,"id">;
 incomes!:EntityTable<Income,"id">;
 constructor(){super("astrocat-belegmanager");this.version(1).stores({receipts:"id,date,supplier,category",incomes:"id,month"});}
}
export const db = new Database();
export const euro = (c:number) => new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(c/100);
export const cents = (s:string) => Math.round(Number(s.replace(",","."))*100);