import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const LEGACY_BOOTSTRAP_PASSWORD = 'Debt@2026!!';

const ADMIN_FLAG_KEYS = new Set([
  'liveAIEnabled','liveQA','liveCoach','liveIntent','bobAIEnabled','bobQA','bobCoach','bobIntent',
  'tabLiveCall','tabCalls','tabBob','tabPitches','tabKB','tabKBChat','tabProfile','tabCompliance',
  'canStartCall','canEndCall','canEditLead','canDeletePitch','complianceVisible','complianceSelfView',
]);
const ACCOUNT_LINK_ORIGIN = 'https://debtsolutions.cc/debt-coach-login';
const ACCOUNT_LINK_LIFETIME_MS = 24 * 60 * 60 * 1000;
function secureRandomHex(length = 32): string {
  const buffer = new Uint8Array(length);
  crypto.getRandomValues(buffer);
  return Array.from(buffer, value => value.toString(16).padStart(2, '0')).join('');
}
async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2,'0')).join('');
}
async function createSetupLink(userId: string) {
  const token = secureRandomHex();
  const setupTokenHash = await sha256(token);
  const setupTokenExpiresAt = new Date(Date.now() + ACCOUNT_LINK_LIFETIME_MS).toISOString();
  // The URL fragment stays client-side, out of normal HTTP request URLs.
  return { setupTokenHash, setupTokenExpiresAt,
    link: `${ACCOUNT_LINK_ORIGIN}#account=${encodeURIComponent(userId)}&setup=${token}` };
}
const validNewPassword = (value: unknown) =>
  typeof value === 'string' && value.length >= 12 && value.length <= 256;

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomUUID().replace(/-/g, '');
  const data = new TextEncoder().encode(salt + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashHex = Array.from(new Uint8Array(hashBuffer)).map((b: number) => b.toString(16).padStart(2, '0')).join('');
  return `${salt}:${hashHex}`;
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, hash] = storedHash.split(':');
  const data = new TextEncoder().encode(salt + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashHex = Array.from(new Uint8Array(hashBuffer)).map((b: number) => b.toString(16).padStart(2, '0')).join('');
  return hashHex === hash;
}

// ── Voice login helpers ──────────────────────────────────────────────────────
// Fuzzy-matches a spoken phrase against its Deepgram transcription. The
// transcript is rarely perfect, so we require 70% of significant words to match.
function fuzzyPhraseMatch(phrase: string, transcript: string): boolean {
  const normalize = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const phraseWords = normalize(phrase).split(/\s+/).filter((w: string) => w.length > 2);
  if (phraseWords.length === 0) return false;
  const transSet = new Set(normalize(transcript).split(/\s+/).filter(Boolean));
  const matched = phraseWords.filter((w: string) => transSet.has(w)).length;
  return matched / phraseWords.length >= 0.7;
}

// Decodes a base64-encoded webm audio clip into a File for upload.
async function audioFromBase64(audioBase64: string, filename: string): Promise<File> {
  const bytes = Uint8Array.from(atob(audioBase64), (c: string) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: 'audio/webm' });
  return new File([blob], filename, { type: 'audio/webm' });
}

function sanitizeUser(user: any): any {
  const { passwordHash, sessionToken, setupTokenHash, setupTokenExpiresAt, ...rest } = user;
  return rest;
}

async function verifySession(base44: any, userId: string, sessionToken: string): Promise<any | null> {
  if (!userId || !sessionToken) return null;
  try {
    const user = await base44.asServiceRole.entities.DebtCoachUser.get(userId);
    if (!user || !user.isActive || user.sessionToken !== sessionToken) return null;
    return user;
  } catch { return null; }
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action } = body;

    // ── BOOTSTRAP (creates first super_admin if no users exist) ──
    if (action === 'bootstrap') {
      const existing = await base44.asServiceRole.entities.DebtCoachUser.list('-created_date', 1);
      if (existing?.length > 0) return Response.json({ error: 'System already initialized' }, { status: 403 });
      const password = secureRandomHex(24);
      const hash = await hashPassword(password);
      const admin = await base44.asServiceRole.entities.DebtCoachUser.create({
        username: 'admin', email: '', passwordHash: hash, role: 'super_admin',
        permissions: '', mustResetPassword: true, isActive: true,
        createdBy: 'system', created_date: new Date().toISOString()
      });
      return Response.json({ success: true, user: sanitizeUser(admin), temporaryPassword: password });
    }

    // ── COMPLETE ONE-TIME ACCOUNT SETUP ──
    // No active session required: possession of the 256-bit bearer token is
    // required; only its hash is persisted. Invalid, expired and used links
    // have the same generic error response.
    if (action === 'completeSetup') {
      const userId = String(body.userId || '');
      const token = String(body.token || '');
      if (!/^[a-f0-9]{64}$/.test(token) || !userId || !validNewPassword(body.newPassword)) {
        return Response.json({ error: 'Invalid setup link or password. Use a password of at least 12 characters.' }, { status: 400 });
      }
      const account = await base44.asServiceRole.entities.DebtCoachUser.get(userId).catch(() => null);
      const hashedToken = await sha256(token);
      if (!account?.isActive || !account.setupTokenHash
          || typeof account.setupTokenExpiresAt !== 'string'
          || Date.parse(account.setupTokenExpiresAt) <= Date.now()
          || account.setupTokenHash.length !== hashedToken.length) {
        return Response.json({ error: 'This setup link is invalid, expired, or was already used. Contact your administrator for a new link.' }, { status: 400 });
      }
      // Equal-length digest comparison avoids early-return differences.
      let mismatch = 0;
      for (let i=0; i<hashedToken.length; i++) mismatch |= hashedToken.charCodeAt(i) ^ account.setupTokenHash.charCodeAt(i);
      if (mismatch !== 0) return Response.json({ error: 'This setup link is invalid, expired, or was already used. Contact your administrator for a new link.' }, { status: 400 });
      await base44.asServiceRole.entities.DebtCoachUser.update(account.id, {
        passwordHash: await hashPassword(body.newPassword),
        mustResetPassword: false, setupTokenHash: '', setupTokenExpiresAt: '', sessionToken: '',
      });
      return Response.json({ success: true, username: account.username });
    }

    // ── LOGIN ──
    if (action === 'login') {
      const { username, password } = body;
      const users = await base44.asServiceRole.entities.DebtCoachUser.filter({ username: (username || '').toLowerCase().trim() });
      const user = users?.[0];
      if (!user || !user.isActive) return Response.json({ error: 'Invalid username or password' }, { status: 401 });
      const valid = await verifyPassword(password || '', user.passwordHash);
      if (!valid) return Response.json({ error: 'Invalid username or password' }, { status: 401 });
      const sessionToken = crypto.randomUUID();
      await base44.asServiceRole.entities.DebtCoachUser.update(user.id, { sessionToken });
      return Response.json({ user: sanitizeUser(user), sessionToken, mustResetPassword: user.mustResetPassword });
    }

    // ── ME (verify session) ──
    if (action === 'me') {
      const user = await verifySession(base44, body.sessionUserId, body.sessionToken);
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      return Response.json({ user: sanitizeUser(user) });
    }

    // ── CHANGE PASSWORD ──
    if (action === 'changePassword') {
      const user = await verifySession(base44, body.sessionUserId, body.sessionToken);
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      const valid = await verifyPassword(body.currentPassword || '', user.passwordHash);
      if (!valid) return Response.json({ error: 'Current password is incorrect' }, { status: 400 });
      if (!validNewPassword(body.newPassword)) return Response.json({ error: 'Choose a password of 12 to 256 characters.' }, { status: 400 });
      const newHash = await hashPassword(body.newPassword);
      await base44.asServiceRole.entities.DebtCoachUser.update(user.id, { passwordHash: newHash, mustResetPassword: false });
      return Response.json({ success: true });
    }

    // ── RESET MY PASSWORD (first-login forced reset — session-verified, no current password needed) ──
    if (action === 'resetMyPassword') {
      const user = await verifySession(base44, body.sessionUserId, body.sessionToken);
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (!user.mustResetPassword) return Response.json({ error: 'Password reset is not required' }, { status: 400 });
      if (!validNewPassword(body.newPassword)) return Response.json({ error: 'Choose a password of 12 to 256 characters.' }, { status: 400 });
      const newHash = await hashPassword(body.newPassword);
      await base44.asServiceRole.entities.DebtCoachUser.update(user.id, { passwordHash: newHash, mustResetPassword: false });
      return Response.json({ success: true });
    }

    // ── CREATE USER (admin/super_admin only) ──
    if (action === 'createUser') {
      const admin = await verifySession(base44, body.sessionUserId, body.sessionToken);
      if (!admin || !['admin', 'super_admin'].includes(admin.role)) return Response.json({ error: 'Unauthorized' }, { status: 403 });
      if (!body.username?.trim()) return Response.json({ error: 'Username required' }, { status: 400 });

      const username = body.username.toLowerCase().trim();
      const existing = await base44.asServiceRole.entities.DebtCoachUser.filter({ username });
      if (existing?.length > 0) return Response.json({ error: 'Username already exists' }, { status: 400 });

      const role = body.role || 'dialer';
      if (!['super_admin','admin','super_manager','manager','dialer','fronter'].includes(role)) return Response.json({ error: 'Invalid role' }, { status: 400 });
      if (['super_admin','admin','fronter'].includes(role) && admin.role !== 'super_admin') return Response.json({ error: 'Only super admins may create admin or fronter accounts' }, { status: 403 });

      // Generate and persist the token digest during account creation,
      // avoiding a window where a new account has no usable setup link.
      const setupSecret = secureRandomHex();
      const setupTokenHash = await sha256(setupSecret);
      const setupTokenExpiresAt = new Date(Date.now() + ACCOUNT_LINK_LIFETIME_MS).toISOString();
      const hash = await hashPassword(secureRandomHex(24));
      const permissions = body.permissions ? JSON.stringify(body.permissions) : '';
      const newUser = await base44.asServiceRole.entities.DebtCoachUser.create({
        username, email: body.email?.trim() || '', passwordHash: hash, role,
        permissions, mustResetPassword: true, isActive: true,
        setupTokenHash, setupTokenExpiresAt,
        createdBy: admin.username, created_date: new Date().toISOString()
      });
      const setup = {
        link: `${ACCOUNT_LINK_ORIGIN}#account=${encodeURIComponent(newUser.id)}&setup=${setupSecret}`,
        setupTokenExpiresAt,
      };
      let inviteSent = false;
      if (body.sendInvite && body.email) {
        try {
          await base44.integrations.Core.SendEmail({
            to: body.email.trim(),
            subject: 'Complete your Debt Call Coach account setup',
            body: `You've been invited to Debt Call Coach.\n\nUsername: ${username}\n\nUse this private, one-time link within 24 hours to set your own password:\n${setup.link}\n\nDo not forward this link. It stops working after use or expiry.\n\nYour role: ${role}.`
          });
          inviteSent = true;
        } catch (e) { console.error('Debt Call Coach invitation delivery failed', e); }
      }
      return Response.json({ success: true, user: sanitizeUser(newUser), inviteSent,
        setupLink: inviteSent ? undefined : setup.link, setupExpiresAt: setup.setupTokenExpiresAt });
    }

    // ── LIST USERS ──
    if (action === 'listUsers') {
      const admin = await verifySession(base44, body.sessionUserId, body.sessionToken);
      if (!admin || !['admin', 'super_admin'].includes(admin.role)) return Response.json({ error: 'Unauthorized' }, { status: 403 });
      const users = await base44.asServiceRole.entities.DebtCoachUser.list('-created_date', 500);
      return Response.json({ users: (users || []).map(sanitizeUser) });
    }

    // ── UPDATE USER ──
    if (action === 'updateUser') {
      const admin = await verifySession(base44, body.sessionUserId, body.sessionToken);
      if (!admin || !['admin', 'super_admin'].includes(admin.role)) return Response.json({ error: 'Unauthorized' }, { status: 403 });

      const target = await base44.asServiceRole.entities.DebtCoachUser.get(body.targetUserId);
      if (!target) return Response.json({ error: 'User not found' }, { status: 404 });

      if (['admin', 'super_admin'].includes(target.role) && admin.role !== 'super_admin') {
        return Response.json({ error: 'Only super admins can modify admin users' }, { status: 403 });
      }
      if (body.updates?.role && ['admin', 'super_admin'].includes(body.updates.role) && admin.role !== 'super_admin') {
        return Response.json({ error: 'Only super admins can assign admin roles' }, { status: 403 });
      }

      if (body.updates?.role && !['admin','super_admin','super_manager','manager','dialer','fronter'].includes(body.updates.role)) return Response.json({ error: 'Invalid role' }, { status: 400 });
      const updateData: any = {};
      if (body.updates?.email !== undefined) updateData.email = body.updates.email;
      if (body.updates?.role !== undefined) updateData.role = body.updates.role;
      if (body.updates?.isActive !== undefined) updateData.isActive = body.updates.isActive;
      if (body.updates?.permissions !== undefined) updateData.permissions = typeof body.updates.permissions === 'string' ? body.updates.permissions : JSON.stringify(body.updates.permissions);
      if (body.updates?.aiSettingsJson !== undefined) {
        let proposed: any;
        try { proposed = typeof body.updates.aiSettingsJson === 'string' ? JSON.parse(body.updates.aiSettingsJson) : body.updates.aiSettingsJson; }
        catch { return Response.json({ error: 'Invalid JSON for feature flags' }, { status: 400 }); }
        if (!proposed || typeof proposed !== 'object' || Array.isArray(proposed)) return Response.json({ error: 'Invalid feature flag object' }, { status: 400 });
        let existingSettings: Record<string,any> = {};
        try { existingSettings = JSON.parse(target.aiSettingsJson || '{}'); } catch {}
        const merged = { ...existingSettings };
        for (const [key, val] of Object.entries(proposed)) {
          if (!ADMIN_FLAG_KEYS.has(key) || typeof val !== 'boolean') return Response.json({ error: `Invalid feature flag: ${key}` }, { status: 400 });
          merged[key] = val;
        }
        updateData.aiSettingsJson = JSON.stringify(merged);
      }
      await base44.asServiceRole.entities.DebtCoachUser.update(body.targetUserId, updateData);
      return Response.json({ success: true });
    }

    // ── DELETE USER (super_admin only) ──
    if (action === 'deleteUser') {
      const admin = await verifySession(base44, body.sessionUserId, body.sessionToken);
      if (!admin || admin.role !== 'super_admin') return Response.json({ error: 'Only super admins can delete users' }, { status: 403 });
      if (body.targetUserId === body.sessionUserId) return Response.json({ error: 'Cannot delete yourself' }, { status: 400 });
      await base44.asServiceRole.entities.DebtCoachUser.delete(body.targetUserId);
      return Response.json({ success: true });
    }

    // ── RESET PASSWORD (one-time setup link, no shared passwords) ──
    if (action === 'resetPassword') {
      const admin = await verifySession(base44, body.sessionUserId, body.sessionToken);
      if (!admin || !['admin', 'super_admin'].includes(admin.role)) return Response.json({ error: 'Unauthorized' }, { status: 403 });
      const target = await base44.asServiceRole.entities.DebtCoachUser.get(body.targetUserId);
      if (!target) return Response.json({ error: 'User not found' }, { status: 404 });
      if (['admin','super_admin'].includes(target.role) && admin.role !== 'super_admin') return Response.json({ error: 'Only super admins may reset admin users' }, { status: 403 });
      if (target.id === admin.id) return Response.json({ error: 'Use Change Password to update your own password' }, { status: 400 });
      const setup = await createSetupLink(target.id);
      await base44.asServiceRole.entities.DebtCoachUser.update(target.id, {
        passwordHash: await hashPassword(secureRandomHex(24)), mustResetPassword: true,
        sessionToken: '', voiceprintUri: '',
        setupTokenHash: setup.setupTokenHash, setupTokenExpiresAt: setup.setupTokenExpiresAt,
      });
      let inviteSent = false;
      if (body.sendInvite === true && target.email) {
        try {
          await base44.integrations.Core.SendEmail({ to: target.email,
            subject: 'Reset your Debt Call Coach password',
            body: `Your Debt Call Coach administrator requested a password reset.\n\nUse this one-time link within 24 hours to choose a new password:\n${setup.link}\n\nIf you did not expect this, contact your administrator.` });
          inviteSent = true;
        } catch (e) { console.error('Password reset delivery failed', e); }
      }
      return Response.json({ success: true, inviteSent, setupLink: inviteSent ? undefined : setup.link, setupExpiresAt: setup.setupTokenExpiresAt });
    }

    // ── ENROLL VOICE (requires password to verify identity) ──
    if (action === 'enrollVoice') {
      const { username, password, audioBase64, phrase } = body;
      const users = await base44.asServiceRole.entities.DebtCoachUser.filter({ username: (username || '').toLowerCase().trim() });
      const user = users?.[0];
      if (!user || !user.isActive) return Response.json({ error: 'Invalid username or password' }, { status: 401 });
      const valid = await verifyPassword(password || '', user.passwordHash);
      if (!valid) return Response.json({ error: 'Invalid username or password' }, { status: 401 });
      if (!audioBase64 || !phrase) return Response.json({ error: 'Audio and phrase required' }, { status: 400 });

      const file = await audioFromBase64(audioBase64, `voiceprint-${username}-${Date.now()}.webm`);
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri, expires_in: 300 });
      const transcript = await base44.integrations.Core.TranscribeAudio({ audio_url: signed_url });
      const transcriptText = typeof transcript === 'string' ? transcript : JSON.stringify(transcript);
      if (!fuzzyPhraseMatch(phrase, transcriptText)) {
        return Response.json({ error: 'Could not verify your phrase — please speak clearly and try again.' }, { status: 400 });
      }
      await base44.asServiceRole.entities.DebtCoachUser.update(user.id, { voiceprintUri: file_uri });
      return Response.json({ success: true });
    }

    // ── VOICE LOGIN (phrase verification + voice biometric comparison) ──
    if (action === 'voiceLogin') {
      const { username, audioBase64, phrase } = body;
      const users = await base44.asServiceRole.entities.DebtCoachUser.filter({ username: (username || '').toLowerCase().trim() });
      const user = users?.[0];
      if (!user || !user.isActive) return Response.json({ error: 'Voice not recognized' }, { status: 401 });
      if (!audioBase64 || !phrase) return Response.json({ error: 'Audio and phrase required' }, { status: 400 });

      const file = await audioFromBase64(audioBase64, `voice-login-${username}-${Date.now()}.webm`);
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      const transcript = await base44.integrations.Core.TranscribeAudio({ audio_url: file_url });
      const transcriptText = typeof transcript === 'string' ? transcript : JSON.stringify(transcript);
      if (!fuzzyPhraseMatch(phrase, transcriptText)) {
        return Response.json({ error: 'Could not verify your phrase — please speak clearly and try again.' }, { status: 400 });
      }

      if (!user.voiceprintUri) {
        return Response.json({ error: 'Voice not enrolled. Log in with your password first, then enroll your voice.' }, { status: 400 });
      }

      // Voice biometric comparison — Gemini supports audio input and is fast.
      // Falls back to phrase-only verification if the LLM can't process audio.
      let voiceMatch = false;
      try {
        const { signed_url: voiceprintUrl } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: user.voiceprintUri, expires_in: 120 });
        const result: any = await base44.integrations.Core.InvokeLLM({
          prompt: `You are a voice biometric analyst. You are given two audio recordings. Sample 1 is a user's enrolled voiceprint. Sample 2 is a new login attempt. Determine if both samples are from the SAME SPEAKER by analyzing voice characteristics (pitch, tone, speaking style, accent, cadence). Return JSON with sameSpeaker (boolean) and confidence (0-100).`,
          response_json_schema: { type: 'object', properties: { sameSpeaker: { type: 'boolean' }, confidence: { type: 'number' } } },
          file_urls: [voiceprintUrl, file_url],
          model: 'gemini_3_flash',
        });
        const r = result?.data || result || {};
        voiceMatch = r.sameSpeaker === true && (r.confidence ?? 0) >= 55;
      } catch (e) {
        console.log('[voiceLogin] LLM voice comparison failed, falling back to phrase verification:', e?.message || String(e));
        voiceMatch = true; // phrase verification already passed
      }

      if (!voiceMatch) {
        return Response.json({ error: 'Voice not recognized — please try again or use password login.' }, { status: 401 });
      }

      const sessionToken = crypto.randomUUID();
      await base44.asServiceRole.entities.DebtCoachUser.update(user.id, { sessionToken });
      return Response.json({ user: sanitizeUser(user), sessionToken, mustResetPassword: user.mustResetPassword });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}