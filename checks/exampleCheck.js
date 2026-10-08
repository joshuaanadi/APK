// Voorbeeldcheck: de technische basis van de homepage.
// Elke check: lees de HTML, bepaal per signaal aanwezig/deels/afwezig,
// reken de score uit (1-10) en verzamel verbeterpunten.
import * as cheerio from 'cheerio';

// Punten per status.
const POINTS = { present: 1, partial: 0.5, absent: 0 };

// Elk signaal: [naam, check(ctx), probleem, tip]. De check geeft 'present',
// 'partial', 'absent' of 'unsure' ('unsure' telt niet mee voor de score).
const SIGNALS = [
  ['Beveiligde verbinding (HTTPS)', (c) => (c.https ? 'present' : 'absent'),
    'De website gebruikt geen beveiligde verbinding (HTTPS).',
    'Vraag je hostingpartij om een SSL-certificaat; dat is vaak gratis.'],
  ['Mobielvriendelijk (viewport)', (c) => (c.viewport ? 'present' : 'absent'),
    'De site is niet ingesteld voor mobiel (geen viewport-instelling).',
    'Voeg een meta-viewport toe zodat de site op mobiel goed schaalt.'],
  ['Taal van de pagina ingesteld', (c) => (c.lang ? 'present' : 'absent'),
    'De taal van de pagina is niet ingesteld (geen lang-attribuut).',
    'Zet lang="nl" op het <html>-element voor toegankelijkheid en SEO.'],
  ['Afbeeldingen met beschrijving (alt)', (c) => {
    if (c.images === 0) return 'unsure';
    if (c.imagesWithAlt === c.images) return 'present';
    return c.imagesWithAlt > 0 ? 'partial' : 'absent';
  },
    'Afbeeldingen missen een beschrijving (alt-tekst).',
    'Geef elke afbeelding een korte alt-tekst; dat helpt bij toegankelijkheid en SEO.'],
];

// Beoordeelt de HTML. Geeft { category, score, signals, issues }.
export function checkExample(html, url) {
  const $ = cheerio.load(html || '');

  // Tel de afbeeldingen en hoeveel er een alt-tekst hebben.
  let images = 0;
  let imagesWithAlt = 0;
  for (const img of $('img').toArray()) {
    images++;
    if (($(img).attr('alt') || '').trim()) imagesWithAlt++;
  }

  const ctx = {
    https: url.protocol === 'https:',
    viewport: $('meta[name="viewport"]').length > 0,
    lang: ($('html').attr('lang') || '').length > 0,
    images,
    imagesWithAlt,
  };

  const signals = [];
  const issues = [];
  for (const [name, check, problem, tip] of SIGNALS) {
    const status = check(ctx);
    signals.push({ label: name, status });
    if (status === 'absent' || status === 'partial') {
      issues.push({ severity: status === 'absent' ? 'middel' : 'laag', message: problem, suggestion: tip });
    }
  }

  // Score: punten van de signalen die meetellen, omgezet naar 1 t/m 10.
  const scored = signals.filter((s) => s.status !== 'unsure');
  let points = 0;
  for (const signal of scored) points += POINTS[signal.status];
  const share = scored.length > 0 ? points / scored.length : 0;
  const score = Math.round((1 + 9 * share) * 10) / 10;

  return { category: 'Technische basis', score, signals, issues };
}
