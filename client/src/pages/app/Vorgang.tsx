// ═══════════════════════════════════════════════════════════════════════════
// /app/vorgaenge/:id — EIN Vorgang (Bauvorlage 3.6, Scheibe 5, 05.09.2026)
//
// Gesetz 3: Der Kunde sieht die Arbeit. Kopf mit Zurück, Titel, Empfänger und
// Aktenzeichen (Mono, Kopieren); Standkarte mit dem großen Standsatz und der
// Fristzeile; Betrag oder Spanne mit Grundlage; vertikale Zeitleiste (erledigte
// Punkte gefüllt, künftige als leere Ringe); beim Brief „Das haben wir daraus
// gemacht“; Karte „Ihr Schreiben“ (HTML im Blatt, kein PDF-Download am Handy);
// Karte „Was das für Sie heißt“.
//
// Genau eine Handlung je Stand: unterschrift_offen → „Jetzt unterschreiben“;
// versandt/nachfrage → „Antwort fotografieren“ (Kamera-Fluss wie Brief.tsx,
// POST …/bescheid); Textlinks „Frage zu diesem Vorgang“ und still „Antrag
// zurückziehen“ (nur vor dem Versand, mit Rückfrage).
//
// Daten: GET /kunde/:ref/app/vorgaenge/:id (Modul B). Demo: id 2 (P-Konto
// versandt) und 3 (Brief) aus DEMO_POST — feste Werte, kein Aufruf.
// ═══════════════════════════════════════════════════════════════════════════
import { Fragment, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { api, eur, DEMO_POST } from "./Bausteine";
import { artKlartext } from "./Vollmacht";
import "@/styles/app-antraege.css";

// ── Antwortform von GET /vorgaenge/:id (Spec Modul B) ───────────────────────
interface Ereignis { art: string; am: string | null; text: string | null }
interface Dokument { id: number; art: string; dateiname: string; am: string | null }
interface Regel { titel: string; rechtsgrundlage: string; geprueftAm: string | null; stelle: string; wasWirTun: string }
export interface VorgangDetail {
  id: number; art: string; artTitel: string; titel: string; stand: string; standSatz: string | null; aktenzeichen: string | null; empfaenger: string | null;
  eingegangenAm: string | null; versandtAm: string | null; fristAm: string | null; erinnertAm: string | null;
  /** Tag, an dem ein Mitarbeiter die Nachfrage quittiert hat — erst dann heißt es „Wir haben nachgefragt“. */
  nachgefragtAm: string | null;
  betragCents: number | null; monatlich: boolean | null; regel: Regel | null; hinweisFuerKunden: string | null;
  schreibenHtml: string | null; unterschriftUrl: string | null; dokumente: Dokument[]; zeitleiste: Ereignis[];
}

const ERLEDIGT = ["bewilligt", "abgelehnt", "zurueckgezogen", "erledigt"];
const VOR_VERSAND = ["entwurf", "unterschrift_offen", "versandbereit"];

/** Standsatz nach Bauvorlage 3.6 — nur Rückfall, wenn der Server keinen liefert. Zahlen kommen aus Datenfeldern. */
function standSatzRueckfall(v: VorgangDetail): string {
  const betrag = v.betragCents !== null && v.betragCents !== undefined ? `${eur(v.betragCents)} ${v.monatlich === false ? "einmalig" : "im Monat"}` : null;
  switch (v.stand) {
    case "entwurf": return "Wird vorbereitet.";
    case "unterschrift_offen": return "Wartet auf Ihre Unterschrift.";
    case "versandbereit": return "Unterschrieben – ein Mitarbeiter versendet und bestätigt den Versand hier.";
    case "versandt": return `Versandt${v.versandtAm ? ` am ${v.versandtAm}` : ""}${v.empfaenger ? ` an ${v.empfaenger}` : ""}.${v.fristAm ? ` Antwort erwartet bis ${v.fristAm}.` : ""}`;
    // „nachgefragt“ nur mit Datenbedingung: Der Wächter legt den Auftrag an, quittiert wird von einem Menschen (nachgefragtAm).
    case "nachfrage": return v.nachgefragtAm
      ? `Keine Antwort${v.fristAm ? ` bis ${v.fristAm}` : ""}. Wir haben am ${v.nachgefragtAm} nachgefragt. Sie müssen nichts tun.`
      : `Keine Antwort${v.fristAm ? ` bis ${v.fristAm}` : ""}. Die Nachfrage ist in Arbeit.`;
    case "bewilligt": return `Bewilligt${betrag ? `: ${betrag}` : ""}.`;
    case "abgelehnt": return "Abgelehnt. Was das heißt, steht in der Notiz Ihrer Ansprechperson im Verlauf.";
    case "zurueckgezogen": return "Zurückgezogen auf Ihren Wunsch.";
    case "eingegangen": return `Eingegangen${v.eingegangenAm ? ` am ${v.eingegangenAm}` : ""}. Noch nicht gelesen.`;
    case "gelesen": return "Gelesen. Wir ordnen den Brief Ihrer Akte zu.";
    case "erledigt": return "Erledigt.";
    default: return v.stand;
  }
}

const kanteFuer = (stand: string) => stand === "unterschrift_offen" ? "wartet" : stand === "nachfrage" ? "ueberfaellig" : stand === "versandt" ? "unterwegs" : stand === "bewilligt" || stand === "erledigt" ? "gut" : "";

// ── Zeitleiste: feste Stationen, gefüllt aus Ereignissen ────────────────────
interface Station { key: string; titel: string; lage: "fertig" | "jetzt" | "kommt"; am: string | null; text: string | null }

function stationen(v: VorgangDetail): Station[] {
  const e = (arten: string[]): Ereignis | null => { let letztes: Ereignis | null = null; for (const x of v.zeitleiste) if (arten.indexOf(x.art) !== -1) letztes = x; return letztes; };
  const mach = (key: string, titel: string, ev: Ereignis | null, jetzt: boolean, textOhne?: string | null): Station =>
    ev ? { key, titel, lage: "fertig", am: ev.am, text: ev.text } : { key, titel, lage: jetzt ? "jetzt" : "kommt", am: null, text: textOhne ?? null };
  const fertig = ERLEDIGT.indexOf(v.stand) !== -1;

  if (v.art === "brief") {
    const gelesen = e(["gelesen", "notiz"]) || (v.stand !== "eingegangen" ? { art: "gelesen", am: null, text: null } : null);
    const notiz = e(["notiz"]);
    const ergebnis = e(["bewilligt", "abgelehnt", "erledigt", "zurueckgezogen"]);
    return [
      { key: "eingang", titel: "Eingegangen", lage: "fertig", am: v.eingegangenAm, text: null },
      mach("gelesen", "Gelesen", gelesen, v.stand === "eingegangen"),
      mach("notiz", "Das haben wir daraus gemacht", notiz, !!gelesen && !notiz && !fertig, null),
      mach("ergebnis", "Erledigt", ergebnis, false, fertig ? standSatzRueckfall(v) : null),
    ];
  }

  const befund = e(["befund"]) ?? { art: "befund", am: v.eingegangenAm, text: null };
  const vollmacht = e(["vollmacht"]);
  const entwurf = e(["entwurf", "unterschrift_offen"]);
  const unterschrieben = e(["unterschrieben"]);
  const versandt = e(["versandt"]);
  const antwort = e(["antwort_da"]);
  // „Nachgefragt“ ist erst erledigt, wenn ein Mensch die Nachfrage quittiert hat (nachgefragtAm) — der Wächter legt nur den Auftrag an.
  const nachfrage = v.nachgefragtAm ? (e(["nachfrage"]) ?? { art: "nachfrage", am: v.nachgefragtAm, text: null }) : null;
  const ergebnis = e(["bewilligt", "abgelehnt", "zurueckgezogen"]);
  const liste: Station[] = [
    { key: "befund", titel: "Befund", lage: "fertig", am: befund.am, text: befund.text },
    mach("vollmacht", "Vollmacht", vollmacht, false, vollmacht ? null : "Liegt vor oder wird mit dem Antrag unterschrieben."),
    mach("entwurf", "Entwurf", entwurf, v.stand === "entwurf"),
    mach("unterschrieben", "Von Ihnen unterschrieben", unterschrieben, v.stand === "unterschrift_offen"),
    mach("versandt", `Versandt${v.empfaenger ? ` an ${v.empfaenger}` : ""}`, versandt, v.stand === "versandbereit"),
    antwort || ergebnis
      ? { key: "frist", titel: "Antwort erwartet", lage: "fertig", am: v.fristAm, text: antwort ? "Ihre Antwort liegt in der Akte." : null }
      : { key: "frist", titel: v.fristAm ? `Antwort erwartet bis ${v.fristAm}` : "Antwort erwartet", lage: v.stand === "versandt" ? "jetzt" : "kommt", am: null, text: null },
  ];
  if (nachfrage || v.stand === "nachfrage" || v.stand === "versandt") liste.push(mach("nachfrage", "Nachgefragt", nachfrage, v.stand === "nachfrage", v.stand === "nachfrage" ? "Die Nachfrage ist in Arbeit." : null));
  liste.push(ergebnis
    ? { key: "ergebnis", titel: "Ergebnis", lage: "fertig", am: ergebnis.am, text: ergebnis.text ?? standSatzRueckfall(v) }
    : { key: "ergebnis", titel: "Ergebnis", lage: antwort ? "jetzt" : "kommt", am: null, text: antwort ? "Wird geprüft und hier eingetragen." : null });
  // Hinter dem Ergebnis ist nichts mehr „jetzt“.
  if (ergebnis || v.stand === "zurueckgezogen") for (const s of liste) if (s.lage === "jetzt") s.lage = "kommt";
  return liste;
}

// ── Demo: feste Beispieldaten für Vorgang 2 (P-Konto, versandt) und 3 (Brief) ─
function demoVorgang(id: number): VorgangDetail | null {
  const p = DEMO_POST.find((x) => x.id === id);
  if (!p) return null;
  const basis: VorgangDetail = {
    id: p.id, art: p.art, artTitel: p.artText, titel: p.titel, stand: p.stand, standSatz: null, aktenzeichen: p.aktenzeichen ?? `AZ 2026-00000${p.id}`, empfaenger: p.empfaenger,
    eingegangenAm: p.eingegangenAm, versandtAm: p.versandtAm, fristAm: p.fristAm, erinnertAm: null, nachgefragtAm: null, betragCents: null, monatlich: null, regel: null, hinweisFuerKunden: null,
    schreibenHtml: null, unterschriftUrl: null, dokumente: [], zeitleiste: [],
  };
  if (id === 2) {
    return {
      ...basis, betragCents: 59742, monatlich: true,
      regel: { titel: "Höherer Schutzbetrag auf dem P-Konto", rechtsgrundlage: "§ 902 Satz 1 Nr. 1 ZPO i. V. m. § 850c ZPO", geprueftAm: "05.09.2026", stelle: "Ihre Bank – gegen Bescheinigung der zuständigen Stelle", wasWirTun: "Wir haben den Antrag an Ihre Bank vorbereitet und übermittelt. Die Bescheinigung stellt die zuständige Stelle aus, nicht FIAON." },
      hinweisFuerKunden: "Die Bescheinigung stellt nicht FIAON aus, sondern die zuständige Stelle – zum Beispiel Arbeitgeber, Jobcenter oder eine anerkannte Schuldnerhilfe. Der Weg dorthin steht in Ihrem Schreiben.",
      schreibenHtml: "<h1>Antrag auf Berücksichtigung unterhaltsberechtigter Personen</h1><p>Sehr geehrte Damen und Herren,</p><p>ich, Demo Kundin, führe bei Ihnen ein Pfändungsschutzkonto. Ich beantrage, den pfändungsfreien Betrag nach § 902 Satz 1 Nr. 1 ZPO um die Beträge für eine unterhaltsberechtigte Person zu erhöhen.</p><p>Die Bescheinigung nach § 903 ZPO reiche ich nach.</p><p>Mit freundlichen Grüßen<br>Demo Kundin</p><p class='fuss'>Übermittelt durch FIAON LTD im Auftrag des Absenders. Aktenzeichen AZ 2026-000002</p>",
      dokumente: [{ id: 1, art: "antrag_pdf", dateiname: "Antrag_P-Konto.pdf", am: "28.08.2026" }, { id: 2, art: "vollmacht_pdf", dateiname: "Vollmacht.pdf", am: "28.08.2026" }],
      zeitleiste: [
        { art: "befund", am: "27.08.2026, 16:10", text: "Aus Ihrem Anspruchs-Check: höherer Schutzbetrag möglich." },
        { art: "vollmacht", am: "28.08.2026, 09:02", text: "Vollmacht zur Übermittlung unterschrieben." },
        { art: "entwurf", am: "28.08.2026, 09:02", text: "Antrag mit Ihren Angaben vorbereitet." },
        { art: "unterschrieben", am: "28.08.2026, 09:05", text: "Von Ihnen mit dem Finger unterschrieben." },
        { art: "versandt", am: "29.08.2026, 11:40", text: "Per Post an Ihre Bank versandt. Lena Winter hat den Versand bestätigt." },
      ],
    };
  }
  // Spec: feste Daten nur für id 2 und 3 — Vorgang 1 (Selbstauskunft) hat keine Detailansicht in der Demo.
  if (id !== 3) return null;
  // Keine Rechtsprüfung, keine eigene Erklärung von FIAON, keine Zusage ohne Datenbedingung: FIAON sortiert und bereitet vor, der Kunde erklärt.
  return {
    ...basis, artTitel: "Ihr Brief", empfaenger: null,
    hinweisFuerKunden: "Ein Inkassobüro darf mahnen. Wir lesen den Brief mit Ihnen, sortieren die Unterlagen und bereiten vor, was Sie beim Inkassobüro anfordern können – zum Beispiel die Forderungsaufstellung. Was daraus wird, steht hier mit Datum.",
    dokumente: [{ id: 3, art: "brief", dateiname: "Brief_2026-09-03.pdf", am: "03.09.2026" }],
    zeitleiste: [
      { art: "befund", am: "03.09.2026, 18:22", text: "Von Ihnen fotografiert." },
      { art: "notiz", am: "04.09.2026, 10:15", text: "Mahnung eines Inkassobüros über eine alte Handyrechnung. Wir haben ein Schreiben vorbereitet, mit dem Sie die Forderungsaufstellung anfordern – es wartet unter Vorgänge auf Ihre Unterschrift. Sobald die Aufstellung da ist, liegt sie hier in Ihrer Akte." },
    ],
  };
}

// ── Kamera-Fluss (wie Brief.tsx): Verkleinern auf 2.000 px, JPEG 0,85, mehrseitig ─
type Seite = { blob: Blob; url: string; name: string; istPdf: boolean };
async function verkleinern(datei: File): Promise<Seite> {
  if (datei.type === "application/pdf") return { blob: datei, url: "", name: datei.name, istPdf: true };
  const bild = await new Promise<HTMLImageElement>((ok, nein) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => nein(new Error("unlesbar")); i.src = URL.createObjectURL(datei); });
  const max = 2000; const f = Math.min(1, max / Math.max(bild.width, bild.height));
  const c = document.createElement("canvas"); c.width = Math.round(bild.width * f); c.height = Math.round(bild.height * f);
  c.getContext("2d")!.drawImage(bild, 0, 0, c.width, c.height);
  URL.revokeObjectURL(bild.src);
  const blob = await new Promise<Blob>((ok, nein) => c.toBlob((b) => (b ? ok(b) : nein(new Error("leer"))), "image/jpeg", 0.85));
  return { blob, url: URL.createObjectURL(blob), name: datei.name.replace(/\.[^.]+$/, "") + ".jpg", istPdf: false };
}
const MAX_SEITEN = 10;

// ═══════════════════════════════════════════════════════════════════════════
export function Vorgang({ kundeRef, basis, demo, id }: { kundeRef: string; basis: string; demo: boolean; id: number | string }) {
  const nr = Number(id);
  const [v, setV] = useState<VorgangDetail | null>(null);
  const [fehlt, setFehlt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [kopiert, setKopiert] = useState(false);
  const [blatt, setBlatt] = useState(false);
  const [meldung, setMeldung] = useState<{ ton: "gut" | "fehler"; text: string } | null>(null);

  // Antwort fotografieren
  const eingabe = useRef<HTMLInputElement>(null);
  const [seiten, setSeiten] = useState<Seite[]>([]);
  const [laeuft, setLaeuft] = useState(false);
  // Zurückziehen
  const [rueckfrage, setRueckfrage] = useState(false);

  const laden = () => {
    setFehler(null); setFehlt(false);
    if (demo) { const d = Number.isFinite(nr) ? demoVorgang(nr) : null; if (d) setV(d); else setFehlt(true); return; }
    if (!Number.isFinite(nr) || nr <= 0) { setFehlt(true); return; }
    api(`/kunde/${encodeURIComponent(kundeRef)}/app/vorgaenge/${nr}`).then((r) => {
      if (r.status === 404 || r.json?.grund === "keine_person") { setFehlt(true); return; }
      if (!r.ok || !r.json?.ok || !r.json.vorgang) { setFehler(r.json?.error || "Dieser Vorgang lässt sich gerade nicht öffnen."); return; }
      const x = r.json.vorgang;
      setV({
        id: Number(x.id), art: String(x.art ?? ""), artTitel: String(x.artTitel ?? artKlartext(x.art) ?? ""), titel: String(x.titel ?? ""), stand: String(x.stand ?? ""), standSatz: x.standSatz ?? null,
        aktenzeichen: x.aktenzeichen ?? null, empfaenger: x.empfaenger ? String(typeof x.empfaenger === "object" ? x.empfaenger.name ?? "" : x.empfaenger) : null,
        eingegangenAm: x.eingegangenAm ?? null, versandtAm: x.versandtAm ?? null, fristAm: x.fristAm ?? null, erinnertAm: x.erinnertAm ?? null, nachgefragtAm: x.nachgefragtAm ?? null,
        betragCents: typeof x.betragCents === "number" ? x.betragCents : null, monatlich: typeof x.monatlich === "boolean" ? x.monatlich : null,
        regel: x.regel ? { titel: String(x.regel.titel ?? ""), rechtsgrundlage: String(x.regel.rechtsgrundlage ?? ""), geprueftAm: x.regel.geprueftAm ?? null, stelle: String(x.regel.stelle ?? ""), wasWirTun: String(x.regel.wasWirTun ?? "") } : null,
        hinweisFuerKunden: x.hinweisFuerKunden ?? null, schreibenHtml: x.schreibenHtml ?? null, unterschriftUrl: x.unterschriftUrl ?? null,
        dokumente: Array.isArray(x.dokumente) ? x.dokumente.map((d: any) => ({ id: Number(d.id), art: String(d.art ?? ""), dateiname: String(d.dateiname ?? ""), am: d.am ?? null })) : [],
        zeitleiste: Array.isArray(x.zeitleiste) ? x.zeitleiste.map((z: any) => ({ art: String(z.art ?? ""), am: z.am ?? null, text: z.text ?? null })) : [],
      });
    }).catch(() => setFehler("Dieser Vorgang lässt sich gerade nicht öffnen."));
  };
  useEffect(() => { setV(null); setSeiten([]); setMeldung(null); setRueckfrage(false); setBlatt(false); laden(); }, [kundeRef, demo, nr]);

  const kopieren = async () => {
    if (!v?.aktenzeichen) return;
    try { await navigator.clipboard.writeText(v.aktenzeichen); setKopiert(true); window.setTimeout(() => setKopiert(false), 1800); }
    catch { setMeldung({ ton: "fehler", text: "Kopieren ist auf diesem Gerät nicht möglich – das Aktenzeichen steht oben zum Abschreiben." }); }
  };

  const aufnehmen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    if (seiten.length >= MAX_SEITEN) { setMeldung({ ton: "fehler", text: "Mehr Seiten gehen in einem Schritt nicht. Senden Sie diese ab und fotografieren Sie den Rest danach." }); return; }
    setMeldung(null);
    try { const s = await verkleinern(f); setSeiten([...seiten, s]); }
    catch { setMeldung({ ton: "fehler", text: "Diese Datei können wir nicht lesen. Ein Foto mit der Kamera klappt am besten." }); }
  };
  const seiteWeg = (i: number) => { const s = seiten[i]; if (s?.url) URL.revokeObjectURL(s.url); setSeiten(seiten.filter((_, k) => k !== i)); };

  const bescheidSenden = async () => {
    if (!v || !seiten.length) return;
    if (demo) { setMeldung({ ton: "gut", text: "In der Demo-Ansicht wird nichts gesendet. Bei echten Kunden liest Ihre Ansprechperson den Bescheid und trägt das Ergebnis hier ein." }); setSeiten([]); return; }
    setLaeuft(true); setMeldung(null);
    const fd = new FormData();
    seiten.forEach((s) => fd.append("bescheid", s.blob, s.name));
    try {
      const r = await fetch(`/api/fiaon/kunde/${encodeURIComponent(kundeRef)}/app/vorgaenge/${v.id}/bescheid`, { method: "POST", body: fd, credentials: "include" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setMeldung({ ton: "gut", text: j.text || "Danke. Ihr Bescheid liegt in der Akte." }); setSeiten([]); laden(); }
      else setMeldung({ ton: "fehler", text: j?.error || j?.text || "Der Bescheid konnte nicht gesendet werden. Ihre Fotos sind noch da – bitte tippen Sie noch einmal auf Absenden." });
    } catch { setMeldung({ ton: "fehler", text: "Ohne Verbindung geht der Bescheid nicht raus. Ihre Fotos bleiben hier, bis Sie wieder online sind." }); }
    setLaeuft(false);
  };

  const zurueckziehen = async () => {
    if (!v) return;
    if (demo) { setRueckfrage(false); setMeldung({ ton: "gut", text: "In der Demo-Ansicht wird nichts geändert." }); return; }
    setLaeuft(true); setMeldung(null);
    const r = await api(`/kunde/${encodeURIComponent(kundeRef)}/app/vorgaenge/${v.id}/zurueckziehen`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    setLaeuft(false); setRueckfrage(false);
    if (r.ok && r.json?.ok !== false) { setMeldung({ ton: "gut", text: r.json?.text || "Zurückgezogen. Der Punkt steht wieder offen in Ihrer Liste – Sie können ihn später neu vorbereiten." }); laden(); }
    else setMeldung({ ton: "fehler", text: r.json?.error || "Das Zurückziehen hat gerade nicht geklappt. Der Antrag ist unverändert." });
  };

  // ── Zustände ohne Vorgang ────────────────────────────────────────────────
  if (fehlt) {
    return (
      <>
        <Link href={`${basis}/vorgaenge`} className="ap-textknopf ap-auf">← Zurück</Link>
        <div className="ap-karte ap-leer ap-auf v1"><b>Diesen Vorgang gibt es in Ihrer Akte nicht.</b>Vielleicht ist der Link alt – Ihre Vorgänge finden Sie in der Übersicht.<Link href={`${basis}/vorgaenge`} className="ap-knopf still" style={{ marginTop: 14 }}>Zu meinen Vorgängen</Link></div>
      </>
    );
  }
  if (fehler) {
    return (
      <>
        <Link href={`${basis}/vorgaenge`} className="ap-textknopf ap-auf">← Zurück</Link>
        <div className="ap-karte ap-leer ap-auf v1"><b>{fehler}</b><button type="button" className="ap-knopf still" style={{ marginTop: 12 }} onClick={laden}>Noch einmal</button></div>
      </>
    );
  }
  if (!v) {
    return (
      <>
        <div className="ap-skelett" style={{ height: 30, width: "60%" }} />
        <div className="ap-skelett" style={{ height: 22, width: "80%" }} />
        <div className="ap-skelett" style={{ height: 120, borderRadius: 14 }} />
        <div className="ap-skelett" style={{ height: 220, borderRadius: 14 }} />
      </>
    );
  }

  // ── Der Vorgang ──────────────────────────────────────────────────────────
  const istBrief = v.art === "brief";
  const standSatz = v.standSatz || standSatzRueckfall(v);
  const notizen = v.zeitleiste.filter((z) => z.art === "notiz" && z.text);
  const wartetAufAntwort = v.stand === "versandt" || v.stand === "nachfrage";
  const vorVersand = VOR_VERSAND.indexOf(v.stand) !== -1;
  const fristzeile = v.stand === "versandt" && v.fristAm ? `Antwort erwartet bis ${v.fristAm}.`
    : v.stand === "nachfrage" ? `Frist${v.fristAm ? ` ${v.fristAm}` : ""} verstrichen${v.nachgefragtAm ? ` – nachgefragt am ${v.nachgefragtAm}` : v.erinnertAm ? ` – Nachfrage beauftragt am ${v.erinnertAm}` : ""}.`
    : v.stand === "eingegangen" && v.fristAm ? `Bis zum ${v.fristAm} steht hier, was wir daraus gemacht haben.`
    : v.stand === "versandbereit" ? "Der Versand wird hier bestätigt – mit Datum." : null;
  const stationenListe = stationen(v);

  return (
    <>
      <input ref={eingabe} type="file" accept="image/*,application/pdf" capture="environment" hidden onChange={aufnehmen} />

      <Link href={`${basis}/vorgaenge`} className="ap-textknopf ap-auf" style={{ minHeight: 40 }}>← Zurück</Link>
      <h1 className="ap-gruss ap-auf" style={{ marginTop: 0 }}>
        {v.artTitel || artKlartext(v.art)}
        <small>
          {v.empfaenger ? <>An {v.empfaenger}. </> : istBrief && v.eingegangenAm ? <>Von Ihnen fotografiert am {v.eingegangenAm}. </> : null}
          {v.titel && v.titel !== v.artTitel ? v.titel : null}
        </small>
      </h1>
      {v.aktenzeichen && (
        <div className="ap-az ap-auf">
          <span className="ap-mono" style={{ fontSize: 14 }}>{v.aktenzeichen}</span>
          <button type="button" className={`ap-kopie${kopiert ? " fertig" : ""}`} onClick={kopieren} aria-live="polite">{kopiert ? "Kopiert" : "Kopieren"}</button>
        </div>
      )}

      {/* Standkarte */}
      <div className={`ap-karte ap-stand ${kanteFuer(v.stand)} ap-auf v1`}>
        <p className="ap-stand-satz">{standSatz}</p>
        {fristzeile && <p className="ap-stand-frist">{fristzeile}</p>}
        {v.stand === "unterschrift_offen" && v.unterschriftUrl && <a className="ap-knopf" style={{ marginTop: 14 }} href={v.unterschriftUrl}>Jetzt unterschreiben</a>}
        {v.stand === "unterschrift_offen" && !v.unterschriftUrl && !demo && <p className="ap-fuss">Der Unterschriftlink wird gerade erneuert. Öffnen Sie diese Seite in einem Moment noch einmal.</p>}
      </div>

      {/* Betrag und Grundlage (Anspruchs-Vorgang) */}
      {!istBrief && (v.betragCents !== null || v.regel) && (
        <div className="ap-karte ap-auf v1">
          {v.betragCents !== null ? (
            <div className="ap-befund-betrag">{eur(v.betragCents)}<small>{v.monatlich === false ? "einmalig" : "im Monat"}</small></div>
          ) : (
            <div className="ap-befund-betrag"><span className="ap-befund-offen">Über den Betrag entscheidet die Stelle.</span></div>
          )}
          {v.regel && (
            <dl className="ap-liste">
              <dt>Entscheidet</dt><dd>{v.regel.stelle}</dd>
              <dt>Grundlage</dt><dd>{v.regel.rechtsgrundlage}{v.regel.geprueftAm ? ` · Stand ${v.regel.geprueftAm}` : ""}</dd>
            </dl>
          )}
        </div>
      )}

      {/* Antwort fotografieren — die eine Handlung, wenn der Antrag unterwegs ist */}
      {wartetAufAntwort && (
        <div className="ap-karte ap-auf v2">
          <h3>Antwort bekommen?</h3>
          <p>Der Bescheid kommt per Post zu Ihnen. Fotografieren Sie ihn – Ihre Ansprechperson liest ihn und trägt das Ergebnis hier ein.</p>
          {seiten.length > 0 && (
            <div className="ap-seiten">
              {seiten.map((s, i) => (
                <button key={s.name + i} type="button" className="ap-seite" onClick={() => seiteWeg(i)} aria-label={`Seite ${i + 1} entfernen`} title="Antippen zum Entfernen">
                  {s.istPdf ? <span>{s.name}</span> : <img src={s.url} alt={`Seite ${i + 1}`} />}
                  <span className="ap-seite-nr">{i + 1}</span>
                </button>
              ))}
            </div>
          )}
          {seiten.length === 0 ? (
            <button type="button" className="ap-knopf" style={{ marginTop: 14 }} onClick={() => eingabe.current?.click()}>Antwort fotografieren</button>
          ) : (
            <>
              <div className="ap-knopf-reihe">
                <button type="button" className="ap-knopf still" onClick={() => eingabe.current?.click()} disabled={laeuft || seiten.length >= MAX_SEITEN}>Noch eine Seite</button>
                <button type="button" className="ap-knopf" onClick={bescheidSenden} disabled={laeuft}>{laeuft ? "Wird gesendet …" : seiten.length === 1 ? "Absenden" : `${seiten.length} Seiten absenden`}</button>
              </div>
              <p className="ap-fuss">Antippen einer Seite entfernt sie. Name, Datum und Absender sollten lesbar sein.</p>
            </>
          )}
          {meldung && <div className={`ap-meldung ${meldung.ton}`} role="status">{meldung.text}</div>}
        </div>
      )}

      {/* Brief: Das haben wir daraus gemacht */}
      {(istBrief || notizen.length > 0) && (
        <section className="ap-abschnitt ap-auf v2">
          <h2 className="ap-abschnitt-titel">Das haben wir daraus gemacht</h2>
          <div className="ap-karte">
            {notizen.length === 0 && <p style={{ margin: 0 }}>Noch nichts eingetragen. Sobald {istBrief ? "der Brief zugeordnet ist" : "es etwas zu sagen gibt"}, steht es hier – mit Datum.</p>}
            {notizen.map((n, i) => (
              <div key={i} style={{ borderTop: i ? "1px solid var(--fi-linie)" : 0, paddingTop: i ? 12 : 0, marginTop: i ? 12 : 0 }}>
                <p style={{ margin: 0, color: "var(--fi-text)" }}>{n.text}</p>
                {n.am && <p className="ap-fuss" style={{ marginTop: 4 }}>{n.am}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Zeitleiste */}
      <section className="ap-abschnitt ap-auf v2">
        <h2 className="ap-abschnitt-titel">Verlauf</h2>
        <div className="ap-karte" style={{ padding: "14px 16px" }}>
          <ol className="ap-zeitleiste">
            {stationenListe.map((s) => (
              <li key={s.key} className={`ap-zeit ${s.lage}`}>
                <span className="ap-zeit-punkt" aria-hidden="true">{s.lage === "fertig" ? "✓" : null}</span>
                <div>
                  <b>{s.titel}</b>
                  {s.am && <span className="ap-zeit-datum">{s.am}</span>}
                  {s.text && <small>{s.text}</small>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Ihr Schreiben */}
      {(v.schreibenHtml || v.dokumente.length > 0) && (
        <section className="ap-abschnitt ap-auf v3">
          <h2 className="ap-abschnitt-titel">{istBrief ? "Ihre Unterlagen" : "Ihr Schreiben"}</h2>
          <div className="ap-karte">
            {v.schreibenHtml && (
              <>
                <p style={{ margin: 0 }}>{vorVersand && v.stand !== "versandbereit"
                  ? `Der Wortlaut Ihres Schreibens${v.empfaenger ? ` – gerichtet an ${v.empfaenger}` : ""}. Unterschrieben wird über den Knopf oben.`
                  : `Der Wortlaut, den Sie unterschrieben haben${v.empfaenger ? ` – gerichtet an ${v.empfaenger}` : ""}.`}</p>
                <button type="button" className="ap-knopf still" style={{ marginTop: 12 }} onClick={() => setBlatt(!blatt)} aria-expanded={blatt}>{blatt ? "Schreiben schließen" : "Schreiben lesen"}</button>
                {blatt && <article className="ap-dokument" style={{ marginTop: 12, boxShadow: "none" }} dangerouslySetInnerHTML={{ __html: v.schreibenHtml }} />}
              </>
            )}
            {v.dokumente.length > 0 && (
              <dl className="ap-liste" style={{ marginTop: v.schreibenHtml ? 14 : 0 }}>
                {v.dokumente.map((d) => (
                  <Fragment key={d.id}>
                    <dt>{d.am ?? "Dokument"}</dt>
                    <dd>{demo ? d.dateiname : <a className="ap-link" href={`/api/fiaon/kunde/${encodeURIComponent(kundeRef)}/app/dokument/${d.id}`} target="_blank" rel="noopener noreferrer">{d.dateiname}</a>}</dd>
                  </Fragment>
                ))}
              </dl>
            )}
          </div>
        </section>
      )}

      {/* Was das für Sie heißt */}
      {(v.hinweisFuerKunden || v.regel?.wasWirTun) && (
        <section className="ap-abschnitt ap-auf v3">
          <h2 className="ap-abschnitt-titel">Was das für Sie heißt</h2>
          <div className="ap-karte">
            {v.hinweisFuerKunden && <p style={{ margin: 0, color: "var(--fi-text)" }}>{v.hinweisFuerKunden}</p>}
            {v.regel?.wasWirTun && <p style={{ marginTop: v.hinweisFuerKunden ? 10 : 0 }}>{v.regel.wasWirTun}</p>}
          </div>
        </section>
      )}

      {!wartetAufAntwort && meldung && <div className={`ap-meldung ${meldung.ton} ap-auf`} role="status">{meldung.text}</div>}

      {/* Textlinks */}
      <div className="ap-auf v4" style={{ display: "grid", gap: 4 }}>
        <Link href={`${basis}/mehr/hilfe?vorgang=${encodeURIComponent(v.aktenzeichen ?? String(v.id))}`} className="ap-textknopf">Frage zu diesem Vorgang</Link>
        {!istBrief && vorVersand && !rueckfrage && <button type="button" className="ap-textknopf still" onClick={() => { setRueckfrage(true); setMeldung(null); }}>Antrag zurückziehen</button>}
        {rueckfrage && (
          <div className="ap-rueckfrage" role="group" aria-label="Zurückziehen bestätigen">
            <p>Möchten Sie den Antrag zurückziehen? Er wird dann nicht versendet. Der Punkt bleibt in Ihrer Liste, Sie können ihn später neu vorbereiten.</p>
            <div className="ap-knopf-reihe" style={{ marginTop: 0 }}>
              <button type="button" className="ap-knopf still" onClick={zurueckziehen} disabled={laeuft}>{laeuft ? "Wird gespeichert …" : "Ja, zurückziehen"}</button>
              <button type="button" className="ap-knopf" onClick={() => setRueckfrage(false)} disabled={laeuft}>Behalten</button>
            </div>
          </div>
        )}
      </div>
      {demo && <p className="ap-fuss">Demo-Ansicht – feste Vorführdaten.</p>}
    </>
  );
}
