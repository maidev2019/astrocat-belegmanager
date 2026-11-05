/** Conservative heuristics for flattened German invoice text. All suggestions need review. */
export interface Suggestions { supplier?:string; date?:string; amount?:string; partialDate?:string; amountHint?:string; }
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
  const value=/^\s*[:\-]?\s*(?:(?:€|EUR)\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})(?!\d)/.exec(tail);
  if(!value)continue;
  const n=Number(value[1].replace(/\./g,"").replace(",","."));
  if(Number.isFinite(n)&&n>0&&n<10000000)return n.toFixed(2).replace(".",",");
 }
 return undefined;
}
export function suggestFields(text:string):Suggestions{
 const flat=flatText(text),result:Suggestions={};
 const lines=text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
 // Recognize distinctive retailer logos frequently misread by OCR.
 // Restrict matching to the first few lines so product names cannot override the issuer.
 const top=lines.slice(0,8);
 if(top.some(line=>/^(?:LIDL|L[$§5]DL|L[I1!|]DL)\b/i.test(line)))result.supplier="Lidl";
 // The company printed immediately before RECHNUNG is often the invoice issuer.
 const header=/^(.{3,80}?)\s+(?:RECHNUNG|INVOICE)\b/i.exec(flat);
 if(header&&!result.supplier)result.supplier=header[1].trim();
 // Receipt headers often start with the shop name, before address and till data.
 // Only apply this to typical till receipts, never override an invoice issuer.
 if(!result.supplier&&/\b(?:BON|KASSE|FILIALE|KARTENZAHLUNG|GESAMTBETRAG)\b/i.test(flat)){
  const first=lines[0]??"";
  const shop=first.match(/^(.{3,65}?)(?=\s+\*{2,}|\s+DEMO[- ]KASSENBON\b|$)/i)?.[1]?.trim();
  if(shop&&!/^(?:RECHNUNG|INVOICE|KASSENBON|BON|ARTIKEL)\b/i.test(shop))result.supplier=shop;
 }
 // Store names may be present even when OCR fails to read the word "Bon".
 // Match only standalone names in the receipt header, not product descriptions.
 if(!result.supplier){
  const headerLines=lines.slice(0,8);
  const known=headerLines.find(line=>/^(?:kaufland|kauf\s+land)\b/i.test(line));
  if(known)result.supplier="Kaufland";
  else if(headerLines.some(line=>/^K\s*$/i.test(line))&&headerLines.some(line=>/^Kauf\s*land\b/i.test(line)))result.supplier="Kaufland";
 }
 // Clear company names in the first lines of a till receipt.
 if(!result.supplier){
  const company=top.find(line=>/^[\p{L}][\p{L}0-9 .&'-]{2,65}\s+(?:GmbH|UG|AG|e\.K\.)\b/iu.test(line));
  if(company)result.supplier=company.trim();
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
 // A month/day without a year is only a hint, never an inferred booking date.
 if(!result.date){
  const partial=/\b(\d{1,2})\.\s*(Januar|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\b/i.exec(flat);
  if(partial&&Number(partial[1])>=1&&Number(partial[1])<=31)result.partialDate=partial[1]+". "+partial[2]+" – Jahreszahl fehlt.";
 }
 // Till receipts can show "Summe 23,64", sometimes with OCR errors
 // (e.g. "1% 23,64"). Use the last short line containing a plausible
 // amount only when a total-like label is visible in that same image segment.
 const sumLine=lines.findIndex(line=>/^(?:summe|sumna|sumne|surnme|zu zahlen|gesamt(?:betrag)?)\b/i.test(line));
 if(sumLine>=0){
  const near=lines.slice(sumLine,sumLine+3).join(" ");
  const m=near.match(/\b(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})\b/g);
  if(m?.length)result.amount=m[0];
 }
 // End amount must take precedence over subtotal, discount and line items.
 result.amount=amountAfter(flat,[
  /\bGesamtsumme\b/i,/\bEndbetrag\b/i,/\bRechnungsbetrag\b/i,
  /\bZu zahlen\b/i,/\bGesamtbetrag\b/i,/\bBetrag bezahlt\b/i,/\bBezahlt\b/i
 ])??result.amount;
 // Fallback for a severely damaged total label in the last photographed
 // section (observed OCR: "1% 23,64"). Do not guess from ordinary item prices.
 if(!result.amount){
  const lastSection=text.split(/--- NÄCHSTER ABSCHNITT ---/).at(-1)??text;
  const tailLines=lastSection.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  const tail=tailLines.slice(-6);
  const candidates=tail.filter(line=>/^(?:1[%§]|[|I][%§])\s+\d{1,5},\d{2}\s*$/i.test(line));
  if(candidates.length===1){
   const match=candidates[0].match(/(\d{1,5},\d{2})\s*$/);
   if(match){
    result.amount=match[1];
    result.amountHint="Gesamtsumme unsicher erkannt (beschädigte OCR-Zeile). Betrag bitte am Originalbon prüfen.";
   }
  }
 }
 return result;
}
