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
//
// ── NEUBAU 28.09.2026 (E-248) ─────────────────────────────────────────────
// Das Feld war im Office 23 px breit, der Raum lag grau auf der hellen
// Office-Fläche, Enter sendete nicht, drei ⌘+Enter schickten drei
// Nachrichten, der Entwurf wanderte zum nächsten Kunden, Maras interne
// Schritte überfluteten den Verlauf, und am Handy lag das Eingabefeld unter
// dem Bildschirmrand, halb unter dem Telefonknopf. Dieser Rahmen hält jetzt
// nur noch Zustand, Laden, Takt und Maße; die Teile stehen daneben:
//   Gespraechsliste · ChatKopf · Verlauf · InterneSchritte · Eingabe ·
//   VorlagenBlatt · FallSpalte · NeuesGespraech · wr-format
//
// MASSE: Die Breite entscheidet der PLATZ im Raum, nicht das Fenster
// (Container Queries in whatsapp-raum.css; derselbe Schwellwert hier im
// Rahmen, weil er entscheidet, WO der Fall steht und ob der Chat am Handy
// als eigene Vollfläche kommt). Die Höhe ist „bis zum Fensterrand", gemessen
// — das Office rechnet mit zoom .875, deshalb wird der Zoom aus dem Element
// selbst gelesen statt vorausgesetzt. Unten bleibt Platz für Telefon- und
// Rundgangknopf, sie liegen nie über dem Feld.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "@/pages/agent/rundgaenge";
import "@/styles/office-rundgang.css";
import "@/styles/whatsapp-raum.css";
import { Gespraechsliste, type ListenFilter } from "./Gespraechsliste";
import { ChatKopf } from "./ChatKopf";
import { Verlauf } from "./Verlauf";
import { Eingabe, TEXT_GRENZE } from "./Eingabe";
import { FallSpalte } from "./FallSpalte";
import { NeuesGespraech } from "./NeuesGespraech";
import { eintraegeBauen, restZeit, type ChatDaten, type Gespraech, type Vorlage } from "./wr-format";

type Modus = "breit" | "mittel" | "schmal";
const BREIT_AB = 1100;
const MITTEL_AB = 760;

const ENTWURF_SCHLUESSEL = "fiaon_wa_entwuerfe";
const SCHRITTE_SCHLUESSEL = "fiaon_wa_alle_schritte";
function lesen<T>(k: string, sonst: T): T {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : sonst; } catch { return sonst; }
}
function schreiben(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* privates Fenster — dann eben nur im Speicher */ }
}

export default function WhatsAppRaum({ basis, telefon }: {
  basis: string;
  /** Anrufen über das Softphone (Office) oder den tel:-Link (Chefbüro, kein Softphone). */
  telefon?: "softphone" | "tel";
}) {
  const API = `/api/fiaon${basis}`;
  const mitSoftphone = (telefon ?? (basis.startsWith("/agent") ? "softphone" : "tel")) === "softphone";

  const [liste, setListe] = useState<Gespraech[] | null>(null);
  const [kopf, setKopf] = useState<{ nummer: string | null; bereit: boolean; ich: number | null; alles: boolean } | null>(null);
  const [suche, setSuche] = useState("");
  const [filter, setFilter] = useState<ListenFilter>("alle");
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [chat, setChat] = useState<(ChatDaten & { nummer: string }) | null>(null);
  const [fallOffen, setFallOffen] = useState(false);
  const [notizEntwurf, setNotizEntwurf] = useState("");
  const [ergebnisOffen, setErgebnisOffen] = useState(false);
  // E-248 (E4): Der Entwurf gehört der NUMMER — nie wandert Text zum nächsten Kunden.
  const [entwuerfe, setEntwuerfe] = useState<Record<string, string>>(() => lesen(ENTWURF_SCHLUESSEL, {}));
  const [sendet, setSendet] = useState(false);
  const sperre = useRef(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [blattOffen, setBlattOffen] = useState(false);
  const [neuOffen, setNeuOffen] = useState(false);
  const [alleSchritte, setAlleSchritte] = useState<boolean>(() => lesen(SCHRITTE_SCHLUESSEL, false));
  const [zumEnde, setZumEnde] = useState(0);
  const [fokus, setFokus] = useState(0);
  const [modus, setModus] = useState<Modus>("breit");
  // E-261 (29.09.2026): Steht die WhatsApp-Bremse (Pause oder Meta ROT)? Nur Anzeige — aktivieren kann nur der Inhaber im Chefbüro.
  const [bremse, setBremse] = useState<{ pause: boolean; art?: string | null; allesGestoppt: boolean; werbungGestoppt: boolean; qualitaet: string | null; satz: string | null } | null>(null);
  const wrRef = useRef<HTMLDivElement>(null);
  const raumRef = useRef<HTMLDivElement>(null);
  const gewaehltRef = useRef<string | null>(null);
  gewaehltRef.current = gewaehlt;

  const melden = useCallback((t: string) => { setMeldung(t); window.setTimeout(() => setMeldung((m) => (m === t ? null : m)), 8000); }, []);

  // ── Laden ─────────────────────────────────────────────────────────────────
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
      // Wurde inzwischen ein anderes Gespräch gewählt, gehört diese Antwort nicht mehr hierher.
      if (gewaehltRef.current !== nummer) return;
      if (j?.ok) {
        setChat({
          nummer,
          verlauf: j.verlauf, lage: j.lage, links: j.links ?? null, fensterOffen: j.fensterOffen, maraAn: j.maraAn, maraAusGrund: j.maraAusGrund ?? null,
          notiz: j.notiz, bearbeiter: j.bearbeiter ?? null, ich: j.ich ?? null,
          vorlagen: j.vorlagen ?? [], ergebnisse: j.ergebnisse ?? [],
          ereignisse: Array.isArray(j.ereignisse) ? j.ereignisse : [],
        });
        if (!leise) { setNotizEntwurf(j.notiz ?? ""); setFokus((f) => f + 1); }
      } else melden(j?.error || "Das Gespräch ließ sich nicht laden.");
    } catch { melden("Keine Verbindung."); }
  }, [API, melden]);

  useEffect(() => { void listeLaden(); }, [listeLaden]);
  useEffect(() => {
    const laden = async () => {
      try {
        const r = await fetch(`${API}/bremse`, { credentials: "include" });
        const j = await r.json().catch(() => null);
        if (j?.ok) setBremse(j.bremse ?? null);
      } catch { /* stiller Fehlschlag, der nächste Takt holt es */ }
    };
    void laden();
    const id = window.setInterval(() => { if (!document.hidden) void laden(); }, 60_000);
    return () => window.clearInterval(id);
  }, [API]);
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.hidden) return;
      void listeLaden(); if (gewaehltRef.current) void chatLaden(gewaehltRef.current, true);
    }, 8000);
    return () => window.clearInterval(id);
  }, [listeLaden, chatLaden]);
  useEffect(() => {
    setBlattOffen(false); setErgebnisOffen(false);
    if (gewaehlt) void chatLaden(gewaehlt); else setChat(null);
  }, [gewaehlt, chatLaden]);

  useEffect(() => { const id = window.setTimeout(() => schreiben(ENTWURF_SCHLUESSEL, entwuerfe), 300); return () => window.clearTimeout(id); }, [entwuerfe]);
  useEffect(() => { schreiben(SCHRITTE_SCHLUESSEL, alleSchritte); }, [alleSchritte]);

  const eintraege = useMemo(() => (chat ? eintraegeBauen(chat.verlauf, chat.ereignisse) : []), [chat]);
  const aktuell = useMemo(() => liste?.find((g) => g.nummer === gewaehlt) ?? null, [liste, gewaehlt]);
  const chatDa = !!chat && chat.nummer === gewaehlt;
  const name = (chatDa ? chat!.lage?.name : null) || aktuell?.name || (gewaehlt ? `+${gewaehlt}` : "");

  // ── Maße: Modus nach dem Platz, Höhe bis zum Fensterrand ─────────────────
  useLayoutEffect(() => {
    const el = wrRef.current; if (!el) return;
    const setzen = (b: number) => setModus(b >= BREIT_AB ? "breit" : b >= MITTEL_AB ? "mittel" : "schmal");
    setzen(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((e) => setzen(e[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const vollbild = modus === "schmal" && !!gewaehlt;

  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("wr-da");
    html.classList.toggle("wr-telefon", mitSoftphone);
    return () => { html.classList.remove("wr-da", "wr-telefon", "wr-vollbild"); };
  }, [mitSoftphone]);
  useEffect(() => { document.documentElement.classList.toggle("wr-vollbild", vollbild); }, [vollbild]);

  // Handy: Die Vollfläche folgt dem sichtbaren Bereich — geht die Tastatur auf,
  // rückt das Feld mit, statt darunter zu verschwinden.
  useEffect(() => {
    if (!vollbild) return;
    const vv = window.visualViewport;
    const html = document.documentElement;
    const setzen = () => {
      html.style.setProperty("--wr-vv-h", `${Math.round(vv ? vv.height : window.innerHeight)}px`);
      html.style.setProperty("--wr-vv-top", `${Math.round(vv ? vv.offsetTop : 0)}px`);
    };
    setzen();
    vv?.addEventListener("resize", setzen); vv?.addEventListener("scroll", setzen);
    window.addEventListener("resize", setzen);
    return () => {
      vv?.removeEventListener("resize", setzen); vv?.removeEventListener("scroll", setzen);
      window.removeEventListener("resize", setzen);
      html.style.removeProperty("--wr-vv-h"); html.style.removeProperty("--wr-vv-top");
    };
  }, [vollbild]);

  // Höhe des Raums: vom Raum-Anfang bis zum Fensterrand, minus Platz für die
  // schwebenden Knöpfe (Telefon, Rundgang), wenn sie über dem Raum lägen.
  useLayoutEffect(() => {
    const messen = () => {
      const raum = raumRef.current; if (!raum) return;
      const r = raum.getBoundingClientRect();
      const zoom = raum.offsetHeight > 0 && r.height > 0 ? r.height / raum.offsetHeight : 1;
      const vh = window.innerHeight;
      const oben = r.top + window.scrollY;
      let luft = modus === "schmal" ? 10 : 18;
      if (modus !== "schmal") {
        for (const sel of [".fi-telefonknopf", ".ru-knopf"]) {
          const b = document.querySelector(sel) as HTMLElement | null;
          if (!b) continue;
          const br = b.getBoundingClientRect();
          if (br.width > 0 && br.left < r.right && br.top > vh / 2) luft = Math.max(luft, vh - br.top + 12);
        }
      }
      const sichtbar = Math.max(380, vh - oben - luft);
      const px = Math.round(sichtbar / (zoom || 1));
      if (Math.abs(raum.offsetHeight - px) > 1) raum.style.setProperty("--wr-hoehe", `${px}px`);
    };
    messen();
    const spaeter = [300, 1200, 3500].map((ms) => window.setTimeout(messen, ms));
    window.addEventListener("resize", messen);
    return () => { spaeter.forEach((t) => window.clearTimeout(t)); window.removeEventListener("resize", messen); };
  }, [modus, gewaehlt, liste === null]);

  // ── Handlungen ────────────────────────────────────────────────────────────
  const entwurf = gewaehlt ? entwuerfe[gewaehlt] ?? "" : "";
  const entwurfSetzen = useCallback((nummer: string, t: string | ((alt: string) => string)) => {
    setEntwuerfe((alle) => {
      const neu = typeof t === "function" ? t(alle[nummer] ?? "") : t;
      const kopie = { ...alle };
      if (neu) kopie[nummer] = neu.slice(0, TEXT_GRENZE); else delete kopie[nummer];
      return kopie;
    });
  }, []);

  /** Senden — Freitext oder Vorlage. Die Sperre ist ein Ref: drei Enter im selben Takt = EINE Nachricht. */
  const senden = async (inhalt: { text?: string; vorlage?: string; werte?: string[] }) => {
    const nummer = gewaehlt;
    if (!nummer || sperre.current) return;
    sperre.current = true; setSendet(true);
    try {
      const r = await fetch(`${API}/senden`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nummer, ...inhalt }),
      });
      const j = await r.json().catch(() => null);
      if (!j?.ok) { melden(j?.error || "Das ging nicht raus."); return; }
      // Nur löschen, was gesendet wurde — wer inzwischen weitergetippt hat, behält den Rest.
      if (inhalt.text) entwurfSetzen(nummer, (alt) => (alt.trim() === inhalt.text ? "" : alt));
      setBlattOffen(false);
      setZumEnde((z) => z + 1); setFokus((f) => f + 1);
      await chatLaden(nummer, true); await listeLaden();
    } catch { melden("Keine Verbindung."); } finally { sperre.current = false; setSendet(false); }
  };

  const vorlageSenden = (v: Vorlage) => void senden({ vorlage: v.name, werte: [aktuell?.name ?? chat?.lage?.name ?? "und willkommen"] });

  // E-218: Ergebnis buchen und Notiz sichern — beide über die Hauswege.
  const ergebnisBuchen = async (ergebnis: string) => {
    if (!gewaehlt || sperre.current) return;
    sperre.current = true; setSendet(true);
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
    } catch { melden("Keine Verbindung."); } finally { sperre.current = false; setSendet(false); }
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

  const maraSchalten = async (an: boolean) => {
    if (!gewaehlt) return;
    try {
      await fetch(`${API}/mara`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nummer: gewaehlt, an }) });
      melden(an ? "Mara antwortet hier wieder." : "Mara hält sich hier heraus.");
      await chatLaden(gewaehlt, true); await listeLaden();
    } catch { melden("Der Schalter ging nicht."); }
  };

  const telefonNummer = chatDa ? (chat!.lage?.phone || (gewaehlt ? `+${gewaehlt}` : null)) : null;
  const anrufen = () => {
    if (!telefonNummer) return;
    if (mitSoftphone) {
      window.dispatchEvent(new CustomEvent("fiaon-anrufen", {
        detail: { nummer: telefonNummer, personId: chat?.lage && !chat.lage.istLead ? chat.lage.id ?? null : null, name },
      }));
    } else {
      window.location.href = `tel:${String(telefonNummer).replace(/[^\d+]/g, "")}`;
    }
  };

  const waehlen = (nummer: string) => { setFallOffen(false); setGewaehlt(nummer); };
  const zurueck = () => { setFallOffen(false); setGewaehlt(null); };

  // Die Zeile über dem Feld: Fenster, Mara, wer mitliest.
  const rest = restZeit(aktuell?.fensterBis ?? null);
  const fremdLiest = chatDa && chat!.bearbeiter != null && chat!.ich != null && chat!.bearbeiter !== chat!.ich;
  const lageZeile = chatDa ? (
    <>
      <span className={chat!.fensterOffen ? "wr-lage-offen" : "wr-lage-zu"}>
        {chat!.fensterOffen ? <>Fenster offen{rest ? ` · ${rest}` : ""}</> : "Fenster zu"}
      </span>
      <span className="wr-lage-rechts">
        {fremdLiest && <><span>Jemand liest mit</span><button type="button" className="wr-textknopf" onClick={() => void uebernehmen()}>Übernehmen</button></>}
        {!fremdLiest && (chat!.maraAn ? <span className="wr-lage-mara">Mara antwortet hier</span>
          : <span>{chat!.maraAusGrund === "schalter" ? "Mara ist hier aus" : "Mara pausiert — übernimmt nach 15 Min. ohne Antwort"}</span>)}
      </span>
    </>
  ) : null;

  const fallAlsSchublade = modus !== "breit";
  const fall = chatDa && chat!.lage ? (
    <FallSpalte chat={chat!} name={name} schublade={fallAlsSchublade} onZu={() => setFallOffen(false)}
      onAnrufen={anrufen} anrufenMoeglich={!!telefonNummer} sendet={sendet}
      ergebnisOffen={ergebnisOffen} setErgebnisOffen={setErgebnisOffen} onErgebnis={(w) => void ergebnisBuchen(w)}
      notizEntwurf={notizEntwurf} setNotizEntwurf={setNotizEntwurf} onNotiz={() => void notizSpeichern()}
      schrittSchalter={modus === "schmal"} alleSchritte={alleSchritte} onAlleSchritte={() => setAlleSchritte(!alleSchritte)} />
  ) : null;

  const chatFlaeche = (
    <section className={`wr-chat${gewaehlt ? "" : " leer"}`} aria-label="Verlauf">
      {!gewaehlt ? (
        <div className="wr-nichts">
          <p>Links ein Gespräch wählen.</p>
          <p className="wr-still">Frei schreiben darfst du, solange der Mensch in den letzten 24 Stunden geschrieben hat. Danach nur noch mit einer freigegebenen Vorlage — der Raum sagt dir, was gerade gilt.</p>
        </div>
      ) : (
        <>
          <ChatKopf
            name={name} stufe={chatDa ? chat!.lage?.stufe ?? aktuell?.stufe ?? null : aktuell?.stufe ?? null}
            betreuer={chatDa ? chat!.lage?.betreuer ?? aktuell?.betreuer ?? null : aktuell?.betreuer ?? null}
            termin={chatDa ? chat!.lage?.termin ?? null : null} terminMitarbeiter={chatDa ? chat!.lage?.termin_mitarbeiter ?? null : null}
            maraAn={chatDa ? chat!.maraAn : !!aktuell?.maraAn} maraAusGrund={chatDa ? chat!.maraAusGrund : null}
            onMara={() => void maraSchalten(!(chatDa ? chat!.maraAn : aktuell?.maraAn))}
            zurueck={modus === "schmal"} onZurueck={zurueck}
            onAnrufen={anrufen} anrufenMoeglich={!!telefonNummer}
            fallKnopf={fallAlsSchublade && !!chat?.lage} fallOffen={fallOffen} onFall={() => setFallOffen(!fallOffen)}
            schrittKnopf={modus !== "schmal"} alleSchritte={alleSchritte} onAlleSchritte={() => setAlleSchritte(!alleSchritte)}
          />
          <Verlauf nummer={gewaehlt} eintraege={chatDa ? eintraege : []} geladen={chatDa} alleSchritte={alleSchritte} zumEnde={zumEnde} />
          {chatDa && (
            <Eingabe
              nummer={gewaehlt} name={name && !name.startsWith("+") ? name : null} fensterOffen={chat!.fensterOffen} lage={lageZeile}
              wert={entwurf} setWert={(t) => entwurfSetzen(gewaehlt, t)} onSenden={(t) => void senden({ text: t })} sendet={sendet}
              vorlagen={chat!.vorlagen} links={chat!.links} onVorlage={vorlageSenden}
              blattOffen={blattOffen} setBlattOffen={setBlattOffen} fokus={fokus}
            />
          )}
          {fallAlsSchublade && fallOffen && fall}
        </>
      )}
    </section>
  );

  return (
    <div ref={wrRef} className={`wr wr-${modus}${gewaehlt ? " wr-chat-offen" : ""}`}>
      <Rundgang raum="whatsapp" titel={RUNDGAENGE.whatsapp.titel} schritte={RUNDGAENGE.whatsapp.schritte} />
      <header className="wr-kopf">
        <h1>WhatsApp</h1>
        <p className="wr-still">
          {kopf?.bereit
            ? <>Unsere Nummer <b>{kopf?.nummer ?? "—"}</b> · {kopf?.alles ? "alle Gespräche" : "die Gespräche deiner Kunden"}</>
            : kopf ? "Noch nicht eingerichtet — die Zugangswerte fehlen." : " "}
        </p>
        {bremse && (bremse.pause || bremse.werbungGestoppt) ? (
          <p className="wr-bremse" role="status">
            {bremse.allesGestoppt
              ? `WhatsApp pausiert — ${bremse.art === "zugang" ? "der Meta-Zugang ist abgelaufen" : "Meta hat das Konto gesperrt"}. Gerade geht nichts raus, auch keine Antworten. Bitte anrufen statt schreiben.`
              : bremse.pause
                ? "WhatsApp pausiert — Vorlagen gehen gerade nicht raus, Antworten im offenen Fenster schon. Wer keine offene Nachricht hat: anrufen."
                : "Meta-Qualität ROT — Werbe-Vorlagen gehen gerade nicht raus; Monatsrate, Termin und Antworten im offenen Fenster schon."}
          </p>
        ) : null}
      </header>

      <div className="wr-raum" ref={raumRef}>
        <Gespraechsliste liste={liste} gewaehlt={gewaehlt} onWaehlen={waehlen} suche={suche} setSuche={setSuche}
          filter={filter} setFilter={setFilter} onNeu={() => setNeuOffen(true)} ich={kopf?.ich ?? null} />
        {modus !== "schmal" && chatFlaeche}
        {modus === "breit" && gewaehlt && fall}
      </div>

      {/* Am Handy ist der offene Chat eine eigene Vollfläche am Dokument — so
          liegt er über Office-Kopf und Leiste (deren Stapel-Kontext ein fixes
          Element innerhalb nicht verlassen könnte) und folgt der Tastatur. */}
      {vollbild && createPortal(<div className="wr wr-schmal wr-vollflaeche">{chatFlaeche}</div>, document.body)}

      {neuOffen && (
        <NeuesGespraech api={API} onZu={() => setNeuOffen(false)} melden={melden}
          onGestartet={(nummer) => { setNeuOffen(false); void listeLaden(); waehlen(nummer); }} />
      )}

      {meldung && createPortal(<div className="wr-tokens wr-meldung-halter"><div className="wr-meldung" role="status">{meldung}</div></div>, document.body)}
    </div>
  );
}

