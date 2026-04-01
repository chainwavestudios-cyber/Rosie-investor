import { useEffect, useState } from "react";

const LOGO_URL = "https://media.base44.com/images/public/69cd2741578c9b5ce655395b/0ae3f947a_openart-image_1775055476433_7d75c3a6_1775055476634_b0313d02.png";
const HTML_URL = "https://rawcdn.githack.com/chainwavestudios-cyber/agentbmaninvest/main/agentbman-pitchbook-v3.html";

export default function Home() {
  const [blobUrl, setBlobUrl] = useState(null);

  useEffect(() => {
    fetch(HTML_URL)
      .then((r) => r.text())
      .then((html) => {
        // Replace all AgentBman with Rosie
        let modified = html.replaceAll("AgentBman", "Rosie").replaceAll("agentbman", "rosie");

        // Remove top-left header text "Rosie\nInvestor Overview · 2026" or similar nav branding
        // Replace the nav/header brand area with the Rosie logo at 2x size
        // The HTML likely has a nav logo section - inject a style override + logo replacement
        const logoReplacement = `
          <style>
            .nav-brand-text, .brand-text, [class*="brand"] span, [class*="nav"] .logo-text { display: none !important; }
          </style>
        `;

        // Inject logo into <head>
        modified = modified.replace("</head>", `${logoReplacement}</head>`);

        // Replace the top-left brand/logo section
        // Look for common patterns: a nav logo that shows the company name
        // We'll inject a script that runs after load to do DOM manipulation
        const injectedScript = `
<script>
(function() {
  const LOGO = "${LOGO_URL}";

  function applyChanges() {
    // --- TOP LEFT LOGO ---
    // Find nav/header elements containing "Rosie" or "Investor Overview" text
    const allElements = document.querySelectorAll('*');
    for (const el of allElements) {
      if (el.children.length === 0) {
        // Leaf node text
        if (el.textContent.trim() === 'Rosie' || el.textContent.trim() === 'AgentBman') {
          // Check if it's in a nav/header context
          let parent = el.parentElement;
          let depth = 0;
          while (parent && depth < 5) {
            const tag = parent.tagName?.toLowerCase();
            if (tag === 'nav' || tag === 'header' || parent.className?.includes?.('nav') || parent.className?.includes?.('header')) {
              el.style.display = 'none';
              break;
            }
            parent = parent.parentElement;
            depth++;
          }
        }
        if (el.textContent.includes('Investor Overview') || el.textContent.includes('Equity Partner')) {
          let parent = el.parentElement;
          let depth = 0;
          while (parent && depth < 5) {
            const tag = parent.tagName?.toLowerCase();
            if (tag === 'nav' || tag === 'header' || parent.className?.includes?.('nav') || parent.className?.includes?.('header')) {
              el.style.display = 'none';
              break;
            }
            parent = parent.parentElement;
            depth++;
          }
        }
      }
    }

    // Find the first nav or header and insert big logo
    const nav = document.querySelector('nav, header');
    if (nav) {
      // Hide existing text children
      nav.querySelectorAll('span, p, div').forEach(el => {
        if (el.children.length === 0 && (el.textContent.includes('Rosie') || el.textContent.includes('Investor') || el.textContent.includes('Equity'))) {
          el.style.display = 'none';
        }
      });
      // Remove any existing logo img and replace with Rosie logo
      const existingLogo = nav.querySelector('img');
      const logoImg = document.createElement('img');
      logoImg.src = LOGO;
      logoImg.style.cssText = 'height: 80px; width: auto; object-fit: contain;';
      if (existingLogo) {
        existingLogo.replaceWith(logoImg);
      } else {
        nav.prepend(logoImg);
      }
    }

    // --- AUDIT SECTION: Add logo next to 92/100 circle ---
    // Find the element showing "92" score
    const scoreEls = document.querySelectorAll('*');
    for (const el of scoreEls) {
      if (el.children.length === 0 && el.textContent.trim() === '92') {
        // Go up to find the score circle container
        let container = el.parentElement;
        let depth = 0;
        while (container && depth < 4) {
          if (container.style?.borderRadius?.includes('50%') || 
              window.getComputedStyle(container).borderRadius === '50%' ||
              container.className?.includes('circle') ||
              container.className?.includes('score') ||
              container.className?.includes('ring')) {
            break;
          }
          container = container.parentElement;
          depth++;
        }
        // Insert logo next to the found container's parent
        const wrapper = container?.parentElement;
        if (wrapper && !wrapper.querySelector('.rosie-audit-logo')) {
          const auditLogo = document.createElement('img');
          auditLogo.src = LOGO;
          auditLogo.className = 'rosie-audit-logo';
          auditLogo.style.cssText = 'height: 120px; width: auto; object-fit: contain; margin-left: 24px; display: inline-block; vertical-align: middle;';
          wrapper.style.display = 'flex';
          wrapper.style.alignItems = 'center';
          wrapper.style.flexWrap = 'wrap';
          wrapper.appendChild(auditLogo);
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
  // Also run after a short delay to handle any dynamic rendering
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