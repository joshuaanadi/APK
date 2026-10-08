// Leest het formulier uit, vraagt de server om een scan en toont het resultaat.
const byId = (id) => document.getElementById(id);

// Nette tekst per status.
const STATUS = { present: 'Aanwezig', partial: 'Deels', absent: 'Ontbreekt', unsure: 'Te controleren' };

// Maakt een HTML-element met tekst erin (veilig via textContent).
function el(tag, text) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  return node;
}

byId('scan-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  byId('error').hidden = true;
  byId('result').hidden = true;
  byId('scan-btn').disabled = true;
  byId('scan-btn').textContent = 'Bezig met scannen…';
  try {
    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: byId('url').value, companyName: byId('company').value, city: byId('city').value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Scan mislukt.');
    showResult(data);
  } catch (err) {
    byId('error').textContent = err.message;
    byId('error').hidden = false;
  } finally {
    byId('scan-btn').disabled = false;
    byId('scan-btn').textContent = 'Scan';
  }
});

function showResult(data) {
  byId('status').textContent = data.isOnline ? 'De website is online' : 'De website is offline';
  byId('status').className = data.isOnline ? 'ok' : 'bad';
  byId('score').textContent = data.score == null ? '' : `Eindscore: ${data.score} / 10`; // null = geen score

  byId('details').replaceChildren();
  for (const row of [
    { label: 'URL', value: data.finalUrl },
    { label: 'Statuscode', value: data.statusCode },
  ]) byId('details').append(el('dt', row.label), el('dd', String(row.value)));

  byId('checks').replaceChildren();
  if (data.technical) byId('checks').append(renderCheck(data.technical));
  byId('result').hidden = false;
}

// Tekent één check: score, signalen en verbeterpunten.
function renderCheck(check) {
  const box = el('div');
  box.append(el('h3', `${check.category}: ${check.score} / 10`));

  const list = el('ul');
  for (const s of check.signals) {
    const item = el('li', `${STATUS[s.status]}: ${s.label}`);
    item.className = s.status;
    list.append(item);
  }
  box.append(list);

  if (check.issues.length) {
    box.append(el('h4', 'Verbeterpunten'));
    const issues = el('ul');
    for (const i of check.issues) issues.append(el('li', `${i.message} ${i.suggestion}`));
    box.append(issues);
  }
  return box;
}
