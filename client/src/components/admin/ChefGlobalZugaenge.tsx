// ═══════════════════════════════════════════════════════════════════════════
// CHEFBÜRO › GLOBAL — KUNDENZUGÄNGE (E-423, 22.10.2026)
//
// Justin: „Alle Kunden, die jetzt aktiv sind mit unterschriebenen Verträgen,
// sollen eine Mail mit ihrem eigenen Link bekommen, wo sie ihren Zugang festlegen."
//
// Eine Leiste im Arbeitsraum (wie ChefGlobalEinstellungen): jede Adresse mit
// Global-Akte oder angenommenem Angebot — auch Begleitverträge OHNE Akte, die
// links in der Mandatsliste fehlen — mit dem Stand ihres persönlichen Zugangs
// und dem Knopf „Zugang einladen“ bzw. „Einladung erneut senden“ — dazu „Nur Link
// erzeugen“ (keine Systemmail: der Link erscheint hier zum Kopieren, für eine
// persönliche Mail; vermerkt im Verlauf und im Anmeldeprotokoll). Ein
// eingerichteter Zugang braucht keinen Knopf (dann hilft „Passwort vergessen“).
// Server: GET /chef/global/zugaenge, POST /chef/global/zugaenge/einladen
// (server/routes/fiaon-global-konto.ts). Jede Rückmeldung bleibt stehen.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import "@/styles/chef-global-zugaenge.css";

interface Zugang {
  email: string; name: string | null; firma: string | null; refs: string[];
  status: "keins" | "eingeladen" | "aktiv" | "gesperrt";
  eingeladenAm: string | null; einladungen: number; eingerichtetAm: string | null; letzteAnmeldungAm: string | null;
}

const tag = (iso: string | null) => iso ? new Date(iso).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

export default function ChefGlobalZugaenge() {
  const [liste, setListe] = useState<Zugang[] | null>(null);
  const [fehler, setFehler] = useState("");
  const [offen, setOffen] = useState(false);
  const [sendet, setSendet] = useState("");
  const [meldung, setMeldung] = useState<{ text: string; gut: boolean } | null>(null);
  const [link, setLink] = useState<{ email: string; url: string } | null>(null);
  const [kopiert, setKopiert] = useState(false);

  const laden = async () => {
    try {
      const r = await fetch("/api/fiaon/chef/global/zugaenge", { credentials: "include" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) { setFehler(j?.error || `Kundenzugänge: Fehler ${r.status}`); return; }
      setListe(j.zugaenge); setFehler("");
    } catch { setFehler("Kundenzugänge: keine Verbindung zum Server."); }
  };
  useEffect(() => { void laden(); }, []);

  const einladen = async (z: Zugang, nurLink = false) => {
    const wort = z.status === "eingeladen" ? "erneut einladen" : "einladen";
    const frage = nurLink
      ? `Einladungslink für ${z.name || z.email} (${z.email}) erzeugen?\n\nEs geht KEINE Mail raus — du schickst den Link persönlich. Ein älterer Einladungslink gilt danach nicht mehr.`
      : `${z.name || z.email} (${z.email}) ${wort}?\n\nDie Mail „Ihr persönlicher Zugang zu FIAON Global“ geht sofort raus. Ein älterer Einladungslink gilt danach nicht mehr.`;
    if (!window.confirm(frage)) return;
    setSendet(z.email); setMeldung(null); setLink(null); setKopiert(false);
    try {
      const r = await fetch("/api/fiaon/chef/global/zugaenge/einladen", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: z.email, nurLink }),
      });
      const j = await r.json().catch(() => ({}));
      setMeldung({ text: j?.ok ? String(j.meldung) : String(j?.error || `Fehler ${r.status}`), gut: !!j?.ok });
      if (j?.ok && typeof j.link === "string") setLink({ email: z.email, url: j.link });
      if (j?.ok) await laden();
    } catch { setMeldung({ text: "Keine Verbindung zum Server — die Einladung ist NICHT raus.", gut: false }); }
    setSendet("");
  };

  if (fehler) return <section className="cgz" aria-label="Kundenzugänge"><p className="cgz-meldung">{fehler}</p></section>;
  if (!liste) return null;
  const aktiv = liste.filter((z) => z.status === "aktiv").length;
  const eingeladen = liste.filter((z) => z.status === "eingeladen").length;
  const ohne = liste.filter((z) => z.status === "keins").length;

  return (
    <section className="cgz" aria-label="Kundenzugänge" data-fiaon="chef-global-zugaenge">
      <button type="button" className="cgz-kopf" onClick={() => setOffen((o) => !o)} aria-expanded={offen}>
        <b>Kundenzugänge</b>
        <span>{aktiv} eingerichtet · {eingeladen} eingeladen · {ohne} ohne Zugang {offen ? "— zuklappen" : "— anzeigen"}</span>
      </button>
      {offen && (
        <div className="cgz-zeilen">
          {liste.map((z) => (
            <div key={z.email} className="cgz-zeile">
              <span>
                <b>{z.name || z.email}{z.firma ? ` · ${z.firma}` : ""}</b>
                <small>{z.email}{z.refs.length ? ` · ${z.refs.join(", ")}` : ""}</small>
              </span>
              <span className={`cgz-stand ${z.status}`}>
                <i />
                {z.status === "aktiv" ? `Eingerichtet ${tag(z.eingerichtetAm)}${z.letzteAnmeldungAm ? ` · zuletzt angemeldet ${tag(z.letzteAnmeldungAm)}` : ""}`
                  : z.status === "eingeladen" ? `Eingeladen ${tag(z.eingeladenAm)}${z.einladungen > 1 ? ` (${z.einladungen}×)` : ""} — noch nicht eingerichtet`
                  : z.status === "gesperrt" ? "Gesperrt" : "Noch kein Zugang"}
              </span>
              {z.status === "keins" || z.status === "eingeladen" ? (
                <span className="cgz-knoepfe">
                  <button type="button" className="cgz-knopf" disabled={!!sendet} onClick={() => void einladen(z)}>
                    {sendet === z.email ? "Sendet …" : z.status === "eingeladen" ? "Einladung erneut senden" : "Zugang einladen"}
                  </button>
                  <button type="button" className="cgz-knopf leise" disabled={!!sendet} onClick={() => void einladen(z, true)} title="Keine Systemmail — der Link erscheint hier zum Kopieren">
                    Nur Link erzeugen
                  </button>
                </span>
              ) : <span />}
            </div>
          ))}
          {liste.length === 0 && <p className="cgz-meldung gut">Noch kein Global-Kunde mit Vertrag.</p>}
        </div>
      )}
      {meldung && <p className={`cgz-meldung${meldung.gut ? " gut" : ""}`} role="status">{meldung.text}</p>}
      {link && (
        <div className="cgz-link" data-fiaon="chef-global-zugang-link">
          <small>Einladungslink für {link.email} — nur persönlich weitergeben (wer ihn hat, kann den Zugang einrichten; bestätigt wird per Code an diese Adresse):</small>
          <input readOnly value={link.url} onFocus={(e) => e.currentTarget.select()} aria-label="Einladungslink" />
          <button type="button" className="cgz-knopf" onClick={() => { void navigator.clipboard?.writeText(link.url).then(() => setKopiert(true)); }}>{kopiert ? "Kopiert" : "Link kopieren"}</button>
        </div>
      )}
    </section>
  );
}
