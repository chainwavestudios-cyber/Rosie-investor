import { useEffect, useState } from "react";

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
  function applyChanges() {
    // Target the circular hero badge: an element with rounded/circle styling
    // that contains an img AND text "Rosie" (the label below the badge)
    // It sits above the main headline, NOT inside nav/header
    const allDivs = document.querySelectorAll('div, section, figure');
    for (const el of allDivs) {
      const text = el.textContent || '';
      const style = el.getAttribute('style') || '';
      const cls = el.className || '';
      // The badge container has "Rosie" text and is small
      if (
        text.trim().length < 30 &&
        text.includes('Rosie') &&
        el.querySelector('img') &&
        !el._rosieBadgeHidden
      ) {
        // Make sure it's not inside nav/header
        let parent = el.parentElement;
        let inNav = false;
        let depth = 0;
        while (parent && depth < 6) {
          const tag = (parent.tagName || '').toLowerCase();
          if (tag === 'nav' || tag === 'header') { inNav = true; break; }
          parent = parent.parentElement;
          depth++;
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