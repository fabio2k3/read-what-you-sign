// content_script.js
// Con "all_frames": true en el manifest, este script se ejecuta una vez
// POR CADA frame de la página (el documento principal + cada iframe).
// Cada instancia es independiente y no sabe nada de las demás — por eso
// reportamos nuestros resultados al background.js en vez de intentar
// coordinarnos entre frames nosotros mismos.

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
 * Busca recursivamente todos los shadowRoot dentro de un nodo raíz.
 * Devuelve una lista de raíces para escanear: el nodo original + cada
 * shadowRoot encontrado (incluyendo shadow roots anidados dentro de otros).
 *
 * Limitación conocida: solo detecta shadow roots en modo "open".
 * Los de modo "closed" son intencionalmente inaccesibles desde JS externo,
 * ni siquiera una extensión puede leerlos — es una limitación del navegador,
 * no nuestra.
 */
function collectShadowRoots(root, acc = [root]) {
  const elements = root.querySelectorAll("*");
  elements.forEach((el) => {
    if (el.shadowRoot) {
      acc.push(el.shadowRoot);
      collectShadowRoots(el.shadowRoot, acc); // por si hay shadow DOM anidado
    }
  });
  return acc;
}

function highlightRiskyText(root, matches) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
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
      rule.match.lastIndex = 0;
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
      const found = html.match(rule.match);
      if (!found) return;

      matches.push(...found.map(() => rule.label));
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

// Acumulamos los matches de TODA la vida de este frame (no solo del último
// scan), porque el MutationObserver puede disparar varios scans sucesivos
// a medida que aparece contenido nuevo (por ejemplo, un banner de cookies
// que carga con delay).
let allMatches = [];

function scanPage() {
  const newMatches = [];
  const roots = collectShadowRoots(document);
  roots.forEach((root) => highlightRiskyText(root, newMatches));

  if (newMatches.length > 0) {
    allMatches.push(...newMatches);
  }

  chrome.runtime.sendMessage({
    type: "SCAN_RESULT",
    count: allMatches.length,
    labels: allMatches,
  });
}

scanPage();

let debounceTimer;
const observer = new MutationObserver(() => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(scanPage, 800);
});
observer.observe(document.body, { childList: true, subtree: true });
