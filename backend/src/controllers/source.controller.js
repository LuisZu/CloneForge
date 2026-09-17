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
  const { connection, schema, name, type, includeData, table, indexName } = req.body;
  if (!connection || !schema || !name || !type) {
    return res.status(400).json({ error: 'Faltan campos: connection, schema, name, type' });
  }
  if (type === 'INDICE' && (!table || !indexName)) {
    return res.status(400).json({ error: 'Faltan campos: table, indexName para el tipo INDICE' });
  }
  const conn = validateConn(connection);
  const ddl = await sourceService.getDDL(conn, schema, name, type, !!includeData, { table, indexName });
  res.json({ ddl });
}

async function getSchemas(req, res) {
  const conn = validateConn(req.body);
  const schemas = await sourceService.getSchemas(conn);
  res.json({ schemas });
}

async function getTableColumns(req, res) {
  const { connection, schema, name } = req.body;
  if (!connection || !schema || !name) {
    return res.status(400).json({ error: 'Faltan campos: connection, schema, name' });
  }
  const conn = validateConn(connection);
  const columns = await sourceService.getTableColumns(conn, schema, name);
  res.json({ columns });
}

async function getTableRows(req, res) {
  const { connection, schema, name, limit } = req.body;
  if (!connection || !schema || !name) {
    return res.status(400).json({ error: 'Faltan campos: connection, schema, name' });
  }
  const conn = validateConn(connection);
  const result = await sourceService.getTableRows(conn, schema, name, limit);
  res.json(result);
}

module.exports = { testConnection, getObjects, getDDL, getTableColumns, getTableRows, getSchemas };
