// ═══════════════════════════════════════════════════════════════════════════
// social-sync — Post-Ordner ins Social-Studio einspielen (06.10.2026, E-294)
//
// Liest Post-Ordner (meta.json nach Schema fiaon-social-post/1, CAPTION.txt,
// ALT-TEXT.txt, Dateien) und lädt sie über POST /api/fiaon/social/import hoch.
// Je Post zwei Anfragen:
//   1. ?probe=1 ohne Dateien → der Server sagt, welche Bytes ihm fehlen
//      (Dateien ohne sha256 im Manifest gehen schon hier mit).
//   2. echter Import mit NUR den fehlenden Dateien. Ein zweiter Lauf über
//      dieselben Ordner lädt also nichts hoch und meldet „unveraendert".
//
// Aufruf (Token aus der Umgebung, nie als Argument — sonst steht er in der Shell-Historie):
//   SOCIAL_IMPORT_TOKEN=… npx tsx scripts/social-sync.ts --ziel=https://fiaon.com \
//       [--ordner=~/Desktop/FIAON/06_Marketing/2026-10_Social_Media_Strategie/04_Posts] [--nur=<id>] [--probe]
//
// Regeln:
//   • Jeder Pfad mit einem Segment „_verworfen…" wird übersprungen (die id von
//     _verworfen_09 kollidiert sonst mit 09_Karussell_Karriere).
//   • Gesucht wird meta.json in <ordner>/*/ und <ordner>/*/*/.
//   • Der Status im Manifest zählt nicht — der Server setzt „zur_freigabe".
//   • Ausgabe je Post eine Zeile; Exit-Code 1, wenn ein Post scheiterte.
//   • Prüfung 06.10.2026: Der Schlüssel geht nur über https — http:// nur an
//     localhost/127.0.0.1. caption_datei/alt_text_datei sind einfache Dateinamen im
//     Post-Ordner (kein /, \, ..) — sonst ließe sich jede lokale Datei hochladen.
// ═══════════════════════════════════════════════════════════════════════════
import fs from "fs";
import path from "path";
import os from "os";
import { createHash } from "crypto";

const VORGABE_ORDNER = path.join(os.homedir(), "Desktop/FIAON/06_Marketing/2026-10_Social_Media_Strategie/04_Posts");

function arg(name: string): string | null {
  const a = process.argv.find((x) => x === `--${name}` || x.startsWith(`--${name}=`));
  if (!a) return null;
  return a.includes("=") ? a.slice(a.indexOf("=") + 1) : "1";
}

const verworfen = (p: string) => p.split(path.sep).some((s) => s.startsWith("_verworfen"));

/** Ein Textfeld-Dateiname aus meta.json: nur ein einfacher Name IM Post-Ordner, sonst null. */
function dateiImOrdner(ordner: string, name: unknown): string | null {
  const n = String(name ?? "");
  if (!n || n.includes("/") || n.includes("\\") || n.includes("..") || path.isAbsolute(n)) return null;
  const voll = path.resolve(ordner, n);
  return voll.startsWith(path.resolve(ordner) + path.sep) ? voll : null;
}

/** https überall; http nur an die eigene Maschine (sonst ginge der Schlüssel im Klartext übers Netz). */
function zielErlaubt(ziel: string): boolean {
  try {
    const u = new URL(ziel);
    if (u.protocol === "https:") return true;
    return u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]");
  } catch { return false; }
}

function manifestOrdner(wurzel: string): string[] {
  const out: string[] = [];
  const stufe = (dir: string, tiefe: number) => {
    let eintraege: fs.Dirent[] = [];
    try { eintraege = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of eintraege) {
      if (!e.isDirectory() || e.name.startsWith(".")) continue;
      const p = path.join(dir, e.name);
      if (verworfen(path.relative(wurzel, p))) continue;
      if (fs.existsSync(path.join(p, "meta.json"))) out.push(p);
      if (tiefe < 2) stufe(p, tiefe + 1);
    }
  };
  stufe(wurzel, 1);
  return out.sort();
}

interface Antwort { ok: boolean; ergebnis?: string; id?: number; version?: number; fassung?: number; status?: string; konflikt?: boolean; error?: string; code?: string; dateien?: { gespeichert: number; schon_vorhanden: number; fehlend: string[] }; wortcheck?: { ergebnis: string; treffer: number }; hinweise?: string[] }

async function senden(ziel: string, token: string, ordner: string, meta: any, metaText: string, caption: string, alt: string | null, dateien: { name: string; pfad: string }[], probe: boolean): Promise<{ status: number; j: Antwort }> {
  const fd = new FormData();
  fd.append("meta", metaText);
  fd.append("caption", caption);
  if (alt) fd.append("alt", alt);
  fd.append("ordner", ordner);
  for (const d of dateien) fd.append("dateien", new Blob([fs.readFileSync(d.pfad)]), d.name);
  const r = await fetch(`${ziel.replace(/\/$/, "")}/api/fiaon/social/import${probe ? "?probe=1" : ""}`, {
    method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
  });
  const j = (await r.json().catch(() => ({ ok: false, error: `Antwort ohne JSON (HTTP ${r.status})` }))) as Antwort;
  return { status: r.status, j };
}

async function main() {
  const ziel = arg("ziel");
  const token = process.env.SOCIAL_IMPORT_TOKEN || "";
  const wurzel = path.resolve((arg("ordner") ?? VORGABE_ORDNER).replace(/^~(?=\/)/, os.homedir()));
  const nur = arg("nur");
  const nurProbe = arg("probe") === "1";
  if (!ziel || !zielErlaubt(ziel)) { console.error("Bitte --ziel=https://… angeben — http:// nur für localhost/127.0.0.1 (z. B. --ziel=http://localhost:5294)."); process.exit(2); }
  if (!token) { console.error("SOCIAL_IMPORT_TOKEN fehlt in der Umgebung."); process.exit(2); }
  const ordnerListe = manifestOrdner(wurzel);
  if (!ordnerListe.length) { console.error(`Keine meta.json unter ${wurzel}.`); process.exit(2); }
  let fehler = 0;
  const zaehl: Record<string, number> = {};
  for (const o of ordnerListe) {
    const rel = path.relative(wurzel, o);
    const metaText = fs.readFileSync(path.join(o, "meta.json"), "utf8");
    let meta: any;
    try { meta = JSON.parse(metaText); } catch { console.log(`✗ ${rel}: meta.json ist kein JSON`); fehler++; continue; }
    if (nur && meta.id !== nur) continue;
    const captionDatei = dateiImOrdner(o, meta.caption_datei || "CAPTION.txt");
    if (!captionDatei) { console.log(`✗ ${rel}: caption_datei muss ein einfacher Dateiname im Post-Ordner sein`); fehler++; continue; }
    const caption = fs.existsSync(captionDatei) ? fs.readFileSync(captionDatei, "utf8") : "";
    const altDatei = meta.alt_text_datei ? dateiImOrdner(o, meta.alt_text_datei) : null;
    if (meta.alt_text_datei && !altDatei) { console.log(`✗ ${rel}: alt_text_datei muss ein einfacher Dateiname im Post-Ordner sein`); fehler++; continue; }
    const alt = altDatei && fs.existsSync(altDatei) ? fs.readFileSync(altDatei, "utf8") : null;
    const liste: { name: string; pfad: string; sha: string | null }[] = (Array.isArray(meta.dateien) ? meta.dateien : []).map((d: any) => ({
      name: String(d.datei), pfad: dateiImOrdner(o, d.datei) ?? "", sha: d.sha256 ? String(d.sha256).toLowerCase() : null,
    }));
    const ungueltig = liste.filter((d) => !d.pfad);
    if (ungueltig.length) { console.log(`✗ ${rel}: Dateiname mit Pfad in meta.json: ${ungueltig.map((d) => d.name).join(", ")}`); fehler++; continue; }
    const fehltLokal = liste.filter((d) => !fs.existsSync(d.pfad));
    if (fehltLokal.length) { console.log(`✗ ${rel}: Datei fehlt im Ordner: ${fehltLokal.map((d) => d.name).join(", ")}`); fehler++; continue; }
    // Lokale Gegenprobe der Prüfsummen — spart einen Upload, der ohnehin abgelehnt würde.
    const falsch = liste.filter((d) => d.sha && createHash("sha256").update(fs.readFileSync(d.pfad)).digest("hex") !== d.sha);
    if (falsch.length) { console.log(`✗ ${rel}: Prüfsumme passt nicht: ${falsch.map((d) => d.name).join(", ")}`); fehler++; continue; }
    try {
      const ohneSha = liste.filter((d) => !d.sha);
      const p = await senden(ziel, token, rel, meta, metaText, caption, alt, ohneSha, true);
      if (!p.j.ok) { console.log(`✗ ${rel} (${meta.id}): ${p.j.error} [${p.status}${p.j.code ? " " + p.j.code : ""}]`); fehler++; continue; }
      if (nurProbe) { console.log(`? ${rel} (${meta.id}): würde „${p.j.ergebnis}“ · fehlend ${p.j.dateien?.fehlend.length ?? 0}`); continue; }
      const fehlend = new Set(p.j.dateien?.fehlend ?? []);
      const hoch = liste.filter((d) => !d.sha || fehlend.has(d.sha));
      const r = await senden(ziel, token, rel, meta, metaText, caption, alt, hoch, false);
      if (!r.j.ok) { console.log(`✗ ${rel} (${meta.id}): ${r.j.error} [${r.status}${r.j.code ? " " + r.j.code : ""}]`); fehler++; continue; }
      zaehl[r.j.ergebnis!] = (zaehl[r.j.ergebnis!] ?? 0) + 1;
      const zeichen = r.j.ergebnis === "unveraendert" ? "=" : r.j.ergebnis === "neu" ? "+" : "~";
      console.log(`${zeichen} ${rel} (${meta.id}): ${r.j.ergebnis} · id ${r.j.id} · Fassung ${r.j.fassung} · ${hoch.length} hochgeladen · Wort-Check ${r.j.wortcheck?.ergebnis}${r.j.konflikt ? " · KONFLIKT (im Studio bearbeitet)" : ""}`);
      for (const h of r.j.hinweise ?? []) console.log(`    – ${h}`);
    } catch (e: any) {
      console.log(`✗ ${rel} (${meta.id}): ${e?.message ?? e}`);
      fehler++;
    }
  }
  console.log(`\nFertig: ${Object.entries(zaehl).map(([k, n]) => `${n} ${k}`).join(", ") || "nichts eingespielt"}${fehler ? `, ${fehler} Fehler` : ""}.`);
  process.exit(fehler ? 1 : 0);
}

main();
