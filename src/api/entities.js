/**
 * Base44 Entities API Layer
 * 
 * All database reads/writes go through here.
 * Uses base44.entities.* for every operation.
 * 
 * Entities needed in your Base44 dashboard (Data → New Entity):
 *   - InvestorUser
 *   - AnalyticsSession
 *   - PortalSettings
 *   - InvestorUpdate
 *   - DocusignRequest
 */

import { base44 } from './base44Client';

// ─── InvestorUser ─────────────────────────────────────────────────────────
// Fields: name, username, email, password, role, company, createdAt

export const InvestorUser = {
  async list() {
    try {
      return await base44.entities.InvestorUser.list();
    } catch (e) {
      console.error('[InvestorUser.list]', e);
      return [];
    }
  },

  async findByUsername(username) {
    try {
      const results = await base44.entities.InvestorUser.filter({ username });
      return results[0] || null;
    } catch (e) {
      console.error('[InvestorUser.findByUsername]', e);
      return null;
    }
  },

  async findByEmail(email) {
    try {
      const results = await base44.entities.InvestorUser.filter({ email });
      return results[0] || null;
    } catch (e) {
      console.error('[InvestorUser.findByEmail]', e);
      return null;
    }
  },

  async findByCredentials(usernameOrEmail, password) {
    try {
      const input = (usernameOrEmail || '').trim().toLowerCase();
      const pass = (password || '').trim();
      // Try username first (case-insensitive)
      let users = await base44.entities.InvestorUser.filter({ username: input });
      if (!users.length) {
        users = await base44.entities.InvestorUser.filter({ email: input });
      }
      // Also try original casing if lowercase didn't match
      if (!users.length) {
        users = await base44.entities.InvestorUser.filter({ username: usernameOrEmail.trim() });
      }
      const user = users.find(u => (u.password || '').trim() === pass);
      return user || null;
    } catch (e) {
      console.error('[InvestorUser.findByCredentials]', e);
      return null;
    }
  },

  async create(userData) {
    try {
      return await base44.entities.InvestorUser.create({
        ...userData,
        username: (userData.username || '').trim(),
        email: (userData.email || '').trim().toLowerCase(),
        password: (userData.password || '').trim(),
        createdAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error('[InvestorUser.create]', e);
      throw e;
    }
  },

  async update(id, updates) {
    try {
      return await base44.entities.InvestorUser.update(id, updates);
    } catch (e) {
      console.error('[InvestorUser.update]', e);
      throw e;
    }
  },

  async delete(id) {
    try {
      return await base44.entities.InvestorUser.delete(id);
    } catch (e) {
      console.error('[InvestorUser.delete]', e);
      throw e;
    }
  },

  async ensureAdminExists() {
    try {
      const admins = await base44.entities.InvestorUser.filter({ role: 'admin' });
      if (!admins.length) {
        await base44.entities.InvestorUser.create({
          username: 'admin',
          email: 'admin@rosieai.com',
          password: 'password',
          name: 'Admin',
          role: 'admin',
          company: 'Rosie AI LLC',
          createdAt: new Date().toISOString(),
        });
      } else {
        // Patch admin if password is missing (legacy records)
        const admin = admins[0];
        if (!admin.password) {
          await base44.entities.InvestorUser.update(admin.id, { password: 'password' });
        }
      }
    } catch (e) {
      console.error('[InvestorUser.ensureAdminExists]', e);
    }
  },
};

// ─── AnalyticsSession ─────────────────────────────────────────────────────
// Fields: userEmail, username, userName, startTime, endTime,
//         durationSeconds, pages (JSON), downloads (JSON), docViews (JSON)

export const AnalyticsSession = {
  async create(sessionData) {
    try {
      return await base44.entities.AnalyticsSession.create(sessionData);
    } catch (e) {
      console.error('[AnalyticsSession.create]', e);
      return null;
    }
  },

  async update(id, updates) {
    try {
      return await base44.entities.AnalyticsSession.update(id, updates);
    } catch (e) {
      console.error('[AnalyticsSession.update]', e);
      return null;
    }
  },

  async listAll() {
    try {
      return await base44.entities.AnalyticsSession.list({
        sort: [{ field: 'startTime', direction: 'desc' }],
      });
    } catch (e) {
      console.error('[AnalyticsSession.listAll]', e);
      return [];
    }
  },

  async listForUser(userEmail) {
    try {
      const results = await base44.entities.AnalyticsSession.filter({ userEmail });
      return results.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
    } catch (e) {
      console.error('[AnalyticsSession.listForUser]', e);
      return [];
    }
  },

  async listForUsername(username) {
    try {
      const results = await base44.entities.AnalyticsSession.filter({ username });
      return results.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
    } catch (e) {
      console.error('[AnalyticsSession.listForUsername]', e);
      return [];
    }
  },
};

// ─── PortalSettings ───────────────────────────────────────────────────────
// Single-row config: key = "global"

const SETTINGS_KEY = 'global';

export const PortalSettingsDB = {
  async get() {
    try {
      const results = await base44.entities.PortalSettings.filter({ key: SETTINGS_KEY });
      return results[0] || null;
    } catch (e) {
      console.error('[PortalSettings.get]', e);
      return null;
    }
  },

  async save(settings) {
    try {
      const existing = await PortalSettingsDB.get();
      if (existing?.id) {
        return await base44.entities.PortalSettings.update(existing.id, settings);
      } else {
        return await base44.entities.PortalSettings.create({
          key: SETTINGS_KEY,
          ...settings,
        });
      }
    } catch (e) {
      console.error('[PortalSettings.save]', e);
      throw e;
    }
  },
};

// ─── InvestorUpdate ───────────────────────────────────────────────────────
// Fields: title, content, category, author, publishedAt

export const InvestorUpdateDB = {
  async list() {
    try {
      const results = await base44.entities.InvestorUpdate.list();
      return results.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    } catch (e) {
      console.error('[InvestorUpdate.list]', e);
      return [];
    }
  },

  async create(updateData) {
    try {
      return await base44.entities.InvestorUpdate.create({
        ...updateData,
        publishedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error('[InvestorUpdate.create]', e);
      throw e;
    }
  },

  async delete(id) {
    try {
      return await base44.entities.InvestorUpdate.delete(id);
    } catch (e) {
      console.error('[InvestorUpdate.delete]', e);
      throw e;
    }
  },
};

// ─── SignNowRequest ───────────────────────────────────────────────────────

export const SignNowRequestDB = {
  async create(data) {
    try {
      return await base44.entities.SignNowRequest.create({
        ...data,
        sentAt: new Date().toISOString(),
        status: data.status || 'pending',
      });
    } catch (e) {
      console.error('[SignNowRequest.create]', e);
      throw e;
    }
  },

  async list() {
    try {
      return await base44.entities.SignNowRequest.list();
    } catch (e) {
      console.error('[SignNowRequest.list]', e);
      return [];
    }
  },

  async listForEmail(email) {
    try {
      const results = await base44.entities.SignNowRequest.filter({ userEmail: email });
      return results.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
    } catch (e) {
      console.error('[SignNowRequest.listForEmail]', e);
      return [];
    }
  },

  async listAll() {
    try {
      const results = await base44.entities.SignNowRequest.list();
      return results.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
    } catch (e) {
      console.error('[SignNowRequest.listAll]', e);
      return [];
    }
  },

  async updateStatus(id, status) {
    try {
      return await base44.entities.SignNowRequest.update(id, { status });
    } catch (e) {
      console.error('[SignNowRequest.updateStatus]', e);
      throw e;
    }
  },
};

// ─── DocusignRequest ──────────────────────────────────────────────────────
// Fields: firstName, lastName, email, mailingAddress,
//         amountToInvest, investmentType, fundingType,
//         submittedAt, status, submittedByUsername

export const DocusignRequestDB = {
  async create(formData) {
    try {
      return await base44.entities.DocusignRequest.create({
        ...formData,
        submittedAt: new Date().toISOString(),
        status: 'pending',
      });
    } catch (e) {
      console.error('[DocusignRequest.create]', e);
      throw e;
    }
  },

  async list() {
    try {
      const results = await base44.entities.DocusignRequest.list();
      return results.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    } catch (e) {
      console.error('[DocusignRequest.list]', e);
      return [];
    }
  },

  async updateStatus(id, status) {
    try {
      return await base44.entities.DocusignRequest.update(id, { status });
    } catch (e) {
      console.error('[DocusignRequest.updateStatus]', e);
      throw e;
    }
  },
};