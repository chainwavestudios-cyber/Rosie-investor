import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { base44 } from '@/api/base44Client';
import HomeHeader from '@/components/home/HomeHeader';
import HomeChatWidget from '@/components/home/HomeChatWidget';
import StephaniAccessPopup from '@/components/home/StephaniAccessPopup';
import HomeTrust from '@/components/home/HomeTrust';

const APP_BASE_URL = window.location.origin;

const SESSION_KEY = "home_access_granted";
const SESSION_USER_KEY = "home_access_user";

export default function Home() {
  const navigate = useNavigate();
  const [unlocked] = useState(() => sessionStorage.getItem(SESSION_KEY) === 'true');

  // If already unlocked, go straight to investor page
  useEffect(() => {
    if (unlocked) {
      navigate('/investor-page', { replace: true });
    }
  }, []);

  // On mount — check URL for ?code=username or ?username=username
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code') || params.get('username');
    if (code && !unlocked) {
      autoUnlockWithCode(code.trim().toLowerCase());
    }
  }, []);

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
        <HomeChatWidget />

        <StephaniAccessPopup />

        <HomeTrust />

      </main>
    </div>
  );
}