import 'dotenv/config';
import express from 'express';
import { createSeoWeb } from './web.js';
// Public document server for preview/standalone hosting. Keep /api proxied to the application backend.
const app = express();
app.disable('x-powered-by');
app.use(createSeoWeb());
app.listen(Number(process.env.WEB_PORT || 4173), '127.0.0.1', () => console.log('Orbix public document preview ready'));
