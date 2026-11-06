/** Generic, local-only supplier candidate ranking. No merchant directory or network calls. */
export type SupplierCandidate={name:string;score:number;reason:string};
const clean=(line:string)=>line.replace(/^[\s*|•~_=-]+|[\s*|•~_=-]+$/g,"").replace(/\s+/g," ").trim();
const reject=/^(?:\d|datum\b|uhrzeit\b|tel\b|fax\b|www\.|https?:|ust\b|steuer\b|kassenbon\b|bonkopie\b|bon\b|rechnung\b|artikel\b|preis\b|summe\b|gesamt\b|zwischensumme\b|zu zahlen\b|filiale\b|kasse\b|straße\b|strasse\b|street\b|für herrn\b|lieferadresse\b|rechnungsadresse\b|lieferant\b|pos\.|eur\b)/i;
const address=/\b(?:str\.?|straße|strasse|weg|platz|allee|gasse|road|street|tel|fax|@|\.de\b|\.com\b)\b/i;
const streetLine=/\b(?:str(?:aße|asse|\.)?|weg|platz|allee|gasse|ring|chaussee|damm|road|street)\s*\d+[a-z]?\s*$/i;
const numericAddress=/\b\d{1,4}[a-z]?\s*$/i;
const legal=/\b(?:GmbH|UG|AG|KG|OHG|GbR|e\.K\.)\b/i;
const trade=/\b(?:Apotheke|Bäckerei|Baeckerei|Konditorei|Metzgerei|Markt|Supermarkt|Restaurant|Café|Cafe|Drogerie|Bistro|Werkstatt|Handel)\b/i;
export function rankSupplierCandidates(text:string):SupplierCandidate[]{
 const lines=text.split(/\r?\n/).map(clean).filter(Boolean).slice(0,14);
 const candidates:SupplierCandidate[]=[];
 for(let i=0;i<lines.length;i++){
  const name=lines[i];
  if(name.length<3||name.length>70||reject.test(name)||address.test(name)||streetLine.test(name)||numericAddress.test(name))continue;
  const letters=[...name].filter(c=>/\p{L}/u.test(c)).length;
  if(letters<3||letters/name.length<.58)continue;
  if(/\b(?:rabatt|mwst|menge|netto|brutto|kreditkarte|kartenzahlung|barzahlung|testcoupon|kaufbeleg)\b/i.test(name))continue;
  let score=40-Math.min(i,10)*4;
  const reasons:string[]=["Belegkopf"];
  if(legal.test(name)){score+=38;reasons.push("Rechtsform");}
  if(trade.test(name)){score+=28;reasons.push("Geschäftsbezeichnung");}
  if(i===0){score+=24;reasons.push("erste Zeile");}else if(i<3){score+=12;reasons.push("obere Zeile");}
  if(i+1<lines.length&&(/\d{5}\s+\p{L}/u.test(lines[i+1])||address.test(lines[i+1])||streetLine.test(lines[i+1])||numericAddress.test(lines[i+1]))){score+=12;reasons.push("Adresse darunter");}
  if(/^[A-ZÄÖÜ][A-ZÄÖÜ\s&.-]{3,}$/.test(name)){score+=7;reasons.push("Überschrift");}
  if(/\b(?:Musterkunde|kein echter kauf|demo|fiktiv)\b/i.test(name))score-=35;
  candidates.push({name,score:Math.min(100,Math.max(0,score)),reason:reasons.join(", ")});
 }
 return candidates.sort((a,b)=>b.score-a.score);
}
