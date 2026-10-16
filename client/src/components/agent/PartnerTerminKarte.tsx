// ═══════════════════════════════════════════════════════════════════════════
// PARTNER-TERMIN IN DER AKTE (E-386, 16.10.2026) — die Qualifizierungsmaske des Kooperationsvertrags
//
// Der Mitarbeiter fragt im Gespräch, ob der Kunde ein kostenloses Gespräch zu Vorsorge und Absicherung möchte. Sagt er
// ja: Thema wählen (nur die Themen des Partners), den Einwilligungstext MIT dem Namen des Partners vorlesen, das Ja
// bestätigen, einen freien Termin in den Zeiten des Partners wählen, kurze Notiz — Speichern übermittelt sofort.
// Die Karte erscheint nur, wenn es einen angenommenen Kooperationsvertrag gibt. Gesperrte, Werbegesperrte und
// Global-Kunden sehen den Grund statt der Maske. FIAON empfiehlt nichts: Die Maske fragt nur das Thema.
// Regeln: shared/fiaon-koop-lieferung.ts · Server: server/lib/fiaon-koop-lieferung.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/pages/agent/shared";
import { koopEinwilligungText, koopTerminArtText, type KoopLieferStand } from "@shared/fiaon-koop-lieferung";
import "@/styles/office-koop.css";

type Melden = (art: "gut" | "schlecht" | "info", titel: string, text?: string) => void;
interface Slot { iso: string; tag: string; zeit: string; text: string }
interface Partner {
  angebotId: number; ref: string; name: string; stand: KoopLieferStand; zeitenText: string;
  themen: { thema: string; belegt: string | null }[]; arten: string[]; dauerMin: number; termine: Slot[];
  partnerFuerText: { anrede?: string; vorname?: string; nachname?: string; firma?: string };
  bereich: string; modell: "kontakt" | "abschluss" | "platz"; bereichName: string;
}
interface Lage {
  ok: boolean; error?: string;
  kandidat: { vorname: string; nachname: string; telefon: string | null; email: string | null; anschrift: string | null; sperren: string[]; bestaetigen: string[]; hinweise: string[] };
  partner: Partner[]; frage: string;
  einwilligungen: { id: number; art: string; kanal: string; thema: string | null; am: string; von: string | null; widerrufenAm: string | null }[];
  kontakte: { id: number; thema: string; terminText: string; art: string; statusText: string; status: string; partner: string; mailFehler: string | null; reklamation: string | null; keinKontakt: boolean; von: string | null }[];
}
const zeit = (iso: string) => new Date(iso).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const tagText = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "Europe/Berlin" });

export function PartnerTerminKarte({ personId, melden }: { personId: number; melden: Melden }) {
  const [lage, setLage] = useState<Lage | null>(null);
  const [offen, setOffen] = useState(false);
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [angebotId, setAngebotId] = useState<number | null>(null);
  const [thema, setThema] = useState("");
  const [ja, setJa] = useState(false);
  const [bestaetigt, setBestaetigt] = useState<string[]>([]);
  const [tag, setTag] = useState("");
  const [slot, setSlot] = useState("");
  const [art, setArt] = useState("");
  const [notiz, setNotiz] = useState("");

  const laden = useCallback(async () => {
    const r = await api(`/agent/kunden/${personId}/koop`);
    setLage(r.ok ? r.json : null);
    if (r.ok && r.json.partner?.length) setAngebotId((alt) => alt ?? r.json.partner[0].angebotId);
  }, [personId]);
  useEffect(() => { void laden(); }, [laden]);

  const p = useMemo(() => lage?.partner.find((x) => x.angebotId === angebotId) ?? null, [lage, angebotId]);
  const tage = useMemo(() => Array.from(new Set((p?.termine ?? []).map((s) => s.tag))), [p]);
  const zeiten = useMemo(() => (p?.termine ?? []).filter((s) => s.tag === tag), [p, tag]);
  useEffect(() => { setThema(""); setTag(""); setSlot(""); setArt(p?.arten[0] ?? ""); setJa(false); }, [angebotId, p?.arten]);
  useEffect(() => { setJa(false); }, [thema]);

  if (!lage || !lage.partner?.length) return null;
  const k = lage.kandidat;
  const aktiveEinwilligung = lage.einwilligungen.some((e) => !e.widerrufenAm && (e.art === "uebermittlung" || e.art === "interesse"));
  const gewuenscht = lage.einwilligungen.find((e) => e.art === "interesse" && !e.widerrufenAm && e.kanal === "kundenbereich");

  async function speichern() {
    if (!p) return;
    setLaeuft("speichern");
    const r = await api(`/agent/kunden/${personId}/koop/kontakt`, {
      method: "POST", body: JSON.stringify({ angebotId: p.angebotId, thema, termin: slot, art, notiz, einwilligung: ja, bestaetigt }),
    });
    setLaeuft(null);
    if (!r.ok) { melden("schlecht", "Nicht gespeichert", r.json?.error ?? "Bitte erneut versuchen."); await laden(); return; }
    melden("gut", "Partner-Termin festgehalten", r.json.meldung);
    setOffen(false); setNotiz(""); setThema(""); setSlot(""); setTag(""); setJa(false); setBestaetigt([]);
    await laden();
  }
  async function interesse(jaWert: boolean) {
    setLaeuft("interesse");
    const r = await api(`/agent/kunden/${personId}/koop/interesse`, { method: "POST", body: JSON.stringify({ ja: jaWert }) });
    setLaeuft(null);
    if (r.ok) melden("gut", "Vermerkt", r.json.meldung); else melden("schlecht", "Nicht gespeichert", r.json?.error);
    setOffen(false); await laden();
  }
  async function widerruf() {
    setLaeuft("widerruf");
    const r = await api(`/agent/kunden/${personId}/koop/widerruf`, { method: "POST", body: JSON.stringify({ grund: "Am Telefon widerrufen" }) });
    setLaeuft(null);
    if (r.ok) melden("gut", "Widerruf gespeichert", r.json.meldung); else melden("schlecht", "Nicht gespeichert", r.json?.error);
    await laden();
  }

  const bereit = !!p && !p.stand.sperre && !!thema && ja && !!slot && !!art && k.bestaetigen.every((b) => bestaetigt.includes(b));
  return (
    <section className="kp" data-fiaon="partner-termin">
      <div className="kp-kopf">
        <div><b>Partner-Termin</b><p>Ein Gespräch oder Angebot von einem Partner im FIAON-Netzwerk ({Array.from(new Set(lage.partner.map((x) => x.bereichName))).join(", ")}). Wir fragen nur das Thema — wir empfehlen nichts.</p></div>
        {!offen && !k.sperren.length && <button type="button" className="pi-knopf klein" onClick={() => setOffen(true)}>Termin festhalten</button>}
      </div>

      {k.sperren.length > 0 && <p className="kp-warn"><b>Kein Partner-Termin möglich</b>{k.sperren.join(" ")}</p>}
      {gewuenscht && !lage.kontakte.some((x) => x.status === "uebermittelt" || x.status === "geplant") && (
        <p className="kp-hinweis">Der Kunde hat am {zeit(gewuenscht.am)} im Kundenbereich ein Gespräch gewünscht — bitte Thema und Termin abstimmen.</p>
      )}
      {k.hinweise.map((h) => <p key={h} className="kp-hinweis">{h}</p>)}

      {lage.kontakte.length > 0 && (
        <ul className="kp-liste">
          {lage.kontakte.map((x) => (
            <li key={x.id}>
              <span><b>{x.thema}</b> · {x.terminText} · {x.art} · mit {x.partner}</span>
              <em className={x.status === "uebermittelt" ? "gut" : x.status === "storniert" ? "still" : "offen"}>{x.statusText}{x.mailFehler ? " — Mail hängt, wird wiederholt" : ""}{x.reklamation ? ` · ${x.reklamation}` : ""}{x.keinKontakt ? " · Partner: kein Kontakt mehr gewünscht" : ""}</em>
            </li>
          ))}
        </ul>
      )}

      {offen && !k.sperren.length && (
        <div className="kp-maske">
          {lage.partner.length > 1 && (
            <label className="kp-feld">Partner
              <select className="pi-eingabe" value={angebotId ?? ""} onChange={(e) => setAngebotId(Number(e.target.value))}>
                {lage.partner.map((x) => <option key={x.angebotId} value={x.angebotId}>{x.bereichName} · {x.name}</option>)}
              </select>
            </label>
          )}
          {p && (
            <p className="kp-stand">
              <b>{p.name}</b> · {p.zeitenText} · Woche {p.stand.woche.geliefert}/{p.stand.woche.wunsch}
              {p.stand.startRahmen ? ` · Start-Rahmen ${p.stand.startRahmen.geliefert}/${p.stand.startRahmen.deckel}` : ""}
              {p.stand.ersatzOffen ? ` · ${p.stand.ersatzOffen} Ersatz offen` : ""}
            </p>
          )}
          {p?.stand.sperre ? <p className="kp-warn"><b>Gerade kein neuer Kontakt</b>{p.stand.sperre}</p> : p && (
            <>
              <label className="kp-feld">1 · {p.modell === "platz" ? "Welches Gebiet betrifft das Anliegen?" : p.modell === "abschluss" ? "Welche Sparte?" : "Welches Thema wünscht der Kunde?"}
                <select className="pi-eingabe" value={thema} onChange={(e) => setThema(e.target.value)}>
                  <option value="">Bitte wählen</option>
                  {p.themen.map((t) => <option key={t.thema} value={t.thema} disabled={!!t.belegt}>{t.thema}{t.belegt ? ` — ${t.belegt}` : ""}</option>)}
                </select>
              </label>
              {thema && (
                <div className="kp-vorlesen">
                  <small>2 · Bitte wörtlich vorlesen</small>
                  <p>{koopEinwilligungText(p.partnerFuerText, thema, p.bereich)}</p>
                  <p><b>{lage.frage}</b></p>
                  <label className="kp-haken"><input type="checkbox" checked={ja} onChange={(e) => setJa(e.target.checked)} /> Ich habe den Text vorgelesen. Der Kunde hat ausdrücklich <b>Ja</b> gesagt.</label>
                  {k.bestaetigen.includes("wohnsitz_de") && <label className="kp-haken"><input type="checkbox" checked={bestaetigt.includes("wohnsitz_de")} onChange={(e) => setBestaetigt((b) => e.target.checked ? [...b, "wohnsitz_de"] : b.filter((x) => x !== "wohnsitz_de"))} /> Der Kunde wohnt in Deutschland.</label>}
                  {k.bestaetigen.includes("volljaehrig") && <label className="kp-haken"><input type="checkbox" checked={bestaetigt.includes("volljaehrig")} onChange={(e) => setBestaetigt((b) => e.target.checked ? [...b, "volljaehrig"] : b.filter((x) => x !== "volljaehrig"))} /> Der Kunde ist volljährig.</label>}
                </div>
              )}
              {thema && ja && (
                <>
                  <div className="kp-feld">3 · {p.modell === "abschluss" ? "Rückruf in den Zeiten des Partners" : "Termin in den Zeiten des Partners"}
                    {p.termine.length === 0 ? <p className="kp-hinweis">Keine freien Termine in den nächsten drei Wochen.</p> : (
                      <>
                        <div className="kp-tage">{tage.map((t) => <button key={t} type="button" className={`pi-knopf klein ${tag === t ? "" : "still"}`} onClick={() => { setTag(t); setSlot(""); }}>{tagText(t)}</button>)}</div>
                        {tag && <div className="kp-tage">{zeiten.map((s) => <button key={s.iso} type="button" className={`pi-knopf klein ${slot === s.iso ? "" : "still"}`} onClick={() => setSlot(s.iso)}>{s.zeit}</button>)}</div>}
                      </>
                    )}
                  </div>
                  <label className="kp-feld">Art des Gesprächs
                    <select className="pi-eingabe" value={art} onChange={(e) => setArt(e.target.value)}>
                      {p.arten.map((a) => <option key={a} value={a}>{koopTerminArtText(a)}</option>)}
                    </select>
                  </label>
                  <label className="kp-feld">4 · Kurze Notiz für den Partner (freiwillig)
                    <textarea className="pi-eingabe kp-notiz" rows={3} maxLength={600} value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="z. B. „zwei Kinder, möchte für beide etwas ansparen“" />
                    <small>{p.modell === "platz" ? "Kurz das Anliegen (z. B. Frist, Art des Schreibens) — nichts zu Gesundheit." : p.modell === "abschluss" ? "Verbrauch, Zählernummer, Tarifwunsch — nichts zu Gesundheit, Einkommen, Schulden oder Bonität." : "Nichts zu Gesundheit, Einkommen, Schulden oder Bonität — die Notiz geht an den Partner."}</small>
                  </label>
                  <p className="kp-stand">Geht an den Partner: {k.vorname} {k.nachname}{p.modell === "abschluss" ? `, ${k.anschrift ?? "— Anschrift fehlt in der Akte —"}` : ""}, {k.telefon}, {k.email}, Thema, Termin{notiz ? ", Notiz" : ""}. Der Kunde bekommt eine Bestätigung per E-Mail.</p>
                </>
              )}
              <div className="kp-tun">
                <button type="button" className="pi-knopf" disabled={!bereit || laeuft === "speichern"} onClick={() => void speichern()}>{laeuft === "speichern" ? "Übermittelt …" : "Speichern und übermitteln"}</button>
                <button type="button" className="pi-knopf still" onClick={() => setOffen(false)}>Abbrechen</button>
                <button type="button" className="pi-knopf still" disabled={!!laeuft} onClick={() => void interesse(false)}>Kunde hat kein Interesse</button>
              </div>
            </>
          )}
        </div>
      )}

      {aktiveEinwilligung && (
        <div className="kp-tun">
          <button type="button" className="pi-knopf warn klein" disabled={!!laeuft} onClick={() => void widerruf()}>{laeuft === "widerruf" ? "…" : "Kunde widerruft die Einwilligung"}</button>
          <span className="kp-fein">Geplante Übermittlungen werden zurückgenommen, der Partner erfährt es sofort.</span>
        </div>
      )}
    </section>
  );
}
