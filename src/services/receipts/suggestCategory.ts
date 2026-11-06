import type { Receipt } from "../../data";

export type CategorySuggestion={category:string;hint:string};
const normalize=(value:string)=>value.toLocaleLowerCase("de-DE").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
const rules:{category:string;pattern:RegExp}[]=[
 {category:"Versand",pattern:/\b(?:dhl|dpd|hermes|gls|ups|fedex|porto|paketmarke|versandetikett)\b/i},
 {category:"Verpackung",pattern:/\b(?:verpackungsmaterial|versandkarton|kartonagen|druckverschlussbeutel|standbodenbeutel|etikettenrollen)\b/i},
 {category:"Werbung",pattern:/\b(?:google ads|meta ads|facebook ads|tiktok ads|werbeanzeige|werbekampagne)\b/i},
 {category:"Software",pattern:/\b(?:softwarelizenz|hosting|domainregistrierung|saas|shopify abonnement)\b/i},
 {category:"Miete",pattern:/\b(?:gewerbemiete|mietzahlung|raumvermietung|produktionskuche miete)\b/i}
];
/** Only local saved receipts; no external model, API or merchant database. */
export function suggestCategory(supplier:string,ocrText:string,receipts:Receipt[]):CategorySuggestion|undefined{
 const key=normalize(supplier);
 if(key.length>=3){
  const matches=receipts.filter(r=>normalize(r.supplier)===key&&r.category!=="Sonstiges");
  if(matches.length){
   const counts=new Map<string,number>();
   for(const r of matches)counts.set(r.category,(counts.get(r.category)??0)+1);
   const sorted=[...counts].sort((a,b)=>b[1]-a[1]);
   if(sorted.length===1||sorted[0][1]>sorted[1][1]){
    return {category:sorted[0][0],hint:"Aus "+sorted[0][1]+" lokal gespeicherten Beleg(en) dieses Lieferanten vorgeschlagen. Bitte prüfen."};
   }
   return undefined; // conflicting history: do not guess
  }
 }
 // Generic keyword rules are conservative and only trigger on the supplier or
 // clear document context, not individual product names on a grocery receipt.
 const context=[supplier,...ocrText.split(/\r?\n/).slice(0,5)].join(" ");
 const found=rules.filter(rule=>rule.pattern.test(context));
 if(found.length===1)return {category:found[0].category,hint:"Kategorie anhand von Belegkopf-Schlüsselwörtern vorgeschlagen. Bitte prüfen."};
 return undefined;
}
