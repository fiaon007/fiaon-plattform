// ═══════════════════════════════════════════════════════════════════════════
// CHEFBÜRO · GLOBAL-AUFTRÄGE › GESCHÄFTSPARTNER — DAS CRM (E-425, 22.10.2026)
//
// Justin: „Ein vollständiges, hochwertiges CRM, über das wir alles steuern,
// speichern, suchen — KI-gestützt. Beim Tippen einer Adresse kommen Vorschläge,
// aus einer Mail wird alles übernommen. 100 % funktional, aktiv mitdenkend."
//
// Keine neue Chef-Seite: steht im Reiter „Geschäftspartner“ ÜBER der Liste der
// Kooperationsverträge (ChefGlobalAngebote nur="partner").
//   · Suche sofort beim Tippen (Name, Kontakte, E-Mails, Telefon, Tags, Verlauf).
//   · Filter Art und Status, Archiv.
//   · Partnerkarte → Akte als Schublade: Überblick, Kontakte, Verlauf,
//     Dokumente, Aufgaben. „Was steht an?“ denkt mit (ohne KI immer, mit KI
//     zusätzlich ein kurzer Satz).
//   · „Aus E-Mail übernehmen“: Vorschau zum Prüfen — gespeichert wird erst mit
//     „Übernehmen“. Ohne KI werten Regeln aus, und die Seite sagt warum.
//   · IA-KOOP-Partner ohne Akte stehen oben mit „als Partner-Akte anlegen“.
// Server: server/routes/fiaon-partner-crm.ts · Regeln: shared/fiaon-partner-crm.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { API, datum, datumZeit, Geruest, Fehlermeldung } from "./chef-teile";
import {
  PARTNER_ARTEN, PARTNER_STATUS, VERLAUF_TYPEN, DOKUMENT_ARTEN, LAND_NAMEN, textFuer, firmenTreffer,
  type Kondition, type LageHinweis, type MailVorschlag, type Treffer, type AdressVorschlag,
} from "@shared/fiaon-partner-crm";
import "@/styles/chef-partner-crm.css";

// ── Antwortformen (wie der Server sie liefert) ─────────────────────────────
type Karte = {
  id: number; name: string; art: string; status: string; vertraulich: boolean; ort: string; landCode: string; tags: string[];
  hauptkontakt: { name: string; rolle: string; email: string; telefon: string; durchwahl: string } | null; kontakte: number;
  naechsteAufgabe: { titel: string; faelligAm: string | null; ueberfaellig: boolean } | null; offeneAufgaben: number; ueberfaellig: number;
  letzteAktivitaet: { am: string; typ: string; titel: string } | null; betreuer: string | null; angebotRef: string | null; personId: number | null;
  fund: string | null; archiviert: boolean;
};
type Kontakt = {
  id: number; firmaId: number | null; firmaName: string | null; name: string; rolle: string; email: string; telefon: string; mobil: string; durchwahl: string;
  erreichbarkeit: string; sprache: string; strasse: string; hausnummer: string; adresszusatz: string; plz: string; ort: string; region: string; landCode: string;
  notizen: string; haupt: boolean; erstelltAm: string;
};
type KoopOhneAkte = { angebotId: number; ref: string; status: string; name: string; email: string; telefon: string; ort: string };
type Liste = {
  ok: boolean; firmen: Karte[]; kontakte: Kontakt[]; koopOhneAkte: KoopOhneAkte[]; zaehler: { gesamt: number; aktiv: number; ueberfaellig: number };
  mitarbeiter: { id: number; name: string }[]; ki: { bereit: boolean; grund: string | null };
};
type Firma = {
  id: number; name: string; art: string; status: string; website: string; email: string; telefon: string; strasse: string; hausnummer: string; adresszusatz: string;
  plz: string; ort: string; region: string; landCode: string; registerNr: string; steuerNr: string; ustId: string; leistung: string; konditionen: Kondition[]; tags: string[];
  notizen: string; betreuerAgentId: number | null; betreuer: string | null; vertraulich: boolean; angebotId: number | null; personId: number | null;
  archiviertAm: string | null; erstelltVon: string | null; erstelltAm: string; geaendertAm: string;
};
type Verlauf = { id: number; typ: string; am: string; titel: string; text: string; autor: string | null; kontaktId: number | null; dokumentId: number | null; dokumentTitel: string | null; erstelltAm: string };
type Dokument = { id: number; art: string; titel: string; dateiname: string; mime: string; groesse: number; gueltigAb: string | null; gueltigBis: string | null; notiz: string; hochgeladenVon: string | null; erstelltAm: string };
type Aufgabe = { id: number; titel: string; notiz: string; faelligAm: string | null; zustaendig: string; erledigtAm: string | null; erledigtVon: string | null; erstelltVon: string | null };
type Akte = { firma: Firma; kontakte: Kontakt[]; verlauf: Verlauf[]; dokumente: Dokument[]; aufgaben: Aufgabe[]; koop: { id: number; ref: string; status: string; angenommenAm: string | null } | null; hinweise: LageHinweis[] };
type Antwort = { ok: boolean; error?: string; meldung?: string; [k: string]: any };
type Meldung = { gut: boolean; text: string } | null;
type Schublade = { art: "akte"; id: number; tab?: Reiter } | { art: "firma-neu" } | { art: "kontakt-neu"; firmaId?: number | null; kontakt?: Kontakt } | { art: "mail"; firmaId?: number | null };
type Reiter = "ueberblick" | "kontakte" | "verlauf" | "dokumente" | "aufgaben";

// ── Netz ───────────────────────────────────────────────────────────────────
async function holen(pfad: string): Promise<Antwort> {
  try {
    const r = await fetch(`${API}${pfad}`, { credentials: "include" });
    const j = await r.json().catch(() => null);
    if (r.status === 401) return { ok: false, error: "Die Anmeldung ist abgelaufen. Bitte neu anmelden." };
    return j ?? { ok: false, error: `Antwort ${r.status} ohne Inhalt.` };
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
const heuteIso = () => {
  const t = new Date(); const z = (n: number) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${z(t.getMonth() + 1)}-${z(t.getDate())}`;
};
/** Für reine Tagesangaben (Verlauf): heute, gestern, vor n Tagen — keine Uhrzeit, die es nicht gibt. */
const seitTag = (iso: string) => {
  const t = Math.round((new Date(`${heuteIso()}T12:00:00`).getTime() - new Date(`${iso}T12:00:00`).getTime()) / 86_400_000);
  if (t <= 0) return t < 0 ? `am ${datum(iso)}` : "heute";
  if (t === 1) return "gestern";
  if (t < 60) return `vor ${t} Tagen`;
  return `am ${datum(iso)}`;
};
const groesse = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const telefonZeile = (t: string, dw: string) => [t, dw ? `Durchwahl ${dw}` : ""].filter(Boolean).join(" · ");
const adressZeile = (a: { strasse?: string; hausnummer?: string; adresszusatz?: string; plz?: string; ort?: string; region?: string; landCode?: string }) =>
  [[a.strasse, a.hausnummer].filter(Boolean).join(" "), a.adresszusatz, [a.plz, a.ort].filter(Boolean).join(" "), a.region, a.landCode ? LAND_NAMEN[a.landCode] ?? a.landCode : ""].filter(Boolean).join(", ");

function Lupe() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></svg>;
}
function StatusMarke({ status }: { status: string }) {
  return <span className={`gp-marke gp-marke-${status}`}>{textFuer(PARTNER_STATUS, status)}</span>;
}

// ═══════════════════════════════════════════════════════════════════════════
export default function ChefGeschaeftspartner() {
  const [q, setQ] = useState("");
  const [qAktiv, setQAktiv] = useState("");
  const [art, setArt] = useState("");
  const [status, setStatus] = useState("");
  const [archiv, setArchiv] = useState(false);
  const [liste, setListe] = useState<Liste | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [runde, setRunde] = useState(0);
  const [meldung, setMeldung] = useState<Meldung>(null);
  const [schublade, setSchubladeRoh] = useState<Schublade | null>(() => {
    try { const id = Number(new URLSearchParams(window.location.search).get("partner")); return id > 0 ? { art: "akte", id } : null; } catch { return null; }
  });
  const [busy, setBusy] = useState<string | null>(null);

  // Tippen → 220 ms warten → suchen. Jede neue Anfrage überholt die alte.
  useEffect(() => { const t = setTimeout(() => setQAktiv(q.trim()), 220); return () => clearTimeout(t); }, [q]);
  useEffect(() => {
    let weg = false;
    setLaedt(true);
    const p = new URLSearchParams();
    if (qAktiv) p.set("q", qAktiv);
    if (art) p.set("art", art);
    if (status) p.set("status", status);
    if (archiv) p.set("archiv", "1");
    holen(`/chef/partner-crm${p.toString() ? `?${p}` : ""}`).then((j) => {
      if (weg) return;
      if (j.ok) { setListe(j as Liste); setFehler(null); } else setFehler(j.error || "Die Partnerliste ließ sich nicht laden.");
    }).finally(() => { if (!weg) setLaedt(false); });
    return () => { weg = true; };
  }, [qAktiv, art, status, archiv, runde]);

  const neuLaden = useCallback(() => setRunde((r) => r + 1), []);
  const setSchublade = useCallback((s: Schublade | null) => {
    setSchubladeRoh(s);
    try {
      const u = new URL(window.location.href);
      if (s?.art === "akte") u.searchParams.set("partner", String(s.id)); else u.searchParams.delete("partner");
      window.history.replaceState(null, "", u.pathname + u.search);
    } catch { /* Adresse bleibt — die Schublade öffnet trotzdem */ }
  }, []);

  const ausKoop = async (k: KoopOhneAkte) => {
    setBusy(`koop${k.angebotId}`); setMeldung(null);
    const r = await senden(`/chef/partner-crm/aus-koop/${k.angebotId}`, {});
    setBusy(null);
    setMeldung(r.ok ? { gut: true, text: r.meldung || "Angelegt." } : { gut: false, text: `Nicht angelegt: ${r.error}` });
    if (r.ok) { neuLaden(); setSchublade({ art: "akte", id: Number(r.id) }); }
  };

  if (fehler && !liste) return <Fehlermeldung text={fehler} erneut={neuLaden} />;
  if (!liste) return <Geruest zeilen={5} />;
  const ki = liste.ki;

  return (
    <div className="gp" data-fiaon="partner-crm">
      {meldung && <div className={`cm-meldung ${meldung.gut ? "" : "cg-rot"}`} role="status">{meldung.text}</div>}

      <section className="cz-block">
        <div className="gp-kopf-zeile">
          <header>
            <h2>Geschäftspartner</h2>
            <p>Alle Partner mit Kontakten, Verlauf, Verträgen und Aufgaben — an einem Ort, durchsuchbar.</p>
          </header>
          <div className="gp-knoepfe">
            <button type="button" className="cg-knopf cg-knopf-haupt gp-bg-haupt" onClick={() => setSchublade({ art: "firma-neu" })}>Neuer Partner</button>
            <button type="button" className="cg-knopf" onClick={() => setSchublade({ art: "kontakt-neu" })}>Neuer Kontakt</button>
            <button type="button" className="cg-knopf" onClick={() => setSchublade({ art: "mail" })} title={ki.bereit ? "KI liest die Mail und schlägt alles vor" : `KI aus: ${ki.grund ?? ""} — Regeln werten trotzdem aus`}>Aus E-Mail übernehmen</button>
          </div>
        </div>
        <div className="gp-zahlen">
          <span><b>{liste.zaehler.gesamt}</b>Partner</span>
          <span><b>{liste.zaehler.aktiv}</b>aktiv</span>
          <span className={liste.zaehler.ueberfaellig ? "gp-rot" : ""}><b>{liste.zaehler.ueberfaellig}</b>mit überfälliger Aufgabe</span>
          {!ki.bereit && <span className="gp-gelb">KI gerade aus — {ki.grund} Alles andere funktioniert.</span>}
        </div>
      </section>

      <section className="cz-block">
        <div className="gp-suche">
          <Lupe />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suchen: Name, Kontakt, E-Mail, Telefon, Tag, Verlauf …" aria-label="Partner suchen" />
        </div>
        <div className="gp-filterzeile">
          <div className="cg-filter" role="group" aria-label="Art">
            <button type="button" className={art === "" ? "aktiv" : ""} onClick={() => setArt("")}>Alle Arten</button>
            {PARTNER_ARTEN.map((a) => <button key={a.wert} type="button" className={art === a.wert ? "aktiv" : ""} onClick={() => setArt(art === a.wert ? "" : a.wert)}>{a.text}</button>)}
          </div>
          <span className="gp-trenner" aria-hidden="true" />
          <div className="cg-filter" role="group" aria-label="Status">
            <button type="button" className={status === "" ? "aktiv" : ""} onClick={() => setStatus("")}>Jeder Status</button>
            {PARTNER_STATUS.map((s) => <button key={s.wert} type="button" className={status === s.wert ? "aktiv" : ""} onClick={() => setStatus(status === s.wert ? "" : s.wert)}>{s.text}</button>)}
            <button type="button" className={archiv ? "aktiv" : ""} onClick={() => setArchiv(!archiv)}>Archiv</button>
          </div>
        </div>
        {fehler && <p className="gp-fein gp-rot" role="alert">{fehler}</p>}
      </section>

      {liste.koopOhneAkte.length > 0 && !archiv && (
        <div className="gp-streifen" data-fiaon="koop-ohne-akte">
          <p className="gp-fein">Kooperationspartner (Vertrag unten) ohne Partner-Akte — ein Klick übernimmt Name und Kontaktdaten:</p>
          {liste.koopOhneAkte.map((k) => (
            <div key={k.angebotId} className="gp-streifen-zeile">
              <b>{k.name}</b>
              <span className="gp-fein">{[k.ref, k.status === "angenommen" ? "angenommen" : "offen", k.email, k.ort].filter(Boolean).join(" · ")}</span>
              <button type="button" className="cg-knopf" disabled={busy === `koop${k.angebotId}`} onClick={() => ausKoop(k)}>Als Partner-Akte anlegen</button>
            </div>
          ))}
        </div>
      )}

      {liste.firmen.length === 0 ? (
        <div className="gp-leer">
          {qAktiv || art || status ? "Nichts gefunden — Suche oder Filter lockern." : archiv ? "Das Archiv ist leer." : "Noch kein Partner. Leg den ersten an — oder füg eine Mail ein und lass sie auswerten."}
        </div>
      ) : (
        <div className="gp-karten" aria-busy={laedt}>
          {liste.firmen.map((f) => <PartnerKarte key={f.id} f={f} oeffnen={() => setSchublade({ art: "akte", id: f.id })} />)}
        </div>
      )}

      {liste.kontakte.length > 0 && (
        <section className="cz-block">
          <header><h2>Einzelkontakte</h2><p>Menschen ohne Partnerfirma — jederzeit einem Partner zuordnen.</p></header>
          <ul className="gp-liste">
            {liste.kontakte.map((k) => (
              <li key={k.id} className="gp-eintrag">
                <div className="gp-eintrag-kopf">
                  <b>{k.name}{k.rolle ? <span className="gp-fein"> · {k.rolle}</span> : null}</b>
                  <button type="button" className="gp-link" onClick={() => setSchublade({ art: "kontakt-neu", kontakt: k })}>Bearbeiten</button>
                </div>
                <p>{[k.email, telefonZeile(k.telefon, k.durchwahl), k.mobil, adressZeile(k)].filter(Boolean).join(" · ") || "—"}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {schublade && (
        <SchubladeRahmen schliessen={() => setSchublade(null)}>
          {schublade.art === "akte" && (
            <AkteAnsicht key={schublade.id} id={schublade.id} startTab={schublade.tab} liste={liste} schliessen={() => setSchublade(null)}
              geaendert={neuLaden} oeffne={setSchublade} />
          )}
          {schublade.art === "firma-neu" && (
            <NeuerPartner mitarbeiter={liste.mitarbeiter} firmen={liste.firmen} schliessen={() => setSchublade(null)}
              fertig={(id) => { neuLaden(); setSchublade({ art: "akte", id }); }} oeffne={(id) => setSchublade({ art: "akte", id })} />
          )}
          {schublade.art === "kontakt-neu" && (
            <KontaktSchublade firmen={liste.firmen} firmaId={schublade.firmaId ?? null} kontakt={schublade.kontakt ?? null} schliessen={() => setSchublade(null)}
              fertig={(firmaId) => { neuLaden(); setSchublade(firmaId ? { art: "akte", id: firmaId, tab: "kontakte" } : null); }} />
          )}
          {schublade.art === "mail" && (
            <MailUebernahme ki={ki} firmen={liste.firmen} firmaId={schublade.firmaId ?? null} schliessen={() => setSchublade(null)}
              fertig={(id) => { neuLaden(); setSchublade({ art: "akte", id }); }} />
          )}
        </SchubladeRahmen>
      )}
    </div>
  );
}

// ── Partnerkarte ───────────────────────────────────────────────────────────
function PartnerKarte({ f, oeffnen }: { f: Karte; oeffnen: () => void }) {
  const hk = f.hauptkontakt;
  return (
    <button type="button" className="gp-karte" onClick={oeffnen} data-partner={f.id}>
      <div className="gp-karte-kopf">
        <div>
          <h3>{f.name}</h3>
          <span className="gp-art">{textFuer(PARTNER_ARTEN, f.art)}{f.ort ? ` · ${f.ort}` : ""}{f.landCode ? ` (${f.landCode})` : ""}</span>
        </div>
        <StatusMarke status={f.status} />
      </div>
      {f.fund && <span className="gp-fund">{f.fund}</span>}
      <p className="gp-zeile">
        {hk ? <><b>{hk.name}</b>{hk.rolle ? ` · ${hk.rolle}` : ""}<br />{[hk.email, telefonZeile(hk.telefon, hk.durchwahl)].filter(Boolean).join(" · ") || "ohne Kontaktweg"}</> : <span className="gp-gelb">Noch kein Ansprechpartner</span>}
        {f.kontakte > 1 ? <span className="gp-fein"> · +{f.kontakte - 1} weitere</span> : null}
      </p>
      <p className={`gp-zeile ${f.naechsteAufgabe?.ueberfaellig ? "gp-rot" : ""}`}>
        {f.naechsteAufgabe
          ? <>Nächster Schritt: <b>{f.naechsteAufgabe.titel}</b>{f.naechsteAufgabe.faelligAm ? ` · ${f.naechsteAufgabe.ueberfaellig ? "überfällig seit" : "bis"} ${datum(f.naechsteAufgabe.faelligAm)}` : ""}{f.offeneAufgaben > 1 ? ` (+${f.offeneAufgaben - 1})` : ""}</>
          : <span className="gp-fein">Keine offene Aufgabe</span>}
      </p>
      <p className="gp-zeile gp-fein">
        {f.letzteAktivitaet ? <>Zuletzt {seitTag(f.letzteAktivitaet.am)} · {textFuer(VERLAUF_TYPEN, f.letzteAktivitaet.typ)}: {f.letzteAktivitaet.titel}</> : "Noch kein Verlauf"}
      </p>
      {(f.vertraulich || f.tags.length > 0 || f.angebotRef || f.personId || f.betreuer) && (
        <div className="gp-karte-fuss">
          {f.vertraulich && <span className="gp-tag gp-vertraulich">vertraulich</span>}
          {f.angebotRef && <span className="gp-tag">Kooperation {f.angebotRef}</span>}
          {f.personId && <span className="gp-tag">Auch Kunde · #{f.personId}</span>}
          {f.betreuer && <span className="gp-tag">{f.betreuer}</span>}
          {f.tags.slice(0, 4).map((t) => <span key={t} className="gp-tag">{t}</span>)}
        </div>
      )}
    </button>
  );
}

// ── Schublade ──────────────────────────────────────────────────────────────
function SchubladeRahmen({ children, schliessen }: { children: ReactNode; schliessen: () => void }) {
  useEffect(() => {
    const taste = (e: KeyboardEvent) => { if (e.key === "Escape") schliessen(); };
    window.addEventListener("keydown", taste);
    const alt = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", taste); document.body.style.overflow = alt; };
  }, [schliessen]);
  // Ins <body> gehängt: Die Chefbüro-Hülle trägt eine Animation mit transform (dann wäre „fixed“ an der Hülle statt am Fenster)
  // und färbt jeden Knopf darin als Glas um — die Schublade braucht beides nicht.
  return createPortal(
    <div className="gp-schublade" data-fiaon="partner-schublade">
      <div className="gp-hinter" onClick={schliessen} aria-hidden="true" />
      <aside className="gp-panel gp" role="dialog" aria-modal="true">{children}</aside>
    </div>,
    document.body,
  );
}
function PanelKopf({ titel, unter, rechts, schliessen, children }: { titel: ReactNode; unter?: ReactNode; rechts?: ReactNode; schliessen: () => void; children?: ReactNode }) {
  return (
    <div className="gp-panel-kopf">
      <div className="gp-panel-titel">
        <div><h2>{titel}</h2>{unter && <p className="gp-fein">{unter}</p>}</div>
        <div className="gp-knoepfe">{rechts}<button type="button" className="cg-knopf" onClick={schliessen}>Schließen</button></div>
      </div>
      {children ?? <div style={{ height: 14 }} />}
    </div>
  );
}

// ── Adressfelder mit Vorschlägen beim Tippen ───────────────────────────────
type AdressWerte = { strasse: string; hausnummer: string; adresszusatz: string; plz: string; ort: string; region: string; landCode: string };
function AdressFelder({ wert, setze }: { wert: AdressWerte; setze: (p: Partial<AdressWerte>) => void }) {
  const [suche, setSuche] = useState("");
  const [vorschlaege, setVorschlaege] = useState<AdressVorschlag[]>([]);
  const [offen, setOffen] = useState(false);
  const [markiert, setMarkiert] = useState(-1);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const abbruch = useRef<AbortController | null>(null);

  useEffect(() => {
    const s = suche.trim();
    if (s.length < 4) { setVorschlaege([]); setHinweis(null); return; }
    const t = setTimeout(async () => {
      abbruch.current?.abort();
      const ac = new AbortController(); abbruch.current = ac;
      try {
        const r = await fetch(`${API}/chef/partner-crm/adresse?q=${encodeURIComponent(s)}`, { credentials: "include", signal: ac.signal });
        const j = await r.json().catch(() => null);
        if (ac.signal.aborted) return;
        if (j?.ok) { setVorschlaege(j.vorschlaege ?? []); setHinweis(j.hinweis ?? null); setOffen(true); setMarkiert(-1); }
        else { setVorschlaege([]); setHinweis(j?.error || "Adressvorschläge gerade nicht verfügbar — bitte von Hand eintragen."); }
      } catch (e) {
        if ((e as Error)?.name !== "AbortError") { setVorschlaege([]); setHinweis("Keine Verbindung zum Adressdienst — bitte von Hand eintragen."); }
      }
    }, 400);
    return () => clearTimeout(t);
  }, [suche]);

  const nimm = (v: AdressVorschlag) => {
    setze({ strasse: v.strasse, hausnummer: v.hausnummer, plz: v.plz, ort: v.ort, region: v.region, landCode: v.landCode });
    setSuche(""); setVorschlaege([]); setOffen(false); setHinweis(null);
  };
  const taste = (e: React.KeyboardEvent) => {
    if (!offen || !vorschlaege.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setMarkiert((m) => Math.min(vorschlaege.length - 1, m + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setMarkiert((m) => Math.max(0, m - 1)); }
    else if (e.key === "Enter" && markiert >= 0) { e.preventDefault(); nimm(vorschlaege[markiert]); }
    else if (e.key === "Escape") { e.stopPropagation(); setOffen(false); }
  };
  return (
    <>
      <div className="gp-adresse gp-breit">
        <label>Adresse suchen (Vorschläge beim Tippen)
          <input value={suche} onChange={(e) => setSuche(e.target.value)} onKeyDown={taste} onFocus={() => vorschlaege.length && setOffen(true)}
            onBlur={() => setTimeout(() => setOffen(false), 160)} placeholder="z. B. 100 W Main St Boise oder Hauptstraße 12 Berlin" autoComplete="off" data-fiaon="adresse-suche" />
        </label>
        {offen && vorschlaege.length > 0 && (
          <ul className="gp-vorschlaege" role="listbox">
            {vorschlaege.map((v, i) => (
              <li key={v.zeile}><button type="button" className={i === markiert ? "aktiv" : ""} onMouseDown={(e) => e.preventDefault()} onClick={() => nimm(v)}>{v.zeile}</button></li>
            ))}
            <li className="gp-quelle">Daten © OpenStreetMap-Mitwirkende</li>
          </ul>
        )}
        {hinweis && <p className="gp-fein" style={{ marginTop: 4 }}>{hinweis}</p>}
      </div>
      <label>Straße<input value={wert.strasse} onChange={(e) => setze({ strasse: e.target.value })} /></label>
      <label>Hausnummer<input value={wert.hausnummer} onChange={(e) => setze({ hausnummer: e.target.value })} /></label>
      <label>Zusatz (Suite, c/o …)<input value={wert.adresszusatz} onChange={(e) => setze({ adresszusatz: e.target.value })} /></label>
      <label>PLZ<input value={wert.plz} onChange={(e) => setze({ plz: e.target.value })} /></label>
      <label>Ort<input value={wert.ort} onChange={(e) => setze({ ort: e.target.value })} /></label>
      <label>Bundesland / Staat<input value={wert.region} onChange={(e) => setze({ region: e.target.value })} /></label>
      <label>Land
        <select value={wert.landCode} onChange={(e) => setze({ landCode: e.target.value })}>
          <option value="">—</option>
          {Object.entries(LAND_NAMEN).map(([c, n]) => <option key={c} value={c}>{n}</option>)}
          {wert.landCode && !LAND_NAMEN[wert.landCode] && <option value={wert.landCode}>{wert.landCode}</option>}
        </select>
      </label>
    </>
  );
}

// ── Firmenformular (neu und bearbeiten) ────────────────────────────────────
type FirmaWerte = Record<string, any>;
const FIRMA_LEER: FirmaWerte = {
  name: "", art: "lieferant", status: "gespraech", website: "", email: "", telefon: "", strasse: "", hausnummer: "", adresszusatz: "", plz: "", ort: "", region: "", landCode: "",
  registerNr: "", steuerNr: "", ustId: "", leistung: "", konditionen: [] as Kondition[], tags: "", notizen: "", betreuerAgentId: "", vertraulich: false,
};
function firmaWerteAus(f: Firma): FirmaWerte {
  return { ...f, tags: f.tags.join(", "), betreuerAgentId: f.betreuerAgentId ? String(f.betreuerAgentId) : "" };
}
function FirmaFormular({ w, setze, mitarbeiter }: { w: FirmaWerte; setze: (p: FirmaWerte) => void; mitarbeiter: { id: number; name: string }[] }) {
  const kond: Kondition[] = w.konditionen ?? [];
  return (
    <>
      <div className="gp-feld-block">
        <h3>Partner</h3>
        <div className="gp-raster">
          <label className="gp-breit">Name *<input value={w.name} onChange={(e) => setze({ name: e.target.value })} placeholder="z. B. Muster Registered Agent LLC" data-fiaon="firma-name" /></label>
          <label>Art<select value={w.art} onChange={(e) => setze({ art: e.target.value })}>{PARTNER_ARTEN.map((a) => <option key={a.wert} value={a.wert}>{a.text}</option>)}</select></label>
          <label>Status<select value={w.status} onChange={(e) => setze({ status: e.target.value })}>{PARTNER_STATUS.map((s) => <option key={s.wert} value={s.wert}>{s.text}</option>)}</select></label>
          <label>Zuständig bei uns<select value={w.betreuerAgentId} onChange={(e) => setze({ betreuerAgentId: e.target.value })}><option value="">—</option>{mitarbeiter.map((m) => <option key={m.id} value={String(m.id)}>{m.name}</option>)}</select></label>
          <label>Website<input value={w.website} onChange={(e) => setze({ website: e.target.value })} placeholder="www.beispiel.com" /></label>
          <label>Haupt-E-Mail<input type="email" value={w.email} onChange={(e) => setze({ email: e.target.value })} /></label>
          <label>Telefon<input value={w.telefon} onChange={(e) => setze({ telefon: e.target.value })} /></label>
          <label className="gp-haken gp-breit"><input type="checkbox" checked={!!w.vertraulich} onChange={(e) => setze({ vertraulich: e.target.checked })} /> Vertraulich (Name und Konditionen nie nach außen)</label>
        </div>
      </div>
      <div className="gp-feld-block">
        <h3>Anschrift</h3>
        <div className="gp-raster"><AdressFelder wert={w as AdressWerte} setze={setze} /></div>
      </div>
      <div className="gp-feld-block">
        <h3>Was sie für uns tun · Konditionen</h3>
        <div className="gp-raster">
          <label className="gp-breit">Leistung für FIAON<textarea rows={3} value={w.leistung} onChange={(e) => setze({ leistung: e.target.value })} placeholder="z. B. Registered Agent, Gründungen, EIN" /></label>
        </div>
        {kond.map((k, i) => (
          <div key={i} className="gp-kond-zeile">
            <input value={k.label} placeholder="z. B. Registered Agent" onChange={(e) => setze({ konditionen: kond.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} aria-label="Bezeichnung" />
            <input value={k.value} placeholder="z. B. 65 $ je Firma und Jahr" onChange={(e) => setze({ konditionen: kond.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} aria-label="Wert" />
            <button type="button" className="gp-link gp-leise" onClick={() => setze({ konditionen: kond.filter((_, j) => j !== i) })}>Entfernen</button>
          </div>
        ))}
        <div><button type="button" className="cg-knopf" onClick={() => setze({ konditionen: [...kond, { label: "", value: "" }] })}>Kondition hinzufügen</button></div>
      </div>
      <div className="gp-feld-block">
        <h3>Register · Steuer · Notizen</h3>
        <div className="gp-raster">
          <label>Registernummer<input value={w.registerNr} onChange={(e) => setze({ registerNr: e.target.value })} /></label>
          <label>Steuernummer / EIN<input value={w.steuerNr} onChange={(e) => setze({ steuerNr: e.target.value })} /></label>
          <label>USt-IdNr.<input value={w.ustId} onChange={(e) => setze({ ustId: e.target.value })} /></label>
          <label className="gp-breit">Tags (mit Komma)<input value={w.tags} onChange={(e) => setze({ tags: e.target.value })} placeholder="z. B. usa, gründung, registered agent" /></label>
          <label className="gp-breit">Notizen<textarea rows={4} value={w.notizen} onChange={(e) => setze({ notizen: e.target.value })} /></label>
        </div>
      </div>
    </>
  );
}
const firmaKoerper = (w: FirmaWerte) => ({ ...w, betreuerAgentId: w.betreuerAgentId ? Number(w.betreuerAgentId) : null, konditionen: (w.konditionen ?? []).filter((k: Kondition) => k.label.trim() || k.value.trim()) });

function NeuerPartner({ mitarbeiter, firmen, schliessen, fertig, oeffne }: {
  mitarbeiter: { id: number; name: string }[]; firmen: Karte[]; schliessen: () => void; fertig: (id: number) => void; oeffne: (id: number) => void;
}) {
  const [w, setW] = useState<FirmaWerte>(FIRMA_LEER);
  const [fehler, setFehler] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Mitdenken: Gibt es diesen Partner schon? (Namenskern, Domain der Mail — dieselbe Regel wie „Aus E-Mail übernehmen“.)
  const schonDa = useMemo(() => (String(w.name).trim().length < 3 && !w.email ? [] : firmenTreffer(
    { name: w.name, website: w.website, email: w.email },
    firmen.map((f) => ({ id: f.id, name: f.name, website: null, email: null, kontaktEmails: f.hauptkontakt?.email ? [f.hauptkontakt.email] : [] })),
  )), [w.name, w.website, w.email, firmen]);
  const speichern = async () => {
    setBusy(true); setFehler(null);
    const r = await senden("/chef/partner-crm/firma", firmaKoerper(w));
    setBusy(false);
    if (r.ok) fertig(Number(r.id)); else setFehler(r.error || "Nicht gespeichert.");
  };
  return (
    <>
      <PanelKopf titel="Neuer Partner" unter="Kontakte, Verlauf, Dokumente und Aufgaben kommen danach in der Akte dazu." schliessen={schliessen} />
      <div className="gp-panel-inhalt">
        <FirmaFormular w={w} setze={(p) => setW({ ...w, ...p })} mitarbeiter={mitarbeiter} />
        {schonDa.length > 0 && (
          <p className="gp-fein gp-gelb" role="status">
            Gibt es vielleicht schon: {schonDa.map((t, i) => <span key={t.id}>{i ? " · " : ""}<button type="button" className="gp-link" onClick={() => oeffne(t.id)}>{t.name}</button> ({t.grund})</span>)}
          </p>
        )}
        {fehler && <p className="gp-fein gp-rot" role="alert">{fehler}</p>}
        <div className="gp-form-knoepfe">
          <button type="button" className="cg-knopf cg-knopf-haupt" disabled={busy || w.name.trim().length < 2} onClick={speichern}>Partner anlegen</button>
          <button type="button" className="cg-knopf" onClick={schliessen}>Abbrechen</button>
          {w.name.trim().length < 2 && <span className="gp-fein">Der Name fehlt noch.</span>}
        </div>
      </div>
    </>
  );
}

// ── Kontaktformular ────────────────────────────────────────────────────────
type KontaktWerte = Record<string, any>;
const KONTAKT_LEER: KontaktWerte = { name: "", rolle: "", email: "", telefon: "", durchwahl: "", mobil: "", erreichbarkeit: "", sprache: "", strasse: "", hausnummer: "", adresszusatz: "", plz: "", ort: "", region: "", landCode: "", notizen: "", haupt: false, firmaId: "" };
function KontaktFormular({ w, setze, firmen }: { w: KontaktWerte; setze: (p: KontaktWerte) => void; firmen?: { id: number; name: string }[] }) {
  const [mitAdresse, setMitAdresse] = useState(!!(w.strasse || w.ort));
  return (
    <div className="gp-raster">
      <label>Name *<input value={w.name} onChange={(e) => setze({ name: e.target.value })} data-fiaon="kontakt-name" /></label>
      <label>Rolle<input value={w.rolle} onChange={(e) => setze({ rolle: e.target.value })} placeholder="z. B. Account Manager" /></label>
      {firmen && (
        <label>Partner<select value={w.firmaId} onChange={(e) => setze({ firmaId: e.target.value })}><option value="">— Einzelkontakt —</option>{firmen.map((f) => <option key={f.id} value={String(f.id)}>{f.name}</option>)}</select></label>
      )}
      <label>E-Mail<input type="email" value={w.email} onChange={(e) => setze({ email: e.target.value })} /></label>
      <label>Telefon<input value={w.telefon} onChange={(e) => setze({ telefon: e.target.value })} /></label>
      <label>Durchwahl<input value={w.durchwahl} onChange={(e) => setze({ durchwahl: e.target.value })} inputMode="numeric" /></label>
      <label>Mobil<input value={w.mobil} onChange={(e) => setze({ mobil: e.target.value })} /></label>
      <label>Erreichbar<input value={w.erreichbarkeit} onChange={(e) => setze({ erreichbarkeit: e.target.value })} placeholder="z. B. Mo–Fr 8:30–17:00 PT" /></label>
      <label>Sprache<input value={w.sprache} onChange={(e) => setze({ sprache: e.target.value })} placeholder="de / en" /></label>
      <label className="gp-haken"><input type="checkbox" checked={!!w.haupt} onChange={(e) => setze({ haupt: e.target.checked })} /> Hauptkontakt</label>
      <label className="gp-breit">Notizen<textarea rows={2} value={w.notizen} onChange={(e) => setze({ notizen: e.target.value })} /></label>
      {mitAdresse ? <AdressFelder wert={w as AdressWerte} setze={setze} />
        : <div className="gp-breit"><button type="button" className="gp-link" onClick={() => setMitAdresse(true)}>Eigene Anschrift hinzufügen</button></div>}
    </div>
  );
}
const kontaktKoerper = (w: KontaktWerte) => ({ ...w, firmaId: w.firmaId ? Number(w.firmaId) : null });

function KontaktSchublade({ firmen, firmaId, kontakt, schliessen, fertig }: { firmen: Karte[]; firmaId: number | null; kontakt: Kontakt | null; schliessen: () => void; fertig: (firmaId: number | null) => void }) {
  const [w, setW] = useState<KontaktWerte>(() => kontakt ? { ...kontakt, firmaId: kontakt.firmaId ? String(kontakt.firmaId) : "" } : { ...KONTAKT_LEER, firmaId: firmaId ? String(firmaId) : "" });
  const [fehler, setFehler] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const speichern = async () => {
    setBusy(true); setFehler(null);
    const r = await senden(kontakt ? `/chef/partner-crm/kontakt/${kontakt.id}` : "/chef/partner-crm/kontakt", kontaktKoerper(w));
    setBusy(false);
    if (r.ok) fertig(w.firmaId ? Number(w.firmaId) : null); else setFehler(r.error || "Nicht gespeichert.");
  };
  const entfernen = async () => {
    if (!kontakt || !window.confirm(`Kontakt „${kontakt.name}“ entfernen?`)) return;
    const r = await senden(`/chef/partner-crm/kontakt/${kontakt.id}/entfernen`, {});
    if (r.ok) fertig(null); else setFehler(r.error || "Nicht entfernt.");
  };
  return (
    <>
      <PanelKopf titel={kontakt ? kontakt.name : "Neuer Kontakt"} unter="Mit Partner = steht in dessen Akte. Ohne = Einzelkontakt." schliessen={schliessen} />
      <div className="gp-panel-inhalt">
        <div className="gp-feld-block"><KontaktFormular w={w} setze={(p) => setW({ ...w, ...p })} firmen={firmen} /></div>
        {fehler && <p className="gp-fein gp-rot" role="alert">{fehler}</p>}
        <div className="gp-form-knoepfe">
          <button type="button" className="cg-knopf cg-knopf-haupt" disabled={busy || String(w.name).trim().length < 2} onClick={speichern}>{kontakt ? "Speichern" : "Kontakt anlegen"}</button>
          <button type="button" className="cg-knopf" onClick={schliessen}>Abbrechen</button>
          {kontakt && <button type="button" className="cg-knopf cg-knopf-storno" onClick={entfernen}>Entfernen</button>}
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE AKTE
// ═══════════════════════════════════════════════════════════════════════════
function AkteAnsicht({ id, startTab, liste, schliessen, geaendert, oeffne }: {
  id: number; startTab?: Reiter; liste: Liste; schliessen: () => void; geaendert: () => void; oeffne: (s: Schublade) => void;
}) {
  const [akte, setAkte] = useState<Akte | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [tab, setTab] = useState<Reiter>(startTab ?? "ueberblick");
  const [meldung, setMeldung] = useState<Meldung>(null);
  const [runde, setRunde] = useState(0);

  useEffect(() => {
    let weg = false;
    holen(`/chef/partner-crm/firma/${id}`).then((j) => {
      if (weg) return;
      if (j.ok) { setAkte(j.akte as Akte); setFehler(null); } else setFehler(j.error || "Die Akte ließ sich nicht laden.");
    });
    return () => { weg = true; };
  }, [id, runde]);

  /** Nach jeder Aktion: Meldung, Akte neu, Liste neu — Fehler bleiben stehen (kein Kurzhinweis). */
  const tun = useCallback(async (aufruf: Promise<Antwort>, gutText?: string): Promise<Antwort> => {
    setMeldung(null);
    const r = await aufruf;
    setMeldung(r.ok ? { gut: true, text: gutText ?? r.meldung ?? "Gespeichert." } : { gut: false, text: `Nicht gespeichert: ${r.error || "unbekannter Fehler"}` });
    if (r.ok) { setRunde((x) => x + 1); geaendert(); }
    return r;
  }, [geaendert]);

  if (fehler) return <><PanelKopf titel="Akte" schliessen={schliessen} /><div className="gp-panel-inhalt"><Fehlermeldung text={fehler} erneut={() => setRunde((x) => x + 1)} /></div></>;
  if (!akte) return <><PanelKopf titel="Akte wird geladen …" schliessen={schliessen} /><div className="gp-panel-inhalt"><Geruest zeilen={6} /></div></>;
  const f = akte.firma;
  const offen = akte.aufgaben.filter((a) => !a.erledigtAm).length;
  const tabs: [Reiter, string, number | null][] = [
    ["ueberblick", "Überblick", null], ["kontakte", "Kontakte", akte.kontakte.length], ["verlauf", "Verlauf", akte.verlauf.length],
    ["dokumente", "Dokumente", akte.dokumente.length], ["aufgaben", "Aufgaben", offen],
  ];
  return (
    <>
      <PanelKopf
        titel={f.name}
        unter={<>{textFuer(PARTNER_ARTEN, f.art)} · <StatusMarke status={f.status} />{f.vertraulich ? <> · <span className="gp-tag gp-vertraulich">vertraulich</span></> : null}{f.archiviertAm ? <> · <span className="gp-rot">archiviert am {datum(f.archiviertAm)}</span></> : null}</>}
        rechts={<button type="button" className="cg-knopf" onClick={() => oeffne({ art: "mail", firmaId: f.id })}>Aus E-Mail ergänzen</button>}
        schliessen={schliessen}
      >
        <div className="gp-tabs" role="tablist">
          {tabs.map(([k, t, n]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "aktiv" : ""} onClick={() => setTab(k)}>{t}{n != null ? <span>{n}</span> : null}</button>)}
        </div>
      </PanelKopf>
      <div className="gp-panel-inhalt">
        {meldung && <div className={`cm-meldung ${meldung.gut ? "" : "cg-rot"}`} role="status">{meldung.text}</div>}
        {tab === "ueberblick" && <UeberblickTab akte={akte} liste={liste} tun={tun} zuTab={setTab} />}
        {tab === "kontakte" && <KontakteTab akte={akte} tun={tun} />}
        {tab === "verlauf" && <VerlaufTab akte={akte} tun={tun} />}
        {tab === "dokumente" && <DokumenteTab akte={akte} tun={tun} />}
        {tab === "aufgaben" && <AufgabenTab akte={akte} tun={tun} />}
      </div>
    </>
  );
}
type Tun = (aufruf: Promise<Antwort>, gutText?: string) => Promise<Antwort>;

// ── Überblick ──────────────────────────────────────────────────────────────
function UeberblickTab({ akte, liste, tun, zuTab }: { akte: Akte; liste: Liste; tun: Tun; zuTab: (t: Reiter) => void }) {
  const f = akte.firma;
  const [bearbeiten, setBearbeiten] = useState(false);
  const [w, setW] = useState<FirmaWerte>(() => firmaWerteAus(f));
  const [lage, setLage] = useState<{ text: string | null; hinweis: string | null; laedt: boolean } | null>(null);
  const speichern = async () => {
    const r = await tun(senden(`/chef/partner-crm/firma/${f.id}`, firmaKoerper(w)));
    if (r.ok) setBearbeiten(false);
  };
  const lageHolen = async () => {
    setLage({ text: null, hinweis: null, laedt: true });
    const r = await holen(`/chef/partner-crm/firma/${f.id}/lage`);
    setLage(r.ok ? { text: r.text ?? null, hinweis: r.hinweis ?? null, laedt: false } : { text: null, hinweis: r.error || "Nicht ladbar.", laedt: false });
  };
  const hk = akte.kontakte.find((k) => k.haupt) ?? akte.kontakte[0];

  if (bearbeiten) {
    return (
      <>
        <FirmaFormular w={w} setze={(p) => setW({ ...w, ...p })} mitarbeiter={liste.mitarbeiter} />
        <div className="gp-form-knoepfe">
          <button type="button" className="cg-knopf cg-knopf-haupt" disabled={String(w.name).trim().length < 2} onClick={speichern}>Speichern</button>
          <button type="button" className="cg-knopf" onClick={() => { setW(firmaWerteAus(f)); setBearbeiten(false); }}>Abbrechen</button>
        </div>
      </>
    );
  }
  return (
    <>
      <div className="gp-feld-block" data-fiaon="was-steht-an">
        <div className="gp-feld-kopf">
          <h3>Was steht an?</h3>
          <button type="button" className="cg-knopf" disabled={!liste.ki.bereit || lage?.laedt} onClick={lageHolen}>{lage?.laedt ? "KI denkt …" : "KI-Zusammenfassung"}</button>
        </div>
        {!liste.ki.bereit && <p className="gp-fein">KI aus: {liste.ki.grund} Die Hinweise unten entstehen ohne KI.</p>}
        {lage?.text && <p className="gp-ki-text">{lage.text}</p>}
        {lage?.hinweis && <p className="gp-fein gp-gelb">{lage.hinweis}</p>}
        {akte.hinweise.length
          ? <ul className="gp-hinweise">{akte.hinweise.map((h, i) => <li key={i} className={h.art}>{h.text}</li>)}</ul>
          : <p className="gp-fein">Alles im Lot — nichts überfällig, nichts läuft aus.</p>}
        <div className="gp-form-knoepfe">
          <button type="button" className="gp-link" onClick={() => zuTab("aufgaben")}>Aufgabe anlegen</button>
          <button type="button" className="gp-link" onClick={() => zuTab("verlauf")}>Notiz eintragen</button>
        </div>
      </div>

      <div className="gp-feld-block">
        <div className="gp-feld-kopf"><h3>Stammdaten</h3><button type="button" className="cg-knopf" onClick={() => { setW(firmaWerteAus(f)); setBearbeiten(true); }}>Bearbeiten</button></div>
        <dl className="gp-daten">
          <div><dt>Hauptkontakt</dt><dd>{hk ? <>{hk.name}{hk.rolle ? ` · ${hk.rolle}` : ""}{hk.email ? <><br /><a href={`mailto:${hk.email}`}>{hk.email}</a></> : null}{hk.telefon ? <><br />{telefonZeile(hk.telefon, hk.durchwahl)}</> : null}</> : <button type="button" className="gp-link" onClick={() => zuTab("kontakte")}>Kontakt hinzufügen</button>}</dd></div>
          <div><dt>Haupt-E-Mail</dt><dd>{f.email ? <a href={`mailto:${f.email}`}>{f.email}</a> : "—"}</dd></div>
          <div><dt>Telefon</dt><dd>{f.telefon ? <a href={`tel:${f.telefon.replace(/[^\d+]/g, "")}`}>{f.telefon}</a> : "—"}</dd></div>
          <div><dt>Website</dt><dd>{f.website ? <a href={f.website} target="_blank" rel="noreferrer">{f.website.replace(/^https?:\/\//, "")}</a> : "—"}</dd></div>
          <div><dt>Anschrift</dt><dd>{adressZeile(f) || "—"}</dd></div>
          <div><dt>Zuständig bei uns</dt><dd>{f.betreuer ?? "—"}</dd></div>
          <div><dt>Register · Steuer</dt><dd>{[f.registerNr && `Register ${f.registerNr}`, f.steuerNr && `Steuer ${f.steuerNr}`, f.ustId && `USt-IdNr. ${f.ustId}`].filter(Boolean).join("\n") || "—"}</dd></div>
          <div><dt>Tags</dt><dd>{f.tags.length ? f.tags.join(", ") : "—"}</dd></div>
          <div><dt>Angelegt</dt><dd>{datumZeit(f.erstelltAm)}{f.erstelltVon ? ` von ${f.erstelltVon}` : ""}</dd></div>
        </dl>
        {f.leistung && <dl className="gp-daten"><div><dt>Leistung für FIAON</dt><dd>{f.leistung}</dd></div></dl>}
        {f.notizen && <dl className="gp-daten"><div><dt>Notizen</dt><dd>{f.notizen}</dd></div></dl>}
      </div>

      <div className="gp-feld-block">
        <h3>Konditionen{f.vertraulich ? " · vertraulich" : ""}</h3>
        {f.konditionen.length
          ? <table className="gp-konditionen"><tbody>{f.konditionen.map((k, i) => <tr key={i}><td>{k.label}</td><td>{k.value}</td></tr>)}</tbody></table>
          : <p className="gp-fein">Noch keine Konditionen — unter „Bearbeiten“ eintragen (Preise, Staffeln, Provision, Zahlungsziel, Kündigung).</p>}
      </div>

      {(akte.koop || f.personId) && (
        <div className="gp-feld-block">
          <h3>Verknüpft</h3>
          {akte.koop && <p className="gp-fein">Kooperationsvertrag <b>{akte.koop.ref}</b> · {akte.koop.status === "angenommen" ? `angenommen am ${datum(akte.koop.angenommenAm)}` : akte.koop.status} — Empfehlungen, Provision und Gutschriften stehen unten im Reiter unter „Kooperationsverträge“.</p>}
          {f.personId && <p className="gp-fein">Auch Kunde: <a className="gp-link" href={`/akte/${f.personId}`}>Akte #{f.personId} öffnen</a></p>}
        </div>
      )}

      <div className="gp-form-knoepfe">
        <button type="button" className="cg-knopf cg-knopf-storno" onClick={() => {
          const zurueck = !!f.archiviertAm;
          if (!zurueck && !window.confirm(`„${f.name}“ archivieren? Alles bleibt erhalten und lässt sich zurückholen.`)) return;
          void tun(senden(`/chef/partner-crm/firma/${f.id}/archiv`, { zurueck }));
        }}>{f.archiviertAm ? "Aus dem Archiv zurückholen" : "Archivieren"}</button>
      </div>
    </>
  );
}

// ── Kontakte ───────────────────────────────────────────────────────────────
function KontakteTab({ akte, tun }: { akte: Akte; tun: Tun }) {
  const [offen, setOffen] = useState<number | "neu" | null>(akte.kontakte.length ? null : "neu");
  const [w, setW] = useState<KontaktWerte>(KONTAKT_LEER);
  const auf = (k: Kontakt | null) => { setW(k ? { ...k } : { ...KONTAKT_LEER }); setOffen(k ? k.id : "neu"); };
  const speichern = async () => {
    const r = await tun(senden(offen === "neu" ? "/chef/partner-crm/kontakt" : `/chef/partner-crm/kontakt/${offen}`, { ...w, firmaId: akte.firma.id }));
    if (r.ok) setOffen(null);
  };
  const formular = (
    <div className="gp-feld-block">
      <h3>{offen === "neu" ? "Neuer Kontakt" : "Kontakt bearbeiten"}</h3>
      <KontaktFormular w={w} setze={(p) => setW({ ...w, ...p })} />
      <div className="gp-form-knoepfe">
        <button type="button" className="cg-knopf cg-knopf-haupt" disabled={String(w.name).trim().length < 2} onClick={speichern}>Speichern</button>
        <button type="button" className="cg-knopf" onClick={() => setOffen(null)}>Abbrechen</button>
      </div>
    </div>
  );
  return (
    <>
      {offen === null && <div><button type="button" className="cg-knopf cg-knopf-haupt" onClick={() => auf(null)}>Kontakt hinzufügen</button></div>}
      {offen === "neu" && formular}
      <ul className="gp-liste">
        {akte.kontakte.map((k) => offen === k.id ? <li key={k.id}>{formular}</li> : (
          <li key={k.id} className="gp-eintrag">
            <div className="gp-eintrag-kopf">
              <b>{k.name}{k.rolle ? <span className="gp-fein"> · {k.rolle}</span> : null}{k.haupt ? <span className="gp-tag" style={{ marginLeft: 8 }}>Hauptkontakt</span> : null}</b>
              <div className="gp-aktionen">
                {!k.haupt && <button type="button" className="gp-link" onClick={() => void tun(senden(`/chef/partner-crm/kontakt/${k.id}`, { haupt: true }), `${k.name} ist jetzt Hauptkontakt.`)}>Zum Hauptkontakt</button>}
                <button type="button" className="gp-link" onClick={() => auf(k)}>Bearbeiten</button>
                <button type="button" className="gp-link gp-leise" onClick={() => { if (window.confirm(`Kontakt „${k.name}“ entfernen?`)) void tun(senden(`/chef/partner-crm/kontakt/${k.id}/entfernen`, {})); }}>Entfernen</button>
              </div>
            </div>
            <p>
              {k.email && <><a className="gp-link" href={`mailto:${k.email}`}>{k.email}</a>{" · "}</>}
              {[telefonZeile(k.telefon, k.durchwahl), k.mobil && `mobil ${k.mobil}`, k.erreichbarkeit && `erreichbar ${k.erreichbarkeit}`, k.sprache && `Sprache ${k.sprache}`].filter(Boolean).join(" · ") || (!k.email ? "Kein Kontaktweg hinterlegt" : "")}
            </p>
            {adressZeile(k) && <p className="gp-fein">{adressZeile(k)}</p>}
            {k.notizen && <p className="gp-fein">{k.notizen}</p>}
          </li>
        ))}
      </ul>
    </>
  );
}

// ── Verlauf ────────────────────────────────────────────────────────────────
function VerlaufTab({ akte, tun }: { akte: Akte; tun: Tun }) {
  const [w, setW] = useState({ typ: "notiz", am: heuteIso(), titel: "", text: "", kontaktId: "" });
  const [datei, setDatei] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const dateiFeld = useRef<HTMLInputElement | null>(null);
  const [filter, setFilter] = useState("");
  const eintragen = async () => {
    setBusy(true);
    let dokumentId: number | null = null;
    if (datei) {
      const fd = new FormData();
      fd.append("firmaId", String(akte.firma.id)); fd.append("titel", w.titel || datei.name); fd.append("ohneVerlauf", "1");
      fd.append("art", w.typ === "vertrag" || w.typ === "vereinbarung" || w.typ === "rechnung" ? w.typ : w.typ === "email" ? "korrespondenz" : "sonstiges");
      fd.append("datei", datei);
      const d = await tun(hochladen("/chef/partner-crm/dokument", fd), "Anhang abgelegt.");
      if (!d.ok) { setBusy(false); return; }
      dokumentId = Number(d.id);
    }
    const r = await tun(senden("/chef/partner-crm/verlauf", { ...w, firmaId: akte.firma.id, kontaktId: w.kontaktId ? Number(w.kontaktId) : null, dokumentId }), "Im Verlauf eingetragen.");
    setBusy(false);
    if (r.ok) { setW({ typ: w.typ, am: heuteIso(), titel: "", text: "", kontaktId: "" }); setDatei(null); if (dateiFeld.current) dateiFeld.current.value = ""; }
  };
  const sichtbar = filter ? akte.verlauf.filter((v) => v.typ === filter) : akte.verlauf;
  const kontaktName = (id: number | null) => akte.kontakte.find((k) => k.id === id)?.name;
  return (
    <>
      <div className="gp-feld-block" data-fiaon="verlauf-neu">
        <h3>Eintragen</h3>
        <div className="cg-filter" role="group" aria-label="Art des Eintrags" style={{ margin: 0 }}>
          {VERLAUF_TYPEN.map((t) => <button key={t.wert} type="button" className={w.typ === t.wert ? "aktiv" : ""} onClick={() => setW({ ...w, typ: t.wert })}>{t.text}</button>)}
        </div>
        <div className="gp-raster">
          <label>Datum<input type="date" value={w.am} onChange={(e) => setW({ ...w, am: e.target.value })} /></label>
          <label>Mit wem<select value={w.kontaktId} onChange={(e) => setW({ ...w, kontaktId: e.target.value })}><option value="">—</option>{akte.kontakte.map((k) => <option key={k.id} value={String(k.id)}>{k.name}</option>)}</select></label>
          <label className="gp-breit">Titel<input value={w.titel} onChange={(e) => setW({ ...w, titel: e.target.value })} placeholder="z. B. Call mit dem Partner-Team — sehr gut gelaufen" /></label>
          <label className="gp-breit">Text<textarea rows={3} value={w.text} onChange={(e) => setW({ ...w, text: e.target.value })} placeholder="Was wurde besprochen, vereinbart, geschickt?" /></label>
          <label className="gp-breit">Anhang (PDF, JPG, PNG — freiwillig)<input ref={dateiFeld} type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,application/pdf,image/*" onChange={(e) => setDatei(e.target.files?.[0] ?? null)} /></label>
        </div>
        <div className="gp-form-knoepfe">
          <button type="button" className="cg-knopf cg-knopf-haupt" disabled={busy || (!w.titel.trim() && !w.text.trim())} onClick={eintragen}>Eintragen</button>
          {!w.titel.trim() && !w.text.trim() && <span className="gp-fein">Titel oder Text fehlt noch.</span>}
        </div>
      </div>
      <div className="cg-filter" role="group" aria-label="Verlauf filtern" style={{ margin: 0 }}>
        <button type="button" className={filter === "" ? "aktiv" : ""} onClick={() => setFilter("")}>Alles</button>
        {VERLAUF_TYPEN.filter((t) => akte.verlauf.some((v) => v.typ === t.wert)).map((t) => <button key={t.wert} type="button" className={filter === t.wert ? "aktiv" : ""} onClick={() => setFilter(t.wert)}>{t.text}</button>)}
      </div>
      {sichtbar.length === 0 ? <p className="gp-leer">Noch kein Eintrag.</p> : (
        <ol className="gp-verlauf">
          {sichtbar.map((v) => (
            <li key={v.id} className={`gp-typ-${v.typ}`}>
              <div className="gp-eintrag">
                <div className="gp-eintrag-kopf">
                  <span><span className="gp-typ">{textFuer(VERLAUF_TYPEN, v.typ).toUpperCase()}</span> <b>{v.titel}</b></span>
                  <span className="gp-fein">{datum(v.am)}{v.autor ? ` · ${v.autor}` : ""}{v.kontaktId && kontaktName(v.kontaktId) ? ` · mit ${kontaktName(v.kontaktId)}` : ""}</span>
                </div>
                {v.text && <VerlaufText text={v.text} />}
                <div className="gp-aktionen">
                  {v.dokumentId && <a className="gp-link" href={`${API}/chef/partner-crm/dokument/${v.dokumentId}`} target="_blank" rel="noreferrer">Anhang: {v.dokumentTitel}</a>}
                  <button type="button" className="gp-link gp-leise" onClick={() => { if (window.confirm("Diesen Eintrag entfernen?")) void tun(senden(`/chef/partner-crm/verlauf/${v.id}/entfernen`, {})); }}>Entfernen</button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
/** Lange Texte (übernommene Mails) erst gekürzt — ein Klick zeigt alles. */
function VerlaufText({ text }: { text: string }) {
  const [ganz, setGanz] = useState(false);
  const lang = text.length > 420;
  return <><p>{lang && !ganz ? `${text.slice(0, 400).trimEnd()} …` : text}</p>{lang && <button type="button" className="gp-link" onClick={() => setGanz(!ganz)}>{ganz ? "Weniger" : "Ganzen Text zeigen"}</button>}</>;
}

// ── Dokumente ──────────────────────────────────────────────────────────────
function DokumenteTab({ akte, tun }: { akte: Akte; tun: Tun }) {
  const [w, setW] = useState({ art: "vertrag", titel: "", gueltigAb: "", gueltigBis: "", notiz: "" });
  const [datei, setDatei] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const feld = useRef<HTMLInputElement | null>(null);
  const heute = heuteIso();
  const ablegen = async () => {
    if (!datei) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("firmaId", String(akte.firma.id));
    for (const [k, v] of Object.entries(w)) fd.append(k, v);
    fd.append("datei", datei);
    const r = await tun(hochladen("/chef/partner-crm/dokument", fd));
    setBusy(false);
    if (r.ok) { setW({ art: w.art, titel: "", gueltigAb: "", gueltigBis: "", notiz: "" }); setDatei(null); if (feld.current) feld.current.value = ""; }
  };
  return (
    <>
      <div className="gp-feld-block" data-fiaon="dokument-neu">
        <h3>Dokument ablegen</h3>
        <div className="gp-raster">
          <label className="gp-breit">Datei (PDF, JPG, PNG, HEIC — bis 15 MB)<input ref={feld} type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,application/pdf,image/*" onChange={(e) => { const d = e.target.files?.[0] ?? null; setDatei(d); if (d && !w.titel) setW({ ...w, titel: d.name.replace(/\.[a-z0-9]+$/i, "") }); }} /></label>
          <label>Art<select value={w.art} onChange={(e) => setW({ ...w, art: e.target.value })}>{DOKUMENT_ARTEN.map((a) => <option key={a.wert} value={a.wert}>{a.text}</option>)}</select></label>
          <label>Titel<input value={w.titel} onChange={(e) => setW({ ...w, titel: e.target.value })} /></label>
          <label>Gültig ab<input type="date" value={w.gueltigAb} onChange={(e) => setW({ ...w, gueltigAb: e.target.value })} /></label>
          <label>Gültig bis<input type="date" value={w.gueltigBis} onChange={(e) => setW({ ...w, gueltigBis: e.target.value })} /></label>
          <label className="gp-breit">Notiz<input value={w.notiz} onChange={(e) => setW({ ...w, notiz: e.target.value })} placeholder="z. B. gegengezeichnet, Original im Mailordner" /></label>
        </div>
        <div className="gp-form-knoepfe">
          <button type="button" className="cg-knopf cg-knopf-haupt" disabled={busy || !datei} onClick={ablegen}>{busy ? "Lädt hoch …" : "Ablegen"}</button>
          {!datei && <span className="gp-fein">Erst eine Datei wählen.</span>}
          <span className="gp-fein">Ein Eintrag im Verlauf entsteht von selbst.</span>
        </div>
      </div>
      {akte.dokumente.length === 0 ? <p className="gp-leer">Noch kein Dokument.</p> : (
        <ul className="gp-liste">
          {akte.dokumente.map((d) => {
            const abgelaufen = !!d.gueltigBis && d.gueltigBis < heute;
            return (
              <li key={d.id} className="gp-eintrag">
                <div className="gp-eintrag-kopf">
                  <span><span className="gp-typ">{textFuer(DOKUMENT_ARTEN, d.art).toUpperCase()}</span> <b>{d.titel}</b></span>
                  <span className="gp-fein">{datum(d.erstelltAm)}{d.hochgeladenVon ? ` · ${d.hochgeladenVon}` : ""} · {groesse(d.groesse)}</span>
                </div>
                {(d.gueltigAb || d.gueltigBis) && <p className={abgelaufen ? "gp-rot" : ""}>Gültig {d.gueltigAb ? `ab ${datum(d.gueltigAb)}` : ""}{d.gueltigBis ? ` bis ${datum(d.gueltigBis)}` : ""}{abgelaufen ? " — abgelaufen" : ""}</p>}
                {d.notiz && <p className="gp-fein">{d.notiz}</p>}
                <div className="gp-aktionen">
                  <a className="gp-link" href={`${API}/chef/partner-crm/dokument/${d.id}`} target="_blank" rel="noreferrer">Öffnen</a>
                  <a className="gp-link" href={`${API}/chef/partner-crm/dokument/${d.id}?laden=1`}>Herunterladen</a>
                  <button type="button" className="gp-link gp-leise" onClick={() => { if (window.confirm(`„${d.titel}“ entfernen?`)) void tun(senden(`/chef/partner-crm/dokument/${d.id}/entfernen`, {})); }}>Entfernen</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

// ── Aufgaben ───────────────────────────────────────────────────────────────
function AufgabenTab({ akte, tun }: { akte: Akte; tun: Tun }) {
  const [w, setW] = useState({ titel: "", faelligAm: "", zustaendig: "", notiz: "" });
  const [erledigteZeigen, setErledigteZeigen] = useState(false);
  const heute = heuteIso();
  const offen = akte.aufgaben.filter((a) => !a.erledigtAm);
  const erledigt = akte.aufgaben.filter((a) => a.erledigtAm);
  const anlegen = async () => {
    const r = await tun(senden("/chef/partner-crm/aufgabe", { ...w, firmaId: akte.firma.id }));
    if (r.ok) setW({ titel: "", faelligAm: "", zustaendig: w.zustaendig, notiz: "" });
  };
  const zeile = (a: Aufgabe) => {
    const ueber = !a.erledigtAm && !!a.faelligAm && a.faelligAm < heute;
    return (
      <li key={a.id} className="gp-eintrag">
        <div className={`gp-aufgabe ${a.erledigtAm ? "erledigt" : ""}`}>
          <input type="checkbox" checked={!!a.erledigtAm} aria-label={`${a.titel} erledigt`} onChange={(e) => void tun(senden(`/chef/partner-crm/aufgabe/${a.id}`, { erledigt: e.target.checked }))} />
          <div>
            <b>{a.titel}</b>
            <p className={ueber ? "gp-rot" : "gp-fein"}>
              {a.erledigtAm ? `erledigt am ${datum(a.erledigtAm)}${a.erledigtVon ? ` von ${a.erledigtVon}` : ""}` : a.faelligAm ? `${ueber ? "überfällig seit" : "fällig"} ${datum(a.faelligAm)}` : "ohne Datum"}
              {a.zustaendig ? ` · ${a.zustaendig}` : ""}
            </p>
            {a.notiz && <p className="gp-fein">{a.notiz}</p>}
          </div>
          <button type="button" className="gp-link gp-leise" onClick={() => { if (window.confirm(`Aufgabe „${a.titel}“ entfernen?`)) void tun(senden(`/chef/partner-crm/aufgabe/${a.id}/entfernen`, {})); }}>Entfernen</button>
        </div>
      </li>
    );
  };
  return (
    <>
      <div className="gp-feld-block" data-fiaon="aufgabe-neu">
        <h3>Neue Aufgabe</h3>
        <div className="gp-raster">
          <label className="gp-breit">Was ist zu tun?<input value={w.titel} onChange={(e) => setW({ ...w, titel: e.target.value })} placeholder="z. B. Ersten Testauftrag anlegen" /></label>
          <label>Fällig am<input type="date" value={w.faelligAm} onChange={(e) => setW({ ...w, faelligAm: e.target.value })} /></label>
          <label>Wer<input value={w.zustaendig} onChange={(e) => setW({ ...w, zustaendig: e.target.value })} placeholder="z. B. Justin" /></label>
          <label className="gp-breit">Notiz<input value={w.notiz} onChange={(e) => setW({ ...w, notiz: e.target.value })} /></label>
        </div>
        <div className="gp-form-knoepfe">
          <button type="button" className="cg-knopf cg-knopf-haupt" disabled={w.titel.trim().length < 3} onClick={anlegen}>Aufgabe anlegen</button>
          <span className="gp-fein">Abhaken schreibt „Erledigt: …“ in den Verlauf.</span>
        </div>
      </div>
      {offen.length === 0 ? <p className="gp-leer">Keine offene Aufgabe.</p> : <ul className="gp-liste">{offen.map(zeile)}</ul>}
      {erledigt.length > 0 && (
        <>
          <button type="button" className="gp-link" onClick={() => setErledigteZeigen(!erledigteZeigen)}>{erledigteZeigen ? "Erledigte ausblenden" : `${erledigt.length} erledigte zeigen`}</button>
          {erledigteZeigen && <ul className="gp-liste">{erledigt.map(zeile)}</ul>}
        </>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AUS E-MAIL ÜBERNEHMEN — Vorschau, nichts wird ohne „Übernehmen“ gespeichert
// ═══════════════════════════════════════════════════════════════════════════
type Auswertung = { vorschlag: MailVorschlag; quelle: "ki" | "regeln"; hinweis: string | null; treffer: Treffer[] };
type VKontakt = MailVorschlag["kontakte"][number] & { an: boolean; haupt: boolean };
function MailUebernahme({ ki, firmen, firmaId, schliessen, fertig }: {
  ki: { bereit: boolean; grund: string | null }; firmen: Karte[]; firmaId: number | null; schliessen: () => void; fertig: (id: number) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"lesen" | "speichern" | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [a, setA] = useState<Auswertung | null>(null);
  const [ziel, setZiel] = useState<string>(firmaId ? String(firmaId) : "neu");
  const [firma, setFirma] = useState<FirmaWerte>(FIRMA_LEER);
  const [kontakte, setKontakte] = useState<VKontakt[]>([]);
  const [fakten, setFakten] = useState<(Kondition & { an: boolean })[]>([]);
  const [verlauf, setVerlauf] = useState<{ an: boolean; typ: string; am: string; titel: string; text: string; original: boolean }>({ an: true, typ: "email", am: "", titel: "", text: "", original: true });
  const [aufgabe, setAufgabe] = useState<{ an: boolean; titel: string; faelligAm: string; notiz: string }>({ an: false, titel: "", faelligAm: "", notiz: "" });
  const zielName = useMemo(() => firmen.find((f) => String(f.id) === ziel)?.name ?? a?.treffer.find((t) => String(t.id) === ziel)?.name ?? null, [firmen, ziel, a]);

  const auswerten = async () => {
    setBusy("lesen"); setFehler(null);
    const r = await senden("/chef/partner-crm/ki/mail", { text });
    setBusy(null);
    if (!r.ok) { setFehler(r.error || "Die Mail ließ sich nicht auswerten."); return; }
    const aw = r.auswertung as Auswertung;
    const v = aw.vorschlag;
    setA(aw);
    setFirma({ ...FIRMA_LEER, ...v.firma, status: "gespraech", tags: v.tags.join(", ") });
    setKontakte(v.kontakte.map((k, i) => ({ ...k, an: true, haupt: i === 0 })));
    setFakten(v.fakten.map((k) => ({ ...k, an: true })));
    setVerlauf({ an: !!v.verlauf, typ: v.verlauf?.typ ?? "email", am: v.verlauf?.am || heuteIso(), titel: v.verlauf?.titel ?? "E-Mail übernommen", text: v.verlauf?.text ?? "", original: true });
    setAufgabe(v.aufgabe ? { an: true, titel: v.aufgabe.titel, faelligAm: v.aufgabe.faelligAm, notiz: v.aufgabe.notiz } : { an: false, titel: "", faelligAm: "", notiz: "" });
    // Starker Treffer (gleiche E-Mail oder Domain) → vorgewählt; ein Mensch kann umwählen.
    if (!firmaId) setZiel(aw.treffer[0] && aw.treffer[0].punkte >= 80 ? String(aw.treffer[0].id) : "neu");
  };
  const uebernehmen = async () => {
    setBusy("speichern"); setFehler(null);
    const neu = ziel === "neu";
    const r = await senden("/chef/partner-crm/uebernehmen", {
      firmaId: neu ? null : Number(ziel),
      firma: { ...firmaKoerper(firma), konditionen: [...firmaKoerper(firma).konditionen, ...fakten.filter((k) => k.an).map(({ label, value }) => ({ label, value }))] },
      kontakte: kontakte.filter((k) => k.an && k.name.trim()).map(({ an: _an, ...k }) => k),
      verlauf: verlauf.an ? { typ: verlauf.typ, am: verlauf.am, titel: verlauf.titel, text: verlauf.text } : null,
      aufgabe: aufgabe.an ? { titel: aufgabe.titel, faelligAm: aufgabe.faelligAm, notiz: aufgabe.notiz } : null,
      quelltext: verlauf.an && verlauf.original ? text : "",
    });
    setBusy(null);
    if (r.ok) fertig(Number(r.id)); else setFehler(r.error || "Nicht übernommen.");
  };
  const setzeKontakt = (i: number, p: Partial<VKontakt>) => setKontakte(kontakte.map((k, j) => (j === i ? { ...k, ...p } : p.haupt ? { ...k, haupt: false } : k)));

  return (
    <>
      <PanelKopf titel={firmaId && zielName ? `Aus E-Mail ergänzen · ${zielName}` : "Aus E-Mail übernehmen"}
        unter={ki.bereit ? "Mail oder Signatur einfügen — die KI schlägt alles vor, du prüfst, erst „Übernehmen“ speichert." : `KI aus: ${ki.grund} Regeln werten trotzdem aus (E-Mail, Telefon, Website, Adresse, Signatur).`}
        schliessen={schliessen} />
      <div className="gp-panel-inhalt" data-fiaon="mail-uebernahme">
        <div className="gp-feld-block">
          <label>Mail, Signatur oder Notizen<textarea rows={a ? 4 : 12} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ganze Mail mit Signatur hier einfügen …" data-fiaon="mail-text" /></label>
          <div className="gp-form-knoepfe">
            <button type="button" className="cg-knopf cg-knopf-haupt" disabled={busy !== null || text.trim().length < 20} onClick={auswerten}>{busy === "lesen" ? "Liest …" : a ? "Neu auswerten" : "Auswerten"}</button>
            {text.trim().length < 20 && <span className="gp-fein">Noch zu wenig Text.</span>}
          </div>
        </div>
        {fehler && <p className="gp-fein gp-rot" role="alert">{fehler}</p>}

        {a && (
          <>
            <p className={`gp-fein ${a.quelle === "regeln" ? "gp-gelb" : ""}`}>
              {a.quelle === "ki" ? `Vorschlag der KI — jede E-Mail, Nummer und Website steht wörtlich im Text.${a.hinweis ? ` ${a.hinweis}` : ""}` : (a.hinweis ?? "Vorschlag ohne KI.")}
            </p>
            {a.vorschlag.verworfen.length > 0 && <p className="gp-fein">Nicht übernommen, weil nicht im Text: {a.vorschlag.verworfen.join(" · ")}</p>}

            <div className="gp-feld-block">
              <h3>Wohin?</h3>
              <div className="gp-uebernahme-wahl">
                {!firmaId && (
                  <label className={ziel === "neu" ? "aktiv" : ""}><input type="radio" name="ziel" checked={ziel === "neu"} onChange={() => setZiel("neu")} /> <span><b>Als neuen Partner anlegen</b><br /><span className="gp-fein">{firma.name || "Name noch leer"}</span></span></label>
                )}
                {a.treffer.map((t) => (
                  <label key={t.id} className={ziel === String(t.id) ? "aktiv" : ""}><input type="radio" name="ziel" checked={ziel === String(t.id)} onChange={() => setZiel(String(t.id))} /> <span><b>Zu bestehendem Partner hinzufügen: {t.name}</b><br /><span className="gp-fein">{t.grund}</span></span></label>
                ))}
                {firmaId && !a.treffer.some((t) => t.id === firmaId) && (
                  <label className="aktiv"><input type="radio" name="ziel" checked readOnly /> <span><b>Zu {zielName ?? "diesem Partner"} hinzufügen</b></span></label>
                )}
              </div>
              {ziel !== "neu" && <p className="gp-fein">Beim bestehenden Partner werden nur LEERE Felder ergänzt — nichts wird überschrieben. Kontakte mit gleicher E-Mail werden ergänzt statt doppelt angelegt.</p>}
            </div>

            <FirmaFormular w={firma} setze={(p) => setFirma({ ...firma, ...p })} mitarbeiter={[]} />

            {fakten.length > 0 && (
              <div className="gp-feld-block">
                <h3>Erkannte Konditionen und Abmachungen</h3>
                {fakten.map((k, i) => (
                  <label key={i} className="gp-haken"><input type="checkbox" checked={k.an} onChange={(e) => setFakten(fakten.map((x, j) => (j === i ? { ...x, an: e.target.checked } : x)))} /> <span><b>{k.label}:</b> {k.value}</span></label>
                ))}
              </div>
            )}

            <div className="gp-feld-block">
              <div className="gp-feld-kopf">
                <h3>Kontakte ({kontakte.filter((k) => k.an).length} von {kontakte.length})</h3>
                <button type="button" className="cg-knopf" onClick={() => setKontakte([...kontakte, { name: "", rolle: "", email: "", telefon: "", mobil: "", durchwahl: "", erreichbarkeit: "", sprache: "", notiz: "", an: true, haupt: kontakte.length === 0 }])}>Kontakt hinzufügen</button>
              </div>
              {kontakte.length === 0 && <p className="gp-fein">Kein Mensch erkannt — bei Bedarf von Hand hinzufügen.</p>}
              {kontakte.map((k, i) => (
                <div key={i} className={`gp-auswahl ${k.an ? "" : "aus"}`}>
                  <div className="gp-form-knoepfe">
                    <label className="gp-haken"><input type="checkbox" checked={k.an} onChange={(e) => setzeKontakt(i, { an: e.target.checked })} /> übernehmen</label>
                    <label className="gp-haken"><input type="radio" name="haupt" checked={k.haupt} onChange={() => setzeKontakt(i, { haupt: true })} /> Hauptkontakt</label>
                  </div>
                  <div className="gp-raster">
                    <label>Name<input value={k.name} onChange={(e) => setzeKontakt(i, { name: e.target.value })} /></label>
                    <label>Rolle<input value={k.rolle} onChange={(e) => setzeKontakt(i, { rolle: e.target.value })} /></label>
                    <label>E-Mail<input value={k.email} onChange={(e) => setzeKontakt(i, { email: e.target.value })} /></label>
                    <label>Telefon<input value={k.telefon} onChange={(e) => setzeKontakt(i, { telefon: e.target.value })} /></label>
                    <label>Durchwahl<input value={k.durchwahl} onChange={(e) => setzeKontakt(i, { durchwahl: e.target.value })} /></label>
                    <label>Mobil<input value={k.mobil} onChange={(e) => setzeKontakt(i, { mobil: e.target.value })} /></label>
                    <label>Erreichbar<input value={k.erreichbarkeit} onChange={(e) => setzeKontakt(i, { erreichbarkeit: e.target.value })} /></label>
                    <label>Sprache<input value={k.sprache} onChange={(e) => setzeKontakt(i, { sprache: e.target.value })} /></label>
                  </div>
                </div>
              ))}
            </div>

            <div className="gp-feld-block">
              <label className="gp-haken"><input type="checkbox" checked={verlauf.an} onChange={(e) => setVerlauf({ ...verlauf, an: e.target.checked })} /> <b>Als Eintrag in den Verlauf</b></label>
              {verlauf.an && (
                <div className="gp-raster">
                  <label>Art<select value={verlauf.typ} onChange={(e) => setVerlauf({ ...verlauf, typ: e.target.value })}>{VERLAUF_TYPEN.map((t) => <option key={t.wert} value={t.wert}>{t.text}</option>)}</select></label>
                  <label>Datum<input type="date" value={verlauf.am} onChange={(e) => setVerlauf({ ...verlauf, am: e.target.value })} /></label>
                  <label className="gp-breit">Titel<input value={verlauf.titel} onChange={(e) => setVerlauf({ ...verlauf, titel: e.target.value })} /></label>
                  <label className="gp-breit">Kurzfassung<textarea rows={2} value={verlauf.text} onChange={(e) => setVerlauf({ ...verlauf, text: e.target.value })} /></label>
                  <label className="gp-haken gp-breit"><input type="checkbox" checked={verlauf.original} onChange={(e) => setVerlauf({ ...verlauf, original: e.target.checked })} /> Originaltext der Mail anhängen</label>
                </div>
              )}
            </div>

            <div className="gp-feld-block">
              <label className="gp-haken"><input type="checkbox" checked={aufgabe.an} onChange={(e) => setAufgabe({ ...aufgabe, an: e.target.checked })} /> <b>Aufgabe anlegen</b>{a.vorschlag.aufgabe ? <span className="gp-fein"> (die Mail verlangt einen nächsten Schritt)</span> : null}</label>
              {aufgabe.an && (
                <div className="gp-raster">
                  <label className="gp-breit">Was ist zu tun?<input value={aufgabe.titel} onChange={(e) => setAufgabe({ ...aufgabe, titel: e.target.value })} /></label>
                  <label>Fällig am<input type="date" value={aufgabe.faelligAm} onChange={(e) => setAufgabe({ ...aufgabe, faelligAm: e.target.value })} /></label>
                </div>
              )}
            </div>

            <div className="gp-form-knoepfe">
              <button type="button" className="cg-knopf cg-knopf-haupt" disabled={busy !== null || (ziel === "neu" && String(firma.name).trim().length < 2)} onClick={uebernehmen} data-fiaon="uebernehmen">
                {busy === "speichern" ? "Speichert …" : ziel === "neu" ? "Übernehmen und Partner anlegen" : `Übernehmen zu ${zielName ?? "Partner"}`}
              </button>
              <button type="button" className="cg-knopf" onClick={schliessen}>Verwerfen</button>
              {ziel === "neu" && String(firma.name).trim().length < 2 && <span className="gp-fein">Name des Partners fehlt noch.</span>}
            </div>
          </>
        )}
      </div>
    </>
  );
}
