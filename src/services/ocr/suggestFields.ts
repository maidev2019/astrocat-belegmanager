/** Conservative suggestions only. The user must confirm each value. */
export interface Suggestions { supplier?:string; date?:string; amount?:string; }
const clean=(s:string)=>s.replace(/\s+/g," ").trim();
function parseEuro(value:string):number|undefined{
 const normalized=value.replace(/\s/g,"").replace(/\./g,"").replace(",",".");
 const n=Number(normalized);return Number.isFinite(n)&&n>0&&n<10000000?n:undefined;
}
export function suggestFields(text:string):Suggestions{
 const lines=text.split(/\r?\n/).map(clean).filter(Boolean);
 const result:Suggestions={};
 const first=lines.slice(0,7).find(line=>line.length>=3&&line.length<90&&!/^(rechnung|kassenbon|quittung|datum|tel|www\.|http|ust|steuer)/i.test(line));
 if(first)result.supplier=first;
 const dates=text.match(/\b(\d{1,2})[.\-/](\d{1,2})[.\-/](20\d{2})\b/);
 if(dates){const day=Number(dates[1]),month=Number(dates[2]),year=Number(dates[3]);const d=new Date(Date.UTC(year,month-1,day));if(d.getUTCDate()===day&&d.getUTCMonth()===month-1)result.date=year+"-"+String(month).padStart(2,"0")+"-"+String(day).padStart(2,"0");}
 const candidates:{value:number;score:number}[]=[];
 for(const line of lines){
  const amounts=[...line.matchAll(/(?:^|\s|€)(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})(?=\s|€|$)/g)];
  for(const match of amounts){const n=parseEuro(match[1]);if(n===undefined)continue;let score=0;
   if(/gesamtbetrag|rechnungsbetrag|zu zahlen|endbetrag|summe brutto|total|gesamt/i.test(line))score+=10;
   if(/mwst|ust|steuerbetrag|netto|einzelpreis|stückpreis|rabatt|rückgeld|gegeben/i.test(line))score-=8;
   candidates.push({value:n,score});
  }
 }
 candidates.sort((a,b)=>b.score-a.score||b.value-a.value);
 if(candidates.length&&candidates[0].score>0)result.amount=candidates[0].value.toFixed(2).replace(".",",");
 return result;
}
