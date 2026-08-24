// ═══════════════════════════════════════════════════════════════════════════
// „KUNDE NICHT ERSCHIENEN“ — ERST DER GRUND, DANN DIE FOLGE (24.08.2026)
//
// ── DER AUFTRAG (Justin, wörtlich) ─────────────────────────────────────────
// „man braucht aber auch so was wie ‚Kunde nicht erschienen‘, dann wählt man
// aus WARUM, und basierend darauf löst sich was aus: ‚Telefonnummer nicht
// korrekt‘ → Mail für neue Nummer, ‚nicht erschienen‘ → Mail mit neuem Termin“
//
// ── VORHER ─────────────────────────────────────────────────────────────────
// Es gab einen Knopf „Nicht erschienen“ — an drei Stellen, mit drei
// verschiedenen Texten daneben, und alle drei lösten dasselbe aus. Ein Kunde
// mit falscher Nummer bekam eine Einladung auf eine Nummer, die niemand liest.
//
// ── NACHHER ────────────────────────────────────────────────────────────────
// DIESES Bauteil — einmal gebaut, überall dasselbe: auf der Fokus-Karte im
// Onboarding-Raum, an der Terminkarte darunter und in der Gesprächsbühne.
// Eine Regel, die drei Oberflächen einzeln kennen müssten, wird an der
// vierten vergessen (AGENTS.md).
//
// ── DIE FORM ───────────────────────────────────────────────────────────────
// Dasselbe Muster wie „Gespräch abschließen“ in der Kundenakte
// (.pi-abschluss / .pi-abschluss-weg): Der Knopf ist zurückhaltend, die
// Gründe klappen erst danach auf, und jeder Grund SAGT, was er auslöst —
// bevor geklickt wird und noch einmal danach.
//
// Die Schlüssel unten stehen so auch im Server (NICHT_ERSCHIENEN_GRUENDE in
// server/routes/fiaon-onboarding-bereich.ts). Er prüft sie; diese Datei
// beschriftet sie.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { api } from "@/pages/agent/shared";
import "@/styles/office-onboarding.css";

export interface NichtErschienenTermin {
  id: number;
  name: string;
}

type GrundKey = "nicht_erschienen" | "nummer_falsch" | "kunde_abgesagt" | "kein_interesse";

interface GrundZeile {
  key: GrundKey;
  titel: string;
  folge: string;
  /** Was passieren WIRD — im Klartext, vor dem Klick. */
  satz: (name: string) => string;
  knopf: string;
  notizPflicht: boolean;
  /** Nur der letzte Grund verschickt nichts — er wird ruhiger dargestellt. */
  ohneMail?: boolean;
}

const GRUENDE: GrundZeile[] = [
  {
    key: "nicht_erschienen",
    titel: "Nicht erschienen / nicht abgenommen",
    folge: "E-Mail mit dem Link für einen neuen Termin",
    satz: (n) => `${n} bekommt sofort die E-Mail „Leider nicht erschienen“ mit dem Link für einen neuen Termin. `
      + "Der Versuch zählt als erfolglos.",
    knopf: "Vermerken & E-Mail schicken",
    notizPflicht: false,
  },
  {
    key: "nummer_falsch",
    titel: "Telefonnummer stimmt nicht",
    folge: "E-Mail mit der Bitte um die neue Nummer",
    satz: (n) => `${n} bekommt eine E-Mail und trägt seine neue Nummer selbst ein — sie steht danach sofort in der Akte. `
      + "Der Versuch zählt als erfolglos.",
    knopf: "Neue Rufnummer erbitten",
    notizPflicht: false,
  },
  {
    key: "kunde_abgesagt",
    titel: "Kunde hat abgesagt / passt gerade nicht",
    folge: "Termin absagen, Einladung für einen neuen",
    satz: (n) => `Der Termin wird abgesagt — das zählt NICHT als erfolgloser Versuch. ${n} bekommt die Einladung `
      + "und wählt eine neue Zeit.",
    knopf: "Absagen & neu einladen",
    notizPflicht: false,
  },
  {
    key: "kein_interesse",
    titel: "Kunde will nicht mehr",
    folge: "Keine E-Mail. Nur festhalten — Notiz nötig",
    satz: () => "Es geht KEINE E-Mail raus, auch später keine automatische. Bitte halte in einem Satz fest, "
      + "was der Kunde gesagt hat — ohne Mail ist deine Notiz das Einzige, was davon bleibt.",
    knopf: "Nur festhalten",
    notizPflicht: true,
    ohneMail: true,
  },
];

/** Mindestlänge der Pflicht-Notiz — dieselbe Zahl wie im Server. */
const NOTIZ_MINDEST = 10;

export function NichtErschienenWahl({
  termin, onFertig, onAbbruch,
}: {
  termin: NichtErschienenTermin;
  /**
   * Der Vorgang ist durch. `warn` heißt: festgehalten ist er — die E-Mail an
   * den Kunden ging aber NICHT raus. Beides muss der Mitarbeiter sehen.
   */
  onFertig: (hinweis: string, warn: boolean) => void;
  onAbbruch: () => void;
}) {
  const [gewaehlt, setGewaehlt] = useState<GrundZeile | null>(null);
  const [notiz, setNotiz] = useState("");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const zuKurz = !!gewaehlt?.notizPflicht && notiz.trim().length < NOTIZ_MINDEST;

  const senden = async () => {
    if (!gewaehlt || zuKurz) return;
    setBusy(true); setFehler(null);
    const r = await api(`/agent/onboarding/termine/${termin.id}/nicht-erschienen`, {
      method: "POST",
      body: JSON.stringify({ grund: gewaehlt.key, notiz: notiz.trim() || undefined }),
    });
    setBusy(false);
    if (!r.ok) {
      // Der Grund WÖRTLICH — „hat nicht geklappt“ erzeugt genau die Rückfrage,
      // die dieser Bereich abschaffen soll.
      setFehler(r.json?.error || `Nicht gespeichert (HTTP ${r.status}) — bitte noch einmal versuchen.`);
      return;
    }
    onFertig(r.json?.hinweis || "Festgehalten.", r.json?.versandOk === false);
  };

  return (
    <div className="ob-ne">
      <span className="ob-ne-frage">Warum ist das Gespräch nicht zustande gekommen?</span>

      <div className="ob-ne-wege">
        {GRUENDE.map((g) => (
          <button key={g.key} type="button" aria-pressed={gewaehlt?.key === g.key}
                  className={`ob-ne-weg${gewaehlt?.key === g.key ? " an" : ""}${g.ohneMail ? " still" : ""}`}
                  onClick={() => { setGewaehlt(g); setFehler(null); }}>
            <b>{g.titel}</b>
            <small>{g.folge}</small>
          </button>
        ))}
      </div>

      {gewaehlt && (
        <div className="ob-ne-schritt">
          <p className="ob-ne-satz">{gewaehlt.satz(termin.name)}</p>
          <textarea className="ob-feld" rows={2} value={notiz}
                    onChange={(e) => { setNotiz(e.target.value); setFehler(null); }}
                    aria-label="Notiz zum Vorgang"
                    placeholder={gewaehlt.notizPflicht
                      ? "Was hat der Kunde gesagt? (nötig)"
                      : "Notiz für die Akte (freiwillig)"} />
          {gewaehlt.notizPflicht && (
            <small className="ob-ne-zaehler" data-fehlt={zuKurz ? "ja" : undefined}>
              {zuKurz ? `Noch ${NOTIZ_MINDEST - notiz.trim().length} Zeichen` : "Steht danach in der Akte."}
            </small>
          )}
          <div className="ob-ne-knoepfe">
            <button type="button" className="ob-knopf klein" disabled={busy || zuKurz} onClick={() => void senden()}>
              {busy ? "Läuft …" : gewaehlt.knopf}
            </button>
            <button type="button" className="ob-ne-zurueck" disabled={busy} onClick={() => { setGewaehlt(null); setFehler(null); }}>
              anderer Grund
            </button>
          </div>
          {fehler && <p className="ob-ne-fehler" role="alert">{fehler}</p>}
        </div>
      )}

      <button type="button" className="ob-ne-zurueck" disabled={busy} onClick={onAbbruch}>
        Abbrechen
      </button>
    </div>
  );
}
