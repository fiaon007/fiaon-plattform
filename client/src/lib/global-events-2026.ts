/**
 * ============================================================================
 * GLOBAL EVENTS 2026 — DACH Holidays + ARAS AI Updates + Year Markers
 * ============================================================================
 * Read-only overlay for all user calendars.
 * Categories: 'holiday' | 'holiday_regional' | 'aras_update' | 'marker'
 * Regions: 'DACH' (all), 'AT', 'DE', 'CH', 'DE-BW', 'DE-BY', etc.
 * ============================================================================
 */

export type GlobalEventCategory = 'holiday' | 'holiday_regional' | 'aras_update' | 'marker';
export type GlobalEventRegion =
  | 'DACH' | 'AT' | 'DE' | 'CH'
  | 'DE-BW' | 'DE-BY' | 'DE-BE' | 'DE-BB' | 'DE-HB' | 'DE-HH'
  | 'DE-HE' | 'DE-MV' | 'DE-NI' | 'DE-NW' | 'DE-RP' | 'DE-SL'
  | 'DE-SN' | 'DE-ST' | 'DE-SH' | 'DE-TH'
  | 'CH-ZH' | 'CH-BE' | 'CH-LU' | 'CH-SG' | 'CH-AG' | 'CH-TI';

export interface GlobalEvent {
  id: string;
  title: string;
  description: string;
  date: string;        // YYYY-MM-DD
  allDay: boolean;
  category: GlobalEventCategory;
  region?: GlobalEventRegion;
  isReadOnly: true;
  scope: 'global';
}

// ============================================================================
// HELPERS
// ============================================================================

function holiday(id: string, date: string, title: string, region: GlobalEventRegion, desc?: string): GlobalEvent {
  return {
    id: `g2026-hol-${id}`,
    title,
    description: desc || `Gesetzlicher Feiertag. ${title}.`,
    date,
    allDay: true,
    category: region.includes('-') ? 'holiday_regional' : 'holiday',
    region,
    isReadOnly: true,
    scope: 'global',
  };
}

function arasUpdate(id: string, date: string, title: string, desc: string): GlobalEvent {
  return {
    id: `g2026-aras-${id}`,
    title,
    description: desc,
    date,
    allDay: true,
    category: 'aras_update',
    isReadOnly: true,
    scope: 'global',
  };
}

function marker(id: string, date: string, title: string, desc: string): GlobalEvent {
  return {
    id: `g2026-mkr-${id}`,
    title,
    description: desc,
    date,
    allDay: true,
    category: 'marker',
    isReadOnly: true,
    scope: 'global',
  };
}

// ============================================================================
// A) NATIONAL HOLIDAYS — GERMANY (bundesweit)
// ============================================================================
// Easter 2026: Sunday April 5

const DE_NATIONAL: GlobalEvent[] = [
  holiday('de-neujahr',           '2026-01-01', 'Neujahr',                    'DE'),
  holiday('de-karfreitag',        '2026-04-03', 'Karfreitag',                 'DE'),
  holiday('de-ostersonntag',      '2026-04-05', 'Ostersonntag',               'DE'),
  holiday('de-ostermontag',       '2026-04-06', 'Ostermontag',                'DE'),
  holiday('de-tag-der-arbeit',    '2026-05-01', 'Tag der Arbeit',             'DE'),
  holiday('de-himmelfahrt',       '2026-05-14', 'Christi Himmelfahrt',        'DE'),
  holiday('de-pfingstsonntag',    '2026-05-24', 'Pfingstsonntag',             'DE'),
  holiday('de-pfingstmontag',     '2026-05-25', 'Pfingstmontag',             'DE'),
  holiday('de-einheit',           '2026-10-03', 'Tag der Deutschen Einheit',  'DE'),
  holiday('de-weihnachten1',      '2026-12-25', 'Erster Weihnachtstag',       'DE'),
  holiday('de-weihnachten2',      '2026-12-26', 'Zweiter Weihnachtstag',      'DE'),
];

// ============================================================================
// B) REGIONAL HOLIDAYS — GERMANY (Bundesländer)
// ============================================================================

const DE_REGIONAL: GlobalEvent[] = [
  // Heilige Drei Könige (Jan 6) — BW, BY, ST
  holiday('de-3koenige-bw', '2026-01-06', 'Heilige Drei Könige', 'DE-BW'),
  holiday('de-3koenige-by', '2026-01-06', 'Heilige Drei Könige', 'DE-BY'),
  holiday('de-3koenige-st', '2026-01-06', 'Heilige Drei Könige', 'DE-ST'),

  // Internationaler Frauentag (Mar 8) — BE, MV
  holiday('de-frauentag-be', '2026-03-08', 'Internationaler Frauentag', 'DE-BE'),
  holiday('de-frauentag-mv', '2026-03-08', 'Internationaler Frauentag', 'DE-MV'),

  // Fronleichnam (Jun 4) — BW, BY, HE, NW, RP, SL
  holiday('de-fronleichnam-bw', '2026-06-04', 'Fronleichnam', 'DE-BW'),
  holiday('de-fronleichnam-by', '2026-06-04', 'Fronleichnam', 'DE-BY'),
  holiday('de-fronleichnam-he', '2026-06-04', 'Fronleichnam', 'DE-HE'),
  holiday('de-fronleichnam-nw', '2026-06-04', 'Fronleichnam', 'DE-NW'),
  holiday('de-fronleichnam-rp', '2026-06-04', 'Fronleichnam', 'DE-RP'),
  holiday('de-fronleichnam-sl', '2026-06-04', 'Fronleichnam', 'DE-SL'),

  // Mariä Himmelfahrt (Aug 15) — BY, SL
  holiday('de-mariae-by', '2026-08-15', 'Mariä Himmelfahrt', 'DE-BY'),
  holiday('de-mariae-sl', '2026-08-15', 'Mariä Himmelfahrt', 'DE-SL'),

  // Weltkindertag (Sep 20) — TH
  holiday('de-weltkindertag-th', '2026-09-20', 'Weltkindertag', 'DE-TH'),

  // Reformationstag (Oct 31) — BB, HB, HH, MV, NI, SN, ST, SH, TH
  holiday('de-reformation-bb', '2026-10-31', 'Reformationstag', 'DE-BB'),
  holiday('de-reformation-hb', '2026-10-31', 'Reformationstag', 'DE-HB'),
  holiday('de-reformation-hh', '2026-10-31', 'Reformationstag', 'DE-HH'),
  holiday('de-reformation-mv', '2026-10-31', 'Reformationstag', 'DE-MV'),
  holiday('de-reformation-ni', '2026-10-31', 'Reformationstag', 'DE-NI'),
  holiday('de-reformation-sn', '2026-10-31', 'Reformationstag', 'DE-SN'),
  holiday('de-reformation-st', '2026-10-31', 'Reformationstag', 'DE-ST'),
  holiday('de-reformation-sh', '2026-10-31', 'Reformationstag', 'DE-SH'),
  holiday('de-reformation-th', '2026-10-31', 'Reformationstag', 'DE-TH'),

  // Allerheiligen (Nov 1) — BW, BY, NW, RP, SL
  holiday('de-allerheiligen-bw', '2026-11-01', 'Allerheiligen', 'DE-BW'),
  holiday('de-allerheiligen-by', '2026-11-01', 'Allerheiligen', 'DE-BY'),
  holiday('de-allerheiligen-nw', '2026-11-01', 'Allerheiligen', 'DE-NW'),
  holiday('de-allerheiligen-rp', '2026-11-01', 'Allerheiligen', 'DE-RP'),
  holiday('de-allerheiligen-sl', '2026-11-01', 'Allerheiligen', 'DE-SL'),

  // Buß- und Bettag (Nov 18, 2026 — Wednesday before last Sunday of church year) — SN
  holiday('de-busstag-sn', '2026-11-18', 'Buß- und Bettag', 'DE-SN'),
];

// ============================================================================
// C) NATIONAL HOLIDAYS — AUSTRIA
// ============================================================================

const AT_NATIONAL: GlobalEvent[] = [
  holiday('at-neujahr',       '2026-01-01', 'Neujahr',                 'AT'),
  holiday('at-3koenige',      '2026-01-06', 'Heilige Drei Könige',     'AT'),
  holiday('at-ostermontag',   '2026-04-06', 'Ostermontag',             'AT'),
  holiday('at-staatsfeiertag','2026-05-01', 'Staatsfeiertag',          'AT'),
  holiday('at-himmelfahrt',   '2026-05-14', 'Christi Himmelfahrt',     'AT'),
  holiday('at-pfingstmontag', '2026-05-25', 'Pfingstmontag',           'AT'),
  holiday('at-fronleichnam',  '2026-06-04', 'Fronleichnam',            'AT'),
  holiday('at-mariae',        '2026-08-15', 'Mariä Himmelfahrt',       'AT'),
  holiday('at-nationalfeiertag','2026-10-26','Nationalfeiertag',       'AT'),
  holiday('at-allerheiligen', '2026-11-01', 'Allerheiligen',           'AT'),
  holiday('at-mariae-empf',   '2026-12-08', 'Mariä Empfängnis',        'AT'),
  holiday('at-weihnachten1',  '2026-12-25', 'Christtag',              'AT'),
  holiday('at-weihnachten2',  '2026-12-26', 'Stefanitag',             'AT'),
];

// ============================================================================
// D) NATIONAL HOLIDAYS — SWITZERLAND
// ============================================================================

const CH_NATIONAL: GlobalEvent[] = [
  holiday('ch-neujahr',       '2026-01-01', 'Neujahr',             'CH'),
  holiday('ch-karfreitag',    '2026-04-03', 'Karfreitag',          'CH', 'Feiertag in den meisten Kantonen.'),
  holiday('ch-ostermontag',   '2026-04-06', 'Ostermontag',         'CH', 'Feiertag in den meisten Kantonen.'),
  holiday('ch-himmelfahrt',   '2026-05-14', 'Auffahrt',            'CH'),
  holiday('ch-pfingstmontag', '2026-05-25', 'Pfingstmontag',       'CH', 'Feiertag in den meisten Kantonen.'),
  holiday('ch-bundesfeiertag','2026-08-01', 'Bundesfeiertag',      'CH'),
  holiday('ch-weihnachten',   '2026-12-25', 'Weihnachtstag',       'CH'),

  // Berchtoldstag (Jan 2) — ZH, BE, AG, etc.
  holiday('ch-berchtoldstag-zh','2026-01-02', 'Berchtoldstag',     'CH-ZH'),
  holiday('ch-berchtoldstag-be','2026-01-02', 'Berchtoldstag',     'CH-BE'),
  holiday('ch-berchtoldstag-ag','2026-01-02', 'Berchtoldstag',     'CH-AG'),

  // Fronleichnam (Jun 4) — LU, etc.
  holiday('ch-fronleichnam-lu','2026-06-04', 'Fronleichnam',        'CH-LU'),

  // Mariä Himmelfahrt (Aug 15) — LU, etc.
  holiday('ch-mariae-lu',      '2026-08-15', 'Mariä Himmelfahrt',   'CH-LU'),
];

// ============================================================================
// E) ARAS AI UPDATES — Every ~5 days + Monthly + Quarterly
// ============================================================================

function generateArasUpdates(): GlobalEvent[] {
  const events: GlobalEvent[] = [];
  let counter = 0;

  // Every 5 days: "ARAS AI Update"
  const start = new Date(2026, 0, 3); // Jan 3
  const end = new Date(2026, 11, 31);
  const d = new Date(start);
  while (d <= end) {
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    events.push(arasUpdate(
      `update-${counter}`,
      dateStr,
      'ARAS AI Update',
      `Regelmäßiges Plattform-Update. Performance-Verbesserungen, Bugfixes und neue Features. Version 2026.${String(counter + 1).padStart(2, '0')}.`
    ));
    counter++;
    d.setDate(d.getDate() + 5);
  }

  // Monthly Release Notes (1st of each month)
  for (let m = 0; m < 12; m++) {
    const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    const dateStr = `2026-${String(m + 1).padStart(2, '0')}-01`;
    events.push(arasUpdate(
      `monthly-${m}`,
      dateStr,
      `ARAS AI Release Notes — ${monthNames[m]}`,
      `Monatliche Zusammenfassung aller Neuerungen, Verbesserungen und Änderungen der ARAS AI Plattform für ${monthNames[m]} 2026.`
    ));
  }

  // Quarterly Roadmap Review (first Monday of Q)
  const quarterDates = [
    { date: '2026-01-05', q: 'Q1' },
    { date: '2026-04-06', q: 'Q2' },
    { date: '2026-07-06', q: 'Q3' },
    { date: '2026-10-05', q: 'Q4' },
  ];
  quarterDates.forEach(({ date, q }) => {
    events.push(arasUpdate(
      `quarterly-${q}`,
      date,
      `ARAS Quarterly Roadmap Review — ${q} 2026`,
      `Quartalsweise Roadmap-Überprüfung. Strategische Ausrichtung, Feature-Priorisierung und Meilensteine für ${q} 2026.`
    ));
  });

  return events;
}

// ============================================================================
// F) YEAR MARKERS — Q starts/ends, DST, etc.
// ============================================================================

const YEAR_MARKERS: GlobalEvent[] = [
  // Quarter boundaries
  marker('q1-start', '2026-01-01', 'Q1 2026 Start',     'Beginn des ersten Quartals 2026.'),
  marker('q1-end',   '2026-03-31', 'Q1 2026 Ende',      'Ende des ersten Quartals 2026.'),
  marker('q2-start', '2026-04-01', 'Q2 2026 Start',     'Beginn des zweiten Quartals 2026.'),
  marker('q2-end',   '2026-06-30', 'Q2 2026 Ende',      'Ende des zweiten Quartals 2026. Halbjahresabschluss.'),
  marker('q3-start', '2026-07-01', 'Q3 2026 Start',     'Beginn des dritten Quartals 2026.'),
  marker('q3-end',   '2026-09-30', 'Q3 2026 Ende',      'Ende des dritten Quartals 2026.'),
  marker('q4-start', '2026-10-01', 'Q4 2026 Start',     'Beginn des vierten Quartals 2026.'),
  marker('q4-end',   '2026-12-31', 'Q4 2026 Ende',      'Ende des vierten Quartals 2026. Jahresabschluss.'),

  // DST Europe 2026
  marker('dst-start', '2026-03-29', 'Sommerzeit beginnt (MESZ)',   'Uhren werden um 02:00 Uhr um eine Stunde vorgestellt (UTC+2).'),
  marker('dst-end',   '2026-10-25', 'Winterzeit beginnt (MEZ)',    'Uhren werden um 03:00 Uhr um eine Stunde zurückgestellt (UTC+1).'),

  // Notable dates
  marker('silvester',  '2026-12-31', 'Silvester',         'Letzter Tag des Jahres 2026.'),
  marker('heiligabend','2026-12-24', 'Heiligabend',       'Heiligabend. In vielen Betrieben halber Arbeitstag.'),

  // =========================================================================
  // KULTURELLE GEDENK- & AKTIONSTAGE — Fills every month
  // =========================================================================
  // Easter 2026 = April 5. Karneval dates relative to Easter.

  // JANUAR
  marker('holocaust-gedenktag', '2026-01-27', 'Holocaust-Gedenktag',    'Internationaler Tag des Gedenkens an die Opfer des Holocaust.'),

  // FEBRUAR — Karneval / Fasching (Easter - 52..46 Tage)
  marker('weiberfastnacht',  '2026-02-12', 'Weiberfastnacht',       'Beginn des Straßenkarnevals. Altweiber.'),
  marker('valentinstag',     '2026-02-14', 'Valentinstag',           'Tag der Liebenden.'),
  marker('rosenmontag',      '2026-02-16', 'Rosenmontag',           'Höhepunkt des rheinischen Karnevals. In vielen Betrieben arbeitsfrei.'),
  marker('fastnacht',        '2026-02-17', 'Fastnacht',             'Faschingsdienstag / Veilchendienstag. Letzter Tag vor der Fastenzeit.'),
  marker('aschermittwoch',   '2026-02-18', 'Aschermittwoch',        'Beginn der 40-tägigen Fastenzeit vor Ostern.'),

  // MÄRZ
  marker('fruehlingsanfang', '2026-03-20', 'Frühlingsanfang',       'Astronomischer Frühlingsbeginn (Tag-und-Nacht-Gleiche).'),

  // APRIL
  marker('gründonnerstag',   '2026-04-02', 'Gründonnerstag',        'Vorabend des Karfreitags. Beginn des Osterwochenendes.'),

  // MAI
  marker('europatag',        '2026-05-09', 'Europatag',             'Tag der Europäischen Union.'),
  marker('muttertag',        '2026-05-10', 'Muttertag',             'Muttertag — zweiter Sonntag im Mai.'),

  // JUNI
  marker('sommersonnenwende','2026-06-21', 'Sommersonnenwende',     'Längster Tag des Jahres. Astronomischer Sommerbeginn.'),
  marker('vatertag-ch',      '2026-06-07', 'Vätertag (CH)',         'Schweizer Vätertag — erster Sonntag im Juni.'),

  // JULI
  marker('ch-schuetzenfest', '2026-07-11', 'Eidg. Schützenfest',    'Traditioneller Schweizer Festanlass.'),

  // AUGUST
  marker('friedensfest-aug', '2026-08-08', 'Augsburger Friedensfest','Regionaler Feiertag in Augsburg (DE-BY).'),

  // SEPTEMBER
  marker('herbstanfang',     '2026-09-22', 'Herbstanfang',          'Astronomischer Herbstbeginn (Tag-und-Nacht-Gleiche).'),
  marker('erntedankfest',    '2026-10-04', 'Erntedankfest',         'Erster Sonntag im Oktober. Kirchliches Fest.'),

  // OKTOBER
  marker('halloween',        '2026-10-31', 'Halloween',             'Kulturell gefeierter Vorabend von Allerheiligen.'),

  // NOVEMBER
  marker('martinstag',       '2026-11-11', 'Martinstag',            'St. Martin — Laternenumzüge und Gänseessen.'),
  marker('volkstrauertag',   '2026-11-15', 'Volkstrauertag',        'Nationaler Gedenktag für die Opfer von Krieg und Gewalt.'),
  marker('totensonntag',     '2026-11-22', 'Totensonntag',          'Evangelischer Gedenktag für die Verstorbenen. Stiller Feiertag.'),
  marker('1-advent',         '2026-11-29', '1. Advent',             'Erster Advent — Beginn der Adventszeit.'),

  // DEZEMBER
  marker('nikolaus',         '2026-12-06', 'Nikolaustag',           'Nikolaustag — Kinder erhalten Geschenke.'),
  marker('2-advent',         '2026-12-06', '2. Advent',             'Zweiter Advent.'),
  marker('3-advent',         '2026-12-13', '3. Advent',             'Dritter Advent.'),
  marker('4-advent',         '2026-12-20', '4. Advent',             'Vierter Advent — letzter Sonntag vor Weihnachten.'),
  marker('wintersonnenwende','2026-12-21', 'Wintersonnenwende',     'Kürzester Tag des Jahres. Astronomischer Winterbeginn.'),
];

// ============================================================================
// EXPORT: All global events for 2026
// ============================================================================

let _cachedEvents: GlobalEvent[] | null = null;

export function getGlobalEvents2026(): GlobalEvent[] {
  if (_cachedEvents) return _cachedEvents;
  _cachedEvents = [
    ...DE_NATIONAL,
    ...DE_REGIONAL,
    ...AT_NATIONAL,
    ...CH_NATIONAL,
    ...generateArasUpdates(),
    ...YEAR_MARKERS,
  ];
  return _cachedEvents;
}

// Filter categories for UI
export const GLOBAL_EVENT_FILTERS = [
  { id: 'holiday' as const, label: 'Feiertage (national)', defaultOn: true },
  { id: 'holiday_regional' as const, label: 'Regionale Feiertage', defaultOn: true },
  { id: 'aras_update' as const, label: 'ARAS AI Updates', defaultOn: true },
  { id: 'marker' as const, label: 'Jahresmarker', defaultOn: true },
] as const;

// Color map for global event categories
export const GLOBAL_EVENT_COLORS: Record<GlobalEventCategory, string> = {
  holiday: '#6B7280',
  holiday_regional: '#9CA3AF',
  aras_update: '#FE9100',
  marker: '#a34e00',
};

export const GLOBAL_EVENT_LABELS: Record<GlobalEventCategory, string> = {
  holiday: 'Feiertag',
  holiday_regional: 'Regional',
  aras_update: 'ARAS Update',
  marker: 'Marker',
};

/**
 * Returns the next upcoming global event from today.
 * Used by SpaceCalendarBanner.
 */
export function getNextGlobalEvent(fromDate?: string): GlobalEvent | null {
  const today = fromDate || new Date().toISOString().slice(0, 10);
  const events = getGlobalEvents2026();
  const upcoming = events
    .filter(e => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  return upcoming[0] || null;
}
