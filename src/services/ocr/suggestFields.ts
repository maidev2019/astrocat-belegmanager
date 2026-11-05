/** Conservative field suggestions: PDF text is often flattened into one long line. */
export interface Suggestions { supplier?:string; date?:string; amount?:string; }
const normalize=(s:string)=>s.replace(/\s+/g," ").trim();
function parseAmount(value:string):number|undefined{
 const n=Number(value.replace(/\./g,"").replace(",","."));
 return Number.isFinite(n)&&n>0&&n<10000000?n:undefined;
}
const money=String.raw`(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})`;
function amountAfterLabel(text:string,label:RegExp):number|undefined{
 const match=label.exec(text);
 if(!match)return undefined;
 const rest=text.slice(match.index+match[0].length,match.index+match[0].length+45);
 const amount=new RegExp(String.raw`^\s*[:\-]?\s*(?:€\s*)?`+money+String.raw`\s*(?:€|EUR)?\b?`.replace("\\b?",""),"i").exec(rest);
 return amount?parseAmount(amount[1]):undefined;
}
export function suggestFields(text:string):Suggestions{
 const flat=normalize(text);
 const lines=text.split(/\r?\n/).map(normalize).filter(Boolean);
 const result:Suggestions={};
 // Common supplier field in German invoice tables. Stop at address/next field labels.
 const labelled=/(?:^|\s)LIEFERANT\s*[:\-]?\s*(.{3,160}?)(?=\s+(?:RECHNUNGSADRESSE|LIEFERADRESSE|Rechnungsnummer|Bestellnummer|Rechnungsdatum|Versanddatum|KOSTENLOSER|ARTIKEL|Gesamtsumme|Zwischensumme)\b|$)/i.exec(flat);
 if(labelled){
  let value=labelled[1].trim();
  value=value.replace(/\s+(?:Straße|Strasse|Str\.|Street|Allee|Weg|Platz)\s+\d+.*$/i,"");
  value=value.replace(/\s+\d{5}\s+.*$/,"");
  value=value.replace(/\s+(?:info@|www\.|https?:\/\/).*$/i,"");
  value=value.trim();
  if(value.length>=3&&value.length<=90)result.supplier=value;
 }
 if(!result.supplier){
  const first=lines.slice(0,7).find(line=>line.length>=3&&line.length<90&&!/^(rechnung|kassenbon|quittung|datum|tel|www\.|http|ust|steuer)/i.test(line));
  if(first)result.supplier=first;
 }
 const dateMatch=/(?:Rechnungsdatum|Belegdatum|Datum)\s*[:\-]?\s*(\d{1,2})[.\-/](\d{1,2})[.\-/](20\d{2})/i.exec(flat)??/\b(\d{1,2})[.\-/](\d{1,2})[.\-/](20\d{2})\b/.exec(flat);
 if(dateMatch){
  const day=Number(dateMatch[1]),month=Number(dateMatch[2]),year=Number(dateMatch[3]);
  const d=new Date(Date.UTC(year,month-1,day));
  if(d.getUTCDate()===day&&d.getUTCMonth()===month-1)result.date=year+"-"+String(month).padStart(2,"0")+"-"+String(day).padStart(2,"0");
 }
 // Strong labels first. Avoid "Zwischensumme", line-item totals and VAT.
 const labels=[/\bGesamtsumme\b\s*[:\-]?/i,/\bEndbetrag\b\s*[:\-]?/i,/\bRechnungsbetrag\b\s*[:\-]?/i,/\bZu zahlen\b\s*[:\-]?/i,/\bGesamtbetrag\b\s*[:\-]?/i,/\bBetrag bezahlt\b\s*[:\-]?/i,/\bBezahlt\b\s*[:\-]?/i];
 for(const label of labels){const value=amountAfterLabel(flat,label);if(value!==undefined){result.amount=value.toFixed(2).replace(".",",");break;}}
 return result;
}
