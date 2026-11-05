import { useEffect,useState,type FormEvent } from "react";
import { db,cents,euro,type Receipt } from "../data";
import { extractText } from "../services/ocr/extractText";
import { suggestFields } from "../services/ocr/suggestFields";
import { findDuplicate } from "../services/receipts/duplicates";

const categories=["Rohwaren","Verpackung","Versand","Werbung","Software","Miete","Ausstattung","Sonstiges"];
const payments=["Geschäftskonto","Privatkonto","Bargeld","Sonstiges"];
type Fields={supplier:string;date:string;amount:string;category:string;payment:string};
const emptyFields=():Fields=>({supplier:"",date:new Date().toLocaleDateString("en-CA"),amount:"",category:"Sonstiges",payment:"Geschäftskonto"});
const formatAmount=(value:number)=>(value/100).toFixed(2).replace(".",",");

export function Receipts(){
 const [items,setItems]=useState<Receipt[]>([]);
 const [file,setFile]=useState<File|null>(null);
 const [fields,setFields]=useState<Fields>(emptyFields);
 const [editing,setEditing]=useState<Receipt|null>(null);
 const [details,setDetails]=useState<Receipt|null>(null);
 const [preview,setPreview]=useState<string|null>(null);
 const [scanning,setScanning]=useState(false),[busy,setBusy]=useState(false);
 const [scanStatus,setScanStatus]=useState(""),[scanText,setScanText]=useState("");
 const [search,setSearch]=useState(""),[year,setYear]=useState("all"),[categoryFilter,setCategoryFilter]=useState("all"),[paymentFilter,setPaymentFilter]=useState("all");
 const [error,setError]=useState("");
 const refresh=async()=>setItems((await db.receipts.toArray()).sort((a,b)=>b.date.localeCompare(a.date)));
 useEffect(()=>{void refresh();},[]);
 useEffect(()=>{if(!details)return;const url=URL.createObjectURL(details.file);setPreview(url);return ()=>{URL.revokeObjectURL(url);setPreview(null);};},[details]);
 function setField<K extends keyof Fields>(key:K,value:Fields[K]){setFields(old=>({...old,[key]:value}));}
 function onFileChange(next:File|null){setFile(next);setScanText("");setScanStatus("");setError("");}
 function edit(item:Receipt){setDetails(null);setEditing(item);setFields({supplier:item.supplier,date:item.date,amount:formatAmount(item.cents),category:item.category,payment:item.payment});setFile(null);setScanText("");setError("");window.scrollTo({top:0,behavior:"smooth"});}
 function cancelEdit(){setEditing(null);setFields(emptyFields());setFile(null);setError("");}
 async function scan(){
  if(!file)return;
  setScanning(true);setError("");setScanText("");
  try{const result=await extractText(file,setScanStatus);setScanText(result.text);const suggestions=suggestFields(result.text);setFields(old=>({...old,...suggestions}));setScanStatus("Erkennung abgeschlossen ("+result.pages+" Seite(n), "+result.method+"). Bitte alle Angaben kontrollieren.");}
  catch(e){setError("OCR-Fehler: "+(e instanceof Error?e.message:String(e)));}
  finally{setScanning(false);}
 }
 async function save(e:FormEvent){
  e.preventDefault();setError("");
  const value=cents(fields.amount);
  if(!fields.supplier.trim()||!fields.date||!Number.isSafeInteger(value)||value<=0){setError("Bitte Lieferant, Datum und gültigen Betrag eingeben.");return;}
  if(!editing&&!file){setError("Bitte eine PDF- oder Bilddatei auswählen.");return;}
  if(file&&!["application/pdf","image/jpeg","image/png","image/webp"].includes(file.type)){setError("Nur PDF, JPG, PNG und WebP sind erlaubt.");return;}
  setBusy(true);
  try{
   if(file){
    const duplicate=await findDuplicate(file,editing?.id);
    if(duplicate){setError("Duplikat erkannt: Diese Datei ist bereits als Beleg von "+duplicate.supplier+" ("+duplicate.date+") gespeichert. Es wurde nichts gespeichert.");return;}
   }
   if(editing){
    await db.receipts.update(editing.id,{supplier:fields.supplier.trim(),date:fields.date,cents:value,category:fields.category,payment:fields.payment,...(file?{file,filename:file.name}:{})});
   }else if(file){
    await db.receipts.add({id:crypto.randomUUID(),supplier:fields.supplier.trim(),date:fields.date,cents:value,category:fields.category,payment:fields.payment,filename:file.name,file});
   }
   cancelEdit();setScanStatus("");setScanText("");await refresh();
  }catch(e){setError("Speichern fehlgeschlagen: "+(e instanceof Error?e.message:String(e)));}
  finally{setBusy(false);}
 }
 async function remove(item:Receipt){if(!confirm("Beleg endgültig löschen? Bitte vorher ein Backup erstellen."))return;await db.receipts.delete(item.id);if(details?.id===item.id)setDetails(null);await refresh();}
 const years=Array.from(new Set(items.map(x=>x.date.slice(0,4)))).sort().reverse();
 const filtered=items.filter(x=>(x.supplier+" "+x.filename+" "+x.date+" "+x.category).toLocaleLowerCase("de").includes(search.toLocaleLowerCase("de"))&&(year==="all"||x.date.startsWith(year))&&(categoryFilter==="all"||x.category===categoryFilter)&&(paymentFilter==="all"||x.payment===paymentFilter));
 return <><h1>Belege</h1><p>Belege erfassen, kontrollieren und verwalten.</p>
 <section><h2>{editing?"Beleg bearbeiten":"Neuer Beleg"}</h2>
 <form onSubmit={e=>void save(e)}>
 <label>{editing?"Original ersetzen (optional)":"PDF oder Foto"}<input type="file" accept=".pdf,image/jpeg,image/png,image/webp" onChange={e=>onFileChange(e.target.files?.[0]??null)} required={!editing}/></label>
 {file&&<div className="scan-panel"><button type="button" disabled={scanning||busy} onClick={()=>void scan()}>{scanning?"Erkennung läuft …":"Text automatisch erkennen (OCR)"}</button>{scanStatus&&<p role="status">{scanStatus}</p>}{file.type.startsWith("image/")?<p>Bild ausgewählt: {file.name}</p>:<p>PDF ausgewählt: {file.name}</p>}{scanText&&<details><summary>Erkannten Text prüfen</summary><pre className="ocr-text">{scanText}</pre></details>}</div>}
 <label>Lieferant<input value={fields.supplier} onChange={e=>setField("supplier",e.target.value)} required/></label>
 <label>Datum<input type="date" value={fields.date} onChange={e=>setField("date",e.target.value)} required/></label>
 <label>Bruttobetrag (€)<input inputMode="decimal" value={fields.amount} onChange={e=>setField("amount",e.target.value)} required/></label>
 <label>Kategorie<select value={fields.category} onChange={e=>setField("category",e.target.value)}>{categories.map(x=><option key={x}>{x}</option>)}</select></label>
 <label>Bezahlt über<select value={fields.payment} onChange={e=>setField("payment",e.target.value)}>{payments.map(x=><option key={x}>{x}</option>)}</select></label>
 {error&&<p className="form-error" role="alert">{error}</p>}
 <div className="form-actions"><button className="primary" disabled={busy||scanning}>{busy?"Speichert …":editing?"Änderungen speichern":"Beleg speichern"}</button>{editing&&<button type="button" onClick={cancelEdit}>Abbrechen</button>}</div>
 </form><p className="hint">OCR-Vorschläge vor dem Speichern kontrollieren. Änderungen ersetzen bisherige Metadaten; eine revisionssichere Änderungshistorie ist noch nicht vorhanden.</p></section>
 <section><h2>Gespeicherte Belege ({filtered.length} von {items.length})</h2>
 <div className="receipt-filters"><label>Suche<input aria-label="Belege durchsuchen" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Lieferant oder Dateiname"/></label>
 <label>Jahr<select value={year} onChange={e=>setYear(e.target.value)}><option value="all">Alle Jahre</option>{years.map(y=><option key={y}>{y}</option>)}</select></label>
 <label>Kategorie<select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}><option value="all">Alle Kategorien</option>{categories.map(x=><option key={x}>{x}</option>)}</select></label>
 <label>Zahlungsart<select value={paymentFilter} onChange={e=>setPaymentFilter(e.target.value)}><option value="all">Alle Zahlungsarten</option>{payments.map(x=><option key={x}>{x}</option>)}</select></label></div>
 <div className="scroll"><table><thead><tr><th>Datum</th><th>Lieferant</th><th>Kategorie</th><th>Zahlung</th><th>Betrag</th><th>Aktionen</th></tr></thead><tbody>{filtered.map(item=><tr key={item.id}><td>{item.date}</td><td>{item.supplier}<small>{item.filename}</small></td><td>{item.category}</td><td>{item.payment}</td><td>{euro(item.cents)}</td><td className="receipt-actions"><button onClick={()=>setDetails(item)}>Details</button><button onClick={()=>edit(item)}>Bearbeiten</button><button onClick={()=>void remove(item)}>Löschen</button></td></tr>)}</tbody></table>{filtered.length===0&&<p>Keine passenden Belege.</p>}</div></section>
 {details&&<section><div className="detail-header"><h2>Belegdetails: {details.supplier}</h2><button onClick={()=>setDetails(null)}>Schließen</button></div><div className="detail-grid"><div>{preview&&(details.file.type.startsWith("image/")?<img src={preview} alt="Originalbeleg" className="detail-preview"/>:<iframe src={preview} title="Originalbeleg" className="detail-preview"/>)}</div><dl><dt>Datum</dt><dd>{details.date}</dd><dt>Betrag</dt><dd>{euro(details.cents)}</dd><dt>Kategorie</dt><dd>{details.category}</dd><dt>Bezahlt über</dt><dd>{details.payment}</dd><dt>Datei</dt><dd>{details.filename}</dd><button onClick={()=>edit(details)}>Angaben bearbeiten</button></dl></div></section>}
 </>;
}
