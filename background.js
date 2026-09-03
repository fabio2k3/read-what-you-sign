// background.js
// Con "all_frames": true, cada iframe de la página corre SU PROPIA copia
// de content_script.js, de forma aislada. Este service worker es el punto
// central donde todos esos frames reportan lo que encontraron, para que
// el popup pueda pedir "el resultado total de esta pestaña" en un solo lugar.

// Estructura: tabId -> Map(frameId -> { count, labels })
// Guardamos por frameId (no solo por tabId) porque cada frame recalcula
// su propio resultado de cero en cada scan; si mezcláramos todo en una sola
// entrada por pestaña, un frame podría pisar los resultados de otro.
const resultsByTab = new Map();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SCAN_RESULT") {
    const tabId = sender.tab?.id;
    if (tabId == null) return; // mensaje sin pestaña asociada, lo ignoramos

    if (!resultsByTab.has(tabId)) {
      resultsByTab.set(tabId, new Map());
    }
    resultsByTab.get(tabId).set(sender.frameId, {
      count: message.count,
      labels: message.labels,
    });
    return; // no hace falta responder nada acá
  }

  if (message.type === "GET_RESULTS") {
    const frames = resultsByTab.get(message.tabId);
    if (!frames || frames.size === 0) {
      sendResponse(null);
      return;
    }

    const allLabels = [];
    frames.forEach((frameData) => allLabels.push(...frameData.labels));

    sendResponse({
      count: allLabels.length,
      labels: [...new Set(allLabels)], // sin duplicados para mostrar
    });
    return true; // indica que la respuesta puede ser asíncrona
  }
});

// Cuando la pestaña empieza a cargar una URL nueva, limpiamos lo acumulado.
// Si no hiciéramos esto, verías resultados "fantasma" de la página anterior
// mezclados con la nueva.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    resultsByTab.delete(tabId);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => resultsByTab.delete(tabId));
