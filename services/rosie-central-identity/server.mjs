import http from 'node:http';

const coreOrigin = 'https://core.rosieai.tech';
const coreDashboard = new URL('/dashboard', coreOrigin).href;
const browserPaths = new Set([
  '/', '/login', '/signup', '/account', '/setup-mfa', '/two-factor',
  '/verify-email', '/forgot-password', '/reset-password', '/consent',
  '/link/approve', '/connect/directd/google',
]);

const server = http.createServer((request, response) => {
  const path = (request.url || '/').split('?')[0].replace(/\/+$/, '') || '/';
  const readOnly = request.method === 'GET' || request.method === 'HEAD';

  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Content-Type-Options', 'nosniff');

  if (readOnly && browserPaths.has(path)) {
    response.writeHead(302, { Location: coreDashboard });
    response.end();
    return;
  }

  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (readOnly && path === '/health') {
    response.writeHead(200);
    response.end(JSON.stringify({ ok: true, mode: 'redirect-only' }));
    return;
  }

  response.writeHead(410);
  response.end(JSON.stringify({
    error: 'retired_identity_service',
    identityAuthority: coreOrigin,
  }));
});

const port = Number(process.env.PORT || 10000);
server.listen(port, '0.0.0.0', () => {
  console.log('[identity] retired host is serving Rosie Core redirects');
});
