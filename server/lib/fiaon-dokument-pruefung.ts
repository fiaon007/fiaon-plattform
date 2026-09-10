// ═══════════════════════════════════════════════════════════════════════════
// AUTOMATISCHE DOKUMENTPRÜFUNG BEIM UPLOAD (01.09.2026, Team-Feedback P9)
//
// DER BEFUND: Ein Kunde lädt die falsche SCHUFA-Auskunft, einen halben
// Kontoauszug oder ein beliebiges PDF als „Ausweis" hoch — und niemand merkt
// es, bis die Verwaltung Tage später von Hand prüft. Dafür musste eigens die
// Lösch-Funktion (P12 vom 27.08.) gebaut werden.
//
// WAS DIESES MODUL TUT — ZWEI SCHEIBEN:
//   Scheibe 1 (sofort, ohne KI): Stichwortprofil auf der PDF-Textschicht je
//     Dokumentart + Zeitraum-Erkennung beim Kontoauszug. Läuft SYNCHRON mit
//     hartem Timeout in der Upload-Antwort — der Kunde erfährt SOFORT, wenn
//     etwas nicht passt.
//   Scheibe 2 (nachgelagert, KI): Der Text geht an das Analyse-Modell
//     (gleiche Anbindung wie die Kontoauszug-Analyse) und verfeinert das
//     Urteil. Fire-and-forget — ein KI-Ausfall ändert nichts am Upload.
//
// DREI EHRLICHKEITS-REGELN:
//   · Ein Foto-PDF hat keine Textschicht — das Urteil ist dann „nicht
//     prüfbar", NIEMALS „falsches Dokument". Sonst weisen wir zahlende
//     Kunden mit echten Ausweisfotos ab.
//   · Die Prüfung setzt NIE kyc_status oder weist zurück — sie meldet nur.
//     Die Entscheidung bleibt bei der Verwaltung.
//   · Sie darf den Upload nie scheitern lassen: jeder Fehler wird geschluckt
//     und protokolliert.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import { pdfSeiten, pdfTextJeSeite, pdfTextBrauchbar } from "./fiaon-pdf-lesen";

export type DokumentArt = "kontoauszug" | "ausweis" | "schufa";

export interface DokumentUrteil {
  art: DokumentArt;
  /** Konnte die Textschicht überhaupt gelesen werden? */
  pruefbar: boolean;
  /** Sieht es nach der richtigen Dokumentart aus? NULL = nicht prüfbar. */
  erkannt: boolean | null;
  /** Vollständig nach den Regeln der Art? NULL = nicht beurteilbar. */
  vollstaendig: boolean | null;
  fehlt: string[];
  seiten: number;
  zeitraumVon?: string | null;
  zeitraumBis?: string | null;
  /** Satz für den Kunden, Sie-Form. NULL = nichts zu melden. */
  hinweisKunde: string | null;
  /** Kurzzeile für die Verwaltung/Mitarbeiter. */
  hinweisIntern: string | null;
  quelle: "heuristik" | "ki";
}

let tabelleBereit: Promise<void> | null = null;
function ensureTabelle(): Promise<void> {
  if (!tabelleBereit) {
    tabelleBereit = (async () => {
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_dokument_pruefungen (
          id SERIAL PRIMARY KEY,
          ref TEXT NOT NULL,
          art TEXT NOT NULL,
          urteil JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (ref, art)
        )`;
    })().catch((e) => { tabelleBereit = null; throw e; });
  }
  return tabelleBereit;
}

// ── Die Stichwortprofile — bewusst konservativ ──────────────────────────────
// Zwei Treffer machen ein „erkannt". EIN Wort kann Zufall sein („Saldo" steht
// auch auf einer Rechnung); zwei aus dem Profil sind es praktisch nie.
const PROFILE: Record<DokumentArt, { woerter: string[]; label: string }> = {
  kontoauszug: { label: "Kontoauszug", woerter: ["kontoauszug", "iban", "buchungstag", "wertstellung", "saldo", "kontostand", "umsatzanzeige", "buchungen"] },
  ausweis: { label: "Ausweisdokument", woerter: ["personalausweis", "identity card", "reisepass", "passport", "identitätskarte", "aufenthaltstitel", "carte d'identit"] },
  schufa: { label: "Bonitätsauskunft", woerter: ["schufa", "bonitätsauskunft", "datenkopie", "auskunft nach art. 15", "basisscore", "ksv1870", "crif", "score"] },
};

function datumsSpanne(text: string): { von: Date | null; bis: Date | null } {
  const treffer = text.match(/\b([0-3]?\d)\.([01]?\d)\.(20\d\d)\b/g) || [];
  let von: Date | null = null; let bis: Date | null = null;
  const jetzt = Date.now();
  for (const t of treffer) {
    const [tag, monat, jahr] = t.split(".").map(Number);
    const d = new Date(Date.UTC(jahr, monat - 1, tag));
    if (Number.isNaN(d.getTime()) || d.getTime() > jetzt + 86_400_000) continue;
    // Daten vor 2020 sind fast immer Geburts- oder Vertragsdaten, kein Umsatz.
    if (jahr < 2020) continue;
    if (!von || d < von) von = d;
    if (!bis || d > bis) bis = d;
  }
  return { von, bis };
}

/** Scheibe 1: das Heuristik-Urteil — schnell, deterministisch, ehrlich. */
export async function dokumentPruefen(art: DokumentArt, pdf: Buffer): Promise<DokumentUrteil> {
  const profil = PROFILE[art];
  const basis: DokumentUrteil = {
    art, pruefbar: false, erkannt: null, vollstaendig: null, fehlt: [],
    seiten: 0, hinweisKunde: null, hinweisIntern: null, quelle: "heuristik",
  };
  try {
    basis.seiten = await pdfSeiten(pdf).catch(() => 0);
    const seitenTexte = await pdfTextJeSeite(pdf);
    const text = seitenTexte.join("\n");
    if (!pdfTextBrauchbar(text)) {
      // Foto-PDF: die einzige Textschicht ist unsere eigene Fußzeile.
      basis.hinweisIntern = `${profil.label}: Foto ohne Textschicht — automatisch nicht prüfbar, bitte von Hand ansehen.`;
      return basis;
    }
    basis.pruefbar = true;
    const klein = text.toLowerCase();
    const trefferzahl = profil.woerter.filter((w) => klein.includes(w)).length;
    basis.erkannt = trefferzahl >= 2 || (trefferzahl >= 1 && basis.seiten >= 2);

    if (!basis.erkannt) {
      // Sieht es stattdessen wie eine ANDERE unserer Arten aus? Dann ist die
      // Meldung präziser („Sie haben vermutlich den Kontoauszug gewählt").
      const andere = (Object.keys(PROFILE) as DokumentArt[])
        .filter((a) => a !== art)
        .find((a) => PROFILE[a].woerter.filter((w) => klein.includes(w)).length >= 2);
      basis.vollstaendig = false;
      basis.fehlt = [`Das Dokument sieht nicht wie ${profil.label === "Ausweisdokument" ? "ein" : "eine"} ${profil.label} aus`];
      basis.hinweisKunde = andere
        ? `Diese Datei sieht wie ${PROFILE[andere].label === "Ausweisdokument" ? "ein Ausweisdokument" : `eine ${PROFILE[andere].label}`} aus — hochgeladen wurde sie aber als ${profil.label}. Bitte prüfen Sie die Auswahl und laden Sie die richtige Datei hoch.`
        : `Diese Datei konnten wir nicht als ${profil.label} erkennen. Bitte prüfen Sie, ob Sie die richtige Datei gewählt haben.`;
      basis.hinweisIntern = `${profil.label}: NICHT erkannt${andere ? ` (sieht aus wie ${PROFILE[andere].label})` : ""} — bitte prüfen.`;
      return basis;
    }

    if (art === "kontoauszug") {
      const { von, bis } = datumsSpanne(text);
      basis.zeitraumVon = von ? von.toISOString().slice(0, 10) : null;
      basis.zeitraumBis = bis ? bis.toISOString().slice(0, 10) : null;
      const tage = von && bis ? Math.round((bis.getTime() - von.getTime()) / 86_400_000) : 0;
      // Verlangt sind die letzten drei Monate (Portal-Text) — 75 Tage Spanne
      // lassen Puffer für Monatsanfang/-ende, ohne Halbes durchzuwinken.
      if (tage >= 75) {
        basis.vollstaendig = true;
        basis.hinweisIntern = `Kontoauszug erkannt, Zeitraum ${basis.zeitraumVon} bis ${basis.zeitraumBis} (${basis.seiten} Seiten).`;
      } else {
        basis.vollstaendig = false;
        basis.fehlt = [tage > 0 ? `Der Auszug deckt nur rund ${Math.max(1, Math.round(tage / 30))} Monat(e) ab — benötigt sind die letzten drei Monate` : "Der Zeitraum ließ sich nicht erkennen"];
        basis.hinweisKunde = tage > 0
          ? `Ihr Kontoauszug ist angekommen, deckt aber nur etwa ${Math.max(1, Math.round(tage / 30))} Monat(e) ab. Für die Analyse benötigen wir die letzten drei Monate — bitte laden Sie den vollständigen Zeitraum nach.`
          : null;
        basis.hinweisIntern = `Kontoauszug erkannt, aber Zeitraum ${tage > 0 ? `nur ~${tage} Tage` : "unklar"} — drei Monate sind verlangt.`;
      }
    } else if (art === "ausweis") {
      // 07.09.2026 (Daniel, Feedback 4): „Dokument nicht vollständig. Bitte laden Sie die
      // Rückseite hoch." — aber nur, wenn wir es WISSEN. Ein Reisepass hat eine Datenseite
      // (maschinenlesbare Zone), da fehlt nichts. Beim Personalausweis verrät die Textschicht
      // die Seite: vorn stehen Name/Geburtstag/gültig bis, hinten Anschrift/Ausstellungs-
      // behörde/Zugangsnummer. Nur vorn ohne hinten → Rückseite fehlt. Foto-PDFs ohne Text
      // kommen hier gar nicht an (oben „nicht prüfbar").
      const mrz = text.includes("<<");
      const pass = /reisepass|passport/.test(klein);
      const vorne = ["personalausweis", "identity card", "geburtstag", "gültig bis", "staatsangehörigkeit", "nationality"].filter((w) => klein.includes(w)).length;
      const hinten = ["anschrift", "ausstellungsbehörde", "zugangsnummer", "authority", "address", "ausstellungsdatum", "augenfarbe", "körpergröße"].filter((w) => klein.includes(w)).length;
      if (pass || mrz) {
        basis.vollstaendig = true;
        basis.hinweisIntern = `Ausweisdokument erkannt (${pass ? "Reisepass" : "maschinenlesbare Zone"}, ${basis.seiten} Seite${basis.seiten === 1 ? "" : "n"}).`;
      } else if (vorne >= 2 && hinten === 0) {
        basis.vollstaendig = false;
        basis.fehlt = ["Rückseite des Personalausweises fehlt"];
        basis.hinweisKunde = "Dokument nicht vollständig. Bitte laden Sie auch die Rückseite Ihres Personalausweises hoch.";
        basis.hinweisIntern = `Personalausweis: nur die Vorderseite erkannt (${basis.seiten} Seite${basis.seiten === 1 ? "" : "n"}) — Rückseite fehlt.`;
      } else if (vorne >= 1 && hinten >= 1) {
        basis.vollstaendig = true;
        basis.hinweisIntern = `Personalausweis erkannt, Vorder- und Rückseite (${basis.seiten} Seite${basis.seiten === 1 ? "" : "n"}).`;
      } else {
        basis.vollstaendig = basis.seiten >= 2 ? true : null;
        basis.hinweisIntern = `Ausweisdokument erkannt (${basis.seiten} Seite${basis.seiten === 1 ? "" : "n"}) — Seiten nicht sicher zuzuordnen, bitte von Hand ansehen.`;
        if (basis.seiten < 2) {
          basis.fehlt = ["Möglicherweise fehlt die Rückseite"];
          basis.hinweisKunde = "Ihr Ausweis ist angekommen. Falls die Rückseite auf einer eigenen Seite ist, laden Sie bitte beide Seiten hoch.";
        }
      }
    } else {
      basis.vollstaendig = basis.seiten >= 2 ? true : null;
      basis.hinweisIntern = `Bonitätsauskunft erkannt (${basis.seiten} Seiten).`;
      // 07.09.2026 (Justin zu einer KSV-Auskunft: „Wenn wir den ganzen Bericht haben, dann
      // richtig"): SCHUFA, KSV1870 und CRIF nummerieren ihre Seiten („Seite 2 von 7", „Page 2
      // of 7"). Steht eine höhere Gesamtzahl im Text, als die Datei Seiten hat, fehlt etwas.
      const nummern = [...klein.matchAll(/(?:seite|page)\s+(\d{1,3})\s+(?:von|of|\/)\s+(\d{1,3})/g)].map((m) => Number(m[2])).filter((n) => n > 0 && n < 400);
      const gesamt = nummern.length ? Math.max(...nummern) : 0;
      const quelle = /ksv1870|kreditschutzverband/.test(klein) ? "KSV-Auskunft" : /crif/.test(klein) ? "CRIF-Auskunft" : "Auskunft";
      if (gesamt > basis.seiten) {
        basis.vollstaendig = false;
        basis.fehlt = [`${quelle}: laut Seitenzählung ${gesamt} Seiten, in der Datei sind ${basis.seiten}`];
        basis.hinweisKunde = `Ihre ${quelle} ist angekommen, aber nicht vollständig: Der Bericht hat ${gesamt} Seiten, in Ihrer Datei sind ${basis.seiten}. Bitte laden Sie den ganzen Bericht hoch.`;
        basis.hinweisIntern = `${quelle} erkannt, aber unvollständig: ${basis.seiten} von ${gesamt} Seiten.`;
      } else if (basis.seiten === 1) {
        basis.fehlt = ["Eine vollständige Auskunft hat meist mehrere Seiten"];
        basis.hinweisKunde = `Ihre ${quelle} ist angekommen, umfasst aber nur eine Seite. Bitte prüfen Sie, ob alle Seiten der Auskunft in der Datei sind.`;
      } else {
        basis.vollstaendig = true;
        basis.hinweisIntern = `${quelle} erkannt, ${basis.seiten} Seiten${gesamt ? ` (Seitenzählung bis ${gesamt} passt)` : ""}.`;
      }
    }
    return basis;
  } catch (e) {
    console.error("[DOK-PRUEFUNG] Heuristik:", String(e).slice(0, 200));
    basis.hinweisIntern = `${profil.label}: Prüfung fehlgeschlagen — bitte von Hand ansehen.`;
    return basis;
  }
}

export async function urteilSpeichern(ref: string, urteil: DokumentUrteil): Promise<void> {
  await ensureTabelle();
  // ─────────────────────────────────────────────────────────────────────────
  // 02.09.2026 — WARUM HIER KEIN JSON.stringify MEHR STEHT
  //
  // Florentine fragte am 02.09.: „Wie war das, uns wird angezeigt wenn ein
  // Dokument nicht richtig/vollständig ist?" Die Anzeige ist gebaut — aber sie
  // hat nie etwas gezeigt, und zwar wegen dieser einen Zeile.
  //
  // `${JSON.stringify(urteil)}::jsonb` verpackt doppelt: postgres.js kodiert
  // den übergebenen Text noch einmal als JSON, der Cast wirkt dann auf das
  // bereits verpackte Ergebnis. In der Tabelle stand deshalb ein JSON-STRING
  // statt eines Objekts — nachgemessen am 02.09.: `jsonb_typeof(urteil)` ist
  // bei allen drei vorhandenen Zeilen 'string'. Jeder Feldzugriff lief damit
  // ins Leere, und die Anzeige blieb stumm, obwohl das Urteil dastand.
  //
  // Das Objekt direkt übergeben ist der richtige Weg — `sqlPool.json` sagt dem
  // Treiber ausdrücklich, dass hier ein JSON-Wert steht.
  // ─────────────────────────────────────────────────────────────────────────
  await sqlPool`
    INSERT INTO fiaon_dokument_pruefungen (ref, art, urteil)
    VALUES (${ref}, ${urteil.art}, ${sqlPool.json(urteil as any)})
    ON CONFLICT (ref, art) DO UPDATE SET urteil = EXCLUDED.urteil, updated_at = NOW()
  `;
}

/** Eine Zeile, die noch in der alten, doppelt verpackten Form liegt, lesbar machen. */
function urteilEntpacken(wert: any): DokumentUrteil | null {
  if (!wert) return null;
  if (typeof wert === "string") {
    try { return JSON.parse(wert) as DokumentUrteil; } catch { return null; }
  }
  return wert as DokumentUrteil;
}

export async function urteileLesen(refs: string[]): Promise<Record<string, DokumentUrteil>> {
  if (!refs.length) return {};
  await ensureTabelle();
  const rows = (await sqlPool`
    SELECT ref, art, urteil FROM fiaon_dokument_pruefungen WHERE ref = ANY(${refs})
  `) as any[];
  const aus: Record<string, DokumentUrteil> = {};
  for (const r of rows) {
    // Die Zeilen vom 01./02.09. liegen noch doppelt verpackt vor. Sie beim
    // Lesen zu entpacken ist billiger, als sie neu prüfen zu lassen.
    const u = urteilEntpacken(r.urteil);
    if (u) aus[String(r.art)] = u;
  }
  return aus;
}

/**
 * Der eine Einstieg für beide Upload-Wege: Heuristik synchron (mit Timeout),
 * Speichern + KI-Verfeinerung nachgelagert. Gibt das Heuristik-Urteil zurück
 * oder null, wenn nichts rechtzeitig fertig wurde.
 */
export async function pruefungAnstossen(
  ref: string, art: DokumentArt, pdf: Buffer, timeoutMs = 4000,
): Promise<DokumentUrteil | null> {
  try {
    const urteil = await Promise.race([
      dokumentPruefen(art, pdf),
      new Promise<null>((loese) => setTimeout(() => loese(null), timeoutMs)),
    ]);
    if (urteil) {
      void urteilSpeichern(ref, urteil).catch((e) => console.error("[DOK-PRUEFUNG] speichern:", e?.message));
      // Scheibe 2 — nur wo sie etwas beitragen kann: Der Kontoauszug hat seine
      // eigene, reichere KI-Analyse (fiaon-kontoauszug-analyse); doppelt
      // bezahlen wäre Verschwendung.
      if (art !== "kontoauszug" && urteil.pruefbar) {
        void kiVerfeinern(ref, art, pdf, urteil).catch((e) => console.error("[DOK-PRUEFUNG] KI:", e?.message));
      }
      return urteil;
    }
    // Timeout: die Prüfung läuft im Hintergrund zu Ende und speichert selbst.
    void dokumentPruefen(art, pdf)
      .then((u) => urteilSpeichern(ref, u))
      .catch((e) => console.error("[DOK-PRUEFUNG] nachlauf:", e?.message));
    return null;
  } catch (e) {
    console.error("[DOK-PRUEFUNG] anstossen:", String(e).slice(0, 200));
    return null;
  }
}

// ── Scheibe 2: das KI-Urteil (Ausweis + Bonitätsauskunft) ───────────────────
async function kiVerfeinern(ref: string, art: DokumentArt, pdf: Buffer, vorher: DokumentUrteil): Promise<void> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return;
  const modell = process.env.FIAON_ANALYSE_MODELL || "gpt-4.1-mini";
  const seiten = await pdfTextJeSeite(pdf);
  const text = seiten.join("\n").slice(0, 60_000);
  if (!pdfTextBrauchbar(text)) return;
  const frage = art === "ausweis"
    ? "Ist das ein gültiges Ausweisdokument (Personalausweis/Reisepass)? Sind Vorder- und Rückseite bzw. alle nötigen Angaben (Name, Geburtsdatum, Gültigkeit) enthalten und lesbar?"
    // ── NUR NOCH DIE ART, NICHT DIE VOLLSTAENDIGKEIT (10.09.2026, E-175) ──
    // Hier stand zusaetzlich „Wirken alle Seiten/Abschnitte vollstaendig
    // (Stammdaten, Einträge, ggf. Score)?". Das Modell sieht 60.000 Zeichen —
    // bei Dirk Ladewigs 38 Seiten ein Bruchteil — und antwortete
    // pflichtschuldig „unvollstaendig, es fehlen Stammdaten und Score". Der
    // Mitarbeiter sah eine gelbe Warnung an einer vollstaendigen Auskunft.
    // Ob Seiten fehlen, weiss die Heuristik: Sie zaehlt die Seiten der Datei
    // gegen die Seitennummerierung im Bericht selbst („Seite 2 von 7").
    : "Ist das eine Bonitätsauskunft (SCHUFA/KSV1870/CRIF, z. B. Datenkopie nach Art. 15 DSGVO)?";
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modell, temperature: 0, max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `Du prüfst ein hochgeladenes Dokument für eine Bonitätsplattform. ${frage} Antworte NUR als JSON: {"erkannt": bool, "vollstaendig": bool, "fehlt": ["…"], "hinweis_kunde": "ein Satz in Sie-Form oder leer"}. Bei einer Bonitätsauskunft zählt nur "erkannt" — du siehst nur den Anfang des Dokuments und kannst Vollständigkeit nicht beurteilen. Keine Namen oder Daten aus dem Dokument in den Hinweis übernehmen.` },
        { role: "user", content: `DOKUMENTTEXT:\n${text}` },
      ],
    }),
  });
  const j: any = await r.json().catch(() => null);
  if (!r.ok) { console.error("[DOK-PRUEFUNG] KI", r.status, j?.error?.message); return; }
  let b: any = null; try { b = JSON.parse(String(j?.choices?.[0]?.message?.content || "{}")); } catch { return; }
  if (typeof b?.erkannt !== "boolean") return;
  // Bei der Bonitätsauskunft behaelt das Urteil der Heuristik seine Kraft: Sie
  // hat gezaehlt, das Modell hat geraten. Das Modell steuert genau eine Sache
  // bei, die die Wortliste nicht kann — ob es wirklich eine Auskunft IST.
  const istAuskunft = art === "schufa";
  const urteil: DokumentUrteil = {
    art, pruefbar: true, quelle: "ki",
    erkannt: b.erkannt,
    vollstaendig: istAuskunft ? vorher.vollstaendig : (typeof b.vollstaendig === "boolean" ? b.vollstaendig : null),
    fehlt: istAuskunft ? vorher.fehlt : (Array.isArray(b.fehlt) ? b.fehlt.map(String).slice(0, 6) : []),
    seiten: seiten.length,
    hinweisKunde: istAuskunft ? vorher.hinweisKunde : (b.hinweis_kunde ? String(b.hinweis_kunde).slice(0, 300) : null),
    // ── KEINE VOLLSTAENDIGKEITS-BEHAUPTUNG MEHR (10.09.2026, E-175) ────────
    // Hier stand „erkannt, unvollstaendig — fehlt: Stammdaten, Score". Der
    // Mitarbeiter las das als gelbe Warnung an einer Auskunft, die vollstaendig
    // war. Diese Pruefung sieht nur die ersten 60.000 Zeichen und darf mit 400
    // Token antworten; bei 38 Seiten ist das ein Bruchteil. Sie kann sagen, ob
    // ein Dokument eine Bonitaetsauskunft IST — nicht, ob es vollstaendig ist.
    // Was drinsteht, sagt die Analyse (fiaon-schufa-analyse.ts).
    hinweisIntern: istAuskunft
      ? (b.erkannt
          ? (vorher.hinweisIntern || `Bonitätsauskunft erkannt (${seiten.length} Seiten).`)
          : `Bonitätsauskunft (KI): NICHT erkannt — bitte von Hand ansehen.`)
      : `${PROFILE[art].label} (KI): ${b.erkannt ? "erkannt" : "NICHT erkannt"}${
          !b.erkannt && Array.isArray(b.fehlt) && b.fehlt.length ? ` — fehlt: ${b.fehlt.slice(0, 3).join(", ")}` : ""}`,
  };
  await urteilSpeichern(ref, urteil);
  console.log(`[DOK-PRUEFUNG] KI-Urteil ${ref}/${art}: erkannt=${urteil.erkannt} vollstaendig=${urteil.vollstaendig}`);
}
