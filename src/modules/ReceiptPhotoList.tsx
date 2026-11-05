import {useEffect,useState} from "react";

type Props={photos:File[];busy:boolean;onMove:(index:number,direction:-1|1)=>void;onRemove:(index:number)=>void};
/** Thumbnail URLs are released when photos change or component unmounts. */
export function ReceiptPhotoList({photos,busy,onMove,onRemove}:Props){
 const [urls,setUrls]=useState<string[]>([]);
 useEffect(()=>{
  const next=photos.map(file=>URL.createObjectURL(file));
  setUrls(next);
  return ()=>next.forEach(url=>URL.revokeObjectURL(url));
 },[photos]);
 if(!photos.length)return null;
 return <div className="receipt-photo-list" aria-label="Bonabschnitte in Lesereihenfolge">
  <p><strong>{photos.length} Foto{photos.length===1?"":"s"} – Reihenfolge von oben nach unten</strong></p>
  <ol className="receipt-photo-grid">{photos.map((photo,i)=><li key={i+"-"+photo.name+"-"+photo.size} className="receipt-photo-card">
   <div className="receipt-photo-thumb">{urls[i]&&<img src={urls[i]} alt={"Vorschau Abschnitt "+(i+1)}/>}</div>
   <div className="receipt-photo-meta"><strong>Abschnitt {i+1}</strong><small title={photo.name}>{photo.name}</small></div>
   <div className="receipt-photo-actions">
    <button type="button" disabled={busy||i===0} onClick={()=>onMove(i,-1)} aria-label={"Abschnitt "+(i+1)+" nach oben"}>↑ Hoch</button>
    <button type="button" disabled={busy||i===photos.length-1} onClick={()=>onMove(i,1)} aria-label={"Abschnitt "+(i+1)+" nach unten"}>↓ Runter</button>
    <button type="button" disabled={busy} onClick={()=>onRemove(i)} aria-label={"Abschnitt "+(i+1)+" entfernen"}>Entfernen</button>
   </div>
  </li>)}</ol>
  <small>Prüfe die Reihenfolge vor der OCR. Änderungen setzen die bisherige Texterkennung zurück.</small>
 </div>;
}
