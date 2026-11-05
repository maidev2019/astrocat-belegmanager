import { db, type Receipt, type Income } from "../../data";

function samplePdf(label:string):Blob {
 const text=label.replace(/[()\\]/g," ");
 const stream="BT /F1 14 Tf 40 100 Td ("+text+") Tj ET";
 const parts=[
 "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
 "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
 "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 180] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
 "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
 "5 0 obj\n<< /Length "+stream.length+" >>\nstream\n"+stream+"\nendstream\nendobj\n"
 ];
 let pdf="%PDF-1.4\n";const offsets=[0];
 for(const part of parts){offsets.push(pdf.length);pdf+=part;}
 const xref=pdf.length;
 pdf+="xref\n0 6\n0000000000 65535 f \n";
 for(const offset of offsets.slice(1))pdf+=String(offset).padStart(10,"0")+" 00000 n \n";
 pdf+="trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n"+xref+"\n%%EOF";
 return new Blob([pdf],{type:"application/pdf"});
}
/** Stable IDs allow repeated test imports without duplicate entries. */
export async function insertSampleData():Promise<{receipts:number;incomes:number}>{
 const rows=[
  ["test-receipt-2024-01","2024-06-18","Muster Großhandel",8950,"Rohwaren","Geschäftskonto"],
  ["test-receipt-2025-01","2025-10-02","Muster Küchenmiete",99000,"Miete","Geschäftskonto"],
  ["test-receipt-2026-01","2026-03-11","Muster Verpackung",2450,"Verpackung","Privatkonto"],
  ["test-receipt-2026-02","2026-09-20","Muster Versanddienst",619,"Versand","Geschäftskonto"]
 ] as const;
 const incomes:Income[]=[
  {id:"test-income-2024-01",month:"2024-06",cents:24500,channel:"Events"},
  {id:"test-income-2025-01",month:"2025-10",cents:75900,channel:"Shopify"},
  {id:"test-income-2026-01",month:"2026-09",cents:124900,channel:"Shopify"}
 ];
 let receiptsAdded=0,incomesAdded=0;
 await db.transaction("rw",db.receipts,db.incomes,async()=>{
  for(const [id,date,supplier,cents,category,payment] of rows){
   if(await db.receipts.get(id))continue;
   const receipt:Receipt={id,date,supplier,cents,category,payment,filename:id+".pdf",file:samplePdf("TESTBELEG - "+supplier)};
   await db.receipts.add(receipt);receiptsAdded++;
  }
  for(const income of incomes){if(await db.incomes.get(income.id))continue;await db.incomes.add(income);incomesAdded++;}
 });
 return {receipts:receiptsAdded,incomes:incomesAdded};
}
