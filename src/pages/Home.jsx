import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const LOGO_URL = "https://media.base44.com/images/public/69cd2741578c9b5ce655395b/39a31f9b9_Untitleddesign3.png";
const HERO_LOGO_URL = "https://media.base44.com/images/public/69cd2741578c9b5ce655395b/d28cac677_Untitleddesign3.png";
const HTML_URL = "https://rawcdn.githack.com/chainwavestudios-cyber/agentbmaninvest/main/agentbman-pitchbook-v3.html";

export default function Home() {
  const [blobUrl, setBlobUrl] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(HTML_URL)
      .then((r) => r.text())
      .then((html) => {
        // Text replacements baked directly into the HTML string — no DOM injection needed
        let modified = html
          .replaceAll("AgentBman", "Rosie")
          .replaceAll("agentbman", "rosie")
          .replaceAll("50.5 GW", "50.5 GW → 330GW")
          .replaceAll("Installed in 2023 alone · $200B+ US market", "2025 → 2032 · Global Market")
          .replaceAll("Installed in 2025 alone · $200B+ US market", "2025 → 2032 · Global Market")
          .replaceAll("2024 → 2032", "2026 → 2032")
          .replaceAll("$62B", "$62B  →  $190B")
          .replaceAll("Growing at 4.8% CAGR · Storm-driven demand", "2025 → 2032  · Storm-driven demand")
          .replaceAll("15×\n\t\t\t\t\t\tCost Advantage on AI Voice vs. Industry", "")
          .replaceAll("$0.01\n\t\t\t\t\t\tPer Minute — Full Stack AI Calls", "")
          .replaceAll("20 min\n\t\t\t\t\t\tTo Start Dialing with AI Agents", "")
          .replaceAll("$4.1B → $18B", "$4.1B → $40B")
          .replaceAll("2024 → 2030", "2025 → 2032")
          .replaceAll("28.3% CAGR", "38.46% CAGR")
          .replaceAll("4.8% CAGR", "17.35% CAGR")
          .replaceAll("22% CAGR", "30.82% CAGR")
          .replaceAll("25.8% CAGR", "35.64% CAGR")
          .replaceAll("$0.01/min all-in", "$0.01/min all-in (Rosie Cost)")
          .replaceAll("Enrichment", "Enrichment (Custom API)\nWorkFlow Manager\nApify Web Scraping\nSMS Campaigns\n\nEnrichment");

        // Fix nav logo
        const logoScript = `<script>
(function() {
  var LOGO = "${LOGO_URL}";
  var HERO = "${HERO_LOGO_URL}";
  function applyLogo() {
    var nav = document.querySelector('nav, header');
    if (!nav) return;
    var els = nav.querySelectorAll('*');
    for (var i = 0; i < els.length; i++) {
      var t = (els[i].textContent || '').trim();
      if (t.includes('INVESTOR OVERVIEW') && t.length < 100 && !els[i]._done) {
        els[i]._done = true;
        els[i].innerHTML = '<img src="' + LOGO + '" style="height:55px;width:auto;object-fit:contain;display:block;" />';
        break;
      }
    }
    var all = document.querySelectorAll('*');
    for (var j = 0; j < all.length; j++) {
      var txt = (all[j].textContent || '').toLowerCase();
      if (txt.includes('ai engine') && txt.includes('every lead')) {
        if (all[j].nextElementSibling && all[j].nextElementSibling.src && all[j].nextElementSibling.src.includes('d28cac677')) return;
        var img = document.createElement('img');
        img.src = HERO;
        img.style.cssText = 'display:block;margin:24px auto 0;width:180px;height:auto;';
        if (all[j].parentNode) all[j].parentNode.insertBefore(img, all[j].nextSibling);
        return;
      }
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyLogo);
  else applyLogo();
  setTimeout(applyLogo, 500);
  setTimeout(applyLogo, 1500);
})();
<\/script>`;

        modified = modified.replace("</body>", logoScript + "</body>");

        const blob = new Blob([modified], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
        return () => URL.revokeObjectURL(url);
      });
  }, []);

  return (
    <div className="w-full h-screen" style={{ position: 'relative' }}>
      {blobUrl ? (
        <iframe src={blobUrl} className="w-full h-full border-0" title="Rosie Pitchbook" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-500">Loading...</div>
      )}
      <button
        onClick={() => navigate('/portal-login')}
        style={{
          position: 'fixed', bottom: '32px', right: '32px',
          background: 'linear-gradient(135deg, #b8933a, #d4aa50)',
          color: '#0a0f1e', border: 'none', borderRadius: '2px',
          padding: '10px 22px', cursor: 'pointer',
          fontSize: '11px', fontWeight: '700', letterSpacing: '2px',
          textTransform: 'uppercase', fontFamily: 'Georgia, serif',
          zIndex: 9999, boxShadow: '0 4px 20px rgba(184,147,58,0.4)',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}
      >
        🔐 Investor Data Portal
      </button>
    </div>
  );
}