import { useEffect,useState,type FormEvent } from "react";
import { db,cents,euro,type Receipt,type ReceiptChange } from "../data";
import {createReceipt,updateReceipt,setArchived,getHistory,permanentlyDeleteReceipt} from "../services/receipts/receiptStore";
import { extractText } from "../services/ocr/extractText";
import { suggestFields } from "../services/ocr/suggestFields";
import { findDuplicate } from "../services/receipts/duplicates";
import { combineReceiptPhotos } from "../services/receipts/combinePhotos";

const categories=["Rohwaren","Verpackung","Versand","Werbung","Software","Miete","Ausstattung","Sonstiges"];
const payments=["Geschäftskonto","Privatkonto","Bargeld","Sonstiges"];
type Fields={supplier:string;date:string;amount:string;category:string;payment:string};
const emptyFields=():Fields=>({supplier:"",date:new Date().toLocaleDateString("en-CA"),amount:"",category:"Sonstiges",payment:"Geschäftskonto"});
const formatAmount=(value:number)=>(value/100).toFixed(2).replace(".",",");

export function Receipts(){
 const [items,setItems]=useState<Receipt[]>([]);
 const [file,setFile]=useState<File|null>(null);
 const [photos,setPhotos]=useState<File[]>([]),[photoBusy,setPhotoBusy]=useState(false);
 const [fields,setFields]=useState<Fields>(emptyFields);
 const [editing,setEditing]=useState<Receipt|null>(null);
 const [details,setDetails]=useState<Receipt|null>(null);
 const [preview,setPreview]=useState<string|null>(null);
 const [scanning,setScanning]=useState(false),[busy,setBusy]=useState(false);
 const [scanStatus,setScanStatus]=useState(""),[scanText,setScanText]=useState("");
 const [search,setSearch]=useState(""),[year,setYear]=useState("all"),[categoryFilter,setCategoryFilter]=useState("all"),[paymentFilter,setPaymentFilter]=useState("all");
 const [error,setError]=useState("");
 const [deleteTarget,setDeleteTarget]=useState<Receipt|null>(null),[deleteConfirmation,setDeleteConfirmation]=useState(""),[deleteError,setDeleteError]=useState("");
 const [showArchived,setShowArchived]=useState(false),[history,setHistory]=useState<ReceiptChange[]>([]);
 const refresh=async()=>setItems((await db.receipts.toArray()).sort((a,b)=>b.date.localeCompare(a.date)));
 useEffect(()=>{void refresh();},[]);
 useEffect(()=>{if(!details)return;void getHistory(details.id).then(setHistory).catch(()=>setHistory([]));const url=URL.createObjectURL(details.file);setPreview(url);return ()=>{URL.revokeObjectURL(url);setPreview(null);};},[details]);
 function setField<K extends keyof Fields>(key:K,value:Fields[K]){setFields(old=>({...old,[key]:value}));}
 function onFileChange(next:File|null){setPhotos([]);setFile(next);setScanText("");setScanStatus("");setError("");}
 async function addPhotos(newPhotos:File[]){
  if(!newPhotos.length)return;
  const next=[...photos,...newPhotos];
  if(next.length>5){setError("Maximal 5 Fotos pro Kassenbon.");return;}
  setPhotoBusy(true);setError("");
  try{const combined=await combineReceiptPhotos(next);setPhotos(next);setFile(combined);setScanText("");setScanStatus("Fotos kombiniert. Starte jetzt die Texterkennung.");}
  catch(e){setError(e instanceof Error?e.message:"Fotos konnten nicht kombiniert werden.");}
  finally{setPhotoBusy(false);}
 }
 async function removePhoto(index:number){
  const next=photos.filter((_,i)=>i!==index);
  setPhotoBusy(true);setError("");
  try{setFile(next.length?await combineReceiptPhotos(next):null);setPhotos(next);setScanText("");setScanStatus(next.length?"Fotos aktualisiert. Bitte OCR erneut starten.":"");}
  catch(e){setError(e instanceof Error?e.message:"Foto konnte nicht entfernt werden.");}
  finally{setPhotoBusy(false);}
 }
 function edit(item:Receipt){setDetails(null);setEditing(item);setFields({supplier:item.supplier,date:item.date,amount:formatAmount(item.cents),category:item.category,payment:item.payment});setFile(null);setPhotos([]);setScanText("");setError("");window.scrollTo({top:0,behavior:"smooth"});}
 function cancelEdit(){setEditing(null);setFields(emptyFields());setFile(null);setPhotos([]);setError("");}
 async function scan(){
  if(!file)return;
  setScanning(true);setError("");setScanText("");
  try{
   let text="";let pageCount=1;let method="";
   if(photos.length){
    pageCount=photos.length;method="Foto-OCR";
    const parts:string[]=[];
    for(let i=0;i<photos.length;i++){
     const index=i;
     const result=await extractText(photos[i],message=>setScanStatus("Foto "+(index+1)+"/"+photos.length+": "+message));
     parts.push(result.text);
    }
    text=parts.join("\\n\\n--- NÄCHSTER ABSCHNITT ---\\n\\n");
   }else{
    const result=await extractText(file,setScanStatus);
    text=result.text;pageCount=result.pages;method=result.method;
   }
   setScanText(text);
   const suggestions=suggestFields(text);
   setFields(old=>({...old,...suggestions}));
   setScanStatus("Erkennung abgeschlossen ("+pageCount+" Abschnitt(e), "+method+"). Angaben kontrollieren, besonders Gesamtsumme und Datum.");
  }
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
    await updateReceipt(editing,{supplier:fields.supplier.trim(),date:fields.date,cents:value,category:fields.category,payment:fields.payment});
   }else if(file){
    await createReceipt({id:crypto.randomUUID(),supplier:fields.supplier.trim(),date:fields.date,cents:value,category:fields.category,payment:fields.payment,filename:file.name,file});
   }
   cancelEdit();setScanStatus("");setScanText("");await refresh();
  }catch(e){setError("Speichern fehlgeschlagen: "+(e instanceof Error?e.message:String(e)));}
  finally{setBusy(false);}
 }
 async function archive(item:Receipt){const action=item.archivedAt?"wiederherstellen":"archivieren";if(!confirm("Beleg "+action+"?"))return;try{await setArchived(item,!item.archivedAt);if(details?.id===item.id)setDetails(null);await refresh();}catch(e){setError(e instanceof Error?e.message:"Aktion fehlgeschlagen");}}
 async function permanentlyRemove(){
  if(!deleteTarget||deleteConfirmation!=="LÖSCHEN")return;
  setBusy(true);setDeleteError("");
  try{
   await permanentlyDeleteReceipt(deleteTarget.id);
   if(details?.id===deleteTarget.id)setDetails(null);
   setDeleteTarget(null);setDeleteConfirmation("");
   await refresh();
  }catch(e){setDeleteError(e instanceof Error?e.message:"Löschen fehlgeschlagen");}
  finally{setBusy(false);}
 }
 const years=Array.from(new Set(items.map(x=>x.date.slice(0,4)))).sort().reverse();
 const filtered=items.filter(x=>(showArchived?!!x.archivedAt:!x.archivedAt)&&(x.supplier+" "+x.filename+" "+x.date+" "+x.category).toLocaleLowerCase("de").includes(search.toLocaleLowerCase("de"))&&(year==="all"||x.date.startsWith(year))&&(categoryFilter==="all"||x.category===categoryFilter)&&(paymentFilter==="all"||x.payment===paymentFilter));
 return <><h1>Belege</h1><p>Belege erfassen, kontrollieren und verwalten.</p>
 <section><h2>{editing?"Beleg bearbeiten":"Neuer Beleg"}</h2>
 <form onSubmit={e=>void save(e)}>
 <div className="receipt-inputs">
 <label>{editing?"Originaldokument (unveränderlich)":"PDF oder einzelnes Foto"}<input type="file" disabled={!!editing||photoBusy} accept=".pdf,image/jpeg,image/png,image/webp" onChange={e=>onFileChange(e.target.files?.[0]??null)}/></label>
 {!editing&&<div className="photo-capture"><strong>Kassenbon mit mehreren Fotos aufnehmen</strong><p>Fotografiere den Bon abschnittsweise von oben nach unten. Die Abschnitte sollten sich leicht überlappen.</p><label>Foto aufnehmen oder hinzufügen<input type="file" accept="image/*" capture="environment" disabled={photoBusy||scanning} onChange={e=>{const selected=Array.from(e.target.files??[]);e.target.value="";void addPhotos(selected);}}/></label><label>Mehrere vorhandene Fotos auswählen<input type="file" accept="image/*" multiple disabled={photoBusy||scanning} onChange={e=>{const selected=Array.from(e.target.files??[]);e.target.value="";void addPhotos(selected);}}/></label>{photos.length>0&&<ol className="photo-list">{photos.map((photo,i)=><li key={i+"-"+photo.name}>{photo.name} <button type="button" disabled={photoBusy||scanning} onClick={()=>void removePhoto(i)}>Entfernen</button></li>)}</ol>}<small>Maximal 5 Fotos. Die Reihenfolge entspricht der Aufnahmereihenfolge. Für die Erkennung wird jedes Foto einzeln gelesen.</small></div>}
 </div>
 {file&&<div className="scan-panel"><button type="button" disabled={scanning||busy||photoBusy} onClick={()=>void scan()}>{scanning?"Erkennung läuft …":"Text automatisch erkennen (OCR)"}</button>{scanStatus&&<p role="status">{scanStatus}</p>}{file.type.startsWith("image/")?<p>Bild ausgewählt: {file.name}</p>:<p>PDF ausgewählt: {file.name}</p>}{scanText&&<details><summary>Erkannten Text prüfen</summary><pre className="ocr-text">{scanText}</pre></details>}</div>}
 <label>Lieferant<input value={fields.supplier} onChange={e=>setField("supplier",e.target.value)} required/></label>
 <label>Datum<input type="date" value={fields.date} onChange={e=>setField("date",e.target.value)} required/></label>
 <label>Bruttobetrag (€)<input inputMode="decimal" value={fields.amount} onChange={e=>setField("amount",e.target.value)} required/></label>
 <label>Kategorie<select value={fields.category} onChange={e=>setField("category",e.target.value)}>{categories.map(x=><option key={x}>{x}</option>)}</select></label>
 <label>Bezahlt über<select value={fields.payment} onChange={e=>setField("payment",e.target.value)}>{payments.map(x=><option key={x}>{x}</option>)}</select></label>
 {error&&<p className="form-error" role="alert">{error}</p>}
 <div className="form-actions"><button className="primary" disabled={busy||scanning||photoBusy}>{busy?"Speichert …":editing?"Änderungen speichern":"Beleg speichern"}</button>{editing&&<button type="button" onClick={cancelEdit}>Abbrechen</button>}</div>
 </form><p className="hint">OCR-Vorschläge vor dem Speichern kontrollieren. Änderungen an Metadaten werden protokolliert; Originaldateien bleiben unverändert. Das Protokoll ist lokal und nicht manipulationssicher.</p></section>
 <section><h2>{showArchived?"Archivierte":"Aktive"} Belege ({filtered.length})</h2><label className="archive-toggle"><input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)}/> Archiv anzeigen</label>
 <div className="receipt-filters"><label>Suche<input aria-label="Belege durchsuchen" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Lieferant oder Dateiname"/></label>
 <label>Jahr<select value={year} onChange={e=>setYear(e.target.value)}><option value="all">Alle Jahre</option>{years.map(y=><option key={y}>{y}</option>)}</select></label>
 <label>Kategorie<select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}><option value="all">Alle Kategorien</option>{categories.map(x=><option key={x}>{x}</option>)}</select></label>
 <label>Zahlungsart<select value={paymentFilter} onChange={e=>setPaymentFilter(e.target.value)}><option value="all">Alle Zahlungsarten</option>{payments.map(x=><option key={x}>{x}</option>)}</select></label></div>
 <div className="scroll"><table><thead><tr><th>Datum</th><th>Lieferant</th><th>Kategorie</th><th>Zahlung</th><th>Betrag</th><th>Aktionen</th></tr></thead><tbody>{filtered.map(item=><tr key={item.id}><td>{item.date}</td><td>{item.supplier}<small>{item.filename}</small></td><td>{item.category}</td><td>{item.payment}</td><td>{euro(item.cents)}</td><td className="receipt-actions"><button onClick={()=>setDetails(item)}>Details</button>{!item.archivedAt&&<button onClick={()=>edit(item)}>Bearbeiten</button>}<button onClick={()=>void archive(item)}>{item.archivedAt?"Wiederherstellen":"Archivieren"}</button>{item.archivedAt&&<button className="danger-action" onClick={()=>{setDeleteTarget(item);setDeleteConfirmation("");setDeleteError("");}}>Endgültig löschen</button>}</td></tr>)}</tbody></table>{filtered.length===0&&<p>Keine passenden Belege.</p>}</div></section>
 {deleteTarget&&<section className="delete-confirmation" role="region" aria-label="Endgültiges Löschen bestätigen">
 <h2>Beleg endgültig löschen?</h2>
 <p><strong>{deleteTarget.supplier}</strong> – {deleteTarget.filename}</p>
 <p>Originaldatei, Belegdaten und Änderungshistorie werden dauerhaft aus dem lokalen Speicher gelöscht. Eine Wiederherstellung ist nur mit einem vorherigen Backup möglich.</p>
 <label>Zur Bestätigung LÖSCHEN eingeben<input value={deleteConfirmation} onChange={e=>setDeleteConfirmation(e.target.value)} autoFocus/></label>
 {deleteError&&<p role="alert" className="form-error">{deleteError}</p>}
 <div className="form-actions"><button type="button" className="danger-confirm" disabled={busy||deleteConfirmation!=="LÖSCHEN"} onClick={()=>void permanentlyRemove()}>{busy?"Lösche …":"Jetzt endgültig löschen"}</button><button type="button" disabled={busy} onClick={()=>{setDeleteTarget(null);setDeleteConfirmation("");setDeleteError("");}}>Abbrechen</button></div>
 </section>}
 {details&&<section><div className="detail-header"><h2>Belegdetails: {details.supplier}</h2><button onClick={()=>setDetails(null)}>Schließen</button></div><div className="detail-grid"><div>{preview&&(details.file.type.startsWith("image/")?<img src={preview} alt="Originalbeleg" className="detail-preview"/>:<iframe src={preview} title="Originalbeleg" className="detail-preview"/>)}</div><dl><dt>Datum</dt><dd>{details.date}</dd><dt>Betrag</dt><dd>{euro(details.cents)}</dd><dt>Kategorie</dt><dd>{details.category}</dd><dt>Bezahlt über</dt><dd>{details.payment}</dd><dt>Datei</dt><dd>{details.filename}</dd>{!details.archivedAt&&<button onClick={()=>edit(details)}>Angaben bearbeiten</button>}</dl></div><div className="audit-history"><h3>Änderungshistorie</h3>{history.length===0?<p>Für ältere Belege existieren noch keine historischen Einträge.</p>:<ol>{history.map(entry=><li key={entry.id}><strong>{({created:"Erstellt",updated:"Bearbeitet",archived:"Archiviert",restored:"Wiederhergestellt"} as const)[entry.action]}</strong> – {new Date(entry.at).toLocaleString("de-DE")}{entry.before&&entry.after&&<details><summary>Vorher / Nachher</summary><pre>{JSON.stringify({vorher:entry.before,nachher:entry.after},null,2)}</pre></details>}</li>)}</ol>}</div></section>}
 </>;
}
