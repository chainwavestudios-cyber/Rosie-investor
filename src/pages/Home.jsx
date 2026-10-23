import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { base44 } from '@/api/base44Client';
import WelcomeEmbed from '@/components/home/WelcomeEmbed';

const APP_BASE_URL = window.location.origin;

const SESSION_KEY = "home_access_granted";
const SESSION_USER_KEY = "home_access_user";

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
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

  // The welcome page personalizes itself from its query string, so the visitor's own
  // link parameters (token, invitation base) and the name on their file travel into it.
  const embedSrc = useMemo(() => {
    const params = new URLSearchParams(location.search);
    if (leadProfile?.firstName && !params.get('firstName')) params.set('firstName', leadProfile.firstName);
    const query = params.toString();
    return `/welcome.html${query ? `?${query}` : ''}`;
  }, [leadProfile, location.search]);

  return (
    <div className="home-theme h-screen w-full overflow-hidden bg-home-canvas">
      <WelcomeEmbed src={embedSrc} />
    </div>
  );
}