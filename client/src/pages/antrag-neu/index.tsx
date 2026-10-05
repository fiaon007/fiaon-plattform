// ═══════════════════════════════════════════════════════════════════════════
// /antrag-neu — der neue Privatantrag (05.10.2026, E-282)
//
// Justin (04./05.10.2026): „der GESAMTE Antragsweg muss neu gemacht werden …
// hell, Glasblau-Weiß, Apple-Glas, 3D-Karte mit dem Namen des Kunden" —
// Prototyp v2 freigegeben: „bau es jetzt unter /antrag-neu … achte auf JEDES
// Detail". Und: „die Karte oben … gerade stellen und freistellen, kein weißer
// Kasten".
//
// Aufbau: links (am Handy oben) die Bühne mit der 3D-Karte (karte3d.ts),
// rechts das Glas-Panel mit genau einer Frage je Bildschirm. Kopf und Fuß sind
// die der Website (GlassNav, PremiumFooter). Der Server-Teil steht in
// server/routes/fiaon-antrag-neu.ts; Angaben- und Schrittregeln in
// shared/fiaon-antrag-neu.ts. Gemessen wird jeder Bildschirm und jeder
// Feldhinweis (client/src/lib/antrag-ereignis.ts) — nie ein Inhalt.
// ═══════════════════════════════════════════════════════════════════════════
import "./antrag-neu.css";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import GlassNav from "@/components/GlassNav";
import PremiumFooter from "@/components/PremiumFooter";
import { appViewport } from "@/lib/app-viewport";
import { antragEreignis, antragSitzung } from "@/lib/antrag-ereignis";
import {
  ANTRAG_NEU_ABSCHNITTE, ANTRAG_NEU_PAKETE, ANTRAG_NEU_REIHE, ANTRAG_NEU_SCHRITTE, ANTRAG_NEU_SCHRITT_NR,
  antragNeuLuecke, antragNeuPaket, type AntragNeuSchritt,
} from "@shared/fiaon-antrag-neu";
import { Kontext, ZurueckPfeil, type AntragKontext, type GeheOpt } from "./bausteine";
import { SchrittAdresse, SchrittBeruf, SchrittEinkommen, SchrittEintraege, SchrittGeburt, SchrittKontakt, SchrittName } from "./schritte-angaben";
import { SchrittDanke, SchrittErgebnis, SchrittLimit, SchrittPaket, SchrittPruefung, SchrittUnterschrift, SchrittVertrag, SchrittZahlung } from "./schritte-abschluss";
import { SchrittPin } from "./pin";
import { AngabenSheet } from "./sheets";
import type { KartenBuehne, KartenLook } from "./karte3d";
import { api } from "./api";
import {
  datenAus, dauerhafteRef, euro, kartenName, paket, paketIndex, ruhigSystem, zustandLaden, zustandMerken, zustandVergessen, type Zustand,
} from "./zustand";

/** Das Aussehen der vier Karten (aus dem Prototyp). */
const LOOK: Record<string, KartenLook> = {
  start: { g1: "#2b4170", g2: "#16233f", body: 0x1a2744, gravur: "rgba(228,237,252,0.95)", rough: 0.55, metal: 0.35 },
  pro: { g1: "#183266", g2: "#0a1830", body: 0x0f1f3d, gravur: "rgba(236,242,255,0.97)", rough: 0.3, metal: 0.45 },
  ultra: { g1: "#2654b6", g2: "#0f2a6b", body: 0x173a8f, gravur: "rgba(242,247,255,0.97)", rough: 0.36, metal: 0.55, gebuerstet: true, holo: true },
  highend: { g1: "#2b2e35", g2: "#0c0d10", body: 0x16181d, gravur: "rgba(224,198,142,0.98)", rough: 0.26, metal: 0.7, champagner: true },
};

const BILD: Record<AntragNeuSchritt, () => JSX.Element> = {
  name: SchrittName, kontakt: SchrittKontakt, geburt: SchrittGeburt, adresse: SchrittAdresse, beruf: SchrittBeruf,
  einkommen: SchrittEinkommen, eintraege: SchrittEintraege, pruefung: SchrittPruefung, ergebnis: SchrittErgebnis,
  pin: SchrittPin, paket: SchrittPaket, limit: SchrittLimit, vertrag: SchrittVertrag, unterschrift: SchrittUnterschrift,
  zahlung: SchrittZahlung, danke: SchrittDanke,
};
const TITEL: Record<AntragNeuSchritt, string> = {
  name: "Name", kontakt: "Kontakt", geburt: "Geburtsdatum", adresse: "Anschrift", beruf: "Beruf", einkommen: "Einkommen",
  eintraege: "Einträge", pruefung: "Prüfung", ergebnis: "Ergebnis", pin: "Persönliche PIN", paket: "Paket", limit: "Limit und Nutzung",
  vertrag: "Vertrag", unterschrift: "Unterschrift", zahlung: "Zahlung", danke: "Danke",
};
const ZURUECK_ZU: Partial<Record<AntragNeuSchritt, string>> = {
  ergebnis: "zum Ergebnis", pin: "zur PIN", paket: "zur Paketwahl", limit: "zum Limit", vertrag: "zum Vertrag", unterschrift: "zur Unterschrift",
};
/** Wohin „Zurück" führt (nie in die Prüfung, nie hinter die Annahme). */
const ZURUECK: Partial<Record<AntragNeuSchritt, AntragNeuSchritt>> = {
  kontakt: "name", geburt: "kontakt", adresse: "geburt", beruf: "adresse", einkommen: "beruf", eintraege: "einkommen",
  pin: "ergebnis", paket: "pin", limit: "paket", vertrag: "limit", unterschrift: "vertrag",
};
const idx = (s: AntragNeuSchritt) => ANTRAG_NEU_REIHE.indexOf(s);
const istSchritt = (s: unknown): s is AntragNeuSchritt => typeof s === "string" && (ANTRAG_NEU_REIHE as string[]).includes(s);

function dachText(id: AntragNeuSchritt, bezahlt: boolean): string {
  const nr = ANTRAG_NEU_SCHRITT_NR[id];
  if (nr) return `Schritt ${nr} von ${ANTRAG_NEU_SCHRITTE}${id === "zahlung" ? " · Aktivierung" : ""}`;
  return id === "pruefung" ? "Prüfung" : id === "ergebnis" ? "Ergebnis" : id === "danke" ? (bezahlt ? "Konto aktiv" : "Geschafft") : "";
}

/**
 * Darf dieser Bildschirm jetzt gezeigt werden? Sonst: der richtige davor.
 * Dieselben Wände wie der Server (Prüfung vor PIN, PIN vor Paket, vollständige
 * Angaben vor Vertrag, Annahme vor Zahlung).
 */
function erlaubt(z: Zustand, id: AntragNeuSchritt): { id: AntragNeuSchritt; grund?: string } {
  const nachAnnahme = id === "zahlung" || id === "danke";
  if (z.angenommenAm && !nachAnnahme) return { id: "zahlung", grund: "Ihr Vertrag ist bereits geschlossen." };
  if (nachAnnahme && !z.angenommenAm) return erlaubt(z, "unterschrift");
  if (id === "kontakt" && !z.ref && (!z.anrede || !z.vorname.trim() || !z.nachname.trim())) return { id: "name" };
  if (idx(id) > idx("kontakt") && !z.ref) return { id: z.vorname ? "kontakt" : "name" };
  const luecke = antragNeuLuecke(datenAus(z));
  if (id === "pruefung") return luecke && luecke !== "limit" ? { id: luecke } : { id };
  if (idx(id) >= idx("ergebnis") && !z.geprueftAm && !z.doppelt) return { id: luecke && luecke !== "limit" ? luecke : "eintraege" };
  if (z.doppelt && idx(id) > idx("ergebnis")) return { id: "ergebnis" };
  if (idx(id) >= idx("paket") && !z.pinGesetzt) return { id: "pin" };
  if ((id === "vertrag" || id === "unterschrift") && luecke) return { id: luecke, grund: `Bitte ergänzen Sie noch: ${TITEL[luecke]}.` };
  return { id };
}

export default function AntragNeuSeite() {
  const [S, setS] = useState<Zustand>(() => zustandLaden());
  const zRef = useRef(S);
  zRef.current = S;
  const aktuell = useCallback(() => zRef.current, []);
  const setze = useCallback((teil: Partial<Zustand>) => {
    zRef.current = { ...zRef.current, ...teil };
    setS(zRef.current);
  }, []);
  const sitzung = useMemo(() => antragSitzung(), []);

  // ── Darstellung: Aa (größer + ruhig) ──
  const [gross, setGross] = useState(() => { try { return localStorage.getItem("fiaon_aa") === "1"; } catch { return false; } });
  const grossRef = useRef(gross);
  grossRef.current = gross;
  const ruhig = useCallback(() => ruhigSystem() || grossRef.current, []);

  // ── Wo stehen wir? ──
  const startSchritt = (): AntragNeuSchritt => {
    let h = (typeof location !== "undefined" ? location.hash.replace("#", "") : "") as AntragNeuSchritt;
    if (!istSchritt(h)) h = "name";
    if (h === "pruefung") h = "eintraege";
    return erlaubt(zRef.current, h).id;
  };
  const [jetzt, setJetzt] = useState<AntragNeuSchritt>(startSchritt);
  const jetztRef = useRef(jetzt);
  jetztRef.current = jetzt;
  const [richtung, setRichtung] = useState<"vor" | "zurueck">("vor");
  const [hinweis, setHinweis] = useState<AntragKontext["hinweis"]>(null);

  // ── Toast ──
  const [toastText, setToastText] = useState("");
  const [toastAn, setToastAn] = useState(false);
  const toastZeit = useRef<number | null>(null);
  const toast = useCallback((t: string) => {
    setToastText(t); setToastAn(true);
    if (toastZeit.current) clearTimeout(toastZeit.current);
    toastZeit.current = window.setTimeout(() => setToastAn(false), 2600);
  }, []);

  // ── Messung ──
  const ereignis = useCallback((e: string, o: { schritt?: string; detail?: string | number } = {}) => {
    antragEreignis("neu", e, { schritt: o.schritt ?? jetztRef.current, detail: o.detail, ref: zRef.current.ref ?? undefined });
  }, []);

  // ── Sheet ──
  const [sheet, setSheet] = useState<ReactNode>(null);
  const [sheetAn, setSheetAn] = useState(false);
  const sheetVerlauf = useRef(false);
  const sheetZurueck = useRef(false);
  const sheetAusloeser = useRef<Element | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const sheetAnRef = useRef(false);
  const schliesseSheet = useCallback((ausVerlauf = false) => {
    if (!sheetAnRef.current) return;
    sheetAnRef.current = false;
    setSheetAn(false);
    document.documentElement.classList.remove("an-sheet-offen");
    if (sheetVerlauf.current && !ausVerlauf) {
      sheetVerlauf.current = false;
      sheetZurueck.current = true;
      try { history.back(); } catch { sheetZurueck.current = false; }
    } else sheetVerlauf.current = false;
    const a = sheetAusloeser.current as HTMLElement | null;
    if (a?.isConnected) try { a.focus({ preventScroll: true }); } catch { /* egal */ }
  }, []);
  const oeffneSheet = useCallback((inhalt: ReactNode) => {
    setSheet(inhalt);
    if (!sheetAnRef.current) {
      sheetAnRef.current = true;
      sheetAusloeser.current = document.activeElement;
      try { history.pushState({ s: jetztRef.current, sheet: 1 }, "", `#${jetztRef.current}`); sheetVerlauf.current = true; } catch { /* egal */ }
    }
    setSheetAn(true);
    document.documentElement.classList.add("an-sheet-offen");
    requestAnimationFrame(() => {
      if (sheetRef.current) sheetRef.current.scrollTop = 0;
      const t = document.getElementById("an-sheetTitel");
      try { t?.focus({ preventScroll: true }); } catch { /* egal */ }
    });
  }, []);
  useEffect(() => {
    if (sheetAn) return;
    const t = window.setTimeout(() => setSheet(null), 460);
    return () => clearTimeout(t);
  }, [sheetAn]);

  // ── Bühne (3D-Karte) ──
  const buehnenRef = useRef<HTMLDivElement>(null);
  const leinwandRef = useRef<HTMLCanvasElement>(null);
  const orbitRef = useRef<HTMLDivElement>(null);
  const B = useRef<KartenBuehne | null>(null);
  const [dreiD, setDreiD] = useState(false);
  const [deckIndex, setDeckIndex] = useState(() => paketIndex(S.paket));
  const [streif, setStreif] = useState(0);
  const lichtStreif = useCallback(() => setStreif((n) => n + 1), []);
  useEffect(() => {
    let weg = false;
    const leinwand = leinwandRef.current, buehne = buehnenRef.current;
    if (!leinwand || !buehne) return;
    // WebGL vorhanden? Sonst bleibt die ruhige CSS-Karte.
    try { const probe = document.createElement("canvas"); if (!(probe.getContext("webgl2") || probe.getContext("webgl"))) return; } catch { return; }
    const start = () => {
      import("./karte3d").then((m) => {
        if (weg) return;
        try {
          B.current = new m.KartenBuehne(buehne, leinwand,
            ANTRAG_NEU_PAKETE.map((p) => ({ key: p.key, label: p.kartenLabel, look: LOOK[p.key] })),
            () => kartenName(zRef.current), ruhig, (i) => setDeckIndex(i));
          // Gleich mit dem richtigen Paket beginnen — nicht erst die Vorgabe zeigen und dann hinübergleiten.
          B.current.modus("einzeln", { aktiv: paketIndex(zRef.current.paket) });
          B.current.einrasten();
          setDreiD(true);
        } catch (e) {
          console.error("[ANTRAG-NEU] 3D-Karte nicht gestartet — die einfache Karte bleibt:", e);
          B.current = null;
        }
      }).catch((e) => console.error("[ANTRAG-NEU] 3D-Modul nicht geladen:", e));
    };
    // Erst nach dem ersten Bild laden — der Antrag soll sofort bedienbar sein.
    const id = (window as any).requestIdleCallback ? (window as any).requestIdleCallback(start, { timeout: 900 }) : window.setTimeout(start, 120);
    return () => {
      weg = true;
      if ((window as any).cancelIdleCallback) try { (window as any).cancelIdleCallback(id); } catch { /* egal */ } else clearTimeout(id);
      B.current?.zerstoeren(); B.current = null;
    };
  }, [ruhig]);

  // Die Bühne folgt dem Bildschirm.
  useEffect(() => {
    const b = B.current;
    if (!b) return;
    const a = paketIndex(S.paket);
    if (jetzt === "paket") b.modus("deck", { aktiv: a });
    else if (jetzt === "pruefung" || jetzt === "ergebnis") b.modus("einzeln", { aktiv: a, gross: true });
    else if (jetzt === "unterschrift") b.modus("einzeln", { aktiv: a, rueck: true });
    else if (jetzt === "zahlung" || jetzt === "danke") b.modus("einzeln", { aktiv: a, wartet: !S.bezahlt });
    else b.modus("einzeln", { aktiv: a });
  }, [jetzt, S.paket, S.bezahlt, dreiD]);
  useEffect(() => { if (jetzt !== "paket") setDeckIndex(paketIndex(S.paket)); }, [S.paket, jetzt]);

  const deckGehe = useCallback((i: number) => {
    const z = Math.max(0, Math.min(ANTRAG_NEU_PAKETE.length - 1, i));
    // Die Anzeige (Name, Limit, Knopf) folgt sofort — auch wenn die Bühne aus dem Bild
    // gescrollt ist und die Karten-Schleife deshalb ruht.
    if (B.current && jetztRef.current === "paket") B.current.deckGehe(z);
    setDeckIndex(z);
  }, []);

  const paketWaehlen = useCallback((key: string, limit?: number) => {
    const P = paket(key);
    const z = zRef.current;
    const teil: Partial<Zustand> = { paket: P.key, limit: limit ?? (P.limits.includes(z.limit as never) ? z.limit : P.limits[P.limits.length - 1]) };
    if (z.paket !== P.key) {
      teil.ag3 = false;
      B.current?.signatur({ striche: [], text: "", asp: 1.8 });
      antragEreignis("neu", "paket_gewechselt", { schritt: jetztRef.current, detail: `${z.paket}-${P.key}`, ref: z.ref ?? undefined });
    }
    setze(teil);
    return teil;
  }, [setze]);

  // ── Speichern im Hintergrund (eine Anfrage zur Zeit) ──
  const [speicherFehler, setSpeicherFehler] = useState<{ schritt: AntragNeuSchritt; abgelaufen?: boolean } | null>(null);
  // Wiederaufnahme aus Cookie oder Gerätespeicher: „Willkommen zurück, … Nicht Sie?" auf dem ersten Bildschirm.
  const [wieder, setWieder] = useState<{ vorname: string; schritt: AntragNeuSchritt } | null>(null);
  const neuBeginnen = useCallback(async () => {
    await api.vergessen();
    zustandVergessen();
    window.location.href = "/antrag-neu";
  }, []);
  const kette = useRef<Promise<boolean>>(Promise.resolve(true));
  const speichern = useCallback((schritt: AntragNeuSchritt, teil: Partial<Zustand> = {}) => {
    const p = kette.current.then(async () => {
      const z = { ...zRef.current, ...teil };
      if (!z.ref) return false;
      const r = await api.speichern(z.ref, datenAus(z), schritt);
      if (r.ok) { setSpeicherFehler(null); return true; }
      if (r.status === 409 && (r.json as any)?.angenommen) return true;
      console.error(`[ANTRAG-NEU] Schritt ${schritt} nicht gespeichert: HTTP ${r.status}`);
      // 48 Stunden ohne Besuch: Das Antrags-Cookie gilt nicht mehr — dann hilft kein „erneut speichern", nur ein neuer Anfang.
      setSpeicherFehler({ schritt, abgelaufen: r.status === 403 && !!(r.json as any)?.abgelaufen });
      return false;
    });
    kette.current = p.catch(() => false);
    return p;
  }, []);

  // ── Navigation ──
  const gehe = useCallback((ziel: AntragNeuSchritt, opt: GeheOpt = {}) => {
    const z = zRef.current;
    const pruef = opt.ohnePruefung ? { id: ziel } : erlaubt(z, ziel);
    const id = pruef.id;
    if (pruef.grund && id !== ziel) {
      toast(pruef.grund);
      if ((ziel === "vertrag" || ziel === "unterschrift") && !z.angenommenAm) setze({ rueckZu: ziel });
    }
    if (opt.hinweis) setHinweis({ schritt: id, feld: opt.hinweis.feld, text: opt.hinweis.text });
    const alt = jetztRef.current;
    if (id === alt) return;
    setRichtung(opt.richtung ?? (idx(id) < idx(alt) ? "zurueck" : "vor"));
    try {
      if (opt.ersetzen || opt.push === false) { if (opt.ersetzen) history.replaceState({ s: id }, "", `#${id}`); }
      else history.pushState({ s: id }, "", `#${id}`);
    } catch { /* egal */ }
    if (sheetAnRef.current) { sheetVerlauf.current = false; schliesseSheet(true); }
    jetztRef.current = id;
    setJetzt(id);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [toast, setze, schliesseSheet]);

  const weiter = useCallback(() => {
    const z = zRef.current;
    const i = idx(jetztRef.current);
    let n = ANTRAG_NEU_REIHE[i + 1];
    if (z.rueckZu && idx(z.rueckZu) > i && jetztRef.current !== "paket") { n = z.rueckZu; setze({ rueckZu: "" }); }
    if (n) gehe(n, { richtung: "vor" });
  }, [gehe, setze]);

  const weiterText = useCallback((standard: string) => {
    const z = zRef.current;
    if (z.rueckZu && idx(z.rueckZu) > idx(jetztRef.current) && jetztRef.current !== "paket" && ZURUECK_ZU[z.rueckZu]) return `Speichern und zurück ${ZURUECK_ZU[z.rueckZu]}`;
    return standard;
  }, []);

  // Zurück-Taste des Browsers
  useEffect(() => {
    const zurueck = (e: PopStateEvent) => {
      if (sheetZurueck.current) { sheetZurueck.current = false; return; }
      if (sheetAnRef.current) { schliesseSheet(true); return; }
      let s = ((e.state && e.state.s) || location.hash.replace("#", "") || "name") as AntragNeuSchritt;
      if (!istSchritt(s)) s = "name";
      if (s === "pruefung") s = idx(jetztRef.current) > idx("pruefung") ? "eintraege" : "ergebnis";
      const z = zRef.current;
      if (z.angenommenAm && idx(s) < idx("zahlung")) {
        try { history.pushState({ s: jetztRef.current }, "", `#${jetztRef.current}`); } catch { /* egal */ }
        toast("Ihr Vertrag ist bereits geschlossen.");
        return;
      }
      gehe(s, { push: false });
    };
    window.addEventListener("popstate", zurueck);
    return () => window.removeEventListener("popstate", zurueck);
  }, [gehe, schliesseSheet, toast]);

  // ── Seite einrichten: Ansicht, Schrift, Messung, Einstieg ──
  useEffect(() => {
    document.documentElement.classList.add("an-scroll");
    const viewport = appViewport();
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Dancing+Script:wght@500&display=swap";
    document.head.appendChild(link);
    try { history.replaceState({ s: jetztRef.current }, "", `${location.pathname}${location.search}#${jetztRef.current}`); } catch { /* egal */ }
    antragEreignis("neu", "geoeffnet", { schritt: jetztRef.current, ref: zRef.current.ref ?? undefined, detail: window.innerWidth < 700 ? "schmal" : "breit" });
    const weg = () => antragEreignis("neu", "verlassen", { schritt: jetztRef.current, ref: zRef.current.ref ?? undefined });
    window.addEventListener("pagehide", weg);

    // Persönlicher Link (?l=…) und Paket aus der Adresse (?paket=…)
    try {
      const q = new URLSearchParams(location.search);
      const l = q.get("l");
      if (l && /^[A-Za-z0-9]{10}$/.test(l)) {
        sessionStorage.setItem("fiaon_lead_link", l);
        void api.vorbelegung(l).then((r) => {
          const j: any = r.json;
          if (!r.ok || !j) return;
          const z = zRef.current;
          setze({
            vorname: z.vorname || j.vorname || "", nachname: z.nachname || j.nachname || "", email: z.email || j.email || "",
            ...(j.vorwahl && j.telefon && !z.telefon ? { vorwahl: j.vorwahl, telefon: String(j.telefon) } : {}),
          });
          antragEreignis("neu", "vorbelegt", { schritt: jetztRef.current, detail: q.get("k") || "link" });
        });
        q.delete("l"); q.delete("k");
        history.replaceState(history.state, "", `${location.pathname}${q.toString() ? `?${q}` : ""}${location.hash}`);
      }
      const pk = q.get("paket") || q.get("pack");
      const p = pk ? antragNeuPaket(pk) : null;
      if (p && !zRef.current.ref) { setze({ paket: p.key, limit: p.limits[p.limits.length - 1] }); setDeckIndex(paketIndex(p.key)); }
    } catch { /* egal */ }

    // Abgleich: Es gibt schon einen Antrag in diesem Tab — gilt das Antrags-Cookie noch, und was weiß der Server
    // (Annahme oder PIN aus einem zweiten Tab, Zahlung eingegangen)?
    if (zRef.current.ref) {
      const ref = zRef.current.ref;
      void api.stand(ref).then((r) => {
        const j: any = r.json;
        // Nach der Annahme braucht die Zahlungsseite kein Antrags-Cookie (sie läuft über den Verwendungszweck).
        if (r.status === 403 && j?.error === "abgelaufen") { if (!zRef.current.angenommenAm) setSpeicherFehler({ schritt: jetztRef.current, abgelaufen: true }); return; }
        if (!r.ok || !j || zRef.current.ref !== ref) return;
        const z = zRef.current;
        const teil: Partial<Zustand> = {};
        if (j.pinGesetzt && !z.pinGesetzt) teil.pinGesetzt = true;
        if (j.geprueftAm && !z.geprueftAm) teil.geprueftAm = j.geprueftAm;
        if (j.angenommenAm && !z.angenommenAm) Object.assign(teil, { angenommenAm: j.angenommenAm, sofortBeginn: j.sofortBeginn ?? null, paymentReference: j.paymentReference ?? null, rueckZu: "" });
        else if (j.paymentReference && !z.paymentReference) teil.paymentReference = j.paymentReference;
        if (j.zahlungsstatus === "paid" && !z.bezahlt) teil.bezahlt = true;
        if (Object.keys(teil).length) {
          setze(teil);
          const ziel = erlaubt(zRef.current, jetztRef.current).id;
          if (ziel !== jetztRef.current) gehe(ziel, { ersetzen: true });
        }
      });
    }

    // Wiederaufnahme: neuer Tab, gelöschter Sitzungsspeicher, anderes Gerät oder Link aus der
    // Erinnerungsmail — das Antrags-Cookie gilt noch (Referenz aus dem Gerätespeicher, sonst vom Server).
    if (!zRef.current.ref) {
      const lokal = dauerhafteRef();
      void (lokal ? Promise.resolve(lokal) : api.ausCookie().then((r) => (r.ok ? r.json?.ref ?? null : null))).then((ref) => {
        if (!ref || zRef.current.ref) return;
        void api.stand(ref).then((r) => {
          const j: any = r.json;
          if (!r.ok || !j?.daten || zRef.current.ref) return;
          setze({
            ...j.daten, ref, adresseOffen: !!j.daten.strasse, geprueftAm: j.geprueftAm ?? null, pinGesetzt: !!j.pinGesetzt,
            pruefPunkte: j.pruefung?.punkte ?? null, doppelt: !!j.pruefung?.doppelt,
            angenommenAm: j.angenommenAm ?? null, sofortBeginn: j.sofortBeginn ?? null, paymentReference: j.paymentReference ?? null,
            bezahlt: j.zahlungsstatus === "paid",
          });
          const z = zRef.current;
          setDeckIndex(paketIndex(z.paket));
          if (B.current) { B.current.modus("einzeln", { aktiv: paketIndex(z.paket) }); B.current.einrasten(); B.current.nameNeu(); }
          const luecke = antragNeuLuecke(datenAus(z));
          const ziel: AntragNeuSchritt = z.angenommenAm ? "zahlung" : z.pinGesetzt ? (luecke && luecke !== "limit" ? luecke : "paket")
            : z.geprueftAm ? "pin" : (luecke && luecke !== "limit" ? luecke : "eintraege");
          if (z.angenommenAm) toast("Willkommen zurück – Ihr Antrag ist gespeichert.");
          else setWieder({ vorname: z.vorname, schritt: ziel });
          gehe(ziel, { ersetzen: true });
        });
      });
    }
    return () => {
      document.documentElement.classList.remove("an-scroll", "an-sheet-offen");
      viewport();
      link.remove();
      window.removeEventListener("pagehide", weg);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Merken (nie PIN, nie Unterschrift — beides steht nicht im Zustand)
  useEffect(() => {
    const t = window.setTimeout(() => zustandMerken(S), 250);
    return () => clearTimeout(t);
  }, [S]);

  // Jeder gezeigte Bildschirm in die Messung — auch der erste (der Trichter zählt nur „schritt").
  useEffect(() => {
    antragEreignis("neu", "schritt", { schritt: jetzt, ref: zRef.current.ref ?? undefined });
  }, [jetzt]);

  // Tastatur: Esc schließt Sheets, Pfeile blättern im Paket-Deck
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.key === "Escape") schliesseSheet();
      const t = e.target as HTMLElement;
      if (jetztRef.current === "paket" && (e.key === "ArrowRight" || e.key === "ArrowLeft") && t.tagName !== "INPUT" && !document.documentElement.classList.contains("an-sheet-offen")) {
        setDeckIndex((i) => { const n = Math.max(0, Math.min(3, i + (e.key === "ArrowRight" ? 1 : -1))); if (B.current) B.current.deckGehe(n); return B.current ? i : n; });
      }
    };
    document.addEventListener("keydown", taste);
    return () => document.removeEventListener("keydown", taste);
  }, [schliesseSheet]);

  // ── Panel-Wechsel mit Gleiten und weicher Höhe ──
  const [angezeigt, setAngezeigt] = useState<AntragNeuSchritt>(jetzt);
  const [panelKlasse, setPanelKlasse] = useState("");
  const inhaltRef = useRef<HTMLDivElement>(null);
  const h0 = useRef<number | null>(null);
  useEffect(() => {
    // Zurück auf den angezeigten Bildschirm, bevor der Wechsel lief (schnelles Zurück/Vor):
    // Klasse und feste Höhe lösen, sonst bliebe das Panel unsichtbar und gesperrt.
    if (jetzt === angezeigt) { setPanelKlasse(""); if (inhaltRef.current) inhaltRef.current.style.height = ""; h0.current = null; return; }
    const p = inhaltRef.current;
    if (!p || ruhig()) { setAngezeigt(jetzt); return; }
    h0.current = p.offsetHeight;
    p.style.height = `${h0.current}px`;
    setPanelKlasse(`an-wechselt ${richtung === "zurueck" ? "an-raus-r" : "an-raus-l"}`);
    const t = window.setTimeout(() => { setAngezeigt(jetzt); setPanelKlasse(`an-wechselt ${richtung === "zurueck" ? "an-rein-l" : "an-rein-r"}`); }, 170);
    return () => clearTimeout(t);
  }, [jetzt]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const p = inhaltRef.current;
    if (!p || h0.current == null) { if (p) p.style.height = ""; return; }
    const vorher = h0.current; h0.current = null;
    p.style.height = "auto";
    const nachher = p.offsetHeight;
    p.style.height = `${vorher}px`;
    void p.offsetHeight;
    p.style.height = `${nachher}px`;
    const t = window.setTimeout(() => { p.style.height = ""; setPanelKlasse(""); }, 460);
    return () => clearTimeout(t);
  }, [angezeigt]);

  // Eingabe → nächstes leeres Feld, sonst „Weiter"
  const panelTaste = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" || e.defaultPrevented) return;
    const t = e.target as HTMLElement;
    if (t.tagName !== "INPUT" || !t.classList.contains("an-eingabe")) return;
    if (panelKlasse) { e.preventDefault(); return; }
    const felder = Array.from(inhaltRef.current?.querySelectorAll<HTMLInputElement>("input.an-eingabe") ?? [])
      .filter((x) => x.offsetParent && !x.closest(".an-klapp:not(.an-offen)"));
    const i = felder.indexOf(t as HTMLInputElement);
    e.preventDefault();
    if (i >= 0 && i < felder.length - 1 && !felder[i + 1].value) felder[i + 1].focus();
    else inhaltRef.current?.querySelector<HTMLButtonElement>("button[data-weiter]")?.click();
  };

  const kontext: AntragKontext = {
    S, setze, aktuell, jetzt, gehe, weiter, toast, oeffneSheet, schliesseSheet: () => schliesseSheet(), buehne: () => B.current,
    lichtStreif, ruhig, sitzung, speichern, ereignis, hinweis, hinweisGelesen: () => setHinweis(null), weiterText,
    buehnenBox: () => buehnenRef.current, orbitBox: () => orbitRef.current, deckIndex, deckGehe, paketWaehlen,
  };

  // ── Anzeige ──
  const P = paket(S.paket);
  const pos = idx(jetzt);
  const segmente = ANTRAG_NEU_ABSCHNITTE.map(([name, liste]) => {
    let erledigt = 0, aktiv = false;
    for (const x of liste) { const i = idx(x); if (i < pos) erledigt++; else if (i === pos) aktiv = true; }
    const w = jetzt === "danke" ? 100 : Math.round(((erledigt + (aktiv ? 0.4 : 0)) / liste.length) * 100);
    return { name, w, klasse: w >= 100 ? "an-fertig" : aktiv || erledigt > 0 ? "an-aktiv" : "" };
  });
  const angabenZahl = [S.vorname && S.nachname, S.email, S.telefon, S.gj, S.strasse && S.adresseOffen, S.beruf, S.einkommen, S.wohnen, S.eintraege].filter(Boolean).length;
  const wallet: [string, string][] = [];
  if (pos > idx("geburt")) wallet.push(["Ihre Person", "gespeichert"]);
  if (S.geprueftAm && pos > idx("pruefung")) wallet.push(["Ihr Profil", "geprüft"]);
  if (S.pinGesetzt) wallet.push(["Ihre PIN", "festgelegt"]);
  if (pos > idx("limit")) wallet.push(["Ihr Ziel", `${P.name} · ${euro(S.limit, false)}`]);
  if (S.angenommenAm) wallet.push(["Ihr Vertrag", "angenommen"]);
  const zielPille = jetzt === "limit" || jetzt === "vertrag" || jetzt === "unterschrift";
  const zurueckZiel = ZURUECK[jetzt];
  const deckP = ANTRAG_NEU_PAKETE[deckIndex] ?? P;
  const cssLook = LOOK[(jetzt === "paket" ? deckP : P).key];
  const Bildschirm = BILD[angezeigt];

  return (
    <Kontext.Provider value={kontext}>
      <div className={`an-seite${gross ? " an-gross an-ruhig" : ""}${dreiD ? "" : " an-ohne-3d"}${jetzt === "zahlung" ? " an-kompakt" : ""}`}>
        <GlassNav activePage="privatkunden" />
        <main className="an-rahmen">
          <section className="an-buehne-spalte" aria-label="Ihre Karte">
            <div className={`an-buehne${jetzt === "paket" ? " an-deck" : ""}`} ref={buehnenRef}>
              <canvas className="an-leinwand" ref={leinwandRef} aria-hidden="true" />
              <div className="an-css-karte" aria-hidden="true"
                style={{ background: `linear-gradient(135deg,${cssLook.g1},${cssLook.g2})`, filter: (jetzt === "zahlung" || jetzt === "danke") && !S.bezahlt ? "grayscale(.8)" : "none" }}>
                <b>FIAON</b>
                <i style={{ position: "absolute", right: 18, top: 16, fontStyle: "normal", fontSize: ".625rem", letterSpacing: ".2em", opacity: 0.75 }}>{(jetzt === "paket" ? deckP : P).kartenLabel}</i>
                <span>{kartenName(S) || "Ihr Name"}</span>
              </div>
              <div className={`an-scan${jetzt === "pruefung" ? " an-an" : ""}`} />
              <div className="an-orbit" ref={orbitRef} hidden />
              {zielPille ? <div className="an-ziel-pille">Ziel-Limit · <b>{euro(S.limit, false)}</b></div> : null}
              <div key={streif} className={`an-licht-streif${streif ? " an-an" : ""}`} />
            </div>
            {jetzt === "paket" ? (
              <div className="an-deck-steuer">
                <button type="button" className="an-pfeil" aria-label="Vorheriges Paket" onClick={() => deckGehe(deckIndex - 1)} disabled={deckIndex === 0}>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3.5L5.5 8l4.5 4.5" /></svg>
                </button>
                <div>
                  <div className="an-zaehler">{String(deckIndex + 1).padStart(2, "0")} / {String(ANTRAG_NEU_PAKETE.length).padStart(2, "0")}</div>
                  <div className="an-striche">{ANTRAG_NEU_PAKETE.map((p, i) => <i key={p.key} className={i === deckIndex ? "an-an" : ""} />)}</div>
                </div>
                <button type="button" className="an-pfeil" aria-label="Nächstes Paket" onClick={() => deckGehe(deckIndex + 1)} disabled={deckIndex === ANTRAG_NEU_PAKETE.length - 1}>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3.5L10.5 8 6 12.5" /></svg>
                </button>
              </div>
            ) : null}
            {angabenZahl > 0 ? (
              <button type="button" className={`an-angaben-pille${["pruefung", "zahlung", "danke"].includes(jetzt) ? " an-weg" : ""}`} onClick={() => oeffneSheet(<AngabenSheet />)}>
                Ihre Angaben <b>{angabenZahl}</b>
              </button>
            ) : null}
            <div className="an-wallet" aria-label="Gespeicherte Angaben">
              {wallet.map(([a, b]) => <div className="an-streifen" key={a}><span>{a}</span><em>{b}</em></div>)}
            </div>
          </section>

          <section className="an-frage-spalte">
            <nav className="an-fortschritt an-fortschritt-kopf" aria-label="Fortschritt">
              <div className="an-segmente">
                {segmente.map((s) => <div key={s.name} className={`an-segment ${s.klasse}`}><div className="an-balken"><i style={{ width: `${s.w}%` }} /></div>{s.name}</div>)}
              </div>
              <button type="button" className="an-aa" aria-pressed={gross} title="Größere Schrift und ruhige Darstellung"
                onClick={() => { const an = !gross; setGross(an); try { localStorage.setItem("fiaon_aa", an ? "1" : "0"); } catch { /* egal */ } toast(an ? "Größere Schrift, ruhige Darstellung" : "Normale Darstellung"); }}>Aa</button>
            </nav>
            <div className="an-panel">
              <div className={`an-inhalt ${panelKlasse}`} ref={inhaltRef} onKeyDown={panelTaste}>
                <div className="an-kopfzeile">
                  <span className="an-dach">{dachText(angezeigt, S.bezahlt)}</span>
                  {ZURUECK[angezeigt] && angezeigt === jetzt ? (
                    <button type="button" className="an-zurueck" onClick={() => zurueckZiel && gehe(zurueckZiel, { richtung: "zurueck" })}><ZurueckPfeil />Zurück</button>
                  ) : null}
                </div>
                {speicherFehler && angezeigt !== "pruefung" ? (
                  <div className="an-fehlerkasten" role="alert">
                    {speicherFehler.abgelaufen ? "Ihre Sitzung ist abgelaufen – aus Sicherheitsgründen gilt ein Antrag in diesem Browser 48 Stunden." : "Ihre letzten Angaben sind noch nicht gespeichert."}{" "}
                    {speicherFehler.abgelaufen
                      ? S.angenommenAm
                        // Nach der Annahme kein „Neu beginnen" — das ergäbe einen zweiten Vertrag. Der Bereich hat alles.
                        ? <a className="an-knopf an-text" style={{ fontSize: "inherit", minHeight: 0 }} href="/app/login">Zum Kundenbereich</a>
                        : <button type="button" className="an-knopf an-text" style={{ fontSize: "inherit", minHeight: 0 }} onClick={() => void neuBeginnen()}>Neu beginnen</button>
                      : <button type="button" className="an-knopf an-text" style={{ fontSize: "inherit", minHeight: 0 }} onClick={() => void speichern(speicherFehler.schritt)}>Erneut speichern</button>}
                  </div>
                ) : null}
                {wieder && wieder.schritt === angezeigt && !S.angenommenAm ? (
                  <div className="an-hinweis an-wieder">
                    Willkommen zurück{wieder.vorname ? `, ${wieder.vorname}` : ""} – Ihr Antrag ist gespeichert.{" "}
                    <button type="button" className="an-knopf an-text" style={{ fontSize: "inherit", minHeight: 0, padding: 0 }} onClick={() => void neuBeginnen()}>
                      Nicht {wieder.vorname || "Sie"}? Neu beginnen
                    </button>
                  </div>
                ) : null}
                <Bildschirm key={angezeigt} />
              </div>
            </div>
          </section>
        </main>
        <PremiumFooter />

        <div className={`an-schleier${sheetAn ? " an-an" : ""}`} onClick={() => schliesseSheet()} />
        <div className={`an-sheet${sheetAn ? " an-an" : ""}`} ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby="an-sheetTitel" aria-hidden={!sheetAn}>
          <div className="an-griff" />
          {sheet ? (
            <>
              <button type="button" className="an-sheet-zu" aria-label="Schließen" onClick={() => schliesseSheet()}>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
              </button>
              {sheet}
            </>
          ) : null}
        </div>
        <div className={`an-toast${toastAn ? " an-an" : ""}`} role="status" aria-live="polite">{toastText}</div>
      </div>
    </Kontext.Provider>
  );
}

