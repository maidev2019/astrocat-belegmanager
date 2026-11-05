import { useRef,useState } from "react";
import { exportBackup,importBackup } from "../services/backup/backup";
import { insertSampleData } from "../services/backup/sampleData";
export function BackupPage(){
 const input=useRef<HTMLInputElement>(null);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 async function run(action:()=>Promise<string>){setBusy(true);setError("");setMessage("");try{setMessage(await action());}catch(e){setError(e instanceof Error?e.message:"Unbekannter Fehler");}finally{setBusy(false);}}
 return <><h1>Backup & Testdaten</h1><p>Exportiere alle lokal gespeicherten Belege inklusive PDF-Dateien und Einnahmen in eine JSON-Datei.</p>
 <section><h2>Backup exportieren</h2><p>Speichere die heruntergeladene Datei zusätzlich auf einem USB-C-Stick.</p><button className="primary" disabled={busy} onClick={()=>void run(async()=>{const x=await exportBackup();return "Backup erstellt: "+x.receipts+" Belege und "+x.incomes+" Einnahmen.";})}>Backup herunterladen</button></section>
 <section><h2>Backup importieren</h2><p>Wähle eine zuvor exportierte JSON-Datei. Bestehende Einträge bleiben erhalten; identische IDs werden übersprungen.</p><input ref={input} type="file" accept=".json,application/json" aria-label="Backup-Datei auswählen" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(!f)return;void run(async()=>{const x=await importBackup(f);return "Importiert: "+x.receipts+" Belege, "+x.incomes+" Einnahmen; "+x.skipped+" vorhandene Einträge übersprungen.";}).finally(()=>{if(input.current)input.current.value="";});}}/></section>
 <section><h2>Testdaten erzeugen</h2><p>Erstellt vier ausdrücklich fiktive PDF-Belege und drei fiktive Einnahmen aus 2024 bis 2026. Mehrfaches Ausführen erzeugt keine Duplikate.</p><button disabled={busy} onClick={()=>void run(async()=>{const x=await insertSampleData();return "Testdaten angelegt: "+x.receipts+" Belege und "+x.incomes+" Einnahmen.";})}>Beispieldaten anlegen</button></section>
 {message&&<section role="status"><strong>{message}</strong><p>Wechsle zum Dashboard, um die aktuellen Zahlen zu sehen.</p></section>}
 {error&&<section role="alert"><strong>Fehler: {error}</strong></section>}
 <p className="hint">Achtung: JSON-Backups sind nicht verschlüsselt. Bitte sicher aufbewahren. Dies ist noch keine GoBD-konforme, revisionssichere Archivierung.</p></>;
}