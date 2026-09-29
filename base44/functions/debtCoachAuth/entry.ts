import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const DEFAULT_PASSWORD = 'Debt@2026!!';

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

function sanitizeUser(user: any): any {
  const { passwordHash, sessionToken, ...rest } = user;
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
      const hash = await hashPassword(DEFAULT_PASSWORD);
      const admin = await base44.asServiceRole.entities.DebtCoachUser.create({
        username: 'admin', email: '', passwordHash: hash, role: 'super_admin',
        permissions: '', mustResetPassword: true, isActive: true,
        createdBy: 'system', created_date: new Date().toISOString()
      });
      return Response.json({ success: true, user: sanitizeUser(admin) });
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
      if (!body.newPassword || body.newPassword.length < 6) return Response.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
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
      if (role === 'super_admin' && admin.role !== 'super_admin') return Response.json({ error: 'Only super admins can create super admins' }, { status: 403 });

      const hash = await hashPassword(DEFAULT_PASSWORD);
      const permissions = body.permissions ? JSON.stringify(body.permissions) : '';

      const newUser = await base44.asServiceRole.entities.DebtCoachUser.create({
        username, email: body.email?.trim() || '', passwordHash: hash, role,
        permissions, mustResetPassword: true, isActive: true,
        createdBy: admin.username, created_date: new Date().toISOString()
      });

      if (body.sendInvite && body.email) {
        try {
          await base44.integrations.Core.SendEmail({
            to: body.email.trim(),
            subject: 'Welcome to Debt Settlement Call Coach',
            body: `You've been invited to the Debt Settlement Call Coach platform.\n\nUsername: ${username}\nDefault Password: ${DEFAULT_PASSWORD}\n\nPlease log in at https://rosieai-investorpage.base44.app/debt-call-coach-login and set a new password on first login.\n\nYour role: ${role === 'super_admin' ? 'Super Admin' : role === 'admin' ? 'Admin' : role === 'manager' ? 'Manager' : 'Dialer'}`
          });
        } catch {}
      }
      return Response.json({ success: true, user: sanitizeUser(newUser) });
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

      const updateData: any = {};
      if (body.updates?.email !== undefined) updateData.email = body.updates.email;
      if (body.updates?.role !== undefined) updateData.role = body.updates.role;
      if (body.updates?.isActive !== undefined) updateData.isActive = body.updates.isActive;
      if (body.updates?.permissions !== undefined) updateData.permissions = typeof body.updates.permissions === 'string' ? body.updates.permissions : JSON.stringify(body.updates.permissions);

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

    // ── RESET PASSWORD (admin resets to default) ──
    if (action === 'resetPassword') {
      const admin = await verifySession(base44, body.sessionUserId, body.sessionToken);
      if (!admin || !['admin', 'super_admin'].includes(admin.role)) return Response.json({ error: 'Unauthorized' }, { status: 403 });
      const hash = await hashPassword(DEFAULT_PASSWORD);
      await base44.asServiceRole.entities.DebtCoachUser.update(body.targetUserId, { passwordHash: hash, mustResetPassword: true });
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}