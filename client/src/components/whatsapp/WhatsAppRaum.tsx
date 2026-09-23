// ═══════════════════════════════════════════════════════════════════════════
// DER WHATSAPP-RAUM (23.09.2026, E-210) — dieselbe Seite für Team und Leitung
//
// Justin: „eine Seite die aussieht wie WhatsApp nur eben in FIAON STIL … aber
// eben 100 % mitgedacht!"
//
// Was hier anders ist als in jedem Chat-Fenster:
// · Das 24-Stunden-Fenster steht sichtbar über dem Eingabefeld und sperrt es,
//   wenn es zu ist — stattdessen erscheinen die freigegebenen Vorlagen.
// · Je Gespräch ein Schalter „Mara antwortet hier". Schreibt ein Mensch,
//   schaltet der Server Mara in diesem Gespräch selbst ab.
// · Rechts steht der Mensch: Stufe, Paket, Betreuer, Akte, Telefon — man muss
//   die Seite nicht verlassen, um zu wissen, mit wem man spricht.
// · Vor jedem Senden prüft der Server Wortwand, Sie-Form und die
//   WhatsApp-Richtlinie (keine Mahnung, keine Forderung).
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "@/pages/agent/rundgaenge";
import "@/styles/office-rundgang.css";
import "@/styles/whatsapp-raum.css";

interface Gespraech {
  nummer: string; name: string | null; personId: number | null; leadId: number | null;
  stufe: string | null; betreuer: string | null;
  letzte: { text: string; richtung: string; am: string; status: string };
  ungelesen: number; maraAn: boolean; fensterBis: string | null;
  bearbeiter: { id: number; seit: string } | null; notiz: string | null;
}
interface Nachricht {
  id: number; richtung: string; text: string | null; vorlage: string | null; knopf: string | null;
  status: string; fehler: string | null; von: string | null;
  empfangen_am: string | null; gesendet_am: string | null; zugestellt_am: string | null; gelesen_am: string | null; created_at: string;
}
interface Vorlage { name: string; status: string; text?: string; zweck?: string; beispiele?: string[] }

/** Zahlstatus in Worten — dieselben Begriffe wie in der Akte. */
const ZAHLTEXT: Record<string, string> = {
  paid: "bezahlt", claimed_paid: "Zahlung gemeldet", pending_payment: "Rechnung offen",
  expired: "Frist abgelaufen", pending: "Antrag offen", cancelled: "storniert", refunded: "erstattet",
};

const zeit = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "";
const tag = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "";

function restZeit(bis: string | null): string | null {
  if (!bis) return null;
  const ms = new Date(bis).getTime() - Date.now();
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  return h > 0 ? `noch ${h} h ${m} min` : `noch ${m} min`;
}

export default function WhatsAppRaum({ basis }: { basis: string }) {
  const API = `/api/fiaon${basis}`;
  const [liste, setListe] = useState<Gespraech[] | null>(null);
  const [kopf, setKopf] = useState<{ nummer: string | null; bereit: boolean; ich: number | null; alles: boolean } | null>(null);
  const [suche, setSuche] = useState("");
  const [filter, setFilter] = useState<"alle" | "ungelesen" | "offen">("alle");
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [chat, setChat] = useState<{
    verlauf: Nachricht[]; lage: any; links: any; fensterOffen: boolean; maraAn: boolean;
    notiz: string | null; bearbeiter: number | null; ich: number | null;
    vorlagen: Vorlage[]; ergebnisse: { wert: string; text: string }[];
  } | null>(null);
  // E-218: Die rechte Spalte — der Fall auf einen Blick. Am Handy eingeklappt.
  const [fallOffen, setFallOffen] = useState(false);
  const [notizEntwurf, setNotizEntwurf] = useState("");
  const [ergebnisOffen, setErgebnisOffen] = useState(false);
  const [entwurf, setEntwurf] = useState("");
  const [sendet, setSendet] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [vorlageOffen, setVorlageOffen] = useState(false);
  const [neuOffen, setNeuOffen] = useState(false);
  const [neuSuche, setNeuSuche] = useState("");
  const [treffer, setTreffer] = useState<{ art: string; id: number; name: string; nummer: string; betreuer: string | null }[]>([]);
  const [neuZiel, setNeuZiel] = useState<{ art: string; id: number; name: string; nummer: string } | null>(null);
  const [neuVorlagen, setNeuVorlagen] = useState<{ vorlagen: Vorlage[]; inPruefung: number } | null>(null);
  const endeRef = useRef<HTMLDivElement>(null);

  const melden = (t: string) => { setMeldung(t); window.setTimeout(() => setMeldung(null), 8000); };

  const listeLaden = useCallback(async () => {
    try {
      const r = await fetch(`${API}/gespraeche?suche=${encodeURIComponent(suche)}&filter=${filter === "alle" ? "" : filter}`, { credentials: "include" });
      const j = await r.json();
      if (j?.ok) { setListe(j.gespraeche); setKopf({ nummer: j.nummer, bereit: j.bereit, ich: j.ich, alles: j.alles }); }
    } catch { /* stiller Fehlschlag, der nächste Takt holt es */ }
  }, [API, suche, filter]);

  const chatLaden = useCallback(async (nummer: string, leise = false) => {
    if (!leise) setChat(null);
    try {
      const r = await fetch(`${API}/gespraech/${encodeURIComponent(nummer)}`, { credentials: "include" });
      const j = await r.json();
      if (j?.ok) {
        setChat({
          verlauf: j.verlauf, lage: j.lage, links: j.links, fensterOffen: j.fensterOffen, maraAn: j.maraAn,
          notiz: j.notiz, bearbeiter: j.bearbeiter ?? null, ich: j.ich ?? null,
          vorlagen: j.vorlagen, ergebnisse: j.ergebnisse ?? [],
        });
        if (!leise) setNotizEntwurf(j.notiz ?? "");
      }
      else melden(j?.error || "Das Gespräch ließ sich nicht laden.");
    } catch { melden("Keine Verbindung."); }
  }, [API]);

  useEffect(() => { void listeLaden(); }, [listeLaden]);
  useEffect(() => {
    const id = window.setInterval(() => { void listeLaden(); if (gewaehlt) void chatLaden(gewaehlt, true); }, 8000);
    return () => window.clearInterval(id);
  }, [listeLaden, chatLaden, gewaehlt]);
  useEffect(() => { if (gewaehlt) void chatLaden(gewaehlt); }, [gewaehlt, chatLaden]);
  useEffect(() => { endeRef.current?.scrollIntoView({ block: "end" }); }, [chat?.verlauf.length, gewaehlt]);

  // E-220: Eine getippte Ziffernfolge ist ein gültiges Ziel — mit oder ohne
  // Pluszeichen, mit oder ohne Leerzeichen. Deutsche 0-Nummern bekommen die 49.
  const freieNummer = useMemo(() => {
    const roh = neuSuche.replace(/[^\d+]/g, "");
    if (!/\d/.test(roh)) return null;
    let z = roh.replace(/\D/g, "");
    if (roh.startsWith("00")) z = z.slice(2);
    else if (roh.startsWith("0")) z = `49${z.slice(1)}`;
    return z.length >= 10 && z.length <= 15 ? z : null;
  }, [neuSuche]);

  const aktuell = useMemo(() => liste?.find((g) => g.nummer === gewaehlt) ?? null, [liste, gewaehlt]);
  const rest = restZeit(aktuell?.fensterBis ?? null);

  const senden = async (inhalt: { text?: string; vorlage?: string; werte?: string[] }) => {
    if (!gewaehlt) return;
    setSendet(true);
    try {
      const r = await fetch(`${API}/senden`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nummer: gewaehlt, ...inhalt }),
      });
      const j = await r.json();
      if (!j?.ok) { melden(j?.error || "Das ging nicht raus."); return; }
      setEntwurf(""); setVorlageOffen(false);
      await chatLaden(gewaehlt, true); await listeLaden();
    } catch { melden("Keine Verbindung."); } finally { setSendet(false); }
  };

  // E-218: Ergebnis buchen und Notiz sichern — beide über die Hauswege.
  const ergebnisBuchen = async (ergebnis: string) => {
    if (!gewaehlt) return;
    setSendet(true);
    try {
      const r = await fetch(`${API}/gespraech/${encodeURIComponent(gewaehlt)}/ergebnis`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ergebnis }),
      });
      const j = await r.json();
      if (!j?.ok) { melden(j?.error || "Das Ergebnis ging nicht durch."); return; }
      melden("Gebucht — die Akte und die Pipeline wissen es jetzt.");
      setErgebnisOffen(false);
      await chatLaden(gewaehlt, true); await listeLaden();
    } catch { melden("Keine Verbindung."); } finally { setSendet(false); }
  };

  const uebernehmen = async () => {
    if (!gewaehlt) return;
    try {
      const r = await fetch(`${API}/gespraech/${encodeURIComponent(gewaehlt)}/uebernehmen`, { method: "POST", credentials: "include" });
      const j = await r.json();
      if (!j?.ok) { melden(j?.error || "Das ließ sich nicht übernehmen."); return; }
      melden("Du bearbeitest dieses Gespräch.");
      await chatLaden(gewaehlt, true);
    } catch { melden("Keine Verbindung."); }
  };

  const notizSpeichern = async () => {
    if (!gewaehlt) return;
    try {
      const r = await fetch(`${API}/notiz`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nummer: gewaehlt, notiz: notizEntwurf }),
      });
      const j = await r.json();
      if (!j?.ok) { melden(j?.error || "Die Notiz ließ sich nicht sichern."); return; }
      melden("Notiz gesichert.");
      await chatLaden(gewaehlt, true);
    } catch { melden("Keine Verbindung."); }
  };

  useEffect(() => {
    if (!neuOffen || neuVorlagen) return;
    void fetch(`${API}/vorlagen`, { credentials: "include" }).then((r) => r.json()).then((j) => { if (j?.ok) setNeuVorlagen(j); }).catch(() => {});
  }, [neuOffen, neuVorlagen, API]);
  useEffect(() => {
    if (!neuOffen || neuSuche.trim().length < 2) { setTreffer([]); return; }
    const id = window.setTimeout(() => {
      void fetch(`${API}/suche?q=${encodeURIComponent(neuSuche.trim())}`, { credentials: "include" })
        .then((r) => r.json()).then((j) => { if (j?.ok) setTreffer(j.treffer); }).catch(() => {});
    }, 300);
    return () => window.clearTimeout(id);
  }, [neuOffen, neuSuche, API]);

  const gespraechBeginnen = async (vorlage: string) => {
    if (!neuZiel) return;
    setSendet(true);
    try {
      const r = await fetch(`${API}/starten`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nummer: neuZiel.nummer, vorlage,
          personId: neuZiel.art === "person" ? neuZiel.id : null,
          leadId: neuZiel.art === "lead" ? neuZiel.id : null,
          // Ohne Namen keine erfundene Anrede — „und willkommen" ist der Weg
          // des Hauses für genau diesen Fall (shared/fiaon-lead-texte.ts).
          werte: [neuZiel.art === "frei" ? "und willkommen" : neuZiel.name],
        }),
      });
      const j = await r.json();
      if (!j?.ok) { melden(j?.error || "Das ging nicht raus."); return; }
      melden(`Nachricht an ${neuZiel.art === "frei" ? `+${neuZiel.nummer}` : neuZiel.name} ist unterwegs.`);
      setNeuOffen(false); setNeuZiel(null); setNeuSuche(""); setTreffer([]);
      await listeLaden(); setGewaehlt(j.nummer);
    } catch { melden("Keine Verbindung."); } finally { setSendet(false); }
  };

  const maraSchalten = async (an: boolean) => {
    if (!gewaehlt) return;
    try {
      await fetch(`${API}/mara`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nummer: gewaehlt, an }) });
      melden(an ? "Mara antwortet hier wieder." : "Mara hält sich hier heraus.");
      await chatLaden(gewaehlt, true); await listeLaden();
    } catch { melden("Der Schalter ging nicht."); }
  };

  return (
    <div className={`wr${gewaehlt ? " wr-chat-offen" : ""}`}>
      <Rundgang raum="whatsapp" titel={RUNDGAENGE.whatsapp.titel} schritte={RUNDGAENGE.whatsapp.schritte} />
      <header className="wr-kopf">
        <div>
          <h1>WhatsApp</h1>
          <p className="wr-still">
            {kopf?.bereit
              ? <>Unsere Nummer: <b>{kopf?.nummer ?? "—"}</b> · {kopf?.alles ? "Du siehst alle Gespräche." : "Du siehst die Gespräche deiner Kunden."}</>
              : "Noch nicht eingerichtet — die Zugangswerte fehlen."}
          </p>
        </div>
      </header>

      <div className="wr-raum">
        {/* ── Liste ─────────────────────────────────────────────── */}
        <aside className="wr-liste" aria-label="Gespräche">
          <div className="wr-suchfeld">
            <input value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="Name, Nummer oder Text suchen" aria-label="Suchen" />
            <button type="button" className="wr-neu" onClick={() => setNeuOffen(true)} title="Neues Gespräch beginnen" aria-label="Neues Gespräch beginnen">+</button>
          </div>
          <div className="wr-filter">
            {([["alle", "Alle"], ["ungelesen", "Ungelesen"], ["offen", "Fenster offen"]] as const).map(([k, t]) => (
              <button key={k} type="button" className={filter === k ? "an" : ""} onClick={() => setFilter(k)}>{t}</button>
            ))}
          </div>
          <div className="wr-zeilen">
            {!liste ? <p className="wr-leer">Lädt …</p>
              : liste.length === 0 ? <p className="wr-leer">Noch kein Gespräch. Sobald jemand schreibt oder Mara jemanden anschreibt, steht es hier.</p>
                : liste.map((g) => (
                  <button key={g.nummer} type="button" className={`wr-zeile${g.nummer === gewaehlt ? " an" : ""}${g.ungelesen ? " neu" : ""}`} onClick={() => setGewaehlt(g.nummer)}>
                    <span className="wr-avatar" aria-hidden="true">{(g.name ?? "?").slice(0, 1).toUpperCase()}</span>
                    <span className="wr-zeile-text">
                      <span className="wr-zeile-kopf">
                        <b>{g.name ?? g.nummer}</b>
                        <span className="wr-still">{zeit(g.letzte.am)}</span>
                      </span>
                      <span className="wr-zeile-unten">
                        <span className="wr-vorschau">{g.letzte.richtung === "raus" ? "Du: " : ""}{g.letzte.text || "—"}</span>
                        {g.ungelesen > 0 && <span className="wr-punkt">{g.ungelesen}</span>}
                      </span>
                      <span className="wr-marken">
                        {g.stufe && <span className={`wr-marke stufe-${g.stufe}`}>{g.stufe}</span>}
                        {g.fensterBis && <span className="wr-marke offen">Fenster offen</span>}
                        {g.maraAn && <span className="wr-marke mara">Mara</span>}
                        {g.bearbeiter && kopf?.ich !== g.bearbeiter.id && <span className="wr-marke warn">jemand liest mit</span>}
                      </span>
                    </span>
                  </button>
                ))}
          </div>
        </aside>

        {/* ── Verlauf ───────────────────────────────────────────── */}
        <section className="wr-chat" aria-label="Verlauf">
          {!gewaehlt ? (
            <div className="wr-nichts">
              <p>Links ein Gespräch wählen.</p>
              <p className="wr-still">Frei schreiben darfst du, solange der Mensch in den letzten 24 Stunden geschrieben hat. Danach nur noch mit einer freigegebenen Vorlage — der Raum sagt dir, was gerade gilt.</p>
            </div>
          ) : (
            <>
              <div className="wr-chat-kopf">
                <button type="button" className="wr-zurueck" onClick={() => setGewaehlt(null)} aria-label="Zurück zur Liste">‹</button>
                <div className="wr-chat-wer">
                  <b>{aktuell?.name ?? gewaehlt}</b>
                  <span className="wr-still">
                    +{gewaehlt}
                    {chat?.lage?.betreuer ? ` · Betreuer: ${chat.lage.betreuer}` : ""}
                    {rest ? ` · Fenster ${rest}` : " · Fenster zu"}
                  </span>
                </div>
                <div className="wr-chat-knoepfe">
                  <button type="button" className={`wr-schalter${chat?.maraAn ? " an" : ""}`} onClick={() => void maraSchalten(!chat?.maraAn)} aria-pressed={!!chat?.maraAn}>
                    <span aria-hidden="true" />Mara
                  </button>
                  <button type="button" className={`wr-klein wr-fall-knopf${fallOffen ? " an" : ""}`} onClick={() => setFallOffen(!fallOffen)}>Fall</button>
                  {chat?.bearbeiter != null && chat.ich != null && chat.bearbeiter !== chat.ich && (
                    <button type="button" className="wr-klein" onClick={() => void uebernehmen()}>Übernehmen</button>
                  )}
                </div>
              </div>

              <div className="wr-verlauf">
                {!chat ? <p className="wr-leer">Lädt …</p> : chat.verlauf.length === 0 ? <p className="wr-leer">Noch keine Nachricht.</p> : chat.verlauf.map((n, i) => {
                  const vorher = chat.verlauf[i - 1];
                  const amTag = tag(n.empfangen_am ?? n.gesendet_am ?? n.created_at);
                  const neuerTag = !vorher || tag(vorher.empfangen_am ?? vorher.gesendet_am ?? vorher.created_at) !== amTag;
                  const raus = n.richtung === "raus";
                  const inhalt = n.text
                    ? n.text
                    : n.vorlage ? "(Vorlagentext — siehe Vorlagenname oben)"
                      : "(Nachricht, die WhatsApp nicht übertragen kann — Sprachnachricht, Bild oder Ähnliches)";
                  return (
                    <div key={n.id} className="wr-reihe">
                      {neuerTag && <div className="wr-tag">{amTag}</div>}
                      <div className={`wr-blasenreihe ${raus ? "raus" : "rein"}`}>
                        <div className={`wr-blase ${raus ? "raus" : "rein"}${n.status === "fehler" ? " fehler" : ""}`}>
                          {n.vorlage && <span className="wr-vorlagenmarke">Vorlage · {n.vorlage.replace(/^fiaon_/, "").replace(/_/g, " ")}</span>}
                          <p>{inhalt}</p>
                          <span className="wr-blase-fuss">
                            {n.von && raus ? `${n.von} · ` : ""}
                            {zeit(n.empfangen_am ?? n.gesendet_am ?? n.created_at)}
                            {raus && (
                              <span className={`wr-haken${n.gelesen_am ? " gelesen" : ""}`} title={n.status === "fehler" ? "nicht zugestellt" : n.gelesen_am ? "gelesen" : n.zugestellt_am ? "zugestellt" : "gesendet"}>
                                {n.status === "fehler" ? " ✕" : n.gelesen_am || n.zugestellt_am ? " ✓✓" : " ✓"}
                              </span>
                            )}
                          </span>
                          {n.status === "fehler" && (
                            <span className="wr-fehlertext">
                              {/undeliverable/i.test(n.fehler ?? "")
                                ? "Nicht zugestellt — diese Nummer hat kein WhatsApp."
                                : n.fehler}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={endeRef} />
              </div>

              {/* ── Eingabe ─────────────────────────────────────── */}
              <div className="wr-eingabe">
                {chat?.fensterOffen ? (
                  <>
                    <textarea
                      value={entwurf}
                      onChange={(e) => setEntwurf(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && entwurf.trim()) void senden({ text: entwurf.trim() }); }}
                      placeholder="Nachricht schreiben … (⌘ + Enter sendet)"
                      rows={2}
                      aria-label="Nachricht"
                    />
                    <div className="wr-eingabe-tun">
                      {/* E-218: Die Links, die im Verkauf ständig gebraucht werden —
                          ein Klick setzt sie in den Entwurf, statt sie zu tippen. */}
                      {chat?.links && (
                        <div className="wr-links">
                          <button type="button" title="Antragslink einfügen" onClick={() => setEntwurf((t) => `${t}${t && !t.endsWith(" ") ? " " : ""}${chat.links.antrag}`)}>Antrag</button>
                          {chat.links.zahlung && <button type="button" title="Zahlungslink einfügen" onClick={() => setEntwurf((t) => `${t}${t && !t.endsWith(" ") ? " " : ""}${chat.links.zahlung}`)}>Zahlung</button>}
                          <button type="button" title="Terminlink einfügen" onClick={() => setEntwurf((t) => `${t}${t && !t.endsWith(" ") ? " " : ""}${chat.links.termin}`)}>Termin</button>
                          <button type="button" className={vorlageOffen ? "an" : ""} onClick={() => setVorlageOffen(!vorlageOffen)} title="Freigegebene Vorlagen">Vorlagen</button>
                        </div>
                      )}
                      <button type="button" className="wr-senden" disabled={sendet || !entwurf.trim()} onClick={() => void senden({ text: entwurf.trim() })}>
                        {sendet ? "Sendet …" : "Senden"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="wr-zu">
                    <p>
                      <b>Das 24-Stunden-Fenster ist zu.</b> Jetzt geht nur eine von Meta freigegebene Vorlage.
                      Antwortet der Mensch darauf, kannst du wieder frei schreiben.
                    </p>
                    <button type="button" className="wr-knopf" onClick={() => setVorlageOffen(!vorlageOffen)}>
                      {vorlageOffen ? "Vorlagen schließen" : `Vorlage wählen${chat?.vorlagen.length ? ` (${chat.vorlagen.length})` : ""}`}
                    </button>
                  </div>
                )}
              </div>

              {vorlageOffen && (
                <div className="wr-vorlagen">
                  {chat?.vorlagen.length ? chat.vorlagen.map((v) => (
                    <div key={v.name} className="wr-vorlage">
                      <div className="wr-vorlage-kopf"><b>{v.name.replace(/^fiaon_/, "").replace(/_/g, " ")}</b><span className="wr-still">{v.zweck ?? ""}</span></div>
                      <p>{(v.text ?? "").replace("{{1}}", aktuell?.name ?? "Maria Muster")}</p>
                      <button type="button" className="wr-knopf voll" disabled={sendet}
                        onClick={() => void senden({ vorlage: v.name, werte: [aktuell?.name ?? "und willkommen"] })}>
                        Diese Vorlage senden
                      </button>
                    </div>
                  )) : <p className="wr-leer">Noch keine Vorlage freigegeben — Meta prüft sie gerade.</p>}
                </div>
              )}
            </>
          )}
        </section>

        {/* ══════════════════════════════════════════════════════════════
            DER FALL (23.09.2026, E-218)

            Justin: „Ein Mitarbeiter soll auch darüber Vertrieb machen können."
            Dafür braucht er hier dasselbe wie am Telefon: wer das ist, wo er
            steht, was offen ist — und die Handlungen, ohne die Seite zu
            wechseln. Am Handy klappt die Spalte über den Kopf auf.
            ══════════════════════════════════════════════════════════════ */}
        {gewaehlt && chat?.lage && (
          <aside className={`wr-person${fallOffen ? " auf" : ""}`} aria-label="Der Fall">
            <h2>{chat.lage.name || aktuell?.name || "Unbekannt"}</h2>
            <div className="wr-marken">
              {chat.lage.stufe && <span className={`wr-marke stufe-${String(chat.lage.stufe).toLowerCase()}`}>{chat.lage.stufe === "Kunde" ? "Kunde" : `Stufe ${chat.lage.stufe}`}</span>}
              {chat.lage.gekuendigt_am && <span className="wr-marke gekuendigt">Gekündigt</span>}
              {chat.lage.mandat_seit && <span className="wr-marke">Mandat</span>}
              {Number(chat.lage.nicht_erreicht) > 0 && <span className="wr-marke warn">{chat.lage.nicht_erreicht}× nicht erreicht</span>}
            </div>

            <dl>
              {chat.lage.paket && <><dt>Paket</dt><dd>{String(chat.lage.paket).split("\n")[0]}</dd></>}
              {chat.lage.zahlstatus && <><dt>Zahlung</dt><dd>{ZAHLTEXT[chat.lage.zahlstatus] ?? chat.lage.zahlstatus}</dd></>}
              {chat.lage.rate_nr != null && (
                <><dt>Offene Rate</dt><dd>
                  Rate {chat.lage.rate_nr} · {(Number(chat.lage.betrag_cents || 0) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 })} €
                  {chat.lage.faellig_am ? ` · fällig ${tag(chat.lage.faellig_am)}` : ""}
                </dd></>
              )}
              {chat.lage.termin && <><dt>Termin</dt><dd>{tag(chat.lage.termin)} {zeit(chat.lage.termin)}</dd></>}
              {chat.lage.promised_payment_date && <><dt>Zusage</dt><dd>{tag(chat.lage.promised_payment_date)}</dd></>}
              {chat.lage.follow_up_date && <><dt>Wiedervorlage</dt><dd>{tag(chat.lage.follow_up_date)}</dd></>}
              {chat.lage.letzter_kontakt && <><dt>Zuletzt gesprochen</dt><dd>{tag(chat.lage.letzter_kontakt)}</dd></>}
              {chat.lage.betreuer && <><dt>Betreuer</dt><dd>{chat.lage.betreuer}</dd></>}
              {chat.lage.email && <><dt>E-Mail</dt><dd>{chat.lage.email}</dd></>}
              {chat.lage.ref && <><dt>Antrag</dt><dd>{chat.lage.ref}</dd></>}
            </dl>
            {chat.lage.anzeige && <p className="wr-still">Kam über: {chat.lage.anzeige}</p>}

            <div className="wr-person-knoepfe">
              {!chat.lage.istLead && <a className="wr-knopf" href={`/agent/pipeline?person=${chat.lage.id}`} target="_blank" rel="noreferrer">Akte öffnen</a>}
              {chat.lage.phone && <a className="wr-knopf" href={`tel:${chat.lage.phone}`}>Anrufen</a>}
              {chat.links?.zahlung && <a className="wr-knopf" href={chat.links.zahlung} target="_blank" rel="noreferrer">Zahlseite</a>}
            </div>

            {/* ── Ergebnis buchen ──────────────────────────────────────── */}
            {!chat.lage.istLead && (
              <div className="wr-ergebnis">
                <button type="button" className="wr-knopf voll" onClick={() => setErgebnisOffen(!ergebnisOffen)}>
                  {ergebnisOffen ? "Schließen" : "Ergebnis buchen"}
                </button>
                {ergebnisOffen && (
                  <div className="wr-ergebnis-liste">
                    <p className="wr-still">Das Ergebnis geht denselben Weg wie in der Akte — Wiedervorlage und Pipeline ziehen mit.</p>
                    {chat.ergebnisse.map((e) => (
                      <button key={e.wert} type="button" className="wr-klein" disabled={sendet} onClick={() => void ergebnisBuchen(e.wert)}>
                        {e.text}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Notiz ───────────────────────────────────────────────── */}
            <div className="wr-notiz">
              <label htmlFor="wr-notiz-feld">Notiz zum Gespräch</label>
              <textarea id="wr-notiz-feld" rows={2} value={notizEntwurf} maxLength={1000}
                        onChange={(e) => setNotizEntwurf(e.target.value)}
                        placeholder="Was man beim nächsten Mal wissen muss." />
              {notizEntwurf !== (chat.notiz ?? "") && (
                <button type="button" className="wr-klein" onClick={() => void notizSpeichern()}>Notiz sichern</button>
              )}
            </div>

            <p className="wr-still wr-hinweis">
              Mahnungen, Forderungen und Ratenrückstände gehen nie über WhatsApp — das verbietet Meta und kostet im
              Ernstfall unsere Nummer. Dafür bleiben Mail, Telefon und Brief.
            </p>
          </aside>
        )}
      </div>

      {neuOffen && (
        <div className="wr-schleier" role="dialog" aria-modal="true" aria-label="Neues Gespräch" onClick={() => setNeuOffen(false)}>
          <div className="wr-fenster" onClick={(e) => e.stopPropagation()}>
            <div className="wr-fenster-kopf">
              <div>
                <h2>Neues Gespräch</h2>
                <p className="wr-still">Wer nie geschrieben hat, darf nur eine von Meta freigegebene Vorlage bekommen. Antwortet er darauf, könnt ihr 24 Stunden frei schreiben.</p>
              </div>
              <button type="button" className="wr-klein" onClick={() => setNeuOffen(false)}>Schließen</button>
            </div>
            {!neuZiel ? (
              <>
                <input className="wr-feld" autoFocus value={neuSuche} onChange={(e) => setNeuSuche(e.target.value)} placeholder="Name, E-Mail oder Nummer — oder eine Nummer frei eintippen" aria-label="Menschen suchen" />
                {/* E-220: Justin — „auch nur eine Nummer frei eintippen und
                    schreiben". Wer eine Nummer tippt, kommt direkt weiter,
                    auch wenn dazu niemand im System steht. */}
                {freieNummer && (
                  <button type="button" className="wr-treffer-zeile wr-frei" onClick={() => setNeuZiel({ art: "frei", id: 0, name: freieNummer, nummer: freieNummer })}>
                    <span><b>+{freieNummer}</b> <span className="wr-still">frei eingetippt</span></span>
                    <span className="wr-still">An diese Nummer schreiben</span>
                  </button>
                )}
                <div className="wr-treffer">
                  {neuSuche.trim().length < 2 ? <p className="wr-still">Tippe einen Namen, eine E-Mail oder eine Nummer. Eine Nummer geht auch ohne Datensatz.</p>
                    : treffer.length === 0 && !freieNummer ? <p className="wr-still">Niemand gefunden. Tippe die Nummer mit Landesvorwahl, dann geht es trotzdem.</p>
                      : treffer.map((t) => (
                        <button key={`${t.art}-${t.id}`} type="button" className="wr-treffer-zeile" onClick={() => setNeuZiel(t)}>
                          <span><b>{t.name}</b> <span className="wr-still">+{t.nummer}</span></span>
                          <span className="wr-still">{t.art === "lead" ? "Interessent" : "Kunde"}{t.betreuer ? ` · ${t.betreuer}` : ""}</span>
                        </button>
                      ))}
                </div>
              </>
            ) : (
              <>
                <p className="wr-ziel">
                  An <b>{neuZiel.art === "frei" ? `+${neuZiel.nummer}` : neuZiel.name}</b>
                  {neuZiel.art !== "frei" && <span className="wr-still"> +{neuZiel.nummer}</span>}
                  {" "}<button type="button" className="wr-klein" onClick={() => setNeuZiel(null)}>ändern</button>
                </p>
                <div className="wr-vorlagen">
                  {!neuVorlagen ? <p className="wr-still">Lädt …</p>
                    : neuVorlagen.vorlagen.length === 0 ? (
                      <p className="wr-still">
                        Noch ist keine Vorlage freigegeben{neuVorlagen.inPruefung ? ` — ${neuVorlagen.inPruefung} liegen bei Meta in Prüfung` : ""}.
                        Sobald die erste grün ist, kannst du von hier aus schreiben.
                      </p>
                    ) : neuVorlagen.vorlagen.map((v) => (
                      <div key={v.name} className="wr-vorlage">
                        <div className="wr-vorlage-kopf"><b>{v.name.replace(/^fiaon_/, "").replace(/_/g, " ")}</b><span className="wr-still">{v.zweck ?? ""}</span></div>
                        <p>{(v.text ?? "").replace("{{1}}", neuZiel.name)}</p>
                        <button type="button" className="wr-knopf voll" disabled={sendet} onClick={() => void gespraechBeginnen(v.name)}>
                          {sendet ? "Sendet …" : "Diese Vorlage senden"}
                        </button>
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {meldung && <div className="wr-meldung" role="status">{meldung}</div>}
    </div>
  );
}
