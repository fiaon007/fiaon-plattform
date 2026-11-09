// ═══════════════════════════════════════════════════════════════════════════
// CHEFBÜRO › GESCHÄFTSPARTNER › AKTE › „DATENRAUM“ (E-489, 09.11.2026)
//
// Justin: „Wir stellen ihm alles in einen Datenraum von uns … wenn er eintritt, muss er alle Infos für die NDA
// angeben, dann diese direkt unterzeichnen und dann soll er direkt Zugriff haben."
//
// Keine neue Chef-Seite: ein Reiter in der Partner-Akte (ChefGeschaeftspartner.tsx). Hier wird alles gesteuert:
//   · Raum anlegen (Titel, Projekte mit Titel, Beschreibung für den Ordner, Text für § 1 der Vereinbarung,
//     geschützte Kontakte für § 4) und Zusätze der Vereinbarung (vorgestellt am, vorab überlassen, Partei 2).
//   · „Vereinbarung ansehen“ (Entwurf als PDF, mit Platzhaltern oder den Angaben eines Gastes) → „Freigeben“.
//     Erst danach kann ein Gast eingeladen werden und unterschreiben; jede Änderung hebt die Freigabe auf.
//   · „Ordner hochladen“: der Datenraum-Ordner mit manifest.json je Projekt (und raum.json) — alles in einem Rutsch.
//   · Gast einladen (aus einem Kontakt der Akte vorbefüllt) → Code und Link stehen EINMAL da, zum Kopieren, oder
//     gleich als Gmail-Entwurf in js@ (Justin drückt nur noch „Senden“). Die Wiedervorlage legt der Server an.
//   · Unterlagen je Projekt hochladen (auch mehrere), bearbeiten, Sichtbarkeit umschalten, Original ansehen, entfernen.
//   · Gäste mit Stand, jede unterschriebene Fassung als PDF, neuer Code, sperren, Protokoll als Liste (CSV).
//   · Protokoll: wer, wann, was — mit Vorgangsnummer und Prüfsummen-Kette.
// Rechte: nur der Inhaber (der Server prüft jede Route; andere Stufen sehen einen Hinweis).
// Server: server/routes/fiaon-datenraum.ts · Vereinbarung: shared/fiaon-datenraum-nda.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef, useState } from "react";
import { API, datum, datumZeit, Geruest, Fehlermeldung } from "./chef-teile";
import { DR_ANREDEN, DR_DATEI_HINWEIS, DR_DATEI_MAX_BYTES, type DrAnrede } from "@shared/fiaon-datenraum-nda";
import "@/styles/chef-datenraum.css";

type Antwort = { ok: boolean; error?: string; meldung?: string; code?: string; [k: string]: any };
type KontaktKurz = { id: number; name: string; rolle: string; email: string; telefon: string; mobil: string; strasse: string; hausnummer: string; plz: string; ort: string; landCode: string };
type RaumKurz = { id: number; titel: string; partnerFirmaId: number | null; archiviertAm: string | null; erstelltAm: string; zaehler: { projekte: number; dokumente: number; sichtbar: number; gaeste: number; unterzeichnet: number } };
type Dok = { id: number; kennung: string; nr: number; titel: string; beschreibung: string; dateiname: string; quelle: string | null; typ: string; groesse: number; seiten: number | null; sichtbar: boolean; vermerkMoeglich: boolean | null; vermerkGrund: string | null; hochgeladenVon: string | null; erstelltAm: string; ansichten: number; sha256: string; sha256Kurz: string };
type Projekt = { id: number; buchstabe: string; schluessel: string; titel: string; beschreibung: string; ndaText: string; geschuetzt: string; dokumente: Dok[] };
type NdaZeile = { id: number; unterzeichnetAm: string; fassung: string; hashKurz: string; pdfKurz: string; themen: string; name: string; ip: string | null; siegel: string | null; versiegelt: boolean; email: string | null; emailHerkunft: string | null; mailGast: string; mailJustin: string };
type Gast = { id: number; anrede: string; vorname: string; nachname: string; firma: string; email: string; einladungEmail: string; emailBestaetigt: string | null; telefon: string; anschrift: string; codeHinweis: string | null; status: "eingeladen" | "angaben" | "unterzeichnet" | "gesperrt"; angabenAm: string | null; zuletztAm: string | null; eingeladenAm: string; gesperrtAm: string | null; gesperrtGrund: string | null; ansichten: number; weitergabe: string; ndas: NdaZeile[] };
type Eintrag = { id: number; am: string; art: string; artText: string; vorgang: string; gast: string | null; dokument: string | null; detail: string | null; wer: string | null; ip: string | null };
type RaumNda = { vorgestellt?: string | null; zweck?: string | null; vorab?: string | null; partei2Zusatz?: string | null; zusatz4?: string | null };
type Akte = {
  raum: { id: number; titel: string; partnerFirmaId: number | null; nda: RaumNda; erstelltAm: string; erstelltVon: string | null; archiviertAm: string | null; freigabe: { am: string | null; von: string | null } | null; freigegeben: boolean; ndaHash: string };
  projekte: Projekt[]; gaeste: Gast[]; protokoll: Eintrag[]; fassung: string; kette: { ok: boolean; zeilen: number };
};
type Meldung = { gut: boolean; text: string } | null;
type Einmal = { gastId: number; name: string; code: string; link: string } | null;

async function holen(pfad: string): Promise<Antwort & { status?: number }> {
  try {
    const r = await fetch(`${API}${pfad}`, { credentials: "include", cache: "no-store" });
    const j = await r.json().catch(() => null);
    if (r.status === 401) return { ok: false, status: 401, error: "Die Anmeldung ist abgelaufen. Bitte neu anmelden." };
    return { ...(j ?? { ok: false, error: `Antwort ${r.status} ohne Inhalt.` }), status: r.status };
  } catch { return { ok: false, error: "Keine Verbindung zum Server." }; }
}
async function senden(pfad: string, body: unknown): Promise<Antwort> {
  try {
    const r = await fetch(`${API}${pfad}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
    return (await r.json().catch(() => null)) ?? { ok: false, error: `Antwort ${r.status} ohne Inhalt.` };
  } catch { return { ok: false, error: "Keine Verbindung zum Server." }; }
}
async function hochladen(pfad: string, form: FormData): Promise<Antwort> {
  try {
    const r = await fetch(`${API}${pfad}`, { method: "POST", credentials: "include", body: form });
    return (await r.json().catch(() => null)) ?? { ok: false, error: `Antwort ${r.status} ohne Inhalt.` };
  } catch { return { ok: false, error: "Keine Verbindung zum Server." }; }
}
const groesse = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const STATUS_TEXT: Record<Gast["status"], string> = { eingeladen: "eingeladen", angaben: "Angaben gemacht", unterzeichnet: "NDA unterschrieben", gesperrt: "gesperrt" };
const LAND_TEXT: Record<string, string> = { DE: "Deutschland", AT: "Österreich", CH: "Schweiz", LI: "Liechtenstein", LU: "Luxemburg", GB: "Vereinigtes Königreich", US: "Vereinigte Staaten", AE: "Vereinigte Arabische Emirate" };
const zweistellig = (n: number) => String(n).padStart(2, "0");
async function sha256Hex(f: File): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", await f.arrayBuffer());
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ═══════════════════════════════════════════════════════════════════════════
export default function ChefDatenraum({ firmaId, firmaName, kontakte }: { firmaId: number; firmaName: string; kontakte: KontaktKurz[] }) {
  const [liste, setListe] = useState<{ raeume: RaumKurz[]; ohnePartner: RaumKurz[] } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [gesperrt, setGesperrt] = useState(false);
  const [aktiv, setAktiv] = useState<number | null>(null);
  const [akte, setAkte] = useState<Akte | null>(null);
  const [runde, setRunde] = useState(0);
  const [meldung, setMeldung] = useState<Meldung>(null);
  const [einmal, setEinmal] = useState<Einmal>(null);
  const [neuOffen, setNeuOffen] = useState(false);

  useEffect(() => {
    let weg = false;
    holen(`/chef/datenraum?firma=${firmaId}`).then((j) => {
      if (weg) return;
      if (j.ok) {
        setListe({ raeume: j.raeume ?? [], ohnePartner: j.ohnePartner ?? [] }); setFehler(null); setGesperrt(false);
        setAktiv((a) => (a && (j.raeume ?? []).some((r: RaumKurz) => r.id === a) ? a : (j.raeume?.[0]?.id ?? null)));
      } else if (j.code === "STUFE_ZU_NIEDRIG") setGesperrt(true);
      else setFehler(j.error || "Die Datenräume ließen sich nicht laden.");
    });
    return () => { weg = true; };
  }, [firmaId, runde]);
  useEffect(() => {
    if (!aktiv) { setAkte(null); return; }
    let weg = false;
    holen(`/chef/datenraum/raum/${aktiv}`).then((j) => { if (!weg) { if (j.ok) setAkte(j as unknown as Akte); else setFehler(j.error || "Der Datenraum ließ sich nicht laden."); } });
    return () => { weg = true; };
  }, [aktiv, runde]);

  const neu = useCallback(() => setRunde((r) => r + 1), []);
  const tun = useCallback(async (aufruf: Promise<Antwort>, gut?: string): Promise<Antwort> => {
    setMeldung(null);
    const r = await aufruf;
    setMeldung(r.ok ? { gut: true, text: gut ?? r.meldung ?? "Gespeichert." } : { gut: false, text: `Nicht gespeichert: ${r.error || "unbekannter Fehler"}` });
    if (r.ok) neu();
    return r;
  }, [neu]);

  if (gesperrt) return <p className="gp-leer">Den Datenraum steuert der Inhaber — er enthält Original-Unterlagen und unterschriebene Vereinbarungen.</p>;
  if (fehler && !liste) return <Fehlermeldung text={fehler} erneut={neu} />;
  if (!liste) return <Geruest zeilen={4} />;

  return (
    <div className="dr" data-fiaon="datenraum-karte">
      {meldung && <div className={`cm-meldung ${meldung.gut ? "" : "cg-rot"}`} role="status">{meldung.text}</div>}
      {einmal && <EinmalCode e={einmal} zu={() => setEinmal(null)} tun={tun} />}

      {liste.ohnePartner.length > 0 && (
        <div className="gp-streifen" data-fiaon="dr-ohne-partner">
          <p className="gp-fein">Datenräume ohne Partner — ein Klick ordnet sie {firmaName} zu:</p>
          {liste.ohnePartner.map((r) => (
            <div key={r.id} className="gp-streifen-zeile">
              <b>{r.titel}</b><span className="gp-fein">{r.zaehler.projekte} Projekte · {r.zaehler.dokumente} Unterlagen · {r.zaehler.gaeste} Gäste</span>
              <button type="button" className="cg-knopf" onClick={() => void tun(senden(`/chef/datenraum/raum/${r.id}`, { firmaId }), `„${r.titel}“ gehört jetzt zu ${firmaName}.`)}>Hier zuordnen</button>
            </div>
          ))}
        </div>
      )}

      {liste.raeume.length > 1 && (
        <div className="cg-filter" role="tablist" aria-label="Datenräume">
          {liste.raeume.map((r) => <button key={r.id} type="button" className={aktiv === r.id ? "aktiv" : ""} onClick={() => setAktiv(r.id)}>{r.titel}{r.archiviertAm ? " (archiviert)" : ""}</button>)}
        </div>
      )}

      {(liste.raeume.length === 0 || neuOffen) ? (
        <NeuerRaum firmaId={firmaId} firmaName={firmaName} abbrechen={liste.raeume.length ? () => setNeuOffen(false) : null}
          fertig={(id) => { setNeuOffen(false); setAktiv(id); neu(); }} tun={tun} />
      ) : (
        <div className="gp-form-knoepfe"><button type="button" className="gp-link" onClick={() => setNeuOffen(true)}>Weiteren Datenraum anlegen</button></div>
      )}

      {akte && !neuOffen && <RaumAnsicht key={akte.raum.id} akte={akte} firmaName={firmaName} kontakte={kontakte} tun={tun} neu={neu} zeigeCode={setEinmal} />}
    </div>
  );
}
type Tun = (aufruf: Promise<Antwort>, gut?: string) => Promise<Antwort>;

// ── Einmal-Anzeige von Code und Link ───────────────────────────────────────
function EinmalCode({ e, zu, tun }: { e: NonNullable<Einmal>; zu: () => void; tun: Tun }) {
  const [kopiert, setKopiert] = useState<string | null>(null);
  const [entwurf, setEntwurf] = useState<"" | "laeuft" | "fertig">("");
  const kasten = useRef<HTMLDivElement | null>(null);
  // Die Anzeige erscheint oben in der Karte — die Ansicht springt dorthin, damit sie niemand übersieht.
  useEffect(() => { kasten.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }, [e.code]);
  const kopieren = async (was: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setKopiert(was); } catch { setKopiert(null); window.prompt("Zum Kopieren markieren:", text); }
  };
  const alsEntwurf = async () => {
    setEntwurf("laeuft");
    const r = await tun(senden(`/chef/datenraum/gast/${e.gastId}/entwurf`, { code: e.code }));
    setEntwurf(r.ok ? "fertig" : "");
  };
  return (
    <div className="dr-einmal" role="status" data-fiaon="dr-einmal-code" ref={kasten}>
      <div className="gp-feld-kopf"><h3>Zugang für {e.name} — nur jetzt sichtbar</h3><button type="button" className="cg-knopf" onClick={zu}>Gemerkt, schließen</button></div>
      <div className="dr-einmal-zeile"><span>Einladungscode</span><code>{e.code}</code><button type="button" className="cg-knopf" onClick={() => void kopieren("code", e.code)}>{kopiert === "code" ? "Kopiert" : "Code kopieren"}</button></div>
      <div className="dr-einmal-zeile"><span>Persönlicher Link</span><code className="lang">{e.link}</code><button type="button" className="cg-knopf" onClick={() => void kopieren("link", e.link)}>{kopiert === "link" ? "Kopiert" : "Link kopieren"}</button></div>
      <div className="gp-form-knoepfe">
        <button type="button" className="cg-knopf cg-knopf-haupt" disabled={entwurf !== ""} onClick={() => void alsEntwurf()} data-fiaon="dr-entwurf-js">
          {entwurf === "laeuft" ? "Legt den Entwurf an …" : entwurf === "fertig" ? "Entwurf liegt in js@" : "Einladung als Entwurf in js@ anlegen"}
        </button>
        <span className="gp-fein">Hochwertiger Text in Sie-Form mit Link, Code und deiner Signatur — gesendet wird nichts, du drückst in Gmail auf „Senden“.</span>
      </div>
      <p className="gp-fein">Gespeichert ist nur eine Prüfsumme — dieser Code lässt sich später nicht mehr anzeigen. Verloren? Dann „Neuer Code“ am Gast.</p>
    </div>
  );
}

// ── Neuer Raum ─────────────────────────────────────────────────────────────
type ProjektForm = { titel: string; beschreibung: string; ndaText: string; geschuetzt: string };
const PROJEKT_LEER: ProjektForm = { titel: "", beschreibung: "", ndaText: "", geschuetzt: "" };
function NeuerRaum({ firmaId, firmaName, abbrechen, fertig, tun }: { firmaId: number; firmaName: string; abbrechen: (() => void) | null; fertig: (id: number) => void; tun: Tun }) {
  const [titel, setTitel] = useState(`Datenraum ${firmaName}`);
  const [projekte, setProjekte] = useState<ProjektForm[]>([{ ...PROJEKT_LEER }]);
  const [busy, setBusy] = useState(false);
  const anlegen = async () => {
    setBusy(true);
    const r = await tun(senden("/chef/datenraum/raum", { titel, firmaId, projekte: projekte.filter((p) => p.titel.trim()) }));
    setBusy(false);
    if (r.ok) fertig(Number(r.id));
  };
  const setze = (i: number, p: Partial<ProjektForm>) => setProjekte((l) => l.map((x, j) => (j === i ? { ...x, ...p } : x)));
  return (
    <div className="gp-feld-block" data-fiaon="dr-neu">
      <div className="gp-feld-kopf"><h3>Datenraum anlegen</h3>{abbrechen && <button type="button" className="cg-knopf" onClick={abbrechen}>Abbrechen</button>}</div>
      <p className="gp-fein">Der Gast tritt mit einem Einladungscode ein, gibt seine Angaben für die Vertraulichkeitsvereinbarung an, unterzeichnet und sieht danach sofort die Unterlagen — je Projekt ein Ordner. Projekte kannst du hier anlegen oder danach mit „Ordner hochladen“ (raum.json) übernehmen.</p>
      <div className="gp-raster">
        <label className="gp-breit">Titel des Raums (sieht der Gast)<input value={titel} onChange={(e) => setTitel(e.target.value)} /></label>
      </div>
      {projekte.map((p, i) => (
        <div key={i} className="dr-projekt-form">
          <div className="gp-feld-kopf"><b>Projekt {String.fromCharCode(65 + i)}</b>{projekte.length > 1 && <button type="button" className="gp-link gp-leise" onClick={() => setProjekte((l) => l.filter((_, j) => j !== i))}>Entfernen</button>}</div>
          <ProjektFelder w={p} setze={(x) => setze(i, x)} />
        </div>
      ))}
      <div className="gp-form-knoepfe">
        <button type="button" className="gp-link" onClick={() => setProjekte((l) => [...l, { ...PROJEKT_LEER }])} disabled={projekte.length >= 26}>Projekt hinzufügen</button>
        <button type="button" className="cg-knopf cg-knopf-haupt" disabled={busy || titel.trim().length < 3} onClick={() => void anlegen()}>{busy ? "Legt an …" : "Datenraum anlegen"}</button>
      </div>
    </div>
  );
}
function ProjektFelder({ w, setze }: { w: ProjektForm; setze: (p: Partial<ProjektForm>) => void }) {
  return (
    <div className="gp-raster">
      <label>Titel (Ordner und Vereinbarung)<input value={w.titel} onChange={(e) => setze({ titel: e.target.value })} placeholder="z. B. Wachstumsfinanzierung" /></label>
      <label>Kurzbeschreibung für den Ordner (sieht der Gast erst nach der Unterschrift)<input value={w.beschreibung} onChange={(e) => setze({ beschreibung: e.target.value })} placeholder="ein Satz" /></label>
      <label className="gp-breit">Text in § 1 der Vereinbarung (ohne Punkt am Ende; leer = Kurzbeschreibung — sie steht dann schon vor der Unterschrift im Vertrag)<textarea value={w.ndaText} onChange={(e) => setze({ ndaText: e.target.value })} rows={2} placeholder="z. B. eine mögliche Beteiligung an …" /></label>
      <label className="gp-breit">Gesellschaft mit Projektkontakten (§ 4 Abs. 1, optional — so, wie § 1 sie nennt)<input value={w.geschuetzt} onChange={(e) => setze({ geschuetzt: e.target.value })} placeholder="z. B. die Beta-Gesellschaft" /></label>
    </div>
  );
}

// ── Ein Raum ───────────────────────────────────────────────────────────────
function RaumAnsicht({ akte, firmaName, kontakte, tun, neu, zeigeCode }: { akte: Akte; firmaName: string; kontakte: KontaktKurz[]; tun: Tun; neu: () => void; zeigeCode: (e: Einmal) => void }) {
  const r = akte.raum;
  const [bearbeiten, setBearbeiten] = useState(false);
  const [w, setW] = useState({ titel: r.titel, vorgestellt: r.nda.vorgestellt ?? "", zweck: r.nda.zweck ?? "", vorab: r.nda.vorab ?? "", partei2Zusatz: r.nda.partei2Zusatz ?? "", zusatz4: r.nda.zusatz4 ?? "" });
  const [protokollAlle, setProtokollAlle] = useState(false);
  const dokumente = akte.projekte.reduce((s, p) => s + p.dokumente.length, 0);
  const sichtbar = akte.projekte.reduce((s, p) => s + p.dokumente.filter((d) => d.sichtbar).length, 0);
  const unterzeichnet = akte.gaeste.filter((g) => g.ndas.length).length;
  const speichern = async () => {
    const x = await tun(senden(`/chef/datenraum/raum/${r.id}`, { titel: w.titel, nda: { vorgestellt: w.vorgestellt, zweck: w.zweck, vorab: w.vorab, partei2Zusatz: w.partei2Zusatz, zusatz4: w.zusatz4 } }));
    if (x.ok) setBearbeiten(false);
  };
  return (
    <>
      <div className="gp-feld-block" data-fiaon="dr-ueberblick">
        <div className="gp-feld-kopf">
          <h3>{r.titel}{r.archiviertAm ? <span className="gp-rot"> · archiviert</span> : null}</h3>
          <div className="gp-knoepfe">
            <a className="cg-knopf" href="/datenraum/zugang" target="_blank" rel="noreferrer">Gastseite öffnen</a>
            <button type="button" className="cg-knopf" onClick={() => setBearbeiten(!bearbeiten)}>{bearbeiten ? "Schließen" : "Bearbeiten"}</button>
          </div>
        </div>
        <div className="gp-zahlen dr-zahlen">
          <span><b>{akte.projekte.length}</b>Projekte</span>
          <span><b>{sichtbar}</b>von {dokumente} Unterlagen sichtbar</span>
          <span><b>{akte.gaeste.length}</b>Gäste</span>
          <span><b>{unterzeichnet}</b>NDA unterschrieben</span>
        </div>
        <p className="gp-fein">Angelegt {datumZeit(r.erstelltAm)}{r.erstelltVon ? ` von ${r.erstelltVon}` : ""} · Vereinbarung Fassung {akte.fassung}</p>
        {bearbeiten && (
          <>
            <div className="gp-raster">
              <label className="gp-breit">Titel<input value={w.titel} onChange={(e) => setW({ ...w, titel: e.target.value })} /></label>
              <label>§ 1 Abs. 1 „… vorgestellt, …“ (optional)<input value={w.vorgestellt} onChange={(e) => setW({ ...w, vorgestellt: e.target.value })} placeholder="z. B. zuletzt mit E-Mail vom …" /></label>
              <label>§ 2 Abs. 1 „insbesondere …“ — vorab überlassen (optional)<input value={w.vorab} onChange={(e) => setW({ ...w, vorab: e.target.value })} placeholder="z. B. die E-Mail vom … mit der Anlage …" /></label>
              <label className="gp-breit">§ 1 Abs. 2 „…, also …“ — der Zweck genauer (optional)<input value={w.zweck} onChange={(e) => setW({ ...w, zweck: e.target.value })} placeholder="z. B. einer Finanzierung oder Beteiligung zu A oder B" /></label>
              <label className="gp-breit">Partei 2 — „persönlich, …“ (optional, sonst allgemein)<input value={w.partei2Zusatz} onChange={(e) => setW({ ...w, partei2Zusatz: e.target.value })} placeholder="auch wegen einer möglichen persönlichen Beteiligung an einem der Themen" /></label>
              <label className="gp-breit">§ 4 Abs. 2 — ergänzender Satz (optional)<textarea value={w.zusatz4} rows={2} onChange={(e) => setW({ ...w, zusatz4: e.target.value })} placeholder="z. B. ein Satz, der festlegt, was als Geschäft mit einer Gesellschaft aus § 1 gilt" /></label>
            </div>
            <div className="gp-form-knoepfe">
              <button type="button" className="cg-knopf cg-knopf-haupt" onClick={() => void speichern()} disabled={w.titel.trim().length < 3}>Speichern</button>
              <button type="button" className="cg-knopf" onClick={() => { if (window.confirm(r.archiviertAm ? "Raum wieder öffnen?" : "Raum archivieren? Alle Gäste verlieren sofort den Zugang.")) void tun(senden(`/chef/datenraum/raum/${r.id}`, { archivieren: !r.archiviertAm })); }}>{r.archiviertAm ? "Wieder öffnen" : "Archivieren"}</button>
              <span className="gp-fein">Ändern sich Zusätze oder Projekte, gilt die Freigabe nicht mehr — dann neu ansehen und freigeben. Unterschriebene Fassungen bleiben, wie sie sind.</span>
            </div>
          </>
        )}
      </div>

      <FreigabeBlock akte={akte} tun={tun} />
      <GaesteBlock akte={akte} firmaName={firmaName} kontakte={kontakte} tun={tun} zeigeCode={zeigeCode} />
      <OrdnerHochladen akte={akte} tun={tun} neu={neu} />

      {akte.projekte.map((p) => <ProjektBlock key={p.id} p={p} raumId={r.id} tun={tun} neu={neu} />)}
      <NeuesProjekt raumId={r.id} tun={tun} />

      <div className="gp-feld-block" data-fiaon="dr-protokoll">
        <div className="gp-feld-kopf"><h3>Protokoll</h3><span className="gp-fein">{akte.protokoll.length >= 250 ? "die letzten 250 Einträge" : `${akte.protokoll.length} Einträge`} · {akte.kette.ok ? `Kette geprüft, unverändert (${akte.kette.zeilen} Zeilen)` : "Kette gebrochen — bitte prüfen"}</span></div>
        {akte.protokoll.length === 0 ? <p className="gp-fein">Noch nichts geschehen.</p> : (
          <ul className="dr-protokoll">
            {(protokollAlle ? akte.protokoll : akte.protokoll.slice(0, 25)).map((e) => (
              <li key={e.id} className={`dr-p-${e.art}`}>
                <span className="dr-p-zeit">{datumZeit(e.am)}</span>
                <span className="dr-p-was"><b>{e.artText}</b>{e.dokument ? ` · ${e.dokument}` : ""}{e.detail && !e.dokument ? ` · ${e.detail}` : ""}</span>
                <span className="dr-p-wer">{e.wer ? `${e.wer}${e.gast ? ` → ${e.gast}` : ""}` : e.gast ?? ""}{e.ip ? ` · ${e.ip}` : ""} · {e.vorgang}</span>
              </li>
            ))}
          </ul>
        )}
        {akte.protokoll.length > 25 && <div className="gp-form-knoepfe"><button type="button" className="gp-link" onClick={() => setProtokollAlle(!protokollAlle)}>{protokollAlle ? "Weniger zeigen" : "Alle Einträge zeigen"}</button></div>}
      </div>
    </>
  );
}

// ── Freigabe der Vereinbarung ──────────────────────────────────────────────
function FreigabeBlock({ akte, tun }: { akte: Akte; tun: Tun }) {
  const r = akte.raum;
  const [gesehen, setGesehen] = useState(false);
  const leer = akte.projekte.length === 0;
  return (
    <div className={`gp-feld-block dr-freigabe${r.freigegeben ? " frei" : ""}`} data-fiaon="dr-freigabe">
      <div className="gp-feld-kopf">
        <h3>Vereinbarung</h3>
        <span className={`gp-marke ${r.freigegeben ? "dr-status-unterzeichnet" : "dr-status-eingeladen"}`}>{r.freigegeben ? "freigegeben" : "nicht freigegeben"}</span>
      </div>
      <p className="gp-fein">{r.freigegeben
        ? `Freigegeben${r.freigabe?.am ? ` am ${datumZeit(r.freigabe.am)}` : ""}${r.freigabe?.von ? ` von ${r.freigabe.von}` : ""}. So sehen Gäste den Wortlaut.`
        : leer ? "Erst ein Projekt anlegen — dann die Vereinbarung ansehen und freigeben."
          : r.freigabe ? "Seit der letzten Freigabe hat sich etwas geändert (Zusätze oder Projekte). Gäste können erst nach einer neuen Freigabe unterschreiben."
            : "Bevor ein Gast eingeladen wird: einmal ansehen (Entwurf als PDF, mit Platzhaltern) und freigeben."}</p>
      {!leer && (
        <div className="gp-form-knoepfe">
          <a className="cg-knopf" href={`${API}/chef/datenraum/raum/${r.id}/vorschau.pdf`} target="_blank" rel="noreferrer" onClick={() => setGesehen(true)} data-fiaon="dr-vorschau">Vereinbarung ansehen</a>
          {!r.freigegeben && <button type="button" className="cg-knopf cg-knopf-haupt" disabled={!gesehen} onClick={() => void tun(senden(`/chef/datenraum/raum/${r.id}/freigeben`, { hash: r.ndaHash }))} data-fiaon="dr-freigeben">Freigeben</button>}
          {!r.freigegeben && !gesehen && <span className="gp-fein">„Freigeben“ geht, sobald du die Vorschau geöffnet hast.</span>}
        </div>
      )}
    </div>
  );
}

// ── Gäste ──────────────────────────────────────────────────────────────────
type GastForm = { anrede: DrAnrede; vorname: string; nachname: string; firma: string; funktion: string; strasse: string; plz: string; ort: string; land: string; email: string; telefon: string };
const GAST_LEER: GastForm = { anrede: "", vorname: "", nachname: "", firma: "", funktion: "", strasse: "", plz: "", ort: "", land: "", email: "", telefon: "" };
function GaesteBlock({ akte, firmaName, kontakte, tun, zeigeCode }: { akte: Akte; firmaName: string; kontakte: KontaktKurz[]; tun: Tun; zeigeCode: (e: Einmal) => void }) {
  const [offen, setOffen] = useState(akte.gaeste.length === 0 && akte.raum.freigegeben);
  const [w, setW] = useState<GastForm>(GAST_LEER);
  const [busy, setBusy] = useState(false);
  const ausKontakt = (id: string) => {
    const k = kontakte.find((x) => String(x.id) === id);
    if (!k) return;
    const teile = k.name.trim().split(/\s+/);
    setW({
      ...w, vorname: teile.length > 1 ? teile.slice(0, -1).join(" ") : k.name, nachname: teile.length > 1 ? teile[teile.length - 1] : "",
      // Die Kontakte stammen aus der Akte dieses Partners: Ist der Partner eine Firma (nicht die Person selbst), ist sie die Firma des Gastes.
      firma: firmaName && firmaName.trim().toLowerCase() !== k.name.trim().toLowerCase() ? firmaName : "",
      funktion: k.rolle || "", email: k.email || "", telefon: k.telefon || k.mobil || "", strasse: [k.strasse, k.hausnummer].filter(Boolean).join(" "),
      plz: k.plz || "", ort: k.ort || "", land: LAND_TEXT[k.landCode] ?? k.landCode ?? "",
    });
  };
  const einladen = async () => {
    setBusy(true);
    const r = await tun(senden(`/chef/datenraum/raum/${akte.raum.id}/gast`, w));
    setBusy(false);
    if (r.ok) { zeigeCode({ gastId: Number(r.id), name: `${w.vorname} ${w.nachname}`.trim(), code: String(r.code ?? ""), link: String(r.link ?? "") }); setW(GAST_LEER); setOffen(false); }
  };
  const codeNeu = async (g: Gast) => {
    if (!window.confirm(`Neuer Code für ${g.vorname} ${g.nachname}? Der alte gilt sofort nicht mehr.`)) return;
    const r = await tun(senden(`/chef/datenraum/gast/${g.id}/code`, {}));
    if (r.ok) zeigeCode({ gastId: g.id, name: `${g.vorname} ${g.nachname}`, code: String(r.code ?? ""), link: String(r.link ?? "") });
  };
  const sperren = async (g: Gast) => {
    if (g.gesperrtAm) { await tun(senden(`/chef/datenraum/gast/${g.id}/sperren`, { sperren: false })); return; }
    const grund = window.prompt(`${g.vorname} ${g.nachname} sperren? Der Zugang endet sofort. Grund (optional):`, "");
    if (grund === null) return;
    await tun(senden(`/chef/datenraum/gast/${g.id}/sperren`, { sperren: true, grund }));
  };
  const f = (k: keyof GastForm, label: string, breit = false, typ = "text") => (
    <label className={breit ? "gp-breit" : ""}>{label}<input type={typ} value={w[k]} onChange={(e) => setW({ ...w, [k]: e.target.value })} /></label>
  );
  return (
    <div className="gp-feld-block" data-fiaon="dr-gaeste">
      <div className="gp-feld-kopf"><h3>Gäste</h3><button type="button" className="cg-knopf cg-knopf-haupt" disabled={!akte.raum.freigegeben && !offen} onClick={() => setOffen(!offen)}>{offen ? "Schließen" : "Gast einladen"}</button></div>
      {!akte.raum.freigegeben && <p className="gp-fein">Einladen geht, sobald die Vereinbarung freigegeben ist (oben).</p>}
      {offen && (
        <div className="dr-projekt-form" data-fiaon="dr-gast-neu">
          {kontakte.length > 0 && (
            <label>Aus Kontakt übernehmen
              <select defaultValue="" onChange={(e) => ausKontakt(e.target.value)}>
                <option value="">— Kontakt wählen —</option>
                {kontakte.map((k) => <option key={k.id} value={k.id}>{k.name}{k.email ? ` · ${k.email}` : ""}</option>)}
              </select>
            </label>
          )}
          <div className="gp-raster">
            <label>Anrede<select value={w.anrede} onChange={(e) => setW({ ...w, anrede: e.target.value as DrAnrede })}>{DR_ANREDEN.map((a) => <option key={a.text} value={a.wert}>{a.text}</option>)}</select></label>
            {f("vorname", "Vorname")}{f("nachname", "Nachname")}{f("email", "E-Mail (an sie geht die Einladung)", false, "email")}{f("telefon", "Telefon", false, "tel")}
            {f("firma", "Firma mit Rechtsform")}{f("funktion", "Funktion")}{f("strasse", "Straße und Hausnummer", true)}{f("plz", "PLZ")}{f("ort", "Ort")}{f("land", "Land")}
          </div>
          <p className="gp-fein">Pflicht sind Vor- und Nachname und E-Mail. Alles andere füllt der Gast vor der Unterschrift selbst aus (er sieht deine Angaben vorbefüllt). Nimmt er eine andere E-Mail, bestätigt er sie mit einem Code. Nach dem Einladen: Code und Link einmal sehen oder gleich als Entwurf in js@ — die Wiedervorlage legt der Server in der Akte an.</p>
          <div className="gp-form-knoepfe"><button type="button" className="cg-knopf cg-knopf-haupt" disabled={busy || !akte.raum.freigegeben || !w.vorname.trim() || !w.nachname.trim() || !w.email.includes("@")} onClick={() => void einladen()}>{busy ? "Lädt ein …" : "Einladen und Code erzeugen"}</button></div>
        </div>
      )}
      {akte.gaeste.length === 0 ? <p className="gp-fein">Noch kein Gast eingeladen.</p> : (
        <ul className="gp-liste">
          {akte.gaeste.map((g) => (
            <li key={g.id} className="gp-eintrag" data-fiaon="dr-gast">
              <div className="gp-eintrag-kopf">
                <b>{g.vorname} {g.nachname}{g.firma ? <span className="gp-fein"> · {g.firma}</span> : null}</b>
                <span className={`gp-marke dr-status-${g.status}`}>{STATUS_TEXT[g.status]}</span>
              </div>
              <p>{[g.email, g.telefon, g.anschrift].filter(Boolean).join(" · ")}</p>
              <p className="gp-fein">Eingeladen {datum(g.eingeladenAm)} an {g.einladungEmail || g.email}{g.emailBestaetigt && g.emailBestaetigt !== g.einladungEmail ? ` · neue E-Mail bestätigt: ${g.emailBestaetigt}` : ""}{g.codeHinweis ? ` · Code ${g.codeHinweis}` : ""}{g.zuletztAm ? ` · zuletzt da ${datumZeit(g.zuletztAm)}` : " · noch nicht eingetreten"}{g.ansichten ? ` · ${g.ansichten} ${g.ansichten === 1 ? "Abruf" : "Abrufe"}` : ""}{g.gesperrtAm ? ` · gesperrt ${datum(g.gesperrtAm)}${g.gesperrtGrund ? ` (${g.gesperrtGrund})` : ""}` : ""}</p>
              {g.weitergabe && <p className="dr-hinweis-rot">Anlage 1 — frühere Empfänger: {g.weitergabe}</p>}
              {g.ndas.map((n) => (
                <p key={n.id} className="dr-nda-zeile">
                  <a className="gp-link" href={`${API}/chef/datenraum/nda/${n.id}`} target="_blank" rel="noreferrer">NDA {datumZeit(n.unterzeichnetAm)} (PDF{n.versiegelt ? ", versiegelt" : ""})</a>
                  {" "}· Themen {n.themen} · „{n.name}“ · Fassung {n.fassung} · Wortlaut {n.hashKurz} · Datei {n.pdfKurz}{n.ip ? ` · IP ${n.ip}` : ""}{n.emailHerkunft ? ` · E-Mail ${n.emailHerkunft}` : ""}
                  <span className="gp-fein"> · Kopie an den Gast: {n.mailGast} · Meldung an dich: {n.mailJustin}</span>
                </p>
              ))}
              <div className="gp-aktionen">
                <a className="gp-link" href={`${API}/chef/datenraum/raum/${akte.raum.id}/vorschau.pdf?gast=${g.id}`} target="_blank" rel="noreferrer">Vereinbarung mit den Angaben des Gastes</a>
                <a className="gp-link" href={`${API}/chef/datenraum/gast/${g.id}/protokoll.csv`} data-fiaon="dr-protokoll-csv">Protokoll (CSV)</a>
                <button type="button" className="gp-link" onClick={() => void codeNeu(g)}>Neuer Code</button>
                <button type="button" className={`gp-link${g.gesperrtAm ? "" : " gp-leise"}`} onClick={() => void sperren(g)}>{g.gesperrtAm ? "Entsperren" : "Sperren"}</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Ordner hochladen (manifest.json je Projekt, raum.json für den Raum) ────
type ManifestEintrag = { nr?: unknown; titel?: unknown; beschreibung?: unknown; datei?: unknown; sichtbar_standard?: unknown };
type Plan = {
  raumJson: any | null;
  zeilen: { ordner: string; projekt: Projekt | null; nr: number; titel: string; beschreibung: string; datei: string; sichtbar: boolean; file: File | null; status: string; hochladen: boolean }[];
  fehler: string[];
};
function OrdnerHochladen({ akte, tun, neu }: { akte: Akte; tun: Tun; neu: () => void }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [lauf, setLauf] = useState<{ fertig: number; gesamt: number; fehler: string[] } | null>(null);
  const [liest, setLiest] = useState(false);
  const feld = useRef<HTMLInputElement | null>(null);
  const zuordnen = (name: string): Projekt | null => {
    const n = name.toLowerCase();
    return akte.projekte.find((p) => p.schluessel.toLowerCase() === n)
      ?? akte.projekte.find((p) => { const b = p.buchstabe.toLowerCase(); return n === b || n.startsWith(`${b}_`) || n.startsWith(`${b}-`) || n.startsWith(`${b} `); }) ?? null;
  };
  const lesen = async (dateien: File[]) => {
    setLiest(true); setLauf(null);
    try {
      const pfad = (f: File) => String((f as any).webkitRelativePath || f.name).split("/");
      const nachPfad = new Map(dateien.map((f) => [pfad(f).slice(1).join("/"), f]));
      const fehler: string[] = [];
      const raumDatei = nachPfad.get("raum.json");
      let raumJson: any = null;
      if (raumDatei) { try { raumJson = JSON.parse(await raumDatei.text()); } catch { fehler.push("raum.json lässt sich nicht lesen."); } }
      const ordner = Array.from(new Set(dateien.map((f) => pfad(f)).filter((t) => t.length === 3 && t[2] === "manifest.json").map((t) => t[1]))).sort();
      const zeilen: Plan["zeilen"] = [];
      for (const o of ordner) {
        let liste: ManifestEintrag[] = [];
        try { const j = JSON.parse(await nachPfad.get(`${o}/manifest.json`)!.text()); liste = Array.isArray(j) ? j : []; if (!Array.isArray(j)) fehler.push(`${o}: manifest.json ist keine Liste.`); }
        catch { fehler.push(`${o}: manifest.json lässt sich nicht lesen.`); continue; }
        const projekt = zuordnen(o);
        if (!projekt) fehler.push(`${o}: passt zu keinem Projekt (${akte.projekte.map((p) => `${p.buchstabe}/${p.schluessel}`).join(", ") || "noch keine — erst raum.json übernehmen"}).`);
        for (const m of liste) {
          const datei = String(m?.datei ?? "");
          const file = datei && !datei.includes("..") && !datei.includes("/") ? nachPfad.get(`${o}/${datei}`) ?? null : null;
          const nr = Number.isInteger(Number(m?.nr)) ? Number(m.nr) : 0;
          let status = ""; let hoch = false;
          if (!file) status = "Datei fehlt im Ordner";
          else if (file.size > DR_DATEI_MAX_BYTES) status = "größer als 25 MB";
          else if (!projekt) status = "kein Projekt";
          else {
            const sha = await sha256Hex(file);
            const gleich = projekt.dokumente.find((d) => d.sha256 === sha);
            const alt = projekt.dokumente.find((d) => d.quelle === datei);
            status = gleich ? "schon da (gleicher Inhalt)" : alt ? "ersetzt die alte Fassung" : m?.sichtbar_standard === false ? "neu, unsichtbar" : "neu, sichtbar";
            hoch = !gleich;
          }
          zeilen.push({ ordner: o, projekt, nr, titel: String(m?.titel ?? datei), beschreibung: String(m?.beschreibung ?? ""), datei, sichtbar: m?.sichtbar_standard !== false, file, status, hochladen: hoch });
        }
      }
      if (!ordner.length) fehler.push("Keine Unterordner mit manifest.json gefunden — bitte den Datenraum-Ordner wählen (je Projekt ein Unterordner).");
      setPlan({ raumJson, zeilen, fehler });
    } finally { setLiest(false); }
  };
  const raumUebernehmen = async () => {
    const j = plan?.raumJson; if (!j) return;
    const r1 = await tun(senden(`/chef/datenraum/raum/${akte.raum.id}`, { ...(j.titel ? { titel: j.titel } : {}), ...(j.nda ? { nda: j.nda } : {}) }), "raum.json: Raum übernommen.");
    if (!r1.ok) return;
    for (const p of Array.isArray(j.projekte) ? j.projekte : []) {
      const r = await senden(`/chef/datenraum/raum/${akte.raum.id}/projekt`, p);
      if (!r.ok) { await tun(Promise.resolve(r)); return; }
    }
    await tun(Promise.resolve({ ok: true, meldung: "raum.json übernommen — bitte die Vereinbarung ansehen und freigeben, dann den Ordner noch einmal wählen." }));
    setPlan(null); if (feld.current) feld.current.value = "";
  };
  const alleHochladen = async () => {
    if (!plan) return;
    const zu = plan.zeilen.filter((z) => z.hochladen && z.file && z.projekt);
    const fehler: string[] = [];
    setLauf({ fertig: 0, gesamt: zu.length, fehler });
    for (let i = 0; i < zu.length; i++) {
      const z = zu[i];
      const fd = new FormData();
      fd.append("titel", z.titel); fd.append("beschreibung", z.beschreibung); fd.append("nr", String(z.nr)); fd.append("sichtbar", z.sichtbar ? "1" : "0"); fd.append("quelle", z.datei);
      fd.append("datei", z.file!);
      const r = await hochladen(`/chef/datenraum/projekt/${z.projekt!.id}/dokument`, fd);
      if (!r.ok) fehler.push(`${z.ordner}/${z.datei}: ${r.error ?? "Fehler"}`);
      setLauf({ fertig: i + 1, gesamt: zu.length, fehler: [...fehler] });
    }
    await tun(Promise.resolve({ ok: fehler.length === 0, meldung: `${zu.length - fehler.length} von ${zu.length} Unterlagen hochgeladen.`, error: fehler.length ? `${fehler.length} Unterlagen nicht hochgeladen (siehe Liste).` : undefined }));
    setPlan(null); if (feld.current) feld.current.value = "";
    neu();
  };
  const hoch = plan?.zeilen.filter((z) => z.hochladen).length ?? 0;
  return (
    <div className="gp-feld-block" data-fiaon="dr-ordner-hochladen">
      <div className="gp-feld-kopf"><h3>Ordner hochladen</h3></div>
      <p className="gp-fein">Den Datenraum-Ordner wählen: je Projekt ein Unterordner (Name beginnt mit dem Buchstaben, z. B. „A_…“, oder heißt wie sein Schlüssel) mit manifest.json — einer Liste aus nr, titel, beschreibung, datei, sichtbar_standard. Liegt raum.json daneben, übernimmt der Raum Titel, Zusätze und Projekte. Gleiche Dateien kommen nicht doppelt, neue Fassungen ersetzen die alten.</p>
      <div className="gp-form-knoepfe">
        <input ref={feld} type="file" multiple {...({ webkitdirectory: "", directory: "" } as Record<string, string>)} onChange={(e) => { const l = Array.from(e.target.files ?? []); if (l.length) void lesen(l); }} data-fiaon="dr-ordner-wahl" />
        {liest && <span className="gp-fein">Liest den Ordner …</span>}
      </div>
      {plan && (
        <div className="dr-plan">
          {plan.fehler.map((f) => <p key={f} className="dr-hinweis-rot">{f}</p>)}
          {plan.raumJson && (
            <div className="dr-projekt-form">
              <b>raum.json</b>
              <p className="gp-fein">{plan.raumJson.titel ? `Titel „${plan.raumJson.titel}“ · ` : ""}{Object.values(plan.raumJson.nda ?? {}).filter(Boolean).length} Zusätze der Vereinbarung · {Array.isArray(plan.raumJson.projekte) ? plan.raumJson.projekte.length : 0} Projekte ({(plan.raumJson.projekte ?? []).map((p: any) => p.schluessel).join(", ")})</p>
              <div className="gp-form-knoepfe"><button type="button" className="cg-knopf" onClick={() => void raumUebernehmen()}>raum.json übernehmen</button><span className="gp-fein">Danach die Vereinbarung ansehen und freigeben.</span></div>
            </div>
          )}
          {plan.zeilen.length > 0 && (
            <ul className="dr-doks">
              {plan.zeilen.map((z) => (
                <li key={`${z.ordner}/${z.datei}`} className={z.hochladen ? "" : "aus"}>
                  <span className="dr-nr">{z.projekt?.buchstabe ?? "?"}{zweistellig(z.nr)}</span>
                  <div className="dr-dok-text"><b>{z.titel}</b><small>{z.ordner}/{z.datei}{z.file ? ` · ${groesse(z.file.size)}` : ""} · {z.status}</small></div>
                </li>
              ))}
            </ul>
          )}
          <div className="gp-form-knoepfe">
            <button type="button" className="cg-knopf cg-knopf-haupt" disabled={!hoch || !!lauf} onClick={() => void alleHochladen()} data-fiaon="dr-ordner-start">{lauf ? `Lädt hoch … ${lauf.fertig} von ${lauf.gesamt}` : `${hoch} ${hoch === 1 ? "Unterlage" : "Unterlagen"} hochladen`}</button>
            <button type="button" className="gp-link" onClick={() => { setPlan(null); if (feld.current) feld.current.value = ""; }}>Verwerfen</button>
          </div>
          {lauf?.fehler.map((f) => <p key={f} className="dr-hinweis-rot">{f}</p>)}
        </div>
      )}
    </div>
  );
}

// ── Projekte und Unterlagen ────────────────────────────────────────────────
function ProjektBlock({ p, raumId, tun, neu }: { p: Projekt; raumId: number; tun: Tun; neu: () => void }) {
  const [bearbeiten, setBearbeiten] = useState(false);
  const [w, setW] = useState<ProjektForm>({ titel: p.titel, beschreibung: p.beschreibung, ndaText: p.ndaText, geschuetzt: p.geschuetzt });
  const [dateien, setDateien] = useState<File[]>([]);
  const [d, setD] = useState({ titel: "", beschreibung: "", sichtbar: true });
  const [busy, setBusy] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ id: number; titel: string; beschreibung: string; nr: string } | null>(null);
  const feld = useRef<HTMLInputElement | null>(null);
  const mitNummer = p.dokumente.some((x) => x.nr > 0);
  const naechsteNr = p.dokumente.reduce((m, x) => Math.max(m, x.nr), 0) + 1;
  const speichern = async () => { const r = await tun(senden(`/chef/datenraum/raum/${raumId}/projekt`, { id: p.id, ...w })); if (r.ok) setBearbeiten(false); };
  const ablegen = async () => {
    if (!dateien.length) return;
    const fehler: string[] = [];
    for (let i = 0; i < dateien.length; i++) {
      const datei = dateien[i];
      setBusy(`${i + 1} von ${dateien.length}`);
      const fd = new FormData();
      const einzeln = dateien.length === 1;
      fd.append("titel", einzeln && d.titel ? d.titel : datei.name.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " "));
      fd.append("beschreibung", einzeln ? d.beschreibung : ""); fd.append("sichtbar", d.sichtbar ? "1" : "0"); fd.append("nr", String(naechsteNr + i));
      fd.append("datei", datei);
      const r = await hochladen(`/chef/datenraum/projekt/${p.id}/dokument`, fd);
      if (!r.ok) fehler.push(`${datei.name}: ${r.error ?? "Fehler"}`);
    }
    setBusy(null);
    await tun(Promise.resolve({ ok: fehler.length === 0, meldung: `${dateien.length - fehler.length} von ${dateien.length} hochgeladen.`, error: fehler.join(" · ") }));
    setDateien([]); setD({ titel: "", beschreibung: "", sichtbar: true }); if (feld.current) feld.current.value = "";
    neu();
  };
  return (
    <div className="gp-feld-block dr-projekt" data-fiaon="dr-projekt">
      <div className="gp-feld-kopf">
        <h3><span className="dr-bu">{p.buchstabe}</span>{p.titel}</h3>
        <div className="gp-knoepfe">
          <button type="button" className="cg-knopf" onClick={() => setBearbeiten(!bearbeiten)}>{bearbeiten ? "Schließen" : "Bearbeiten"}</button>
        </div>
      </div>
      {!bearbeiten && (p.beschreibung || p.ndaText) && <p className="gp-fein">{p.beschreibung}{p.ndaText ? <><br />§ 1: {p.ndaText}</> : null}{p.geschuetzt ? <><br />§ 4: {p.geschuetzt}</> : null}</p>}
      {bearbeiten && (
        <>
          <ProjektFelder w={w} setze={(x) => setW({ ...w, ...x })} />
          <p className="gp-fein">Ändert sich der Text in der Vereinbarung (Titel, § 1, § 4 oder — ohne eigenen §-1-Text — die Kurzbeschreibung), bestätigen Gäste eine ergänzte Fassung, bevor sie die Unterlagen dieses Projekts wieder sehen; die Vereinbarung braucht dann eine neue Freigabe.</p>
          <div className="gp-form-knoepfe">
            <button type="button" className="cg-knopf cg-knopf-haupt" disabled={w.titel.trim().length < 2} onClick={() => void speichern()}>Speichern</button>
            <button type="button" className="gp-link gp-leise" onClick={() => { if (window.confirm(`Projekt ${p.buchstabe} entfernen? Seine Unterlagen sind dann für Gäste nicht mehr sichtbar.`)) void tun(senden(`/chef/datenraum/projekt/${p.id}/entfernen`, {})); }}>Projekt entfernen</button>
          </div>
        </>
      )}
      {p.dokumente.length === 0 ? <p className="gp-fein">Noch keine Unterlagen in diesem Ordner.</p> : (
        <ul className="dr-doks">
          {p.dokumente.map((x, i) => (
            <li key={x.id} className={x.sichtbar ? "" : "aus"} data-fiaon="dr-dokument">
              <span className="dr-nr">{zweistellig(mitNummer ? x.nr : i + 1)}</span>
              {edit?.id === x.id ? (
                <div className="dr-dok-text dr-dok-edit">
                  <div className="gp-raster">
                    <label>Nr.<input value={edit.nr} inputMode="numeric" onChange={(e) => setEdit({ ...edit, nr: e.target.value.replace(/\D/g, "").slice(0, 3) })} /></label>
                    <label className="gp-breit">Titel<input value={edit.titel} onChange={(e) => setEdit({ ...edit, titel: e.target.value })} /></label>
                    <label className="gp-breit">Ein Satz dazu<input value={edit.beschreibung} onChange={(e) => setEdit({ ...edit, beschreibung: e.target.value })} /></label>
                  </div>
                  <div className="gp-form-knoepfe">
                    <button type="button" className="cg-knopf cg-knopf-haupt" disabled={edit.titel.trim().length < 2} onClick={() => void tun(senden(`/chef/datenraum/dokument/${x.id}`, { titel: edit.titel, beschreibung: edit.beschreibung, nr: edit.nr === "" ? undefined : Number(edit.nr) })).then((r) => { if (r.ok) setEdit(null); })}>Speichern</button>
                    <button type="button" className="gp-link" onClick={() => setEdit(null)}>Abbrechen</button>
                  </div>
                </div>
              ) : (
                <div className="dr-dok-text">
                  <b>{x.titel}</b>
                  {x.beschreibung && <span>{x.beschreibung}</span>}
                  <small>{[x.typ, x.seiten ? `${x.seiten} S.` : "", groesse(x.groesse), `${x.ansichten} ${x.ansichten === 1 ? "Abruf" : "Abrufe"}`, x.hochgeladenVon ? `von ${x.hochgeladenVon}` : "", datum(x.erstelltAm)].filter(Boolean).join(" · ")}{x.vermerkMoeglich === false ? <em> · ohne Vermerk ({x.vermerkGrund ?? "nicht möglich"})</em> : x.typ !== "PDF" ? <em> · ohne Vermerk (kein PDF)</em> : null}</small>
                </div>
              )}
              <div className="dr-dok-wege">
                <label className="dr-schalter" title={x.sichtbar ? "Für Gäste sichtbar" : "Für Gäste unsichtbar"}>
                  <input type="checkbox" checked={x.sichtbar} onChange={(e) => void tun(senden(`/chef/datenraum/dokument/${x.id}`, { sichtbar: e.target.checked }))} data-fiaon="dr-sichtbar" />
                  <span>{x.sichtbar ? "sichtbar" : "unsichtbar"}</span>
                </label>
                <button type="button" className="gp-link" onClick={() => setEdit({ id: x.id, titel: x.titel, beschreibung: x.beschreibung, nr: String(x.nr) })}>Bearbeiten</button>
                <a className="gp-link" href={`${API}/chef/datenraum/dokument/${x.id}`} target="_blank" rel="noreferrer">Ansehen</a>
                <button type="button" className="gp-link gp-leise" onClick={() => { if (window.confirm(`„${x.titel}“ entfernen?`)) void tun(senden(`/chef/datenraum/dokument/${x.id}/entfernen`, {})); }}>Entfernen</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="dr-hochladen">
        <div className="gp-raster">
          <label className="gp-breit">Unterlagen hochladen ({DR_DATEI_HINWEIS}; mehrere auf einmal möglich — Office-Dateien und Bilder tragen keinen Vermerk, wo möglich als PDF)
            <input ref={feld} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx,.pptx,application/pdf,image/jpeg,image/png" onChange={(e) => { const l = Array.from(e.target.files ?? []); setDateien(l); if (l.length === 1 && !d.titel) setD({ ...d, titel: l[0].name.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ") }); }} />
          </label>
          {dateien.length <= 1 && <label>Titel<input value={d.titel} onChange={(e) => setD({ ...d, titel: e.target.value })} /></label>}
          {dateien.length <= 1 && <label>Ein Satz dazu<input value={d.beschreibung} onChange={(e) => setD({ ...d, beschreibung: e.target.value })} placeholder="was der Gast darin findet" /></label>}
          {dateien.length > 1 && <p className="gp-fein gp-breit">{dateien.length} Dateien — Titel aus dem Dateinamen, Nummern ab {zweistellig(naechsteNr)}; danach je Unterlage „Bearbeiten“.</p>}
        </div>
        <div className="gp-form-knoepfe">
          <label className="gp-haken"><input type="checkbox" checked={d.sichtbar} onChange={(e) => setD({ ...d, sichtbar: e.target.checked })} /> sofort sichtbar</label>
          <button type="button" className="cg-knopf cg-knopf-haupt" disabled={!!busy || !dateien.length} onClick={() => void ablegen()}>{busy ? `Lädt hoch … ${busy}` : "Hochladen"}</button>
        </div>
      </div>
    </div>
  );
}
function NeuesProjekt({ raumId, tun }: { raumId: number; tun: Tun }) {
  const [offen, setOffen] = useState(false);
  const [w, setW] = useState<ProjektForm>({ ...PROJEKT_LEER });
  const anlegen = async () => { const r = await tun(senden(`/chef/datenraum/raum/${raumId}/projekt`, w)); if (r.ok) { setW({ ...PROJEKT_LEER }); setOffen(false); } };
  if (!offen) return <div className="gp-form-knoepfe"><button type="button" className="gp-link" onClick={() => setOffen(true)}>Projekt hinzufügen</button><span className="gp-fein">Danach die Vereinbarung neu freigeben. Gäste mit unterschriebener Vereinbarung bestätigen für ein neues Thema eine ergänzte Fassung, sobald es Unterlagen hat.</span></div>;
  return (
    <div className="gp-feld-block" data-fiaon="dr-projekt-neu">
      <div className="gp-feld-kopf"><h3>Neues Projekt</h3><button type="button" className="cg-knopf" onClick={() => setOffen(false)}>Abbrechen</button></div>
      <ProjektFelder w={w} setze={(x) => setW({ ...w, ...x })} />
      <div className="gp-form-knoepfe"><button type="button" className="cg-knopf cg-knopf-haupt" disabled={w.titel.trim().length < 2} onClick={() => void anlegen()}>Projekt anlegen</button></div>
    </div>
  );
}
