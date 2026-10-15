export const HOT_LEADS_KEY = ['debt-hot-leads'];

export function hotLeadsQuery(search = '') {
  const active = { isHotLead: true, $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }] };
  const terms = search.trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return active;
  return { $and: [active, ...terms.map(term => {
    const pattern = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return { $or: ['firstName', 'lastName', 'phone', 'email'].map(field => ({ [field]: { $regex: pattern, $options: 'i' } })) };
  })] };
}