import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { base44 } from '@/api/base44Client';
import HomeHeader from '@/components/home/HomeHeader';
import HomeChatWidget from '@/components/home/HomeChatWidget';
import HomeLeadConfirm from '@/components/home/HomeLeadConfirm';
import StephaniAccessPopup from '@/components/home/StephaniAccessPopup';
import HomeTrust from '@/components/home/HomeTrust';

const APP_BASE_URL = window.location.origin;

const SESSION_KEY = "home_access_granted";
const SESSION_USER_KEY = "home_access_user";

export default function Home() {
  const navigate = useNavigate();
  const [unlocked] = useState(() => sessionStorage.getItem(SESSION_KEY) === 'true');
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
    <div style={{ minHeight: '100vh', background: '#f0f7ff', fontFamily: "'DM Sans', sans-serif" }}>
      <HomeHeader />

      <main style={{ width: '100%', maxWidth: '960px', margin: '0 auto', padding: '32px 16px 64px', boxSizing: 'border-box' }}>
        {leadProfile && <HomeLeadConfirm profile={leadProfile} />}

        <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2 md:items-start">
          <div className="order-2 md:order-1">
            <HomeTrust />
          </div>
          <div className="order-1 md:order-2">
            <HomeChatWidget leadProfile={leadProfile} onLeadFound={setLeadProfile} />
          </div>
        </div>

        <StephaniAccessPopup />

      </main>
    </div>
  );
}