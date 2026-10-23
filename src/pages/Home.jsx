import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { base44 } from '@/api/base44Client';
import HomeHero from '@/components/home/HomeHero';
import HomeLeadConfirm from '@/components/home/HomeLeadConfirm';
import StephaniAccessPopup from '@/components/home/StephaniAccessPopup';
import HomeTrust from '@/components/home/HomeTrust';
import HomeNews from '@/components/home/HomeNews';
import SiteFooter from '@/components/home/SiteFooter';

const APP_BASE_URL = window.location.origin;

const SESSION_KEY = "home_access_granted";
const SESSION_USER_KEY = "home_access_user";

// A link from an email carries a token (mailer / notice / contact card id) — the video
// session is only offered to a visitor who arrived on one of those links.
const TOKEN_KEYS = ['lead', 'leadId', 'lid', 'id', 'notice', 'noticeId', 'code', 'c', 'ref'];

export default function Home() {
  const navigate = useNavigate();
  const [unlocked] = useState(() => sessionStorage.getItem(SESSION_KEY) === 'true');
  const [hasToken] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return TOKEN_KEYS.some((key) => params.get(key));
  });
  const [leadProfile, setLeadProfile] = useState(null);

  // If already unlocked, go straight to investor page
  useEffect(() => {
    if (unlocked) {
      navigate('/investor-page', { replace: true });
    }
  }, []);

  // On mount — a link in an email may carry the contact card's identity, so we show
  // the visitor what we already have and ask them to confirm it — and we still honour
  // the ?code= portal link for investors.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const candidates = ['lead', 'leadId', 'lid', 'id', 'notice', 'noticeId', 'code', 'c', 'ref']
      .map((key) => params.get(key))
      .filter(Boolean);

    if (candidates.length > 0) locateContactCard(candidates);

    const code = params.get('code') || params.get('username');
    if (code && !unlocked) {
      autoUnlockWithCode(code.trim().toLowerCase());
    }
  }, []);

  const locateContactCard = async (candidates) => {
    try {
      const response = await base44.functions.invoke('homeQualifyChat', {
        action: 'lead_profile',
        candidates,
      });
      const profile = response?.data?.profile;
      if (profile) setLeadProfile(profile);
    } catch (e) {
      console.error('[Home] contact card lookup error:', e);
    }
  };

  const autoUnlockWithCode = async (code) => {
    try {
      const resp = await fetch(`${APP_BASE_URL}/functions/validateAccessCode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const result = await resp.json();

      if (!result?.valid) return;

      sessionStorage.setItem(SESSION_KEY, 'true');
      sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify({
        username: code,
        name:     result.name  || '',
        email:    result.email || '',
        id:       result.id    || '',
        leadId:   result.leadId || '',
        type:     result.type  || 'lead',
      }));

      // Fire-and-forget SiteVisit
      base44.entities.SiteVisit.create({
        passcode:   code,
        leadId:     result.leadId || '',
        investorId: result.type === 'investor' ? result.id : '',
        leadName:   result.name  || code,
        page:       '/',
        referrer:   'email_link',
        timeOnPage: 0,
        sessionId:  `home-${Date.now()}`,
        siteType:   'investor',
        visitedAt:  new Date().toISOString(),
      }).catch(() => {});

      navigate('/investor-page', { replace: true });

    } catch (e) {
      console.error('[Home] validateAccessCode error:', e);
    }
  };

  return (
    <div className="home-theme min-h-screen bg-home-canvas font-home-sans text-home-ink">
      <main>
        <HomeHero leadProfile={leadProfile} onLeadFound={setLeadProfile} />

        {leadProfile && (
          <div className="mx-auto max-w-7xl px-5 pt-10 md:px-8">
            <HomeLeadConfirm profile={leadProfile} />
          </div>
        )}

        <HomeTrust />
        <HomeNews />
      </main>

      <SiteFooter />

      <StephaniAccessPopup hasToken={hasToken || !!leadProfile} />
    </div>
  );
}