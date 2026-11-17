// ═══════════════════════════════════════════════════════════════════════════
// /business/gruendung/:bt  und  /business/gruendung/:bt/m/:mt — DER GRÜNDUNGSBOGEN (E-526, 17.11.2026)
//
// Mehrere Gesellschafter gründen gemeinsam eine US-LLC. Jeder macht seine Angaben selbst und unterschreibt
// selbst, getrennt von den anderen:
//   · die GEMEINSAME Seite (:bt): Kopf, „So geht es“, Kosten, wer wie weit ist, je Mitglied der Knopf
//     „Ich bin … — persönlichen Zugang anfordern“ (der Link geht nur an die hinterlegte Adresse);
//   · die PERSÖNLICHE Seite (:bt/m/:mt): Gesellschaft · Ihre Angaben · Bestätigen und unterschreiben.
// Regeln und Wortlaut: shared/fiaon-global-gruendungsbogen.ts — dieselben Prüfungen wie der Server.
// Die Seite misst nichts (OHNE_MESSUNG) und ist für Suchmaschinen gesperrt (noindex, Kopfzeile vom Server).
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRoute } from "wouter";
import { Dunkel } from "@/components/site/DunkleBuehne";
import SignaturePad from "@/components/agent/SignaturPad";
import {
  GB_TEXTE, GB_UNTERSCHRIFT_TEXT, GB_REISEPASS_MAX_BYTES, GB_RECHTSFORM, anteileSumme, anteilText, gbStaatenZurWahl, gbStaatName,
  gesellschaftFehler, gesellschaftNormalisieren, gesellschaftPruefen, angabenFehler, angabenPruefen, angabenNormalisieren, aufzaehlung,
  namenGleich, nameLautPass, angabenLeer, gesellschaftLeer,
  type GbAngaben, type GbGesellschaft, type GbStatus, type GbUnterschriftStatus, type GbFehler, type GbBestaetigungSchluessel,
} from "@shared/fiaon-global-gruendungsbogen";
import "@/styles/global-gruendungsbogen.css";

const T = GB_TEXTE;
const API = "/api/fiaon/global/gruendung";

type Feldfehler = { feld: string | null; text: string } | null;

function Haken() {
  return <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M5 10.4l3.1 3.1L15 6.6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
const amText = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d).replace(",", " um") + " Uhr";
};
const tagText = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : iso);

async function holen(url: string, init?: RequestInit): Promise<{ status: number; j: any }> {
  const r = await fetch(url, { credentials: "omit", ...init });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, j };
}

function Marke({ status, am }: { status: GbUnterschriftStatus; am?: string | null }) {
  const klasse = status === "unterschrieben" ? "gut" : status === "neu_noetig" ? "neu" : "";
  return <span className={`gbb-marke ${klasse}`}>{status === "unterschrieben" && am ? `Unterschrieben am ${amText(am).replace(/ um .*/, "")}` : GB_UNTERSCHRIFT_TEXT[status]}</span>;
}

// ═══ DIE GEMEINSAME SEITE ═════════════════════════════════════════════════════
interface GemeinsamSicht {
  ok: true; kennung: string; status: GbStatus; statusText: string; gruss: string; kostenHinweis: string; rechtsform: string;
  wunschname: string; bundesstaat: { schluessel: string; name: string }; danach: string;
  mitglieder: { id: number; anzeigename: string; angaben: "offen" | "vollstaendig"; unterschrift: GbUnterschriftStatus; unterschriebenAm: string | null }[];
}

function Gemeinsam({ bt }: { bt: string }) {
  const [sicht, setSicht] = useState<GemeinsamSicht | null>(null);
  const [ladeFehler, setLadeFehler] = useState("");
  const [sendet, setSendet] = useState<number | null>(null);
  const [gesendet, setGesendet] = useState<Record<number, string>>({});
  const [fehlerJe, setFehlerJe] = useState<Record<number, string>>({});

  useEffect(() => {
    void (async () => {
      try {
        const { status, j } = await holen(`${API}/${encodeURIComponent(bt)}`);
        if (status !== 200 || !j.ok) { setLadeFehler(String(j.error || T.fehler.link)); return; }
        setSicht(j as GemeinsamSicht);
      } catch { setLadeFehler("Keine Verbindung. Bitte prüfen Sie Ihre Internetverbindung und laden Sie die Seite neu."); }
    })();
  }, [bt]);

  const anfordern = async (id: number) => {
    setSendet(id); setFehlerJe((f) => ({ ...f, [id]: "" }));
    try {
      const { status, j } = await holen(`${API}/${encodeURIComponent(bt)}/zugang`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mitgliedId: id }) });
      if (status !== 200 || !j.ok) { setFehlerJe((f) => ({ ...f, [id]: String(j.error || T.fehler.server) })); return; }
      setGesendet((g) => ({ ...g, [id]: T.gemeinsam.gesendet(String(j.an || "")) }));
    } catch { setFehlerJe((f) => ({ ...f, [id]: "Keine Verbindung. Bitte versuchen Sie es noch einmal." })); }
    finally { setSendet(null); }
  };

  return (
    <main className="gbb" data-fiaon="gruendungsbogen-gemeinsam">
      <div className="gbb-licht" aria-hidden="true" />
      <section className="gbb-kopf">
        <p className="gbb-auge">{T.gemeinsam.auge}{sicht ? ` · ${sicht.kennung}` : ""}</p>
        <h1>{sicht ? sicht.wunschname : "Gründung Ihrer US-Gesellschaft"}<em>{sicht ? `${sicht.bundesstaat.name} · ${T.gemeinsam.titelZusatz}` : T.gemeinsam.titelZusatz}</em></h1>
        {sicht && <p className="gbb-gruss">{`${sicht.gruss.replace(/[\s,.!]+$/, "")}, ${T.gemeinsam.einleitung}`}</p>}
      </section>

      {!sicht && !ladeFehler && <p className="gbb-laedt">Einen Moment …</p>}
      {ladeFehler && <div className="gbb-hinweis fehler" role="alert">{ladeFehler}</div>}

      {sicht && (
        <>
          {sicht.status === "vollstaendig" && <div className="gbb-hinweis gut" role="status">{T.gemeinsam.vollstaendig}</div>}
          {sicht.status === "geschlossen" && <div className="gbb-hinweis" role="status">{T.gemeinsam.geschlossen}</div>}

          <section className="gbb-blatt" aria-labelledby="gbb-so">
            <h2 id="gbb-so">{T.gemeinsam.soGehtEs}</h2>
            <ol className="gbb-schritte">
              {T.gemeinsam.schritte.map((s, i) => (
                <li key={s.titel}><span className="gbb-nr" aria-hidden="true">{i + 1}</span><b>{s.titel}</b><p>{s.text}</p></li>
              ))}
            </ol>
            <p className="gbb-danach">{sicht.danach}</p>
          </section>

          <section className="gbb-blatt" aria-labelledby="gbb-kosten">
            <h2 id="gbb-kosten">{T.gemeinsam.kosten}</h2>
            <p className="gbb-lead">{sicht.kostenHinweis}</p>
          </section>

          <section className="gbb-blatt" aria-labelledby="gbb-status" data-fiaon="gruendungsbogen-status">
            <h2 id="gbb-status">{T.gemeinsam.status}</h2>
            <ul className="gbb-leute">
              {sicht.mitglieder.map((m) => (
                <li key={m.id} className="gbb-person">
                  <div className="gbb-person-kopf">
                    <span className="gbb-person-name">{m.anzeigename}</span>
                    <span className="gbb-marken">
                      <span className={`gbb-marke ${m.angaben === "vollstaendig" ? "gut" : ""}`}>{m.angaben === "vollstaendig" ? T.gemeinsam.angabenFertig : T.gemeinsam.angabenOffen}</span>
                      <Marke status={m.unterschrift} am={m.unterschriebenAm} />
                    </span>
                  </div>
                  {sicht.status !== "geschlossen" && (
                    <div>
                      <button type="button" className="gbb-knopf still" onClick={() => void anfordern(m.id)} disabled={sendet !== null} data-fiaon="gruendungsbogen-zugang">
                        {sendet === m.id ? "Wird gesendet …" : T.gemeinsam.knopf(m.anzeigename)}
                      </button>
                      {gesendet[m.id] && <p className="gbb-gesendet" role="status">{gesendet[m.id]}</p>}
                      {fehlerJe[m.id] && <p className="gbb-fehler" role="alert">{fehlerJe[m.id]}</p>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <p className="gbb-klein">{T.gemeinsam.hinweisZugang}</p>
          </section>
        </>
      )}
    </main>
  );
}

// ═══ DIE PERSÖNLICHE SEITE ════════════════════════════════════════════════════
interface MitgliedKurz { id: number; anzeigename: string; reihenfolge: number; ich: boolean; angabenVollstaendig: boolean; unterschrift: GbUnterschriftStatus; unterschriebenAm: string | null }
interface PersoenlichSicht {
  ok: true; kennung: string; status: GbStatus; statusText: string; gruss: string; kostenHinweis: string; rechtsform: string; fassung: number;
  gesellschaft: GbGesellschaft; geaendert: { am: string; von: string } | null; danach: string; mitglieder: MitgliedKurz[];
  ich: {
    id: number; anzeigename: string; email: string; angaben: GbAngaben; usSteuernummerMaskiert: string;
    reisepass: { name: string; typ: string; am: string } | null;
    unterschrift: { am: string; amText: string; name: string; ort: string; fassung: number; hash: string } | null;
    status: GbUnterschriftStatus; ueberholtAnzahl: number; hatPdf: boolean;
  };
  bestaetigungen: { schluessel: GbBestaetigungSchluessel; titel: string; text: string; link: { text: string; href: string } | null }[];
  pflichtFehlt: GbFehler[]; heute: string; gemeinsam: string | null;
}

const LAENDER = ["Deutschland", "Österreich", "Schweiz", "Liechtenstein", "Luxemburg", "Niederlande", "Belgien", "Frankreich", "Italien", "Spanien", "Polen", "Vereinigte Staaten"];
const STAATSANGEHOERIGKEITEN = ["deutsch", "österreichisch", "schweizerisch", "liechtensteinisch", "luxemburgisch", "niederländisch", "italienisch", "polnisch"];

function Persoenlich({ bt, mt }: { bt: string; mt: string }) {
  const api = `${API}/${encodeURIComponent(bt)}/m/${encodeURIComponent(mt)}`;
  const [sicht, setSicht] = useState<PersoenlichSicht | null>(null);
  const [ladeFehler, setLadeFehler] = useState<{ text: string; gemeinsam: string | null } | null>(null);
  const [abschnitt, setAbschnitt] = useState(0);
  const [g, setG] = useState<GbGesellschaft>(gesellschaftLeer());
  const [a, setA] = useState<GbAngaben>(angabenLeer());
  const [usNeu, setUsNeu] = useState("");
  const [gDirty, setGDirty] = useState(false);
  const [aDirty, setADirty] = useState(false);
  const [fehler, setFehler] = useState<Feldfehler>(null);
  const [meldung, setMeldung] = useState("");
  const [speichert, setSpeichert] = useState(false);
  const [warnung, setWarnung] = useState(false);
  const [laedtHoch, setLaedtHoch] = useState(false);
  const [best, setBest] = useState<Record<string, boolean>>({});
  const [ort, setOrt] = useState("");
  const [name, setName] = useState("");
  const [png, setPng] = useState<string | null>(null);
  const [padRunde, setPadRunde] = useState(0);
  const [sendet, setSendet] = useState(false);
  const dirtyRef = useRef({ g: false, a: false });
  dirtyRef.current = { g: gDirty, a: aDirty };
  const oben = useRef<HTMLDivElement>(null);

  /** Lädt neu. `g`/`a` = diesen Entwurf auf jeden Fall ersetzen (nach dem Speichern); sonst nur, wenn er nichts Ungespeichertes trägt. */
  const laden = useCallback(async (opts: { g?: boolean; a?: boolean } = {}) => {
    try {
      const { status, j } = await holen(api);
      if (status !== 200 || !j.ok) { setLadeFehler({ text: String(j.error || T.fehler.link), gemeinsam: j.gemeinsam ?? null }); return; }
      const s = j as PersoenlichSicht;
      setSicht(s);
      // Nur Entwürfe ohne ungespeicherte Änderungen werden ersetzt.
      if (opts.g || !dirtyRef.current.g) { setG(s.gesellschaft); setGDirty(false); }
      if (opts.a || !dirtyRef.current.a) { setA(s.ich.angaben); setUsNeu(""); setADirty(false); }
    } catch { setLadeFehler({ text: "Keine Verbindung. Bitte prüfen Sie Ihre Internetverbindung und laden Sie die Seite neu.", gemeinsam: null }); }
  }, [api]);
  useEffect(() => { void laden({ g: true, a: true }); }, [laden]);

  const ids = useMemo(() => (sicht ? sicht.mitglieder.map((m) => m.id) : []), [sicht]);
  const offen = sicht?.status === "offen";
  const gFehltLokal = useMemo(() => (sicht ? gesellschaftFehler(gesellschaftNormalisieren(g, ids), ids, "unterschrift") : []), [g, ids, sicht]);
  const aFehltLokal = useMemo(() => (sicht ? angabenFehler(angabenNormalisieren({ ...a, usSteuernummer: usNeu || (sicht.ich.usSteuernummerMaskiert ? "000000000" : "") }), { heute: sicht.heute, stufe: "unterschrift", reisepass: !!sicht.ich.reisepass }) : []), [a, usNeu, sicht]);
  const anderenUnterschrieben = useMemo(() => (sicht ? sicht.mitglieder.filter((m) => !m.ich && m.unterschrift === "unterschrieben").map((m) => m.anzeigename) : []), [sicht]);
  const selbstUnterschrieben = sicht?.ich.status === "unterschrieben";

  const zeige = (f: Feldfehler) => {
    setFehler(f);
    if (f?.feld) {
      const ziel = f.feld.startsWith("gesellschaft") ? 0 : f.feld.startsWith("angaben") || f.feld === "reisepass" ? 1 : 2;
      setAbschnitt(ziel);
      window.setTimeout(() => document.querySelector(`[data-feld="${f.feld}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
    }
  };
  const F = (feld: string) => (fehler?.feld === feld || (fehler?.feld && feld !== "gesellschaft.anteile" && fehler.feld.startsWith(`${feld}.`)) ? <p className="gbb-fehler" role="alert">{fehler.text}</p> : null);
  const falsch = (feld: string) => (fehler?.feld === feld ? " falsch" : "");
  const gehe = (i: number) => { setAbschnitt(i); setMeldung(""); window.setTimeout(() => oben.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 30); };

  const gAendern = <K extends keyof GbGesellschaft>(k: K, v: GbGesellschaft[K]) => { setG((x) => ({ ...x, [k]: v })); setGDirty(true); setMeldung(""); };
  const aAendern = <K extends keyof GbAngaben>(k: K, v: GbAngaben[K]) => { setA((x) => ({ ...x, [k]: v })); setADirty(true); setMeldung(""); };

  const gesellschaftSpeichern = async (bestaetigt = false) => {
    if (!sicht) return;
    const p = gesellschaftPruefen(g, ids, "speichern");
    if (!p.ok) { zeige({ feld: p.feld, text: p.error }); return; }
    if (!bestaetigt && (anderenUnterschrieben.length > 0 || selbstUnterschrieben)) { setWarnung(true); return; }
    setWarnung(false); setFehler(null); setSpeichert(true);
    try {
      const { status, j } = await holen(`${api}/gesellschaft`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gesellschaft: p.daten, fassung: sicht.fassung }) });
      if (status !== 200 || !j.ok) { zeige({ feld: j.feld ?? null, text: String(j.error || T.fehler.server) }); return; }
      setGDirty(false);
      setMeldung(j.ueberholt?.length ? T.persoenlich.neuUnterschreibenNoetig(aufzaehlung(j.ueberholt)) : T.persoenlich.gespeichert);
      await laden({ g: true });
    } catch { zeige({ feld: null, text: "Keine Verbindung. Es wurde nichts gespeichert — bitte versuchen Sie es noch einmal." }); }
    finally { setSpeichert(false); }
  };

  const angabenSpeichern = async (): Promise<boolean> => {
    if (!sicht) return false;
    const roh = { ...a, usSteuernummer: a.usSteuernummerVorhanden === true ? usNeu : "" };
    const p = angabenPruefen(roh, sicht.heute);
    if (!p.ok) { zeige({ feld: p.feld, text: p.error }); return false; }
    setFehler(null); setSpeichert(true);
    try {
      const { status, j } = await holen(`${api}/angaben`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ angaben: p.daten }) });
      if (status !== 200 || !j.ok) { zeige({ feld: j.feld ?? null, text: String(j.error || T.fehler.server) }); return false; }
      setMeldung(j.ueberholtSelbst ? `${T.persoenlich.gespeichert} ${T.persoenlich.warnungSelbst}` : T.persoenlich.gespeichert);
      await laden({ a: true });
      return true;
    } catch { zeige({ feld: null, text: "Keine Verbindung. Es wurde nichts gespeichert — bitte versuchen Sie es noch einmal." }); return false; }
    finally { setSpeichert(false); }
  };

  const reisepassHochladen = async (datei: File | null | undefined) => {
    if (!datei) return;
    if (datei.size > GB_REISEPASS_MAX_BYTES || !/^(application\/pdf|image\/jpeg|image\/png)$/.test(datei.type || "")) { zeige({ feld: "reisepass", text: T.fehler.datei }); return; }
    setLaedtHoch(true); setFehler(null);
    try {
      const fd = new FormData(); fd.append("datei", datei);
      const { status, j } = await holen(`${api}/reisepass`, { method: "POST", body: fd });
      if (status !== 200 || !j.ok) { zeige({ feld: "reisepass", text: String(j.error || T.fehler.datei) }); return; }
      setMeldung(j.ueberholtSelbst ? `${T.persoenlich.gespeichert} ${T.persoenlich.warnungSelbst}` : T.persoenlich.gespeichert);
      await laden({});
    } catch { zeige({ feld: "reisepass", text: "Keine Verbindung. Bitte versuchen Sie es noch einmal." }); }
    finally { setLaedtHoch(false); }
  };

  const unterschreiben = async () => {
    if (!sicht) return;
    const soll = nameLautPass(sicht.ich.angaben);
    const fehlt = sicht.bestaetigungen.find((b) => !best[b.schluessel]);
    if (fehlt) { zeige({ feld: `bestaetigungen.${fehlt.schluessel}`, text: `Bitte bestätigen Sie: ${fehlt.titel}.` }); return; }
    if (ort.trim().length < 2) { zeige({ feld: "ort", text: "Bitte geben Sie den Ort an, an dem Sie unterschreiben." }); return; }
    if (!namenGleich(name, soll)) { zeige({ feld: "name", text: T.persoenlich.nameFalsch(soll) }); return; }
    if (!png) { zeige({ feld: "unterschriftPng", text: T.fehler.unterschrift }); return; }
    setSendet(true); setFehler(null);
    try {
      const { status, j } = await holen(`${api}/unterschreiben`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fassung: sicht.fassung, bestaetigungen: best, ort, name, unterschriftPng: png }),
      });
      if (status !== 200 || !j.ok) { zeige({ feld: j.feld ?? null, text: String(j.error || T.fehler.server) }); return; }
      setBest({}); setOrt(""); setName(""); setPng(null); setPadRunde((r) => r + 1);
      await laden({ g: true, a: true });
      window.setTimeout(() => oben.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
    } catch { zeige({ feld: null, text: "Keine Verbindung. Es wurde nichts unterschrieben — bitte versuchen Sie es noch einmal." }); }
    finally { setSendet(false); }
  };

  if (ladeFehler) {
    return (
      <main className="gbb">
        <section className="gbb-kopf"><p className="gbb-auge">{T.persoenlich.auge}</p><h1>{T.persoenlich.titel}</h1></section>
        <div className="gbb-hinweis fehler" role="alert">{ladeFehler.text}</div>
        {ladeFehler.gemeinsam && <div className="gbb-leiste"><a className="gbb-knopf" href={ladeFehler.gemeinsam}>Zur gemeinsamen Seite</a></div>}
      </main>
    );
  }
  if (!sicht) return <main className="gbb"><p className="gbb-laedt">Einen Moment …</p></main>;

  const gFertig = gFehltLokal.length === 0 && !gDirty;
  const aFertig = aFehltLokal.length === 0 && !aDirty;
  const staaten = gbStaatenZurWahl();
  const summe = anteileSumme(g.anteile, ids);
  const nameVon = (id: number | null) => sicht.mitglieder.find((m) => m.id === id)?.anzeigename ?? "—";
  const ich = sicht.ich;

  return (
    <main className="gbb" data-fiaon="gruendungsbogen-persoenlich">
      <div className="gbb-licht" aria-hidden="true" />
      <section className="gbb-kopf">
        <p className="gbb-auge">{T.persoenlich.auge} · {sicht.kennung}</p>
        <h1>{T.persoenlich.titel}<em>{sicht.gesellschaft.wunschname1 ? `${sicht.gesellschaft.wunschname1} ${GB_RECHTSFORM}` : GB_RECHTSFORM} · {gbStaatName(sicht.gesellschaft.bundesstaat)}</em></h1>
        <p className="gbb-gruss">{T.persoenlich.hallo(ich.anzeigename)}</p>
      </section>

      {sicht.status !== "offen" && <div className="gbb-hinweis" role="status">{sicht.status === "vollstaendig" ? T.gemeinsam.vollstaendig : T.gemeinsam.geschlossen}</div>}
      {ich.status === "neu_noetig" && offen && <div className="gbb-hinweis warn" role="status">Die Angaben haben sich nach Ihrer Unterschrift geändert. Bitte prüfen Sie sie und unterschreiben Sie neu.</div>}

      <div ref={oben} />
      <nav className="gbb-schiene" aria-label="Abschnitte">
        {T.persoenlich.abschnitte.map((t, i) => {
          const fertig = i === 0 ? gFertig : i === 1 ? aFertig : ich.status === "unterschrieben";
          return (
            <button key={t} type="button" aria-current={abschnitt === i ? "step" : undefined} className={fertig ? "fertig" : ""} onClick={() => gehe(i)} data-fiaon={`gruendungsbogen-abschnitt-${i + 1}`}>
              <span className="gbb-punkt" aria-hidden="true">{fertig ? <Haken /> : i + 1}</span>
              <span>{t}{fertig ? <span className="gbb-nur-leser"> (fertig)</span> : null}</span>
            </button>
          );
        })}
      </nav>

      {meldung && <div className="gbb-hinweis gut" role="status">{meldung}</div>}
      {fehler && !fehler.feld && <div className="gbb-hinweis fehler" role="alert">{fehler.text}</div>}

      {/* ── 1 · GESELLSCHAFT ───────────────────────────────────────────── */}
      {abschnitt === 0 && (
        <section className="gbb-blatt" aria-labelledby="gbb-a1">
          <h2 id="gbb-a1">Die Gesellschaft</h2>
          <p className="gbb-lead">{T.persoenlich.gesellschaftLead}</p>
          {sicht.geaendert && <p className="gbb-klein">Zuletzt geändert von {sicht.geaendert.von} am {amText(sicht.geaendert.am)} (Fassung {sicht.fassung}).</p>}

          <div className="gbb-gruppe">
            <h3>Name</h3>
            <div className="gbb-raster">
              <label className={`gbb-feld breit${falsch("gesellschaft.wunschname1")}`} data-feld="gesellschaft.wunschname1">Wunschname
                <span className="gbb-zusatz"><input value={g.wunschname1} onChange={(e) => gAendern("wunschname1", e.target.value)} disabled={!offen} autoComplete="off" maxLength={80} /><span>{GB_RECHTSFORM}</span></span>
                {F("gesellschaft.wunschname1")}
              </label>
              <label className={`gbb-feld${falsch("gesellschaft.wunschname2")}`} data-feld="gesellschaft.wunschname2">Ausweichname 1
                <span className="gbb-zusatz"><input value={g.wunschname2} onChange={(e) => gAendern("wunschname2", e.target.value)} disabled={!offen} autoComplete="off" maxLength={80} /><span>{GB_RECHTSFORM}</span></span>
                {F("gesellschaft.wunschname2")}
              </label>
              <label className={`gbb-feld${falsch("gesellschaft.wunschname3")}`} data-feld="gesellschaft.wunschname3">Ausweichname 2
                <span className="gbb-zusatz"><input value={g.wunschname3} onChange={(e) => gAendern("wunschname3", e.target.value)} disabled={!offen} autoComplete="off" maxLength={80} /><span>{GB_RECHTSFORM}</span></span>
                {F("gesellschaft.wunschname3")}
              </label>
            </div>
            <p className="gbb-klein">{T.persoenlich.zusatzLlc} Ist der Wunschname im Bundesstaat schon vergeben, nehmen wir den ersten freien Ausweichnamen.</p>
          </div>

          <div className="gbb-gruppe" data-feld="gesellschaft.bundesstaat">
            <h3>Bundesstaat</h3>
            <div className="gbb-wahl drei" role="radiogroup" aria-label="Bundesstaat">
              {staaten.map((s) => (
                <button key={s.schluessel} type="button" role="radio" aria-checked={g.bundesstaat === s.schluessel} className={`gbb-option${g.bundesstaat === s.schluessel ? " an" : ""}`} onClick={() => gAendern("bundesstaat", s.schluessel)} disabled={!offen}>
                  <b>{s.name}</b><span>{s.satz}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="gbb-gruppe">
            <label className={`gbb-feld breit${falsch("gesellschaft.gegenstand")}`} data-feld="gesellschaft.gegenstand">Unternehmensgegenstand <small>womit sich die Gesellschaft beschäftigt, in einem oder zwei Sätzen</small>
              <textarea value={g.gegenstand} onChange={(e) => gAendern("gegenstand", e.target.value)} disabled={!offen} maxLength={600} />
              {F("gesellschaft.gegenstand")}
            </label>
          </div>

          <div className="gbb-gruppe" data-feld="gesellschaft.manager">
            <h3>Führung</h3>
            <div className="gbb-wahl zwei" role="radiogroup" aria-label="Führung">
              <button type="button" role="radio" aria-checked={g.fuehrung === "member"} className={`gbb-option${g.fuehrung === "member" ? " an" : ""}`} onClick={() => gAendern("fuehrung", "member")} disabled={!offen}>
                <b>{T.persoenlich.fuehrungMember}</b><span>Alle Gesellschafter führen die Gesellschaft gemeinsam.</span>
              </button>
              <button type="button" role="radio" aria-checked={g.fuehrung === "manager"} className={`gbb-option${g.fuehrung === "manager" ? " an" : ""}`} onClick={() => gAendern("fuehrung", "manager")} disabled={!offen}>
                <b>{T.persoenlich.fuehrungManager}</b><span>Nur die gewählten Manager führen die Gesellschaft.</span>
              </button>
            </div>
            {g.fuehrung === "manager" && (
              <div className="gbb-anteile" role="group" aria-label="Manager">
                {sicht.mitglieder.map((m) => (
                  <label key={m.id} className="gbb-check">
                    <input type="checkbox" checked={g.manager.includes(m.id)} disabled={!offen}
                      onChange={(e) => gAendern("manager", e.target.checked ? Array.from(new Set([...g.manager, m.id])).sort((x, y) => x - y) : g.manager.filter((x) => x !== m.id))} />
                    {m.anzeigename} ist Manager
                  </label>
                ))}
              </div>
            )}
            {F("gesellschaft.manager")}
          </div>

          <div className="gbb-gruppe" data-feld="gesellschaft.anteile">
            <h3>Anteile</h3>
            <div className="gbb-anteile">
              {sicht.mitglieder.map((m) => (
                <label key={m.id} className="gbb-anteil" data-feld={`gesellschaft.anteile.${m.id}`}>
                  <span>{m.anzeigename}</span>
                  <span className="gbb-zusatz"><input inputMode="decimal" value={String(g.anteile[String(m.id)] ?? "").replace(".", ",")} disabled={!offen} aria-label={`Anteil ${m.anzeigename} in Prozent`}
                    onChange={(e) => {
                      const roh = e.target.value.replace(",", ".").replace(/[^\d.]/g, "");
                      const n = roh === "" ? undefined : Number(roh);
                      const neu = { ...g.anteile }; if (n === undefined || !Number.isFinite(n)) delete neu[String(m.id)]; else neu[String(m.id)] = n;
                      gAendern("anteile", neu);
                    }} /><span>%</span></span>
                </label>
              ))}
              <div className={`gbb-summe${Math.round(summe * 100) === 10000 ? "" : " falsch"}`}><span>Zusammen</span><span>{anteilText(summe)}</span></div>
            </div>
            {F("gesellschaft.anteile")}
          </div>

          <div className="gbb-gruppe">
            <label className={`gbb-feld breit${falsch("gesellschaft.responsibleParty")}`} data-feld="gesellschaft.responsibleParty">{T.persoenlich.responsibleParty}
              <select value={g.responsibleParty ?? ""} disabled={!offen} onChange={(e) => gAendern("responsibleParty", e.target.value ? Number(e.target.value) : null)}>
                <option value="">Bitte wählen</option>
                {sicht.mitglieder.map((m) => <option key={m.id} value={m.id}>{m.anzeigename}</option>)}
              </select>
              <small>{T.persoenlich.responsiblePartyHilfe}</small>
              {F("gesellschaft.responsibleParty")}
            </label>
            <p className="gbb-klein">{T.persoenlich.geschaeftsjahr}</p>
          </div>

          <div className="gbb-gruppe">
            <div className="gbb-raster">
              <label className={`gbb-feld${falsch("gesellschaft.website")}`} data-feld="gesellschaft.website">Website oder Domain <small>freiwillig</small>
                <input value={g.website} onChange={(e) => gAendern("website", e.target.value)} disabled={!offen} inputMode="url" autoComplete="off" placeholder="beispiel-llc.com" />
                {F("gesellschaft.website")}
              </label>
              <label className="gbb-feld breit" data-feld="gesellschaft.anmerkungen">Anmerkungen <small>freiwillig</small>
                <textarea value={g.anmerkungen} onChange={(e) => gAendern("anmerkungen", e.target.value)} disabled={!offen} maxLength={1200} />
              </label>
            </div>
          </div>

          {warnung && (
            <div className="gbb-hinweis warn" role="alert" data-fiaon="gruendungsbogen-warnung">
              <p>{anderenUnterschrieben.length ? T.persoenlich.warnungAndere(anderenUnterschrieben) : ""}{anderenUnterschrieben.length && selbstUnterschrieben ? " " : ""}{selbstUnterschrieben ? T.persoenlich.warnungSelbst : ""}</p>
              <div className="gbb-leiste">
                <button type="button" className="gbb-knopf" onClick={() => void gesellschaftSpeichern(true)} disabled={speichert}>{T.persoenlich.trotzdem}</button>
                <button type="button" className="gbb-knopf still" onClick={() => setWarnung(false)}>Abbrechen</button>
              </div>
            </div>
          )}
          <div className="gbb-weiter">
            {offen ? (
              <button type="button" className="gbb-knopf" onClick={() => void gesellschaftSpeichern(false)} disabled={speichert || !gDirty} data-fiaon="gruendungsbogen-gesellschaft-speichern">
                {speichert ? "Wird gespeichert …" : gDirty ? "Angaben speichern" : "Gespeichert"}
              </button>
            ) : <span />}
            {gDirty && <span className="gbb-ungespeichert">{T.persoenlich.ungespeichert}</span>}
            <button type="button" className="gbb-knopf still" onClick={() => gehe(1)} disabled={gDirty && offen}>Weiter zu Ihren Angaben</button>
          </div>
        </section>
      )}

      {/* ── 2 · IHRE ANGABEN ───────────────────────────────────────────── */}
      {abschnitt === 1 && (
        <section className="gbb-blatt" aria-labelledby="gbb-a2">
          <h2 id="gbb-a2">Ihre Angaben</h2>
          <p className="gbb-lead">{T.persoenlich.angabenLead}</p>

          <div className="gbb-gruppe">
            <h3>Person</h3>
            <div className="gbb-raster">
              <label className="gbb-feld" data-feld="angaben.anrede">Anrede
                <select value={a.anrede} onChange={(e) => aAendern("anrede", e.target.value as GbAngaben["anrede"])} disabled={!offen}>
                  <option value="">Keine Angabe</option><option value="Herr">Herr</option><option value="Frau">Frau</option>
                </select>
              </label>
              <span aria-hidden="true" />
              <label className={`gbb-feld${falsch("angaben.vornamen")}`} data-feld="angaben.vornamen">Vorname(n) <small>wie im Reisepass</small>
                <input value={a.vornamen} onChange={(e) => aAendern("vornamen", e.target.value)} disabled={!offen} autoComplete="given-name" />
                {F("angaben.vornamen")}
              </label>
              <label className={`gbb-feld${falsch("angaben.nachname")}`} data-feld="angaben.nachname">Nachname <small>wie im Reisepass</small>
                <input value={a.nachname} onChange={(e) => aAendern("nachname", e.target.value)} disabled={!offen} autoComplete="family-name" />
                {F("angaben.nachname")}
              </label>
              <label className={`gbb-feld${falsch("angaben.geburtsdatum")}`} data-feld="angaben.geburtsdatum">Geburtsdatum
                <input type="date" value={a.geburtsdatum} onChange={(e) => aAendern("geburtsdatum", e.target.value)} disabled={!offen} autoComplete="bday" max={sicht.heute} />
                {F("angaben.geburtsdatum")}
              </label>
              <label className={`gbb-feld${falsch("angaben.geburtsort")}`} data-feld="angaben.geburtsort">Geburtsort
                <input value={a.geburtsort} onChange={(e) => aAendern("geburtsort", e.target.value)} disabled={!offen} />
                {F("angaben.geburtsort")}
              </label>
              <label className={`gbb-feld breit${falsch("angaben.staatsangehoerigkeit")}`} data-feld="angaben.staatsangehoerigkeit">Staatsangehörigkeit
                <input value={a.staatsangehoerigkeit} onChange={(e) => aAendern("staatsangehoerigkeit", e.target.value)} disabled={!offen} list="gbb-staatsangehoerigkeit" />
                {F("angaben.staatsangehoerigkeit")}
              </label>
            </div>
          </div>

          <div className="gbb-gruppe">
            <h3>Wohnanschrift</h3>
            <div className="gbb-raster">
              <label className={`gbb-feld breit${falsch("angaben.strasse")}`} data-feld="angaben.strasse">Straße und Hausnummer
                <input value={a.strasse} onChange={(e) => aAendern("strasse", e.target.value)} disabled={!offen} autoComplete="street-address" />
                {F("angaben.strasse")}
              </label>
              <label className={`gbb-feld${falsch("angaben.plz")}`} data-feld="angaben.plz">Postleitzahl
                <input value={a.plz} onChange={(e) => aAendern("plz", e.target.value)} disabled={!offen} autoComplete="postal-code" inputMode="text" />
                {F("angaben.plz")}
              </label>
              <label className={`gbb-feld${falsch("angaben.ort")}`} data-feld="angaben.ort">Ort
                <input value={a.ort} onChange={(e) => aAendern("ort", e.target.value)} disabled={!offen} autoComplete="address-level2" />
                {F("angaben.ort")}
              </label>
              <label className={`gbb-feld${falsch("angaben.land")}`} data-feld="angaben.land">Land
                <input value={a.land} onChange={(e) => aAendern("land", e.target.value)} disabled={!offen} list="gbb-laender" autoComplete="country-name" />
                {F("angaben.land")}
              </label>
              <label className={`gbb-feld${falsch("angaben.steuerAnsaessig")}`} data-feld="angaben.steuerAnsaessig">Steuerlich ansässig in
                <input value={a.steuerAnsaessig} onChange={(e) => aAendern("steuerAnsaessig", e.target.value)} disabled={!offen} list="gbb-laender" />
                {F("angaben.steuerAnsaessig")}
              </label>
            </div>
          </div>

          <div className="gbb-gruppe">
            <h3>Kontakt</h3>
            <div className="gbb-raster">
              <label className="gbb-feld">E-Mail <small>Ihr Zugang</small>
                <input value={ich.email} disabled readOnly />
              </label>
              <label className={`gbb-feld${falsch("angaben.kontaktEmail")}`} data-feld="angaben.kontaktEmail">Weitere Kontaktadresse <small>freiwillig</small>
                <input type="email" value={a.kontaktEmail} onChange={(e) => aAendern("kontaktEmail", e.target.value)} disabled={!offen} autoComplete="email" />
                {F("angaben.kontaktEmail")}
              </label>
              <label className={`gbb-feld breit${falsch("angaben.telefon")}`} data-feld="angaben.telefon">Telefon mit Ländervorwahl
                <input type="tel" value={a.telefon} onChange={(e) => aAendern("telefon", e.target.value)} disabled={!offen} autoComplete="tel" placeholder="+49 171 1234567" />
                {F("angaben.telefon")}
              </label>
            </div>
          </div>

          <div className="gbb-gruppe">
            <h3>Reisepass</h3>
            <div className="gbb-raster">
              <label className={`gbb-feld${falsch("angaben.passNummer")}`} data-feld="angaben.passNummer">Reisepassnummer
                <input value={a.passNummer} onChange={(e) => aAendern("passNummer", e.target.value.toUpperCase())} disabled={!offen} autoComplete="off" autoCapitalize="characters" />
                {F("angaben.passNummer")}
              </label>
              <label className={`gbb-feld${falsch("angaben.passStaat")}`} data-feld="angaben.passStaat">Ausstellender Staat
                <input value={a.passStaat} onChange={(e) => aAendern("passStaat", e.target.value)} disabled={!offen} list="gbb-laender" />
                {F("angaben.passStaat")}
              </label>
              <label className={`gbb-feld${falsch("angaben.passGueltigBis")}`} data-feld="angaben.passGueltigBis">Gültig bis
                <input type="date" value={a.passGueltigBis} onChange={(e) => aAendern("passGueltigBis", e.target.value)} disabled={!offen} min={sicht.heute} />
                {F("angaben.passGueltigBis")}
              </label>
            </div>
            <div className="gbb-upload" data-feld="reisepass">
              <b>{T.persoenlich.reisepassTitel}</b>
              <span className="gbb-klein" style={{ marginTop: 0 }}>{T.persoenlich.reisepassHilfe}</span>
              {ich.reisepass && <span className="gbb-upload-da">{T.persoenlich.reisepassDa(ich.reisepass.name, amText(ich.reisepass.am))}</span>}
              {offen && (
                <input type="file" accept="application/pdf,image/jpeg,image/png" disabled={laedtHoch} aria-label={T.persoenlich.reisepassTitel}
                  onChange={(e) => { void reisepassHochladen(e.target.files?.[0]); e.target.value = ""; }} data-fiaon="gruendungsbogen-reisepass" />
              )}
              {laedtHoch && <span className="gbb-klein" style={{ marginTop: 0 }}>Wird hochgeladen …</span>}
              {F("reisepass")}
            </div>
          </div>

          <div className="gbb-gruppe" data-feld="angaben.usSteuernummerVorhanden">
            <h3>{T.persoenlich.usFrage}</h3>
            <p className="gbb-klein" style={{ marginTop: 4 }}>{T.persoenlich.usHilfe}</p>
            <div className="gbb-wahl zwei" role="radiogroup" aria-label={T.persoenlich.usFrage}>
              <button type="button" role="radio" aria-checked={a.usSteuernummerVorhanden === false} className={`gbb-option${a.usSteuernummerVorhanden === false ? " an" : ""}`} onClick={() => aAendern("usSteuernummerVorhanden", false)} disabled={!offen}><b>Nein</b></button>
              <button type="button" role="radio" aria-checked={a.usSteuernummerVorhanden === true} className={`gbb-option${a.usSteuernummerVorhanden === true ? " an" : ""}`} onClick={() => aAendern("usSteuernummerVorhanden", true)} disabled={!offen}><b>Ja</b></button>
            </div>
            {F("angaben.usSteuernummerVorhanden")}
            {a.usSteuernummerVorhanden === true && (
              <label className={`gbb-feld${falsch("angaben.usSteuernummer")}`} data-feld="angaben.usSteuernummer" style={{ marginTop: 12 }}>SSN oder ITIN <small>{ich.usSteuernummerMaskiert ? `gespeichert: ${ich.usSteuernummerMaskiert} — leer lassen, um sie zu behalten` : "neun Ziffern"}</small>
                <input value={usNeu} onChange={(e) => { setUsNeu(e.target.value.replace(/[^\d-\s]/g, "").slice(0, 11)); setADirty(true); }} disabled={!offen} inputMode="numeric" autoComplete="off" placeholder={ich.usSteuernummerMaskiert || "123-45-6789"} />
                {F("angaben.usSteuernummer")}
              </label>
            )}
          </div>

          <datalist id="gbb-laender">{LAENDER.map((l) => <option key={l} value={l} />)}</datalist>
          <datalist id="gbb-staatsangehoerigkeit">{STAATSANGEHOERIGKEITEN.map((l) => <option key={l} value={l} />)}</datalist>

          <div className="gbb-weiter">
            {offen ? (
              <button type="button" className="gbb-knopf" onClick={() => void angabenSpeichern()} disabled={speichert || !aDirty} data-fiaon="gruendungsbogen-angaben-speichern">
                {speichert ? "Wird gespeichert …" : aDirty ? "Zwischenspeichern" : "Gespeichert"}
              </button>
            ) : <span />}
            {aDirty && <span className="gbb-ungespeichert">{T.persoenlich.ungespeichert}</span>}
            <button type="button" className="gbb-knopf still" onClick={async () => { if (aDirty && offen) { if (await angabenSpeichern()) gehe(2); } else gehe(2); }}>
              {aDirty && offen ? "Speichern und weiter" : "Weiter zur Unterschrift"}
            </button>
          </div>
        </section>
      )}

      {/* ── 3 · BESTÄTIGEN UND UNTERSCHREIBEN ─────────────────────────── */}
      {abschnitt === 2 && (
        <section className="gbb-blatt" aria-labelledby="gbb-a3">
          <h2 id="gbb-a3">Bestätigen und unterschreiben</h2>

          {ich.status === "unterschrieben" && ich.unterschrift ? (
            <div className="gbb-fertig" data-fiaon="gruendungsbogen-unterschrieben">
              <span className="gbb-fertig-zeichen"><Haken /></span>
              <p className="gbb-lead" style={{ color: "var(--tinte)" }}><b>{T.persoenlich.unterschrieben(ich.unterschrift.amText)}</b></p>
              <p className="gbb-lead">{T.persoenlich.nachUnterschrift}</p>
              {ich.hatPdf && <div className="gbb-leiste"><a className="gbb-knopf" href={`${api}/pdf`} data-fiaon="gruendungsbogen-pdf">{T.persoenlich.pdf}</a></div>}
              <p className="gbb-klein">Ort: {ich.unterschrift.ort} · Fassung {ich.unterschrift.fassung} · Prüfsumme {ich.unterschrift.hash.slice(0, 16)}…</p>
            </div>
          ) : !offen ? (
            <p className="gbb-lead">{T.persoenlich.gesperrt}</p>
          ) : (gDirty || aDirty) ? (
            <div className="gbb-hinweis warn" role="status">Sie haben Änderungen, die noch nicht gespeichert sind. Bitte speichern Sie zuerst {gDirty ? "die gemeinsamen Angaben" : "Ihre Angaben"}.
              <div className="gbb-leiste"><button type="button" className="gbb-knopf still" onClick={() => gehe(gDirty ? 0 : 1)}>Zum Speichern</button></div>
            </div>
          ) : sicht.pflichtFehlt.length > 0 ? (
            <>
              <p className="gbb-lead">{T.persoenlich.fehltTitel}</p>
              <ul className="gbb-fehlt" data-fiaon="gruendungsbogen-fehlt">
                {sicht.pflichtFehlt.map((f) => (
                  <li key={f.feld + f.text}><span>{f.text}</span>
                    <button type="button" className="gbb-textknopf" onClick={() => zeige({ feld: f.feld, text: f.text })}>{f.feld.startsWith("gesellschaft") ? "Zur Gesellschaft" : "Zu Ihren Angaben"}</button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <p className="gbb-lead">{T.persoenlich.unterschriftLead}</p>
              <div className="gbb-gruppe">
                <h3>{T.persoenlich.zusammenfassung}</h3>
                <dl className="gbb-zus" data-fiaon="gruendungsbogen-zusammenfassung">
                  <dt>Gesellschaft</dt><dd>{`${sicht.gesellschaft.wunschname1} ${GB_RECHTSFORM}\nAusweichnamen: ${sicht.gesellschaft.wunschname2} ${GB_RECHTSFORM}, ${sicht.gesellschaft.wunschname3} ${GB_RECHTSFORM}`}</dd>
                  <dt>Bundesstaat</dt><dd>{gbStaatName(sicht.gesellschaft.bundesstaat)}</dd>
                  <dt>Unternehmensgegenstand</dt><dd>{sicht.gesellschaft.gegenstand}</dd>
                  <dt>Führung</dt><dd>{sicht.gesellschaft.fuehrung === "manager" ? `${T.persoenlich.fuehrungManager}: ${sicht.gesellschaft.manager.map(nameVon).join(", ")}` : T.persoenlich.fuehrungMember}</dd>
                  <dt>Anteile</dt><dd>{sicht.mitglieder.map((m) => `${m.anzeigename}: ${anteilText(Number(sicht.gesellschaft.anteile[String(m.id)] ?? 0))}`).join("\n")}</dd>
                  <dt>Responsible Party (EIN)</dt><dd>{nameVon(sicht.gesellschaft.responsibleParty)}</dd>
                  <dt>Geschäftsjahr</dt><dd>Kalenderjahr</dd>
                  {sicht.gesellschaft.website && <><dt>Website</dt><dd>{sicht.gesellschaft.website}</dd></>}
                  {sicht.gesellschaft.anmerkungen && <><dt>Anmerkungen</dt><dd>{sicht.gesellschaft.anmerkungen}</dd></>}
                  <dt>Ihr Name</dt><dd>{[ich.angaben.anrede, nameLautPass(ich.angaben)].filter(Boolean).join(" ")}</dd>
                  <dt>Geboren</dt><dd>{`${tagText(ich.angaben.geburtsdatum)} in ${ich.angaben.geburtsort}`}</dd>
                  <dt>Staatsangehörigkeit</dt><dd>{ich.angaben.staatsangehoerigkeit}</dd>
                  <dt>Wohnanschrift</dt><dd>{`${ich.angaben.strasse}\n${ich.angaben.plz} ${ich.angaben.ort}, ${ich.angaben.land}`}</dd>
                  <dt>Steuerlich ansässig in</dt><dd>{ich.angaben.steuerAnsaessig}</dd>
                  <dt>Kontakt</dt><dd>{[ich.email, ich.angaben.kontaktEmail, ich.angaben.telefon].filter(Boolean).join("\n")}</dd>
                  <dt>Reisepass</dt><dd>{`${ich.angaben.passNummer}, ${ich.angaben.passStaat}, gültig bis ${tagText(ich.angaben.passGueltigBis)}${ich.reisepass ? `\nBildseite: ${ich.reisepass.name}` : ""}`}</dd>
                  <dt>US-Steuernummer</dt><dd>{ich.angaben.usSteuernummerVorhanden ? ich.usSteuernummerMaskiert || "vorhanden" : "keine"}</dd>
                </dl>
              </div>

              <div className="gbb-gruppe" data-fiaon="gruendungsbogen-bestaetigungen">
                <h3>Bestätigungen</h3>
                <div>
                  {sicht.bestaetigungen.map((b) => (
                    <label key={b.schluessel} className={`gbb-haken${fehler?.feld === `bestaetigungen.${b.schluessel}` ? " falsch" : ""}`} data-feld={`bestaetigungen.${b.schluessel}`}>
                      <input type="checkbox" checked={!!best[b.schluessel]} onChange={(e) => { setBest((x) => ({ ...x, [b.schluessel]: e.target.checked })); setFehler(null); }} />
                      <span><b>{b.titel}.</b> {b.text}{b.link ? <> <a href={b.link.href} target="_blank" rel="noopener">{b.link.text}</a></> : null}</span>
                    </label>
                  ))}
                </div>
                {sicht.bestaetigungen.map((b) => <span key={b.schluessel}>{F(`bestaetigungen.${b.schluessel}`)}</span>)}
              </div>

              <div className="gbb-gruppe">
                <div className="gbb-raster">
                  <label className={`gbb-feld${falsch("ort")}`} data-feld="ort">{T.persoenlich.ort}
                    <input value={ort} onChange={(e) => setOrt(e.target.value)} autoComplete="address-level2" maxLength={80} />
                    {F("ort")}
                  </label>
                  <label className={`gbb-feld${falsch("name")}`} data-feld="name">{T.persoenlich.name}
                    <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder={nameLautPass(ich.angaben)} maxLength={240} />
                    {F("name")}
                  </label>
                </div>
                <div className="gbb-pad" data-feld="unterschriftPng">
                  <SignaturePad key={padRunde} onChange={setPng} hinweis={T.persoenlich.padHinweis} />
                  {F("unterschriftPng")}
                </div>
                <button type="button" className="gbb-knopf voll" onClick={() => void unterschreiben()} disabled={sendet} data-fiaon="gruendungsbogen-unterschreiben" style={{ marginTop: 18 }}>
                  {sendet ? "Wird ausgefertigt …" : T.persoenlich.unterschreiben}
                </button>
                <p className="gbb-klein">{sicht.danach}</p>
              </div>
            </>
          )}

          <div className="gbb-weiter">
            <button type="button" className="gbb-knopf still" onClick={() => gehe(1)}>Zurück zu Ihren Angaben</button>
          </div>
        </section>
      )}

      <section className="gbb-blatt" aria-labelledby="gbb-leute">
        <h2 id="gbb-leute">Gesellschafter</h2>
        <ul className="gbb-leute">
          {sicht.mitglieder.map((m) => (
            <li key={m.id} className="gbb-person">
              <div className="gbb-person-kopf">
                <span className="gbb-person-name">{m.anzeigename}{m.ich ? <small>(Sie)</small> : null}</span>
                <span className="gbb-marken">
                  <span className={`gbb-marke ${m.angabenVollstaendig ? "gut" : ""}`}>{m.angabenVollstaendig ? T.gemeinsam.angabenFertig : T.gemeinsam.angabenOffen}</span>
                  <Marke status={m.unterschrift} am={m.unterschriebenAm} />
                </span>
              </div>
            </li>
          ))}
        </ul>
        <p className="gbb-klein">{sicht.kostenHinweis}</p>
        {sicht.gemeinsam && <p className="gbb-klein"><a className="gbb-textknopf" href={sicht.gemeinsam}>Zur gemeinsamen Seite</a></p>}
      </section>
    </main>
  );
}

// ═══ DIE SEITE ════════════════════════════════════════════════════════════════
export default function BusinessGruendung() {
  const [istPersoenlich, p2] = useRoute("/business/gruendung/:bt/m/:mt");
  const [istGemeinsam, p1] = useRoute("/business/gruendung/:bt");

  // Für Suchmaschinen gesperrt (der Server sendet dazu X-Robots-Tag), kein Verweis mit dem Link nach außen.
  useEffect(() => {
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const vorher = robots?.content ?? null;
    const neuMeta = !robots;
    if (!robots) { robots = document.createElement("meta"); robots.name = "robots"; document.head.appendChild(robots); }
    robots.content = "noindex, nofollow";
    let ref = document.querySelector<HTMLMetaElement>('meta[name="referrer"]');
    const refNeu = !ref;
    const refVorher = ref?.content ?? null;
    if (!ref) { ref = document.createElement("meta"); ref.name = "referrer"; document.head.appendChild(ref); }
    ref.content = "no-referrer";
    return () => {
      if (neuMeta) robots!.remove(); else robots!.content = vorher ?? "";
      if (refNeu) ref!.remove(); else ref!.content = refVorher ?? "";
    };
  }, []);

  return (
    <Dunkel seite="business" titel={T.seitentitel} beschreibung="">
      {istPersoenlich && p2 ? <Persoenlich bt={decodeURIComponent(p2.bt)} mt={decodeURIComponent(p2.mt)} />
        : istGemeinsam && p1 ? <Gemeinsam bt={decodeURIComponent(p1.bt)} /> : null}
    </Dunkel>
  );
}
