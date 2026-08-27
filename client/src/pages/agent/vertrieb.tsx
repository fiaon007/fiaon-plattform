// ═══════════════════════════════════════════════════════════════════════════
// /agent/vertrieb — DIE LEITUNG
//
// ── DER AUFTRAG (Justin, 25.08.2026) ───────────────────────────────────────
// „Baue die Vertriebsleiter-Ansicht um, komplett neu, in unserem CI, komplett
// logisch und clean — UND achte darauf, dass man hier wirklich 100 % Zugriff
// auf ALLE Kunden hat und es eben alles logisch und realitätsnah ist. Der
// Vertriebsleiter soll ‚alles' machen können."
//
// ── WAS AN DER ALTEN FASSUNG NICHT STIMMTE ─────────────────────────────────
// Sie war über Monate gewachsen: fünf Reiter, die nach den EINGEBAUTEN
// Funktionen benannt waren („Zuweisungen", „Dubletten", „Zahlungen"), nicht
// nach dem, was eine Leitung tut. Wer wissen wollte, wie der Tag steht, musste
// vier Reiter durchklicken und im Kopf zusammensetzen.
//
// ── DIE NEUE ORDNUNG FOLGT DEM ARBEITSTAG ──────────────────────────────────
//   1. LAGE       Was braucht heute eine Entscheidung? Eine Seite, keine Suche.
//   2. KUNDEN     ALLE — ohne Ausnahme, mit Suche über die ganze Kartei.
//   3. TEAM       Wer trägt wie viel, und wo hakt es.
//   4. GELD       Zahlungen buchen, überfällige Zusagen, offene Rechnungen.
//   5. ORDNUNG    Dubletten, Testeinträge, Befunde der Bestandswache.
//
// ── EINE AKTE, ÜBERALL ─────────────────────────────────────────────────────
// Der Raum öffnet DIESELBE Akte wie Pipeline, Bestand und Collections
// (`Akte` aus pipeline.tsx). Justin am 24.08.: „Wenn ich da die Akte öffne,
// hat die plötzlich eine ganz andere Ansicht — die Akte selbst soll bitte
// einheitlich sein." Eine zweite Fassung nur für die Leitung wäre genau der
// Fehler, der damals behoben wurde.
//
// ── WAS „ALLES MACHEN KÖNNEN" WIRKLICH HEISST ──────────────────────────────
// Der Server lässt die Leitung an jeden Menschen (`darfAnKunde` gibt für
// `vertriebsleiter` und `admin` bedingungslos `true`). Diese Seite muss das
// also nicht erkämpfen — sie muss es nur ERREICHBAR machen. Deshalb steht die
// Suche über ALLE Kunden ganz vorn und nicht hinter einem Filter.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  Users, Search, Phone, RefreshCw, AlertTriangle, Wallet, Layers,
  UserRoundPlus, ShieldAlert, ExternalLink, ChevronRight, Check,
} from "lucide-react";
import { AgentShell, api } from "./shared";
import { useOffice } from "./OfficeShell";
import { ZusageTafel } from "./vertrieb-zusage";
import { ToastAnbieter, eur, useToast } from "@/lib/fiaon-ui";
import { Akte, type Kunde } from "./pipeline";
import "@/styles/office-pipeline.css";
import "@/styles/office-leitung.css";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "./rundgaenge";
import "@/styles/office-rundgang.css";
import { createPortal } from "react-dom";

type Raum = "lage" | "kunden" | "team" | "geld" | "ordnung";

const RAEUME: { key: Raum; label: string; Icon: any; satz: string }[] = [
  { key: "lage",    label: "Lage",    Icon: Layers,        satz: "Was heute eine Entscheidung braucht." },
  { key: "kunden",  label: "Kunden",  Icon: Users,         satz: "Jeder Mensch in der Kartei — ohne Ausnahme." },
  { key: "team",    label: "Team",    Icon: UserRoundPlus, satz: "Wer trägt wie viel, und wo hakt es." },
  { key: "geld",    label: "Geld",    Icon: Wallet,        satz: "Zahlungen, Zusagen, offene Rechnungen." },
  { key: "ordnung", label: "Ordnung", Icon: ShieldAlert,   satz: "Dubletten, Testeinträge, Befunde." },
];

const dtag = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";
const tageSeit = (iso: string | null | undefined): string => {
  if (!iso) return "nie";
  const t = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return t === 0 ? "heute" : t === 1 ? "gestern" : `vor ${t} Tagen`;
};

export default function AgentVertriebSeite() {
  return <AgentShell><ToastAnbieter ton="dunkel"><LeitungInnen /></ToastAnbieter></AgentShell>;
}

function LeitungInnen() {
  const { dunkel, titel } = useOffice();
  useEffect(() => { dunkel(true); titel("Leitung"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const { zeige } = useToast();

  const [raum, setRaum] = useState<Raum>("lage");
  const [ueber, setUeber] = useState<any | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [offen, setOffen] = useState<number | null>(null);
  // ── DIE VERPFLICHTUNGSERKLÄRUNG ─────────────────────────────────────────
  // Der Server lässt niemanden in diesen Raum, der sie nicht angenommen hat
  // (`nurMitZusage` in server/routes/fiaon-vertrieb.ts, Antwort 403 mit
  // code "zusage_erforderlich"). Die alte Fassung des Raums zeigte sie; beim
  // Neubau am 25.08. hatte ich sie vergessen — Justin sah deshalb nur die
  // helle Notfallfassung mitten auf der dunklen Bühne und schrieb:
  // „das passt nicht! Optimieren". Sie gehört hierher, und zwar dunkel.
  const [zusageOffen, setZusageOffen] = useState(false);

  const laden = useCallback(async () => {
    setLaedt(true);
    const r = await api("/agent/vertrieb/uebersicht");
    setLaedt(false);
    if (!r.ok) {
      if (r.json?.code === "zusage_erforderlich") { setZusageOffen(true); setFehler(null); return; }
      // 404 heißt hier nicht „kaputt", sondern „diese Rolle sieht den Raum
      // nicht" (nurLeitung antwortet bewusst mit 404 statt 403). Der Satz sagt
      // das, statt den Menschen raten zu lassen.
      setFehler(r.status === 404
        ? "Dieser Raum ist der Vertriebsleitung vorbehalten. Wenn du ihn brauchst, kann Justin dir die Rolle geben."
        : (r.json?.error || "Die Übersicht ließ sich nicht laden."));
      return;
    }
    setFehler(null);
    setZusageOffen(false);
    setUeber(r.json);
  }, []);
  useEffect(() => { void laden(); }, [laden]);

  // Die Akte per Adresse öffnen — dieselbe Sprungmarke wie in allen Räumen.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("person");
    if (p && Number(p) > 0) setOffen(Number(p));
  }, []);
  const oeffnen = (id: number | null) => {
    setOffen(id);
    const u = new URL(window.location.href);
    if (id) u.searchParams.set("person", String(id)); else u.searchParams.delete("person");
    window.history.replaceState(null, "", u.toString());
  };
  useEffect(() => {
    const auf = (e: Event) => {
      const id = Number((e as CustomEvent).detail?.personId);
      if (Number.isFinite(id) && id > 0) oeffnen(id);
    };
    window.addEventListener("fiaon-akte-oeffnen", auf as EventListener);
    return () => window.removeEventListener("fiaon-akte-oeffnen", auf as EventListener);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Die Erklärung liegt VOR allem anderen: Ohne sie gibt der Server keine
  // Kundendaten heraus, also gibt es auch nichts zu zeigen.
  if (zusageOffen) {
    return <ZusageTafel basis="/agent/vertrieb/zusage" ton="dunkel" onAngenommen={() => { setZusageOffen(false); void laden(); }} />;
  }

  if (fehler) {
    return (
      <div className="lt">
        <section className="lt-kopf"><div>
          <span className="lt-pille">Leitung</span>
          <h1>Kein Zugang zu diesem Raum.</h1>
          <p>{fehler}</p>
        </div></section>
      </div>
    );
  }

  const z = ueber?.zahlen ?? {};

  return (
    <div className="lt">
      <section className="lt-kopf">
        <div>
          <span className="lt-pille">Leitung</span>
          <h1>Du siehst <span className="lt-verlauf">alles</span>.</h1>
          <p>
            Jeder Mensch in der Kartei, jede Zahlung, jeder Mitarbeiter. Was du hier änderst, wirkt
            sofort — und steht mit deinem Namen im Verlauf.
          </p>
        </div>
        <button type="button" className="lt-knopf still" onClick={() => void laden()} disabled={laedt}>
          <RefreshCw size={15} /> {laedt ? "Lädt …" : "Aktualisieren"}
        </button>
      </section>

      {/* Die Räume — nach dem Arbeitstag geordnet, nicht nach Funktionen. */}
      <nav className="lt-raeume" aria-label="Bereiche">
        {RAEUME.map((r) => (
          <button key={r.key} type="button"
                  className={`lt-raum${raum === r.key ? " an" : ""}`}
                  onClick={() => setRaum(r.key)}
                  aria-current={raum === r.key}>
            <r.Icon size={17} strokeWidth={1.75} />
            <b>{r.label}</b>
            <small>{r.satz}</small>
          </button>
        ))}
      </nav>

      {raum === "lage" && <Lage z={z} wache={ueber?.bestandswache ?? []} agenten={ueber?.agenten ?? []} aufRaum={setRaum} />}
      {raum === "kunden" && <AlleKunden onAkte={oeffnen} agenten={ueber?.agenten ?? []} zeige={zeige} />}
      {raum === "team" && <Team agenten={ueber?.agenten ?? []} z={z} aufRaum={setRaum} />}
      {raum === "geld" && <Geld onAkte={oeffnen} zeige={zeige} />}
      {raum === "ordnung" && <Ordnung wache={ueber?.bestandswache ?? []} zeige={zeige} onAkte={oeffnen} />}

      {/* ══════════════════════════════════════════════════════════════════
          DIE AKTE GEHT AN DEN SEITENKÖRPER, NICHT IN DIESEN KASTEN
          (26.08.2026, Florentines Punkt 1)

          „Wenn man im Bereich Management eine Kundenakte öffnet und diese
          wieder schließen möchte, ist der X-Button oben rechts verdeckt.
          Der Button liegt hinter dem Profilbild bzw. dem Ausloggen-Button."

          URSACHE: `.of-grund` trägt `z-index: 1` und bildet damit einen
          eigenen Stapelkontext. Alles darin bleibt UNTER der Kopfleiste
          (`.of-kopf`, z-index 30) — auch die Akte mit ihrem z-index 61.
          Der Wert 61 gilt nur INNERHALB von `.of-grund`; nach außen zählt
          allein die 1.

          Pipeline und Bestand reichen die Akte deshalb längst per
          `createPortal` an den Seitenkörper durch. Beim Neubau dieses Raums
          am 25.08. hatte ich das übersehen — dieselbe Falle, die in
          AGENTS.md steht.
          ══════════════════════════════════════════════════════════════════ */}
      {offen && createPortal(
        <AkteVonAussen personId={offen} onZu={() => oeffnen(null)} onGeaendert={() => void laden()} />,
        document.body,
      )}

      <Rundgang raum="vertrieb" titel={RUNDGAENGE.vertrieb?.titel ?? "Leitung"}
                schritte={RUNDGAENGE.vertrieb?.schritte ?? []} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE AKTE — dieselbe wie überall
//
// Sie erwartet einen ganzen Kunden, nicht nur eine Kennung. Hier wird er
// nachgeladen; das ist derselbe Weg, den auch der Bestand-Raum geht.
// ═══════════════════════════════════════════════════════════════════════════
function AkteVonAussen({ personId, onZu, onGeaendert }: {
  personId: number; onZu: () => void; onGeaendert: () => void;
}) {
  const [k, setK] = useState<Kunde | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  useEffect(() => {
    let an = true;
    api(`/agent/crm/kunden/${personId}`).then((r) => {
      if (!an) return;
      if (r.ok && r.json?.kunde) { setK(r.json.kunde); setFehler(null); }
      else setFehler(r.json?.error || "Diese Akte ließ sich nicht öffnen.");
    });
    return () => { an = false; };
  }, [personId]);

  if (fehler) {
    return (
      <div className="lt-akte-fehler" onClick={onZu}>
        <div onClick={(e) => e.stopPropagation()}><p>{fehler}</p>
          <button type="button" className="lt-knopf still" onClick={onZu}>Schließen</button></div>
      </div>
    );
  }
  if (!k) return null;
  return (
    <Akte k={k} onZu={onZu} onWeg={onZu}
          onNeu={(neu: Kunde) => setK(neu)}
          onErledigt={() => { onGeaendert(); }}
          onZaehler={onGeaendert} />
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 · LAGE — was heute eine Entscheidung braucht
//
// Bewusst KEINE Kachelwand mit allen Zahlen, die es gibt: Nur das, wozu die
// Leitung etwas tun MUSS. Eine Zahl ohne Handlung ist Dekoration — und wer
// zwanzig Kacheln sieht, sieht keine.
// ═══════════════════════════════════════════════════════════════════════════
function Lage({ z, wache, agenten, aufRaum }: {
  z: any; wache: any[]; agenten: any[]; aufRaum: (r: Raum) => void;
}) {
  const schwer = wache.filter((b) => Number(b.gewicht) >= 2);
  const punkte = [
    { n: z.ohneAgent ?? 0, was: "Menschen ohne Betreuer", warum: "Sie stehen in keiner Arbeitsliste — niemand ruft sie an.", raum: "kunden" as Raum, filter: "ohne_agent", ton: "rot" },
    { n: z.bezahltOhneBetreuer ?? 0, was: "zahlende Kunden ohne Betreuer", warum: "Sie zahlen und haben keinen Ansprechpartner.", raum: "kunden" as Raum, filter: "ohne_agent", ton: "rot" },
    { n: z.zusageUeberfaellig ?? 0, was: "gebrochene Zahlungszusagen", warum: "Zugesagt und verstrichen — hier fehlt Geld.", raum: "geld" as Raum, filter: "ueberfaellig", ton: "warn" },
    { n: z.zusageHeute ?? 0, was: "Zusagen für heute", warum: "Heute fällig — heute nachhalten.", raum: "geld" as Raum, filter: "zusage_heute", ton: "still" },
    { n: z.bezahltOhneOnboarding ?? 0, was: "bezahlt, ohne Startgespräch", warum: "Bezahlt, aber nie freigeschaltet. Der teuerste Zustand, den wir haben.", raum: "kunden" as Raum, filter: "bezahlt", ton: "warn" },
    { n: z.gesperrt ?? 0, was: "gesperrte Kunden", warum: "Kein Kontakt möglich — prüfen, ob die Sperre noch stimmt.", raum: "kunden" as Raum, filter: "gesperrt", ton: "still" },
  ].filter((p) => p.n > 0);

  return (
    <>
      {punkte.length === 0 && (
        <div className="lt-block">
          <p className="lt-leer">Nichts, was eine Entscheidung braucht. Das kommt selten vor — nutz den Tag für das Team.</p>
        </div>
      )}
      {punkte.length > 0 && (
        <div className="lt-punkte">
          {punkte.map((p) => (
            <button key={p.was} type="button" className={`lt-punkt ton-${p.ton}`} onClick={() => aufRaum(p.raum)}>
              <b>{p.n}</b>
              <span>{p.was}</span>
              <small>{p.warum}</small>
              <ChevronRight size={15} className="lt-punkt-pfeil" />
            </button>
          ))}
        </div>
      )}

      {schwer.length > 0 && (
        <div className="lt-block">
          <div className="lt-block-kopf">
            <b><AlertTriangle size={15} /> Befunde der Bestandswache</b>
            <button type="button" className="lt-link" onClick={() => aufRaum("ordnung")}>alle ansehen</button>
          </div>
          {schwer.slice(0, 4).map((b) => (
            <p key={b.art} className="lt-befund">{b.klartext}</p>
          ))}
        </div>
      )}

      <div className="lt-block">
        <div className="lt-block-kopf">
          <b>Das Team heute</b>
          <button type="button" className="lt-link" onClick={() => aufRaum("team")}>Einzelheiten</button>
        </div>
        <div className="lt-team-kurz">
          {agenten.filter((a) => a.gesamt > 0 || a.mandate > 0).slice(0, 8).map((a) => (
            <div key={a.id} className="lt-team-zeile">
              <b>{a.name}</b>
              <span>{a.mandate} Mandate · {a.gesamt} in Arbeit</span>
            </div>
          ))}
          {agenten.every((a) => !a.gesamt && !a.mandate) && <p className="lt-leer">Noch keine Zahlen.</p>}
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · KUNDEN — alle, ohne Ausnahme
//
// Justin: „Achte darauf, dass man hier wirklich 100 % Zugriff auf ALLE Kunden
// hat."
// Der Server lässt die Leitung bereits an jeden Menschen — `darfAnKunde` gibt
// für `vertriebsleiter` bedingungslos `true`, und `/agent/vertrieb/personen`
// filtert nur zusammengeführte Doppelgänger heraus. Diese Seite muss den
// Zugriff also nicht erkämpfen, sondern ERREICHBAR machen: Die Suche steht
// ganz vorn, der Standardfilter ist „alle", und jede Zeile öffnet dieselbe
// Akte wie überall sonst.
// ═══════════════════════════════════════════════════════════════════════════
const KUNDEN_FILTER: { key: string; label: string; satz: string }[] = [
  { key: "alle", label: "Alle", satz: "Die ganze Kartei." },
  { key: "ohne_agent", label: "Ohne Betreuer", satz: "Steht in keiner Arbeitsliste." },
  { key: "tier1", label: "Zahlung gemeldet", satz: "Sagt, er habe gezahlt." },
  { key: "tier2", label: "Rechnung offen", satz: "Antrag fertig, Geld fehlt." },
  { key: "tier3", label: "Neukunde", satz: "Noch kein Antrag." },
  { key: "bezahlt", label: "Bezahlt", satz: "Geld ist da." },
  { key: "ueberfaellig", label: "Zusage gebrochen", satz: "Datum verstrichen." },
  { key: "gesperrt", label: "Gesperrt", satz: "Kein Kontakt möglich." },
];

function AlleKunden({ onAkte, agenten, zeige }: {
  onAkte: (id: number) => void; agenten: any[];
  zeige: (art: any, titel: string, text?: string) => void;
}) {
  const [filter, setFilter] = useState("alle");
  const [agent, setAgent] = useState<string>("");
  const [q, setQ] = useState("");
  const [liste, setListe] = useState<any[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [anzahl, setAnzahl] = useState(0);

  const holen = useCallback(async () => {
    setLaedt(true);
    const p = new URLSearchParams({ filter, limit: "400" });
    if (agent) p.set("agent", agent);
    if (q.trim()) p.set("q", q.trim());
    const r = await api(`/agent/vertrieb/personen?${p}`);
    setLaedt(false);
    if (r.ok) { setListe(r.json.personen || []); setAnzahl(r.json.anzahl ?? 0); }
  }, [filter, agent, q]);

  // Die Suche wartet einen Moment — sonst fragt jede Taste den Server.
  useEffect(() => { const t = setTimeout(() => { void holen(); }, q ? 320 : 0); return () => clearTimeout(t); }, [holen, q]);

  const jetzige = KUNDEN_FILTER.find((f) => f.key === filter);

  return (
    <>
      <div className="lt-suchzeile">
        <span className="lt-such-feld">
          <Search size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)}
                 placeholder="Name, E-Mail, Telefon, Vorgangsnummer oder Verwendungszweck …"
                 aria-label="Kunden suchen" />
          {q && <button type="button" onClick={() => setQ("")} aria-label="Suche leeren">×</button>}
        </span>
        <select value={agent} onChange={(e) => setAgent(e.target.value)} aria-label="Betreuer" className="lt-wahl">
          <option value="">Alle Betreuer</option>
          <option value="0">Ohne Betreuer</option>
          {agenten.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      <div className="lt-chips">
        {KUNDEN_FILTER.map((f) => (
          <button key={f.key} type="button" className={`lt-chip${filter === f.key ? " an" : ""}`}
                  onClick={() => setFilter(f.key)} title={f.satz}>{f.label}</button>
        ))}
      </div>

      <div className="lt-block">
        <div className="lt-block-kopf">
          <b>{laedt ? "Lädt …" : `${anzahl} ${anzahl === 1 ? "Mensch" : "Menschen"}`}</b>
          <small>{jetzige?.satz}{anzahl >= 400 ? " · mehr als 400 — bitte enger suchen" : ""}</small>
        </div>

        {!laedt && liste.length === 0 && (
          <p className="lt-leer">
            {q ? `Nichts gefunden zu „${q}“. Die Suche verzeiht Tippfehler im Namen — probier weniger Wörter.`
               : "In diesem Filter steht niemand."}
          </p>
        )}

        <div className="lt-tabelle">
          {liste.map((p) => (
            <div key={p.personId} className="lt-zeile">
              <button type="button" className="lt-zeile-wer" onClick={() => onAkte(p.personId)}>
                <b>{p.name}</b>
                <small>
                  {p.produkt || "kein Paket"}
                  {p.betrag ? ` · ${eur(p.betrag)}` : ""}
                  {p.ref ? ` · ${p.ref}` : ""}
                </small>
              </button>
              <span className="lt-zeile-lage">
                {p.gesperrt && <em className="ton-rot">gesperrt</em>}
                {!p.gesperrt && p.tier === 1 && <em className="ton-warn">Zahlung gemeldet</em>}
                {!p.gesperrt && p.tier === 2 && <em>Rechnung offen</em>}
                {!p.gesperrt && p.tier === 3 && <em>Neukunde</em>}
                {!p.gesperrt && p.tier === 0 && <em className="ton-gut">bezahlt</em>}
                {p.zusagedatum && <em className="ton-warn">zahlt {dtag(p.zusagedatum)}</em>}
              </span>
              <span className="lt-zeile-agent">
                {p.agentName || <em className="ton-rot">ohne Betreuer</em>}
                <small>{tageSeit(p.letzterKontakt)}</small>
              </span>
              <span className="lt-zeile-tun">
                {p.telefonWaehlbar && (
                  <button type="button" className="lt-rund" title={`${p.name} anrufen`}
                          onClick={() => window.dispatchEvent(new CustomEvent("fiaon-anrufen",
                            { detail: { nummer: p.telefonWaehlbar, personId: p.personId, name: p.name } }))}>
                    <Phone size={14} />
                  </button>
                )}
                <button type="button" className="lt-knopf klein" onClick={() => onAkte(p.personId)}>Akte</button>
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · TEAM — wer trägt wie viel
//
// Die Zahlen stammen aus derselben Quelle wie die Ansicht der Mitarbeiter
// selbst (`mandat_seit` für die Mandate, `priority_tier` für die Arbeit).
// Zwei Rechnungen für dieselbe Leistung wären der schnellste Weg zu einem
// Streit über die Provision.
// ═══════════════════════════════════════════════════════════════════════════
const ROLLEN_TEXT: Record<string, string> = {
  vertriebsleiter: "Leitung",
  agent: "Bonitätsmanager",
  onboarding: "Onboarding",
  inkasso: "Forderungen & Zahlungen",
  admin: "Verwaltung",
};

function Team({ agenten, z, aufRaum }: { agenten: any[]; z: any; aufRaum: (r: Raum) => void }) {
  const sortiert = [...agenten].sort((a, b) => (b.mandate + b.gesamt) - (a.mandate + a.gesamt));
  const gesamtMandate = agenten.reduce((s, a) => s + (a.mandate || 0), 0);
  const gesamtArbeit = agenten.reduce((s, a) => s + (a.gesamt || 0), 0);

  return (
    <>
      <div className="lt-punkte">
        <div className="lt-punkt ton-still" role="group">
          <b>{gesamtMandate}</b><span>Mandate im Team</span>
          <small>Menschen, die zahlen und betreut werden.</small>
        </div>
        <div className="lt-punkt ton-still" role="group">
          <b>{gesamtArbeit}</b><span>in Arbeit</span>
          <small>Stufe 1 bis 3 — noch kein Abschluss.</small>
        </div>
        <button type="button" className={`lt-punkt ${(z.ohneAgent ?? 0) > 0 ? "ton-rot" : "ton-still"}`}
                onClick={() => aufRaum("kunden")}>
          <b>{z.ohneAgent ?? 0}</b><span>ohne Betreuer</span>
          <small>Niemand ist zuständig — hier verteilst du.</small>
          <ChevronRight size={15} className="lt-punkt-pfeil" />
        </button>
      </div>

      <div className="lt-block">
        <div className="lt-block-kopf"><b>Jeder Einzelne</b><small>nach Last sortiert</small></div>
        <div className="lt-tabelle">
          {sortiert.map((a) => (
            <div key={a.id} className="lt-zeile">
              <span className="lt-zeile-wer">
                <b>{a.name}</b>
                <small>{ROLLEN_TEXT[String(a.rolle)] ?? a.rolle}</small>
              </span>
              <span className="lt-zeile-lage">
                <em className="ton-gut">{a.mandate} Mandate</em>
              </span>
              <span className="lt-zeile-agent">
                {a.gesamt} in Arbeit
                <small>{a.tier1} gemeldet · {a.tier2} offen · {a.tier3} neu</small>
              </span>
              <span className="lt-zeile-tun">
                <Link href={`/agent/vertrieb?person=`} className="lt-knopf klein still"
                      onClick={(e) => { e.preventDefault(); }}
                      title="Die Kundenliste dieses Mitarbeiters">—</Link>
              </span>
            </div>
          ))}
          {sortiert.length === 0 && <p className="lt-leer">Keine aktiven Mitarbeiter.</p>}
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 · GELD — Zahlungen, Zusagen, offene Rechnungen
//
// Der eine Weg, auf dem die Leitung eine Zahlung bucht, für die es keinen
// automatischen Bankeingang gab (Bareinzahlung, fremdes Konto, Zahlendreher im
// Verwendungszweck). Er verlangt einen BELEG — nicht aus Misstrauen, sondern
// weil an einer gebuchten Zahlung eine Provision hängt und ein Abo startet.
// ═══════════════════════════════════════════════════════════════════════════
function Geld({ onAkte, zeige }: {
  onAkte: (id: number) => void;
  zeige: (art: any, titel: string, text?: string) => void;
}) {
  const [filter, setFilter] = useState("ueberfaellig");
  const [liste, setListe] = useState<any[]>([]);
  const [laedt, setLaedt] = useState(true);
  // ── SUCHE (27.08.2026, Team-Punkt 3) ────────────────────────────────────
  // „Im Bereich Geld gibt es keine Suchfunktion — ich muss durch die ganze
  // Liste scrollen." Gesucht wird ueber Name, Referenz und Betreuer, in der
  // bereits geladenen Liste — ohne neuen Serverruf, Treffer beim Tippen.
  const [suche, setSuche] = useState("");

  useEffect(() => {
    let an = true;
    setLaedt(true);
    api(`/agent/vertrieb/personen?filter=${filter}&limit=300`).then((r) => {
      if (!an) return;
      setLaedt(false);
      if (r.ok) setListe(r.json.personen || []);
    });
    return () => { an = false; };
  }, [filter]);

  const sichtbar = suche.trim()
    ? liste.filter((p) => {
        const q = suche.trim().toLowerCase();
        return [p.name, p.ref, p.agentName, p.produkt]
          .some((f) => String(f || "").toLowerCase().includes(q));
      })
    : liste;
  const summe = sichtbar.reduce((s, p) => s + (p.betrag ?? 0), 0);

  return (
    <>
      <div className="lt-chips">
        {[["ueberfaellig", "Zusage gebrochen"], ["zusage_heute", "Zusage heute"], ["tier1", "Zahlung gemeldet"], ["tier2", "Rechnung offen"]].map(([k, t]) => (
          <button key={k} type="button" className={`lt-chip${filter === k ? " an" : ""}`}
                  onClick={() => setFilter(k)}>{t}</button>
        ))}
        <input type="search" value={suche} onChange={(e) => setSuche(e.target.value)}
               placeholder="Suchen: Name, Referenz, Betreuer …"
               aria-label="In der Geld-Liste suchen"
               style={{ marginLeft: "auto", minWidth: 220, padding: "6px 12px", borderRadius: 10,
                        border: "1px solid rgba(148,163,184,.35)", background: "transparent",
                        color: "inherit", fontSize: 13 }} />
      </div>

      <div className="lt-block">
        <div className="lt-block-kopf">
          <b>{laedt ? "Lädt …" : `${sichtbar.length} ${sichtbar.length === 1 ? "Fall" : "Fälle"}${suche.trim() && sichtbar.length !== liste.length ? ` (von ${liste.length})` : ""}`}</b>
          {summe > 0 && <small>zusammen {eur(summe)} offen</small>}
        </div>
        {!laedt && sichtbar.length === 0 && (
          <p className="lt-leer">{suche.trim() ? "Kein Treffer für diese Suche in diesem Filter." : "Hier ist nichts offen."}</p>
        )}
        <div className="lt-tabelle">
          {sichtbar.map((p) => (
            <div key={p.personId} className="lt-zeile">
              <button type="button" className="lt-zeile-wer" onClick={() => onAkte(p.personId)}>
                <b>{p.name}</b>
                <small>{p.produkt || "kein Paket"}{p.ref ? ` · ${p.ref}` : ""}</small>
              </button>
              <span className="lt-zeile-lage">
                {p.betrag ? <em className="ton-warn">{eur(p.betrag)}</em> : <em>ohne Betrag</em>}
                {p.zusagedatum && <em>zugesagt {dtag(p.zusagedatum)}</em>}
              </span>
              <span className="lt-zeile-agent">
                {p.agentName || <em className="ton-rot">ohne Betreuer</em>}
                <small>{tageSeit(p.letzterKontakt)}</small>
              </span>
              <span className="lt-zeile-tun">
                {p.telefonWaehlbar && (
                  <button type="button" className="lt-rund" title={`${p.name} anrufen`}
                          onClick={() => window.dispatchEvent(new CustomEvent("fiaon-anrufen",
                            { detail: { nummer: p.telefonWaehlbar, personId: p.personId, name: p.name } }))}>
                    <Phone size={14} />
                  </button>
                )}
                <button type="button" className="lt-knopf klein" onClick={() => onAkte(p.personId)}>Akte</button>
              </span>
            </div>
          ))}
        </div>
        <p className="lt-fuss">
          Eine Zahlung buchst du in der Akte unter „Zahlungen &amp; Raten“ — dort liegt der Beleg dabei,
          das Abo startet und die Provision entsteht. Ein zweiter Weg von hier aus wäre ein zweiter
          Ort, an dem dasselbe passiert, und beide würden mit der Zeit auseinanderlaufen.
        </p>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 · ORDNUNG — was die Kartei verschmutzt
//
// Dubletten, Testeinträge, Befunde der Bestandswache. Bewusst ein eigener
// Raum: Das ist Arbeit, die niemand jeden Tag tut, die aber liegen bleibt,
// wenn sie zwischen den Kunden versteckt ist.
// ═══════════════════════════════════════════════════════════════════════════
function Ordnung({ wache, zeige, onAkte }: {
  wache: any[];
  zeige: (art: any, titel: string, text?: string) => void;
  onAkte: (id: number) => void;
}) {
  const [dubletten, setDubletten] = useState<any[] | null>(null);
  const [laedt, setLaedt] = useState(false);

  const dublettenHolen = async () => {
    setLaedt(true);
    const r = await api("/agent/vertrieb/dubletten?limit=50");
    setLaedt(false);
    if (r.ok) setDubletten(r.json.paare || r.json.dubletten || []);
    else zeige("fehler", "Nicht geladen", r.json?.error || "");
  };

  return (
    <>
      <div className="lt-block">
        <div className="lt-block-kopf"><b>Befunde der Bestandswache</b><small>täglich neu gemessen</small></div>
        {wache.length === 0 && <p className="lt-leer">Keine Befunde. Die Kartei ist sauber.</p>}
        {[...wache].sort((a, b) => Number(b.gewicht) - Number(a.gewicht)).map((b) => (
          <div key={b.art} className={`lt-befund-zeile gew-${b.gewicht}`}>
            <b>{b.anzahl}</b>
            <span>{b.klartext}</span>
          </div>
        ))}
      </div>

      <div className="lt-block">
        <div className="lt-block-kopf">
          <b>Doppelte Menschen</b>
          <button type="button" className="lt-link" onClick={() => void dublettenHolen()} disabled={laedt}>
            {laedt ? "sucht …" : dubletten ? "erneut suchen" : "jetzt suchen"}
          </button>
        </div>
        {dubletten === null && (
          <p className="lt-leer">
            Ein Mensch, der zweimal in der Kartei steht, bekommt zwei Rechnungen und zwei Anrufe.
            Die Suche vergleicht Namen, Adressen und Rufnummern — sie läuft nicht von selbst, weil
            sie die Datenbank spürbar beansprucht.
          </p>
        )}
        {dubletten?.length === 0 && <p className="lt-leer">Keine Paare gefunden.</p>}
        {dubletten && dubletten.length > 0 && (
          <div className="lt-tabelle">
            {dubletten.slice(0, 30).map((d: any, i: number) => (
              <div key={i} className="lt-zeile">
                <button type="button" className="lt-zeile-wer" onClick={() => onAkte(d.a?.personId ?? d.aId)}>
                  <b>{d.a?.name ?? d.aName ?? "—"}</b><small>{d.a?.email ?? d.aEmail ?? ""}</small>
                </button>
                <span className="lt-zeile-lage"><em>{d.grund || d.treffer || "ähnlich"}</em></span>
                <button type="button" className="lt-zeile-agent" onClick={() => onAkte(d.b?.personId ?? d.bId)}>
                  {d.b?.name ?? d.bName ?? "—"}
                  <small>{d.b?.email ?? d.bEmail ?? ""}</small>
                </button>
                <span className="lt-zeile-tun">
                  <button type="button" className="lt-knopf klein still"
                          onClick={() => onAkte(d.a?.personId ?? d.aId)}>ansehen</button>
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="lt-fuss">
          Zusammenführen ist <b>nicht</b> umkehrbar: Der zweite Mensch verschwindet, und seine
          Anträge, Zahlungen und Gespräche hängen danach am ersten. Deshalb steht der Knopf dafür
          in der Akte und nicht in dieser Liste — dort siehst du beide Seiten vollständig, bevor du
          entscheidest.
        </p>
      </div>
    </>
  );
}
