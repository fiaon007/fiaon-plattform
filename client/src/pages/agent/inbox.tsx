// ═══════════════════════════════════════════════════════════════════════════
// /agent/inbox — der Posteingang des Bonitätsmanagers
//
// ── VORHER (23.08.2026) ────────────────────────────────────────────────────
// Die Seite war die Mail-Zentrale mit einem Postfach daneben: links eine Liste
// der Mails, die dieser Mitarbeiter SELBST ausgelöst hat, rechts das
// Schreibfeld. Zwei Dinge stimmten nicht:
//   · Sie zeigte fast nichts. 98 % aller Mails an Kunden löst die Automatik
//     aus — die tauchten nirgends auf. Ein Betreuer mit über tausend Kunden
//     sah in seiner „Inbox" eine leere Liste.
//   · Sie zeigte nichts EINGEHENDES. Kein verpasster Anruf, kein Anliegen aus
//     dem Kundenbereich, kein Rückruf-Wunsch, keine unzustellbare Post.
//
// ── NACHHER (24.08.2026, Auftrag Justin) ───────────────────────────────────
// Der Morgen eines Bonitätsmanagers: Was ist seit gestern hereingekommen, was
// muss ich beantworten? Deshalb EINE Karte je Kunde, das Neueste zuerst, ein
// Klick in die Akte — und ausschließlich die eigenen Kunden (der Server prüft
// fiaon_persons.assigned_agent_id, nicht der Browser).
//
//   Übersicht   GET /agent/inbox/uebersicht?filter=&suche=&tage=&seite=
//   Kunde       GET /agent/inbox/kunde/:personId
//   Antworten   POST /agent/tickets/:id/antwort        (bestehende Route)
//   Standardmail GET/POST /agent/mail/:personId[/:event] (bestehende Routen)
//   Schreiben   /mail/zentrale/{gruppen,suche,vorschau,senden,test,ki}
//   Anrufen     Ereignis „fiaon-anrufen" ans Softphone
//   Akte        /agent/kunden?person=<ID>
//
// Aufbau: eine Spalte mit Karten, die Arbeit am einzelnen Kunden und das
// Schreiben laufen in einer Lade von rechts. Am Handy ist die Lade der ganze
// Bildschirm — damit entfällt die alte Zwei-Ebenen-Krücke mit dem versteckten
// Zurück-Knopf.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";
import {
  Mail, PenLine, Search, X, Sparkles, Users, Check, FolderOpen, Phone, PhoneMissed,
  MessageSquare, AlertTriangle, RefreshCw, Send, PhoneIncoming, PhoneOutgoing,
} from "lucide-react";
import { AgentShell, api, fmtD, fmtDT, useAgentInfo, useFragen } from "./shared";
import { useOffice } from "./OfficeShell";
import "@/styles/office-inbox.css";

// ── Typen ──────────────────────────────────────────────────────────────────
interface Treffer { personId: number | null; name: string; email: string; extern: boolean }
interface Gruppe { schluessel: string; titel: string; anzahl: number }
interface Baustein { marke: string; titel: string; erklaerung: string }
type Meldung = { art: "gut" | "schlecht"; text: string } | null;

interface KundenZeile {
  personId: number; name: string; email: string | null;
  telefon: string | null; telefonWaehlbar: string | null; telefonHinweis: string | null;
  letzteAktivitaet: string | null; offenGesamt: number;
  anliegenOffen: number; anliegenBetreff: string | null; anliegenAm: string | null;
  anrufeVerpasst: number; anrufAm: string | null;
  rueckrufeOffen: number; rueckrufFrist: string | null;
  postKaputt: number; postKaputtAm: string | null;
  postAm: string | null; postTitel: string | null; postBetreff: string | null;
  postVonMir: boolean; postAutomatik: boolean;
}
interface Zahlen { kunden: number; kundenOffen: number; anliegen: number; anrufe: number; rueckrufe: number; postKaputt: number; zuBeantworten: number; neu24: number }

const MAIL_RE = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;
const FILTER: { schluessel: string; titel: string }[] = [
  { schluessel: "offen", titel: "Zu beantworten" },
  { schluessel: "aktivitaet", titel: "Bewegung" },
  { schluessel: "alle", titel: "Alle meine Kunden" },
];

/** „vor 2 Std" statt eines Zeitstempels — morgens zählt der Abstand, nicht die Uhrzeit. */
function seit(v: string | null | undefined): string {
  if (!v) return "";
  const ms = Date.now() - new Date(v).getTime();
  if (!Number.isFinite(ms)) return "";
  const min = Math.floor(ms / 60000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min`;
  const std = Math.floor(min / 60);
  if (std < 24) return `vor ${std} Std`;
  const tage = Math.floor(std / 24);
  if (tage === 1) return "gestern";
  if (tage < 30) return `vor ${tage} Tagen`;
  return fmtD(v);
}
/** Anruf ans Softphone geben — dasselbe Ereignis wie im Kalender und im Bestand. */
const anrufen = (nummer: string | null, personId: number | null, name: string) => {
  if (!nummer) return;
  window.dispatchEvent(new CustomEvent("fiaon-anrufen", { detail: { nummer, personId, name } }));
};

export default function AgentInboxPage() { return <AgentShell><InboxInnen /></AgentShell>; }

// ───────────────────────────────────────────────────────────────────────────
// Der Raum
// ───────────────────────────────────────────────────────────────────────────
function InboxInnen() {
  const { dunkel, titel } = useOffice();
  useEffect(() => { dunkel(true); titel("Inbox"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const { agent } = useAgentInfo();
  const alsAdmin = typeof window !== "undefined" && window.location.pathname.startsWith("/admin/");
  const basis = alsAdmin ? "/api/fiaon/admin/mail/zentrale" : "/api/fiaon/mail/zentrale";

  const [filter, setFilter] = useState("offen");
  const [suche, setSuche] = useState("");
  const [tage, setTage] = useState(30);
  const [seite, setSeite] = useState(0);
  const [zeilen, setZeilen] = useState<KundenZeile[] | null>(null);
  const [zahlen, setZahlen] = useState<Zahlen | null>(null);
  const [mehr, setMehr] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [stand, setStand] = useState(0);           // Zähler: erzwingt ein Neuladen
  const [offenerKunde, setOffenerKunde] = useState<{ personId: number; name: string } | null>(null);
  const [schreibenAn, setSchreibenAn] = useState<Treffer | null | undefined>(undefined); // undefined = zu

  useEffect(() => {
    let abgelegt = false;
    setLaeuft(true);
    const t = setTimeout(() => {
      api(`/agent/inbox/uebersicht?filter=${filter}&tage=${tage}&seite=${seite}&suche=${encodeURIComponent(suche)}`)
        .then((r) => {
          if (abgelegt) return;
          setLaeuft(false);
          if (!r.ok) { setFehler(r.json?.error || "Der Posteingang konnte nicht geladen werden."); setZeilen([]); return; }
          setFehler(null); setZahlen(r.json.zahlen); setMehr(!!r.json.mehr);
          // Beim Blättern anhängen, sonst ersetzen. Wichtig: NUR bei einer
          // echten Seitenzahl > 0 — sonst standen nach dem Senden doppelte
          // Zeilen in der Liste (Fehler der alten Fassung).
          setZeilen((alt) => (seite > 0 && alt ? [...alt, ...(r.json.kunden as KundenZeile[])] : r.json.kunden));
        })
        .catch(() => { if (abgelegt) return; setLaeuft(false); setFehler("Keine Verbindung zum Server."); setZeilen([]); });
    }, 180);
    return () => { abgelegt = true; clearTimeout(t); };
  }, [filter, suche, tage, seite, stand]);

  const neuLaden = useCallback(() => { setSeite(0); setStand((n) => n + 1); }, []);
  const wechsle = (s: string) => { setFilter(s); setSeite(0); setZeilen(null); };

  const keinBestand = zahlen != null && zahlen.kunden === 0;

  return (
    <div className="in">
      <section className="in-kopf">
        <div>
          <span className="in-pille">Inbox · {agent?.name?.split(" ")[0] || "Posteingang"}</span>
          <h1>Was seit gestern <span className="in-verlauf">hereinkam</span>.</h1>
          <p>
            Eine Karte je Kunde, das Neueste zuerst: Anliegen aus dem Kundenbereich, verpasste Anrufe,
            Rückruf-Wünsche, Post, die nicht ankam. Nur deine Kunden – wer dir nicht zugeteilt ist,
            erscheint hier nicht.
          </p>
        </div>
        <button type="button" className="in-knopf" onClick={() => setSchreibenAn(null)}>
          <PenLine size={16} strokeWidth={1.75} /> Neue Mail
        </button>
      </section>

      <section className="in-zahlen">
        <div className="in-zahl hervor">
          <small>Zu beantworten</small>
          <b>{zahlen ? zahlen.zuBeantworten : "–"}</b>
          <span>
            {zahlen && zahlen.zuBeantworten > 0 ? `bei ${zahlen.kundenOffen} ${zahlen.kundenOffen === 1 ? "Kunde" : "Kunden"} · ` : ""}
            {zahlen
              ? [zahlen.anliegen ? `${zahlen.anliegen} Anliegen` : null,
                 zahlen.anrufe ? `${zahlen.anrufe} verpasste Anrufe` : null,
                 zahlen.rueckrufe ? `${zahlen.rueckrufe} Rückrufe` : null,
                 zahlen.postKaputt ? `${zahlen.postKaputt} Mails kamen nicht an` : null]
                .filter(Boolean).join(" · ") || "Nichts offen. Guter Morgen."
              : "wird gezählt …"}
          </span>
        </div>
        <div className="in-zahl">
          <small>Neu in 24 Std</small>
          <b>{zahlen ? zahlen.neu24 : "–"}</b>
          <span>Kunden mit Bewegung seit gestern</span>
        </div>
        <div className="in-zahl">
          <small>Meine Kunden</small>
          <b>{zahlen ? zahlen.kunden : "–"}</b>
          <span>alle, die dir zugeteilt sind</span>
        </div>
      </section>

      <div className="in-leiste">
        <div className="in-wahl">
          {FILTER.map((f) => (
            <button key={f.schluessel} type="button" className={filter === f.schluessel ? "an" : ""} onClick={() => wechsle(f.schluessel)}>
              {f.titel}
              {/* Die Marke zählt KARTEN, nicht Vorgänge – sonst stünde „52" über einer Liste mit 19 Zeilen. */}
              {f.schluessel === "offen" && zahlen && zahlen.kundenOffen > 0 && <em>{zahlen.kundenOffen}</em>}
              {f.schluessel === "alle" && zahlen && <em>{zahlen.kunden}</em>}
            </button>
          ))}
        </div>
        <label className="in-suchfeld">
          <Search size={15} strokeWidth={1.75} />
          <input className="in-feld" value={suche} onChange={(e) => { setSuche(e.target.value); setSeite(0); }}
            placeholder="Name, E-Mail oder Telefonnummer …" aria-label="Meine Kunden durchsuchen" />
        </label>
        <div className="in-wahl">
          {[[7, "7 Tage"], [30, "30 Tage"], [90, "90 Tage"]].map(([n, l]) => (
            <button key={String(n)} type="button" className={tage === n ? "an" : ""} onClick={() => { setTage(n as number); setSeite(0); }}>{l}</button>
          ))}
        </div>
        <button type="button" className="in-knopf still klein" onClick={neuLaden} disabled={laeuft} aria-label="Neu laden">
          <RefreshCw size={14} strokeWidth={1.75} /> {laeuft ? "…" : "Aktualisieren"}
        </button>
      </div>

      {fehler && <p className="in-fehler">{fehler} <button type="button" className="in-link" onClick={neuLaden}>Erneut versuchen</button></p>}
      {zeilen === null && !fehler && <p className="in-laedt">Posteingang wird geladen …</p>}

      {zeilen && zeilen.length === 0 && !fehler && (
        <div className="in-leer-karte">
          {keinBestand ? (
            <>
              <b>Dir ist noch kein Kunde zugeteilt.</b>
              <p className="in-hinweis">Solange kein Kunde auf dich eingetragen ist, bleibt der Posteingang leer – das ist kein Fehler. Die Zuteilung macht die Vertriebsleitung.</p>
            </>
          ) : filter === "offen" ? (
            <>
              <b>Nichts offen. Alles beantwortet.</b>
              <p className="in-hinweis">Kein Anliegen, kein verpasster Anruf, kein Rückruf und keine unzustellbare Post{suche ? " zu dieser Suche" : ""}. Schau unter „Bewegung“, was zuletzt passiert ist.</p>
              <button type="button" className="in-knopf still klein" onClick={() => wechsle("aktivitaet")}>Bewegung ansehen</button>
            </>
          ) : (
            <>
              <b>Hier steht nichts.</b>
              <p className="in-hinweis">{suche ? "Zu dieser Suche gibt es in deinem Bestand keinen Treffer." : `In den letzten ${tage} Tagen gab es bei deinen Kunden keine Bewegung.`}</p>
            </>
          )}
        </div>
      )}

      <div className="in-liste">
        {zeilen?.map((k) => (
          <KundenKarte key={k.personId} k={k} onOeffnen={() => setOffenerKunde({ personId: k.personId, name: k.name })} />
        ))}
      </div>
      {mehr && <button type="button" className="in-knopf still" onClick={() => setSeite((s) => s + 1)} disabled={laeuft}>{laeuft ? "…" : "Weitere laden"}</button>}

      {offenerKunde && (
        <KundenLade
          personId={offenerKunde.personId}
          nameVorab={offenerKunde.name}
          rolle={agent?.rolle}
          onZu={() => setOffenerKunde(null)}
          onGeaendert={neuLaden}
          onSchreiben={(t) => { setOffenerKunde(null); setSchreibenAn(t); }}
        />
      )}

      {schreibenAn !== undefined && (
        <SchreibenLade basis={basis} vorbelegt={schreibenAn} onZu={() => setSchreibenAn(undefined)} onGesendet={neuLaden} />
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Eine Karte je Kunde
//
// Rangordnung: Ist etwas offen, trägt „Antworten" die Farbe; ist nichts offen,
// ist die Karte ruhig. Keine Reihe gleich lauter Kästen.
// ───────────────────────────────────────────────────────────────────────────
function KundenKarte({ k, onOeffnen }: { k: KundenZeile; onOeffnen: () => void }) {
  const marken: { art: string; text: string }[] = [];
  if (k.anliegenOffen > 0) marken.push({ art: "rot", text: k.anliegenOffen === 1 ? "1 Anliegen offen" : `${k.anliegenOffen} Anliegen offen` });
  if (k.anrufeVerpasst > 0) marken.push({ art: "bernstein", text: k.anrufeVerpasst === 1 ? "Anruf verpasst" : `${k.anrufeVerpasst} Anrufe verpasst` });
  if (k.rueckrufeOffen > 0) marken.push({ art: "bernstein", text: k.rueckrufFrist ? `Rückruf bis ${fmtDT(k.rueckrufFrist)}` : "Rückruf offen" });
  if (k.postKaputt > 0) marken.push({ art: "bernstein", text: k.postKaputt === 1 ? "Mail kam nicht an" : `${k.postKaputt} Mails kamen nicht an` });
  if (marken.length === 0 && k.postAm) marken.push({ art: "leise", text: k.postAutomatik ? "Automatik hat geschrieben" : k.postVonMir ? "von dir verschickt" : "Kollege hat geschrieben" });

  // Der Satz sagt, was zuletzt passiert ist – in Worten, nicht in Feldnamen.
  const satz = k.anliegenOffen > 0 && k.anliegenBetreff ? `Anliegen: ${k.anliegenBetreff}`
    : k.anrufeVerpasst > 0 ? "Hat angerufen und niemanden erreicht."
    : k.rueckrufeOffen > 0 ? "Rückruf zugesagt – noch nicht erledigt."
    : k.postKaputt > 0 ? "Post kommt bei dieser Adresse nicht an."
    : k.postTitel ? `${k.postTitel}${k.postBetreff ? ` – ${k.postBetreff}` : ""}`
    : "Keine Bewegung im gewählten Zeitraum.";

  return (
    <article className={`in-karte${k.offenGesamt > 0 ? " dran" : ""}`}>
      <button type="button" className="in-karte-kern" onClick={onOeffnen}>
        <span className="in-karte-kopf">
          <b>{k.name}</b>
          <em>{seit(k.letzteAktivitaet)}</em>
        </span>
        <span className="in-karte-satz">{satz}</span>
        {marken.length > 0 && (
          <span className="in-marken">
            {marken.map((m, i) => <span key={i} className={`in-marke ${m.art}`}>{m.text}</span>)}
          </span>
        )}
        <span className="in-karte-leise">{[k.email, k.telefon].filter(Boolean).join(" · ") || "Keine Kontaktdaten hinterlegt."}</span>
      </button>
      <div className="in-karte-tun">
        <button type="button" className={`in-knopf klein${k.offenGesamt > 0 ? "" : " still"}`} onClick={onOeffnen}>
          <MessageSquare size={14} strokeWidth={1.75} /> {k.offenGesamt > 0 ? "Antworten" : "Öffnen"}
        </button>
        {k.telefonWaehlbar && (
          <button type="button" className="in-knopf still klein" onClick={() => anrufen(k.telefonWaehlbar, k.personId, k.name)}>
            <Phone size={14} strokeWidth={1.75} /> Anrufen
          </button>
        )}
        <Link href={`/agent/kunden?person=${k.personId}`} className="in-knopf still klein"><FolderOpen size={14} strokeWidth={1.75} /> Akte</Link>
      </div>
    </article>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Die Lade: ein Kunde, alles was ihn betrifft
// ───────────────────────────────────────────────────────────────────────────
interface KundenDaten {
  kunde: { personId: number; name: string; email: string | null; telefon: string | null; telefonWaehlbar: string | null; telefonHinweis: string | null; ref: string | null; betreutSeit: string | null };
  anliegen: { id: number; betreff: string; text: string; status: string; antwort: string | null; beantwortetAm: string | null; am: string }[];
  anrufe: { id: number; richtung: string; status: string; am: string | null; dauer: number; ergebnis: string | null; notiz: string | null; nummer: string | null }[];
  rueckrufe: { id: number; anliegen: string; kontakt: string | null; quelle: string; fristBis: string | null; erledigtAm: string | null; notiz: string | null; am: string }[];
  post: { id: number; titel: string; betreff: string | null; status: string; grund: string | null; zustellung: string | null; empfaenger: string | null; am: string; von: string; vonMir: boolean }[];
  zustellText: Record<string, string>;
}

function KundenLade({ personId, nameVorab, rolle, onZu, onGeaendert, onSchreiben }: {
  personId: number; nameVorab: string; rolle?: string;
  onZu: () => void; onGeaendert: () => void; onSchreiben: (t: Treffer) => void;
}) {
  const [daten, setDaten] = useState<KundenDaten | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<Meldung>(null);

  const laden = useCallback(async () => {
    setFehler(null);
    const r = await api(`/agent/inbox/kunde/${personId}`);
    if (!r.ok) { setFehler(r.json?.error || (r.status === 404 ? "Diesen Kunden gibt es nicht in deinem Bestand." : "Der Kunde konnte nicht geladen werden.")); return; }
    setDaten(r.json as KundenDaten);
  }, [personId]);
  useEffect(() => { void laden(); }, [laden]);

  // Escape schließt, der Hintergrund scrollt nicht mit.
  const zuRef = useRef(onZu); zuRef.current = onZu;
  useEffect(() => {
    const zu = (e: KeyboardEvent) => { if (e.key === "Escape") zuRef.current(); };
    window.addEventListener("keydown", zu);
    const r = document.getElementById("root"); const vorher = r?.style.overflow ?? ""; if (r) r.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", zu); if (r) r.style.overflow = vorher; };
  }, []);

  const k = daten?.kunde;
  const name = k?.name || nameVorab;
  const offeneAnliegen = (daten?.anliegen || []).filter((a) => a.status === "offen");
  const offeneRueckrufe = (daten?.rueckrufe || []).filter((r) => !r.erledigtAm);

  return (
    <>
      <div className="in-lade-hintergrund" onClick={onZu} role="presentation" />
      <aside className="in-lade" role="dialog" aria-modal="true" aria-label={`Posteingang von ${name}`}>
        <div className="in-lade-kopf">
          <div style={{ minWidth: 0 }}>
            <span className="ueber">Kunde</span>
            <h2>{name}</h2>
            <span className="unter">
              {[k?.email, k?.telefon, k?.ref, k?.betreutSeit ? `betreut seit ${fmtD(k.betreutSeit)}` : null].filter(Boolean).join(" · ") || "Wird geladen …"}
            </span>
          </div>
          <button type="button" className="in-lade-zu" onClick={onZu} aria-label="Schließen"><X size={18} /></button>
        </div>

        <div className="in-lade-tun">
          {/* Solange nichts geladen ist, steht hier NICHT „Keine Nummer" — das
              wäre eine Behauptung über etwas, das noch niemand nachgesehen hat. */}
          {k?.telefonWaehlbar
            ? <button type="button" className="in-knopf klein" onClick={() => anrufen(k.telefonWaehlbar, personId, name)}><Phone size={14} strokeWidth={1.75} /> Anrufen</button>
            : <button type="button" className="in-knopf klein still" disabled title={k?.telefonHinweis || "Keine wählbare Nummer hinterlegt."}><Phone size={14} strokeWidth={1.75} /> {daten ? "Keine Nummer" : "Anrufen"}</button>}
          <button type="button" className="in-knopf still klein" disabled={!k?.email}
            onClick={() => k?.email && onSchreiben({ personId, name, email: k.email, extern: false })}>
            <PenLine size={14} strokeWidth={1.75} /> Mail schreiben
          </button>
          {rolle !== "inkasso" && <Link href={`/agent/kunden?person=${personId}`} className="in-knopf still klein"><FolderOpen size={14} strokeWidth={1.75} /> Akte öffnen</Link>}
        </div>

        <div className="in-lade-koerper">
          {fehler && <p className="in-fehler">{fehler} <button type="button" className="in-link" onClick={() => void laden()}>Erneut</button></p>}
          {meldung && <p className={`in-meldung ${meldung.art === "schlecht" ? "schlecht" : ""}`}>{meldung.text}</p>}
          {!daten && !fehler && <p className="in-laedt">Anliegen, Anrufe und Post werden geladen …</p>}

          {daten && (
            <>
              {offeneAnliegen.length > 0 && (
                <section className="in-abschnitt">
                  <p className="titel">Zu beantworten</p>
                  {offeneAnliegen.map((a) => (
                    <Anliegen key={a.id} a={a} onFertig={(text) => { setMeldung({ art: "gut", text }); void laden(); onGeaendert(); }}
                      onFehler={(text) => setMeldung({ art: "schlecht", text })} />
                  ))}
                </section>
              )}

              {offeneRueckrufe.length > 0 && (
                <section className="in-abschnitt">
                  <p className="titel">Rückruf-Wünsche</p>
                  {offeneRueckrufe.map((r) => (
                    <div key={r.id} className="in-block dringend">
                      <div className="kopf">
                        <b>Rückruf {r.fristBis ? `bis ${fmtDT(r.fristBis)}` : "offen"}</b>
                        <em>{seit(r.am)}</em>
                      </div>
                      <p className="text">{r.anliegen}</p>
                      <p className="in-hinweis">Aufgenommen über {r.quelle}{r.kontakt ? ` · erreichbar unter ${r.kontakt}` : ""}. Abgehakt wird der Rückruf im Aufgaben-Raum, sobald du das Ergebnis notierst.</p>
                      {k?.telefonWaehlbar && (
                        <div className="tun">
                          <button type="button" className="in-knopf klein" onClick={() => anrufen(k.telefonWaehlbar, personId, name)}><Phone size={14} strokeWidth={1.75} /> Jetzt zurückrufen</button>
                        </div>
                      )}
                    </div>
                  ))}
                </section>
              )}

              <Vorlagen personId={personId} name={name} onGesendet={(text, gut) => { setMeldung({ art: gut ? "gut" : "schlecht", text }); void laden(); onGeaendert(); }} />

              {daten.anrufe.length > 0 && (
                <section className="in-abschnitt">
                  <p className="titel">Anrufe</p>
                  <div>
                    {daten.anrufe.map((c) => {
                      const rein = c.richtung === "eingehend";
                      const verpasst = rein && c.status === "verpasst";
                      return (
                        <div key={c.id} className="in-zeile">
                          <i style={verpasst ? { color: "#fbbf24" } : undefined}>
                            {verpasst ? <PhoneMissed size={15} strokeWidth={1.75} /> : rein ? <PhoneIncoming size={15} strokeWidth={1.75} /> : <PhoneOutgoing size={15} strokeWidth={1.75} />}
                          </i>
                          <b>{verpasst ? "Angerufen, nicht erreicht" : rein ? "Eingehendes Gespräch" : "Ausgehender Anruf"}</b>
                          <em>{c.am ? fmtDT(c.am) : "ohne Zeit"}</em>
                          <small className={verpasst ? "schlecht" : ""}>
                            {[c.nummer, c.dauer > 0 ? `${Math.round(c.dauer / 60)} Min` : null, c.ergebnis, c.notiz].filter(Boolean).join(" · ") || c.status}
                          </small>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              <section className="in-abschnitt">
                <p className="titel">Post an diesen Kunden</p>
                {daten.post.length === 0 && <p className="in-leer">An diesen Kunden ging noch nichts raus.</p>}
                <div>
                  {daten.post.map((p) => {
                    const kaputt = ["gebounct", "blockiert", "spam", "fehler"].includes(String(p.zustellung));
                    const nichtRaus = p.status !== "versandt";
                    const stand = nichtRaus ? `nicht verschickt${p.grund ? ` – ${p.grund}` : ""}`
                      : p.zustellung ? (daten.zustellText?.[p.zustellung] ?? p.zustellung) : "versandt";
                    return (
                      <div key={p.id} className="in-zeile">
                        <i style={kaputt || nichtRaus ? { color: "#fbbf24" } : undefined}>
                          {kaputt || nichtRaus ? <AlertTriangle size={15} strokeWidth={1.75} /> : <Mail size={15} strokeWidth={1.75} />}
                        </i>
                        <b>{p.betreff || p.titel}</b>
                        <em>{fmtDT(p.am)}</em>
                        <small className={kaputt || nichtRaus ? "schlecht" : p.zustellung === "geoeffnet" || p.zustellung === "geklickt" ? "gut" : ""}>
                          {p.titel} · {stand} · {p.vonMir ? "von dir" : p.von}{p.empfaenger ? ` · ${p.empfaenger}` : ""}
                        </small>
                      </div>
                    );
                  })}
                </div>
                {daten.post.some((p) => ["gebounct", "blockiert", "spam", "fehler"].includes(String(p.zustellung))) && (
                  <p className="in-hinweis">
                    Kommt Post nicht an, hilft kein zweiter Versand: Die Adresse muss in der Akte berichtigt werden – oder du rufst an und fragst nach der richtigen.
                  </p>
                )}
              </section>

              {daten.anliegen.filter((a) => a.status !== "offen").length > 0 && (
                <section className="in-abschnitt">
                  <p className="titel">Frühere Anliegen</p>
                  {daten.anliegen.filter((a) => a.status !== "offen").map((a) => (
                    <div key={a.id} className="in-block">
                      <div className="kopf"><b>{a.betreff}</b><em>{fmtDT(a.am)}</em></div>
                      <p className="text">{a.text}</p>
                      {a.antwort && <p className="antwort">Antwort{a.beantwortetAm ? ` vom ${fmtDT(a.beantwortetAm)}` : ""}: {a.antwort}</p>}
                    </div>
                  ))}
                </section>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
}

// ── Ein offenes Anliegen beantworten ───────────────────────────────────────
function Anliegen({ a, onFertig, onFehler }: {
  a: { id: number; betreff: string; text: string; am: string };
  onFertig: (text: string) => void; onFehler: (text: string) => void;
}) {
  const [antwort, setAntwort] = useState("");
  const [erledigt, setErledigt] = useState(true);
  const [busy, setBusy] = useState(false);

  const senden = async () => {
    if (antwort.trim().length < 2) { onFehler("Schreib zuerst eine Antwort."); return; }
    setBusy(true);
    const r = await api(`/agent/tickets/${a.id}/antwort`, { method: "POST", body: JSON.stringify({ antwort: antwort.trim(), erledigt }) });
    setBusy(false);
    if (!r.ok) { onFehler(r.json?.error || "Die Antwort konnte nicht gespeichert werden."); return; }
    // Dieselbe Meldung wie im Raum „Tickets" — sonst bliebe die Marke in der
    // Seitenleiste stehen, obwohl das Anliegen erledigt ist.
    window.dispatchEvent(new Event("agent-anliegen-geaendert"));
    setAntwort("");
    onFertig(erledigt ? "Antwort gespeichert und das Anliegen ist erledigt. Der Kunde sieht sie in seinem Bereich." : "Antwort gespeichert. Das Anliegen bleibt offen.");
  };

  return (
    <div className="in-block dringend">
      <div className="kopf"><b>{a.betreff}</b><em>{seit(a.am)}</em></div>
      <p className="text">{a.text}</p>
      <textarea className="in-feld" rows={4} value={antwort} onChange={(e) => setAntwort(e.target.value)}
        placeholder="Antwort an den Kunden – er liest sie in seinem Kundenbereich." aria-label="Antwort" />
      <div className="tun">
        <button type="button" className="in-knopf klein" disabled={busy || antwort.trim().length < 2} onClick={() => void senden()}>
          <Send size={14} strokeWidth={1.75} /> {busy ? "…" : "Antwort senden"}
        </button>
        <label className="in-hinweis" style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44, cursor: "pointer" }}>
          <input type="checkbox" checked={erledigt} onChange={(e) => setErledigt(e.target.checked)} style={{ width: 18, height: 18, accentColor: "#2563eb" }} />
          und damit erledigt
        </label>
      </div>
      <p className="in-hinweis">Die Antwort steht danach auch im Verlauf der Akte – der nächste Kollege findet sie dort.</p>
    </div>
  );
}

// ── Standardmails an diesen Kunden (bestehende Registry) ───────────────────
//
// VORHER standen hier ALLE Vorlagen, auch die gesperrten, jede mit ihrem Grund
// („heute schon dreimal", „Zahlung fehlt") — vierzehn Kästen, von denen die
// meisten nichts taten. NACHHER (24.08.2026) zeigt die Lade nur, was jetzt
// wirklich geht, und erst auf Klick: Im Posteingang will jemand antworten,
// nicht ein Menü studieren. Die vollständige Liste samt Sperrgründen steht
// weiter in der Akte, wo man sie sucht, wenn man sie braucht.
function Vorlagen({ personId, name, onGesendet }: { personId: number; name: string; onGesendet: (text: string, gut: boolean) => void }) {
  const fragen = useFragen();
  const [events, setEvents] = useState<any[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [offen, setOffen] = useState(false);

  useEffect(() => {
    let weg = false;
    fetch(`/api/fiaon/agent/mail/${personId}`, { credentials: "include" })
      .then((r) => r.json()).then((j) => { if (!weg) setEvents(j?.ok ? (j.events || []).filter((e: any) => e.erlaubt) : []); })
      .catch(() => { if (!weg) setEvents([]); });
    return () => { weg = true; };
  }, [personId]);

  const senden = async (e: any) => {
    if (!(await fragen({ titel: `„${e.label}“ jetzt an ${name} schicken?`, text: e.klartext, ja: "Senden" }))) return;
    setBusy(e.type);
    const r = await api(`/agent/mail/${personId}/${e.type}`, { method: "POST", body: "{}" });
    setBusy(null);
    onGesendet(r.json?.meldung || r.json?.error || (r.ok ? "Verschickt." : "Unbekannter Fehler."), !!r.ok);
  };

  if (events === null || events.length === 0) return null;
  return (
    <section className="in-abschnitt">
      <p className="titel">Standardmail senden</p>
      {!offen ? (
        <button type="button" className="in-knopf still klein" onClick={() => setOffen(true)} style={{ justifySelf: "start" }}>
          <Mail size={14} strokeWidth={1.75} /> {events.length} Vorlagen anzeigen
        </button>
      ) : (
        <div className="in-block">
          {events.map((e: any) => (
            <div key={e.type} className="in-vorlage">
              <div>
                <b>{e.label}</b>
                <p className="in-hinweis" style={{ marginTop: 3 }}>{e.klartext}{e.heute > 0 ? ` · heute schon ${e.heute}×` : ""}</p>
              </div>
              <button type="button" className="in-knopf still klein" disabled={busy === e.type} onClick={() => void senden(e)}>{busy === e.type ? "…" : "Senden"}</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Die Lade zum Schreiben — die Mail-Zentrale, in der Funktion unverändert
// ───────────────────────────────────────────────────────────────────────────
function SchreibenLade({ basis, vorbelegt, onZu, onGesendet }: { basis: string; vorbelegt: Treffer | null; onZu: () => void; onGesendet: () => void }) {
  const zuRef = useRef(onZu); zuRef.current = onZu;
  useEffect(() => {
    const zu = (e: KeyboardEvent) => { if (e.key === "Escape") zuRef.current(); };
    window.addEventListener("keydown", zu);
    const r = document.getElementById("root"); const vorher = r?.style.overflow ?? ""; if (r) r.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", zu); if (r) r.style.overflow = vorher; };
  }, []);
  return (
    <>
      <div className="in-lade-hintergrund" onClick={onZu} role="presentation" />
      <aside className="in-lade" role="dialog" aria-modal="true" aria-label="Neue Mail">
        <div className="in-lade-kopf">
          <div style={{ minWidth: 0 }}>
            <span className="ueber">Mail-Zentrale</span>
            <h2>Neue Mail</h2>
            <span className="unter">Bausteine füllt der Server je Empfänger einzeln – jeder bekommt seine eigenen Daten.</span>
          </div>
          <button type="button" className="in-lade-zu" onClick={onZu} aria-label="Schließen"><X size={18} /></button>
        </div>
        <div className="in-lade-koerper">
          <Schreiben basis={basis} vorbelegt={vorbelegt} onGesendet={onGesendet} />
        </div>
      </aside>
    </>
  );
}

function Schreiben({ basis, vorbelegt, onGesendet }: { basis: string; vorbelegt: Treffer | null; onGesendet: () => void }) {
  const [suche, setSuche] = useState("");
  const [treffer, setTreffer] = useState<Treffer[]>([]);
  const [gewaehlt, setGewaehlt] = useState<Treffer[]>(vorbelegt ? [vorbelegt] : []);
  const [gruppen, setGruppen] = useState<Gruppe[]>([]);
  const [aktiveGruppen, setAktiveGruppen] = useState<string[]>([]);
  const [bausteine, setBausteine] = useState<Baustein[]>([]);
  const [maxEmpfaenger, setMaxEmpfaenger] = useState(10);
  const [betreff, setBetreff] = useState("");
  const [text, setText] = useState("");
  const [vorschau, setVorschau] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<Meldung>(null);
  const [gruppenWahl, setGruppenWahl] = useState(false);
  const [ergebnis, setErgebnis] = useState<any>(null);
  const [kiFehler, setKiFehler] = useState<string | null>(null);
  const [zurueck, setZurueck] = useState<{ betreff: string; text: string } | null>(null);
  const [eingefuegt, setEingefuegt] = useState(false);
  const [feldHinweis, setFeldHinweis] = useState<string | null>(null);
  const feld = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch(`${basis}/gruppen`, { credentials: "include" }).then((r) => r.json()).then((j) => {
      if (!j?.ok) { setFeldHinweis(j?.error || "Gruppen und Textbausteine konnten nicht geladen werden. Bitte die Seite neu laden."); return; }
      setGruppen(j.gruppen || []); setBausteine(j.bausteine || []); setMaxEmpfaenger(j.maxEmpfaenger || 10);
    }).catch(() => {});
  }, [basis]);
  // Autocomplete ab dem ersten Zeichen.
  useEffect(() => {
    if (suche.trim().length < 1) { setTreffer([]); return; }
    const t = setTimeout(() => { fetch(`${basis}/suche?q=${encodeURIComponent(suche)}`, { credentials: "include" }).then((r) => r.json()).then((j) => setTreffer(j?.ok ? j.treffer : [])).catch(() => {}); }, 180);
    return () => clearTimeout(t);
  }, [suche, basis]);

  const auswahl = useCallback(() => ({ personIds: gewaehlt.filter((g) => g.personId).map((g) => g.personId!), gruppen: aktiveGruppen, extern: gewaehlt.filter((g) => g.extern && !g.personId).map((g) => g.email) }), [gewaehlt, aktiveGruppen]);
  const gewaehltGesamt = useMemo(
    () => gewaehlt.length + aktiveGruppen.reduce((s, g) => s + (gruppen.find((x) => x.schluessel === g)?.anzahl ?? 0), 0),
    [gewaehlt, aktiveGruppen, gruppen],
  );

  const bausteinEinfuegen = (marke: string) => {
    const el = feld.current; if (!el) { setText((t) => `${t}${marke}`); return; }
    const a = el.selectionStart ?? text.length; setText(`${text.slice(0, a)}${marke}${text.slice(el.selectionEnd ?? a)}`);
    setTimeout(() => { el.focus(); el.setSelectionRange(a + marke.length, a + marke.length); }, 0);
  };
  // Getippte Adresse als Chip übernehmen (Enter, Komma, Verlassen, Senden).
  const adresseUebernehmen = (still = false): boolean => {
    const wert = suche.trim().replace(/[,;]+$/, ""); if (!wert) return true;
    if (!MAIL_RE.test(wert)) {
      if (!still || wert.includes("@")) setFeldHinweis(wert.includes("@") ? `„${wert}“ ist keine vollständige E-Mail-Adresse. Es fehlt etwas nach dem Punkt.` : `„${wert}“ ist weder ein Treffer noch eine E-Mail-Adresse. Wähle einen Kunden aus der Liste oder tippe eine vollständige Adresse.`);
      return false;
    }
    setGewaehlt((l) => l.some((x) => x.email.toLowerCase() === wert.toLowerCase()) ? l : [...l, { personId: null, email: wert, name: wert, extern: true }]);
    setSuche(""); setTreffer([]); setFeldHinweis(null); return true;
  };
  const vorschauHolen = async () => {
    if (!adresseUebernehmen()) return;
    setBusy("vorschau");
    const r = await fetch(`${basis}/vorschau`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auswahl(), betreff, text }) }).catch(() => null);
    const j = await r?.json().catch(() => null); setBusy(null);
    if (!j?.ok) { setMeldung({ art: "schlecht", text: j?.error || "Vorschau nicht möglich." }); return; }
    setVorschau(j);
  };
  const senden = async () => {
    setBusy("senden");
    const r = await fetch(`${basis}/senden`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auswahl(), betreff, text, merkmal: vorschau?.merkmal }) }).catch(() => null);
    const j = await r?.json().catch(() => null); setBusy(null);
    setMeldung({ art: j?.ok && !j?.fehlgeschlagen ? "gut" : "schlecht", text: j?.meldung || j?.error || "Unbekannter Fehler." });
    setErgebnis(j?.ergebnisse?.length ? j : null);
    if (j?.ok) { setVorschau(null); setText(""); setBetreff(""); setGewaehlt([]); setAktiveGruppen([]); onGesendet(); }
  };
  const test = async () => {
    setBusy("test");
    const r = await fetch(`${basis}/test`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ betreff, text }) }).catch(() => null);
    const j = await r?.json().catch(() => null); setBusy(null);
    setMeldung({ art: j?.ok ? "gut" : "schlecht", text: j?.meldung || j?.error || "Fehler." });
  };
  const ki = async (art: string) => {
    setBusy(`ki-${art}`); setKiFehler(null); const vorher = { betreff, text };
    const r = await fetch(`${basis}/ki`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ art, eingabe: text }) }).catch(() => null);
    const j = await r?.json().catch(() => null); setBusy(null);
    if (!j?.ok) { setKiFehler(j?.grund || j?.error || "Die KI war nicht erreichbar. Prüfe die Verbindung und versuche es erneut."); return; }
    setZurueck(vorher); setText(j.text); if (j.betreff && !betreff.trim()) setBetreff(j.betreff);
    setEingefuegt(true); window.setTimeout(() => setEingefuegt(false), 1400);
    setMeldung({ art: "gut", text: (j.entfernt?.length ?? 0) > 0 ? `Vorschlag steht im Feld. Entschärft wurde: ${j.entfernt.join(", ")} – solche Zusagen dürfen nicht an Kunden.` : "Vorschlag steht im Feld. Bitte lies ihn, bevor du sendest." });
  };

  return (
    <>
      {meldung && <p className={`in-meldung ${meldung.art === "schlecht" ? "schlecht" : ""}`}>{meldung.text}</p>}
      {ergebnis && ergebnis.ergebnisse?.length > 0 && <ErgebnisKarte ergebnis={ergebnis} onZu={() => setErgebnis(null)} />}

      <div className="in-zeilen">
        <div className="in-abschnitt">
          <p className="titel">Empfänger{gewaehltGesamt > 0 ? ` · ${gewaehltGesamt}` : ""}</p>
          {gewaehlt.length > 0 && (
            <div className="in-chips">{gewaehlt.map((g) => (
              <span key={g.email} className="in-chip">{g.name}{g.extern && <em>extern</em>}
                <button type="button" aria-label={`${g.name} entfernen`} onClick={() => setGewaehlt((l) => l.filter((x) => x.email !== g.email))}><X size={12} /></button>
              </span>
            ))}</div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <label className="in-suchfeld" style={{ flex: 1 }}>
              <Search size={15} strokeWidth={1.75} />
              <input className="in-feld" value={suche}
                onChange={(e) => { setSuche(e.target.value); setFeldHinweis(null); }}
                onKeyDown={(e) => { if (e.key !== "Enter" && e.key !== "," && e.key !== ";") return; e.preventDefault(); adresseUebernehmen(); }}
                onBlur={() => { if (suche.trim()) adresseUebernehmen(true); }}
                placeholder="Name, Kundennummer oder E-Mail eintippen …" aria-label="Empfänger suchen oder E-Mail eingeben" />
            </label>
            <button type="button" className="in-knopf still" onClick={() => setGruppenWahl(true)}>
              <Users size={15} strokeWidth={1.75} /> Gruppe{aktiveGruppen.length > 0 ? ` ${aktiveGruppen.length}` : ""}
            </button>
          </div>
          {treffer.length > 0 && (
            <div className="in-treffer">{treffer.slice(0, 8).map((t) => (
              <button key={t.email} type="button" onClick={() => { setGewaehlt((l) => l.some((x) => x.email === t.email) ? l : [...l, t]); setSuche(""); setTreffer([]); }}>{t.name}<span>{t.email}</span></button>
            ))}</div>
          )}
          {feldHinweis && <p className="in-feldhinweis">{feldHinweis}</p>}
          {!feldHinweis && suche.trim().length > 2 && treffer.length === 0 && (
            <p className="in-hinweis">{MAIL_RE.test(suche.trim()) ? "Passt – die Adresse wird übernommen, sobald du Enter drückst, das Feld verlässt oder auf „Vorschau & senden“ gehst." : "Kein Kunde gefunden. Eine vollständige E-Mail-Adresse kannst du mit Enter direkt übernehmen."}</p>
          )}
          <p className="in-hinweis">Testeinträge, DSGVO-Gelöschte und archivierte Datensätze sind immer ausgeschlossen.{maxEmpfaenger < 1000 && ` Deine Rolle darf an höchstens ${maxEmpfaenger} Empfänger senden.`}</p>
        </div>

        <input className={`in-feld${eingefuegt ? " eingefuegt" : ""}`} value={betreff} onChange={(e) => setBetreff(e.target.value)} placeholder="Betreff" aria-label="Betreff" />
        <textarea ref={feld} className={`in-feld${eingefuegt ? " eingefuegt" : ""}`} rows={9} value={text} onChange={(e) => setText(e.target.value)} placeholder="Guten Tag {Anrede}, wie besprochen: {Zahlungsdaten}" aria-label="Text" />
        {bausteine.length > 0 && <div className="in-bausteine">{bausteine.map((b) => <button key={b.marke} type="button" title={b.erklaerung} onClick={() => bausteinEinfuegen(b.marke)}>{b.titel}</button>)}</div>}
        {kiFehler && <div className="in-ki-fehler"><b>Der Entwurf ist nicht entstanden</b>{kiFehler}{/^Die KI antwortete mit HTTP 401/.test(kiFehler) && <p style={{ margin: "6px 0 0" }}>Das ist kein Fehler an deinem Text: Der hinterlegte OpenAI-Schlüssel wird abgelehnt. Der Vorgesetzte muss ihn erneuern – schreib solange von Hand.</p>}</div>}
        <div className="in-ki">
          {[{ art: "entwurf", titel: "Entwurf aus Stichpunkten" }, { art: "ton", titel: "Ton glätten" }, { art: "kuerzen", titel: "Kürzen" }].map((k) => (
            <button key={k.art} type="button" className="in-knopf still klein" disabled={!!busy || text.trim().length < 3} onClick={() => void ki(k.art)}>
              <Sparkles size={13} strokeWidth={1.75} /> {busy === `ki-${k.art}` ? "…" : k.titel}
            </button>
          ))}
          {zurueck && <button type="button" className="in-knopf still klein" onClick={() => { setBetreff(zurueck.betreff); setText(zurueck.text); setZurueck(null); }}>Rückgängig</button>}
        </div>
        <p className="in-hinweis">Die KI schlägt vor, du sendest. Zusagen zu Limits und das Wort „Beratung“ werden automatisch entfernt.</p>
      </div>

      <div className="in-senden">
        <button type="button" className="in-knopf still" disabled={!!busy || !betreff || !text} onClick={() => void test()}>{busy === "test" ? "…" : "Test an mich"}</button>
        <button type="button" className="in-knopf" disabled={!!busy || !betreff || !text || (gewaehltGesamt === 0 && !suche.trim())} onClick={() => void vorschauHolen()}>{busy === "vorschau" ? "…" : "Vorschau & senden"}</button>
      </div>

      {gruppenWahl && (
        <Dialog ueber="Zielgruppen" titel="Eine ganze Gruppe anschreiben" unter="Die Zahl ist der aktuelle Stand – sie wird beim Senden neu ermittelt, nicht aus dieser Ansicht übernommen." breite={520} onZu={() => setGruppenWahl(false)}
          fuss={<><button type="button" className="in-knopf still" onClick={() => setAktiveGruppen([])}>Keine</button><button type="button" className="in-knopf" onClick={() => setGruppenWahl(false)}>Übernehmen</button></>}>
          <div style={{ display: "grid", gap: 6 }}>{gruppen.map((g) => { const an = aktiveGruppen.includes(g.schluessel); return (
            <button key={g.schluessel} type="button" className={`in-gruppe${an ? " an" : ""}`} disabled={g.anzahl === 0} onClick={() => setAktiveGruppen((l) => an ? l.filter((x) => x !== g.schluessel) : [...l, g.schluessel])}>
              <span className="haken">{an && <Check size={14} strokeWidth={2.5} />}</span><b>{g.titel}</b><em>{g.anzahl}</em>
            </button>
          ); })}</div>
        </Dialog>
      )}

      {vorschau && (
        <Dialog ueber="So geht es raus" titel={`${vorschau.anzahl} Empfänger`} breite={640} onZu={() => setVorschau(null)}
          unter={<>{(Array.isArray(vorschau.empfaenger) ? vorschau.empfaenger : []).map((e: any) => e?.name ?? e?.email ?? "?").slice(0, 6).join(", ")}{vorschau.anzahl > 6 && ` und ${vorschau.anzahl - 6} weitere`}</>}
          fuss={<><button type="button" className="in-knopf still" onClick={() => setVorschau(null)}>Zurück zum Text</button><button type="button" className="in-knopf" disabled={busy === "senden"} onClick={() => void senden()}>{busy === "senden" ? "Wird verschickt …" : `An ${vorschau.anzahl} senden`}</button></>}>
          <div className="in-vorschau">
            <p className="in-hinweis" style={{ marginBottom: 10 }}>Betreff: {vorschau.betreff} – Bausteine sind hier mit den Daten des ersten Empfängers gefüllt; jeder bekommt seine eigenen.</p>
            <iframe title="Vorschau" sandbox="" srcDoc={vorschau.html} />
          </div>
        </Dialog>
      )}
    </>
  );
}

// Sendeergebnis je Empfänger, mit Grund – nie ein Verweis auf einen anderen Ort.
function ErgebnisKarte({ ergebnis, onZu }: { ergebnis: any; onZu: () => void }) {
  const [offen, setOffen] = useState(true);
  const misslungen = ergebnis.ergebnisse.filter((e: any) => !e.ok); const geklappt = ergebnis.ergebnisse.filter((e: any) => e.ok);
  return (
    <div className={`in-ergebnis${misslungen.length ? " schlecht" : ""}`}>
      <button type="button" className="in-ergebnis-kopf" onClick={() => setOffen((o) => !o)}>
        <span>{geklappt.length} verschickt{misslungen.length > 0 && `, ${misslungen.length} nicht`}{misslungen.length > 0 && ergebnis.gruende?.length === 1 && <small style={{ display: "block", marginTop: 3, color: "#fde68a" }}>{ergebnis.gruende[0]}</small>}</span>
        <small>{offen ? "Zuklappen" : "Je Empfänger ansehen"}</small>
      </button>
      {offen && (
        <div style={{ marginTop: 8 }}>
          {ergebnis.ergebnisse.map((e: any) => <div key={e.email} className="in-ergebnis-zeile"><i style={{ background: e.ok ? "#34d399" : "#fbbf24" }} />{e.name}<span>{e.email}</span>{!e.ok && <p>{e.grund || "Kein Grund übermittelt."}</p>}</div>)}
          <button type="button" className="in-link" onClick={onZu} style={{ marginTop: 6 }}>Ergebnis schließen</button>
        </div>
      )}
    </div>
  );
}

function Dialog({ ueber, titel, unter, breite = 560, onZu, fuss, children }: { ueber: string; titel: string; unter?: ReactNode; breite?: number; onZu: () => void; fuss?: ReactNode; children: ReactNode }) {
  const zuRef = useRef(onZu); zuRef.current = onZu;
  useEffect(() => {
    const zu = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); zuRef.current(); } };
    window.addEventListener("keydown", zu, true);
    return () => window.removeEventListener("keydown", zu, true);
  }, []);
  return (
    <div className="in-dialog-hintergrund" onClick={onZu} role="presentation">
      <div className="in-dialog" role="dialog" aria-modal="true" aria-label={titel} style={{ ["--in-breite" as any]: `${breite}px` }} onClick={(e) => e.stopPropagation()}>
        <div className="in-dialog-kopf"><div><span className="ueber">{ueber}</span><h2>{titel}</h2>{unter && <span className="unter">{unter}</span>}</div><button type="button" className="in-dialog-zu" onClick={onZu} aria-label="Schließen"><X size={18} /></button></div>
        <div className="in-dialog-inhalt">{children}</div>
        {fuss && <div className="in-dialog-fuss">{fuss}</div>}
      </div>
    </div>
  );
}
