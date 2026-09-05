// popup.js
// Ya no leemos chrome.storage.local: le preguntamos directamente al
// background.js "¿qué encontraste en esta pestaña?", porque es él quien
// tiene el resultado agregado de todos los frames (documento + iframes).

async function loadResults() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const statusEl = document.getElementById("status");
  const resultEl = document.getElementById("result");

  if (!tab?.id) {
    statusEl.textContent = "No se pudo identificar la pestaña activa.";
    return;
  }

  chrome.runtime.sendMessage({ type: "GET_RESULTS", tabId: tab.id }, (data) => {
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
  });
}

loadResults();
