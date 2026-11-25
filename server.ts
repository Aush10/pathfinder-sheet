import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { lockFileMiddleware, registerLockFileMime } from './server/lockFiles.ts';
import {
  formatPortInUseMessage,
  registerApiRoutes,
  registerProductionSpaFallback,
  resolveServerPort,
} from './server/routes.ts';
import { loadServerEnvironment } from './server/env.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadServerEnvironment(__dirname);

async function startServer() {
  const app = express();
  const PORT = resolveServerPort();

  registerLockFileMime(express.static);
  app.use(lockFileMiddleware);
  // Complete Sheet may send large SOT pages. POST /api/sot/ingest also caps the
  // source string itself at 5 MiB and never executes request content.
  app.use(express.json({ limit: '10mb' }));
  registerApiRoutes(app);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    registerProductionSpaFallback(app, (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(formatPortInUseMessage(PORT));
      process.exit(1);
    }
    throw err;
  });
}

startServer();
