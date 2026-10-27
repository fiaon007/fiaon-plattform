// ═══════════════════════════════════════════════════════════════════════════
// FÜNF PRIVAT-RATGEBER (27.10.2026, E-439) — Hand-Artikel, Quelle für Quelle gegengeprüft
// Justin: „Kümmere dich um 5 neue Ratgeber für Privat …“ — Themen aus der SERP-Recherche, die FIAON noch nicht abdeckte:
// Schuldnerverzeichnis, Vermögensauskunft, öffentliche Schulden, Identitätsdiebstahl, Bonität von null.
// Eingespielt beim Start (fiaon-ratgeber-redaktion.ts → ensureRatgeberTabelle), je Artikel eine Stunde früher datiert,
// damit sie nicht in derselben Sekunde erscheinen. ON CONFLICT DO NOTHING: Korrekturen danach nur über die Redaktion.
// ═══════════════════════════════════════════════════════════════════════════
import type { StartArtikel } from "../fiaon-ratgeber-start";
import { ARTIKEL as SCHULDNERVERZEICHNIS } from "./schuldnerverzeichnis";
import { ARTIKEL as VERMOEGENSAUSKUNFT } from "./vermoegensauskunft";
import { ARTIKEL as OEFFENTLICHE_SCHULDEN_SCHUFA } from "./oeffentliche-schulden-schufa";
import { ARTIKEL as IDENTITAETSDIEBSTAHL } from "./identitaetsdiebstahl";
import { ARTIKEL as BONITAET_VON_NULL } from "./bonitaet-von-null";

export const HAND_ARTIKEL_E439: StartArtikel[] = [SCHULDNERVERZEICHNIS, VERMOEGENSAUSKUNFT, OEFFENTLICHE_SCHULDEN_SCHUFA, IDENTITAETSDIEBSTAHL, BONITAET_VON_NULL];
