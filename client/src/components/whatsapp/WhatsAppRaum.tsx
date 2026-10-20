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
//   VorlagenBlatt · FallSpalte · NeuesGespraech · Medien · Avatar · Symbole ·
//   wr-format
//
// MASSE: Die Breite entscheidet der PLATZ im Raum, nicht das Fenster
// (Container Queries in whatsapp-raum.css; dieselben Schwellen hier im
// Rahmen aus shared/fiaon-wa-raum.ts, weil sie entscheiden, WO der Fall steht
// und ob der Chat am Handy als eigene Vollfläche kommt).
//
// ── E-IT-H (08.10.2026, Punkt 15): DER RAUM FÜLLT DEN BILDSCHIRM ──────────
// Team: „viel zu klein und unübersichtlich". GEMESSEN: Die Office-Hülle
// deckelte auf 1440 px (Chat 450 px bei Full HD), die Höhe wurde per JS
// gemessen und ging an Telefon- und Rundgangknopf verloren, und sie wurde nur
// zu festen Anlässen neu gemessen (die Terminleiste schob das Feld dann
// 40 px unter den Rand). Jetzt:
// · Die Hülle liefert die volle Fläche (Office: vollflaeche(true), Chefbüro:
//   Seite mit `vollflaeche`) — der Raum füllt sie per CSS, ohne Messung.
// · Liste und Fall lassen sich einklappen (Liste als Schiene, Fall über das
//   (i) im Chat-Kopf); „Schrift größer" je Mitarbeiter. Der Browser merkt
//   sich alle drei (fiaon_wa_ansicht, nur Ansicht, keine Personendaten).
// · Die Liste startet mit „Mit Antwort", lädt 200 und auf Wunsch je 200
//   ältere; Sicht, Filter und Suche laufen auf dem Server VOR der Grenze.
// · Direktsprung: ?nummer=… öffnet das Gespräch (Akte, Aufgaben, Maras
//   Übergaben); jede Wahl schreibt die Nummer in die Adresse.
//   Gegenprüfung (08.10.2026): Der Raum HÖRT auf die Adresse (useSearch aus
//   wouter), statt sie nur beim ersten Bild zu lesen. Vorher blieb Gespräch A
//   offen, wenn „WhatsApp öffnen" an Maras Karte bei schon offenem Raum auf
//   ?nummer=B sprang (gleicher Pfad → keine neue Seite), und Zurück im Browser
//   tat nichts. Jetzt öffnet jede neue Adresse ihr Gespräch; eine Adresse ohne
//   Nummer (Zurück, „WhatsApp" im Menü) führt zur Liste.
//
// ── NEUBAU 20.10.2026: WIE WHATSAPP, NUR IN FIAON ─────────────────────────
// Justin: „die WhatsApp Darstellung … ist beschissen – mach das bitte neu und
// richtig – das es schön, cleanes WhatsApp ist, wie man es kennt nur eben ein
// wenig in FIAON CI – aber viel übersichtlicher und schau das ALLES 100%
// funktioniert!"
// · EIN Rahmen wie WhatsApp Web: Liste · Chat · Kontaktinfo, durch feine
//   Linien getrennt; kein Seitenkopf mehr — „WhatsApp", Stift und ⋮ stehen
//   oben in der Liste (Schrift größer, Liste schmal, Maras Schritte und
//   Rundgang im ⋮-Menü statt als Knopfwand).
// · Blasen mit Zipfel, Zeit und Häkchen in der Blase, Hintergrund wie bei
//   WhatsApp in FIAON-Blau, Vorlagen mit Kopf/Bild/Knöpfen, Fotos und
//   Sprachnachrichten direkt im Verlauf, Reaktionen an der Blase.
// · Beim Öffnen „2 ungelesene Nachrichten" vor den neuen (die Zahl aus der
//   Liste, bevor der Server sie als gelesen merkt).
// · Scheitert das Senden, steht der Grund rot über dem Feld (nicht nur acht
//   Sekunden oben) und der Text bleibt — kein Schein-Erfolg.
// · Akte über die EINE Adresse /akte/<Kennung> (E-315).
// · Alles andere (Takt, Adresse, Sperre gegen Doppelversand, Entwurf je
//   Nummer, Handy-Vollfläche, Telefonknopf-Ecke) ist unverändert übernommen.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearch } from "wouter";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "@/pages/agent/rundgaenge";
import { akteLink } from "@/lib/akte-link";
import "@/styles/office-rundgang.css";
import "@/styles/whatsapp-raum.css";
import {
  ANSICHT_SCHLUESSEL, LIEST_MIT_MS, LISTE_GRENZE, STANDARD_FILTER, ansichtLesen, liestMit, listenEnde, nummerAusAdresse, raumAufteilung,
  type ListenFilter, type RaumAnsicht,
} from "@shared/fiaon-wa-raum";
import { Gespraechsliste } from "./Gespraechsliste";
import { ChatKopf } from "./ChatKopf";
import { Verlauf } from "./Verlauf";
import { Eingabe, TEXT_GRENZE } from "./Eingabe";
import { FallSpalte } from "./FallSpalte";
import { NeuesGespraech } from "./NeuesGespraech";
import { ZAuge, ZFunke, ZPerson, ZSchloss } from "./Symbole";
import { eintraegeBauen, restZeit, type ChatDaten, type Gespraech, type Vorlage } from "./wr-format";

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
  // E-IT-H: Die Liste fragt erst 300 ms nach dem letzten Tastendruck (vorher bei jedem Zeichen).
  const [sucheFest, setSucheFest] = useState("");
  // Justin, 08.10.2026: Standard „Mit Antwort", „Alle" ist ein Klick.
  const [filter, setFilter] = useState<ListenFilter>(STANDARD_FILTER);
  const [grenze, setGrenze] = useState<number>(LISTE_GRENZE.start);
  const [mehr, setMehr] = useState(false);
  // E-IT-H: Direktsprung — ?nummer=… wählt das Gespräch schon beim ersten Bild (auch wenn die Hülle den Raum
  // nach ihren Prüfungen neu aufbaut; ein Effekt käme dort zu spät, die Adresse wäre schon geleert).
  const [gewaehlt, setGewaehlt] = useState<string | null>(() => (typeof window === "undefined" ? null : nummerAusAdresse(window.location.search)));
  // … und danach jede neue Adresse (wouter meldet pushState, replaceState und Zurück/Vor).
  const adresse = useSearch();
  const [chat, setChat] = useState<(ChatDaten & { nummer: string }) | null>(null);
  const [fallOffen, setFallOffen] = useState(false);
  const [notizEntwurf, setNotizEntwurf] = useState("");
  const [ergebnisOffen, setErgebnisOffen] = useState(false);
  // E-248 (E4): Der Entwurf gehört der NUMMER — nie wandert Text zum nächsten Kunden.
  const [entwuerfe, setEntwuerfe] = useState<Record<string, string>>(() => lesen(ENTWURF_SCHLUESSEL, {}));
  const [sendet, setSendet] = useState(false);
  const sperre = useRef(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  // 20.10.2026: Warum das Senden scheiterte — gehört der Nummer, steht über dem Feld, bis erneut gesendet oder weggeklickt.
  const [sendeFehler, setSendeFehler] = useState<{ nummer: string; text: string } | null>(null);
  const [blattOffen, setBlattOffen] = useState(false);
  const [neuOffen, setNeuOffen] = useState(false);
  const [alleSchritte, setAlleSchritte] = useState<boolean>(() => lesen(SCHRITTE_SCHLUESSEL, false));
  const [zumEnde, setZumEnde] = useState(0);
  const [fokus, setFokus] = useState(0);
  // E-IT-H: Breite des Raums (CSS-px) → Modus und Aufteilung; die Ansicht wählt der Mitarbeiter.
  const [breite, setBreite] = useState(1280);
  const [ansicht, setAnsicht] = useState<RaumAnsicht>(() => ansichtLesen(lesen(ANSICHT_SCHLUESSEL, {})));
  const rundgangStart = useRef<(() => void) | null>(null);
  // E-261 (29.09.2026): Steht die WhatsApp-Bremse (Pause oder Meta ROT)? Nur Anzeige — aktivieren kann nur der Inhaber im Chefbüro.
  const [bremse, setBremse] = useState<{ pause: boolean; art?: string | null; allesGestoppt: boolean; werbungGestoppt: boolean; qualitaet: string | null; satz: string | null } | null>(null);
  // 20.10.2026: „2 ungelesene Nachrichten" — die Zahl aus der Liste beim Öffnen (danach merkt der Server sie als gelesen).
  const [ungelesenBeimOeffnen, setUngelesenBeimOeffnen] = useState<{ nummer: string; anzahl: number } | null>(null);
  // 20.10.2026: „Tom liest mit" — einmal gesehen, gilt es zwei Minuten (sitzen zwei im selben Gespräch, meldet
  // der Server abwechselnd den einen und den anderen; ohne dieses Merken flackerte die Zeile im 8-Sekunden-Takt).
  const [fremdSicht, setFremdSicht] = useState<{ nummer: string; name: string; am: number } | null>(null);
  const wrRef = useRef<HTMLDivElement>(null);
  const gewaehltRef = useRef<string | null>(null);
  gewaehltRef.current = gewaehlt;
  // Nur die JÜNGSTE Listenanfrage zählt — sonst überschriebe ein später ankommender 8-s-Abruf
  // mit dem alten Filter die Liste, die gerade zum neuen Filter geladen wurde.
  const listenAnfrage = useRef(0);

  const melden = useCallback((t: string) => { setMeldung(t); window.setTimeout(() => setMeldung((m) => (m === t ? null : m)), 8000); }, []);

  // ── Laden ─────────────────────────────────────────────────────────────────
  const listeLaden = useCallback(async () => {
    const nr = ++listenAnfrage.current;
    try {
      const r = await fetch(`${API}/gespraeche?suche=${encodeURIComponent(sucheFest)}&filter=${filter}&limit=${grenze}`, { credentials: "include" });
      const j = await r.json();
      if (nr !== listenAnfrage.current) return;
      if (j?.ok) { setListe(j.gespraeche); setMehr(!!j.mehr); setKopf({ nummer: j.nummer, bereit: j.bereit, ich: j.ich, alles: j.alles }); }
    } catch { /* stiller Fehlschlag, der nächste Takt holt es */ }
  }, [API, sucheFest, filter, grenze]);

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
          bearbeiterSeit: j.bearbeiterSeit ?? null, bearbeiterName: j.bearbeiterName ?? null,
          vorlagen: j.vorlagen ?? [], ergebnisse: j.ergebnisse ?? [],
          ereignisse: Array.isArray(j.ereignisse) ? j.ereignisse : [],
        });
        if (liestMit({ id: j.bearbeiter ?? null, seit: j.bearbeiterSeit ?? null }, j.ich ?? null)) {
          setFremdSicht({ nummer, name: String(j.bearbeiterName ?? "").trim().split(/\s+/)[0] || "Jemand", am: Date.now() });
        }
        if (!leise) {
          setNotizEntwurf(j.notiz ?? ""); setFokus((f) => f + 1);
          // „2 ungelesene Nachrichten": was VOR diesem Öffnen ungelesen war (der Server zählt es, bevor er es als gelesen merkt).
          if (typeof j.ungelesenVorher === "number") setUngelesenBeimOeffnen({ nummer, anzahl: j.ungelesenVorher });
        }
      } else {
        melden(j?.error || "Das Gespräch ließ sich nicht laden.");
        // E-IT-H: Gehört das Gespräch einem anderen oder gibt es noch keins (Direktsprung aus Akte
        // oder Aufgabe), steht nicht ewig „Lädt …" — der Raum geht zurück zur Liste.
        if (!leise && (r.status === 403 || r.status === 404)) setGewaehlt((g) => (g === nummer ? null : g));
      }
    } catch { melden("Keine Verbindung."); }
  }, [API, melden]);

  useEffect(() => { void listeLaden(); }, [listeLaden]);
  // Neue Suche oder neuer Filter: wieder mit der ersten Seite beginnen (im selben Takt — eine Anfrage, nicht zwei).
  useEffect(() => {
    const id = window.setTimeout(() => {
      setSucheFest(suche.trim()); setGrenze(LISTE_GRENZE.start);
    }, 300);
    return () => window.clearTimeout(id);
  }, [suche]);
  const filterWaehlen = (f: ListenFilter) => { setFilter(f); setGrenze(LISTE_GRENZE.start); };
  useEffect(() => { schreiben(ANSICHT_SCHLUESSEL, ansicht); }, [ansicht]);
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
    // 20.10.2026: Der Streifen „N ungelesene Nachrichten" gilt je Öffnen — die Zahl liefert der Server (ungelesenVorher).
    setUngelesenBeimOeffnen(null);
    if (gewaehlt) void chatLaden(gewaehlt); else setChat(null);
  }, [gewaehlt, chatLaden]);

  useEffect(() => { const id = window.setTimeout(() => schreiben(ENTWURF_SCHLUESSEL, entwuerfe), 300); return () => window.clearTimeout(id); }, [entwuerfe]);
  useEffect(() => { schreiben(SCHRITTE_SCHLUESSEL, alleSchritte); }, [alleSchritte]);

  const ungelesenHier = ungelesenBeimOeffnen && ungelesenBeimOeffnen.nummer === chat?.nummer ? ungelesenBeimOeffnen.anzahl : 0;
  const eintraege = useMemo(() => (chat ? eintraegeBauen(chat.verlauf, chat.ereignisse, new Date(), { ungelesen: ungelesenHier }) : []), [chat, ungelesenHier]);
  const aktuell = useMemo(() => liste?.find((g) => g.nummer === gewaehlt) ?? null, [liste, gewaehlt]);
  const chatDa = !!chat && chat.nummer === gewaehlt;
  const name = (chatDa ? chat!.lage?.name : null) || aktuell?.name || (gewaehlt ? `+${gewaehlt}` : "");

  // ── Maße: Modus und Aufteilung nach dem Platz (keine Höhenmessung mehr) ──
  useLayoutEffect(() => {
    const el = wrRef.current; if (!el) return;
    // Breite 0 heißt „gerade nicht gelegt" (Umbau der Hülle, verborgener Tab) — nicht „Handy". Sonst
    // blitzte am Rechner kurz die Handy-Vollfläche auf.
    const setzen = (b: number) => { if (b > 0) setBreite(Math.round(b)); };
    setzen(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((e) => setzen(e[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { modus, listeSchmal, fallSpalte } = raumAufteilung(breite, ansicht);
  // Wechselt der Modus (Fenster schmaler/breiter), schließt eine offene Schublade.
  useEffect(() => { setFallOffen(false); }, [modus]);

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

  // ── Direktsprung: die Adresse wählt das Gespräch — auch bei schon offenem Raum ──
  // Ein Link auf denselben Pfad (Maras Karte „WhatsApp öffnen", „Chat im WhatsApp-Raum öffnen") baut die
  // Seite nicht neu; ohne dieses Hören stand B in der Adresse und A blieb offen. Das eigene replaceState
  // unten meldet wouter ebenfalls — dann ist die Nummer schon gewählt, es entsteht keine Schleife.
  useEffect(() => {
    const n = nummerAusAdresse(adresse);
    if (n !== gewaehltRef.current) { setFallOffen(false); setGewaehlt(n); }
  }, [adresse]);

  // ── … und jede Wahl steht in der Adresse (Neuladen und Lesezeichen öffnen dasselbe Gespräch) ──
  useEffect(() => {
    try {
      const u = new URL(window.location.href);
      if (gewaehlt) u.searchParams.set("nummer", gewaehlt); else u.searchParams.delete("nummer");
      if (u.href !== window.location.href) window.history.replaceState(window.history.state, "", u.pathname + u.search + u.hash);
    } catch { /* Adresse bleibt, wie sie ist */ }
  }, [gewaehlt]);

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
    sperre.current = true; setSendet(true); setSendeFehler(null);
    try {
      const r = await fetch(`${API}/senden`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nummer, ...inhalt }),
      });
      const j = await r.json().catch(() => null);
      if (!j?.ok) {
        // 20.10.2026: ehrlich und sichtbar — der Grund steht über dem Feld, der Text bleibt drin.
        setSendeFehler({ nummer, text: j?.error || `Das ging nicht raus (Fehler ${r.status}).` });
        return;
      }
      // Nur löschen, was gesendet wurde — wer inzwischen weitergetippt hat, behält den Rest.
      if (inhalt.text) entwurfSetzen(nummer, (alt) => (alt.trim() === inhalt.text ? "" : alt));
      setBlattOffen(false);
      setZumEnde((z) => z + 1); setFokus((f) => f + 1);
      await chatLaden(nummer, true); await listeLaden();
    } catch {
      setSendeFehler({ nummer, text: "Keine Verbindung — nichts wurde gesendet. Bitte gleich noch einmal." });
    } finally { sperre.current = false; setSendet(false); }
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
      setFremdSicht(null);
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
      const r = await fetch(`${API}/mara`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nummer: gewaehlt, an }) });
      const j = await r.json().catch(() => null);
      if (!j?.ok) { melden(j?.error || "Der Schalter ging nicht."); return; }
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

  // Die EINE Akte (E-315): Person → /akte/<id>, Interessent → /akte/lead-<id>; ohne Menschen keine Akte.
  const lage = chatDa ? chat!.lage : null;
  const akte = lage?.id ? akteLink(lage.istLead ? `lead-${lage.id}` : lage.id) : null;
  const maraAn = chatDa ? chat!.maraAn : !!aktuell?.maraAn;
  const maraAusGrund = chatDa ? chat!.maraAusGrund : aktuell?.maraAusGrund ?? null;

  // Die Zeile über dem Feld: Fenster, Mara, wer mitliest — ruhig, ein Punkt Farbe.
  const rest = restZeit(aktuell?.fensterBis ?? null);
  const fremd = chatDa && fremdSicht && fremdSicht.nummer === gewaehlt && Date.now() - fremdSicht.am <= LIEST_MIT_MS ? fremdSicht.name : null;
  const lageZeile = chatDa ? (
    <>
      <span className={chat!.fensterOffen ? "wr-lage-offen" : "wr-lage-zu"} title={chat!.fensterOffen
        ? "Der Kunde hat in den letzten 24 Stunden geschrieben — du darfst frei schreiben."
        : "Seit über 24 Stunden keine Nachricht vom Kunden — nur freigegebene Vorlagen."}>
        {chat!.fensterOffen ? <><i className="wr-lage-punkt" aria-hidden="true" />Fenster offen{rest ? ` · ${rest}` : ""}</> : <><ZSchloss g={13} />Fenster zu</>}
      </span>
      <span className="wr-lage-rechts">
        {fremd && <><span className="wr-lage-liest"><ZAuge g={13} />{fremd} liest mit</span><button type="button" className="wr-textknopf" onClick={() => void uebernehmen()}>Übernehmen</button></>}
        {!fremd && (maraAn ? <span className="wr-lage-mara"><ZFunke g={13} />Mara antwortet<span className="wr-lang"> hier</span></span>
          : <span><ZPerson g={13} />{maraAusGrund === "schalter" ? "Mara ist hier aus" : <>Mara pausiert<span className="wr-lang"> — übernimmt nach 15 Min. ohne Antwort</span></>}</span>)}
      </span>
    </>
  ) : null;

  const fallAlsSchublade = !fallSpalte;
  const fallZu = () => (fallAlsSchublade ? setFallOffen(false) : setAnsicht((a) => ({ ...a, fall: false })));
  const fall = chatDa && chat!.lage && gewaehlt ? (
    <FallSpalte chat={chat!} name={name} nummer={gewaehlt} schublade={fallAlsSchublade} onZu={fallZu}
      onAnrufen={anrufen} anrufenMoeglich={!!telefonNummer} sendet={sendet} akteLink={akte}
      ergebnisOffen={ergebnisOffen} setErgebnisOffen={setErgebnisOffen} onErgebnis={(w) => void ergebnisBuchen(w)}
      notizEntwurf={notizEntwurf} setNotizEntwurf={setNotizEntwurf} onNotiz={() => void notizSpeichern()}
      maraAn={maraAn} maraAusGrund={maraAusGrund} onMara={() => void maraSchalten(!maraAn)}
      schrittSchalter={modus === "schmal"} alleSchritte={alleSchritte} onAlleSchritte={() => setAlleSchritte(!alleSchritte)} />
  ) : null;

  const chatFlaeche = (
    <section className={`wr-chat${gewaehlt ? "" : " leer"}`} aria-label="Verlauf">
      {!gewaehlt ? (
        <div className="wr-nichts">
          <div className="wr-nichts-bild" aria-hidden="true">
            <svg width="64" height="64" viewBox="0 0 64 64"><defs><linearGradient id="wr-nb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#288dfa" /><stop offset="1" stopColor="#1d4ed8" /></linearGradient></defs>
              <path d="M32 8C18.2 8 7 17.6 7 29.5c0 6.6 3.5 12.5 9 16.4L13.5 56l11.4-5.7c2.2.5 4.6.8 7.1.8 13.8 0 25-9.6 25-21.5S45.8 8 32 8z" fill="url(#wr-nb)" opacity=".9" />
              <path d="M22 30.5l6.5 6.5L42 23.5" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <p className="wr-nichts-titel">WhatsApp im Team</p>
          <p className="wr-still">Wähle links ein Gespräch.</p>
          <p className="wr-still wr-nichts-regel">Frei schreiben geht 24 Stunden nach der letzten Nachricht des Kunden — danach nur freigegebene Vorlagen. Der Raum zeigt dir, was gerade gilt.</p>
        </div>
      ) : (
        <>
          <ChatKopf
            name={name} nummer={gewaehlt}
            stufe={chatDa ? chat!.lage?.stufe ?? aktuell?.stufe ?? null : aktuell?.stufe ?? null}
            betreuer={chatDa ? chat!.lage?.betreuer ?? aktuell?.betreuer ?? null : aktuell?.betreuer ?? null}
            termin={chatDa ? chat!.lage?.termin ?? null : null} terminMitarbeiter={chatDa ? chat!.lage?.termin_mitarbeiter ?? null : null}
            maraAn={maraAn} maraAusGrund={maraAusGrund}
            onMara={() => void maraSchalten(!maraAn)}
            zurueck={modus === "schmal"} onZurueck={zurueck}
            onAnrufen={anrufen} anrufenMoeglich={!!telefonNummer}
            akteLink={akte}
            fallKnopf={chatDa && !!chat!.lage}
            fallOffen={modus === "breit" ? fallSpalte : fallOffen}
            onFall={() => (modus === "breit" ? setAnsicht((a) => ({ ...a, fall: !fallSpalte })) : setFallOffen(!fallOffen))}
          />
          <Verlauf nummer={gewaehlt} eintraege={chatDa ? eintraege : []} geladen={chatDa} alleSchritte={alleSchritte} zumEnde={zumEnde} api={API} />
          {chatDa && (
            <Eingabe
              nummer={gewaehlt} name={name && !name.startsWith("+") ? name : null} fensterOffen={chat!.fensterOffen} lage={lageZeile}
              wert={entwurf} setWert={(t) => entwurfSetzen(gewaehlt, t)} onSenden={(t) => void senden({ text: t })} sendet={sendet}
              vorlagen={chat!.vorlagen} links={chat!.links} onVorlage={vorlageSenden}
              blattOffen={blattOffen} setBlattOffen={setBlattOffen} fokus={fokus}
              fehler={sendeFehler && sendeFehler.nummer === gewaehlt ? sendeFehler.text : null} onFehlerZu={() => setSendeFehler(null)}
            />
          )}
          {fallAlsSchublade && fallOffen && fall}
        </>
      )}
    </section>
  );

  const schriftKlasse = ansicht.schrift === "gross" ? " wr-schrift-gross" : "";
  const mitFall = fallSpalte && !!gewaehlt && (!chatDa || !!chat!.lage);

  return (
    <div ref={wrRef} className={`wr wr-${modus}${gewaehlt ? " wr-chat-offen" : ""}${schriftKlasse}`}>
      {/* E-IT-H: kein fester Knopf unten rechts mehr — „Rundgang" steht im ⋮-Menü der Liste. */}
      <Rundgang raum="whatsapp" titel={RUNDGAENGE.whatsapp.titel} schritte={RUNDGAENGE.whatsapp.schritte} knopf="keiner" startRef={rundgangStart} />
      {bremse && (bremse.pause || bremse.werbungGestoppt) ? (
        <p className="wr-bremse" role="status">
          {bremse.allesGestoppt
            ? `WhatsApp pausiert — ${bremse.art === "zugang" ? "der Meta-Zugang ist abgelaufen" : "Meta hat das Konto gesperrt"}. Gerade geht nichts raus, auch keine Antworten. Bitte anrufen statt schreiben.`
            : bremse.pause
              ? "WhatsApp pausiert — Vorlagen gehen gerade nicht raus, Antworten im offenen Fenster schon. Wer keine offene Nachricht hat: anrufen."
              : "Meta-Qualität ROT — Werbe-Vorlagen gehen gerade nicht raus; Monatsrate, Termin und Antworten im offenen Fenster schon."}
        </p>
      ) : null}

      <div className={`wr-raum${listeSchmal ? " liste-schmal" : ""}${mitFall ? " mit-fall" : ""}`}>
        <Gespraechsliste liste={liste} gewaehlt={gewaehlt} onWaehlen={waehlen} suche={suche} setSuche={setSuche}
          filter={filter} setFilter={filterWaehlen} onNeu={() => setNeuOffen(true)} ich={kopf?.ich ?? null}
          schmal={listeSchmal}
          onSchmal={modus === "schmal" ? undefined : (an) => setAnsicht((a) => ({ ...a, liste: an ? "schmal" : "voll" }))}
          mehr={listenEnde(mehr, grenze) === "mehr"} gekappt={listenEnde(mehr, grenze) === "gekappt"}
          onMehr={() => setGrenze((g) => Math.min(LISTE_GRENZE.max, g + LISTE_GRENZE.schritt))}
          kopf={kopf}
          menue={{
            schriftGross: ansicht.schrift === "gross",
            onSchrift: () => setAnsicht((a) => ({ ...a, schrift: a.schrift === "gross" ? "normal" : "gross" })),
            alleSchritte, onAlleSchritte: () => setAlleSchritte(!alleSchritte),
            onRundgang: () => rundgangStart.current?.(),
          }} />
        {modus !== "schmal" && chatFlaeche}
        {mitFall && (chatDa && chat!.lage ? fall : <aside className="wr-person" aria-label="Kontaktinfo"><p className="wr-leer">Lädt …</p></aside>)}
      </div>

      {/* Am Handy ist der offene Chat eine eigene Vollfläche am Dokument — so
          liegt er über Office-Kopf und Leiste (deren Stapel-Kontext ein fixes
          Element innerhalb nicht verlassen könnte) und folgt der Tastatur. */}
      {vollbild && createPortal(<div className={`wr wr-schmal wr-vollflaeche${schriftKlasse}`}>{chatFlaeche}</div>, document.body)}

      {neuOffen && (
        <NeuesGespraech api={API} onZu={() => setNeuOffen(false)} melden={melden}
          onGestartet={(nummer) => { setNeuOffen(false); void listeLaden(); waehlen(nummer); }} />
      )}

      {meldung && createPortal(<div className="wr-tokens wr-meldung-halter"><div className="wr-meldung" role="status">{meldung}</div></div>, document.body)}
    </div>
  );
}
