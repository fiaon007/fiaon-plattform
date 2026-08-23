// ═══════════════════════════════════════════════════════════════════════════
// /agent/academy — Raum 10: Academy, die Ausbildung zum Bonitätsmanager
// (23.08.2026, Plan §4 Raum 7 / §11 + Nachträge)
//
// Routen: /agent/academy (Übersicht) · /agent/academy/:kapitel/:schritt?
//         /agent/academy/leitfaeden (Leitfäden auf Abruf) · /agent/academy/pruefung
// Zehn Kapitel mit Schritten, Übungen (Rundgang, Zeitleiste, Wortwächter,
// Einwand-Trainer, Simulator, Rechner, geführte Übungen, Fälle), Kapiteltests,
// Abschlussprüfung mit Urkunde. Kapitel schalten sich nacheinander frei; der
// Server misst Lesezeiten (shared/fiaon-academy-lehrplan.ts).
// Server: server/routes/fiaon-office-academy.ts. Die alte Academy (Reisen)
// bleibt unter academy.tsx erreichbar.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { ArrowLeft, ArrowRight, Award, BookOpen, Check, ChevronRight, Clock, Copy, FileText, GraduationCap, Lock, Play, ShieldCheck } from "lucide-react";
import { AgentShell } from "../shared";
import { useOffice } from "../OfficeShell";
import { UEBUNGS_ARTEN } from "@shared/fiaon-academy-lehrplan";
import { KAPITEL, kapitelVoll, type KapitelVoll, type SchrittVoll } from "./inhalte";
import { useAcademyFortschritt, schrittOeffnen, schrittFertig, type Fortschritt, type KapitelStand } from "./fortschritt";
import { Bloecke, Zeitleiste, Rundgang, Wortpruefer, UebungGefuehrt } from "./bausteine";
import { EinwandTrainer, Simulator, Rechner, FallStudie, KapitelTest } from "./uebungen";
import { Pruefung, Urkunde } from "./pruefung";
import { LEITFAEDEN, leitfadenKurzText } from "./leitfaeden";
import "@/styles/office-academy.css";

export default function AgentAcademyNeuPage() { return <AgentShell><AcademyInnen /></AgentShell>; }

const mmss = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;

function AcademyInnen() {
  const { dunkel, titel } = useOffice();
  useEffect(() => { dunkel(true); titel("Academy"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [, params] = useRoute("/agent/academy/:kapitel/:schritt?");
  const f = useAcademyFortschritt();
  const kapitelKey = params?.kapitel;
  useEffect(() => { document.title = "Academy — FIAON Office"; }, []);
  if (kapitelKey === "leitfaeden") return <LeitfaedenSeite />;
  if (kapitelKey === "pruefung") return <PruefungSeite f={f} />;
  if (kapitelKey) { const k = kapitelVoll(kapitelKey); if (k) return <KapitelSeite k={k} schrittKey={params?.schritt} f={f} />; }
  return <Uebersicht f={f} />;
}

// ── Fortschrittsring ──────────────────────────────────────────────────────
function Ring({ prozent, groesse = 132 }: { prozent: number; groesse?: number }) {
  const r = 46, umfang = 2 * Math.PI * r;
  return (
    <div className="ac-ring" style={{ width: groesse, height: groesse }}>
      <svg viewBox="0 0 104 104"><circle className="spur" cx="52" cy="52" r={r} /><circle className="lauf" cx="52" cy="52" r={r} strokeDasharray={umfang} strokeDashoffset={umfang * (1 - Math.max(0, Math.min(100, prozent)) / 100)} /></svg>
      <div className="ac-ring-innen"><b>{prozent}</b><small>Prozent</small></div>
    </div>
  );
}

// ── Übersicht ─────────────────────────────────────────────────────────────
function Uebersicht({ f }: { f: ReturnType<typeof useAcademyFortschritt> }) {
  const stand = f.stand;
  const naechstes = f.naechstesKapitel;
  const naechsterSchritt = useMemo(() => {
    if (!stand || !naechstes) return null;
    const k = kapitelVoll(naechstes.key); if (!k) return null;
    const offen = k.schritte.find((s) => !stand.schritte.some((z) => z.kapitel === k.key && z.schritt === s.key && z.bestanden));
    return { kapitel: k, schritt: offen ?? k.schritte[k.schritte.length - 1] };
  }, [stand, naechstes]);
  const gesamtMin = KAPITEL.reduce((n, k) => n + k.dauerMin, 0);
  return (
    <div className="ac">
      <section className="ac-hero">
        <div className="ac-hero-text">
          <span className="ac-pille">FIAON Academy · Ausbildung zum Bonitätsmanager</span>
          <h1>{f.zertifiziert ? <>Du bist <span className="ac-verlauf">Zertifizierter Bonitätsmanager.</span></> : f.prozent > 0 ? <>Weiter auf dem Weg zum <span className="ac-verlauf">Zertifizierten Bonitätsmanager.</span></> : <>Alles über FIAON – <span className="ac-verlauf">bis du es erklären kannst.</span></>}</h1>
          <p>Zehn Kapitel, rund {Math.round(gesamtMin / 60)} Stunden, echte Werkzeuge, reale Situationen. Kapitel schalten sich nacheinander frei; jeder Schritt braucht seine Zeit. Am Ende die Abschlussprüfung – bestanden heißt: Urkunde und 5 Prozentpunkte mehr Provision.</p>
          <div className="ac-hero-knoepfe">
            {naechsterSchritt ? <Link href={`/agent/academy/${naechsterSchritt.kapitel.key}/${naechsterSchritt.schritt.key}`} className="ac-knopf gross"><Play size={16} />{f.prozent > 0 ? `Weiter: Kapitel ${naechsterSchritt.kapitel.nr}` : "Ausbildung beginnen"}</Link>
              : stand?.pruefung.frei && !f.zertifiziert ? <Link href="/agent/academy/pruefung" className="ac-knopf gross"><ShieldCheck size={16} />Zur Abschlussprüfung</Link> : null}
            <Link href="/agent/academy/leitfaeden" className="ac-knopf still"><FileText size={15} />Leitfäden auf Abruf</Link>
          </div>
        </div>
        <div className="ac-hero-ring">{f.laedt ? <p className="ac-leise">Lade …</p> : <><Ring prozent={f.prozent} /><small>{stand?.kapitel.filter((k) => k.testBestanden).length ?? 0} von {KAPITEL.length} Kapiteln bestanden</small></>}</div>
      </section>
      {f.fehler && <p className="ac-fehler">{f.fehler}</p>}
      {f.zertifikat && <Urkunde z={f.zertifikat} />}

      <section className="ac-kapitel-raster">
        {KAPITEL.map((k, i) => { const st = stand?.kapitel.find((x) => x.key === k.key); const frei = st?.frei ?? i === 0; return (
          <Link key={k.key} href={frei ? `/agent/academy/${k.key}` : "/agent/academy"} className={`ac-kapitel-karte${frei ? "" : " gesperrt"}${st?.testBestanden ? " bestanden" : ""}`} style={{ animationDelay: `${i * 50}ms` }} onClick={(e) => { if (!frei) e.preventDefault(); }}>
            <div className="ac-kk-kopf"><span className="ac-kk-nr">{String(k.nr).padStart(2, "0")}</span>{st?.testBestanden ? <span className="ac-kk-marke gut"><Check size={13} /> bestanden</span> : frei ? <span className="ac-kk-marke">{st?.prozent ?? 0} %</span> : <span className="ac-kk-marke"><Lock size={12} /> gesperrt</span>}</div>
            <b>{k.titel}</b>
            <p>{k.untertitel}</p>
            <div className="ac-kk-fuss"><span>{k.schritte.length - 1} Schritte · ~{k.dauerMin} Min</span>{frei && <ChevronRight size={16} />}</div>
            <div className="ac-kk-balken"><i style={{ width: `${st?.prozent ?? 0}%` }} /></div>
          </Link>
        ); })}
        <Link href="/agent/academy/pruefung" className={`ac-kapitel-karte pruefung${stand?.pruefung.frei ? "" : " gesperrt"}${f.zertifiziert ? " bestanden" : ""}`} onClick={(e) => { if (!stand?.pruefung.frei) e.preventDefault(); }}>
          <div className="ac-kk-kopf"><span className="ac-kk-nr"><Award size={18} strokeWidth={1.75} /></span>{f.zertifiziert ? <span className="ac-kk-marke gut"><Check size={13} /> bestanden</span> : stand?.pruefung.frei ? <span className="ac-kk-marke">offen</span> : <span className="ac-kk-marke"><Lock size={12} /> nach Kapitel 10</span>}</div>
          <b>Abschlussprüfung</b>
          <p>25 Fragen aus dem Pool, 45 Sekunden je Frage, bestanden ab 85 %. Danach: Urkunde, Stufe „Zertifizierter Bonitätsmanager“, +5 Prozentpunkte Provision.</p>
          <div className="ac-kk-fuss"><span>~20 Minuten</span><ChevronRight size={16} /></div>
        </Link>
      </section>
    </div>
  );
}

// ── Kapitel-Seite ─────────────────────────────────────────────────────────
function KapitelSeite({ k, schrittKey, f }: { k: KapitelVoll; schrittKey?: string; f: ReturnType<typeof useAcademyFortschritt> }) {
  const [, setLocation] = useLocation();
  const stand = f.stand;
  const kStand = stand?.kapitel.find((x) => x.key === k.key);
  const schrittIndex = Math.max(0, k.schritte.findIndex((s) => s.key === schrittKey));
  const schritt = k.schritte[schrittIndex];
  const istFertig = (s: SchrittVoll) => !!stand?.schritte.find((z) => z.kapitel === k.key && z.schritt === s.key && z.bestanden);
  const fertig = istFertig(schritt);
  const gesperrt = stand ? !kStand?.frei : false;

  // Öffnen + Lesezeit (serverseitig gemessen; hier nur die Anzeige)
  const [geoeffnetAm, setGeoeffnetAm] = useState<number | null>(null);
  const [rest, setRest] = useState(0);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [sendet, setSendet] = useState(false);
  const istText = !UEBUNGS_ARTEN.has(schritt.art) && schritt.art !== "test";
  useEffect(() => {
    setMeldung(null); setGeoeffnetAm(null);
    if (!stand || gesperrt || schritt.art === "test") return;
    const bereits = stand.schritte.find((z) => z.kapitel === k.key && z.schritt === schritt.key);
    if (bereits?.bestanden) return;
    schrittOeffnen(k.key, schritt.key).then((r) => { if (r.ok && r.geoeffnetAm) setGeoeffnetAm(new Date(r.geoeffnetAm).getTime()); });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [k.key, schritt.key, !!stand, gesperrt]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!istText || fertig || geoeffnetAm === null) { setRest(0); return; }
    const tick = () => setRest(Math.max(0, schritt.minSekunden - Math.floor((Date.now() - geoeffnetAm) / 1000)));
    tick(); const i = setInterval(tick, 1000); return () => clearInterval(i);
  }, [istText, fertig, geoeffnetAm, schritt.minSekunden]);

  const geh = useCallback((i: number) => { const z = k.schritte[Math.max(0, Math.min(k.schritte.length - 1, i))]; if (z) setLocation(`/agent/academy/${k.key}/${z.key}`); }, [k, setLocation]);

  /** Text-Schritt abschließen (Server prüft Mindestlesezeit) und weitergehen. */
  const weiter = useCallback(async () => {
    if (sendet) return;
    if (fertig || schritt.art === "test") { if (schrittIndex < k.schritte.length - 1) geh(schrittIndex + 1); else setLocation("/agent/academy"); return; }
    if (!istText) { setMeldung("Schließ zuerst die Übung ab – dann geht es weiter."); return; }
    setSendet(true);
    const r = await schrittFertig(k.key, schritt.key);
    setSendet(false);
    if (!r.ok) { setMeldung(r.restSekunden ? `Noch ${mmss(r.restSekunden)} – der Schritt gilt erst nach der Mindestlesezeit als gelesen.` : r.error || "Nicht gespeichert."); return; }
    await f.neu();
    if (schrittIndex < k.schritte.length - 1) geh(schrittIndex + 1);
  }, [sendet, fertig, schritt, istText, k, schrittIndex, geh, setLocation, f]);

  const uebungFertig = useCallback(async (ergebnis: any) => {
    const r = await schrittFertig(k.key, schritt.key, { ergebnis });
    if (!r.ok) { setMeldung(r.error || "Nicht gespeichert."); return; }
    setMeldung(null); await f.neu();
  }, [k.key, schritt.key, f]);

  const testErgebnis = useCallback(async (punkte: number, gesamt: number) => {
    const r = await schrittFertig(k.key, "test", { punkte, gesamt });
    if (!r.ok) { setMeldung(r.error || "Nicht gespeichert."); return false; }
    await f.neu(); return !!r.bestanden;
  }, [k.key, f]);

  // Tastatur ←/→
  const weiterRef = useRef(weiter); weiterRef.current = weiter;
  useEffect(() => {
    const auf = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null; if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.key === "ArrowRight") { e.preventDefault(); weiterRef.current(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); if (schrittIndex > 0) geh(schrittIndex - 1); }
    };
    window.addEventListener("keydown", auf); return () => window.removeEventListener("keydown", auf);
  }, [schrittIndex, geh]);

  const weiterErlaubt = fertig || schritt.art === "test" || (istText && rest === 0 && geoeffnetAm !== null);
  const letzter = schrittIndex === k.schritte.length - 1;
  const testStand = stand?.schritte.find((z) => z.kapitel === k.key && z.schritt === "test");

  if (stand && gesperrt) return (
    <div className="ac"><div className="ac-gesperrt"><Lock size={28} strokeWidth={1.5} /><h2>Kapitel {k.nr} ist noch gesperrt.</h2><p>Besteh zuerst den Test von Kapitel {k.nr - 1}.</p><Link href="/agent/academy" className="ac-knopf still"><ArrowLeft size={15} />Zur Übersicht</Link></div></div>
  );

  return (
    <div className="ac">
      <section className="ac-kap-hero">
        <Link href="/agent/academy" className="ac-zurueck"><ArrowLeft size={15} />Academy</Link>
        <div className="ac-kap-hero-innen">
          <span className="ac-kap-nr">{String(k.nr).padStart(2, "0")}</span>
          <div><span className="ac-pille">Kapitel {k.nr} von {KAPITEL.length} · ~{k.dauerMin} Min</span><h1>{k.titel}</h1><p>{k.untertitel}</p></div>
          <div className="ac-kap-ring"><Ring prozent={kStand?.prozent ?? 0} groesse={96} /></div>
        </div>
      </section>

      <div className="ac-kap-grund">
        <aside className="ac-schritte-liste">
          {k.schritte.map((s, i) => { const ok = istFertig(s); const an = i === schrittIndex; const testGesperrt = s.art === "test" && !kStand?.uebungenFertig; return (
            <Link key={s.key} href={`/agent/academy/${k.key}/${s.key}`} className={`ac-sl-punkt${an ? " an" : ""}${ok ? " fertig" : ""}${testGesperrt ? " gesperrt" : ""}`}>
              <i>{ok ? <Check size={13} /> : s.art === "test" ? (testGesperrt ? <Lock size={12} /> : <ShieldCheck size={13} />) : UEBUNGS_ARTEN.has(s.art) ? <Play size={12} /> : <BookOpen size={12} />}</i>
              <span>{s.titel}</span>
              {s.minSekunden > 0 && !ok && <small>{Math.ceil(s.minSekunden / 60)} Min</small>}
            </Link>
          ); })}
        </aside>

        <main className="ac-schritt">
          <div className="ac-schritt-kopf">
            <small>Schritt {schrittIndex + 1} von {k.schritte.length}{fertig && <span className="ac-fertig-marke klein"><Check size={12} /> abgeschlossen</span>}</small>
            <h2>{schritt.titel}</h2>
            {schritt.inhalt.einleitung && <p className="ac-einleitung">{schritt.inhalt.einleitung}</p>}
          </div>

          {schritt.art === "test" ? (
            <KapitelTest fragen={k.test} schwelle={stand?.testSchwelle ?? 0.8} gesperrt={!kStand?.uebungenFertig} bestanden={!!testStand?.bestanden} letztePunkte={testStand?.punkte != null && testStand?.gesamt != null ? { punkte: testStand.punkte, gesamt: testStand.gesamt } : null} onErgebnis={testErgebnis} />
          ) : (
            <>
              {schritt.inhalt.bloecke && <Bloecke bloecke={schritt.inhalt.bloecke} />}
              {schritt.inhalt.uebung && <UebungAnsicht uebung={schritt.inhalt.uebung} fertig={fertig} onFertig={uebungFertig} />}
            </>
          )}

          {meldung && <p className="ac-fehler">{meldung}</p>}

          <div className="ac-nav">
            <button type="button" className="ac-knopf still" disabled={schrittIndex === 0} onClick={() => geh(schrittIndex - 1)}><ArrowLeft size={15} />Zurück</button>
            <div className="ac-nav-mitte">{istText && !fertig && geoeffnetAm !== null && (rest > 0 ? <span className="ac-lesezeit"><Clock size={14} /> Mindestlesezeit {mmss(rest)}</span> : <span className="ac-lesezeit ok"><Check size={14} /> Gelesen – weiter</span>)}{!istText && schritt.art !== "test" && !fertig && <span className="ac-lesezeit">Übung abschließen, dann weiter</span>}<small>Tastatur: ← →</small></div>
            {letzter && (fertig || testStand?.bestanden) ? <Link href="/agent/academy" className="ac-knopf"><Check size={15} />Kapitel fertig – zur Übersicht</Link>
              : <button type="button" className="ac-knopf" disabled={!weiterErlaubt || sendet} onClick={weiter}>{sendet ? "…" : "Weiter"}<ArrowRight size={15} /></button>}
          </div>
        </main>
      </div>
    </div>
  );
}

function UebungAnsicht({ uebung, fertig, onFertig }: { uebung: NonNullable<SchrittVoll["inhalt"]["uebung"]>; fertig: boolean; onFertig: (e: any) => void }) {
  switch (uebung.art) {
    case "zeitleiste": return <Zeitleiste stationen={uebung.stationen} fertig={fertig} onFertig={onFertig} />;
    case "rundgang": return <Rundgang stationen={uebung.stationen} fertig={fertig} onFertig={onFertig} />;
    case "wortpruefer": return <Wortpruefer aufgaben={uebung.aufgaben} fertig={fertig} onFertig={onFertig} />;
    case "einwand": return <EinwandTrainer einwaende={uebung.einwaende} fertig={fertig} onFertig={onFertig} />;
    case "simulator": return <Simulator fertig={fertig} onFertig={onFertig} />;
    case "rechner": return <Rechner rechner={uebung.rechner} aufgabe={uebung.aufgabe} fertig={fertig} onFertig={onFertig} />;
    case "uebung": return <UebungGefuehrt raum={uebung.raum} schritte={uebung.schritte} frage={uebung.frage} fertig={fertig} onFertig={onFertig} />;
    case "fall": return <FallStudie fall={uebung.fall} fertig={fertig} onFertig={onFertig} />;
    default: return null;
  }
}

// ── Prüfungs-Seite ────────────────────────────────────────────────────────
function PruefungSeite({ f }: { f: ReturnType<typeof useAcademyFortschritt> }) {
  const stand = f.stand;
  return (
    <div className="ac">
      <section className="ac-kap-hero">
        <Link href="/agent/academy" className="ac-zurueck"><ArrowLeft size={15} />Academy</Link>
        <div className="ac-kap-hero-innen">
          <span className="ac-kap-nr"><Award size={34} strokeWidth={1.5} /></span>
          <div><span className="ac-pille">Abschlussprüfung</span><h1>Zertifizierter Bonitätsmanager</h1><p>25 situative Fragen, 45 Sekunden je Frage, bestanden ab 85 Prozent. Bestanden: Urkunde und 5 Prozentpunkte mehr Provision.</p></div>
        </div>
      </section>
      <div className="ac-pr-rahmen">
        {f.laedt || !stand ? <p className="ac-leise">Lade …</p> : <Pruefung lage={stand.pruefung} zertifikat={stand.zertifikat} onNeu={f.neu} />}
      </div>
    </div>
  );
}

// ── Leitfäden auf Abruf ───────────────────────────────────────────────────
function LeitfaedenSeite() {
  const [aktiv, setAktiv] = useState(0);
  const [lang, setLang] = useState(false);
  const [kopiert, setKopiert] = useState(false);
  const l = LEITFAEDEN[aktiv];
  const kopieren = async () => { try { await navigator.clipboard.writeText(leitfadenKurzText(l)); setKopiert(true); setTimeout(() => setKopiert(false), 1800); } catch { /* egal */ } };
  return (
    <div className="ac">
      <section className="ac-kap-hero">
        <Link href="/agent/academy" className="ac-zurueck"><ArrowLeft size={15} />Academy</Link>
        <div className="ac-kap-hero-innen">
          <span className="ac-kap-nr"><FileText size={34} strokeWidth={1.5} /></span>
          <div><span className="ac-pille">Leitfäden auf Abruf</span><h1>Stufe A, B, C – <span className="ac-verlauf">kurz, kopierbar.</span></h1><p>Die Kurzfassung für den Anruf, die Langfassung zum Üben. Regeln: Kunden siezen, keine Garantie, erste Zahlung immer direkt, Termin sofort aus deiner Availability.</p></div>
        </div>
      </section>
      <div className="ac-lf">
        <div className="ac-lf-tabs">{LEITFAEDEN.map((x, i) => <button key={x.key} type="button" className={`ac-lf-tab${i === aktiv ? " an" : ""}`} onClick={() => { setAktiv(i); setLang(false); }}><b>{x.stufe}</b><span>{x.titel.replace(/^Stufe [ABC] – /, "")}</span></button>)}</div>
        <div className="ac-lf-karte">
          <div className="ac-lf-kopf"><div><small>Wann</small><p>{l.wann}</p></div><div><small>Ziel</small><p>{l.ziel}</p></div></div>
          <ol className="ac-lf-kurz">{l.kurz.map((k, i) => <li key={i}>{k}</li>)}</ol>
          <div className="ac-merk"><BookOpen size={18} strokeWidth={1.75} /><p>{l.merke}</p></div>
          <div className="ac-lf-knoepfe">
            <button type="button" className="ac-knopf" onClick={kopieren}>{kopiert ? <Check size={15} /> : <Copy size={15} />}{kopiert ? "Kopiert" : "Kurzfassung kopieren"}</button>
            <button type="button" className="ac-knopf still" onClick={() => setLang(!lang)}>{lang ? "Langfassung ausblenden" : "Langfassung zeigen"}</button>
            <Link href={`/agent/academy/gespraech/stufe-${l.key}`} className="ac-knopf still"><GraduationCap size={15} />Im Kapitel üben</Link>
          </div>
          {lang && <Bloecke bloecke={[{ art: "leitfaden", phasen: l.phasen }]} />}
        </div>
      </div>
    </div>
  );
}

export { KAPITEL };
export type { Fortschritt, KapitelStand };
