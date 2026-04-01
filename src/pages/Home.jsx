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

  function applyTopLeftLogo() {
    const allElements = Array.from(document.querySelectorAll('*'));
    for (const el of allElements) {
      const text = el.textContent || '';
      if (
        text.length < 200 &&
        (text.includes('Investor Overview') || text.includes('INVESTOR OVERVIEW')) &&
        text.includes('2026') &&
        !el._rosieReplaced
      ) {
        el._rosieReplaced = true;
        el.innerHTML = '<img src="' + LOGO + '" style="height:70px;width:auto;object-fit:contain;display:block;" />';
        break;
      }
    }
  }

  function applyHeroLogo() {
    // Find the element containing "The AI Engine" and insert logo before it (at 3x size, no circle)
    const allElements = Array.from(document.querySelectorAll('*'));
    for (const el of allElements) {
      const text = el.textContent || '';
      if (
        text.includes('The AI Engine') &&
        text.includes('Behind Every Lead') &&
        !el._heroLogoAdded
      ) {
        // Walk up to find a reasonable container parent
        let target = el;
        for (let i = 0; i < 4; i++) {
          const p = target.parentElement;
          if (!p || p.tagName === 'BODY') break;
          if ((p.textContent || '').length < 500) target = p;
          else break;
        }
        if (!target._heroLogoAdded) {
          target._heroLogoAdded = true;
          const wrapper = document.createElement('div');
          wrapper.style.cssText = 'display:flex;justify-content:center;margin-bottom:24px;';
          wrapper.innerHTML = '<img src="' + LOGO + '" style="height:240px;width:auto;object-fit:contain;" />';
          target.parentElement.insertBefore(wrapper, target);
        }
        break;
      }
    }
  }

  function applyAll() {
    applyTopLeftLogo();
    applyHeroLogo();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyAll);
  } else {
    applyAll();
  }
  setTimeout(applyAll, 300);
  setTimeout(applyAll, 1000);
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