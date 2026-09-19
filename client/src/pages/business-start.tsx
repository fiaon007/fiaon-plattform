// ═══════════════════════════════════════════════════════════════════════════
// /business/start — DER AUFTRAG FÜR FIAON GLOBAL (17.09.2026, E-188)
//
// Justin: „Direktkauf genau — Vertrag, Rechnung, Zahlung aufs Bankkonto =
// Start. … wenn man seine Firma eingibt, soll sich ein Register öffnen, der
// B2B-Kunde klickt auf seine Firma und alle Daten füllen sich aus."
//
// ── WAS DIESE SEITE ERSETZT ────────────────────────────────────────────────
// Den alten Business-Antrag (pages/business-antrag.tsx, 1.356 Zeilen): sechs
// Schritte mit Kartenfragen, IBAN für die Lastschrift, KYC-Uploads und einem
// Abo-Vertrag — gebaut für Monatsabos der Bonitätslinie. FIAON Global ist ein
// Einmalauftrag zwischen Unternehmen. Er braucht vier Dinge: Paket, Firma,
// Unterzeichner, Unterschrift.
//
// ── DER WEG ────────────────────────────────────────────────────────────────
//   1 Paket          aus dem Katalog (eine Quelle), vorgewählt über ?paket=
//   2 Unternehmen    Registersuche GET /api/fiaon/firmensuche → Klick füllt
//                    alles; wo es (noch) kein Register gibt: Website nennen,
//                    das Impressum füllt die Felder. Handeingabe geht immer —
//                    der Auftrag blockiert nie an einer fremden Schnittstelle.
//   3 Unterzeichner  aus dem Register übernehmbar, sonst von Hand
//   4 Vertrag        POST /api/fiaon/global/vertrag/vorschau liefert GENAU den
//                    Text, der danach als PDF entsteht; vier Bestätigungen,
//                    Unterschrift auf dem Pad (Bauteil aus E-185)
//   →  POST /api/fiaon/global/auftrag: Vertrag + Rechnung per E-Mail, danach
//      die Überweisungsdaten. Zahlungseingang = Start (bucht die Leitung über
//      den einen Buchungsweg; die Aufgabe „US-Struktur starten" entsteht dort).
//
// ── AUCH ALS PRIVATPERSON (19.09.2026, E-191) ──────────────────────────────
// Justin: „Man muss nicht als Firma unser Paket kaufen, auch Privatpersonen
// können über uns kaufen/gründen." Schritt 2 fragt zuerst, WER beauftragt
// (vorwählbar über ?art=privat). Die Privatperson trägt Name und Wohnanschrift
// ein (Schritt 2), E-Mail und Telefon (Schritt 3), liest den Vertrag mit der
// Widerrufsbelehrung als Anlage und entscheidet selbst, ob wir vor Ablauf der
// Widerrufsfrist beginnen (freiwillig, nie vorangekreuzt — § 356 Abs. 4 BGB).
// Der Knopf heißt „Zahlungspflichtig beauftragen" (§ 312j Abs. 3 BGB).
//
// Der Entwurf (ohne Unterschrift) liegt in sessionStorage: Ein versehentliches
// Neuladen kostet den Kunden nichts. Glas trägt hier nur die Zusammenfassung.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState } from "react";
import { Dunkel } from "@/components/site/DunkleBuehne";
import SignaturePad from "@/components/agent/SignaturPad";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { GLOBAL_START_WOERTER } from "@/i18n/global-start";
import { GLOBAL_PAKETE, GLOBAL_INKLUSIVE, GLOBAL_GELD_ZURUECK, globalPaket, globalPreisText, globalPlanungText, istFiaonSelbst } from "@shared/fiaon-global";
import { kampagne, werbeKonversion } from "@/lib/werbung";
import "@/styles/global-start.css";

type Land = "DE" | "AT" | "CH";
type Auftraggeber = "unternehmen" | "privat";
type Anschrift = { land: Land; strasse: string; plz: string; ort: string };
type Firma = { land: Land; name: string; rechtsform: string; registergericht: string; registernummer: string; strasse: string; plz: string; ort: string; ustId: string; website: string; quelleRegister?: string };
type Person = { anrede: string; vorname: string; nachname: string; funktion: string; email: string; telefon: string };
type Treffer = { id: string; name: string; rechtsform?: string; ort?: string; plz?: string; register?: string; quelle?: string };
type Vertreter = { vorname?: string; nachname?: string; name?: string; funktion?: string };
type Fertig = { ref: string; token: string; email: string; zahlungsseite?: string; art?: Auftraggeber; sofort?: boolean };
type Status = { betragCents: number; paketName: string; zahlungsseite?: string; status?: string; zahlung?: { empfaenger: string; ibanAnzeige: string; bic: string; bank?: string; verwendungszweck: string; faelligAm?: string; qrDatenUrl?: string }; vertragUrl?: string; rechnungUrl?: string };

const FIRMA_LEER: Firma = { land: "DE", name: "", rechtsform: "", registergericht: "", registernummer: "", strasse: "", plz: "", ort: "", ustId: "", website: "" };
const PERSON_LEER: Person = { anrede: "", vorname: "", nachname: "", funktion: "", email: "", telefon: "" };
const ANSCHRIFT_LEER: Anschrift = { land: "DE", strasse: "", plz: "", ort: "" };
const RECHTSFORMEN: Record<Land, string[]> = {
  DE: ["GmbH", "UG (haftungsbeschränkt)", "GmbH & Co. KG", "AG", "KG", "OHG", "e. K.", "GbR", "Einzelunternehmen", "Freiberufler", "eG", "PartG mbB"],
  AT: ["GmbH", "FlexKapG", "AG", "KG", "OG", "e. U.", "Einzelunternehmen", "GesbR"],
  CH: ["AG", "GmbH", "Einzelunternehmen", "Kollektivgesellschaft", "Kommanditgesellschaft", "Genossenschaft"],
};
const rang = (f?: string) => /gesch(ä|ae)ftsf|vorstand|inhaber|direktor|managing|owner|director/i.test(f || "") ? 0 : /prokur/i.test(f || "") ? 2 : 1;
const ENTWURF = "fiaon_global_auftrag";
const ABSCHLUSS = "fiaon_global_auftrag_fertig";
const lesen = <T,>(k: string): T | null => { try { const v = sessionStorage.getItem(k); return v ? JSON.parse(v) as T : null; } catch { return null; } };
const schreiben = (k: string, v: unknown) => { try { v === null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* privates Fenster: dann eben ohne Entwurf */ } };

export default function BusinessStart() {
  const t = useWoerter(GLOBAL_START_WOERTER);
  const sprache = useSprache();
  const s = sprache === "en" ? "en" : "de";
  const zu = (p: string) => inSprache(p, sprache);

  const entwurf = useMemo(() => lesen<{ paket: string; firma: Firma; person: Person; schritt: number; vertreter?: Vertreter[]; art?: Auftraggeber; anschrift?: Anschrift }>(ENTWURF), []);
  // 19.09.2026: Wer mit ?paket= von einer Tafel kommt, hat das Paket schon gewählt — der Weg beginnt bei Schritt 2.
  const [schritt, setSchritt] = useState(() => {
    const ausAdresse = new URLSearchParams(window.location.search).get("paket");
    if (!entwurf?.schritt && ausAdresse && globalPaket(ausAdresse)) return 1;
    return entwurf?.schritt ?? 0;
  });
  const [paket, setPaket] = useState<string>(() => {
    const ausAdresse = new URLSearchParams(window.location.search).get("paket");
    return (ausAdresse && globalPaket(ausAdresse)?.key) || entwurf?.paket || "";
  });
  const [firma, setFirma] = useState<Firma>(entwurf?.firma ?? FIRMA_LEER);
  const [person, setPerson] = useState<Person>(entwurf?.person ?? PERSON_LEER);
  // Wer beauftragt — ?art=privat (von /business/privatpersonen) geht vor dem Entwurf.
  const [art, setArt] = useState<Auftraggeber>(() => {
    const ausAdresse = new URLSearchParams(window.location.search).get("art");
    return ausAdresse === "privat" || ausAdresse === "unternehmen" ? ausAdresse : entwurf?.art ?? "unternehmen";
  });
  const privat = art === "privat";
  // Die Wohnanschrift der Privatperson steht getrennt von der Firmenanschrift: Wer umschaltet, trägt nicht versehentlich den Firmensitz als Wohnsitz ein.
  const [anschrift, setAnschrift] = useState<Anschrift>(entwurf?.anschrift ?? ANSCHRIFT_LEER);
  const [fehler, setFehler] = useState("");
  const [fertig, setFertig] = useState<Fertig | null>(() => lesen<Fertig>(ABSCHLUSS));

  
  const blatt = useRef<HTMLDivElement>(null);
  const gehe = (n: number) => { setFehler(""); setSchritt(n); requestAnimationFrame(() => blatt.current?.scrollIntoView({ block: "start", behavior: "auto" })); };

  // ── Schritt 2: Registersuche ────────────────────────────────────────────
  const [q, setQ] = useState(firma.name);
  const [treffer, setTreffer] = useState<Treffer[] | null>(null);
  const [quelleText, setQuelleText] = useState("");
  const [quelle, setQuelle] = useState("");
  const [sucht, setSucht] = useState(false);
  const [offen, setOffen] = useState(false);
  const [aktiv, setAktiv] = useState(-1);
  const [nurWebsite, setNurWebsite] = useState(false);
  const [felderOffen, setFelderOffen] = useState(!!entwurf?.firma?.strasse);
  const [gefuellt, setGefuellt] = useState<string[]>([]);
  const [vertreter, setVertreter] = useState<Vertreter[]>(entwurf?.vertreter ?? []);
  useEffect(() => { if (!fertig) schreiben(ENTWURF, { paket, firma, person, vertreter, art, anschrift, schritt: Math.min(schritt, 2) }); }, [paket, firma, person, vertreter, art, anschrift, schritt, fertig]);
  const [gefundenText, setGefundenText] = useState("");
  const [webUrl, setWebUrl] = useState(firma.website);
  const [webLaedt, setWebLaedt] = useState(false);
  const [webFehler, setWebFehler] = useState("");
  const stumm = useRef(false); // nach einer Auswahl nicht sofort wieder suchen
  // Welche Länder eine Namenssuche haben, sagt der Server (hängt an Schlüsseln und Anträgen,
  // die kommen und gehen). Ohne Namenssuche steht der Website-Weg sofort da, nicht erst nach dem Tippen.
  const [lage, setLage] = useState<Record<string, { namenssuche?: boolean }> | null>(null);
  useEffect(() => { fetch("/api/fiaon/firmensuche/lage").then((r) => r.json()).then((j) => { if (j.ok) setLage(j.laender || null); }).catch(() => {}); }, []);
  const ohneRegister = lage ? lage[firma.land]?.namenssuche === false : false;

  useEffect(() => {
    if (stumm.current) { stumm.current = false; return; }
    const wort = q.trim();
    if (wort.length < 3) { setTreffer(null); setOffen(false); return; }
    const ab = new AbortController();
    const uhr = setTimeout(async () => {
      setSucht(true); setOffen(true);
      try {
        const r = await fetch(`/api/fiaon/firmensuche?land=${firma.land}&q=${encodeURIComponent(wort)}`, { signal: ab.signal });
        const j = await r.json();
        setTreffer(Array.isArray(j.treffer) ? j.treffer : []);
        setQuelleText(j.quelleText || ""); setQuelle(j.quelle || "");
        setNurWebsite(j.hinweis === "website");
        setAktiv(-1);
      } catch (e: any) {
        if (e?.name !== "AbortError") { setTreffer([]); setNurWebsite(true); }
      } finally { setSucht(false); }
    }, 350);
    return () => { clearTimeout(uhr); ab.abort(); };
  }, [q, firma.land]);

  const uebernimm = (f: Partial<Firma> & { vertreter?: Vertreter[]; quelleText?: string }) => {
    const felder = (["name", "rechtsform", "registergericht", "registernummer", "strasse", "plz", "ort", "ustId", "website"] as const).filter((k) => f[k]);
    setFirma((alt) => ({ ...alt, ...Object.fromEntries(felder.map((k) => [k, String(f[k])])), quelleRegister: f.quelleRegister || alt.quelleRegister }));
    setGefuellt(felder as unknown as string[]);
    setVertreter(Array.isArray(f.vertreter) ? f.vertreter.map((v) => {
      if (v.nachname || !v.name) return v;
      const w = v.name.trim().split(/\s+/); // voller Name ohne Trennung: letztes Wort = Nachname
      return { ...v, nachname: w.pop() || "", vorname: w.join(" ") };
    }).filter((v) => v.nachname)
      // Wer allein zeichnen darf, steht vorn: Geschäftsführung, Vorstand, Inhaber — dann Prokura.
      .sort((a, b) => rang(a.funktion) - rang(b.funktion)).slice(0, 4) : []);
    setGefundenText(f.quelleText || "");
    setFelderOffen(true);
    if (f.name) { stumm.current = true; setQ(String(f.name)); }
    if (f.website) setWebUrl(String(f.website));
  };

  const waehle = async (x: Treffer) => {
    setOffen(false); setFehler("");
    stumm.current = true; setQ(x.name);
    uebernimm({ name: x.name, rechtsform: x.rechtsform, ort: x.ort, plz: x.plz, quelleText });
    try {
      const r = await fetch(`/api/fiaon/firmensuche/detail?land=${firma.land}&quelle=${encodeURIComponent(x.quelle || quelle)}&id=${encodeURIComponent(x.id)}`);
      const j = await r.json();
      if (j.ok && j.firma) uebernimm({ ...j.firma, quelleText: j.firma.quelleText || quelleText });
    } catch { /* die Trefferzeile steht schon in den Feldern — der Rest von Hand */ }
  };

  const ausWebsite = async () => {
    setWebFehler("");
    if (!webUrl.trim()) return;
    setWebLaedt(true);
    try {
      const r = await fetch("/api/fiaon/firmensuche/impressum", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: webUrl.trim(), land: firma.land }) });
      const j = await r.json();
      if (!j.ok || !j.firma) { setWebFehler(j.grund === "eingabe" && j.error ? j.error : t.websiteFehler); setFelderOffen(true); return; }
      setFehler("");
      uebernimm({ ...j.firma, website: j.firma.website || webUrl.trim() });
    } catch { setWebFehler(t.websiteFehler); setFelderOffen(true); }
    finally { setWebLaedt(false); }
  };

  // ── Schritt 4: Vertrag ──────────────────────────────────────────────────
  const [vertragHtml, setVertragHtml] = useState("");
  const [vertragStand, setVertragStand] = useState<"leer" | "laedt" | "da" | "fehler">("leer");
  const [vertragFehler, setVertragFehler] = useState("");
  const [haken, setHaken] = useState({ vertrag: false, pflichthinweis: false, unternehmer: false, vertretung: false });
  const [hakenPrivat, setHakenPrivat] = useState({ vertrag: false, pflichthinweis: false, widerruf: false });
  // Freiwillig und nie vorangekreuzt: der ausdrückliche Wunsch, vor Ablauf der Widerrufsfrist zu beginnen.
  const [sofortBeginn, setSofortBeginn] = useState(false);
  // Die Wahl ändert Ziffer 5 und 11 — bis die neue Fassung da ist, bleibt die alte stehen, der Knopf wartet.
  const [vertragVeraltet, setVertragVeraltet] = useState(false);
  const [unterschrift, setUnterschrift] = useState<string | null>(null);
  const [sendet, setSendet] = useState(false);
  const [falle, setFalle] = useState("");

  // Was Vorschau und Auftrag über den Auftraggeber schicken — eine Stelle für beide Anfragen.
  const auftraggeberDaten = () => privat
    ? { auftraggeber: "privat", firma: anschrift, ansprechpartner: { ...person, funktion: "" } }
    : { auftraggeber: "unternehmen", firma: { ...firma, quelleRegister: firma.quelleRegister || undefined }, ansprechpartner: person };

  const vertragLaden = async (still = false) => {
    if (still) setVertragVeraltet(true); else setVertragStand("laedt");
    try {
      const r = await fetch("/api/fiaon/global/vertrag/vorschau", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paket, ...auftraggeberDaten(), bestaetigungen: privat ? { sofortBeginn } : undefined, sprache: s }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok || !j.html) {
        // 17.09.2026 live: sechs Vorschauen mit 400 — der Kunde sah nur „konnte nicht geladen werden".
        // Der Server nennt Grund und Feld; wir führen dorthin zurück, wo es zu korrigieren ist.
        const feld = typeof j.feld === "string" ? j.feld : "";
        if (feld.startsWith("firma") || feld.startsWith("privat")) { setFelderOffen(true); gehe(1); setFehler(j.error || (privat ? t.privatPflicht : t.firmaPflicht)); setVertragStand("leer"); return; }
        if (feld.startsWith("ansprechpartner")) { gehe(2); setFehler(j.error || (privat ? t.kontaktPflicht : t.personPflicht)); setVertragStand("leer"); return; }
        if (feld === "paket") { gehe(0); setFehler(j.error || t.paketWaehlen); setVertragStand("leer"); return; }
        setVertragFehler(j.error || ""); setVertragStand("fehler"); return;
      }
      setVertragHtml(String(j.html)); setVertragStand("da");
    } catch { setVertragFehler(""); setVertragStand("fehler"); }
    finally { setVertragVeraltet(false); }
  };
  useEffect(() => { if (schritt === 3 && !fertig) vertragLaden(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [schritt]);
  // Der Wunsch zum Beginn steht im Vertrag (Ziffer 5 und 11) — die Vorschau zieht still nach.
  const ersterBeginn = useRef(true);
  useEffect(() => {
    if (ersterBeginn.current) { ersterBeginn.current = false; return; }
    if (schritt === 3 && !fertig && privat && vertragStand === "da") vertragLaden(true);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [sofortBeginn]);

  // ── Prüfen und weiter ───────────────────────────────────────────────────
  const weiter = () => {
    if (schritt === 0) { if (!globalPaket(paket)) return setFehler(t.paketWaehlen); return gehe(1); }
    if (schritt === 1 && privat) {
      // Dieselben Regeln wie server/lib/fiaon-global-auftrag.ts (privatPruefen/anschriftPruefen).
      if (!person.vorname.trim() || !person.nachname.trim() || !anschrift.strasse.trim() || !anschrift.plz.trim() || !anschrift.ort.trim()) return setFehler(t.privatPflicht);
      if ([person.vorname, person.nachname, anschrift.strasse, anschrift.ort].some(istFiaonSelbst)) return setFehler(t.fiaonSelbstPrivat);
      if (anschrift.strasse.trim().length < 3) return setFehler(t.strasseFalsch);
      if (!(anschrift.land === "DE" ? /^\d{5}$/ : /^\d{4}$/).test(anschrift.plz.trim())) return setFehler(t.plzFalsch(t.laender[anschrift.land], anschrift.land === "DE" ? 5 : 4));
      return gehe(2);
    }
    if (schritt === 1) {
      if (!firma.name.trim() || !firma.rechtsform.trim() || !firma.strasse.trim() || !firma.plz.trim() || !firma.ort.trim()) { setFelderOffen(true); return setFehler(t.firmaPflicht); }
      // Dieselben Regeln wie server/lib/fiaon-global-auftrag.ts (firmaPruefen) — sonst scheitert erst die Vertragsvorschau.
      if (firma.strasse.trim().length < 3) { setFelderOffen(true); return setFehler(t.strasseFalsch); }
      // FIAON ist die Gegenseite — dieselbe Regel wie der Server (istFiaonSelbst, Florentines Fund 19.09.2026).
      if ([firma.name, firma.rechtsform, firma.strasse, firma.ort, firma.registergericht, firma.registernummer, firma.website].some(istFiaonSelbst)) { setFelderOffen(true); return setFehler(t.fiaonSelbst); }
      if (!(firma.land === "DE" ? /^\d{5}$/ : /^\d{4}$/).test(firma.plz.trim())) { setFelderOffen(true); return setFehler(t.plzFalsch(t.laender[firma.land], firma.land === "DE" ? 5 : 4)); }
      const ust = firma.ustId.toUpperCase().replace(/[\s.\-]/g, "");
      if (ust && !/^(DE\d{9}|ATU\d{8}|CHE\d{9}(MWST|TVA|IVA)?)$/.test(ust)) { setFelderOffen(true); return setFehler(t.ustIdFalsch); }
      return gehe(2);
    }
    if (schritt === 2) {
      if (privat ? (!person.email.trim() || !person.telefon.trim()) : (!person.vorname.trim() || !person.nachname.trim() || !person.funktion.trim() || !person.email.trim() || !person.telefon.trim())) return setFehler(privat ? t.kontaktPflicht : t.personPflicht);
      if (!privat && [person.vorname, person.nachname, person.funktion].some(istFiaonSelbst)) return setFehler(t.fiaonSelbstPerson);
      if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(person.email.trim())) return setFehler(t.emailFalsch);
      const ziffern = person.telefon.replace(/[^\d+]/g, "");
      if (ziffern.replace(/\D/g, "").length < 7 || !/^(\+4[913]|004[913]|0)/.test(ziffern)) return setFehler(t.telefonFalsch);
      return gehe(3);
    }
  };

  const beauftragen = async () => {
    setFehler("");
    const alleHaken = privat
      ? hakenPrivat.vertrag && hakenPrivat.pflichthinweis && hakenPrivat.widerruf
      : haken.vertrag && haken.pflichthinweis && haken.unternehmer && haken.vertretung;
    if (!alleHaken || !unterschrift) return setFehler(privat ? t.hakenFehlenPrivat : t.hakenFehlen);
    setSendet(true);
    try {
      const r = await fetch("/api/fiaon/global/auftrag", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        paket, ...auftraggeberDaten(),
        bestaetigungen: privat ? { ...hakenPrivat, sofortBeginn } : haken, unterschriftPng: unterschrift, sprache: s, quelle: new URLSearchParams(window.location.search).get("quelle") || "business_seite", falle,
        kampagne: kampagne(),
      }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) {
        setFehler(j.error || t.fehler);
        if (typeof j.feld === "string") { if (j.feld.startsWith("firma") || j.feld.startsWith("privat")) gehe(1); else if (j.feld.startsWith("ansprechpartner")) gehe(2); setFehler(j.error || t.fehler); }
        return;
      }
      void werbeKonversion("auftrag", { wert: typeof j.betragCents === "number" ? j.betragCents / 100 : undefined, id: String(j.ref || ""), paket });
      const f: Fertig = { ref: j.ref, token: j.token, email: j.email || person.email, zahlungsseite: j.zahlungsseite, art, sofort: privat ? sofortBeginn : undefined };
      schreiben(ABSCHLUSS, f); schreiben(ENTWURF, null);
      setFertig(f);
      requestAnimationFrame(() => blatt.current?.scrollIntoView({ block: "start" }));
    } catch { setFehler(t.fehler); }
    finally { setSendet(false); }
  };

  // ── Bestätigung: Überweisungsdaten vom Server ───────────────────────────
  const [status, setStatus] = useState<Status | null>(null);
  useEffect(() => {
    if (!fertig) return;
    fetch(`/api/fiaon/global/auftrag/${encodeURIComponent(fertig.ref)}?t=${encodeURIComponent(fertig.token)}`)
      .then((r) => r.json()).then((j) => { if (j.ok) setStatus(j); }).catch(() => {});
  }, [fertig]);
  const [kopiert, setKopiert] = useState("");
  const kopiere = async (k: string, wert: string) => { try { await navigator.clipboard.writeText(wert); setKopiert(k); setTimeout(() => setKopiert(""), 1600); } catch { /* ohne Zwischenablage: der Wert steht ja da */ } };

  const g = globalPaket(paket);
  const euro = (cents: number) => (cents / 100).toLocaleString(s === "en" ? "en-GB" : "de-DE", { style: "currency", currency: "EUR" });
  const tagText = (iso?: string) => iso ? new Date(iso.slice(0, 10) + "T12:00:00").toLocaleDateString(s === "en" ? "en-GB" : "de-DE", { day: "numeric", month: "long", year: "numeric" }) : "";

  const feldF = (k: keyof Firma, label: string, extra: Record<string, unknown> = {}) => (
    <label>
      <span className="gs-label">{label}</span>
      <input className="gs-feld" data-gefuellt={gefuellt.includes(k) ? "1" : undefined} value={String(firma[k] ?? "")} onChange={(e) => { setFirma({ ...firma, [k]: e.target.value }); setGefuellt(gefuellt.filter((x) => x !== k)); }} {...extra} />
    </label>
  );
  const feldA = (k: Exclude<keyof Anschrift, "land">, label: string, extra: Record<string, unknown> = {}) => (
    <label>
      <span className="gs-label">{label}</span>
      <input className="gs-feld" value={anschrift[k]} onChange={(e) => setAnschrift({ ...anschrift, [k]: e.target.value })} {...extra} />
    </label>
  );
  const anredeFeld = (
    <label>
      <span className="gs-label">{t.anrede}</span>
      <select className="gs-feld" value={person.anrede} onChange={(e) => setPerson({ ...person, anrede: e.target.value })}>
        {t.anreden.map((a, i) => <option key={i} value={["", "Frau", "Herr"][i]}>{a || "—"}</option>)}
      </select>
    </label>
  );
  const feldP = (k: keyof Person, label: string, typ = "text", auto?: string) => (
    <label>
      <span className="gs-label">{label}</span>
      <input className="gs-feld" type={typ} autoComplete={auto} value={person[k]} onChange={(e) => setPerson({ ...person, [k]: e.target.value })} />
    </label>
  );

  return (
    <Dunkel seite="business" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <div className="gs">
        <div className="dk-rahmen">
          <header className="gs-kopf">
            <span className="gs-auge">{fertig ? t.fertigPille : t.pille}</span>
            <h1 className="gs-h1">{fertig ? t.fertigTitel : t.titel}</h1>
            <p className="gs-lead">{fertig ? (fertig.art === "privat" && !fertig.sofort ? t.fertigLeadWartet(fertig.email) : t.fertigLead(fertig.email)) : t.lead}</p>
          </header>

          <div className="gs-rahmen">
            <div className="gs-blatt" ref={blatt} style={{ scrollMarginTop: 100 }}>
              {fertig ? (
                <>
                  <h2>{t.zahlungTitel}</h2>
                  <p className="gs-ref"><span>{t.referenz}</span><b>{fertig.ref}</b></p>
                  {status?.zahlung && (
                    <>
                      <div className="gs-bank">
                        <h3>{t.zahlungTitel}</h3>
                        {([
                          ["empfaenger", t.empfaenger, status.zahlung.empfaenger],
                          ["iban", t.iban, status.zahlung.ibanAnzeige],
                          ["bic", t.bic, status.zahlung.bic],
                          ["betrag", t.betrag, euro(status.betragCents)],
                          ["zweck", t.zweck, status.zahlung.verwendungszweck],
                          ...(status.zahlung.faelligAm ? [["faellig", t.faellig, tagText(status.zahlung.faelligAm)]] : []),
                        ] as [string, string, string][]).map(([k, label, wert]) => (
                          <div className="zeile" key={k}>
                            <span>{label}</span><b>{wert}</b>
                            {k !== "faellig" ? <button type="button" onClick={() => kopiere(k, k === "iban" ? wert.replace(/\s/g, "") : wert)}>{kopiert === k ? t.kopiert : t.kopieren}</button> : <i />}
                          </div>
                        ))}
                      </div>
                      <p className="gs-bank-hinweis">{t.zweckHinweis}</p>
                      {status.zahlung.qrDatenUrl && <img className="gs-qr" src={status.zahlung.qrDatenUrl} alt="" />}
                    </>
                  )}
                  <div className="gs-dateien">
                    {status?.vertragUrl && <a href={status.vertragUrl} target="_blank" rel="noopener">{t.vertragPdf}</a>}
                    {status?.rechnungUrl && <a href={status.rechnungUrl} target="_blank" rel="noopener">{t.rechnungPdf}</a>}
                    {(status?.zahlungsseite || fertig.zahlungsseite) && <a href={status?.zahlungsseite || fertig.zahlungsseite}>{t.zahlungsseite}</a>}
                  </div>
                  <div className="gs-fuss"><a className="gs-zurueck" href={zu("/business")} onClick={() => schreiben(ABSCHLUSS, null)}>{t.zurSeite}</a><span /></div>
                </>
              ) : (
                <>
                  <ol className="gs-schritte" aria-label={t.titel}>
                    {(privat ? t.schrittePrivat : t.schritte).map((name, i) => (
                      <li key={name} data-stand={i < schritt ? "fertig" : i === schritt ? "jetzt" : "offen"} aria-current={i === schritt ? "step" : undefined}><span>{i < schritt ? "✓" : i + 1}</span>{name}</li>
                    ))}
                  </ol>

                  {schritt === 0 && (
                    <>
                      <h2>{t.paketTitel}</h2>
                      <p className="lead">{t.paketLead}</p>
                      <div className="gs-pakete" role="radiogroup" aria-label={t.paketTitel}>
                        {GLOBAL_PAKETE.map((p) => (
                          <button key={p.key} type="button" role="radio" aria-checked={paket === p.key} className="gs-paket" onClick={() => { setPaket(p.key); setFehler(""); }}>
                            <span className="punkt" aria-hidden="true" />
                            <span>
                              <b>{p[s].name}</b>
                              <p>{p[s].fuer}</p>
                              <span className="masse">{t.planung} {globalPlanungText(p.key, s)} · {p[s].dauer}</span>
                            </span>
                            <span className="preis">{globalPreisText(p.key, s)}<small>{t.einmalig}</small></span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Das gewählte Paket bleibt sichtbar — am Handy steht die Übersicht erst unter dem Formular. */}
                  {schritt > 0 && g && (
                    <p className="gs-gewaehlt">
                      <span>{t.ihrPaket}: <b>FIAON {g[s].name}</b> · {globalPreisText(g.key, s)}</span>
                      <button type="button" onClick={() => gehe(0)}>{t.paketAendern}</button>
                    </p>
                  )}

                  {schritt === 1 && (
                    <>
                      <h2>{privat ? t.privatTitel : t.firmaTitel}</h2>
                      <p className="lead">{privat ? t.privatLead : t.firmaLead}</p>
                      <div className="gs-art" role="radiogroup" aria-label={t.artLabel}>
                        {(["unternehmen", "privat"] as Auftraggeber[]).map((a) => (
                          <button key={a} type="button" role="radio" aria-checked={art === a} onClick={() => { setArt(a); setFehler(""); }}>
                            <span className="punkt" aria-hidden="true" />
                            <span><b>{a === "privat" ? t.artPrivat : t.artUnternehmen}</b><small>{a === "privat" ? t.artPrivatText : t.artUnternehmenText}</small></span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {schritt === 1 && privat && (
                    <div className="gs-felder">
                      <div>
                        <span className="gs-label">{t.wohnsitz}</span>
                        <div className="gs-seg" role="group" aria-label={t.wohnsitz}>
                          {(["DE", "AT", "CH"] as Land[]).map((l) => (
                            <button key={l} type="button" aria-pressed={anschrift.land === l} onClick={() => setAnschrift({ ...anschrift, land: l })}>{t.laender[l]}</button>
                          ))}
                        </div>
                      </div>
                      <div className="drei">{anredeFeld}{feldP("vorname", t.vorname, "text", "given-name")}</div>
                      {feldP("nachname", t.nachname, "text", "family-name")}
                      {feldA("strasse", t.strasse, { autoComplete: "street-address" })}
                      <div className="drei">{feldA("plz", t.plz, { autoComplete: "postal-code", inputMode: "numeric" })}{feldA("ort", t.ort, { autoComplete: "address-level2" })}</div>
                    </div>
                  )}

                  {schritt === 1 && !privat && (
                    <>
                      <div className="gs-felder">
                        <div>
                          <span className="gs-label">{t.land}</span>
                          <div className="gs-seg" role="group" aria-label={t.land}>
                            {(["DE", "AT", "CH"] as Land[]).map((l) => (
                              <button key={l} type="button" aria-pressed={firma.land === l} onClick={() => { setFirma({ ...firma, land: l }); setTreffer(null); setNurWebsite(false); }}>{t.laender[l]}</button>
                            ))}
                          </div>
                        </div>
                        <div className="gs-suche">
                          <label className="gs-label" htmlFor="gs-suche">{t.suche}</label>
                          <div style={{ position: "relative" }}>
                            <svg className="lupe" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.6-3.6" /></svg>
                            <input id="gs-suche" className="gs-feld" role="combobox" aria-expanded={offen} aria-controls="gs-treffer" aria-autocomplete="list" autoComplete="off" placeholder={t.suchePlatz}
                              value={q}
                              onChange={(e) => { setQ(e.target.value); setFirma({ ...firma, name: e.target.value }); }}
                              onFocus={() => { if (treffer) setOffen(true); }}
                              onBlur={() => setTimeout(() => setOffen(false), 160)}
                              onKeyDown={(e) => {
                                if (!offen || !treffer?.length) return;
                                if (e.key === "ArrowDown") { e.preventDefault(); setAktiv((a) => Math.min(a + 1, treffer.length - 1)); }
                                else if (e.key === "ArrowUp") { e.preventDefault(); setAktiv((a) => Math.max(a - 1, 0)); }
                                else if (e.key === "Enter" && aktiv >= 0) { e.preventDefault(); waehle(treffer[aktiv]); }
                                else if (e.key === "Escape") setOffen(false);
                              }} />
                          </div>
                          {offen && (
                            <ul id="gs-treffer" className="gs-treffer" role="listbox">
                              {sucht && <li className="laedt">{t.sucht}</li>}
                              {!sucht && treffer?.length === 0 && <li className="leer">{t.keineTreffer}</li>}
                              {!sucht && treffer?.map((x, i) => (
                                <li key={x.quelle + x.id} role="option" aria-selected={aktiv === i} onMouseDown={(e) => { e.preventDefault(); waehle(x); }}>
                                  <b>{x.name}</b>
                                  <span>{[x.rechtsform, [x.plz, x.ort].filter(Boolean).join(" "), x.register].filter(Boolean).join(" · ")}</span>
                                </li>
                              ))}
                              {!sucht && !!treffer?.length && quelleText && <li className="quelle">{quelleText}</li>}
                            </ul>
                          )}
                        </div>
                      </div>

                      {(ohneRegister || nurWebsite || treffer?.length === 0) && (
                        <div className="gs-web">
                          <h3>{t.websiteTitel}</h3>
                          <p>{t.websiteText}</p>
                          <div className="reihe">
                            <input className="gs-feld" inputMode="url" autoComplete="url" placeholder={t.websitePlatz} value={webUrl} onChange={(e) => setWebUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ausWebsite(); } }} />
                            <button type="button" className="gs-knopf" style={{ minHeight: 50 }} disabled={webLaedt || !webUrl.trim()} onClick={ausWebsite}>{webLaedt ? t.websiteLaedt : t.websiteKnopf}</button>
                          </div>
                          {webFehler && <p className="gs-fehler" role="alert" style={{ marginTop: 12 }}>{webFehler}</p>}
                        </div>
                      )}

                      {!felderOffen && <button type="button" className="gs-link" onClick={() => setFelderOffen(true)}>{t.selbst}</button>}

                      {felderOffen && (
                        <>
                          {gefuellt.length > 0 && <p className="gs-quelle">{t.uebernommen}{gefundenText ? " " + gefundenText : ""}</p>}
                          <div className="gs-felder">
                            <div className="zwei">
                              {feldF("name", t.name, { autoComplete: "organization" })}
                              <label>
                                <span className="gs-label">{t.rechtsform}</span>
                                <input className="gs-feld" list="gs-rechtsformen" data-gefuellt={gefuellt.includes("rechtsform") ? "1" : undefined} value={firma.rechtsform} onChange={(e) => setFirma({ ...firma, rechtsform: e.target.value })} />
                                <datalist id="gs-rechtsformen">{RECHTSFORMEN[firma.land].map((x) => <option key={x} value={x} />)}</datalist>
                              </label>
                            </div>
                            <div className="zwei">{feldF("registergericht", t.registergericht)}{feldF("registernummer", t.registernummer)}</div>
                            {feldF("strasse", t.strasse, { autoComplete: "street-address" })}
                            <div className="drei">{feldF("plz", t.plz, { autoComplete: "postal-code", inputMode: "numeric" })}{feldF("ort", t.ort, { autoComplete: "address-level2" })}</div>
                            <div className="zwei">{feldF("ustId", t.ustId)}{feldF("website", t.website, { inputMode: "url" })}</div>
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {schritt === 2 && privat && (
                    <>
                      <h2>{t.kontaktTitel}</h2>
                      <p className="lead">{t.kontaktLead}</p>
                      <div className="gs-felder">
                        <div className="zwei">{feldP("email", t.emailPrivat, "email", "email")}{feldP("telefon", t.telefon, "tel", "tel")}</div>
                      </div>
                    </>
                  )}

                  {schritt === 2 && !privat && (
                    <>
                      <h2>{t.personTitel}</h2>
                      <p className="lead">{t.personLead}</p>
                      {vertreter.length > 0 && (
                        <div className="gs-vertreter">
                          <span>{t.uebernehmen}</span>
                          {vertreter.map((v, i) => (
                            <button key={i} type="button" onClick={() => setPerson({ ...person, vorname: v.vorname || "", nachname: v.nachname || "", funktion: v.funktion || person.funktion })}>
                              {[v.vorname, v.nachname].filter(Boolean).join(" ")}{v.funktion ? ` · ${v.funktion}` : ""}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="gs-felder">
                        <div className="drei">
                          {anredeFeld}
                          {feldP("vorname", t.vorname, "text", "given-name")}
                        </div>
                        <div className="zwei">
                          {feldP("nachname", t.nachname, "text", "family-name")}
                          <label>
                            <span className="gs-label">{t.funktion}</span>
                            <input className="gs-feld" list="gs-funktionen" value={person.funktion} onChange={(e) => setPerson({ ...person, funktion: e.target.value })} />
                            <datalist id="gs-funktionen">{t.funktionen.map((x) => <option key={x} value={x} />)}</datalist>
                          </label>
                        </div>
                        <div className="zwei">{feldP("email", t.email, "email", "email")}{feldP("telefon", t.telefon, "tel", "tel")}</div>
                      </div>
                    </>
                  )}

                  {schritt === 3 && (
                    <>
                      <h2>{t.vertragTitel}</h2>
                      <p className="lead">{privat ? t.vertragLeadPrivat : t.vertragLead}</p>
                      {privat && vertragStand === "da" && (
                        <div className="gs-beginn">
                          <h3>{t.beginnTitel}</h3>
                          <p>{t.beginnText}</p>
                          <label><input type="checkbox" checked={sofortBeginn} onChange={(e) => setSofortBeginn(e.target.checked)} /><span>{t.sofortBeginn}</span></label>
                        </div>
                      )}
                      {vertragStand === "laedt" && <p className="gs-gut">{t.vertragLaedt}</p>}
                      {vertragStand === "fehler" && <p className="gs-fehler" role="alert">{vertragFehler || t.vertragFehler} <button type="button" className="gs-link" style={{ marginTop: 0 }} onClick={() => vertragLaden()}>{t.erneut}</button></p>}
                      {vertragStand === "da" && (
                        <>
                          {/* Der Text kommt von unserem eigenen Server aus derselben Quelle wie das PDF; Kundenangaben sind dort maskiert. */}
                          <div className="gs-vertrag" tabIndex={0} aria-busy={vertragVeraltet || undefined} data-veraltet={vertragVeraltet ? "1" : undefined} dangerouslySetInnerHTML={{ __html: vertragHtml }} />
                          <div className="gs-haken">
                            {privat
                              ? (Object.keys(hakenPrivat) as (keyof typeof hakenPrivat)[]).map((k) => (
                                <label key={k}><input type="checkbox" checked={hakenPrivat[k]} onChange={(e) => setHakenPrivat({ ...hakenPrivat, [k]: e.target.checked })} /><span>{t.hakenPrivat[k]}</span></label>
                              ))
                              : (Object.keys(haken) as (keyof typeof haken)[]).map((k) => (
                                <label key={k}><input type="checkbox" checked={haken[k]} onChange={(e) => setHaken({ ...haken, [k]: e.target.checked })} /><span>{t.haken[k]}</span></label>
                              ))}
                          </div>
                          <div className="gs-unterschrift">
                            <h3>{t.unterschrift} — {[person.vorname, person.nachname].filter(Boolean).join(" ")}{privat ? "" : `, ${person.funktion}`}</h3>
                            <SignaturePad onChange={(d) => setUnterschrift(d && d.startsWith("data:image/png") ? d : null)} hinweis={t.unterschriftHinweis} zuruecksetzen={t.zuruecksetzen} />
                          </div>
                          <input className="gs-falle" tabIndex={-1} autoComplete="off" aria-hidden="true" value={falle} onChange={(e) => setFalle(e.target.value)} />
                        </>
                      )}
                    </>
                  )}

                  {fehler && <p className="gs-fehler" role="alert">{fehler}</p>}
                  <div className="gs-fuss gs-fuss-schritt">
                    {schritt > 0 ? <button type="button" className="gs-zurueck" onClick={() => gehe(schritt - 1)}>← {t.zurueck}</button> : <span />}
                    {schritt < 3
                      ? <button type="button" className="gs-knopf" onClick={weiter}>{t.weiter}: {(privat ? t.schrittePrivat : t.schritte)[schritt + 1]}</button>
                      : <button type="button" className="gs-knopf" onClick={beauftragen} disabled={sendet || vertragStand !== "da" || vertragVeraltet}>{sendet ? t.sendet : t.beauftragen}</button>}
                  </div>
                </>
              )}
            </div>

            <aside className="gs-seite" aria-label={t.auftrag}>
              <div className="gs-seite-kopf">
                <h2>{t.auftrag}</h2>
                {g ? (
                  <>
                    <p className="name">FIAON {g[s].name}</p>
                    <p className="preis">{globalPreisText(g.key, s)}<small>{t.festpreis}</small></p>
                  </>
                ) : <p className="klein" style={{ marginTop: 10 }}>{t.paketWaehlen}</p>}
              </div>
              <div className="gs-seite-rumpf">
                {g && (
                  <div className="masse">
                    <div><span>{t.planung}</span><b>{globalPlanungText(g.key, s)}</b><em>{t.planungZusatz}</em></div>
                    <div><span>{t.begleitung}</span><b>{g[s].dauerKurz}</b></div>
                  </div>
                )}
                <h3>{t.inklusiveTitel}</h3>
                <ul className="gs-inkl">{GLOBAL_INKLUSIVE[s].map((x) => <li key={x}>{x}</li>)}</ul>
                <h3>{t.soGehtEs}</h3>
                <ol>{(privat ? t.ablaufPrivat : t.ablauf).map((x) => <li key={x}>{x}</li>)}</ol>
                <ul className="gs-sicher">{[...(GLOBAL_GELD_ZURUECK.aktiv ? [GLOBAL_GELD_ZURUECK[s].kurz] : []), ...(privat ? t.sicherPrivat : t.sicher)].map((x) => <li key={x}>{x}</li>)}</ul>
                {!fertig && <a className="gs-sprechen" href={`${zu("/business")}${paket ? `?paket=${paket}` : ""}#gespraech`}>{t.lieberSprechen}</a>}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </Dunkel>
  );
}
