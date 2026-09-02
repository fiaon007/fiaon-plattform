// ═══════════════════════════════════════════════════════════════════════════
// /status — Verfügbarkeit und Sicherheit, live (02.09.2026, E-083)
//
// Seitenverzeichnis vom 22.08.: „Status-Seite ⬜ (Vertrauen, DD)". Was die
// Seite zeigt: ob die Plattform gerade antwortet (GET /healthz, derselbe
// Pfad, den Render für das unterbrechungsfreie Umschalten nutzt), wo die
// Daten liegen, wie sie geschützt sind, und die Regeln für Wartung. Keine
// Marketingzahlen — nur, was sich prüfen lässt. Bekannte Störungen trägt der
// Betreiber in STOERUNGEN ein (neueste zuerst); leer heißt: keine bekannt.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { Dunkel, Hero, Block, Licht, Knopf, Glas, Kennzahlen, Zeilen, Fragen } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import "@/styles/ratgeber.css";
import "@/styles/seo-seiten.css";

const STOERUNGEN: { datum: string; titel: string; text: string; dauer: string }[] = [
  { datum: "27.08.2026", titel: "Kundenbereich nach Anmeldung nicht erreichbar", text: "Eine Datenbankabfrage im Kundenbereich schlug fehl; die Anmeldung wirkte kaputt. Ursache behoben, seither Praxistest gegen die echte Datenbank vor jedem Deploy und ein Gesundheitspfad für unterbrechungsfreies Umschalten.", dauer: "rund 12 Stunden" },
];

const FRAGEN = [
  { f: "Wo liegen meine Daten?", a: "Auf Servern in Frankfurt am Main (EU) bei einem Hosting-Anbieter mit europäischer Region; die Datenbank liegt in derselben Region. Der Umzug aus einer US-Region nach Frankfurt wurde am 24.08.2026 abgeschlossen. Sicherungen liegen ebenfalls in der EU." },
  { f: "Wie sind die Daten geschützt?", a: "Verschlüsselte Übertragung (TLS), verschlüsselte Speicherung, Zugriff nur für den Ansprechpartner, der Ihre Akte führt, und die Betreiber. Hochgeladene Unterlagen werden beim Hochladen geprüft. Zahlungen laufen per SEPA über einen verifizierten Kreditor – FIAON speichert keine Kartendaten." },
  { f: "Was bedeutet der grüne Punkt oben?", a: "Ihr Browser hat gerade den Gesundheitspfad der Plattform abgefragt und eine Antwort bekommen. Denselben Pfad nutzt unser Hosting, um eine neue Version erst dann Verkehr zu geben, wenn sie antwortet – Deploys laufen dadurch ohne Unterbrechung." },
  { f: "Wann wird gewartet?", a: "Deploys erfolgen mehrmals wöchentlich ohne Unterbrechung. Wartung mit Ausfall kündigen wir hier und im Kundenbereich mindestens 24 Stunden vorher an und legen sie nicht in die Telefonzeiten des Teams." },
  { f: "Wen erreiche ich bei einer Störung?", a: "Support +41 44 244 93 01 oder support@fiaon.com. Kunden nutzen zusätzlich „Dringend melden“ auf der Kontaktseite – die Meldung landet direkt bei der Geschäftsführung." },
];

export default function Status() {
  const [zustand, setZustand] = useState<"prueft" | "ok" | "gestoert">("prueft");
  const [ms, setMs] = useState<number | null>(null);
  const [zeit, setZeit] = useState<string>("");
  useEffect(() => {
    const t0 = performance.now();
    fetch("/healthz", { cache: "no-store" }).then((r) => { setMs(Math.round(performance.now() - t0)); setZustand(r.ok ? "ok" : "gestoert"); }).catch(() => setZustand("gestoert"));
    setZeit(new Date().toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }));
  }, []);

  return (
    <Dunkel seite="ratgeber" titel="Status · Verfügbarkeit und Sicherheit" beschreibung="Läuft FIAON gerade? Live-Prüfung der Plattform, Datenstandort Frankfurt, Verschlüsselung, Regeln für Wartung und die Liste bekannter Störungen – ehrlich und prüfbar.">
      <SeoDaten pfad="/status" titel="FIAON Status: Verfügbarkeit, Datenstandort, Störungen" beschreibung="Läuft FIAON gerade? Live-Prüfung der Plattform, Datenstandort Frankfurt, Verschlüsselung, Regeln für Wartung und die Liste bekannter Störungen – prüfbar." fragen={FRAGEN} krumen={[{ name: "Status", pfad: "/status" }]} />
      <Hero
        bild="/kino/datenraum.jpg"
        pille="Status · live geprüft"
        titel={<>Läuft FIAON <span className="dk-verlauf">gerade?</span></>}
        lead="Diese Seite fragt die Plattform beim Öffnen selbst – und sagt Ihnen, wo Ihre Daten liegen, wie sie geschützt sind und was zuletzt nicht funktioniert hat. Keine Marketingzahlen, nur Prüfbares."
        knoepfe={<><Knopf href="#sicherheit">Datenstandort und Schutz</Knopf><Knopf href="/sicherheit" still>Sicherheit im Detail</Knopf></>}
      />

      <Block eng>
        <Glas ruhig>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: 999, background: zustand === "ok" ? "#22c55e" : zustand === "gestoert" ? "#ef4444" : "#94a3b8", boxShadow: zustand === "ok" ? "0 0 18px rgba(34,197,94,.6)" : "none" }} />
            <h3 className="dk-h3" style={{ margin: 0 }}>{zustand === "prueft" ? "Prüfung läuft …" : zustand === "ok" ? "Alle Systeme antworten." : "Die Plattform antwortet gerade nicht."}</h3>
          </div>
          <p className="dk-leise" style={{ marginTop: 8 }}>{zustand === "ok" && ms !== null ? `Antwort des Gesundheitspfads in ${ms} ms · geprüft ${zeit}` : zustand === "gestoert" ? `Geprüft ${zeit}. Bitte in einigen Minuten erneut laden – oder Support +41 44 244 93 01.` : "Ihr Browser fragt /healthz ab."}</p>
        </Glas>
      </Block>

      <Licht>
        <Block id="sicherheit" schmal titel={<>Datenstandort und <span className="dk-verlauf">Schutz.</span></>} lead="Was sich nachprüfen lässt, steht hier – mit Datum.">
          <Zeilen items={[
            ["Datenstandort", "Frankfurt am Main, EU-Region – Anwendung und Datenbank; Umzug aus den USA abgeschlossen am 24.08.2026"],
            ["Übertragung", "TLS-verschlüsselt (HTTPS erzwungen, www leitet um)"],
            ["Speicherung", "verschlüsselt; Unterlagen als Datei in der Datenbank, nicht im offenen Dateisystem"],
            ["Zugriff", "nur der zuständige Ansprechpartner und die Betreiber; jede Aktion protokolliert"],
            ["Zahlungen", "SEPA-Lastschrift über einen verifizierten Kreditor; keine Kartendaten bei FIAON"],
            ["Deploys", "unterbrechungsfrei über Gesundheitspfad; nicht in Telefonzeiten; Praxistest gegen die echte Datenbank vor jedem Deploy"],
            ["Löschung", "auf Wunsch nach Vertragsende vollständig (Art. 17 DSGVO), Bestätigung binnen 30 Tagen"],
          ]} />
        </Block>

        <Block schmal titel={<>Bekannte Störungen – <span className="dk-verlauf">ehrlich geführt.</span></>} lead="Was nicht funktioniert hat, steht hier, mit Ursache und Konsequenz. Leer heißt: keine bekannt.">
          {STOERUNGEN.length === 0 ? <p className="dk-text">Keine bekannten Störungen.</p> : (
            <div className="sx-zeitleiste">
              {STOERUNGEN.map((s, i) => (
                <div key={s.datum + i} className="sx-etappe">
                  <div className="spur"><span className="punkt">!</span>{i < STOERUNGEN.length - 1 && <span className="faden" />}</div>
                  <div className="inhalt"><span className="dauer">{s.datum} · {s.dauer}</span><h3>{s.titel}</h3><p>{s.text}</p></div>
                </div>
              ))}
            </div>
          )}
        </Block>

        <Block eng>
          <Kennzahlen items={[{ wert: "EU", label: "Frankfurt am Main" }, { wert: "24 h", label: "Vorlauf bei Wartung mit Ausfall" }, { wert: "0", label: "gespeicherte Kartendaten" }, { wert: "30 Tage", label: "bis zur Löschbestätigung" }]} />
        </Block>

        <Block schmal titel="Häufige Fragen zum Status"><Fragen items={FRAGEN} /></Block>
      </Licht>
    </Dunkel>
  );
}
