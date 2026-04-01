import { useEffect, useState } from "react";

const NEW_LOGO_URL = "https://media.base44.com/images/public/69cd2741578c9b5ce655395b/d28cac677_Untitleddesign3.png";
const HTML_URL = "https://raw.githubusercontent.com/chainwavestudios-cyber/agentbmaninvest/main/agentbman-pitchbook-v3.html";

export default function Home() {
  const [blobUrl, setBlobUrl] = useState(null);

  useEffect(() => {
    fetch(HTML_URL)
      .then((r) => r.text())
      .then((html) => {
        let modified = html.replaceAll("AgentBman", "Rosie").replaceAll("agentbman", "rosie");

        // After text replacement, "Investor Overview · 2026" is in nav brand block
        // Use a TreeWalker to find that exact text node, walk up to the brand container, replace it
        const injectedScript = `
<script>
(function() {
  const LOGO = "${NEW_LOGO_URL}";

  function applyChanges() {
    // Use TreeWalker to find the text node with "Investor Overview · 2026"
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while ((node = walker.nextNode())) {
      const text = node.nodeValue || '';
      if (text.includes('Investor Overview') && text.includes('2026')) {
        // Walk up to find a container that's inside nav and has sibling icon/img
        let el = node.parentElement;
        // Go up a few levels to find the brand container (the one that holds icon + name + subtitle)
        for (let i = 0; i < 4; i++) {
          if (!el || !el.parentElement) break;
          const parent = el.parentElement;
          const tag = (parent.tagName || '').toLowerCase();
          // Stop if we'd go above the nav
          if (tag === 'nav' || tag === 'header') break;
          el = parent;
        }
        if (el && !el._rosieReplaced) {
          el._rosieReplaced = true;
          el.innerHTML = '<img src="' + LOGO + '" style="height:55px;width:auto;object-fit:contain;display:block;" />';
        }
        break;
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyChanges);
  } else {
    applyChanges();
  }
  setTimeout(applyChanges, 300);
  setTimeout(applyChanges, 1000);
})();
</script>
`;

        modified = modified.replace("</body>", `${injectedScript}</body>`);

        const blob = new Blob([modified], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
        return () => URL.revokeObjectURL(url);
      });
  }, []);

  return (
    <div className="w-full h-screen">
      {blobUrl ? (
        <iframe src={blobUrl} className="w-full h-full border-0" title="Rosie Pitchbook" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-500">Loading...</div>
      )}
    </div>
  );
}