import { useEffect, useState } from "react";

const LOGO_URL = "https://media.base44.com/images/public/69cd2741578c9b5ce655395b/39a31f9b9_Untitleddesign3.png";
const HERO_LOGO_URL = "https://media.base44.com/images/public/69cd2741578c9b5ce655395b/d28cac677_Untitleddesign3.png"; "https://media.base44.com/images/public/69cd2741578c9b5ce655395b/39a31f9b9_Untitleddesign3.png";
const HTML_URL = "https://rawcdn.githack.com/chainwavestudios-cyber/agentbmaninvest/main/agentbman-pitchbook-v3.html";

export default function Home() {
  const [blobUrl, setBlobUrl] = useState(null);

  useEffect(() => {
    fetch(HTML_URL)
      .then((r) => r.text())
      .then((html) => {
        let modified = html.replaceAll("AgentBman", "Rosie").replaceAll("agentbman", "rosie").replaceAll("50.5 GW → 330GW (2032)", "50.5 GW → 330GW").replaceAll("Installed in 2025 alone · $200B+ US market", "2025 → 2032 · Global Market");

        const injectedScript = `
<script>
(function() {
  const LOGO = "${LOGO_URL}";

  function applyChanges() {
    // Find the nav brand block: small container with "INVESTOR OVERVIEW" text inside nav
    const nav = document.querySelector('nav, header');
    if (!nav) return;

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

    // Insert hero logo image below the main headline
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      const text = (el.textContent || '').toLowerCase();
      if (text.includes('ai engine') && text.includes('every lead')) {
        // Check if image already added to avoid duplicates
        if (el.nextElementSibling && el.nextElementSibling.tagName === 'IMG' && el.nextElementSibling.src.includes('d28cac677')) {
          return;
        }
        const img = document.createElement('img');
        img.src = HERO_LOGO_URL;
        img.style.cssText = 'display:block;margin:24px auto 0;width:180px;height:auto;';
        if (el.parentNode) {
          el.parentNode.insertBefore(img, el.nextSibling);
        }
        return;
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