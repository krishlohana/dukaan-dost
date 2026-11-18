import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {aiRouter} from './backend/routes/aiRoutes.ts';
import {healthRouter} from './backend/routes/healthRoutes.ts';
import {shopRouter} from './backend/routes/shopRoutes.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = express();
  app.use(express.json({limit: '15mb'}));

  // Modular API routes
  app.use('/api/health', healthRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api', shopRouter);

  // Unknown API endpoints return structured JSON 404
  app.use('/api', (_req, res) => {
    res.status(404).json({error: 'API route not found.'});
  });

  // Mount Vite middleware in dev or serve built assets in production
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Dukaan Dost Express server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
