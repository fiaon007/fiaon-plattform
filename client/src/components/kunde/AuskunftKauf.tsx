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
import { AUSKUNFT_BESCHAFFUNGSAUFTRAG_TEXT } from "@shared/fiaon-auskunft";

/** Spiegel von `AuskunftKauf` in server/routes/fiaon-kunde-bereich.ts. */
export interface AuskunftKauf {
  stufe: "bezahlt" | "offen" | "dokument" | "nichts";
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
      setMeldung({ ton: "fehler", text: "Bitte bestätigen Sie den Auftrag, damit wir Ihre Auskunft für Sie beschaffen dürfen." });
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
          <b style={{ color: s.text, fontWeight: 650 }}>{firma ? "Firmen-Bonitätsauskunft inkl. Handlungsplan" : "Bonitätsauskunft inkl. Handlungsplan"}</b>
          <b style={{ color: s.text, fontWeight: 650, whiteSpace: "nowrap" }}>{kauf.preisText} einmalig</b>
        </div>
        <p style={{ margin: "6px 0 0", fontSize: 12.5, lineHeight: 1.55, color: s.leise }}>
          Datenkopien bei {kauf.bei}, Erklärung jedes Eintrags, Fristenprüfung, Handlungsplan und fertige Schreiben zur Freigabe.
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

  if (kauf.stufe === "offen") {
    const o = kauf.offen;
    return (
      <div>
        <p style={ueber}>Ihre Bonitätsauskunft</p>
        <h4 style={titel}>{o?.gemeldet ? "Ihre Zahlung ist gemeldet" : "Ihre Auskunft ist bestellt — Zahlung offen"}</h4>
        <p style={satz}>
          {o?.gemeldet
            ? `Sobald Ihre Überweisung bei uns gebucht ist, fordern wir Ihre Datenkopien bei ${kauf.bei} an.`
            : `Sobald Ihre Überweisung${o ? ` über ${o.betragText}` : ""} da ist, fordern wir Ihre Datenkopien bei ${kauf.bei} an.`}
        </p>
        {o?.zahlungsseite
          ? <a className={o.gemeldet ? s.still : s.knopf} href={demo ? undefined : o.zahlungsseite} style={{ ...KNOPF_SOFORT, marginTop: 14, ...(variante === "ap" ? {} : { display: "inline-block" }) }}>{o.gemeldet ? "Zahlungsdaten ansehen" : "Zur Zahlungsseite"}</a>
          : <p style={{ ...satz, fontSize: 12.5 }}>Die Zahlungsdaten haben wir Ihnen per E-Mail geschickt.</p>}
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
      Sie haben schon eine aktuelle Auskunft? Hier hochladen
    </a>
  ) : null;

  if (kompakt && schritt === "karte") {
    return (
      <div style={{ padding: "16px 18px", borderRadius: 14, border: `1px solid ${s.linie}`, background: "linear-gradient(180deg,rgba(37,99,235,.05),transparent)", textAlign: "left" }}>
        <p style={ueber}>Solange Sie warten: der Grundstein</p>
        <h4 style={{ ...titel, fontSize: 15.5 }}>Ihre {kauf.wort} — {kauf.preisText} einmalig</h4>
        <p style={{ ...satz, fontSize: 13 }}>{kauf.nutzen}{kauf.paketPreisSatz ? ` ${kauf.paketPreisSatz}` : ""}</p>
        <button type="button" className={`${s.still}${variante === "mb" ? " klein" : ""}`} style={{ ...KNOPF_SOFORT, marginTop: 12 }} onClick={() => setSchritt("auftrag")}>Auskunft jetzt beauftragen</button>
      </div>
    );
  }

  return (
    <div style={kompakt ? { padding: "16px 18px", borderRadius: 14, border: `1px solid ${s.linie}`, background: "#fff", textAlign: "left" } : undefined}>
      <p style={ueber}>Der Grundstein</p>
      <h4 style={titel}>Ihre {kauf.wort} — {kauf.preisText} einmalig</h4>
      <p style={satz}>{kauf.nutzen}</p>
      <Leistungsliste kauf={kauf} v={variante} />
      <p style={{ ...satz, fontSize: 12.5, color: s.still2 }}>
        {kauf.mitAbo ? "Ihr Preis als FIAON-Kunde mit Paket. " : ""}Einmalig, kein Abo — nicht im Paket enthalten, ein eigener Auftrag.
        {kauf.paketPreisSatz ? ` ${kauf.paketPreisSatz}` : ""}
      </p>
      {schritt === "karte"
        ? <button type="button" className={s.knopf} style={{ ...KNOPF_SOFORT, marginTop: 14 }} onClick={() => setSchritt("auftrag")}>Auskunft jetzt beauftragen</button>
        : <Auftrag kauf={kauf} v={variante} demo={demo} onZurueck={() => setSchritt("karte")} />}
      {schritt === "karte" && hochladenLink && <div>{hochladenLink}</div>}
    </div>
  );
}
