// Veilig een website ophalen: we controleren of een adres openbaar is, zodat de
// scanner geen interne adressen (zoals de server zelf) kan bezoeken.
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const MAX_REDIRECTS = 5;      // maximaal aantal doorverwijzingen
const MAX_HTML = 2_000_000;   // tekens; voorkomt heel grote pagina's

// Invoerfout of geblokkeerd adres; de server geeft hiervoor status 400.
export class UrlError extends Error {}

// "voorbeeld.nl" -> https://voorbeeld.nl, en weiger ongeldige invoer.
export function parseUrl(input) {
  let text = String(input || '').trim();
  if (!text) throw new UrlError('Vul een website-URL in.');
  if (!text.includes('://')) text = 'https://' + text;

  let url;
  try { url = new URL(text); }
  catch { throw new UrlError('Dit is geen geldige URL.'); }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UrlError('Alleen http en https zijn toegestaan.');
  }
  if (url.username || url.password) {
    throw new UrlError('URLs met een gebruikersnaam of wachtwoord zijn niet toegestaan.');
  }
  return url;
}

// Hoort dit adres bij een intern netwerk? Dan mag de scanner het niet bezoeken.
// Voorbeelden: 10.x, 192.168.x, 127.x (deze computer), 169.254.x en ::1.
export function isPrivateIp(ip) {
  const kind = isIP(ip); // 4 = IPv4, 6 = IPv6, 0 = geen geldig IP

  if (kind === 4) {
    const parts = ip.split('.'); // "192.168.0.1" -> ["192", "168", "0", "1"]
    const first = Number(parts[0]);
    const second = Number(parts[1]);
    if (first === 0) return true;                     // onbekend adres
    if (first === 10) return true;                    // bedrijfsnetwerk
    if (first === 127) return true;                   // de computer zelf
    if (first === 169 && second === 254) return true; // lokaal netwerk
    if (first === 172 && second >= 16 && second <= 31) return true; // bedrijfsnetwerk
    if (first === 192 && second === 168) return true; // bedrijfsnetwerk
    if (first >= 224) return true;                    // gereserveerd
    return false;
  }

  if (kind === 6) {
    const addr = ip.toLowerCase();
    if (addr === '::1' || addr === '::') return true; // deze computer / onbekend
    if (addr.startsWith('::ffff:')) return true;      // bevat een IPv4-adres
    if (addr.startsWith('fc') || addr.startsWith('fd')) return true; // lokaal
    if (addr.startsWith('fe80')) return true;         // lokaal
    return false;
  }

  return true; // geen geldig IP: niet bezoeken
}

// Controleert of de host openbaar is. Zo niet: UrlError.
async function assertPublicHost(url) {
  let host = url.hostname;
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1); // "[::1]" -> "::1"
  if (host === 'localhost' || host.endsWith('.localhost')) {
    throw new UrlError('Verzoeken naar localhost zijn niet toegestaan.');
  }

  // Verzamel de adressen: het IP zelf, of de adressen die bij de naam horen.
  let addresses = [host];
  if (!isIP(host)) {
    try { addresses = (await lookup(host, { all: true })).map((a) => a.address); }
    catch { return; } // DNS lukt niet; de fetch meldt straks "onbereikbaar"
  }

  // Elk adres moet openbaar zijn.
  for (const address of addresses) {
    if (isPrivateIp(address)) throw new UrlError('Verzoeken naar interne adressen zijn niet toegestaan.');
  }
}

// Haalt een pagina op. Bij een redirect controleren we de nieuwe link opnieuw.
// Geeft { finalUrl, status, html }; html is null als het geen HTML-pagina is.
export async function fetchPage(startUrl, signal) {
  let url = startUrl;
  for (let attempt = 0; attempt <= MAX_REDIRECTS; attempt++) {
    await assertPublicHost(url);
    const res = await fetch(url, {
      redirect: 'manual',
      signal,
      headers: { 'User-Agent': 'APK-Scanner/0.1' },
    });

    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      if (res.body) await res.body.cancel();
      url = new URL(location, url);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new UrlError('Doorverwezen naar een niet-http adres.');
      }
      continue;
    }

    let html = null;
    if ((res.headers.get('content-type') || '').includes('text/html')) {
      html = (await res.text()).slice(0, MAX_HTML);
    } else if (res.body) {
      await res.body.cancel();
    }
    return { finalUrl: url, status: res.status, html };
  }
  throw new UrlError('Te veel doorverwijzingen.');
}
