import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Sheet IDs stored as env vars after first run
const SPREADSHEET_ID_KEY = 'MASTER_SPREADSHEET_ID';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { entityType, eventType, data } = await req.json();

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');

    // Get or create the master spreadsheet
    let spreadsheetId = Deno.env.get(SPREADSHEET_ID_KEY) || '';

    if (!spreadsheetId) {
      // Create new spreadsheet
      const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          properties: { title: 'Rosie AI — Master CRM Tracker' },
          sheets: [
            { properties: { title: 'Leads', sheetId: 1 } },
            { properties: { title: 'Investors', sheetId: 2 } },
          ]
        })
      });
      const created = await createRes.json();
      console.log('Create response:', JSON.stringify(created));
      spreadsheetId = created.spreadsheetId || created.id || '';
      if (!spreadsheetId) {
        console.error('Failed to create spreadsheet:', JSON.stringify(created));
        return Response.json({ error: 'Failed to create spreadsheet', details: created }, { status: 500 });
      }

      // Add headers for Leads sheet
      await appendRow(accessToken, spreadsheetId, 'Leads', [
        ['ID', 'First Name', 'Last Name', 'Email', 'Phone', 'Address', 'State', 'Status', 'Call Attempts', 'Engagement Score', 'Last Called At', 'Callback At', 'Notes', 'Contact List ID', 'Updated At']
      ]);

      // Add headers for Investors sheet
      await appendRow(accessToken, spreadsheetId, 'Investors', [
        ['ID', 'Name', 'Email', 'Phone', 'Company', 'Role', 'Status', 'Investment Amount', 'Investment Date', 'Investment Type', 'Engagement Score', 'Star Rating', 'Lead ID', 'Notes', 'Updated At']
      ]);

      console.log('Created spreadsheet:', spreadsheetId);
      console.log('IMPORTANT: Set MASTER_SPREADSHEET_ID =', spreadsheetId, 'in your environment secrets to avoid re-creating it.');
    }

    if (entityType === 'Lead' && data) {
      await upsertLead(accessToken, spreadsheetId, data, eventType);
    } else if (entityType === 'InvestorUser' && data) {
      await upsertInvestor(accessToken, spreadsheetId, data, eventType);
    }

    return Response.json({ success: true, spreadsheetId });
  } catch (e) {
    console.error('syncToSheets error:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
});

async function getSheetData(accessToken, spreadsheetId, sheetName) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  return data.values || [];
}

async function appendRow(accessToken, spreadsheetId, sheetName, rows) {
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: rows })
    }
  );
}

async function updateRow(accessToken, spreadsheetId, sheetName, rowIndex, rowData) {
  const range = `${sheetName}!A${rowIndex}`;
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [rowData] })
    }
  );
}

async function upsertLead(accessToken, spreadsheetId, lead, eventType) {
  const row = [
    lead.id || '',
    lead.firstName || '',
    lead.lastName || '',
    lead.email || '',
    lead.phone || '',
    lead.address || '',
    lead.state || '',
    lead.status || '',
    lead.callAttempts || 0,
    lead.engagementScore || 0,
    lead.lastCalledAt || '',
    lead.callbackAt || '',
    lead.notes || '',
    lead.contactListId || '',
    new Date().toISOString(),
  ];

  const values = await getSheetData(accessToken, spreadsheetId, 'Leads');
  // Find existing row by ID (col A = index 0), skip header row
  const existingRowIndex = values.findIndex((r, i) => i > 0 && r[0] === lead.id);

  if (existingRowIndex >= 0) {
    await updateRow(accessToken, spreadsheetId, 'Leads', existingRowIndex + 1, row);
  } else {
    await appendRow(accessToken, spreadsheetId, 'Leads', [row]);
  }
}

async function upsertInvestor(accessToken, spreadsheetId, investor, eventType) {
  const row = [
    investor.id || '',
    investor.name || '',
    investor.email || '',
    investor.phone || '',
    investor.company || '',
    investor.role || '',
    investor.status || '',
    investor.investmentAmount || '',
    investor.investmentDate || '',
    investor.investmentType || '',
    investor.engagementScore || 0,
    investor.starRating || 0,
    investor.leadId || '',
    investor.notes || '',
    new Date().toISOString(),
  ];

  const values = await getSheetData(accessToken, spreadsheetId, 'Investors');
  const existingRowIndex = values.findIndex((r, i) => i > 0 && r[0] === investor.id);

  if (existingRowIndex >= 0) {
    await updateRow(accessToken, spreadsheetId, 'Investors', existingRowIndex + 1, row);
  } else {
    await appendRow(accessToken, spreadsheetId, 'Investors', [row]);
  }
}