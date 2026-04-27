import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { username, password } = await req.json();

  if (!username || !password) {
    return Response.json({ success: false, error: 'Missing username or password' }, { status: 400 });
  }

  const input = username.trim().toLowerCase();
  const pass  = password.trim().replace(/\\+$/, '');

  // Try username match (case-insensitive)
  let users = await base44.asServiceRole.entities.InvestorUser.filter({ username: input });
  if (!users.length) {
    // Try original case
    users = await base44.asServiceRole.entities.InvestorUser.filter({ username: username.trim() });
  }
  if (!users.length) {
    // Try email
    users = await base44.asServiceRole.entities.InvestorUser.filter({ email: input });
  }

  if (!users.length) {
    return Response.json({ success: false, error: 'Invalid username or password' });
  }

  for (const user of users) {
    const stored = (user.password || '').trim();
    let valid = false;

    if (!stored.includes(':')) {
      // Plaintext legacy compare
      valid = stored === pass;
    } else {
      const colonIdx = stored.indexOf(':');
      const salt = stored.slice(0, colonIdx);
      const expectedHash = stored.slice(colonIdx + 1);
      const enc = new TextEncoder();
      const buf = await crypto.subtle.digest('SHA-256', enc.encode(salt + pass));
      const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
      valid = hex === expectedHash;
    }

    if (valid) {
      // Return user without password
      const { password: _, ...safeUser } = user;
      return Response.json({ success: true, user: safeUser });
    }
  }

  return Response.json({ success: false, error: 'Invalid username or password' });
});