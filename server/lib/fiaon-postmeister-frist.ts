// ═══════════════════════════════════════════════════════════════════════════
// ENTWÜRFE BLEIBEN NICHT LIEGEN — DER SERVER HANDELT (19.10.2026, E-401 6/6)
//
// Justin (19.10.2026): „Mach Mara und co fix fertig, damit die wirklich GUT arbeitet und selbst arbeitet.“
// Die Regel steht rein in shared/fiaon-entwurf-frist.ts (fristUrteil). Hier:
//
//   1. MERKER — mailBearbeiten (fiaon-postmeister-lauf.ts) setzt frist_ab an jede Zeile, die es NEU anlegt.
//      Nur solche Entwürfe darf die Regel neu schreiben und senden; alles ohne Merker ist Altbestand.
//   2. DER LAUF (entwurfFristLauf) — am Ende des Postmeister-Takts (postmeisterLauf, alle 5 Min.), selbst
//      höchstens alle LAUF_ABSTAND_MIN Minuten: die Fakten aller wartenden Entwürfe in EINER Abfrage
//      (fristZeilenLaden), das Urteil je Entwurf, dann
//        · ablegen  — „geordnet“ mit Grund, Gmail-Entwurf gelöscht, Ordner „FIAON/Nicht mehr nötig“,
//                     Vermerk in der Akte, die Übergabe „Kunde hat geschrieben“ schließt (uebergabeSchliessen);
//        · neu schreiben — atomar EINMAL je Mail (frist_neu_am), dann derselbe Weg wie jede Antwort
//                     (mailBearbeiten mit dem Modus des Postfachs): Er sendet, wenn die Regeln es erlauben
//                     (automatischErlaubt, Übergabe, E-248, E-393), sonst entsteht wieder genau EIN Entwurf
//                     (mit Entscheidungskarte). Der alte Gmail-Entwurf wird erst gelöscht, wenn er ersetzt ist.
//                     Scheitert die Neufassung, holt der Lauf sie nach dem Zeitplan von E-184 nach.
//   3. DER PROBELAUF (fristStand) — dieselben Fakten und Urteile, ohne etwas zu ändern: Zahlen für das
//      Postfach (/admin/postmeister/kopf) und die Entscheidungskarte „Altbestand ablegen?“.
//   4. DER SCHALTER (Altbestand, Vorgabe AUS) — erst an, dann legt der Lauf auch alte Entwürfe ab, die nicht
//      mehr nötig sind. Gesendet wird aus dem Altbestand NIE.
//
// Wirft nie nach außen: Eine Störung hier darf den Postmeister-Takt nicht anhalten.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import {
  ABLAGE_JE_LAUF, ABLAGE_KOPF, ALTBESTAND_SCHALTER, FRIST_GRUENDE, LAUF_ABSTAND_MIN, NEU_JE_LAUF, NEU_KOPF,
  ablageBegruendung, altbestandSchalterAn, fristUrteil,
  type EntwurfFristFakten, type FristGrund, type FristUmfeld, type FristUrteil,
} from "@shared/fiaon-entwurf-frist";
import { imVersandfenster } from "@shared/fiaon-nicht-erreicht-nachfass";

type Lauf = any;
type Modus = FristUmfeld["modus"];

/** JSONB in jeder Form, die es gibt (Objekt, JSON-Text, JSON-Text im JSON-Text). */
function jsonTief(w: unknown): any {
  let v: unknown = w;
  for (let i = 0; i < 3 && typeof v === "string"; i++) {
    try { v = JSON.parse(v); } catch { return null; }
  }
  return v && typeof v === "object" ? v : null;
}

/** Eine wartende Zeile mit allen Fakten (fristZeilenLaden). */
export interface FristZeile {
  id: number; postfach: string; gmailId: string; personId: number | null; ref: string | null; betreff: string;
  antwortDraftId: string | null; fakten: EntwurfFristFakten;
}

/**
 * Die Fakten aller wartenden Entwürfe der bedienten Postfächer — EINE Abfrage. `ids` grenzt ein (Prüfstand,
 * einzelne Zeile). Spätere Mail: derselbe Mensch (Person, ohne Person die Adresse), nicht „ignoriert“, kein
 * Doppel/Nachtrag. Storno/Kündigung: nicht die, die Mara beim Schreiben DIESES Entwurfs selbst gebucht hat
 * (kuendigung_postmeister_id) — dann ist der Entwurf ja die Bestätigung. Zahlung: die eine Geld-Quelle
 * (UMSATZ_QUELLE_SQL), Raten nach Berliner Eingangstag NACH dem Tag der Mail (bezahlt_am trägt keine Uhrzeit).
 */
export async function fristZeilenLaden(opts: { ids?: number[] | null; lauf?: Lauf } = {}): Promise<FristZeile[]> {
  const lauf = opts.lauf ?? sqlPool;
  // Die Spalten frist_ab/frist_neu_am legt postmeisterSchema an (einmal je Prozess).
  const { postmeisterSchema } = await import("./fiaon-postmeister-schema");
  await postmeisterSchema();
  const { POSTFAECHER } = await import("./fiaon-postmeister-postfaecher");
  const { UMSATZ_QUELLE_SQL } = await import("./fiaon-umsatz-quelle");
  const { globalKundeSql, globalKundeBereit } = await import("./fiaon-global-kunde");
  await globalKundeBereit();
  const postfaecher = POSTFAECHER.map((p) => p.adresse.toLowerCase());
  const ids = Array.isArray(opts.ids) ? opts.ids.map(Number).filter((n) => Number.isInteger(n) && n > 0) : null;
  const zeilen = (await lauf.unsafe(`
    WITH e AS (
      SELECT pm.id, pm.postfach, pm.gmail_id, pm.person_id, pm.ref, pm.betreff, pm.antwort_draft_id,
             pm.kategorien, pm.flags, pm.begruendung, pm.frist_ab, pm.frist_neu_am, pm.message_id,
             COALESCE(pm.empfangen_am, pm.created_at) AS mail_am,
             COALESCE(pm.entwurf_geprueft_am, pm.created_at) AS entwurf_am,
             LOWER(TRIM(COALESCE(substring(pm.von from '<([^>]+)>'), pm.von, ''))) AS adresse
        FROM fiaon_postmeister pm
       WHERE pm.aktion = 'entwurf' AND pm.gesendet_am IS NULL
         AND NULLIF(pm.gmail_id, '') IS NOT NULL
         AND LOWER(pm.postfach) = ANY($1::text[])
         AND ($2::int[] IS NULL OR pm.id = ANY($2::int[]))
       ORDER BY pm.id ASC
       LIMIT 2000),
    geld AS (
      SELECT q.person_id, q.am, (q.art = 'rate') AS nur_tag FROM (${UMSATZ_QUELLE_SQL}) q
       WHERE q.person_id IN (SELECT e0.person_id FROM e e0 WHERE e0.person_id IS NOT NULL))
    SELECT e.*,
           (CASE WHEN e.person_id IS NULL THEN FALSE ELSE ${globalKundeSql("e.person_id")} END) AS global,
           sp.id AS spaeter_id, sp.am AS spaeter_am,
           (SELECT MIN(a.cancelled_at) FROM fiaon_applications a
             WHERE (a.person_id = e.person_id OR a.ref = e.ref) AND a.merged_into IS NULL
               AND a.payment_status IN ('cancelled', 'refunded') AND a.cancelled_at > e.mail_am
               AND a.kuendigung_postmeister_id IS DISTINCT FROM e.id) AS storno_am,
           (SELECT MIN(a.gekuendigt_am) FROM fiaon_applications a
             WHERE (a.person_id = e.person_id OR a.ref = e.ref) AND a.merged_into IS NULL
               AND a.gekuendigt_am > e.mail_am AND a.kuendigung_zurueckgenommen_am IS NULL
               AND a.kuendigung_postmeister_id IS DISTINCT FROM e.id) AS kuendigung_am,
           LEAST(
             (SELECT MIN(t.beginn) FROM fiaon_termine t
               WHERE t.person_id = e.person_id AND t.status = 'erledigt' AND t.beginn > e.mail_am AND t.beginn <= NOW()),
             (SELECT MIN(c.created_at) FROM fiaon_contact_log c
               WHERE c.voided_at IS NULL AND c.created_at > e.mail_am
                 AND (c.outcome LIKE 'erreicht%' OR c.outcome IN ('rate_zahlt_am', 'rate_ratenpause', 'rueckruf_termin'))
                 AND (c.person_id = e.person_id OR c.ref = e.ref
                      OR (e.person_id IS NOT NULL AND c.ref IN (SELECT a2.ref FROM fiaon_applications a2 WHERE a2.person_id = e.person_id))))
           ) AS gespraech_am,
           (SELECT MIN(g.am) FROM geld g
             WHERE g.person_id = e.person_id
               AND (CASE WHEN g.nur_tag THEN (g.am AT TIME ZONE 'Europe/Berlin')::date > (e.mail_am AT TIME ZONE 'Europe/Berlin')::date
                         ELSE g.am > e.mail_am END)) AS zahlung_am
      FROM e
      LEFT JOIN LATERAL (
        SELECT x.id, COALESCE(x.empfangen_am, x.created_at) AS am FROM fiaon_postmeister x
         WHERE x.id <> e.id AND x.aktion <> 'ignoriert'
           AND COALESCE(x.begruendung, '') NOT LIKE 'Doppel von Mail #%'
           -- E-401 Nachbesserung: dieselbe Mail in einem zweiten Postfach (Doppelzustellung) ist keine spätere Nachricht.
           AND COALESCE(x.begruendung, '') NOT LIKE 'Dieselbe Mail liegt auch in%'
           AND (e.message_id IS NULL OR x.message_id IS DISTINCT FROM e.message_id)
           AND COALESCE(x.empfangen_am, x.created_at) > e.mail_am
           AND ((e.person_id IS NOT NULL AND x.person_id = e.person_id)
             OR (e.person_id IS NULL AND e.adresse <> ''
                 AND LOWER(TRIM(COALESCE(substring(x.von from '<([^>]+)>'), x.von, ''))) = e.adresse))
         ORDER BY COALESCE(x.empfangen_am, x.created_at) ASC, x.id ASC
         LIMIT 1) sp ON TRUE
     ORDER BY e.id ASC`, [postfaecher, ids && ids.length ? ids : null])) as any[];
  return zeilen.map((r) => ({
    id: Number(r.id), postfach: String(r.postfach), gmailId: String(r.gmail_id),
    personId: r.person_id != null ? Number(r.person_id) : null, ref: r.ref ?? null, betreff: String(r.betreff ?? ""),
    antwortDraftId: r.antwort_draft_id ?? null,
    fakten: {
      id: Number(r.id),
      neu: r.frist_ab != null,
      entwurfAm: r.entwurf_am, mailAm: r.mail_am, neuGeschriebenAm: r.frist_neu_am ?? null,
      begruendung: r.begruendung ?? null,
      kategorien: Array.isArray(r.kategorien) ? r.kategorien.map(String) : [],
      flags: jsonTief(r.flags),
      global: r.global === true,
      spaetereMail: r.spaeter_id != null ? { id: Number(r.spaeter_id), am: r.spaeter_am } : null,
      stornoAm: r.storno_am ?? null, kuendigungAm: r.kuendigung_am ?? null,
      gespraechAm: r.gespraech_am ?? null, zahlungAm: r.zahlung_am ?? null,
    },
  }));
}

/** Der Schalter für den Altbestand. Lesefehler: AUS (lieber nichts ablegen). */
export async function altbestandSchalterLesen(lauf: Lauf = sqlPool): Promise<boolean> {
  try {
    const [z] = (await lauf`SELECT value FROM fiaon_settings WHERE key = ${ALTBESTAND_SCHALTER}`) as any[];
    return altbestandSchalterAn(z?.value);
  } catch {
    return false;
  }
}

export async function altbestandSchalterSetzen(an: boolean): Promise<void> {
  await sqlPool`INSERT INTO fiaon_settings (key, value) VALUES (${ALTBESTAND_SCHALTER}, ${an ? "an" : "aus"})
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  if (standMerk) standMerk.bis = 0;
}

/** Die Umfeld-Lesungen eines Laufs — je Postfach der Modus, einmal KI-Pause und Schalter. */
async function umfeldLesen(): Promise<{ modus: (postfach: string) => Promise<Modus>; kiPausiert: boolean; altbestandAblegen: boolean }> {
  const { kiPausiert } = await import("./fiaon-ki-pause");
  const pausiert = await kiPausiert().catch(() => true);
  const schalter = await altbestandSchalterLesen();
  const merk = new Map<string, Modus>();
  return {
    kiPausiert: pausiert,
    altbestandAblegen: schalter,
    modus: async (postfach: string) => {
      const k = postfach.toLowerCase();
      if (!merk.has(k)) {
        const { postfachModus } = await import("../routes/fiaon-postmeister");
        // Lesefehler: „aus“ — dann tut die Regel nichts (auch kein Ablegen).
        merk.set(k, (await postfachModus(postfach).catch(() => "aus")) as Modus);
      }
      return merk.get(k)!;
    },
  };
}

/** Testkonto oder Vertriebssperre (Familie bzw. Kopf, E-253) — dann schreibt die Automatik nicht neu. Störung: gesperrt. */
async function sperreLesen(personId: number | null): Promise<string | null> {
  if (personId == null) return null;
  try {
    const { personSperre } = await import("./fiaon-mail-frequenz");
    const s = await personSperre(personId);
    if (!s) return null;
    if (s.test) return "Testkonto";
    if (s.vertriebssperre) return "Vertriebssperre";
    return null;
  } catch {
    return "Sperrprüfung nicht möglich";
  }
}

/** Gmail-Ordner umhängen: „Entwurf wartet“ → „Nicht mehr nötig“. Nur Ablage — scheitert es, bleibt alles andere. */
async function ordnerUmhaengen(postfach: string, gmailId: string): Promise<void> {
  try {
    const { labelSicherstellen, nachrichtLabeln } = await import("./fiaon-gmail");
    const neu = await labelSicherstellen(postfach, "FIAON/Nicht mehr nötig");
    const alt = await labelSicherstellen(postfach, "FIAON/Entwurf wartet");
    await nachrichtLabeln(postfach, gmailId, [neu], [alt]);
  } catch (e) {
    console.warn(`[POSTMEISTER-FRIST] Ordner für ${postfach}/${gmailId} nicht umgehängt:`, String((e as Error)?.message ?? e).slice(0, 120));
  }
}

/**
 * Einen Entwurf als „nicht mehr nötig“ ablegen. Atomar (nur, solange er wartet). Keine Mail an den Kunden.
 * Danach: Gmail-Entwurf weg, Ordner umgehängt, Vermerk in der Akte, die Übergabe schließt (sofern nichts mehr wartet).
 */
export async function entwurfAblegen(z: Pick<FristZeile, "id" | "betreff">, grund: string, wer = "Mara (24-Stunden-Regel)"): Promise<boolean> {
  const [r] = (await sqlPool`
    UPDATE fiaon_postmeister
       SET aktion = 'geordnet', naechster_versuch_am = NULL, in_arbeit_seit = NULL,
           begruendung = ${ablageBegruendung(grund)}, updated_at = NOW()
     WHERE id = ${z.id} AND aktion = 'entwurf' AND gesendet_am IS NULL
    RETURNING postfach, gmail_id, antwort_draft_id, person_id, ref`) as any[];
  if (!r) return false;
  if (r.antwort_draft_id) {
    const { entwurfLoeschen } = await import("./fiaon-gmail");
    await entwurfLoeschen(String(r.postfach), String(r.antwort_draft_id)).catch(() => {});
  }
  if (r.gmail_id) await ordnerUmhaengen(String(r.postfach), String(r.gmail_id));
  if (r.ref) {
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
      VALUES (${r.ref}, ${r.person_id ?? null}, NULL, 'Postmeister', 'system',
              ${`Mara: Antwort-Entwurf zu Mail #${z.id} („${String(z.betreff || "(ohne Betreff)").slice(0, 80)}“) nicht gesendet — nicht mehr nötig: ${grund}`.slice(0, 900)})
    `.catch(() => {});
  }
  const { uebergabeSchliessen } = await import("./fiaon-postmeister-lauf");
  await uebergabeSchliessen({ id: z.id, personId: r.person_id ?? null, ref: r.ref ?? null }, wer,
    `Nicht mehr nötig (24-Stunden-Regel): ${grund} — Mail #${z.id}.`.slice(0, 480), { abgelegt: true }).catch(() => false);
  return true;
}

/**
 * Einen NEUEN Entwurf einmal mit heutigem Stand neu schreiben — derselbe Weg wie jede Antwort (mailBearbeiten).
 * Atomar: nur, solange er wartet, den Merker trägt und noch nie neu geschrieben wurde (frist_neu_am). Die alte
 * Antwort und der Gmail-Entwurf bleiben bis zum Ergebnis stehen: Scheitert die Neufassung, kann ein Mensch die
 * alte Fassung im Postfach (Zu prüfen) weiter senden; ersetzt sie sie, wird der alte Gmail-Entwurf gelöscht.
 */
export async function entwurfNeuSchreiben(z: Pick<FristZeile, "id" | "postfach" | "gmailId">, modus: Modus): Promise<{ aktion: string; grund: string }> {
  // E-401 Nachbesserung (Prüfer-Fund): die KI-Pause FRISCH prüfen — begann sie mitten im Lauf, bleibt der Entwurf unberührt.
  const { kiPausiert } = await import("./fiaon-ki-pause");
  if (await kiPausiert()) return { aktion: "uebersprungen", grund: "KI pausiert" };
  // Den alten Stand merken (Begründung, Anhänge) — kommt mailBearbeiten zu keinem Ergebnis, wird genau er wiederhergestellt.
  const [r] = (await sqlPool`
    WITH alt AS (
      SELECT id, begruendung, anhaenge FROM fiaon_postmeister
       WHERE id = ${z.id} AND aktion = 'entwurf' AND gesendet_am IS NULL AND frist_ab IS NOT NULL AND frist_neu_am IS NULL
       FOR UPDATE)
    UPDATE fiaon_postmeister p
       SET aktion = 'vorgeordnet', versuche = 0, anhaenge = NULL, in_arbeit_seit = NULL, naechster_versuch_am = NULL,
           frist_neu_am = NOW(), begruendung = ${NEU_KOPF}, updated_at = NOW()
      FROM alt
     WHERE p.id = alt.id
    RETURNING p.antwort_draft_id, alt.begruendung AS alt_begruendung, alt.anhaenge AS alt_anhaenge`) as any[];
  if (!r) return { aktion: "uebersprungen", grund: "nicht mehr im Entwurf oder schon neu geschrieben" };
  const zurueck = { begruendung: (r.alt_begruendung ?? null) as string | null, anhaenge: r.alt_anhaenge ?? null };
  return await bearbeitenUndAufraeumen(z, modus, r.antwort_draft_id ?? null, zurueck);
}

/**
 * Kam mailBearbeiten zu KEINEM Ergebnis (KI-Pause mitten im Lauf, Ausnahme vor dem Anspruch), steht die Zeile noch auf
 * 'vorgeordnet' mit dem Kopf der Neufassung — unsichtbar für Postfach, 24-Stunden-Regel und Pausen-Nachholen. Dann zurück auf
 * den Entwurf von vorher (Begründung, Anhänge), frist_neu_am leer: Der nächste Lauf versucht es wieder. (E-401 Nachbesserung)
 */
async function zuruecklegen(id: number, zurueck: { begruendung: string | null; anhaenge: unknown }): Promise<boolean> {
  const r = (await sqlPool`
    UPDATE fiaon_postmeister
       SET aktion = 'entwurf', begruendung = ${zurueck.begruendung}, anhaenge = ${zurueck.anhaenge == null ? null : JSON.stringify(zurueck.anhaenge)}::text::jsonb,
           frist_neu_am = NULL, in_arbeit_seit = NULL, updated_at = NOW()
     WHERE id = ${id} AND aktion = 'vorgeordnet' AND begruendung = ${NEU_KOPF} AND gesendet_am IS NULL
    RETURNING id`.catch((e) => { console.error(`[POSTMEISTER-FRIST] Zurücklegen #${id}:`, String(e).slice(0, 160)); return []; })) as any[];
  return r.length > 0;
}

/** mailBearbeiten, danach den alten Gmail-Entwurf löschen, wenn er ersetzt ist (neuer Entwurf, gesendet, abgelegt). */
async function bearbeitenUndAufraeumen(z: Pick<FristZeile, "id" | "postfach" | "gmailId">, modus: Modus, alterEntwurf: string | null,
  zurueck: { begruendung: string | null; anhaenge: unknown } | null = null): Promise<{ aktion: string; grund: string }> {
  const { mailBearbeiten } = await import("./fiaon-postmeister-lauf");
  const { postfachGruss } = await import("./fiaon-postmeister-postfaecher");
  let erg: { aktion: string; grund?: string | null } = { aktion: "fehler", grund: "" };
  try {
    erg = await mailBearbeiten({ postfach: z.postfach, gmailId: z.gmailId, gruss: postfachGruss(z.postfach), modus: modus as any, nurOrdnen: false });
  } finally {
    // E-401 Nachbesserung (Prüfer-Fund): Steht die Zeile noch in der Neufassung (kein Anspruch, KI-Pause, Ausnahme), zurück.
    if (zurueck && (await zuruecklegen(z.id, zurueck))) {
      console.warn(`[POSTMEISTER-FRIST] Mail #${z.id}: Neufassung kam zu keinem Ergebnis (${String(erg?.grund ?? "").slice(0, 80)}) — der Entwurf bleibt, wie er war.`);
    }
  }
  const [jetzt] = (await sqlPool`SELECT aktion, antwort_draft_id, begruendung FROM fiaon_postmeister WHERE id = ${z.id}`) as any[];
  const aktion = String(jetzt?.aktion ?? "");
  // Zurückgelegt: nichts ist geschehen — nicht als „neu geschrieben“ zählen.
  if (zurueck && aktion === "entwurf" && String(jetzt?.begruendung ?? "") === String(zurueck.begruendung ?? "") && String(jetzt?.antwort_draft_id ?? "") === String(alterEntwurf ?? "")) {
    return { aktion: "uebersprungen", grund: `Neufassung ohne Ergebnis (${String(erg?.grund ?? "").slice(0, 120)}) — Entwurf unverändert` };
  }
  // E-401 Nachbesserung (Prüfer-Fund): Als „Doppelzustellung“ abgelegt ist NICHT ersetzt — die Schwesterzeile antwortet ja
  // nicht. Dann zurück auf den Entwurf (der alte Gmail-Entwurf bleibt) statt die Kundenmail still verschwinden zu lassen.
  const doppelAbgelegt = aktion === "geordnet" && /^Dieselbe Mail liegt auch in/.test(String(jetzt?.begruendung ?? ""));
  if (doppelAbgelegt && zurueck) {
    await sqlPool`
      UPDATE fiaon_postmeister SET aktion = 'entwurf', begruendung = ${zurueck.begruendung}, anhaenge = ${zurueck.anhaenge == null ? null : JSON.stringify(zurueck.anhaenge)}::text::jsonb,
             frist_neu_am = NULL, updated_at = NOW()
       WHERE id = ${z.id} AND aktion = 'geordnet' AND gesendet_am IS NULL`.catch(() => {});
    return { aktion: "uebersprungen", grund: "als Doppelzustellung eingeordnet — der Entwurf bleibt stehen" };
  }
  // Ersetzt: gesendet oder abgelegt (der alte Entwurf ist überholt) — oder ein NEUER Gmail-Entwurf steht an seiner Stelle.
  // (Eine „Doppelzustellung“ ersetzt nie — dann bleibt der alte Gmail-Entwurf in jedem Fall stehen.)
  const ersetzt = (["auto_beantwortet", "gesendet", "geordnet", "ignoriert"].includes(aktion) && !doppelAbgelegt)
    || (aktion === "entwurf" && String(jetzt?.antwort_draft_id ?? "") !== String(alterEntwurf ?? ""));
  if (alterEntwurf && ersetzt) {
    const { entwurfLoeschen } = await import("./fiaon-gmail");
    await entwurfLoeschen(z.postfach, alterEntwurf).catch(() => {});
    await sqlPool`UPDATE fiaon_postmeister SET antwort_draft_id = NULL WHERE id = ${z.id} AND antwort_draft_id = ${alterEntwurf}`.catch(() => {});
  }
  return { aktion: String(jetzt?.aktion ?? erg.aktion), grund: String(erg.grund ?? "") };
}

/**
 * Eine Neufassung, die scheiterte (aktion 'fehler'), nach dem Zeitplan von E-184 nachholen. Der Takt findet
 * sie sonst nur, solange die Mail im 2-Tage-Fenster der Gmail-Suche liegt — die 24-Stunden-Regel kommt aber
 * frühestens nach einem Tag. mailBearbeiten beansprucht die Zeile selbst (fällig, weniger als drei Versuche).
 */
async function faelligeFehlerLaden(ids: number[] | null): Promise<{ id: number; postfach: string; gmailId: string; draftId: string | null; personId: number | null }[]> {
  const { POSTFAECHER } = await import("./fiaon-postmeister-postfaecher");
  const zeilen = (await sqlPool`
    SELECT id, postfach, gmail_id, antwort_draft_id, person_id FROM fiaon_postmeister
     WHERE aktion = 'fehler' AND gesendet_am IS NULL AND frist_ab IS NOT NULL AND frist_neu_am IS NOT NULL
       AND versuche < 3 AND (naechster_versuch_am IS NULL OR naechster_versuch_am <= NOW())
       AND LOWER(postfach) = ANY(${POSTFAECHER.map((p) => p.adresse.toLowerCase())}::text[])
       AND (${ids && ids.length ? sqlPool`id = ANY(${ids}::int[])` : sqlPool`TRUE`})
     ORDER BY naechster_versuch_am ASC NULLS FIRST LIMIT 10`) as any[];
  return zeilen.map((r) => ({ id: Number(r.id), postfach: String(r.postfach), gmailId: String(r.gmail_id), draftId: r.antwort_draft_id ?? null, personId: r.person_id ?? null }));
}

export interface FristLaufErgebnis {
  gelaufen: boolean;
  am: string;
  geprueft: number;
  abgelegt: number;
  /** davon aus dem Altbestand (nur mit Schalter). */
  abgelegtAltbestand: number;
  neuGeschrieben: number;
  gesendet: number;
  entwurf: number;
  fehler: number;
  /** Altbestand, nicht mehr nötig — wartet auf den Schalter. */
  probe: number;
  grund?: string;
}
const LEER = (gelaufen: boolean, grund?: string): FristLaufErgebnis => ({
  gelaufen, am: new Date().toISOString(), geprueft: 0, abgelegt: 0, abgelegtAltbestand: 0, neuGeschrieben: 0, gesendet: 0, entwurf: 0, fehler: 0, probe: 0, ...(grund ? { grund } : {}),
});

let laeuft = false;
let zuletzt = 0;
let letzterLauf: FristLaufErgebnis | null = null;

/**
 * DER LAUF — am Ende des Postmeister-Takts. `immer` übergeht den Abstand (Prüfstand, Schalter-Klick),
 * `jetzt` setzt die Uhr (Prüfstand: Versandfenster), `nurAltbestand` legt nur alte Entwürfe ab (Schalter-Klick),
 * `ids` grenzt auf bestimmte Zeilen ein (Prüfstand).
 */
export async function entwurfFristLauf(opts: { immer?: boolean; jetzt?: Date; nurAltbestand?: boolean; ids?: number[]; ablageDeckel?: number } = {}): Promise<FristLaufErgebnis> {
  if (laeuft) return LEER(false, "läuft schon");
  if (!opts.immer && Date.now() - zuletzt < LAUF_ABSTAND_MIN * 60_000) return LEER(false, "Abstand");
  laeuft = true;
  zuletzt = Date.now();
  const e = LEER(true);
  try {
    const jetzt = opts.jetzt ?? new Date();
    const umfeld = await umfeldLesen();
    const zeilen = await fristZeilenLaden({ ids: opts.ids ?? null });
    let ablagen = 0, neu = 0;
    const ablageDeckel = Math.max(1, Math.min(500, opts.ablageDeckel ?? ABLAGE_JE_LAUF));
    for (const z of zeilen) {
      e.geprueft++;
      if (!z.fakten.neu && !umfeld.altbestandAblegen && !opts.nurAltbestand) {
        // Altbestand ohne Schalter: nur zählen (Probelauf) — nichts verändern.
        const u = fristUrteil(z.fakten, { modus: await umfeld.modus(z.postfach), kiPausiert: umfeld.kiPausiert, altbestandAblegen: false, sperre: null }, jetzt);
        if (u.art === "ablegen_probe") e.probe++;
        continue;
      }
      if (opts.nurAltbestand && z.fakten.neu) continue;
      const basis: FristUmfeld = {
        modus: await umfeld.modus(z.postfach), kiPausiert: umfeld.kiPausiert,
        altbestandAblegen: umfeld.altbestandAblegen || !!opts.nurAltbestand, sperre: null,
      };
      let u: FristUrteil = fristUrteil(z.fakten, basis, jetzt);
      // Die Sperre (Testkonto, Vertriebssperre) nur lesen, wo sie zählt: vor dem Neuschreiben.
      if (u.art === "neu_schreiben") u = fristUrteil(z.fakten, { ...basis, sperre: await sperreLesen(z.personId) }, jetzt);
      try {
        if (u.art === "ablegen" && ablagen < ablageDeckel) {
          if (await entwurfAblegen(z, u.grund)) {
            ablagen++;
            e.abgelegt++;
            if (!z.fakten.neu) e.abgelegtAltbestand++;
          }
        } else if (u.art === "neu_schreiben" && neu < NEU_JE_LAUF && !opts.nurAltbestand) {
          neu++;
          const r = await entwurfNeuSchreiben(z, basis.modus);
          if (r.aktion === "uebersprungen") continue;
          e.neuGeschrieben++;
          if (r.aktion === "auto_beantwortet") e.gesendet++;
          else if (r.aktion === "entwurf") e.entwurf++;
          else if (r.aktion === "fehler") e.fehler++;
          console.log(`[POSTMEISTER-FRIST] Mail #${z.id} neu geschrieben → ${r.aktion}${r.grund ? ` (${r.grund.slice(0, 100)})` : ""}`);
        }
      } catch (err) {
        e.fehler++;
        console.error(`[POSTMEISTER-FRIST] Mail #${z.id}:`, String((err as Error)?.message ?? err).slice(0, 200));
      }
    }
    // Gescheiterte Neufassungen nach dem Zeitplan nachholen — nur im Fenster, nie in der KI-Pause.
    if (!opts.nurAltbestand && !umfeld.kiPausiert && imVersandfenster(jetzt)) {
      for (const f of await faelligeFehlerLaden(opts.ids ?? null).catch(() => [])) {
        if (neu >= NEU_JE_LAUF) break;
        const modus = await umfeld.modus(f.postfach);
        if (modus === "aus" || (await sperreLesen(f.personId))) continue;
        neu++;
        try {
          const r = await bearbeitenUndAufraeumen(f, modus, f.draftId);
          if (r.aktion === "auto_beantwortet") e.gesendet++;
          else if (r.aktion === "entwurf") e.entwurf++;
          else if (r.aktion === "fehler") e.fehler++;
        } catch (err) {
          e.fehler++;
          console.error(`[POSTMEISTER-FRIST] Nachholen #${f.id}:`, String((err as Error)?.message ?? err).slice(0, 200));
        }
      }
    }
    if (e.abgelegt || e.neuGeschrieben) {
      console.log(`[POSTMEISTER-FRIST] ${e.abgelegt} abgelegt (${e.abgelegtAltbestand} Altbestand), ${e.neuGeschrieben} neu geschrieben → ${e.gesendet} gesendet, ${e.entwurf} Entwurf, ${e.fehler} Fehler.`);
    }
  } catch (err) {
    console.error("[POSTMEISTER-FRIST] Lauf:", String((err as Error)?.message ?? err).slice(0, 200));
    e.grund = "Störung";
  } finally {
    laeuft = false;
    if (standMerk) standMerk.bis = 0;
  }
  letzterLauf = e;
  return e;
}

/** Nur für den Prüfstand: den Abstand zurücksetzen. */
export function fristAbstandZuruecksetzen(): void { zuletzt = 0; if (standMerk) standMerk.bis = 0; }

// ═══════════════════════════════════════════════════════════════════════════
// DER PROBELAUF — was die Regel jetzt täte, ohne etwas zu ändern
// ═══════════════════════════════════════════════════════════════════════════
export interface FristStand {
  am: string;
  /** Schalter für den Altbestand (Vorgabe aus). */
  altbestandAblegen: boolean;
  neu: { gesamt: number; wartet: number; ablegen: number; neuSchreiben: number; bleibt: number };
  altbestand: {
    gesamt: number;
    nichtMehrNoetig: number;
    jeGrund: Record<FristGrund, number>;
    /** braucht noch eine Antwort (oder eine Entscheidung) — bleibt liegen. */
    offen: number;
    /** jünger als 24 h — noch nicht geprüft. */
    wartet: number;
    aeltester: string | null;
  };
  /** Kunden von FIAON Global — die Regel fasst sie nie an. */
  global: number;
  woche: { abgelegt: number; neuGeschrieben: number; davonGesendet: number };
  letzterLauf: FristLaufErgebnis | null;
}

let standMerk: { bis: number; wert: FristStand } | null = null;

/**
 * Für den Kopf des Postfachs: den Probelauf höchstens 1,5 s abwarten — sonst den letzten Stand (oder null) zeigen und
 * im Hintergrund weiterrechnen. Die Abfrage dauert in Produktion 1–3 s; der Kopf soll nicht daran hängen.
 */
let standRechnung: Promise<FristStand> | null = null;
export async function fristStandSchnell(): Promise<FristStand | null> {
  if (standMerk && standMerk.bis > Date.now()) return standMerk.wert;
  if (!standRechnung) standRechnung = fristStand({ frisch: true }).finally(() => { standRechnung = null; });
  const rechnung = standRechnung;
  rechnung.catch((e) => console.error("[POSTMEISTER-FRIST] Stand:", String((e as Error)?.message ?? e).slice(0, 160)));
  const fertig = await Promise.race([rechnung.catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), 1_500))]);
  return fertig ?? standMerk?.wert ?? null;
}

export async function fristStand(opts: { frisch?: boolean; jetzt?: Date } = {}): Promise<FristStand> {
  if (!opts.frisch && !opts.jetzt && standMerk && standMerk.bis > Date.now()) return standMerk.wert;
  const jetzt = opts.jetzt ?? new Date();
  const umfeld = await umfeldLesen();
  const zeilen = await fristZeilenLaden();
  const jeGrund = Object.fromEntries(FRIST_GRUENDE.map((g) => [g, 0])) as Record<FristGrund, number>;
  const s: FristStand = {
    am: jetzt.toISOString(), altbestandAblegen: umfeld.altbestandAblegen,
    neu: { gesamt: 0, wartet: 0, ablegen: 0, neuSchreiben: 0, bleibt: 0 },
    altbestand: { gesamt: 0, nichtMehrNoetig: 0, jeGrund, offen: 0, wartet: 0, aeltester: null },
    global: 0, woche: { abgelegt: 0, neuGeschrieben: 0, davonGesendet: 0 }, letzterLauf,
  };
  let aeltester: number | null = null;
  for (const z of zeilen) {
    // Der Probelauf zählt den Altbestand so, als wäre der Schalter an — „nicht mehr nötig“ heißt dann „ablegen“.
    const u = fristUrteil(z.fakten, { modus: await umfeld.modus(z.postfach), kiPausiert: umfeld.kiPausiert, altbestandAblegen: true, sperre: null }, jetzt);
    if (u.art === "auslassen") { s.global++; continue; }
    if (z.fakten.neu) {
      s.neu.gesamt++;
      if (u.art === "warten") s.neu.wartet++;
      else if (u.art === "ablegen") s.neu.ablegen++;
      else if (u.art === "neu_schreiben") s.neu.neuSchreiben++;
      else s.neu.bleibt++;
      continue;
    }
    s.altbestand.gesamt++;
    const am = new Date((z.fakten.mailAm ?? 0) as any).getTime();
    if (Number.isFinite(am) && (aeltester == null || am < aeltester)) aeltester = am;
    if (u.art === "ablegen") { s.altbestand.nichtMehrNoetig++; jeGrund[u.wegen]++; }
    else if (u.art === "warten") s.altbestand.wartet++;
    else s.altbestand.offen++;
  }
  s.altbestand.aeltester = aeltester != null ? new Date(aeltester).toISOString() : null;
  const [w] = (await sqlPool`
    SELECT COUNT(*) FILTER (WHERE LEFT(COALESCE(begruendung, ''), ${ABLAGE_KOPF.length}) = ${ABLAGE_KOPF} AND updated_at > NOW() - INTERVAL '7 days')::int AS abgelegt,
           COUNT(*) FILTER (WHERE frist_neu_am > NOW() - INTERVAL '7 days')::int AS neu,
           COUNT(*) FILTER (WHERE frist_neu_am > NOW() - INTERVAL '7 days' AND gesendet_am >= frist_neu_am)::int AS gesendet
      FROM fiaon_postmeister
     WHERE updated_at > NOW() - INTERVAL '8 days'`.catch(() => [{}])) as any[];
  s.woche = { abgelegt: Number(w?.abgelegt || 0), neuGeschrieben: Number(w?.neu || 0), davonGesendet: Number(w?.gesendet || 0) };
  if (!opts.jetzt) standMerk = { bis: Date.now() + 60_000, wert: s };
  return s;
}

/**
 * Justins Klick (Entscheidungskarte oder Postfach): Schalter an und den Altbestand JETZT ablegen, der nicht mehr
 * nötig ist — im Hintergrund (112 Zeilen mit Gmail-Ablage dauern in Produktion leicht eine halbe Minute; der Klick
 * soll nicht daran hängen). `erwartet` ist die Zahl aus dem Probelauf. Sendet nie.
 */
let altbestandLauf: Promise<{ abgelegt: number }> | null = null;
export async function altbestandAblegenStarten(): Promise<{ erwartet: number; laeuft: Promise<{ abgelegt: number }> }> {
  const erwartet = (await fristStand({ frisch: true }).catch(() => null))?.altbestand.nichtMehrNoetig ?? 0;
  await altbestandSchalterSetzen(true);
  if (!altbestandLauf) {
    altbestandLauf = altbestandJetztAblegen()
      .then((r) => { console.log(`[POSTMEISTER-FRIST] Altbestand abgelegt: ${r.abgelegt} (keine Mail an Kunden).`); return r; })
      .catch((e) => { console.error("[POSTMEISTER-FRIST] Altbestand ablegen:", String((e as Error)?.message ?? e).slice(0, 200)); return { abgelegt: 0 }; })
      .finally(() => { altbestandLauf = null; });
  }
  return { erwartet, laeuft: altbestandLauf };
}

/** Der laufende Hintergrund-Lauf (oder null) — für den Prüfstand und den Stand. */
export function altbestandLaufAktuell(): Promise<{ abgelegt: number }> | null { return altbestandLauf; }

/** Schalter an und den Altbestand ablegen, der nicht mehr nötig ist — wartet bis zum Ende. Sendet nie. In Häppchen (höchstens 500). */
export async function altbestandJetztAblegen(): Promise<{ abgelegt: number }> {
  await altbestandSchalterSetzen(true);
  let summe = 0;
  for (let runde = 0; runde < 10; runde++) {
    const r = await entwurfFristLauf({ immer: true, nurAltbestand: true, ablageDeckel: 50 });
    if (!r.gelaufen) break;
    summe += r.abgelegtAltbestand;
    if (r.abgelegtAltbestand < 50) break;
  }
  return { abgelegt: summe };
}
