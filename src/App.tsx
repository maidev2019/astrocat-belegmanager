import { useState } from "react";
import { Dashboard } from "./modules/Dashboard";
import { Receipts } from "./modules/Receipts";
import { IncomePage } from "./modules/IncomePage";
import { BackupPage } from "./modules/BackupPage";
type Page = "Dashboard" | "Belege" | "Einnahmen" | "Backup";
export function App(){const [page,setPage]=useState<Page>("Dashboard");return <div className="shell"><aside><h2>✦ Astrocat</h2><p>BelegManager</p><nav>{(["Dashboard","Belege","Einnahmen","Backup"] as Page[]).map(p=><button className={page===p?"active":""} onClick={()=>setPage(p)} key={p}>{p}</button>)}</nav><small>Lokale Speicherung</small></aside><main>{page==="Dashboard"?<Dashboard/>:page==="Belege"?<Receipts/>:page==="Einnahmen"?<IncomePage/>:<BackupPage/>}<footer>Prototyp v0.1.0 · Kein GoBD-konformes Archiv</footer></main></div>}