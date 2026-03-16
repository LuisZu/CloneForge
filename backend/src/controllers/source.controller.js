const Joi = require('joi');
const sourceService = require('../services/source.service');

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
  const result = await sourceService.testConnection(conn);
  res.json(result);
}

async function getObjects(req, res) {
  const conn = validateConn(req.body);
  const objects = await sourceService.getObjects(conn);
  res.json({ objects });
}

async function getDDL(req, res) {
  const { connection, schema, name, type, includeData } = req.body;
  if (!connection || !schema || !name || !type) {
    return res.status(400).json({ error: 'Faltan campos: connection, schema, name, type' });
  }
  const conn = validateConn(connection);
  const ddl = await sourceService.getDDL(conn, schema, name, type, !!includeData);
  res.json({ ddl });
}

module.exports = { testConnection, getObjects, getDDL };
