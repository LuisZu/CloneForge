const Joi = require('joi');
const destinationService = require('../services/destination.service');

const connSchema = Joi.object({
  server: Joi.string().required(),
  port: Joi.number().integer().default(1433),
  database: Joi.string().required(),
  user: Joi.string().required(),
  password: Joi.string().allow('').default(''),
  trustServerCertificate: Joi.boolean().default(true),
  encrypt: Joi.boolean().default(false),
});

function validateConn(body) {
  const { error, value } = connSchema.validate(body);
  if (error) throw Object.assign(new Error(error.details[0].message), { status: 400 });
  return value;
}

async function testConnection(req, res) {
  const conn = validateConn(req.body);
  const result = await destinationService.testConnection(conn);
  res.json(result);
}

async function executeScripts(req, res) {
  const { connection, scripts, destSchema } = req.body;
  if (!connection || !Array.isArray(scripts) || scripts.length === 0) {
    return res.status(400).json({ error: 'Faltan campos: connection y scripts[]' });
  }
  const conn = validateConn(connection);
  const result = await destinationService.executeScripts(conn, scripts, destSchema || null);
  res.json(result);
}

module.exports = { testConnection, executeScripts };
