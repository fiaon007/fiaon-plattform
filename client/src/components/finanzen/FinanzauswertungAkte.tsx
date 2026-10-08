// ═══════════════════════════════════════════════════════════════════════════
// AKTE · REITER DOKUMENTE: FIAON FINANZ- UND BONITÄTSAUSWERTUNG + UNTERLAGEN ANFORDERN
// (E-IT-D, 08.10.2026 — Punkte 4b und 4c)
//
// Justin: „Knopf in der Akte neben ‚Bonitätsauswertung erzeugen', nur aktiv,
// wenn Ausweis UND Kontoauszug vollständig (laut Prüfung) vorliegen; sonst
// stehen die fehlenden Teile dabei mit 1-Klick-Anforderung." Danach: Vorschau
// (PDF im Rahmen), Freigabe durch den Betreuer — bei roter Gesamtlage oder
// Vorbehalt nur durch die Leitung, ein anderer Mensch (Vier-Augen).
//
// Server: server/routes/fiaon-finanzauswertung.ts · Regeln: shared/fiaon-finanzauswertung.ts
// Die Office-Akte ist dunkel (pi-*). Die Auswertung selbst schickt keine Ausweis-
// bilder an ein Modell — fehlt der automatischen Prüfung die Textschicht (Foto),
// bestätigt ein Mensch den Ausweis von Hand (Sichtprüfung, gebunden an genau diese
// Datei; „Bestätigung zurücknehmen“ macht eine Fehlbestätigung rückgängig).
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { SICHT_TYP_TEXT, FINANZWERT_KURZ, AMPEL_WORT, type SichtTyp, type Ampel } from "@shared/fiaon-finanzauswertung";
import { LINK_ART_TEXT, ANFRAGE_ABSTAND_MINUTEN, ANFRAGEN_JE_TAG, LINK_GUELTIG_TAGE } from "@shared/fiaon-unterlagen-anfrage";

type Melden = (art: "gut" | "schlecht" | "info", titel: string, text?: string) => void;

async function api(pfad: string, init?: RequestInit): Promise<{ ok: boolean; status: number; json: any }> {
  const r = await fetch(`/api/fiaon${pfad}`, { credentials: "include", headers: init?.body ? { "Content-Type": "application/json" } : undefined, ...init }).catch(() => null);
  const json = await r?.json().catch(() => null);
  return { ok: !!r?.ok && !!json?.ok, status: r?.status ?? 0, json };
}

const FARBE: Record<string, string> = { gruen: "#34d399", gelb: "#fbbf24", rot: "#f87171", offen: "#94a3b8" };
const zeit = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
const STATUS_TEXT: Record<string, string> = { laeuft: "wird erstellt", entwurf: "Entwurf — wartet auf Freigabe", freigegeben: "freigegeben, beim Kunden", ersetzt: "ersetzt (bleibt sichtbar)", verworfen: "verworfen", fehler: "gescheitert" };
const KANAL_TEXT: Record<string, string> = { gesendet: "gesendet", fehlgeschlagen: "nicht gesendet", abgelehnt: "abgelehnt", keine_adresse: "keine Adresse", aus: "—", fenster_zu: "Fenster zu", keine_nummer: "keine Nummer" };

function Zeile({ ok, titel, satz, children }: { ok: boolean | null; titel: string; satz: string; children?: ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "18px 1fr", gap: 8, padding: "7px 0", borderTop: "1px solid rgba(148,163,184,.14)" }}>
      <span aria-hidden="true" style={{ fontWeight: 700, color: ok === true ? "#34d399" : ok === false ? "#f87171" : "#94a3b8" }}>{ok === true ? "✓" : ok === false ? "✗" : "–"}</span>
      <div><b style={{ fontSize: 12.5 }}>{titel}</b><div style={{ fontSize: 12, opacity: .85 }}>{satz}</div>{children}</div>
    </div>
  );
}

export function FinanzauswertungAkte({ personId, melden, onNeu }: { personId: number; melden: Melden; onNeu?: () => void }) {
  const [d, setD] = useState<any | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [vorschau, setVorschau] = useState<number | null>(null);
  const [anfOffen, setAnfOffen] = useState(false);
  const [anfArten, setAnfArten] = useState<string[]>([]);
  const [anfKanaele, setAnfKanaele] = useState<string[]>(["mail"]);
  const [sicht, setSicht] = useState<SichtTyp | "">("");
  const [sichtOk, setSichtOk] = useState(false);

  const laden = useCallback(async () => {
    setLaedt(true);
    const r = await api(`/agent/kunden/${personId}/finanzauswertung`);
    setLaedt(false);
    if (r.ok) setD(r.json);
    else setD({ fehler: r.json?.error || "Nicht ladbar." });
  }, [personId]);
  useEffect(() => { void laden(); }, [laden]);
  // Läuft eine Auswertung, alle vier Sekunden nachsehen (höchstens drei Minuten).
  useEffect(() => {
    if (!d?.laeuft) return;
    let n = 0;
    const t = window.setInterval(() => { n++; if (n > 45) window.clearInterval(t); else void laden(); }, 4000);
    return () => window.clearInterval(t);
  }, [d?.laeuft, laden]);

  if (!d) return <p className="pi-sek-satz leise" style={{ marginTop: 14 }}>Lade die Finanz- und Bonitätsauswertung …</p>;
  if (d.fehler) return <p className="pi-sek-satz leise" style={{ marginTop: 14 }}>{d.fehler}</p>;
  const v = d.voraussetzungen;
  const fassungen: any[] = Array.isArray(d.fassungen) ? d.fassungen : [];
  const entwurf = fassungen.find((f) => f.status === "entwurf");
  const aktuell = fassungen.find((f) => f.status === "freigegeben");
  const leitung = d.rolle === "admin" || d.rolle === "vertriebsleiter";
  const anforderbar: string[] = v?.anforderbar ?? [];

  const erzeugen = async () => {
    setBusy("erzeugen");
    const r = await api(`/agent/kunden/${personId}/finanzauswertung`, { method: "POST", body: "{}" });
    setBusy(null);
    if (r.ok) { melden("gut", "Auswertung wird erstellt", r.json?.meldung); void laden(); }
    else melden("schlecht", "Nicht gestartet", r.json?.error || "Bitte erneut versuchen.");
  };
  const freigeben = async (f: any) => {
    if (!window.confirm(`${f.nummer} an den Kunden übergeben?\n\nDie Auswertung erscheint in seinem Bereich, er bekommt eine Mail (ohne Anhang, ohne Zahlen). Eine frühere Fassung bleibt als „ersetzt“ sichtbar.`)) return;
    setBusy(`frei-${f.id}`);
    const r = await api(`/agent/kunden/${personId}/finanzauswertung/${f.id}/freigeben`, { method: "POST", body: "{}" });
    setBusy(null);
    if (r.ok) { melden("gut", "Freigegeben", r.json?.meldung); void laden(); }
    else melden("schlecht", "Nicht freigegeben", r.json?.error || "Bitte erneut versuchen.");
  };
  const verwerfen = async (f: any) => {
    const grund = window.prompt(`${f.nummer} verwerfen — kurz begründen (steht im Verlauf):`);
    if (grund === null) return;
    setBusy(`weg-${f.id}`);
    const r = await api(`/agent/kunden/${personId}/finanzauswertung/${f.id}/verwerfen`, { method: "POST", body: JSON.stringify({ grund }) });
    setBusy(null);
    if (r.ok) { melden("gut", "Verworfen", r.json?.meldung); setVorschau(null); void laden(); }
    else melden("schlecht", "Nicht verworfen", r.json?.error || "Bitte erneut versuchen.");
  };
  const anfordern = async () => {
    if (!anfArten.length || !anfKanaele.length) return;
    const was = anfArten.map((a) => (LINK_ART_TEXT as any)[a]?.titel ?? a).join(" und ");
    if (!window.confirm(`${was} beim Kunden anfordern?\n\n${anfKanaele.includes("mail") ? "E-Mail" : ""}${anfKanaele.length === 2 ? " und " : ""}${anfKanaele.includes("whatsapp") ? "WhatsApp (nur wenn das 24-Stunden-Fenster offen ist)" : ""} mit Upload-Link ohne Anmeldung, ${LINK_GUELTIG_TAGE} Tage gültig.`)) return;
    setBusy("anfordern");
    const r = await api(`/agent/kunden/${personId}/unterlagen-anfordern`, { method: "POST", body: JSON.stringify({ arten: anfArten, kanaele: anfKanaele }) });
    setBusy(null);
    if (r.ok) { melden("gut", "Angefordert", r.json?.meldung); setAnfOffen(false); void laden(); }
    else melden(r.status === 422 ? "info" : "schlecht", "Nicht angefordert", r.json?.error || r.json?.meldung || "Bitte erneut versuchen.");
  };
  // Nachprüfung 08.10.: Der Link ging an eine falsche Adresse oder wurde weitergeleitet — sofort ungültig machen.
  const linkZurueckziehen = async () => {
    const grund = window.prompt("Upload-Link zurückziehen — kurz begründen (steht im Verlauf; der Kunde sieht „Dieser Link gilt nicht mehr“):");
    if (grund === null) return;
    setBusy("widerruf");
    const r = await api(`/agent/kunden/${personId}/unterlagen-link/widerrufen`, { method: "POST", body: JSON.stringify({ grund }) });
    setBusy(null);
    if (r.ok) { melden("gut", "Link zurückgezogen", r.json?.meldung); void laden(); }
    else melden("schlecht", "Nicht zurückgezogen", r.json?.error || "Bitte erneut versuchen.");
  };
  const sichtSpeichern = async () => {
    if (!sicht || !sichtOk) return;
    setBusy("sicht");
    const r = await api(`/agent/kunden/${personId}/ausweis-sichtpruefung`, { method: "POST", body: JSON.stringify({ dokumenttyp: sicht }) });
    setBusy(null);
    if (r.ok) { melden("gut", "Ausweis bestätigt", r.json?.meldung); setSicht(""); setSichtOk(false); void laden(); onNeu?.(); }
    else melden("schlecht", "Nicht gespeichert", r.json?.error || "Bitte erneut versuchen.");
  };
  // Nachprüfung 08.10.: Eine Fehlbestätigung zurücknehmen — der Ausweis gilt danach wieder als ungeprüft.
  const sichtZuruecknehmen = async () => {
    const grund = window.prompt("Bestätigung des Ausweises zurücknehmen — kurz begründen (steht im Verlauf). Ein offener Entwurf ist danach veraltet:");
    if (grund === null) return;
    setBusy("sicht-weg");
    const r = await api(`/agent/kunden/${personId}/ausweis-sichtpruefung/zuruecknehmen`, { method: "POST", body: JSON.stringify({ grund }) });
    setBusy(null);
    if (r.ok) { melden("gut", "Bestätigung zurückgenommen", r.json?.meldung); void laden(); onNeu?.(); }
    else melden("schlecht", "Nicht zurückgenommen", r.json?.error || "Bitte erneut versuchen.");
  };

  const kanalFenster = (k: string) => (anfKanaele.includes(k) ? anfKanaele.filter((x) => x !== k) : [...anfKanaele, k]);

  return (
    <div data-fa-akte style={{ marginTop: 14, border: "1px solid rgba(96,165,250,.35)", borderRadius: 12, padding: "12px 14px", background: "rgba(29,78,216,.06)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <b style={{ fontSize: 13.5 }}>FIAON Finanz- und Bonitätsauswertung</b>
          <div style={{ fontSize: 11.5, opacity: .7 }}>Im Paket enthalten · Ampel je Bereich, FIAON-Finanzwert, Plan und PDF für den Kunden</div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {anforderbar.length > 0 && (
            <button type="button" className="pi-knopf still klein" disabled={!!busy} onClick={() => { setAnfOffen((x) => !x); setAnfArten(anforderbar); }}>
              Beim Kunden anfordern
            </button>
          )}
          <button type="button" className="pi-knopf klein" disabled={!v?.bereit || !!busy || !!d.laeuft}
                  title={v?.bereit ? "Erzeugt einen Entwurf — der Kunde sieht ihn erst nach deiner Freigabe." : "Erst wenn Ausweis und Kontoauszug vollständig vorliegen."}
                  onClick={() => void erzeugen()}>
            {d.laeuft ? "Wird erstellt …" : busy === "erzeugen" ? "Startet …" : aktuell || entwurf ? "Neue Fassung erzeugen" : "Auswertung erzeugen"}
          </button>
        </div>
      </div>

      {/* Voraussetzungen */}
      <div style={{ marginTop: 8 }}>
        <Zeile ok={v?.ausweis?.ok ?? false} titel="Ausweis" satz={v?.ausweis?.satz ?? "—"}>
          {v?.ausweis?.quelle === "sicht" && (
            <button type="button" className="pi-knopf still klein" style={{ marginTop: 6 }} disabled={!!busy} onClick={() => void sichtZuruecknehmen()}>
              {busy === "sicht-weg" ? "Nimmt zurück …" : "Bestätigung zurücknehmen"}
            </button>
          )}
          {v && !v.ausweis.ok && d.ausweisVorhanden && (
            <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
              <div style={{ fontSize: 11.5, opacity: .75 }}>Öffne den Ausweis oben und bestätige von Hand (gilt nur für genau diese Datei, steht im Verlauf):</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                <select className="pi-eingabe" value={sicht} onChange={(e) => setSicht(e.target.value as SichtTyp)} style={{ maxWidth: 300 }} aria-label="Art des Ausweises">
                  <option value="">Art des Ausweises wählen …</option>
                  {(Object.keys(SICHT_TYP_TEXT) as SichtTyp[]).map((k) => <option key={k} value={k}>{SICHT_TYP_TEXT[k]}</option>)}
                </select>
                <label style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="checkbox" checked={sichtOk} onChange={(e) => setSichtOk(e.target.checked)} />
                  Name passt zur Akte, gültig, alles lesbar
                </label>
                <button type="button" className="pi-knopf still klein" disabled={!sicht || !sichtOk || busy === "sicht"} onClick={() => void sichtSpeichern()}>Ausweis bestätigen</button>
              </div>
            </div>
          )}
        </Zeile>
        <Zeile ok={v?.kontoauszug?.ok ?? false} titel="Kontoauszug" satz={v?.kontoauszug?.satz ?? "—"} />
        <Zeile ok={v?.auskunft?.ausgewertet ? true : null} titel="Bonitätsauskunft (freiwillig)" satz={v?.auskunft?.satz ?? "—"} />
      </div>

      {/* 4c: Anfordern mit einem Klick */}
      {anfOffen && (
        <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(148,163,184,.25)" }}>
          <b style={{ fontSize: 12.5 }}>Beim Kunden anfordern — Upload-Link ohne Anmeldung ({LINK_GUELTIG_TAGE} Tage, mehrfach nutzbar)</b>
          <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
            {anforderbar.map((a) => (
              <label key={a} style={{ fontSize: 12, display: "flex", gap: 6 }}>
                <input type="checkbox" checked={anfArten.includes(a)} onChange={() => setAnfArten((x) => (x.includes(a) ? x.filter((y) => y !== a) : [...x, a]))} />
                <span><b>{(LINK_ART_TEXT as any)[a]?.titel ?? a}:</b> „Bitte laden Sie {a === "ausweis" ? v?.ausweis?.bitte : v?.kontoauszug?.bitte} hoch.“</span>
              </label>
            ))}
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap", fontSize: 12 }}>
            <label style={{ display: "flex", gap: 6 }}><input type="checkbox" checked={anfKanaele.includes("mail")} onChange={() => setAnfKanaele(kanalFenster("mail"))} />E-Mail</label>
            <label style={{ display: "flex", gap: 6 }}><input type="checkbox" checked={anfKanaele.includes("whatsapp")} onChange={() => setAnfKanaele(kanalFenster("whatsapp"))} />WhatsApp (nur im offenen 24-Stunden-Fenster)</label>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" className="pi-knopf klein" disabled={!anfArten.length || !anfKanaele.length || busy === "anfordern"} onClick={() => void anfordern()}>{busy === "anfordern" ? "Sendet …" : "Jetzt anfordern"}</button>
            <span style={{ fontSize: 11, opacity: .65 }}>Höchstens {ANFRAGEN_JE_TAG} Anfragen je Kunde und Tag, mindestens {ANFRAGE_ABSTAND_MINUTEN} Minuten Abstand. Gekündigte und gesperrte Kunden bekommen keine.</span>
          </div>
        </div>
      )}
      {Array.isArray(d.anfragen) && d.anfragen.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 11.5, opacity: .8 }}>
          Zuletzt angefordert: {d.anfragen.slice(0, 3).map((a: any, i: number) => (
            <span key={i}>{i > 0 && " · "}{zeit(a.am)} ({(a.arten ?? []).map((x: string) => (LINK_ART_TEXT as any)[x]?.titel ?? x).join(", ")}) — Mail {KANAL_TEXT[a.mail] ?? a.mail ?? "—"}{a.adresse ? ` an ${a.adresse}` : ""}, WhatsApp {KANAL_TEXT[a.whatsapp] ?? a.whatsapp ?? "—"}{a.von ? `, von ${a.von}` : ""}</span>
          ))}
        </div>
      )}

      {Array.isArray(d.links) && d.links.length > 0 && (
        <div style={{ marginTop: 6, fontSize: 11.5, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ opacity: .8 }}>
            Upload-Link aktiv bis {zeit(d.links[0].gueltigBis)} ({(d.links[0].arten ?? []).map((x: string) => (LINK_ART_TEXT as any)[x]?.titel ?? x).join(", ")}) · {d.links[0].nutzungen}× genutzt{d.links.length > 1 ? ` · ${d.links.length} gültige Links` : ""}
          </span>
          <button type="button" className="pi-knopf still klein" disabled={!!busy} onClick={() => void linkZurueckziehen()}>{busy === "widerruf" ? "Zieht zurück …" : "Link zurückziehen"}</button>
        </div>
      )}

      {d.laeuft && <p className="pi-sek-satz leise" style={{ marginTop: 8 }}>Die Auswertung wird erstellt (Kontoauszug lesen, rechnen, Einordnung schreiben, PDF drucken) — ein bis zwei Minuten. Die Ansicht lädt von selbst nach.</p>}
      {d.veraltet && <p className="pi-sek-satz" style={{ marginTop: 8, color: "#fbbf24" }}>Seit der letzten Fassung sind neue Unterlagen oder eine neue Auswertung des Kontoauszugs da — die Fassung ist veraltet. „Neue Fassung erzeugen“.</p>}

      {/* Entwurf: Vorschau und Freigabe */}
      {entwurf && (() => {
        // Nachprüfung 08.10.: Ein veralteter Entwurf geht nicht an den Kunden (der Server lehnt ihn ebenso ab).
        const darfNicht = (entwurf.vierAugen && (!leitung || entwurf.erstelltVonId === d.ich)) || !!d.veraltet;
        return (
          <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(251,191,36,.35)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
              <b style={{ fontSize: 12.5 }}>Entwurf {entwurf.nummer} · {zeit(entwurf.erstelltAm)}{entwurf.erstelltVon ? ` · ${entwurf.erstelltVon}` : ""}</b>
              <span style={{ fontSize: 12 }}>
                Gesamt <b style={{ color: FARBE[entwurf.gesamt] ?? "inherit" }}>{AMPEL_WORT[entwurf.gesamt as Ampel] ?? entwurf.gesamt}</b> · FIAON-Finanzwert <b>{entwurf.finanzwert}</b> ({entwurf.band})
                {entwurf.vorbehalt ? " · mit Vorbehalt" : ""}{entwurf.texteQuelle === "regel" ? " · Einordnung mit festen Sätzen" : ""}
              </span>
            </div>
            <div style={{ fontSize: 11, opacity: .65, marginTop: 2 }}>{FINANZWERT_KURZ}</div>
            {entwurf.vierAugen && <div style={{ fontSize: 12, color: "#fbbf24", marginTop: 4 }}>Vier-Augen: {entwurf.vorbehalt ? "Vorbehalt" : "rote Gesamtlage"} — freigeben darf nur die Leitung, und nicht, wer die Auswertung erzeugt hat. Die Leitung hat dafür die Aufgabe „Vier-Augen: Auswertung {entwurf.nummer} freigeben“.</div>}
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              <button type="button" className="pi-knopf still klein" onClick={() => setVorschau((x) => (x === entwurf.id ? null : entwurf.id))}>{vorschau === entwurf.id ? "Vorschau schließen" : "Vorschau ansehen"}</button>
              <a className="pi-knopf still klein" href={`/api/fiaon/agent/kunden/${personId}/finanzauswertung/${entwurf.id}/pdf`} target="_blank" rel="noreferrer">PDF in neuem Fenster</a>
              <button type="button" className="pi-knopf klein" disabled={!!busy || darfNicht} title={d.veraltet ? "Veraltet: erst eine neue Fassung erzeugen" : darfNicht ? "Vier-Augen: Leitung, anderer Mensch" : "Erscheint im Bereich des Kunden, Mail ohne Anhang"} onClick={() => void freigeben(entwurf)}>
                {busy === `frei-${entwurf.id}` ? "Übergibt …" : "An den Kunden übergeben"}
              </button>
              <button type="button" className="pi-knopf still klein" disabled={!!busy} onClick={() => void verwerfen(entwurf)}>Verwerfen</button>
            </div>
            {vorschau === entwurf.id && (
              <iframe title={`Vorschau ${entwurf.nummer}`} src={`/api/fiaon/agent/kunden/${personId}/finanzauswertung/${entwurf.id}/pdf`}
                      style={{ width: "100%", height: 560, border: "1px solid rgba(148,163,184,.25)", borderRadius: 8, marginTop: 8, background: "#fff" }} />
            )}
          </div>
        );
      })()}

      {/* Fassungen */}
      {fassungen.length > 0 && (
        <details style={{ marginTop: 10 }} open={!entwurf && !!aktuell}>
          <summary className="pi-sek-satz" style={{ cursor: "pointer", fontWeight: 600 }}>Fassungen ({fassungen.length})</summary>
          <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
            {fassungen.map((f) => (
              <div key={f.id} style={{ fontSize: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
                <b>{f.nummer}</b>
                <span style={{ opacity: .8 }}>{STATUS_TEXT[f.status] ?? f.status} · {zeit(f.freigegebenAm ?? f.erstelltAm)}{f.freigegebenVon ? ` · ${f.freigegebenVon}` : ""}</span>
                {f.finanzwert != null && <span>Wert {f.finanzwert} · <span style={{ color: FARBE[f.gesamt] ?? "inherit" }}>{AMPEL_WORT[f.gesamt as Ampel] ?? f.gesamt}</span></span>}
                {f.status === "freigegeben" && <span style={{ opacity: .7 }}>{f.kundeGelesenAm ? `vom Kunden geöffnet ${zeit(f.kundeGelesenAm)}` : "vom Kunden noch nicht geöffnet"}{f.mailStatus ? ` · Mail ${f.mailStatus}` : ""}</span>}
                {f.fehler && <span style={{ color: "#f87171" }}>{f.fehler}</span>}
                {f.verworfenGrund && <span style={{ opacity: .7 }}>Grund: {f.verworfenGrund}</span>}
                {f.pdf && <a className="pi-link" href={`/api/fiaon/agent/kunden/${personId}/finanzauswertung/${f.id}/pdf`} target="_blank" rel="noreferrer">PDF</a>}
              </div>
            ))}
          </div>
        </details>
      )}
      {laedt && <span style={{ fontSize: 11, opacity: .5 }}> </span>}
    </div>
  );
}
