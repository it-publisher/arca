import http from 'node:http';
import { HttpError, sendError, setSecurityHeaders } from './http.js';
import { createRoutes } from './routes.js';
import { createStaticHandler } from './static.js';

export function createApp({ config, store }) {
  const routes = createRoutes({ config, store });
  const serveStatic = createStaticHandler(config.distDir);

  async function handleRequest(req, res) {
    const { pathname } = new URL(req.url, 'http://localhost');
    for (const route of routes) {
      const match = route.pattern.exec(pathname);
      if (match && route.method === req.method) return route.handler({ req, res, params: match.slice(1) });
    }
    if (req.method === 'GET' && (await serveStatic(pathname, res))) return;
    throw new HttpError(404, 'Not found');
  }

  return http.createServer(async (req, res) => {
    setSecurityHeaders(res);
    try {
      await handleRequest(req, res);
    } catch (error) {
      sendError(res, error);
    }
  });
}
