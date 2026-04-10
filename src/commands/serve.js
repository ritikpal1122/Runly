// runly serve — HTTP API for running tests programmatically

import { createServer } from 'http';
import logger from '../utils/logger.js';
import { parse } from '../parser/index.js';
import { runSteps } from '../runner/index.js';

export async function serveCommand(options) {
  const port = parseInt(options.port || '3737', 10);

  logger.banner();
  logger.info(`Starting API server on port ${port}`);

  const server = createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        name: 'runly',
        version: '0.1.0',
        endpoints: {
          'POST /test': 'Run a test. Body: { instruction: "..." }',
          'GET /health': 'Health check',
        },
      }));
      return;
    }

    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method === 'POST' && req.url === '/test') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const { instruction, ...opts } = JSON.parse(body);
          if (!instruction) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing instruction' }));
            return;
          }

          const steps = parse(instruction);
          const result = await runSteps(steps, { ...opts, pool: true });

          res.writeHead(result.success ? 200 : 500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result, null, 2));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.listen(port, () => {
    logger.success(`API ready at http://localhost:${port}`);
    logger.dim(`  POST /test { "instruction": "open google.com" }`);
  });
}
