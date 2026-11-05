// ═══════════════════════════════════════════════════════════════════════════
// /agent/firmen — DAS FIRMENKUNDEN-COCKPIT (02.09.2026, Justins Nachtauftrag)
//
// Gebaut aus Nikitas Perspektive: 50 Anrufe am Tag schaffen nur, wenn
// zwischen zwei Anrufen NICHTS im Weg steht. Deshalb:
//   · Links die Tagesliste (fällige Wiedervorlagen zuerst), ein Klick öffnet
//     die Firma rechts — mit großer Telefonnummer (tel:-Link), Website,
//     Verlauf und SIEBEN Ergebnis-Knöpfen, die alles in einem Klick
//     festhalten (Status, Wiedervorlage, Zähler).
//   · Der Tagesring zählt live auf das 50er-Ziel.
//   · Der Leitfaden klappt direkt neben dem Gespräch auf: Öffner, drei
//     Schmerzpunkte, Einwände mit Antworten, die Abschlussfrage. EHRLICH:
//     keine Exklusiv-Behauptungen, keine Garantien — die Karte der
//     Seriosität ist im B2B das stärkste Argument.
//   · Nach dem Gespräch: Info-Mail (ein Klick, vom Haus, mit dem Namen des
//     Anrufers) und der Antragslink zum Kopieren.
//   · Nachschub: Listen einfach einkleben (Import versteht CSV/Tab/Excel-
//     Kopien und überspringt Doppelte).
//
// 17.09.2026 (E-188): Das Cockpit verkauft FIAON Global — vier EINMALPREISE
// statt der eingestellten Business-Abos. Der Leitfaden kommt aus
// shared/fiaon-global-vertrieb.ts (dieselbe Stelle wie Info-Mail und
// KI-Vorbereitung, durch die Wortwand geprüft), das Auswahlfeld aus
// verkaufbarePakete("global"), der Auftragslink aus shared/fiaon-global-wege.ts.
// Nichts hier sagt eine Karte, einen Rahmen, einen Zins oder eine Frist zu.
//
// 17.09.2026 (E-188) — DER EINGANG VON DER WEBSITE: Wer auf fiaon.com/business
// ein Erstgespräch zu FIAON Global bucht oder um einen Anruf bittet, steht hier
// mit der Marke „Global" ganz oben in „Jetzt dran" — mit Paketwunsch auf der
// Karte und der Buchung im Verlauf. Kalender, Startseite und der Auftrag
// springen direkt auf die Firma: /agent/firmen?firma=<id> bzw. ?person=<id>
// (der Termin hängt am Firmenkontakt, die Arbeit liegt hier).
//
// E-476 Scheibe 3 (05.11.2026, Entscheidung 1A): „Termin bei Justin eintragen“ — Daniel ruft den Lead an und trägt ihn
// im Gespräch in Justins freie Zeiten ein (Pflicht: was der Lead selbst erzählt hat + heiß/warm/kalt). Bestätigung an
// den Lead, Auftrag zu, „Termin steht“ an Justin — alles serverseitig (POST /agent/firmen/:id/justin-termin).
//
// E-476 Scheibe 5 (05.11.2026): EIN Stand je Lead. Bei einem Business-Lead zeigt die Karte oben die Stand-Leiste
// (Anfrage · Mail von Justin · Anrufe · Termin) und was jetzt dran ist. Bei „erreicht — Interesse/Termin“ sind zwei, drei
// Sätze „Was er selbst erzählt hat“ Pflicht (sie gehen in Justins „Termin steht“ und die Anruf-Karte); „Termin
// vereinbart“ gibt es nur mit einem Termin im Kalender — der Knopf öffnet dann „Termin bei Justin eintragen“.
// Kaltakquise-Firmen bleiben, wie sie waren.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from "react";
import { AgentShell } from "./shared";
import { useOffice } from "./OfficeShell";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "./rundgaenge";
import { verkaufbarePakete } from "@shared/fiaon-pakete";
import { globalLeitfaden } from "@shared/fiaon-global-vertrieb";
import { globalStartUrl } from "@shared/fiaon-global-wege";
import { ERZAEHLT_FELDER, EINSCHAETZUNGEN, EINSCHAETZUNG_WORT, ERZAEHLT_MIN } from "@shared/fiaon-lead-weg";
import { PFLICHT_NOTIZ_ERGEBNISSE } from "@shared/fiaon-lead-takt";
import "@/styles/office-firmen.css";

/** E-476 Scheibe 5: die Stand-Leiste eines Business-Leads (vom Server, server/lib/fiaon-lead-takt.ts). */
interface LeadStand {
  anfrageId: number; status: string; statusWort: string; jetzt: string; wartetMin: number | null; terminGebucht: boolean;
  schritte: { key: string; text: string; ton: "gut" | "warte" | "still" | "rot" }[];
}

async function api(pfad: string, init?: RequestInit) {
  const res = await fetch(`/api/fiaon${pfad}`, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  const json = await res.json().catch(() => null);
  return { ok: res.ok && json?.ok, json };
}

const STATUS_TEXT: Record<string, [string, string]> = {
  neu: ["neu", "still"], in_arbeit: ["in Arbeit", "blau"], wiedervorlage: ["Wiedervorlage", "warte"],
  termin: ["Termin steht", "gut"], antrag: ["Antrag läuft", "gut"],
  kein_interesse: ["kein Interesse", "still"], ungueltig: ["ungültig", "still"],
};
const ERGEBNIS_KNOEPFE: [string, string, string][] = [
  ["erreicht_interesse", "Erreicht — Interesse", "gut"],
  ["erreicht_termin", "Erreicht — Termin vereinbart", "gut"],
  ["erreicht_antrag", "Erreicht — macht den Antrag", "gut"],
  ["erreicht_kein_interesse", "Erreicht — kein Interesse", "still"],
  ["nicht_erreicht", "Nicht erreicht", "still"],
  ["mailbox", "Mailbox", "still"],
  ["nummer_falsch", "Nummer falsch", "rot"],
];

// Der Leitfaden steht in shared/fiaon-global-vertrieb.ts: Kundensätze (Sie-Form,
// durch die Wortwand geprüft) und Anweisungen an dich (kursiv gesetzt).
const LEITFADEN = globalLeitfaden();
const GLOBAL_PAKETE_WAHL = verkaufbarePakete("global");
const ERSTES_PAKET = GLOBAL_PAKETE_WAHL[0]?.key ?? "";
const ganzeEuro = (cents: number) => Math.round(cents / 100).toLocaleString("de-DE") + " €";

// E-188: Was im Verlauf steht, wenn die Zeile von der Website oder aus dem
// Kalender kommt (art „global" in fiaon_firmen_log).
const GLOBAL_EREIGNIS: Record<string, string> = {
  termin_gebucht: "FIAON Global — Erstgespräch gebucht",
  anfrage: "FIAON Global — bittet um einen Anruf",
  termin_abgesagt: "FIAON Global — Gespräch abgesagt",
  gespraech_gefuehrt: "FIAON Global — Erstgespräch geführt",
  gespraech_nicht_zustande: "FIAON Global — Gespräch kam nicht zustande",
  // E-458 Nr. 11 (29.10.2026): Verschieben und die Mails rund um das Gespräch (Erinnerung, „nicht erreicht“).
  termin_verschoben: "FIAON Global — Gespräch verschoben",
  gespraech_mail: "FIAON Global — Mail an das Unternehmen",
  // E-476 (05.11.2026): das Lead-Dossier an Justin (Check und Hintergrund in einer Zeile).
  dossier: "FIAON Global — Lead-Dossier an Justin",
  // E-476 Nachbesserung: Justin hat im Dossier „Ich rufe selbst an“ gedrückt — der Auftrag ans Team ist geschlossen.
  selbst: "FIAON Global — Justin ruft selbst an",
  // E-476 Scheibe 3: Termin bei Justin, was der Lead erzählt hat, „Termin steht“ an Justin, Antwort des Leads an welcome@.
  termin_eingetragen: "FIAON Global — Termin bei Justin eingetragen",
  erzaehlt: "FIAON Global — was er selbst erzählt hat",
  termin_steht: "FIAON Global — Justin hat „Termin steht“",
  antwort: "FIAON Global — der Lead hat geschrieben",
  // E-476 Scheibe 4: Justins Lead-Mails aus js@ (Willkommen, Nachfass) und warum keine weitere kommt.
  lead_mail: "FIAON Global — Mail von Justin an den Lead",
  lead_stopp: "FIAON Global — keine weiteren Lead-Mails",
  abgemeldet: "FIAON Global — möchte keine Mails mehr",
  ruecklaeufer: "FIAON Global — Mail kam unzustellbar zurück",
  // E-476 Scheibe 5: Daniels Takt (Lead-Meldung, Erinnerung) und eine Stand-Korrektur aus der Ableitung.
  lead_meldung: "FIAON Global — Lead-Meldung an das Team",
  erinnerung: "FIAON Global — Erinnerung: der Lead wartet",
  stand: "FIAON Global — Stand korrigiert",
};

const tagKurz = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });

export default function AgentFirmenPage() { return <AgentShell><FirmenInnen /></AgentShell>; }

function FirmenInnen() {
  const { dunkel, titel } = useOffice();
  useEffect(() => { dunkel(true); titel("Firmenkunden"); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [firmen, setFirmen] = useState<any[]>([]);
  const [zahlen, setZahlen] = useState<any>({});
  const [filter, setFilter] = useState("arbeit");
  const [suche, setSuche] = useState("");
  const [aktiv, setAktiv] = useState<any | null>(null);
  const [verlauf, setVerlauf] = useState<any[] | null>(null);
  const [notiz, setNotiz] = useState("");
  const [leitfadenAuf, setLeitfadenAuf] = useState(false);
  const [importAuf, setImportAuf] = useState(false);
  const [importText, setImportText] = useState("");
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [vorbereitung, setVorbereitung] = useState<any | null>(null);
  const [abschlussAuf, setAbschlussAuf] = useState(false);
  const [ab, setAb] = useState<Record<string, string>>({});
  const [abErgebnis, setAbErgebnis] = useState<any | null>(null);
  // E-476 Scheibe 3: „Termin bei Justin eintragen“ — Zeiten, Wahl, Pflicht-Notiz, Einschätzung, Kontakt.
  const [justin, setJustin] = useState<any | null>(null);
  const [jWahl, setJWahl] = useState<{ tag: string | null; zeit: string | null }>({ tag: null, zeit: null });
  const [jText, setJText] = useState("");
  const [jFelder, setJFelder] = useState<Record<string, string>>({});
  const [jEinsch, setJEinsch] = useState("");
  const [jKontakt, setJKontakt] = useState<{ name: string; email: string; telefon: string }>({ name: "", email: "", telefon: "" });
  const [jFehler, setJFehler] = useState("");
  // E-476 Scheibe 5: der EINE Stand (nur Business-Leads) und die kurzen Felder zur Pflicht-Notiz.
  const [lead, setLead] = useState<LeadStand | null>(null);
  const [notizFelder, setNotizFelder] = useState<Record<string, string>>({});
  const [felderAuf, setFelderAuf] = useState(false);

  const sag = (t: string) => { setMeldung(t); setTimeout(() => setMeldung(null), 6000); };

  const laden = useCallback(async () => {
    const r = await api(`/agent/firmen/liste?filter=${filter}&q=${encodeURIComponent(suche)}`);
    if (r.ok) { setFirmen(r.json.firmen || []); setZahlen(r.json.zahlen || {}); }
  }, [filter, suche]);
  useEffect(() => { const t = setTimeout(() => void laden(), 250); return () => clearTimeout(t); }, [laden]);

  const oeffnen = async (f: any) => {
    setAktiv(f); setVerlauf(null); setNotiz(""); setLead(null); setNotizFelder({}); setFelderAuf(false);
    setVorbereitung(null); setAbschlussAuf(false); setAbErgebnis(null); setJustin(null);
    setAb({ email: f.email || "", telefon: f.telefon || "", ort: f.ort || "", paket: ERSTES_PAKET });
    const r = await api(`/agent/firmen/${f.id}`);
    if (r.ok) { setAktiv(r.json.firma); setVerlauf(r.json.verlauf || []); setLead(r.json.lead ?? null); }
  };

  // ── E-188: DER SPRUNG AUS KALENDER UND AUFTRAG ───────────────────────────
  // ?firma=<id> kommt aus dem Auftrag („Öffnen →"), ?person=<id> aus Kalender
  // und Startseite: Der Termin kennt nur den Firmenkontakt, der Server findet
  // die Firma dazu. Geht der Sprung ins Leere, sagt die Seite das — statt so zu
  // tun, als wäre die erste Firma der Liste gemeint (dieselbe Lehre wie beim
  // Kalender-Sprung in die Pipeline, 28.08.2026).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const firma = Number(p.get("firma"));
    const person = Number(p.get("person"));
    if (!(firma > 0) && !(person > 0)) return;
    void (async () => {
      const r = await api(firma > 0 ? `/agent/firmen/${firma}` : `/agent/firmen/zu-person/${person}`);
      if (r.ok && r.json?.firma) {
        const f = r.json.firma;
        setAktiv(f); setVerlauf(r.json.verlauf || []); setLead(r.json.lead ?? null);
        setAb({ email: f.email || "", telefon: f.telefon || "", ort: f.ort || "", paket: ERSTES_PAKET });
      } else sag(r.json?.error || "Diese Firma wurde nicht gefunden — bitte such sie über das Suchfeld.");
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // E-476 Scheibe 5: „Termin vereinbart“ ohne Termin im Kalender gibt es bei einem Business-Lead nicht — dann öffnet sich
  // „Termin bei Justin eintragen“, die Notiz wandert als „Was er selbst erzählt hat“ mit.
  const zuJustinTermin = async (text: string) => {
    if (!justin) await justinOeffnen();
    if (text.trim()) setJText(text.trim());
    sag("Erst den Termin bei Justin eintragen (die Zeit, die ihr eben vereinbart habt) — dann ist er wirklich im Kalender, er bekommt die Bestätigung und Justin die Anruf-Karte.");
  };

  const ergebnis = async (wert: string) => {
    if (!aktiv) return;
    // Business-Lead: bei „erreicht — Interesse/Termin“ zwei, drei Sätze Pflicht (Justin liest sie vor dem Gespräch).
    if (lead && (PFLICHT_NOTIZ_ERGEBNISSE as readonly string[]).includes(wert) && notiz.trim().length < ERZAEHLT_MIN) {
      return sag("Bitte zuerst zwei, drei Sätze ins Notizfeld: Was hat er selbst erzählt? Wer ist er, was will er, wie groß, wie ernst?");
    }
    if (lead && wert === "erreicht_termin" && !lead.terminGebucht) return void zuJustinTermin(notiz);
    setLaeuft(wert);
    const r = await api(`/agent/firmen/${aktiv.id}/anruf`, {
      method: "POST",
      body: JSON.stringify({ ergebnis: wert, notiz: notiz.trim() || undefined, felder: lead ? notizFelder : undefined }),
    });
    setLaeuft(null);
    if (!r.ok) {
      if (r.json?.feld === "termin") return void zuJustinTermin(notiz);
      return sag(r.json?.error || "Konnte das Ergebnis nicht speichern.");
    }
    setNotiz(""); setNotizFelder({}); setFelderAuf(false);
    sag(lead && /^erreicht_/.test(wert) ? "Festgehalten — Justin liest deine Sätze vor dem Gespräch. Nächster Anruf." : "Festgehalten — nächster Anruf.");
    if (wert === "erreicht_antrag") sag("Stark! Status „Antrag läuft“ — schick ihm gleich die Info-Mail mit dem Link.");
    await laden();
    const neu = await api(`/agent/firmen/${aktiv.id}`);
    if (neu.ok) { setAktiv(neu.json.firma); setVerlauf(neu.json.verlauf || []); setLead(neu.json.lead ?? null); }
  };

  const infoMail = async () => {
    if (!aktiv) return;
    setLaeuft("mail");
    const r = await api(`/agent/firmen/${aktiv.id}/mail`, { method: "POST", body: "{}" });
    setLaeuft(null);
    // E-476 Scheibe 4: als „FIAON Global“ — Antworten gehen an Justin; ein Business-Lead bekommt keine Preisliste, sondern seinen Terminlink.
    sag(r.ok
      ? (r.json?.lead ? "Info-Mail ist raus (FIAON Global, ohne Preisliste, mit seinem Terminlink bei Justin) — Justins Nachfass endet damit." : "Info-Mail ist raus — als FIAON Global mit deinem Namen; Antworten gehen an Justin.")
      : (r.json?.error || "Mail fehlgeschlagen."));
    if (r.ok) void oeffnen(aktiv);
  };

  // ── E-476 Scheibe 3: „Termin bei Justin eintragen“ ─────────────────────────
  const justinOeffnen = async () => {
    if (!aktiv) return;
    if (justin) { setJustin(null); return; }
    setLaeuft("justin");
    const r = await api(`/agent/firmen/${aktiv.id}/justin-zeiten`);
    setLaeuft(null);
    if (!r.ok) return sag(r.json?.error || "Die freien Zeiten konnten nicht geladen werden.");
    setJustin(r.json);
    setJWahl({ tag: r.json.tage?.[0]?.tag ?? null, zeit: null });
    // E-476 Nachbesserung (Gutachten Betreiber, Mangel 4): „Was er selbst erzählt hat“ vorbefüllt — mit dem, was schon im
    // Notizfeld steht, sonst der letzten Anruf-Notiz (keine zweite Notiz tippen).
    const letzteAnrufNotiz = String((verlauf ?? []).find((v: any) => v?.art === "anruf" && String(v?.notiz ?? "").trim())?.notiz ?? "");
    setJText(notiz.trim() || letzteAnrufNotiz); setJFelder({}); setJEinsch(""); setJFehler("");
    setJKontakt({ name: aktiv.ansprechpartner || "", email: aktiv.email || "", telefon: aktiv.telefon || "" });
  };

  const justinEintragen = async () => {
    if (!aktiv || !jWahl.tag || !jWahl.zeit) return setJFehler("Bitte zuerst Tag und Uhrzeit wählen.");
    if (jText.trim().length < ERZAEHLT_MIN) return setJFehler("Bitte zwei, drei Sätze: Wer ist er, was will er, wie groß, wie ernst? Justin liest das vor dem Gespräch.");
    if (!jEinsch) return setJFehler("Bitte die Einschätzung wählen: heiß, warm oder kalt.");
    setJFehler(""); setLaeuft("justin-eintragen");
    const r = await api(`/agent/firmen/${aktiv.id}/justin-termin`, {
      method: "POST",
      body: JSON.stringify({ tag: jWahl.tag, zeit: jWahl.zeit, erzaehlt: jText, felder: jFelder, einschaetzung: jEinsch, ...jKontakt }),
    });
    setLaeuft(null);
    if (!r.ok) {
      setJFehler(r.json?.error || "Der Termin ist NICHT eingetragen. Bitte noch einmal versuchen.");
      if (r.json?.grund && ["nicht_angeboten", "belegt", "tag_voll"].includes(r.json.grund)) {
        const neu = await api(`/agent/firmen/${aktiv.id}/justin-zeiten`);
        if (neu.ok) { setJustin(neu.json); setJWahl({ tag: neu.json.tage?.[0]?.tag ?? null, zeit: null }); }
      }
      return;
    }
    setJustin(null); setNotiz(""); setNotizFelder({}); setFelderAuf(false);
    // E-476 Nachbesserung (Gutachten Betreiber, Mangel 4): der Anruf zählt mit — kein zweiter Klick auf „Termin vereinbart“.
    sag(`Eingetragen: ${r.json.datumText}, ${r.json.uhrzeit} Uhr bei ${r.json.bei}. Der Lead hat die Bestätigung, dein Auftrag ist zu, ${r.json.bei} bekommt „Termin steht“${r.json.anrufEingetragen ? " — und dein Anruf „erreicht — Termin vereinbart“ ist mit eingetragen" : ""}.`);
    await laden();
    const neu = await api(`/agent/firmen/${aktiv.id}`);
    if (neu.ok) { setAktiv(neu.json.firma); setVerlauf(neu.json.verlauf || []); setLead(neu.json.lead ?? null); }
  };

  const linkKopierenLead = async (link: string) => {
    try { await navigator.clipboard.writeText(link); sag("Persönlicher Terminlink kopiert — z. B. für WhatsApp. Name und Nummer sind dort schon eingetragen."); }
    catch { sag(`Kopieren nicht möglich — Link: ${link}`); }
  };

  const vorbereiten = async (erzwingen = false) => {
    if (!aktiv) return;
    setLaeuft("vorbereitung");
    const r = await api(`/agent/firmen/${aktiv.id}/vorbereitung`, { method: "POST", body: JSON.stringify({ erzwingen }) });
    setLaeuft(null);
    if (r.ok) setVorbereitung(r.json.vorbereitung);
    else sag(r.json?.error || "Vorbereitung gerade nicht möglich.");
  };

  const abschliessen = async () => {
    if (!aktiv) return;
    setLaeuft("abschluss");
    const r = await api(`/agent/firmen/${aktiv.id}/abschluss`, { method: "POST", body: JSON.stringify(ab) });
    setLaeuft(null);
    if (r.ok) {
      setAbErgebnis(r.json);
      sag("Antrag angelegt — nenn dem Kunden jetzt den Zahlungsweg.");
      void laden();
    } else sag(r.json?.error || "Abschluss fehlgeschlagen.");
  };

  // E-188: Der Link führt in den Auftrag (/business/start) — mit dem Paket, das
  // im Abschluss-Feld gerade gewählt ist. Dort unterschreibt der Kunde selbst.
  const linkKopieren = async () => {
    const link = globalStartUrl(ab.paket || ERSTES_PAKET);
    try {
      await navigator.clipboard.writeText(link);
      sag("Auftragslink kopiert — z. B. für WhatsApp Business.");
    } catch { sag(`Kopieren nicht möglich — Link: ${link}`); }
  };

  const importieren = async () => {
    setLaeuft("import");
    const r = await api("/agent/firmen/import", { method: "POST", body: JSON.stringify({ text: importText }) });
    setLaeuft(null);
    if (r.ok) {
      sag(`${r.json.neu} neue Firmen aufgenommen, ${r.json.doppelt} Doppelte übersprungen.`);
      setImportText(""); setImportAuf(false); void laden();
    } else sag(r.json?.error || "Import fehlgeschlagen.");
  };

  const anrufe = Number(zahlen.anrufe_heute || 0);
  const ziel = Number(zahlen.ziel || 50);
  const ring = Math.min(1, anrufe / ziel);

  return (
    <div className="fk">
      {/* ── Kopf: das Tagesziel als Ring ── */}
      <section className="fk-kopf">
        <div>
          <span className="fk-pille">Firmenkunden · B2B</span>
          <h1>Die US-Struktur. <span className="fk-verlauf">Aus einer Hand.</span></h1>
          <p>Deine Tagesliste, der Leitfaden direkt daneben, jedes Ergebnis ein Klick. Vorrat: {zahlen.vorrat_neu ?? 0} neue Firmen{Number(zahlen.faellig || 0) > 0 ? ` · ${zahlen.faellig} Wiedervorlagen fällig` : ""}.</p>
        </div>
        <div className="fk-ring" role="img" aria-label={`${anrufe} von ${ziel} Anrufen heute`}>
          <svg viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="52" className="fk-ring-grund" />
            <circle cx="60" cy="60" r="52" className="fk-ring-wert"
                    strokeDasharray={`${(ring * 326.7).toFixed(1)} 326.7`} />
          </svg>
          <div className="fk-ring-text"><b>{anrufe}</b><span>von {ziel}<br />Anrufen heute</span></div>
          <small>{Number(zahlen.treffer_woche || 0)} Treffer diese Woche</small>
        </div>
      </section>

      {meldung && <p className="fk-meldung" onClick={() => setMeldung(null)}>{meldung}</p>}

      {/* ── Leitfaden — immer griffbereit ── */}
      <section className={`fk-leitfaden${leitfadenAuf ? " auf" : ""}`}>
        <button type="button" onClick={() => setLeitfadenAuf(!leitfadenAuf)}>
          <b>Der Leitfaden fürs Firmengespräch</b>
          <span>{leitfadenAuf ? "einklappen" : "aufklappen"}</span>
        </button>
        {leitfadenAuf && (
          <div className="fk-leitfaden-innen">
            {LEITFADEN.map((b) => (
              <div key={b.t} className="fk-leitfaden-block">
                <b>{b.t}</b>
                {b.s.map((satz, i) => <p key={i} style={satz.kunde ? undefined : { fontStyle: "italic", opacity: .82 }}>{satz.text}</p>)}
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="fk-raster">
        {/* ── Die Liste ── */}
        <section className="fk-tafel">
          <header>
            <div className="fk-reiter">
              {[["arbeit", "Jetzt dran"], ["meine", "Meine"], ["alle", "Alle"]].map(([w, l]) => (
                <button key={w} type="button" className={filter === w ? "an" : ""} onClick={() => setFilter(w)}>{l}</button>
              ))}
            </div>
            <button type="button" className="fk-knopf still klein" onClick={() => setImportAuf(!importAuf)}>Liste einkleben</button>
          </header>
          {importAuf && (
            <div className="fk-import">
              <p>Eine Firma je Zeile: <code>Firma; Ansprechpartner; Telefon; E-Mail; Website; Ort; Branche</code> — Excel-Kopien (Tab) gehen auch. Doppelte werden übersprungen.</p>
              <textarea rows={6} value={importText} onChange={(e) => setImportText(e.target.value)}
                        placeholder={"Beispiel GmbH;Max Beispiel;+49 30 1234567;info@beispiel.de;beispiel.de;Berlin;Handwerk"} />
              <button type="button" className="fk-knopf" disabled={laeuft === "import" || importText.trim().length < 5}
                      onClick={() => void importieren()}>{laeuft === "import" ? "Lese ein …" : "Einlesen"}</button>
            </div>
          )}
          <input className="fk-suche" value={suche} onChange={(e) => setSuche(e.target.value)}
                 placeholder="Firma, Ort, Ansprechpartner, Nummer …" />
          <ul className="fk-liste">
            {firmen.map((f) => {
              const [st, ton] = STATUS_TEXT[f.status] || [f.status, "still"];
              return (
                <li key={f.id}>
                  <button type="button" className={aktiv?.id === f.id ? "an" : ""} onClick={() => void oeffnen(f)}>
                    <span className="fk-liste-wer"><b>{f.firma}</b><small>{[f.global_am ? "FIAON Global" : null, f.ort, f.branche].filter(Boolean).join(" · ") || "—"}</small></span>
                    <span className={`fk-marke ${ton}`}>{st}</span>
                  </button>
                </li>
              );
            })}
            {!firmen.length && <li className="fk-leise">Nichts in dieser Sicht — Liste einkleben oder Filter wechseln.</li>}
          </ul>
        </section>

        {/* ── Die Anruf-Karte ── */}
        <section className="fk-tafel">
          {!aktiv && <p className="fk-leise" style={{ padding: 8 }}>Wähle links eine Firma — hier erscheint die Anruf-Karte.</p>}
          {aktiv && (
            <div className="fk-karte">
              <header>
                <div>
                  <h2>{aktiv.firma}</h2>
                  <small>{[aktiv.ansprechpartner, aktiv.ort, aktiv.branche].filter(Boolean).join(" · ") || "—"}</small>
                </div>
                {(() => { const [st, ton] = STATUS_TEXT[aktiv.status] || [aktiv.status, "still"]; return <span className={`fk-marke ${ton}`}>{st}</span>; })()}
              </header>
              {/* E-476 Scheibe 5: EIN Stand je Business-Lead — Anfrage, Mail von Justin, Anrufe, Termin; darunter, was jetzt dran ist. */}
              {lead && (
                <div className="fk-stand" aria-label="Stand dieses Business-Leads">
                  <ol className="fk-stand-schritte">
                    {lead.schritte.map((s) => <li key={s.key} className={`fk-stand-schritt ${s.ton}`}>{s.text}</li>)}
                  </ol>
                  <p className={`fk-stand-jetzt${lead.wartetMin != null && lead.wartetMin >= 15 ? " warte" : ""}`}>{lead.jetzt}</p>
                </div>
              )}
              <div className="fk-kontakt">
                {aktiv.telefon
                  ? <a className="fk-tel" href={`tel:${String(aktiv.telefon).replace(/[^0-9+]/g, "")}`}>{aktiv.telefon}</a>
                  : <span className="fk-leise">Keine Nummer hinterlegt</span>}
                <div className="fk-kontakt-neben">
                  {aktiv.email && <span>{aktiv.email}</span>}
                  {aktiv.website && <a href={/^https?:/.test(aktiv.website) ? aktiv.website : `https://${aktiv.website}`} target="_blank" rel="noreferrer">{aktiv.website}</a>}
                </div>
              </div>
              {/* E-188: Was das Unternehmen auf fiaon.com/business gewählt hat — vor dem Anruf lesen. */}
              {aktiv.paketwunsch && <p className="fk-notizen"><b>FIAON Global · Paketwunsch:</b> {aktiv.paketwunsch}</p>}
              {aktiv.notiz && <p className="fk-notizen">{aktiv.notiz}</p>}

              {lead && (
                <p className="fk-pflicht">Bei „erreicht“: zwei, drei Sätze, <b>was er selbst erzählt hat</b> (Pflicht) — Justin liest sie vor dem Gespräch.</p>
              )}
              <textarea className="fk-notiz-feld" rows={lead ? 3 : 2} value={notiz} onChange={(e) => setNotiz(e.target.value)}
                        placeholder={lead ? "Wer ist er, was will er, wie groß ist die Firma, wie ernst ist es? Nur, was ER gesagt hat …" : "Notiz zum Gespräch (wird mit dem Ergebnis gespeichert) …"} />
              {lead && (
                <div className="fk-felder-klapp">
                  <button type="button" className="fk-knopf still klein" onClick={() => setFelderAuf(!felderAuf)}>
                    {felderAuf ? "Kurze Felder zuklappen" : "Kurze Felder (freiwillig): Wohnort, Rolle, wer noch, US-Bezug, Größe"}
                  </button>
                  {felderAuf && (
                    <div className="fk-j-felder">
                      {ERZAEHLT_FELDER.map((f) => (
                        <label key={f.key}>{f.label}
                          <input value={notizFelder[f.key] || ""} onChange={(e) => setNotizFelder({ ...notizFelder, [f.key]: e.target.value })} />
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="fk-ergebnisse">
                {ERGEBNIS_KNOEPFE.map(([wert, label, ton]) => (
                  <button key={wert} type="button" className={`fk-erg ${ton}`} disabled={!!laeuft}
                          onClick={() => void ergebnis(wert)}>{laeuft === wert ? "…" : label}</button>
                ))}
              </div>

              {/* ── E-476 Scheibe 3: im Gespräch direkt bei Justin eintragen (Entscheidung 1A) ── */}
              <button type="button" className="fk-knopf gut fk-justin-knopf" disabled={laeuft === "justin"}
                      onClick={() => void justinOeffnen()}>
                {laeuft === "justin" ? "Lade Justins Zeiten …" : justin ? "Termin-Eintrag zuklappen" : "Termin bei Justin eintragen"}
              </button>
              {justin && (
                <div className="fk-justin">
                  <header>
                    <b>Termin bei {justin.person?.vorname || "Justin"} eintragen — 30 Minuten, {justin.person?.vorname || "Justin"} ruft an</b>
                    <small>Frag im Gespräch, wann es ihm passt, und wähl die Zeit. Er bekommt sofort die Bestätigung per Mail (Sie-Form), dein Auftrag schließt sich, {justin.person?.vorname || "Justin"} bekommt „Termin steht“ mit deiner Notiz.</small>
                  </header>
                  {!justin.tage?.length ? (
                    <p className="fk-j-fehler">Gerade keine freie Zeit{justin.grund === "keine_zeiten" ? " — es sind keine Zeitfenster gepflegt" : " — die nächsten Tage sind voll"}. Halte das Interesse fest und sag ihm, dass sich {justin.person?.vorname || "Justin"} meldet.</p>
                  ) : (
                    <>
                      <div className="fk-j-tage" role="group" aria-label="Tag wählen">
                        {justin.tage.map((t: any) => (
                          <button key={t.tag} type="button" className="fk-j-tag" aria-pressed={jWahl.tag === t.tag}
                                  onClick={() => setJWahl({ tag: t.tag, zeit: null })}>{tagKurz(t.tag)}</button>
                        ))}
                      </div>
                      <div className="fk-j-zeiten" role="group" aria-label="Uhrzeit wählen">
                        {(justin.tage.find((t: any) => t.tag === jWahl.tag)?.zeiten ?? []).map((z: string) => (
                          <button key={z} type="button" className="fk-j-zeit" aria-pressed={jWahl.zeit === z}
                                  onClick={() => setJWahl({ ...jWahl, zeit: z })}>{z}</button>
                        ))}
                      </div>
                    </>
                  )}
                  <label className="fk-j-pflicht">Was er selbst erzählt hat (Pflicht — 2, 3 Sätze)
                    <textarea className="fk-notiz-feld" rows={3} value={jText} onChange={(e) => setJText(e.target.value)}
                              placeholder="Wer ist er, was will er, wie groß ist die Firma, wie ernst ist es? Nur, was ER gesagt hat." />
                  </label>
                  <div className="fk-j-felder">
                    {ERZAEHLT_FELDER.map((f) => (
                      <label key={f.key}>{f.label}
                        <input value={jFelder[f.key] || ""} onChange={(e) => setJFelder({ ...jFelder, [f.key]: e.target.value })} />
                      </label>
                    ))}
                  </div>
                  <div className="fk-j-einsch" role="group" aria-label="Einschätzung">
                    {EINSCHAETZUNGEN.map((e) => (
                      <button key={e} type="button" aria-pressed={jEinsch === e} onClick={() => setJEinsch(e)}>{EINSCHAETZUNG_WORT[e]}</button>
                    ))}
                  </div>
                  <div className="fk-j-felder">
                    <label>Name<input value={jKontakt.name} onChange={(e) => setJKontakt({ ...jKontakt, name: e.target.value })} /></label>
                    <label>E-Mail (für die Bestätigung)<input type="email" value={jKontakt.email} onChange={(e) => setJKontakt({ ...jKontakt, email: e.target.value })} /></label>
                    <label>Telefon<input value={jKontakt.telefon} onChange={(e) => setJKontakt({ ...jKontakt, telefon: e.target.value })} /></label>
                  </div>
                  {jFehler && <p className="fk-j-fehler" role="alert">{jFehler}</p>}
                  <button type="button" className="fk-knopf" disabled={laeuft === "justin-eintragen" || !jWahl.zeit}
                          onClick={() => void justinEintragen()}>
                    {laeuft === "justin-eintragen" ? "Trage ein …" : jWahl.tag && jWahl.zeit ? `Eintragen: ${tagKurz(jWahl.tag)}, ${jWahl.zeit} Uhr` : "Erst Tag und Uhrzeit wählen"}
                  </button>
                  {justin.link && (
                    <div className="fk-j-link">
                      <span>Lieber selbst wählen lassen? Sein persönlicher Terminlink (Angaben schon eingetragen):</span>
                      <code>{justin.link}</code>
                      <button type="button" className="fk-knopf still klein" onClick={() => void linkKopierenLead(justin.link)}>Link kopieren</button>
                    </div>
                  )}
                </div>
              )}

              {/* ── KI-Vorbereitung: ein Klick, alles wissen ── */}
              {!vorbereitung && (
                <button type="button" className="fk-knopf ki" disabled={laeuft === "vorbereitung"}
                        onClick={() => void vorbereiten()}>
                  {laeuft === "vorbereitung" ? "Liest die Website und denkt …" : "✦ KI-Vorbereitung — ein Klick, alles wissen"}
                </button>
              )}
              {vorbereitung && (
                <div className="fk-vorbereitung">
                  <header>
                    <b>Deine Vorbereitung</b>
                    <small>{vorbereitung.mit_website ? "aus der Firmen-Website gelesen" : "geschätzt aus Branche und Ort — Website nicht erreichbar"}</small>
                    <button type="button" onClick={() => void vorbereiten(true)} disabled={laeuft === "vorbereitung"}>neu</button>
                  </header>
                  <p className="fk-vb-lage">{vorbereitung.kurzlage}</p>
                  <div className="fk-vb-einstieg"><b>Dein Einstieg:</b> {vorbereitung.einstieg}</div>
                  <div className="fk-vb-spalten">
                    <div><b>Anknüpfungspunkte</b><ul>{(vorbereitung.schmerzpunkte || []).map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></div>
                    <div><b>Kluge Fragen</b><ul>{(vorbereitung.fragen || []).map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></div>
                  </div>
                  {vorbereitung.einwand_tipp && <p className="fk-vb-einwand"><b>Wahrscheinlichster Einwand:</b> {vorbereitung.einwand_tipp}</p>}
                  {vorbereitung.paket && <p className="fk-vb-paket"><b>Passendes Paket:</b> {vorbereitung.paket}</p>}
                </div>
              )}

              <div className="fk-aktionen">
                <button type="button" className="fk-knopf" disabled={laeuft === "mail" || !aktiv.email}
                        title={aktiv.email ? "Info-Mail als FIAON Global mit deinem Namen (max. 1× je 7 Tage; nicht bei einem Termin bei Justin)" : "Keine E-Mail hinterlegt"}
                        onClick={() => void infoMail()}>{laeuft === "mail" ? "Sende …" : "Info-Mail senden"}</button>
                <button type="button" className="fk-knopf gut" onClick={() => { setAbschlussAuf(!abschlussAuf); setAbErgebnis(null); }}>
                  {abschlussAuf ? "Abschluss zuklappen" : "Abschluss am Telefon"}
                </button>
                <button type="button" className="fk-knopf still" title="Der Kunde wählt das Paket, unterschreibt den Vertrag selbst und überweist auf Rechnung."
                        onClick={() => void linkKopieren()}>Auftragslink kopieren</button>
              </div>

              {/* ── Der Abschluss am Telefon: Antrag gemeinsam anlegen ── */}
              {abschlussAuf && !abErgebnis && (
                <div className="fk-abschluss">
                  <p className="fk-leise">Ihr füllt das GEMEINSAM am Telefon aus — es entsteht die Bestellung mit dem Katalogpreis, die Zahlungsdaten gehen an die E-Mail. FIAON Global ist ein EINMALPREIS: keine Monatsrate, keine Lastschrift. Sag vorher die drei Pflichtsätze aus dem Leitfaden — und sag nichts zu, was eine Bank entscheidet.</p>
                  <div className="fk-ab-felder">
                    <label>Paket
                      <select value={ab.paket || ERSTES_PAKET} onChange={(e) => setAb({ ...ab, paket: e.target.value })}>
                        {GLOBAL_PAKETE_WAHL.map((x) => (
                          <option key={x.key} value={x.key}>{x.label} — {ganzeEuro(x.preisCents)} einmalig</option>
                        ))}
                      </select>
                    </label>
                    <label>Vorname Ansprechpartner<input value={ab.vorname || ""} onChange={(e) => setAb({ ...ab, vorname: e.target.value })} /></label>
                    <label>Nachname<input value={ab.nachname || ""} onChange={(e) => setAb({ ...ab, nachname: e.target.value })} /></label>
                    <label>E-Mail (Pflicht)<input type="email" value={ab.email || ""} onChange={(e) => setAb({ ...ab, email: e.target.value })} /></label>
                    <label>Telefon<input value={ab.telefon || ""} onChange={(e) => setAb({ ...ab, telefon: e.target.value })} /></label>
                    <label>Rechtsform<input value={ab.rechtsform || ""} onChange={(e) => setAb({ ...ab, rechtsform: e.target.value })} placeholder="GmbH, e.K., UG …" /></label>
                    <label>Straße & Nr.<input value={ab.strasse || ""} onChange={(e) => setAb({ ...ab, strasse: e.target.value })} /></label>
                    <label>PLZ<input value={ab.plz || ""} onChange={(e) => setAb({ ...ab, plz: e.target.value })} /></label>
                    <label>Ort<input value={ab.ort || ""} onChange={(e) => setAb({ ...ab, ort: e.target.value })} /></label>
                  </div>
                  <button type="button" className="fk-knopf" disabled={laeuft === "abschluss"}
                          onClick={() => void abschliessen()}>
                    {laeuft === "abschluss" ? "Lege den Antrag an …" : "Antrag jetzt anlegen"}
                  </button>
                </div>
              )}
              {abErgebnis && (
                <div className="fk-abschluss fertig">
                  <b>Antrag steht! 🎉</b>
                  <p>{abErgebnis.paket ? <>{abErgebnis.paket} · </> : null}{abErgebnis.zahlungsreferenz ? <>Zahlungsreferenz: <code>{abErgebnis.zahlungsreferenz}</code></> : "Die Zahlungsreferenz entsteht mit der Rechnung."}{abErgebnis.betrag ? ` · ${Number(abErgebnis.betrag).toLocaleString("de-DE", { minimumFractionDigits: 2 })} € einmalig` : ""}</p>
                  <p>Sag dem Kunden: „Sie bekommen die Zahlungsdaten per E-Mail. Bezahlt wird einmal, per Überweisung auf Rechnung — mit dem Zahlungseingang legen wir los.“</p>
                  <p className="fk-leise">Der Vertrag ist damit NICHT unterschrieben: Am Telefon wird keine Zustimmung vermerkt. Schick dem Kunden den Auftragslink — dort liest und unterschreibt er den Global-Vertrag selbst.</p>
                  {abErgebnis.zahlungslink && (
                    <button type="button" className="fk-knopf" onClick={async () => {
                      try { await navigator.clipboard.writeText(abErgebnis.zahlungslink); sag("Zahlungslink kopiert."); } catch { sag(abErgebnis.zahlungslink); }
                    }}>Zahlungslink kopieren</button>
                  )}
                  {abErgebnis.auftragslink && (
                    <button type="button" className="fk-knopf still" onClick={async () => {
                      try { await navigator.clipboard.writeText(abErgebnis.auftragslink); sag("Auftragslink kopiert — dort unterschreibt der Kunde den Vertrag selbst."); } catch { sag(abErgebnis.auftragslink); }
                    }}>Auftragslink kopieren</button>
                  )}
                </div>
              )}

              <div className="fk-verlauf">
                <b>Verlauf</b>
                {verlauf === null && <p className="fk-leise">Lade …</p>}
                {verlauf?.length === 0 && <p className="fk-leise">Noch kein Eintrag — dein Anruf ist der erste.</p>}
                <ul>
                  {(verlauf || []).map((v, i) => (
                    <li key={i}>
                      <span>{new Date(v.created_at).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                      <span>{v.agent_name || "System"}: {v.art === "anruf" ? (ERGEBNIS_KNOEPFE.find(([w]) => w === v.ergebnis)?.[1] || v.ergebnis) : v.art === "mail" ? "Info-Mail versendet" : v.art === "global" ? (GLOBAL_EREIGNIS[v.ergebnis] || "FIAON Global") : "Notiz"}{v.notiz ? ` — ${v.notiz}` : ""}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Das Tutorial — erklärt den Raum beim ersten Besuch, danach über das ?-Symbol. */}
      <Rundgang raum="firmen" titel={RUNDGAENGE.firmen.titel} schritte={RUNDGAENGE.firmen.schritte} />
    </div>
  );
}
