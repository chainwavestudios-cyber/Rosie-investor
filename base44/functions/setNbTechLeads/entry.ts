import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44Admin = createClientFromRequest(req).asServiceRole;

  // Target leads by email or name
  const targets = [
    { email: 'greg.finidley@cushwake.com', name: 'Greg Findley' },
    { email: 'joe@steelaz.com', name: 'Parsons Joe' },
    { email: 'jeffrey_elliott0601@hotmail.com', name: 'Jeffrey Elliott' },
    { email: 'jeffsautobody1@comcast.net', name: 'Jeff Aguilar' },
    { email: 'hifunction1@aol.com', name: 'Walter Schindler' },
    { email: 'ichachami@yahoo.com', name: 'Ilan Chachami' },
    { email: 'wesaul@aol.com', name: 'William Saul' },
    { email: 'kennedyg6767@gmail.com', name: 'Gerald Kennedy' },
    { email: 'vickers1@cox.net', name: 'Scott Vickers' },
    { email: 'dgeorge@1stnet.biz', name: 'Daniel Joseph George' },
    { email: 'writemarty@att.net', name: 'Martin Estrin' },
    { email: 'scotte@esc.com', name: 'Scott Ewell' },
    { email: 'kj@daumcre.com', name: 'Kirk Jenkins' },
    { email: 'r.steiner@louisville.edu', name: 'Rob Steiner' },
    // No email — match by name
    { name: 'Robert Giampino' },
  ];

  const allLeads = await base44Admin.entities.Lead.list('-created_date', 5000);

  const updated = [];
  const notFound = [];

  for (const target of targets) {
    // Try email match first (case-insensitive), then name match
    let match = null;
    if (target.email) {
      match = allLeads.find(l => l.email && l.email.toLowerCase() === target.email.toLowerCase());
    }
    if (!match && target.name) {
      const nameLower = target.name.toLowerCase();
      match = allLeads.find(l => `${l.firstName} ${l.lastName}`.toLowerCase() === nameLower);
    }
    // Fuzzy: match by last name if still not found
    if (!match && target.name) {
      const parts = target.name.toLowerCase().split(' ');
      const lastName = parts[parts.length - 1];
      const candidates = allLeads.filter(l => l.lastName && l.lastName.toLowerCase() === lastName);
      if (candidates.length === 1) match = candidates[0];
    }

    if (match) {
      await base44Admin.entities.Lead.update(match.id, { leadType: 'nb_tech' });
      updated.push({ id: match.id, name: `${match.firstName} ${match.lastName}`, email: match.email });
    } else {
      notFound.push(target.name || target.email);
    }
  }

  console.log(`[setNbTechLeads] Updated ${updated.length}, not found: ${notFound.length}`);
  return Response.json({ ok: true, updated, notFound });
});