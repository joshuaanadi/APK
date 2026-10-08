// De server van de Website APK-scanner.
// Draaien:  npm install  ->  npm start  ->  http://localhost:3000
// Eén route: POST /api/scan. Die haalt de website op en draait de checks.
import express from 'express';
import path from 'node:path';
import { parseUrl, fetchPage, UrlError } from './safeFetch.js';
import { checkExample } from './checks/exampleCheck.js';

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = path.join(import.meta.dirname, 'public'); // de map met de website-bestanden

app.use(express.json());
app.use(express.static(publicDir, { index: 'homepage.html' }));

// Schoont een tekstveld op: spaties eraf, max. 100 tekens.
const clean = (value) => String(value || '').trim().slice(0, 100);

// Ontvangt url, bedrijfsnaam en plaats; stuurt het resultaat terug.
app.post('/api/scan', async (req, res) => {
  try {
    // 1. Invoer controleren en de homepage ophalen (max. 10 sec).
    const body = req.body || {};
    const url = parseUrl(body.url);
    const page = await fetchPage(url, AbortSignal.timeout(10000));

    // 2. Checks draaien. Voeg hier nieuwe checks toe.
    const technical = page.html ? checkExample(page.html, page.finalUrl) : null;

    // 3. Eindscore (met één check is dat die score).
    const score = technical ? technical.score : null;

    // 4. Resultaat terugsturen.
    res.json({
      url: url.href,
      companyName: clean(body.companyName),
      city: clean(body.city),
      isOnline: page.status < 500, // 500 of hoger = serverfout
      statusCode: page.status,
      finalUrl: page.finalUrl.href,
      score,
      technical,
    });
  } catch (err) {
    if (err instanceof UrlError) return res.status(400).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Er ging iets mis bij het scannen.' });
  }
});

app.listen(PORT, () => console.log(`APK-scanner draait op http://localhost:${PORT}`));
