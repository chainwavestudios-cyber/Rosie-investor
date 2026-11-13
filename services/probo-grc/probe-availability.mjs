#!/usr/bin/env node
// Staging-only external availability probe. No authentication or customer data.
const url = process.env.PROBO_STAGING_URL || 'https://rosie-probo-grc-staging.onrender.com/';
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 15000);
try {
  const response = await fetch(url, { method: 'GET', redirect: 'manual', signal: controller.signal, headers: { 'User-Agent': 'Rosie-Probo-Staging-Availability/1.0' } });
  console.log('Probo staging HTTP status:', response.status);
  if (response.status >= 500 || response.status === 0) process.exitCode = 1;
  else if (response.status >= 300 && response.status < 400) console.log('Redirect response: availability only, not application readiness');
  else if (response.status === 401 || response.status === 403) console.log('Protected endpoint reachable: authentication readiness NOT verified');
  else if (response.status >= 400) process.exitCode = 1;
} catch (error) {
  console.error('Probo staging availability failed:', error.name);
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
}
