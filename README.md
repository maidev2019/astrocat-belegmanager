# astrocat-belegmanager
Astrocat BelegManager – Digitale Belegverwaltung


## v0.5.0 – Archiv und Änderungshistorie

- Bestehende Datensätze werden beim Öffnen automatisch von IndexedDB-Schema 1 auf 2 migriert.
- Neue und bearbeitete Belege erhalten lokale Historieneinträge; ältere Bearbeitungen können nicht rückwirkend rekonstruiert werden.
- Originaldateien können beim Bearbeiten nicht mehr ersetzt werden. Archivierte Belege lassen sich wiederherstellen.
- Backups verwenden Formatversion 2 (einschließlich Historie und Archivstatus). Alte Backups der Version 1 lassen sich weiterhin importieren.
- WICHTIG: Die Historie ist im Browser änderbar und weder manipulationssicher noch GoBD-konform. Keine alleinige Archivierung von Steuerunterlagen.
- Vor einem Update ein bestehendes Backup exportieren. Der neue Code wurde noch nicht im lokalen Produktionsbuild verifiziert.
