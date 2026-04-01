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
    // 1. TOP-LEFT NAV: Replace the nav img with our logo
    const nav = document.querySelector('nav, header');
    if (nav) {
      const existingImg = nav.querySelector('img');
      if (existingImg && !existingImg._rosieReplaced) {
        existingImg._rosieReplaced = true;
        existingImg.src = LOGO;
        existingImg.style.cssText = 'height: 60px; width: auto; object-fit: contain;';
      }
    }

    // 2. HERO BADGE: Hide the circular badge above the headline (has img + "Rosie" text, NOT in nav)
    const containers = document.querySelectorAll('div, section, figure');
    for (const el of containers) {
      const text = (el.textContent || '').trim();
      if (
        text.length < 30 &&
        text.includes('Rosie') &&
        el.querySelector('img') &&
        !el._rosieBadgeHidden
      ) {
        let inNav = false;
        let parent = el.parentElement;
        for (let i = 0; i < 6; i++) {
          if (!parent) break;
          const tag = (parent.tagName || '').toLowerCase();
          if (tag === 'nav' || tag === 'header') { inNav = true; break; }
          parent = parent.parentElement;
        }
        if (!inNav) {
          el._rosieBadgeHidden = true;
          el.style.display = 'none';
          break;
        }
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