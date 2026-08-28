import { useEffect, useMemo, useState } from "react";
import { AgentShell } from "./shared";
import { Reveal } from "./motion";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "./rundgaenge";

// ═══════════════════════════════════════════════════════════════════════════
// /agent/mails — jede Kundenmail, wie der Kunde sie sieht (28.08.2026)
//
// Justins Auftrag: „Es soll eine Seite geben für die Mitarbeiter, wo sie
// sämtliche E-Mails als Vorschau sehen können, wie sie der Kunde sieht."
//
// Warum das zählt: Wer am Telefon sagt „Sie bekommen gleich eine E-Mail von
// uns", sollte wissen, wie sie aussieht und was drinsteht. Vorher musste man
// dafür in Brevo klicken — jetzt liegt sie einen Klick entfernt, gerendert
// von EXAKT der Funktion, die auch versendet.
// ═══════════════════════════════════════════════════════════════════════════

interface MailEintrag {
  type: string; label: string; gruppe: string; klartext: string;
  betreff: string | null; hatVorlage: boolean; absender: string | null;
}

const GRUPPEN_NAME: Record<string, string> = {
  konto: "Konto & Zugang",
  zahlung: "Zahlung & Raten",
  termin: "Termine",
  dokumente: "Auskunft & Dokumente",
  lead: "Interessenten",
};

export default function AgentMailsPage() {
  const [mails, setMails] = useState<MailEintrag[]>([]);
  const [fehler, setFehler] = useState(false);
  const [offen, setOffen] = useState<MailEintrag | null>(null);
  const [gruppe, setGruppe] = useState<string>("alle");

  useEffect(() => {
    fetch("/api/fiaon/agent/mail/galerie", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d?.ok) setMails(d.mails); else setFehler(true); })
      .catch(() => setFehler(true));
  }, []);

  const gruppen = useMemo(
    () => Array.from(new Set(mails.map((m) => m.gruppe))).filter(Boolean),
    [mails]);
  const sichtbar = mails.filter((m) => gruppe === "alle" || m.gruppe === gruppe);

  return (
    <AgentShell>
      <Rundgang raum="mails" titel={RUNDGAENGE.mails.titel} schritte={RUNDGAENGE.mails.schritte} />
      <div style={{ maxWidth: 1040, margin: "0 auto", display: "grid", gap: 18 }}>
        <Reveal>
          <header>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-.01em" }}>Unsere E-Mails</h1>
            <p style={{ margin: "6px 0 0", fontSize: 13.5, opacity: .75, maxWidth: "68ch", lineHeight: 1.6 }}>
              Jede Mail, die das Haus an Kunden verschickt — genau so, wie sie ankommt.
              Wenn du am Telefon sagst „Sie bekommen gleich eine E-Mail", weißt du hier, was drinsteht.
            </p>
          </header>
        </Reveal>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {["alle", ...gruppen].map((g) => (
            <button key={g} onClick={() => setGruppe(g)}
              style={{
                padding: "8px 16px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                border: `1px solid ${gruppe === g ? "rgba(37,99,235,.6)" : "rgba(148,163,184,.3)"}`,
                background: gruppe === g ? "rgba(37,99,235,.14)" : "transparent",
                color: gruppe === g ? "#1d4ed8" : "inherit",
              }}>
              {g === "alle" ? `Alle (${mails.length})` : (GRUPPEN_NAME[g] ?? g)}
            </button>
          ))}
        </div>

        {fehler && <p style={{ opacity: .7 }}>Die Galerie lässt sich gerade nicht laden.</p>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
          {sichtbar.map((m, i) => (
            <Reveal key={m.type} delay={Math.min(i * 30, 300)}>
              <button onClick={() => m.hatVorlage && setOffen(m)}
                disabled={!m.hatVorlage}
                style={{
                  display: "grid", gap: 6, width: "100%", textAlign: "left", padding: "16px 18px",
                  borderRadius: 16, cursor: m.hatVorlage ? "pointer" : "default",
                  border: "1px solid rgba(148,163,184,.25)", background: "rgba(148,163,184,.06)",
                  opacity: m.hatVorlage ? 1 : .55, color: "inherit",
                }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", opacity: .6 }}>
                  {GRUPPEN_NAME[m.gruppe] ?? m.gruppe}{m.absender ? ` · ${m.absender}` : ""}
                </span>
                <b style={{ fontSize: 14.5 }}>{m.label}</b>
                {m.betreff && <span style={{ fontSize: 12.5, opacity: .8 }}>Betreff: „{m.betreff}“</span>}
                <span style={{ fontSize: 12, opacity: .65, lineHeight: 1.5 }}>{m.klartext}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#2563eb" }}>
                  {m.hatVorlage ? "Vorschau ansehen →" : "Vorlage folgt"}
                </span>
              </button>
            </Reveal>
          ))}
        </div>
      </div>

      {offen && (
        <div onClick={() => setOffen(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 70, display: "grid", placeItems: "center",
            padding: 20, background: "rgba(2,6,23,.72)", backdropFilter: "blur(5px)",
          }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(660px, 100%)", height: "min(88vh, 900px)", display: "flex", flexDirection: "column",
              borderRadius: 18, overflow: "hidden", background: "#0b1428",
              border: "1px solid rgba(96,165,250,.35)", boxShadow: "0 40px 120px rgba(2,6,23,.8)",
            }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 18px", borderBottom: "1px solid rgba(148,163,184,.18)" }}>
              <div>
                <b style={{ color: "#f1f5f9", fontSize: 14.5 }}>{offen.label}</b>
                <span style={{ display: "block", fontSize: 11.5, color: "rgba(148,163,184,.85)", marginTop: 2 }}>
                  Mit Beispieldaten — genau so kommt sie beim Kunden an.
                </span>
              </div>
              <button onClick={() => setOffen(null)} aria-label="Schließen"
                style={{ background: "transparent", border: 0, color: "#94a3b8", cursor: "pointer", fontSize: 22, lineHeight: 1 }}>×</button>
            </div>
            <iframe title={offen.label} src={`/api/fiaon/agent/mail/galerie/${offen.type}`}
              style={{ flex: 1, border: 0, background: "#f0f4fa" }} />
          </div>
        </div>
      )}
    </AgentShell>
  );
}
