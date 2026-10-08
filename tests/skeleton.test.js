// Kleine tests. Draaien met: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseUrl, isPrivateIp, UrlError } from '../safeFetch.js';
import { checkExample } from '../checks/exampleCheck.js';

test('parseUrl vult https aan en blokkeert ongeldige invoer', () => {
  assert.equal(parseUrl('voorbeeld.nl').href, 'https://voorbeeld.nl/');
  assert.throws(() => parseUrl(''), UrlError);
  assert.throws(() => parseUrl('ftp://voorbeeld.nl'), UrlError);
});

test('isPrivateIp herkent interne adressen', () => {
  assert.equal(isPrivateIp('192.168.1.1'), true);
  assert.equal(isPrivateIp('127.0.0.1'), true);
  assert.equal(isPrivateIp('8.8.8.8'), false);
});

test('checkExample geeft een score tussen 1 en 10', () => {
  const html = '<html lang="nl"><head><meta name="viewport" content="width=device-width"></head><body><img src="a.jpg" alt="foto"></body></html>';
  const result = checkExample(html, new URL('https://voorbeeld.nl'));
  assert.equal(result.category, 'Technische basis');
  assert.ok(result.score >= 1 && result.score <= 10);
  assert.equal(result.signals.find((s) => s.label === 'Beveiligde verbinding (HTTPS)').status, 'present');
});
