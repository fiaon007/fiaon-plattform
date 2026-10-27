// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — NEUE SEITEN: US-FUNDING, MARKTEINTRITT, ÖSTERREICH, KONZEPT (27.10.2026, E-439)
// Justin: „10 neue Ratgeber für die Business-Seite … Platzhirsch bei Google und KI für US Funding, US-Gesellschaft …“
// Je Seite eine Datei in e439/ (geschrieben, Quelle für Quelle gegengeprüft, übersetzt, gegengeprüft).
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalSeite } from "./typen";
import { SEITE as US_FUNDING } from "./e439/us-funding";
import { SEITE as SBA_KREDIT } from "./e439/sba-kredit-auslaender";
import { SEITE as STACKING } from "./e439/kreditkarten-stacking";
import { SEITE as LLC_DEUTSCHLAND } from "./e439/us-llc-wohnsitz-deutschland";
import { SEITE as MARKTEINTRITT } from "./e439/markteintritt-usa";
import { SEITE as PLATTFORMEN } from "./e439/amazon-stripe-paypal-llc";
import { SEITE as RETTEN } from "./e439/llc-retten-oder-aufloesen";
import { SEITE as E2_VISUM } from "./e439/e2-visum";
import { SEITE as NACHTEILE } from "./e439/nachteile-us-llc";
import { SEITE as AUS_OESTERREICH } from "./e439/aus-oesterreich";
import { SEITE as WAS_IST_FIAON_GLOBAL } from "./e439/was-ist-fiaon-global";

/** Neun Ratgeber (art wissen), Reihenfolge wie auf /business/wissen. */
export const WISSEN_E439: GlobalSeite[] = [US_FUNDING, SBA_KREDIT, STACKING, LLC_DEUTSCHLAND, MARKTEINTRITT, PLATTFORMEN, RETTEN, E2_VISUM, NACHTEILE];
export const AUS_OESTERREICH_SEITE: GlobalSeite = AUS_OESTERREICH;
export const WAS_IST_FIAON_GLOBAL_SEITE: GlobalSeite = WAS_IST_FIAON_GLOBAL;
