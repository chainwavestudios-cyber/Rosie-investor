import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const hashPw = async (pw) => {
    const salt = crypto.randomUUID().replace(/-/g, '');
    const enc  = new TextEncoder();
    const buf  = await crypto.subtle.digest('SHA-256', enc.encode(salt + pw));
    const hex  = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2,'0')).join('');
    return `${salt}:${hex}`;
  };

  try {
    const all = await base44.asServiceRole.entities.InvestorUser.list();
    const results = [];

    for (const user of (all || [])) {
      if (user.role === 'admin') {
        results.push({ username: user.username, status: 'skipped', reason: 'admin account' });
        continue;
      }

      try {
        // Derive password: lastname#2026 (all lowercase, letters only)
        const nameParts  = (user.name || user.username || '').toLowerCase().split(' ');
        const lastSlug   = (nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0]).replace(/[^a-z]/g, '');
        const plainPw    = `${lastSlug || user.username}#2026`;
        const hashedPw   = await hashPw(plainPw);

        await base44.asServiceRole.entities.InvestorUser.update(user.id, { password: hashedPw });

        results.push({ username: user.username, name: user.name, status: 'fixed', password: plainPw });
      } catch (e) {
        results.push({ username: user.username, status: 'error', error: e.message });
      }
    }

    const fixed   = results.filter(r => r.status === 'fixed').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const failed  = results.filter(r => r.status === 'error').length;

    console.log(`[resetPortalPasswords] Complete: ${fixed} fixed, ${skipped} skipped, ${failed} errors`);

    return Response.json({ success: true, fixed, skipped, failed, results });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});