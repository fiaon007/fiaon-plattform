// ═══════════════════════════════════════════════════════════════════════════
// /unterlagen/:token — UNTERLAGEN HOCHLADEN OHNE ANMELDUNG (E-IT-D, 08.10.2026, 4c)
//
// Der Link kommt per Mail (oder im offenen WhatsApp-Fenster) aus der Akte:
// signiert, 14 Tage gültig, mehrfach nutzbar, NUR für die angeforderten
// Unterlagen. Die Seite zeigt nie Inhalte vorhandener Dokumente — nur, was
// vorliegt und was fehlt. Handy zuerst, hell, Felder ab 16 px (kein Zoom am
// iPhone), Kamera oder Dateiauswahl, mehrere Dateien je Unterlage.
// Hinzufügen statt Ersetzen: Was hochgeladen wird, legt der Server zu den
// vorhandenen Unterlagen (server/lib/fiaon-unterlagen-link.ts).
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef, useState } from "react";
import { useRoute } from "wouter";
import { FiaonWortmarke } from "@/components/marke/FiaonWortmarke";

interface Art { art: string; titel: string; anleitung: string; stand: "liegt_vor" | "fehlt" | "wird_geprueft" | "bitte_neu"; satz: string }
interface Lage { ok: boolean; vorname: string | null; gueltigBis: string; maxMb: number; maxDateien: number; maxGesamtMb?: number; arten: Art[]; error?: string; code?: string }

const STAND: Record<Art["stand"], { text: string; farbe: string; grund: string }> = {
  liegt_vor: { text: "Liegt vor", farbe: "#0F7A55", grund: "#E8F6EF" },
  fehlt: { text: "Fehlt noch", farbe: "#B42318", grund: "#FDECEC" },
  wird_geprueft: { text: "Wird geprüft", farbe: "#1D4ED8", grund: "#EAF1FD" },
  bitte_neu: { text: "Bitte ergänzen", farbe: "#8A500C", grund: "#FFF5E0" },
};

const s = {
  seite: { minHeight: "100vh", background: "#F5F7FB", color: "#22324A", fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif", padding: "0 16px 48px" } as const,
  innen: { maxWidth: 560, margin: "0 auto" } as const,
  karte: { background: "#fff", border: "1px solid #E1E8F2", borderRadius: 16, padding: 18, marginTop: 14 } as const,
  knopf: { display: "flex", alignItems: "center", justifyContent: "center", width: "100%", minHeight: 52, border: 0, borderRadius: 12, background: "#1D4ED8", color: "#fff", fontSize: 17, fontWeight: 600, cursor: "pointer", marginTop: 16 } as const,
  still: { color: "#5B6B82", fontSize: 14 } as const,
};

function Feld({ art, maxDateien, dateien, setDateien, gesperrt }: { art: Art; maxDateien: number; dateien: File[]; setDateien: (f: File[]) => void; gesperrt: boolean }) {
  const eingabe = useRef<HTMLInputElement>(null);
  const st = STAND[art.stand] ?? STAND.fehlt;
  return (
    <div style={s.karte}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <b style={{ fontSize: 18, color: "#0B1220" }}>{art.titel}</b>
        <span style={{ fontSize: 13, fontWeight: 600, color: st.farbe, background: st.grund, borderRadius: 99, padding: "4px 10px", whiteSpace: "nowrap" }}>{st.text}</span>
      </div>
      <p style={{ ...s.still, margin: "6px 0 0" }}>{art.satz}</p>
      <p style={{ fontSize: 15, margin: "10px 0 0" }}>{art.anleitung}</p>
      {dateien.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "grid", gap: 6 }}>
          {dateien.map((f, i) => (
            <li key={`${f.name}-${i}`} style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", fontSize: 15, background: "#F5F7FB", borderRadius: 10, padding: "8px 10px" }}>
              <span style={{ overflowWrap: "anywhere" }}>{f.name} <span style={s.still}>({Math.max(1, Math.round(f.size / 1024))} KB)</span></span>
              <button type="button" disabled={gesperrt} onClick={() => setDateien(dateien.filter((_, j) => j !== i))} aria-label={`${f.name} entfernen`}
                style={{ border: 0, background: "none", color: "#B42318", fontSize: 15, cursor: "pointer", padding: "4px 6px" }}>Entfernen</button>
            </li>
          ))}
        </ul>
      )}
      <input ref={eingabe} type="file" multiple hidden accept="application/pdf,image/jpeg,image/png"
        onChange={(e) => {
          const neu = Array.from(e.target.files ?? []);
          e.target.value = "";
          setDateien([...dateien, ...neu].slice(0, maxDateien));
        }} />
      <button type="button" disabled={gesperrt || dateien.length >= maxDateien} onClick={() => eingabe.current?.click()}
        style={{ ...s.knopf, background: "#fff", color: "#1D4ED8", border: "1px solid #C9D5E5", marginTop: 12, minHeight: 48, fontSize: 16 }}>
        {dateien.length ? "Weitere Datei hinzufügen" : "Datei oder Foto wählen"}
      </button>
    </div>
  );
}

export default function UnterlagenLinkPage() {
  const [, params] = useRoute("/unterlagen/:token");
  const token = params?.token ?? "";
  const [lage, setLage] = useState<Lage | null>(null);
  const [fehler, setFehler] = useState<{ text: string; code?: string } | null>(null);
  const [dateien, setDateien] = useState<Record<string, File[]>>({});
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ text: string; gut: boolean } | null>(null);
  const [neuGesendet, setNeuGesendet] = useState<string | null>(null);

  const laden = useCallback(async () => {
    const r = await fetch(`/api/fiaon/unterlagen/${encodeURIComponent(token)}`).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (j?.ok) { setLage(j); setFehler(null); } else setFehler({ text: j?.error || "Die Seite lässt sich gerade nicht laden.", code: j?.code });
  }, [token]);
  useEffect(() => {
    document.title = "Unterlagen hochladen · FIAON";
    const robots = document.createElement("meta"); robots.name = "robots"; robots.content = "noindex"; document.head.appendChild(robots);
    void laden();
    return () => { robots.remove(); };
  }, [laden]);

  const gewaehlt = Object.values(dateien).reduce((n, l) => n + l.length, 0);
  const hochladen = async () => {
    if (!gewaehlt || !lage) return;
    // Obergrenze je Sendung (Server: 413) — vorher sagen, statt 100 MB umsonst zu schicken.
    const bytes = Object.values(dateien).reduce((n, l) => n + l.reduce((m, f) => m + f.size, 0), 0);
    if (lage.maxGesamtMb && bytes > lage.maxGesamtMb * 1024 * 1024) {
      setMeldung({ text: `Das sind zusammen mehr als ${lage.maxGesamtMb} MB. Bitte laden Sie die Dateien in mehreren Schritten hoch — oder nur die Seiten, die noch fehlen.`, gut: false });
      return;
    }
    setLaeuft(true); setMeldung(null);
    const fd = new FormData();
    for (const a of lage.arten) for (const f of dateien[a.art] ?? []) fd.append(a.art, f, f.name);
    const r = await fetch(`/api/fiaon/unterlagen/${encodeURIComponent(token)}/hochladen`, { method: "POST", body: fd }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setLaeuft(false);
    if (j?.arten) setLage({ ...lage, arten: j.arten });
    // Angenommene Arten aus der Auswahl nehmen — auch beim Teilfehler, sonst hinge der zweite
    // Versuch den schon angenommenen Ausweis noch einmal an (Gegenprüfung 08.10.).
    if (Array.isArray(j?.ergebnisse)) {
      setDateien((d) => { const n = { ...d }; for (const e of j.ergebnisse) if (e?.ok) delete n[e.art]; return n; });
    }
    if (j?.ok) { setDateien({}); setMeldung({ text: j.meldung || "Vielen Dank — Ihre Unterlagen sind angekommen.", gut: true }); }
    else if (Array.isArray(j?.ergebnisse) && j.ergebnisse.some((e: any) => e?.ok)) {
      setMeldung({ text: `${j.ergebnisse.filter((e: any) => e?.ok).map((e: any) => e.meldung).join(" ")} ${j.error || ""}`.trim(), gut: false });
    }
    else setMeldung({ text: j?.error || "Das Hochladen hat nicht geklappt. Bitte versuchen Sie es noch einmal.", gut: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const neuAnfordern = async () => {
    const r = await fetch(`/api/fiaon/unterlagen/${encodeURIComponent(token)}/neu`, { method: "POST" }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setNeuGesendet(j?.meldung || j?.error || "Bitte versuchen Sie es später noch einmal.");
  };

  return (
    <main style={s.seite}>
      <div style={s.innen}>
        <header style={{ padding: "22px 0 4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ height: 22, display: "inline-block", color: "#0B1220" }}><FiaonWortmarke dekorativ /></span>
          <span style={{ ...s.still, fontSize: 13 }}>Sicherer Upload</span>
        </header>

        {!lage && !fehler && <p style={{ ...s.still, marginTop: 30 }}>Wird geladen …</p>}

        {fehler && (
          <div style={s.karte}>
            <b style={{ fontSize: 18 }}>{fehler.code === "abgelaufen" ? "Dieser Link ist abgelaufen" : fehler.code === "widerrufen" ? "Dieser Link gilt nicht mehr" : "Dieser Link funktioniert nicht"}</b>
            <p style={{ fontSize: 15, marginTop: 8 }}>{fehler.text}</p>
            {fehler.code === "abgelaufen" && !neuGesendet && <button type="button" style={s.knopf} onClick={() => void neuAnfordern()}>Neuen Link anfordern</button>}
            {neuGesendet && <p style={{ fontSize: 15, marginTop: 12, color: "#0F7A55" }}>{neuGesendet}</p>}
          </div>
        )}

        {lage && (
          <>
            <h1 style={{ fontSize: 26, fontWeight: 400, lineHeight: 1.25, margin: "18px 0 0", color: "#0B1220" }}>
              Guten Tag{lage.vorname ? ` ${lage.vorname}` : ""},<br />bitte laden Sie hier Ihre Unterlagen hoch.
            </h1>
            <p style={{ fontSize: 15, marginTop: 10 }}>Ohne Anmeldung, als PDF oder Foto. Gut lesbar, alle vier Ecken im Bild. Was Sie hochladen, legen wir zu Ihren bisherigen Unterlagen.</p>
            <p style={s.still}>Dieser Link gilt bis {new Date(lage.gueltigBis).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" })} und lässt sich mehrfach nutzen. Bis zu {lage.maxDateien} Dateien je Unterlage, je Datei höchstens {lage.maxMb} MB.</p>

            {meldung && (
              <div role="status" style={{ ...s.karte, background: meldung.gut ? "#E8F6EF" : "#FDECEC", borderColor: meldung.gut ? "#BFE6D2" : "#F5C2C2" }}>
                <p style={{ margin: 0, fontSize: 15, color: meldung.gut ? "#0F5A40" : "#8F1D16" }}>{meldung.text}</p>
              </div>
            )}

            {lage.arten.map((a) => (
              <Feld key={a.art} art={a} maxDateien={lage.maxDateien} dateien={dateien[a.art] ?? []} gesperrt={laeuft}
                setDateien={(l) => setDateien((d) => ({ ...d, [a.art]: l }))} />
            ))}

            <button type="button" style={{ ...s.knopf, opacity: gewaehlt && !laeuft ? 1 : 0.45 }} disabled={!gewaehlt || laeuft} onClick={() => void hochladen()}>
              {laeuft ? "Wird hochgeladen …" : gewaehlt ? `${gewaehlt} Datei${gewaehlt === 1 ? "" : "en"} hochladen` : "Bitte zuerst Dateien wählen"}
            </button>
            <p style={{ ...s.still, marginTop: 18, fontSize: 13 }}>
              Ihre Unterlagen werden verschlüsselt übertragen und nur für Ihre Akte bei FIAON verwendet. Fragen? Antworten Sie einfach auf die E-Mail, mit der Sie diesen Link bekommen haben.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
