require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors = require('cors');

const sourceRoutes = require('./routes/source.routes');
const destinationRoutes = require('./routes/destination.routes');

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '50mb' }));

app.use('/api/source', sourceRoutes);
app.use('/api/destination', destinationRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Global error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
    detail: err.originalError?.message || null,
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`CloneForge backend running on http://localhost:${PORT}`);
});
