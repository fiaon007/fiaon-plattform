// ═══════════════════════════════════════════════════════════════════════════
// /APP — „Vorsorge und Absicherung — ein kostenloses Gespräch“ (E-386, 16.10.2026)
//
// Eine ruhige Karte, kein Band: Nichts daran ist dringend. Der Kunde kann ein Gespräch wünschen (Interesse — FIAON darf
// ihn dazu anrufen) oder „kein Interesse“ wählen (dann fragt niemand mehr). Seine Daten gehen erst an einen Berater,
// wenn er im Telefonat ausdrücklich zustimmt. Der Server zeigt die Karte nur, wenn es einen aktiven Partner gibt und
// der Kunde weder gesperrt noch werbegesperrt noch Global-Kunde ist. Nie in der Demo.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { api } from "@/pages/app/Bausteine";

interface Lage {
  ok: boolean; zeigen: boolean; stand: "frage" | "gewuenscht" | "termin" | "abgelehnt"; termin?: string | null;
  texte: { titel: string; text: string; wortlaut: string; knopf: string; nein: string; danke: string; zurueck: string; abgelehnt: string };
}

export function PartnerGespraechKarte({ kundeRef, demo }: { kundeRef: string; demo: boolean }) {
  const [lage, setLage] = useState<Lage | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  useEffect(() => {
    if (demo) return;
    api(`/kunde/${encodeURIComponent(kundeRef)}/app/partner-gespraech`).then((r) => setLage(r.ok && r.json?.ok ? r.json : null)).catch(() => setLage(null));
  }, [kundeRef, demo]);
  if (demo || !lage?.zeigen) return meldung ? <p className="ap-fuss">{meldung}</p> : null;
  const t = lage.texte;
  async function senden(ja: boolean) {
    setLaeuft(true);
    const r = await api(`/kunde/${encodeURIComponent(kundeRef)}/app/partner-gespraech`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ja }) });
    setLaeuft(false);
    if (r.ok && r.json?.ok) { setLage(r.json); setMeldung(ja ? t.danke : t.abgelehnt); }
    else setMeldung(r.json?.error ?? "Das ließ sich gerade nicht speichern.");
  }
  return (
    <section className="ap-karte ap-auf v3" data-fiaon="heute-partner-gespraech">
      <h3>{t.titel}</h3>
      {lage.stand === "termin" ? (
        <>
          <p>Ihr Gespräch ist vereinbart: {lage.termin} Uhr. Die Einzelheiten stehen in unserer E-Mail.</p>
          <button type="button" className="ap-knopf still" style={{ marginTop: 12 }} disabled={laeuft} onClick={() => void senden(false)}>{t.zurueck}</button>
        </>
      ) : lage.stand === "gewuenscht" ? (
        <>
          <p>{meldung ?? t.danke}</p>
          <button type="button" className="ap-link" style={{ marginTop: 8, background: "none", border: 0, padding: 0 }} disabled={laeuft} onClick={() => void senden(false)}>{t.zurueck}</button>
        </>
      ) : (
        <>
          <p>{t.text}</p>
          <p style={{ fontSize: 13, marginTop: 8, color: "var(--fi-text-leise)" }}>{t.wortlaut}</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            <button type="button" className="ap-knopf" disabled={laeuft} onClick={() => void senden(true)}>{t.knopf}</button>
            <button type="button" className="ap-knopf still" disabled={laeuft} onClick={() => void senden(false)}>{t.nein}</button>
          </div>
          {meldung && <p className="ap-fuss">{meldung}</p>}
        </>
      )}
    </section>
  );
}
