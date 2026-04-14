/**
 * Base44 Entities API Layer
 * Entities needed in Base44 dashboard (Data → New Entity):
 *   - InvestorUser, AnalyticsSession, PortalSettings, InvestorUpdate
 *   - SignNowRequest
 *   - ContactNote       ← NEW
 *   - Appointment       ← NEW
 *   - AccreditationDocument ← NEW
 */
import { base44 } from './base44Client';

export const InvestorUser = {
  async list() { try { return await base44.entities.InvestorUser.list(); } catch(e){ return []; } },
  async findByUsername(u) { try { const r=await base44.entities.InvestorUser.filter({username:u}); return r[0]||null; } catch{ return null; } },
  async findByEmail(e) { try { const r=await base44.entities.InvestorUser.filter({email:e}); return r[0]||null; } catch{ return null; } },
  async findByCredentials(usernameOrEmail, password) {
    try {
      const input=(usernameOrEmail||'').trim().toLowerCase(), pass=(password||'').trim();
      let users=await base44.entities.InvestorUser.filter({username:input});
      if(!users.length) users=await base44.entities.InvestorUser.filter({email:input});
      if(!users.length) users=await base44.entities.InvestorUser.filter({username:usernameOrEmail.trim()});
      return users.find(u=>(u.password||'').trim()===pass)||null;
    } catch{ return null; }
  },
  async create(d) { try { return await base44.entities.InvestorUser.create({...d,username:(d.username||'').trim(),email:(d.email||'').trim().toLowerCase(),password:(d.password||'').trim(),createdAt:new Date().toISOString()}); } catch(e){ throw e; } },
  async update(id,u) { try { return await base44.entities.InvestorUser.update(id,u); } catch(e){ throw e; } },
  async delete(id) { try { return await base44.entities.InvestorUser.delete(id); } catch(e){ throw e; } },
  async ensureAdminExists() {
    try {
      const a=await base44.entities.InvestorUser.filter({role:'admin'});
      if(!a.length) await base44.entities.InvestorUser.create({username:'admin',email:'admin@rosieai.com',password:'password',name:'Admin',role:'admin',company:'Rosie AI LLC',createdAt:new Date().toISOString()});
      else if(!a[0].password) await base44.entities.InvestorUser.update(a[0].id,{password:'password'});
    } catch{}
  },
};

export const AnalyticsSession = {
  async create(d) { try { return await base44.entities.AnalyticsSession.create(d); } catch{ return null; } },
  async update(id,u) { try { return await base44.entities.AnalyticsSession.update(id,u); } catch{ return null; } },
  async listAll() { try { return await base44.entities.AnalyticsSession.list({sort:[{field:'startTime',direction:'desc'}]}); } catch{ return []; } },
  async listForUser(e) { try { const r=await base44.entities.AnalyticsSession.filter({userEmail:e}); return r.sort((a,b)=>new Date(b.startTime)-new Date(a.startTime)); } catch{ return []; } },
  async listForUsername(u) { try { const r=await base44.entities.AnalyticsSession.filter({username:u}); return r.sort((a,b)=>new Date(b.startTime)-new Date(a.startTime)); } catch{ return []; } },
};

const SETTINGS_KEY='global';
export const PortalSettingsDB = {
  async get() { try { const r=await base44.entities.PortalSettings.filter({key:SETTINGS_KEY}); if(!r.length)return null; return r.sort((a,b)=>new Date(b.updated_date)-new Date(a.updated_date))[0]; } catch{ return null; } },
  async save(s) { try { const e=await PortalSettingsDB.get(); if(e?.id)return await base44.entities.PortalSettings.update(e.id,s); return await base44.entities.PortalSettings.create({key:SETTINGS_KEY,...s}); } catch(e){ throw e; } },
};

export const InvestorUpdateDB = {
  async list() { try { const r=await base44.entities.InvestorUpdate.list(); return r.sort((a,b)=>new Date(b.publishedAt)-new Date(a.publishedAt)); } catch{ return []; } },
  async create(d) { try { return await base44.entities.InvestorUpdate.create({...d,publishedAt:new Date().toISOString()}); } catch(e){ throw e; } },
  async delete(id) { try { return await base44.entities.InvestorUpdate.delete(id); } catch(e){ throw e; } },
};

export const SignNowRequestDB = {
  async create(d) { try { return await base44.entities.SignNowRequest.create({...d,sentAt:new Date().toISOString(),status:d.status||'pending'}); } catch(e){ throw e; } },
  async list() { try { return await base44.entities.SignNowRequest.list(); } catch{ return []; } },
  async listForEmail(e) { try { const r=await base44.entities.SignNowRequest.filter({userEmail:e}); return r.sort((a,b)=>new Date(b.sentAt)-new Date(a.sentAt)); } catch{ return []; } },
  async listAll() { try { const r=await base44.entities.SignNowRequest.list(); return r.sort((a,b)=>new Date(b.sentAt)-new Date(a.sentAt)); } catch{ return []; } },
  async updateStatus(id,s) { try { return await base44.entities.SignNowRequest.update(id,{status:s}); } catch(e){ throw e; } },
};

// ─── ContactNote ───────────────────────────────────────────────────────────
export const ContactNoteDB = {
  async create(d) { try { return await base44.entities.ContactNote.create({...d,createdAt:new Date().toISOString()}); } catch(e){ throw e; } },
  async listForInvestor(investorId) { try { const r=await base44.entities.ContactNote.filter({investorId}); return r.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)); } catch{ return []; } },
  async delete(id) { try { return await base44.entities.ContactNote.delete(id); } catch(e){ throw e; } },
};

// ─── Appointment ───────────────────────────────────────────────────────────
export const AppointmentDB = {
  async create(d) { try { return await base44.entities.Appointment.create({...d,createdAt:new Date().toISOString()}); } catch(e){ throw e; } },
  async listAll() { try { const r=await base44.entities.Appointment.list(); return r.sort((a,b)=>new Date(a.scheduledAt)-new Date(b.scheduledAt)); } catch{ return []; } },
  async listForInvestor(investorId) { try { const r=await base44.entities.Appointment.filter({investorId}); return r.sort((a,b)=>new Date(a.scheduledAt)-new Date(b.scheduledAt)); } catch{ return []; } },
  async update(id,u) { try { return await base44.entities.Appointment.update(id,u); } catch(e){ throw e; } },
  async delete(id) { try { return await base44.entities.Appointment.delete(id); } catch(e){ throw e; } },
};

// ─── AccreditationDocument ─────────────────────────────────────────────────
export const AccreditationDocDB = {
  async create(d) { try { return await base44.entities.AccreditationDocument.create({...d,uploadedAt:new Date().toISOString(),status:'pending'}); } catch(e){ throw e; } },
  async listForInvestor(investorId) { try { const r=await base44.entities.AccreditationDocument.filter({investorId}); return r.sort((a,b)=>new Date(b.uploadedAt)-new Date(a.uploadedAt)); } catch{ return []; } },
  async listAll() { try { const r=await base44.entities.AccreditationDocument.list(); return r.sort((a,b)=>new Date(b.uploadedAt)-new Date(a.uploadedAt)); } catch{ return []; } },
  async updateStatus(id,status,adminNotes) { try { return await base44.entities.AccreditationDocument.update(id,{status,adminNotes}); } catch(e){ throw e; } },
  async delete(id) { try { return await base44.entities.AccreditationDocument.delete(id); } catch(e){ throw e; } },
};