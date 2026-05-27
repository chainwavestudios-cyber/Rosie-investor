import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44Admin = createClientFromRequest(req).asServiceRole;

  // Target leads by email or name
  const targets = [
    { email: 'Brennanm@Mskcc.Org', name: 'Murray Brennan' },
    { email: 'fbazan@centric.org', name: 'Frank Bazan' },
    { email: 'tomw@centralcm.com', name: 'Tom Winfough' },
    { email: 'peter@ieenterprises.com', name: 'Peter Foy' },
    { email: 'jimpshock@hotmail.com', name: 'James PSchock' },
    { email: 'ichachami@yahoo.com', name: 'Ilan Chachami' },
    { email: 'wesaul@aol.com', name: 'William Saul' },
    { email: 'jonahthanhenz72@aol.com', name: 'Jonathan Hendrix' },
    { email: 'fmetoyer@gmail.com', name: 'Frederick Metoyer' },
    { email: 'stephcle440@outlook.com', name: 'stephani scheidt' },
    { email: 'jlcanddesign@gmail.com', name: 'Leonardo John' },
    { email: 'cw4shock@aol.com', name: 'Stephen Shockey' },
    { email: 'elitecryptotrader@proton.me', name: 'Test test' },
    // No email — match by name fragments
    { name: 'Martin Estrin' },
    { name: 'Daniel Joseph George' },
    { name: 'Greg Theisen' },
    { name: 'Johnathan Hendrix' },
    { name: 'Fredrick Metoyer' },
    { name: 'Gregory Pakratz' },
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