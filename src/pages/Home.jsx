import { useEffect, useState } from "react";

const LOGO_URL = "https://media.base44.com/images/public/69cd2741578c9b5ce655395b/39a31f9b9_Untitleddesign3.png";
const HTML_URL = "https://rawcdn.githack.com/chainwavestudios-cyber/agentbmaninvest/main/agentbman-pitchbook-v3.html";

export default function Home() {
  const [blobUrl, setBlobUrl] = useState(null);

  useEffect(() => {
    fetch(HTML_URL)
      .then((r) => r.text())
      .then((html) => {
        let modified = html.replaceAll("AgentBman", "Rosie").replaceAll("agentbman", "rosie");

        const injectedScript = `
<script>
(function() {
  const LOGO = "${LOGO_URL}";

  function applyChanges() {
    // Find the top-left brand block: contains lightning bolt icon + "Rosie" + "Investor Overview · 2026"
    // Strategy: find any element with short text containing "Investor Overview" and hide/replace its container
    const allElements = Array.from(document.querySelectorAll('*'));
    for (const el of allElements) {
      const text = el.textContent || '';
      if (
        text.length < 300 &&
        (text.includes('Investor Overview') || text.includes('INVESTOR OVERVIEW')) &&
        text.includes('2026')
      ) {
        if (!el._rosieReplaced) {
          el._rosieReplaced = true;
          const logoImg = document.createElement('img');
          logoImg.src = LOGO;
          logoImg.style.cssText = 'height: 80px; width: auto; object-fit: contain; display: block;';
          el.replaceWith(logoImg);
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
  setTimeout(applyChanges, 2500);
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