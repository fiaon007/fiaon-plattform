// ═══════════════════════════════════════════════════════════════════════════
// DIE ZAHLUNGSZENTRALE 2.0 (27.08.2026)
//
// Justin: „Zahlungszentrale passt gar nichts, diese muss komplett neu gemacht
// werden, geprüft werden."
//
// Die Fassung vom 26.08. zeigte NUR bezahlte Raten — ohne Bonitätsauskünfte,
// ohne das Offene, ohne das Bankbuch; ihre „Gegenprobe" verglich zwei
// Abfragen, die beide unvollständig waren. Diese hier zeigt die ganze
// Zahlungslage in DREI Sichten aus EINEM Endpunkt (/chef/zahlungszentrale):
//   EINGEGANGEN  jede bestätigte Zahlung — Raten UND Bonitätsauskünfte
//   OFFEN        jede offene Rate, Überfälliges zuerst, mit Mahnstufe
//   BANKBUCH     jeder Bankeingang — Unverbuchtes zuerst (die Arbeit!)
// Der Kopf rechnet aus demselben Umsatz-Baustein wie Lagezimmer und
// Wert-Raum — eine Gegenprobe ist nicht mehr nötig, weil es nur noch EINE
// Rechnung gibt. Gebucht wird weiterhin unter /chef/s/zahlungen-verwalten —
// hier ist der Prüfblick, dort der Stift.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { Search, X, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import "@/styles/chef-zahlen.css";

interface Zeile {
  am: string | null; cents: number; art: string; ref: string | null;
  personId: number | null; kunde: string; paket: string | null; zweck: string | null;
  mahnstufe?: number; ueberfaellig?: boolean; unverbucht?: boolean;
}
interface Antwort {
  ok: boolean; sicht: string; gesamt: number; summeCents: number;
  seiten: number; seite: number;
  kopf: { heuteCents: number; wocheCents: number; monatCents: number; jahrCents: number };
  zeilen: Zeile[];
}

const eur = (cents: number) =>
  (cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const wann = (iso: string | null) => iso
  ? new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" })
  : "—";
const tag = (iso: string | null) => iso
  ? new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" })
  : "—";

const SICHTEN = [
  { key: "eingegangen", label: "Eingegangen", satz: "Jede bestätigte Zahlung — Raten und Bonitätsauskünfte, neueste zuerst." },
  { key: "offen", label: "Offen & überfällig", satz: "Jede offene Rate. Überfälliges steht oben; die Summe zählt nur das Überfällige." },
  { key: "bankbuch", label: "Bankbuch", satz: "Jeder Bankeingang aus dem Wise-Auszug. Unverbuchtes steht oben — das ist die Arbeit." },
] as const;

export default function ChefZahlungen() {
  const [sicht, setSicht] = useState<string>("eingegangen");
  const [q, setQ] = useState("");
  const [suche, setSuche] = useState("");
  const [seite, setSeite] = useState(1);
  const [d, setD] = useState<Antwort | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  // Erst tippen lassen, dann suchen — sonst eine Abfrage je Tastendruck.
  useEffect(() => { const t = setTimeout(() => { setSuche(q); setSeite(1); }, 320); return () => clearTimeout(t); }, [q]);

  useEffect(() => {
    let weg = false;
    setLaedt(true);
    const pfad = `/api/fiaon/chef/zahlungszentrale?sicht=${sicht}&seite=${seite}`
      + (suche ? `&q=${encodeURIComponent(suche)}` : "");
    fetch(pfad, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => { if (weg) return; setLaedt(false); if (j.ok) { setD(j); setFehler(null); } else setFehler(j.error || "Nicht geladen."); })
      .catch(() => { if (!weg) { setLaedt(false); setFehler("Keine Verbindung."); } });
    return () => { weg = true; };
  }, [sicht, seite, suche]);

  const aktiv = SICHTEN.find((s) => s.key === sicht) ?? SICHTEN[0];

  return (
    <div className="cz">
      {/* ── Der Kopf: vier Summen aus dem einen Umsatz-Baustein ─────────── */}
      <section className="cz-block">
        <header><h2>Zahlungslage</h2><p>Dieselben Zahlen wie im Lagezimmer und im Wert-Raum — eine Quelle, eine Wahrheit.</p></header>
        <div className="cz-karten drei" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <article className="cz-karte"><small>Heute</small><b>{d ? eur(d.kopf.heuteCents) : "…"}</b><span>bankbestätigt eingegangen</span></article>
          <article className="cz-karte"><small>7 Tage</small><b>{d ? eur(d.kopf.wocheCents) : "…"}</b><span>rollierende Woche</span></article>
          <article className="cz-karte"><small>Laufender Monat</small><b>{d ? eur(d.kopf.monatCents) : "…"}</b><span>Raten + Auskünfte</span></article>
          <article className="cz-karte"><small>{new Date().getFullYear()}</small><b>{d ? eur(d.kopf.jahrCents) : "…"}</b><span>Jahr bis heute</span></article>
        </div>
      </section>

      {/* ── Sicht, Suche, Tabelle ────────────────────────────────────────── */}
      <section className="cz-block">
        <div className="czz-leiste">
          <div className="cl-zeitraum" role="tablist" aria-label="Sicht">
            {SICHTEN.map((s) => (
              <button key={s.key} type="button" role="tab" aria-selected={sicht === s.key}
                      className={`cl-zeitraum-knopf${sicht === s.key ? " an" : ""}`}
                      onClick={() => { setSicht(s.key); setSeite(1); }}>{s.label}</button>
            ))}
          </div>
          <div className="czz-suche">
            <Search size={16} strokeWidth={1.7} aria-hidden="true" />
            <input value={q} onChange={(e) => setQ(e.target.value)}
                   placeholder="Kunde, Aktenzeichen oder Verwendungszweck …"
                   autoComplete="off" spellCheck={false} aria-label="In den Zahlungen suchen" />
            {q && <button type="button" onClick={() => setQ("")} aria-label="Suche leeren"><X size={14} strokeWidth={2} /></button>}
          </div>
        </div>
        <p className="cz-fuss" style={{ marginTop: 10 }}>{aktiv.satz}</p>

        {fehler && <p className="cz-fehler" role="alert">{fehler}</p>}
        {!fehler && (
          <p className="cz-fuss" role="status" style={{ marginTop: 4 }}>
            {laedt ? "Wird geladen …" : d && (
              <>
                <b>{d.gesamt.toLocaleString("de-DE")}</b> {d.gesamt === 1 ? "Eintrag" : "Einträge"}
                {sicht === "eingegangen" && <> · zusammen <b>{eur(d.summeCents)}</b></>}
                {sicht === "offen" && <> · davon überfällig <b>{eur(d.summeCents)}</b></>}
                {sicht === "bankbuch" && d.summeCents > 0 && <> · unverbucht <b>{eur(d.summeCents)}</b></>}
                {d.seiten > 1 && <> · Seite {d.seite} von {d.seiten}</>}
              </>
            )}
          </p>
        )}

        <div className="czz-tab-huelle">
          <table className="czz-tab">
            <thead>
              <tr>
                <th>{sicht === "offen" ? "Fällig" : "Eingang"}</th>
                <th>Kunde</th>
                <th>{sicht === "bankbuch" ? "Wise-Kennung" : "Vorgang"}</th>
                <th>{sicht === "bankbuch" ? "Stand" : "Verwendungszweck"}</th>
                <th className="r">Betrag</th>
              </tr>
            </thead>
            <tbody>
              {(d?.zeilen ?? []).map((z, i) => (
                <tr key={i} className={z.ueberfaellig || z.unverbucht ? "warn" : ""}>
                  <td className="leise">{sicht === "offen" ? tag(z.am) : wann(z.am)}
                    {z.ueberfaellig && <em className="czz-marke rot">überfällig{z.mahnstufe ? ` · Mahnstufe ${z.mahnstufe}` : ""}</em>}
                    {z.unverbucht && <em className="czz-marke gelb">unverbucht</em>}
                  </td>
                  <td>{z.personId
                    ? <a href={`/chef/s/akte?id=${z.personId}`}>{z.kunde}</a>
                    : z.kunde}</td>
                  <td className="leise">{sicht === "bankbuch" ? (z.paket ?? "—") : `${z.art}${z.paket ? ` · ${String(z.paket).split("\n")[0]}` : ""}`}</td>
                  <td className="leise">{z.zweck ?? "—"}</td>
                  <td className="r"><b>{eur(z.cents)}</b></td>
                </tr>
              ))}
              {!laedt && (d?.zeilen ?? []).length === 0 && (
                <tr><td colSpan={5} className="leise" style={{ textAlign: "center", padding: "26px 0" }}>
                  {suche ? "Kein Treffer für diese Suche." : "Hier liegt nichts."}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {d && d.seiten > 1 && (
          <nav className="czz-blaettern" aria-label="Seiten">
            <button type="button" onClick={() => setSeite((s) => Math.max(1, s - 1))} disabled={seite <= 1}>
              <ChevronLeft size={15} strokeWidth={1.9} /> Zurück
            </button>
            <span>Seite {seite} von {d.seiten}</span>
            <button type="button" onClick={() => setSeite((s) => Math.min(d.seiten, s + 1))} disabled={seite >= d.seiten}>
              Weiter <ChevronRight size={15} strokeWidth={1.9} />
            </button>
          </nav>
        )}

        <p className="cz-fuss" style={{ marginTop: 14 }}>
          Gebucht wird in der <a href="/chef/s/zahlungen-verwalten" style={{ color: "#93c5fd" }}>Zahlungsverwaltung <ExternalLink size={11} style={{ display: "inline" }} /></a> —
          hier ist der Prüfblick, dort der Stift. Jede Kundenzeile führt in die eine zentrale Akte.
        </p>
      </section>
    </div>
  );
}
