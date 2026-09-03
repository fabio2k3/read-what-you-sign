// popup.js
// El popup no puede tocar el DOM de la página directamente, así que lee
// lo que el content_script.js ya guardó en chrome.storage.local.

async function loadResults() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return;

  const stored = await chrome.storage.local.get(tab.url);
  const data = stored[tab.url];

  const statusEl = document.getElementById("status");
  const resultEl = document.getElementById("result");

  if (!data) {
    statusEl.textContent = "Todavía no hay análisis para esta página.";
    return;
  }

  if (data.count === 0) {
    statusEl.innerHTML = `<span class="empty">✅ No se detectaron frases de riesgo conocidas.</span>`;
    return;
  }

  statusEl.innerHTML = `<span id="count">${data.count}</span> coincidencia(s) de riesgo:`;
  const list = document.createElement("ul");
  data.labels.forEach((label) => {
    const li = document.createElement("li");
    li.textContent = label;
    list.appendChild(li);
  });
  resultEl.appendChild(list);
}

loadResults();
