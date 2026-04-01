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
    // Find the nav brand block: small container with "INVESTOR OVERVIEW" text inside nav
    const nav = document.querySelector('nav, header');
    if (!nav) return;

    // Walk all elements inside nav, find the one with "INVESTOR OVERVIEW" text
    const navEls = nav.querySelectorAll('*');
    for (const el of navEls) {
      const text = (el.textContent || '').trim();
      if (
        text.includes('INVESTOR OVERVIEW') &&
        text.length < 100 &&
        !el._rosieReplaced
      ) {
        el._rosieReplaced = true;
        el.innerHTML = '<img src="' + LOGO + '" style="height:55px;width:auto;object-fit:contain;display:block;" />';
        break;
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyChanges);
  } else {
    applyChanges();
  }
  setTimeout(applyChanges, 500);
  setTimeout(applyChanges, 1500);
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