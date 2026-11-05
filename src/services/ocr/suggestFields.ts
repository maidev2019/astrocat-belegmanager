/** Conservative heuristics for flattened German invoice text. All suggestions need review. */
export interface Suggestions { supplier?:string; date?:string; amount?:string; }
const flatText=(s:string)=>s.replace(/\s+/g," ").trim();
const months:Record<string,number>={januar:1,februar:2,märz:3,maerz:3,april:4,mai:5,juni:6,juli:7,august:8,september:9,oktober:10,november:11,dezember:12};
function validDate(day:number,month:number,year:number):string|undefined{
 const d=new Date(Date.UTC(year,month-1,day));
 if(d.getUTCDate()!==day||d.getUTCMonth()!==month-1||d.getUTCFullYear()!==year)return undefined;
 return year+"-"+String(month).padStart(2,"0")+"-"+String(day).padStart(2,"0");
}
function amountAfter(text:string,labels:RegExp[]):string|undefined{
 for(const label of labels){
  const m=label.exec(text);if(!m)continue;
  const tail=text.slice(m.index+m[0].length,m.index+m[0].length+45);
  const value=/^\s*[:\-]?\s*(?:€\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})(?!\d)/.exec(tail);
  if(!value)continue;
  const n=Number(value[1].replace(/\./g,"").replace(",","."));
  if(Number.isFinite(n)&&n>0&&n<10000000)return n.toFixed(2).replace(".",",");
 }
 return undefined;
}
export function suggestFields(text:string):Suggestions{
 const flat=flatText(text),result:Suggestions={};
 // The company printed immediately before RECHNUNG is often the invoice issuer.
 const header=/^(.{3,80}?)\s+(?:RECHNUNG|INVOICE)\b/i.exec(flat);
 if(header)result.supplier=header[1].trim();
 // Receipt headers often start with the shop name, before address and till data.
 // Only apply this to typical till receipts, never override an invoice issuer.
 if(!result.supplier&&/\\b(?:BON|KASSE|FILIALE|KARTENZAHLUNG|GESAMTBETRAG)\\b/i.test(flat)){
  const lines=text.split(/\\r?\\n/).map(line=>line.trim()).filter(Boolean);
  const first=lines[0]??"";
  const shop=first.match(/^(.{3,65}?)(?=\\s+\\*{2,}|\\s+DEMO[- ]KASSENBON\\b|$)/i)?.[1]?.trim();
  if(shop&&!/^(?:RECHNUNG|INVOICE|KASSENBON|BON|ARTIKEL)\\b/i.test(shop))result.supplier=shop;
 }
 // Some invoices provide an explicit vendor line instead.
 const vendor=/(?:Verkäufer|Rechnungsaussteller|Aussteller)\s*:\s*(.{3,80}?)(?=\s+(?:Rechnungsdatum|Rechnungsnummer|Adresse|Straße|Strasse|Tel|E-Mail)\b|$)/i.exec(flat);
 if(vendor)result.supplier=vendor[1].trim();
 // On multi-column invoices, the LIEFERANT heading can precede other columns' text.
 // If a vendor address is followed by a recognizable email, prefer its company name.
 if(!result.supplier){
  const block=/\bLIEFERANT\b([\s\S]{0,500}?)(?=\b(?:Pos\.|ARTIKEL|Zwischensumme|Gesamtsumme)\b|$)/i.exec(flat);
  if(block){
   const entries=[...block[1].matchAll(/(?:^|(?:Germany|Deutschland|Österreich)\s+\S+@\S+\s+)([A-ZÄÖÜ][\p{L}&.'-]+(?:\s+[A-ZÄÖÜ][\p{L}&.'-]+){0,4})\s+(?:[A-ZÄÖÜ][\p{L}ß.-]+\s+){0,3}\d{1,4}\b/gu)];
   if(entries.length)result.supplier=entries[entries.length-1][1].trim();
  }
 }
 // Prefer the invoice date over shipping/performance dates.
 const numeric=/(?:Rechnungsdatum|Belegdatum|Rechnungsdatum\s*\/\s*Datum)\s*[:\-]?\s*(\d{1,2})[.\/-](\d{1,2})[.\/-](20\d{2})/i.exec(flat);
 const named=/(?:Rechnungsdatum|Belegdatum)\s*[:\-]?\s*(\d{1,2})\.\s*(Januar|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(20\d{2})/i.exec(flat);
 if(numeric)result.date=validDate(+numeric[1],+numeric[2],+numeric[3]);
 else if(named)result.date=validDate(+named[1],months[named[2].toLowerCase()],+named[3]);
 else {
  const fallback=/\b(\d{1,2})\.(\d{1,2})\.(20\d{2})\b/.exec(flat);
  if(fallback)result.date=validDate(+fallback[1],+fallback[2],+fallback[3]);
 }
 // End amount must take precedence over subtotal, discount and line items.
 result.amount=amountAfter(flat,[
  /\bGesamtsumme\b/i,/\bEndbetrag\b/i,/\bRechnungsbetrag\b/i,
  /\bZu zahlen\b/i,/\bGesamtbetrag\b/i,/\bBetrag bezahlt\b/i,/\bBezahlt\b/i
 ]);
 return result;
}
