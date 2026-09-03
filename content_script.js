// content_script.js
// Este script se inyecta en CADA página que visitás (ver "matches" en manifest.json).
// Su trabajo: buscar frases de riesgo en el texto visible y resaltarlas.

// --- Fase 3: motor de reglas (sin IA todavía) ---
// Cada objeto tiene la frase a detectar y una "traducción" placeholder.
// En la Fase 6 esto se va a reemplazar por la respuesta real del backend/NLP.
const RISK_PHRASES = [
  { match: /compartir(\s\w+){0,3}\sterceros/gi, label: "Tus datos pueden pasar a otras empresas." },
  { match: /datos\sbiométricos/gi, label: "Piden datos de tu cuerpo (huellas, cara, voz)." },
  { match: /venta\sde\sdatos/gi, label: "Pueden vender tu información." },
  { match: /ubicación\sen\stiempo\sreal/gi, label: "Saben dónde estás en cada momento." },
  { match: /perpetuidad/gi, label: "Se quedan con el permiso para siempre, sin fecha de vencimiento." },
  { match: /sin\sposibilidad\sde\seliminación/gi, label: "No podés borrar tus datos después." },
  { match: /reconocimiento\sfacial/gi, label: "Analizan tu cara para identificarte." },
  { match: /grabación\sde\svoz/gi, label: "Guardan grabaciones de tu voz." },
];

/**
 * Recorre los nodos de texto del documento y envuelve las coincidencias
 * en un <mark class="cc-risk"> con un tooltip (title).
 * Usamos TreeWalker en vez de innerHTML para no romper el resto de la página.
 */
function highlightRiskyText(root, matches) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      // Ignoramos texto dentro de <script>, <style> o que ya esté resaltado
      const parentTag = node.parentElement?.tagName;
      if (["SCRIPT", "STYLE", "MARK"].includes(parentTag)) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const nodesToProcess = [];
  let node;
  while ((node = walker.nextNode())) {
    for (const rule of RISK_PHRASES) {
      rule.match.lastIndex = 0; // reset regex global state
      if (rule.match.test(node.nodeValue)) {
        nodesToProcess.push(node);
        break;
      }
    }
  }

  nodesToProcess.forEach((textNode) => {
    let html = textNode.nodeValue;
    RISK_PHRASES.forEach((rule) => {
      rule.match.lastIndex = 0;
      const found = html.match(rule.match); // ¿cuántas veces matcheó ESTA regla en ESTE nodo?
      if (!found) return; // nada que hacer, no sumamos ni reemplazamos

      matches.push(...found.map(() => rule.label)); // una entrada por cada ocurrencia real
      rule.match.lastIndex = 0;
      html = html.replace(
        rule.match,
        (match) => `<mark class="cc-risk" title="${rule.label}">${match}</mark>`
      );
    });

    const span = document.createElement("span");
    span.innerHTML = html;
    textNode.replaceWith(span);
  });
}

function scanPage() {
  const foundLabels = [];
  highlightRiskyText(document.body, foundLabels);

  // Guardamos el resultado para que el popup lo pueda leer.
  chrome.storage.local.set({
    [window.location.href]: {
      count: foundLabels.length,
      labels: [...new Set(foundLabels)], // sin duplicados
      scannedAt: Date.now(),
    },
  });
}

// Corremos el escaneo cuando la página termina de cargar.
scanPage();

// Bonus: si el popup de cookies aparece DESPUÉS (muy común), lo detectamos
// observando cambios en el DOM y re-escaneando (con un pequeño debounce).
let debounceTimer;
const observer = new MutationObserver(() => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(scanPage, 800);
});
observer.observe(document.body, { childList: true, subtree: true });
