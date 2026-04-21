import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, password, hash } = await req.json();

    const encoder = new TextEncoder();

    if (action === 'hash') {
      // Hash a password using SHA-256 with a salt
      const salt = crypto.randomUUID().replace(/-/g, '');
      const data = encoder.encode(salt + password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
      return Response.json({ hash: `${salt}:${hashHex}` });
    }

    if (action === 'verify') {
      // Verify a password against a stored hash
      if (!hash || !hash.includes(':')) {
        // Legacy plaintext password — do direct comparison
        return Response.json({ valid: hash === password });
      }
      const [salt, storedHash] = hash.split(':');
      const data = encoder.encode(salt + password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
      return Response.json({ valid: hashHex === storedHash });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});