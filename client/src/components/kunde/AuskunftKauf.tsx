// ═══════════════════════════════════════════════════════════════════════════
// DIE KAUFKARTE FÜR DIE BONITÄTSAUSKUNFT (24.09.2026, E-240)
//
// Justin: Die Auskunft soll „weggehen wie warme Semmeln". Der Einbruch hatte
// einen einfachen Grund: Am 22.08. fielen mit dem alten Dashboard die
// Kaufknöpfe weg (97 von 146 Bestellungen kamen darüber), und der neue Bereich
// zeigte nur noch „74 € einmalig" als Satz. Diese Datei ist die EINE Karte für
// alle Stellen im Kundenbereich: /mein-bereich (Abschnitt „Ihre Bonität"),
// die Einrichtung vor dem Startgespräch, der Startgesprächs-Vorhang und die
// Unterlagen in /app. Muster: die Karte „Der Grundstein" aus
// StartgespraechGate.tsx — nur gesiezt, mit dem Preis vom Server und mit einem
// Auftrag, der rechtlich trägt.
//
// ── WAS DIE KARTE NICHT SELBST ENTSCHEIDET ─────────────────────────────────
// Stufe, Preis (74 € mit laufendem Paket, sonst 149 €), Leistung und
// Auskunfteien kommen fertig vom Server (Kauf-Block in fiaon-kunde-bereich.ts,
// Quelle shared/fiaon-auskunft.ts). Österreicher lesen deshalb nie „SCHUFA".
//
// ── ZWEI SCHRITTE, WEIL DAS GESETZ ES SO WILL ──────────────────────────────
// „Auskunft jetzt beauftragen" öffnet die Bestätigung: Preis, Vertragspartner,
// Zahlweg, AGB, Widerrufsbelehrung und — freiwillig, nie vorangekreuzt — der
// Wunsch, vor Ablauf der Widerrufsfrist zu beginnen (§ 356 Abs. 4 BGB, Muster
// business-start.tsx). Erst der zweite Knopf bestellt, und er heißt, was er
// tut: „Zahlungspflichtig beauftragen" (§ 312j Abs. 3 BGB). Ein Knopf, der
// nur „beauftragen" sagt, ließe den Vertrag nach § 312j Abs. 4 gar nicht
// zustande kommen — und die Rechnung wäre ohne Grundlage.
//
// ── DER BESCHAFFUNGSAUFTRAG (25.09.2026, E-241) ─────────────────────────────
// Bis die API steht, kaufen wir die Auskunft selbst ein — die Vollmacht zur
// Übermittlung deckt das nicht. Der Auftrag trägt deshalb einen Pflicht-Haken
// mit dem Wortlaut vom Server (`auftragText`, AUSKUNFT_BESCHAFFUNGSAUFTRAG_TEXT);
// ohne ihn geht nichts an den Server, und der Server legt ohne `auftrag: true`
// nichts an. Stufe B (Paket bestellt, nicht bezahlt) sieht die Karte seit
// E-241 auch — mit dem Einzelpreis und dem Satz zum Kundenpreis (`paketPreisSatz`).
//
// ── DIE KOSTENLOSE DATENKOPIE ──────────────────────────────────────────────
// Wird hier nicht beworben und nicht verschwiegen: Wer schon eine aktuelle
// Auskunft hat, lädt sie als zweiten, kleinen Weg hoch. Wer fragt, bekommt
// von Mara und Betreuer die ehrliche Antwort (AUSKUNFT_KOSTENLOS_ANTWORT).
// ═══════════════════════════════════════════════════════════════════════════
import { useState, type CSSProperties } from "react";
import { AUSKUNFT_WIDERRUF } from "@shared/fiaon-auskunft-widerruf";
import {
  AUSKUNFT_BESCHAFFUNGSAUFTRAG_TEXT, AUSWERTUNG_KEINE_AUSKUNFT_SATZ, AUSWERTUNG_SCHRITTE, AUSWERTUNG_UNTERLAGEN_SATZ,
  type AuswertungKundenStand,
} from "@shared/fiaon-auskunft";

// ═══════════════════════════════════════════════════════════════════════════
// E-365 (14.10.2026): Privat verkauft diese Karte die FIAON-Bonitätsauswertung (E-353) — Bericht aus Ausweis und
// Kontoauszug, keine Datenkopie. Nach dem Kauf zeigt sie den Stand der Auswertung (Unterlagen hochladen → wird
// entwickelt → liegt vor) statt „wir fordern Ihre Datenkopien an“. Im Paket enthalten (Kartenlink wartet): kein
// Kauf, nur der Stand. Firmen-Auskünfte behalten ihre Sätze.
// ═══════════════════════════════════════════════════════════════════════════

/** Spiegel von `AuskunftKauf` in server/routes/fiaon-kunde-bereich.ts. */
export interface AuskunftKauf {
  stufe: "bezahlt" | "auswertung" | "inklusive" | "offen" | "dokument" | "nichts";
  darfKaufen: boolean;
  sperre: "paket_offen" | "gekuendigt" | null;
  /** false = Werbesperre: keine Hinweise außerhalb des Auskunft-Abschnitts. */
  werbung: boolean;
  preisCents: number;
  preisText: string;
  mitAbo: boolean;
  land: "DE" | "AT" | "CH";
  wort: string;
  bei: string;
  leistung: string[];
  nutzen: string;
  offen: { zahlungsseite: string | null; betragText: string; gemeldet: boolean } | null;
  /** E-241: privat oder für die Firma (Server: auskunftArtFuer). Ältere Antworten ohne Feld: privat. */
  art?: "privat" | "firma";
  /** E-241: der Wortlaut des Beschaffungsauftrags — Pflicht-Haken im Auftrag. */
  auftragText?: string;
  /** E-241: Stufe B — der Kundenpreis mit aktivem Paket als ganzer Satz, sonst null. */
  paketPreisSatz?: string | null;
  /** E-365: der Stand der Bonitätsauswertung (bezahlt, inklusive oder geliefert) — sonst null. */
  auswertung?: { stand: AuswertungKundenStand; fehlt: ("ausweis" | "kontoauszug")[]; abText: string | null; nummer: string | null; inklusive: boolean; gelesen?: boolean } | null;
}

/** „Ihren Ausweis und Ihre Kontoauszüge“ — was für den Start noch fehlt. */
export function fehltText(fehlt: ("ausweis" | "kontoauszug")[] | undefined): string {
  const t = (fehlt ?? []).map((f) => (f === "ausweis" ? "Ihren Ausweis" : "Ihre Kontoauszüge der letzten drei Monate"));
  return t.length ? t.join(" und ") : "Ihren Ausweis und Ihre Kontoauszüge";
}


/**
 * Gegenlesen 24.09.2026 (E-240): Der Auftrag nennt den Preis als Endpreis —
 * wortgleich mit AGB § 5 Abs. 1 (agb.tsx) und der Bestellseite
 * (i18n/bonitaet-antrag.ts, PREIS_STEUER). Bewusst als eigene Konstante,
 * damit die Karte nicht an einer Seite hängt, die ein anderer Zweig baut.
 */
const PREIS_STEUER = "Endpreis einschließlich einer etwaig anfallenden Umsatzsteuer";

/** Der Satz, den der Kunde ankreuzen KANN — wortgleich mit dem Global-Auftrag (i18n/global-start.ts). */
export const SOFORT_BEGINN_SATZ =
  "Ich verlange ausdrücklich, dass FIAON vor Ablauf der Widerrufsfrist mit der Arbeit beginnt. Mir ist bekannt, "
  + "dass ich bei einem Widerruf die bis dahin erbrachten Leistungen anteilig bezahle und dass mein Widerrufsrecht "
  + "erlischt, wenn FIAON den Vertrag vollständig erfüllt hat.";

/**
 * Die Bestellung — POST /api/fiaon/kunde/auskunft/bestellen. Die Referenz
 * kommt aus dem Kunden-Cookie; ein Preis wird nicht mitgeschickt, weil der
 * Server ihn entscheidet. E-241: `auftrag` = der Pflicht-Haken des
 * Beschaffungsauftrags (ohne ihn legt der Server nichts an).
 */
export async function auskunftBeauftragen(sofortBeginn: boolean, auftrag: boolean): Promise<{ ok: boolean; ziel: string | null; meldung: string | null }> {
  try {
    const r = await fetch("/api/fiaon/kunde/auskunft/bestellen", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sofortBeginn, auftrag }),
    });
    const j = await r.json().catch(() => null);
    if (r.ok && j?.ok) return { ok: true, ziel: j.zahlungsseite ?? null, meldung: j.meldung ?? null };
    return { ok: false, ziel: null, meldung: j?.error || "Das hat nicht geklappt. Bitte versuchen Sie es erneut." };
  } catch {
    return { ok: false, ziel: null, meldung: "Keine Verbindung. Bitte prüfen Sie Ihr Internet und versuchen Sie es erneut." };
  }
}

type Variante = "mb" | "ap";
/** Die zwei Kundenbereiche haben eigene Knöpfe und Farben — die Karte fügt sich in beide. */
const stil = (v: Variante) => ({
  knopf: v === "mb" ? "mb-knopf" : "ap-knopf",
  still: v === "mb" ? "mb-knopf still" : "ap-knopf still",
  text: v === "mb" ? "var(--text)" : "var(--fi-text)",
  leise: v === "mb" ? "var(--text-leise)" : "var(--fi-text-leise)",
  still2: v === "mb" ? "var(--text-still)" : "var(--fi-text-still)",
  linie: v === "mb" ? "var(--linie)" : "var(--fi-linie)",
  akzent: v === "mb" ? "var(--blau-tief)" : "var(--fi-primaer)",
});
// Im Vorhang blendet mein-bereich.css jeden .mb-knopf erst nach 1,6 s ein und
// setzt 26 px Abstand darüber. Für Knöpfe, die erst nach einem Klick erscheinen,
// wäre das eine Pause ohne Grund — sie stehen sofort da.
const KNOPF_SOFORT: CSSProperties = { animation: "none", opacity: 1, marginTop: 0 };

function Leistungsliste({ kauf, v }: { kauf: AuskunftKauf; v: Variante }) {
  const s = stil(v);
  return (
    <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 7 }}>
      {kauf.leistung.map((z) => (
        <li key={z} style={{ display: "grid", gridTemplateColumns: "14px 1fr", gap: 8, fontSize: v === "mb" ? 13.5 : 15, lineHeight: 1.5, color: s.leise }}>
          <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 99, background: s.akzent, marginTop: 8 }} />
          <span>{z}</span>
        </li>
      ))}
    </ul>
  );
}

/** Schritt 2: der Auftrag. Erst hier wird bestellt. */
function Auftrag({ kauf, v, demo, onZurueck }: { kauf: AuskunftKauf; v: Variante; demo?: boolean; onZurueck: () => void }) {
  const s = stil(v);
  const [sofort, setSofort] = useState(false);
  const [auftrag, setAuftrag] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ ton: "gut" | "fehler"; text: string } | null>(null);
  const firma = kauf.art === "firma";
  const bestellen = async () => {
    // E-241: ohne den Beschaffungsauftrag keine Bestellung — auch nicht in der Demo.
    if (!auftrag) {
      setMeldung({ ton: "fehler", text: firma ? "Bitte bestätigen Sie den Auftrag, damit wir Ihre Auskunft für Sie beschaffen dürfen." : "Bitte bestätigen Sie den Auftrag für Ihre Bonitätsauswertung." });
      return;
    }
    if (demo) {
      setMeldung({ ton: "gut", text: "In der Demo wird nichts beauftragt. Im echten Bereich öffnet sich jetzt die Zahlungsseite mit Betrag, Empfänger und Verwendungszweck." });
      return;
    }
    setLaeuft(true); setMeldung(null);
    const r = await auskunftBeauftragen(sofort, auftrag);
    if (r.ok && r.ziel) { window.location.href = r.ziel; return; }
    setLaeuft(false);
    if (r.ok) { setMeldung({ ton: "gut", text: r.meldung || "Ihre Bestellung ist angelegt." }); setTimeout(() => window.location.reload(), 2200); }
    else setMeldung({ ton: "fehler", text: r.meldung || "Das hat nicht geklappt." });
  };
  return (
    <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
      <div style={{ padding: "12px 14px", borderRadius: 12, border: `1px solid ${s.linie}`, background: v === "mb" ? "var(--flaeche-still)" : "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
          <b style={{ color: s.text, fontWeight: 650 }}>{firma ? "Firmen-Bonitätsauskunft inkl. Handlungsplan" : "FIAON-Bonitätsauswertung"}</b>
          <b style={{ color: s.text, fontWeight: 650, whiteSpace: "nowrap" }}>{kauf.preisText} einmalig</b>
        </div>
        <p style={{ margin: "6px 0 0", fontSize: 12.5, lineHeight: 1.55, color: s.leise }}>
          {firma
            ? <>Datenkopien bei {kauf.bei}, Erklärung jedes Eintrags, Fristenprüfung, Handlungsplan und fertige Schreiben zur Freigabe.</>
            : <>Ihr Bericht aus Ausweis und Kontoauszügen: Bonität aus Sicht einer Bank, jede Ausgabe im Detail, Ampel, Finanzwert und Plan — als PDF. Nach der Bestellung laden Sie die Unterlagen hoch (Link per E-Mail, ohne Anmeldung).</>}
          {kauf.mitAbo ? " Ihr Preis als FIAON-Kunde mit Paket." : ""} {PREIS_STEUER}. Kein Abo. Ihr Vertragspartner ist die FIAON LTD.
          Bezahlt wird per Überweisung — Betrag, Empfänger und Verwendungszweck stehen auf der nächsten Seite.
        </p>
      </div>
      {/* E-241: der Beschaffungsauftrag — Pflicht, nie vorangekreuzt. */}
      <label style={{ display: "grid", gridTemplateColumns: "20px 1fr", gap: 10, alignItems: "start", fontSize: 12.5, lineHeight: 1.55, color: s.text, cursor: "pointer" }}>
        <input type="checkbox" required checked={auftrag} onChange={(e) => { setAuftrag(e.target.checked); if (e.target.checked) setMeldung(null); }} style={{ width: 18, height: 18, marginTop: 2 }} />
        {/* Rückfall aus derselben Quelle, falls ein Server mit älterem Stand keinen Wortlaut schickt. */}
        <span>{kauf.auftragText || AUSKUNFT_BESCHAFFUNGSAUFTRAG_TEXT(firma ? "firma" : "privat")}</span>
      </label>
      <label style={{ display: "grid", gridTemplateColumns: "20px 1fr", gap: 10, alignItems: "start", fontSize: 12.5, lineHeight: 1.55, color: s.leise, cursor: "pointer" }}>
        <input type="checkbox" checked={sofort} onChange={(e) => setSofort(e.target.checked)} style={{ width: 18, height: 18, marginTop: 2 }} />
        <span>{SOFORT_BEGINN_SATZ}</span>
      </label>
      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: s.still2 }}>
        Ohne diesen Haken beginnen wir nach Ablauf der Widerrufsfrist. Es gelten unsere{" "}
        <a href="/agb" target="_blank" rel="noopener noreferrer" style={{ color: s.akzent, textDecoration: "underline", textUnderlineOffset: 3 }}>AGB</a>; über Ihr Widerrufsrecht informiert die Widerrufsbelehrung unten.
      </p>
      {/* 25.09.2026 (E-240): Die Belehrung DIESES Vertrags (Dienstleistung, einmalig) —
          /widerrufsbelehrung ist die Fassung für Abo und digitale Inhalte und passt hier nicht. */}
      <details style={{ fontSize: 12, lineHeight: 1.55, color: s.leise }}>
        <summary style={{ cursor: "pointer", color: s.akzent }}>{AUSKUNFT_WIDERRUF.titel} anzeigen</summary>
        <p style={{ margin: "8px 0 0" }}>{AUSKUNFT_WIDERRUF.gilt}</p>
        {AUSKUNFT_WIDERRUF.abschnitte.map((a) => (
          <div key={a.h}>
            <p style={{ margin: "8px 0 2px", fontWeight: 600, color: s.text }}>{a.h}</p>
            {a.absaetze.map((t, i) => <p key={i} style={{ margin: "0 0 6px" }}>{t}</p>)}
          </div>
        ))}
        <p style={{ margin: "8px 0 2px", fontWeight: 600, color: s.text }}>{AUSKUNFT_WIDERRUF.erloeschen.h}</p>
        <p style={{ margin: "0 0 6px" }}>{AUSKUNFT_WIDERRUF.erloeschen.text}</p>
        <p style={{ margin: "8px 0 2px", fontWeight: 600, color: s.text }}>{AUSKUNFT_WIDERRUF.formular.titel}</p>
        <p style={{ margin: "0 0 4px" }}>{AUSKUNFT_WIDERRUF.formular.hinweis}</p>
        <p style={{ margin: "0 0 4px" }}>{AUSKUNFT_WIDERRUF.formular.an}</p>
        {AUSKUNFT_WIDERRUF.formular.zeilen.map((z) => <p key={z} style={{ margin: "0 0 2px" }}>— {z}</p>)}
        <p style={{ margin: "4px 0 0" }}>{AUSKUNFT_WIDERRUF.formular.fuss}</p>
      </details>
      {meldung && (
        <p role="status" style={{ margin: 0, padding: "10px 12px", borderRadius: 10, fontSize: 13, lineHeight: 1.5,
          background: meldung.ton === "gut" ? "rgba(5,150,105,.08)" : "rgba(220,38,38,.08)", color: meldung.ton === "gut" ? "#047857" : "#b91c1c" }}>
          {meldung.text}
        </p>
      )}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" className={s.knopf} style={KNOPF_SOFORT} disabled={laeuft} onClick={() => void bestellen()}>
          {/* Am Handy (/app) bricht „· 74 €" um — dort steht der Preis direkt darüber im Auftrag. */}
          {laeuft ? "Einen Moment …" : v === "ap" ? "Zahlungspflichtig beauftragen" : `Zahlungspflichtig beauftragen · ${kauf.preisText}`}
        </button>
        <button type="button" className={s.still} style={{ ...KNOPF_SOFORT, ...(v === "ap" ? { width: "auto" } : {}) }} disabled={laeuft} onClick={onZurueck}>Zurück</button>
      </div>
    </div>
  );
}

/** E-365: die vier Schritte der Bonitätsauswertung (Bestellen · Hochladen · Wir entwickeln · Sie erhalten) als ruhige Zeile. */
function Schritte({ v }: { v: Variante }) {
  const s = stil(v);
  return (
    <ol style={{ margin: "14px 0 0", padding: 0, listStyle: "none", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 8 }} data-fiaon="auswertung-schritte">
      {AUSWERTUNG_SCHRITTE.map((x, i) => (
        <li key={x.titel} style={{ padding: "10px 12px", borderRadius: 12, border: `1px solid ${s.linie}`, background: v === "mb" ? "var(--flaeche-still)" : "rgba(40,141,250,.04)" }}>
          <span style={{ display: "block", font: "600 10.5px/1 'Inter',sans-serif", letterSpacing: ".12em", color: s.akzent }}>{String(i + 1).padStart(2, "0")}</span>
          <b style={{ display: "block", marginTop: 6, fontSize: 13.5, fontWeight: 600, color: s.text }}>{x.titel}</b>
          <span style={{ display: "block", marginTop: 3, fontSize: 12, lineHeight: 1.45, color: s.leise }}>{x.text}</span>
        </li>
      ))}
    </ol>
  );
}

/** E-365: der Stand nach dem Kauf als Leiste — Unterlagen · Entwicklung · Liegt vor. */
function Fortschritt({ stand, v }: { stand: AuswertungKundenStand; v: Variante }) {
  const s = stil(v);
  const stufen: { t: string; an: boolean; jetzt: boolean }[] = [
    { t: "Unterlagen", an: stand !== "unterlagen_fehlen", jetzt: stand === "unterlagen_fehlen" },
    { t: "Wird entwickelt", an: stand === "liegt_vor", jetzt: stand === "wird_entwickelt" || stand === "beginnt_ab" },
    { t: "Liegt vor", an: stand === "liegt_vor", jetzt: false },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, margin: "10px 0 2px" }} data-fiaon="auswertung-fortschritt" aria-label="Stand Ihrer Bonitätsauswertung">
      {stufen.map((x) => (
        <div key={x.t}>
          <div style={{ height: 4, borderRadius: 99, background: x.an ? s.akzent : x.jetzt ? `color-mix(in srgb, ${s.akzent} 45%, transparent)` : s.linie }} />
          <span style={{ display: "block", marginTop: 6, fontSize: 11.5, fontWeight: x.jetzt ? 600 : 500, color: x.an || x.jetzt ? s.text : s.still2 }}>{x.t}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Die Karte in allen Zuständen: bestellt (Zahlung offen / gemeldet), bezahlt,
 * oder kaufbar. Bei „dokument" und bei einer Sperre zeichnet sie nichts — dort
 * spricht der Abschnitt drumherum.
 *
 * `kompakt`: für Einrichtung und Vorhang — erst eine Zeile mit Preis, auf
 * Klick Leistung und Auftrag. `hochladen`: Ziel des kleinen Upload-Wegs.
 */
export function AuskunftKaufkarte({ kauf, variante = "mb", demo, kompakt, hochladen }: {
  kauf: AuskunftKauf; variante?: Variante; demo?: boolean; kompakt?: boolean; hochladen?: string | null;
}) {
  const s = stil(variante);
  const [schritt, setSchritt] = useState<"karte" | "auftrag">("karte");
  const ueber: CSSProperties = { margin: 0, font: "600 10.5px/1 'Inter',sans-serif", letterSpacing: ".16em", textTransform: "uppercase", color: s.akzent };
  const titel: CSSProperties = { margin: "6px 0 0", fontSize: variante === "mb" ? 16 : 17, fontWeight: variante === "mb" ? 700 : 500, color: s.text, lineHeight: 1.35 };
  const satz: CSSProperties = { margin: "8px 0 0", fontSize: variante === "mb" ? 13.5 : 15, lineHeight: 1.55, color: s.leise, maxWidth: "60ch" };

  const firma = kauf.art === "firma";
  const name = firma ? "Ihre Bonitätsauskunft" : "Ihre FIAON-Bonitätsauswertung";
  const zuAuswertung = "/app/auswertung";
  const knopfStil: CSSProperties = { ...KNOPF_SOFORT, marginTop: 14, ...(variante === "ap" ? {} : { display: "inline-block" }) };

  if (kauf.stufe === "offen") {
    const o = kauf.offen;
    return (
      <div>
        <p style={ueber}>{name}</p>
        <h4 style={titel}>{o?.gemeldet ? "Ihre Zahlung ist gemeldet" : firma ? "Ihre Auskunft ist bestellt — Zahlung offen" : "Ihre Bonitätsauswertung ist bestellt — Zahlung offen"}</h4>
        <p style={satz}>
          {firma
            ? (o?.gemeldet
              ? `Sobald Ihre Überweisung bei uns gebucht ist, fordern wir Ihre Datenkopien bei ${kauf.bei} an.`
              : `Sobald Ihre Überweisung${o ? ` über ${o.betragText}` : ""} da ist, fordern wir Ihre Datenkopien bei ${kauf.bei} an.`)
            : (o?.gemeldet
              ? "Sobald Ihre Überweisung bei uns gebucht ist, bekommen Sie den Link zum Hochladen von Ausweis und Kontoauszügen."
              : `Sobald Ihre Überweisung${o ? ` über ${o.betragText}` : ""} da ist, laden Sie Ausweis und Kontoauszüge hoch — dann entwickelt Ihr FIAON-Team Ihre Bonitätsauswertung.`)}
        </p>
        {o?.zahlungsseite
          ? <a className={o.gemeldet ? s.still : s.knopf} href={demo ? undefined : o.zahlungsseite} style={knopfStil}>{o.gemeldet ? "Zahlungsdaten ansehen" : "Zur Zahlungsseite"}</a>
          : <p style={{ ...satz, fontSize: 12.5 }}>Die Zahlungsdaten haben wir Ihnen per E-Mail geschickt.</p>}
      </div>
    );
  }

  // E-365: bezahlt, im Paket enthalten oder geliefert — die Karte zeigt den Stand der Bonitätsauswertung.
  const aw = kauf.auswertung ?? null;
  if (!firma && (kauf.stufe === "auswertung" || aw?.stand === "liegt_vor")) {
    return (
      <div>
        <p style={ueber}>{name}</p>
        <h4 style={titel}>Ihre Bonitätsauswertung liegt vor{aw?.nummer ? ` · ${aw.nummer}` : ""}</h4>
        <p style={satz}>Ihre Bonität aus Sicht einer Bank — Bereich für Bereich, jede Ausgabe im Detail und Ihr Plan. Als PDF zum Aufbewahren.</p>
        <a className={s.knopf} href={demo ? undefined : zuAuswertung} style={knopfStil}>Bonitätsauswertung ansehen</a>
      </div>
    );
  }
  if (!firma && (kauf.stufe === "bezahlt" || kauf.stufe === "inklusive")) {
    const stand = aw?.stand ?? (kauf.stufe === "inklusive" ? "unterlagen_fehlen" : "wird_entwickelt");
    const ueberText = kauf.stufe === "inklusive" ? "Im Paket enthalten" : "Bezahlt";
    return (
      <div>
        <p style={ueber}>{name} · {ueberText}</p>
        <Fortschritt stand={stand} v={variante} />
        {stand === "unterlagen_fehlen" ? (
          <>
            <h4 style={titel}>Jetzt nur noch Ihre Unterlagen</h4>
            <p style={satz}>Laden Sie {fehltText(aw?.fehlt)} hoch — ein Handyfoto genügt, wenn alles lesbar ist. Daraus entwickelt Ihr FIAON-Team Ihre Bonitätsauswertung.</p>
            {hochladen && <a className={s.knopf} href={demo ? undefined : hochladen} style={knopfStil}>Jetzt hochladen</a>}
          </>
        ) : stand === "beginnt_ab" ? (
          <>
            <h4 style={titel}>Ihre Unterlagen sind da</h4>
            <p style={satz}>Wie bei Ihrer Bestellung gewählt, beginnen wir am {aw?.abText ?? "Ende der Widerrufsfrist"} mit Ihrer Bonitätsauswertung. Sie bekommen sie als PDF per E-Mail und finden sie hier.</p>
          </>
        ) : (
          <>
            <h4 style={titel}>Ihr FIAON-Team entwickelt Ihre Bonitätsauswertung</h4>
            <p style={satz}>Ausweis und Kontoauszüge liegen vor. Ein Mensch prüft den Bericht und gibt ihn frei — dann bekommen Sie ihn als PDF per E-Mail und finden ihn hier.</p>
          </>
        )}
      </div>
    );
  }
  if (kauf.stufe === "bezahlt") {
    return (
      <div>
        <p style={ueber}>Ihre Bonitätsauskunft</p>
        <h4 style={titel}>Wir fordern Ihre Datenkopien an</h4>
        <p style={satz}>Ihre Auskunft ist bezahlt. Wir fordern Ihre Datenkopien bei {kauf.bei} an. Sobald sie vorliegen, sehen Sie hier jeden Eintrag erklärt und Ihren Handlungsplan.</p>
      </div>
    );
  }
  if (!kauf.darfKaufen) return null;

  const hochladenLink = hochladen ? (
    <a href={hochladen} style={{ display: "inline-block", marginTop: 12, fontSize: 12.5, color: s.still2, textDecoration: "underline", textUnderlineOffset: 3 }}>
      {firma ? "Sie haben schon eine aktuelle Auskunft? Hier hochladen" : "Sie haben schon eine Datenkopie einer Auskunftei? Hier hochladen — wir beziehen sie ein"}
    </a>
  ) : null;
  const knopfText = firma ? "Auskunft jetzt beauftragen" : "Bonitätsauswertung beauftragen";
  const kopfText = firma ? `Ihre ${kauf.wort} — ${kauf.preisText} einmalig` : `Ihre Bonitätsauswertung — ${kauf.preisText} einmalig`;

  if (kompakt && schritt === "karte") {
    return (
      <div style={{ padding: "16px 18px", borderRadius: 14, border: `1px solid ${s.linie}`, background: "linear-gradient(180deg,rgba(37,99,235,.05),transparent)", textAlign: "left" }}>
        <p style={ueber}>{firma ? "Solange Sie warten: der Grundstein" : "Ihre Bonität aus Sicht einer Bank"}</p>
        <h4 style={{ ...titel, fontSize: 15.5 }}>{kopfText}</h4>
        <p style={{ ...satz, fontSize: 13 }}>{kauf.nutzen}{kauf.paketPreisSatz ? ` ${kauf.paketPreisSatz}` : ""}</p>
        <button type="button" className={`${s.still}${variante === "mb" ? " klein" : ""}`} style={{ ...KNOPF_SOFORT, marginTop: 12 }} onClick={() => setSchritt("auftrag")}>{knopfText}</button>
      </div>
    );
  }

  return (
    <div style={kompakt ? { padding: "16px 18px", borderRadius: 14, border: `1px solid ${s.linie}`, background: "#fff", textAlign: "left" } : undefined}>
      <p style={ueber}>{firma ? "Der Grundstein" : "Ihre Bonität aus Sicht einer Bank"}</p>
      <h4 style={titel}>{kopfText}</h4>
      <p style={satz}>{kauf.nutzen}</p>
      <Leistungsliste kauf={kauf} v={variante} />
      {!firma && <Schritte v={variante} />}
      <p style={{ ...satz, fontSize: 12.5, color: s.still2 }}>
        {kauf.mitAbo ? "Ihr Preis als FIAON-Kunde mit Paket. " : ""}Einmalig, kein Abo{firma ? " — nicht im Paket enthalten, ein eigener Auftrag" : ""}.
        {!firma ? ` ${AUSWERTUNG_UNTERLAGEN_SATZ}` : ""}
        {kauf.paketPreisSatz ? ` ${kauf.paketPreisSatz}` : ""}
      </p>
      {!firma && <p style={{ ...satz, fontSize: 11.5, color: s.still2 }}>{AUSWERTUNG_KEINE_AUSKUNFT_SATZ}</p>}
      {schritt === "karte"
        ? <button type="button" className={s.knopf} style={{ ...KNOPF_SOFORT, marginTop: 14 }} onClick={() => setSchritt("auftrag")}>{knopfText}</button>
        : <Auftrag kauf={kauf} v={variante} demo={demo} onZurueck={() => setSchritt("karte")} />}
      {schritt === "karte" && hochladenLink && <div>{hochladenLink}</div>}
    </div>
  );
}
