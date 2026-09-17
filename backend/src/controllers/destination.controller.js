const Joi = require('joi');
const destinationService = require('../services/destination.service');
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
  const result = await destinationService.testConnection(conn);
  res.json(result);
}

async function getObjects(req, res) {
  const conn = validateConn(req.body);
  const objects = await sourceService.getObjects(conn);
  res.json({ objects });
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

async function exportScripts(req, res) {
  const { scripts, destSchema, replacements, overwrite } = req.body;
  if (!Array.isArray(scripts) || scripts.length === 0) {
    return res.status(400).json({ error: 'Falta campo: scripts[]' });
  }
  const result = destinationService.exportScripts(
    scripts,
    destSchema || null,
    Array.isArray(replacements) ? replacements : [],
    overwrite === true
  );
  res.json(result);
}

async function executeScripts(req, res) {
  const { connection, scripts, destSchema, replacements, overwrite } = req.body;
  if (!connection || !Array.isArray(scripts) || scripts.length === 0) {
    return res.status(400).json({ error: 'Faltan campos: connection y scripts[]' });
  }
  const conn = validateConn(connection);
  const result = await destinationService.executeScripts(
    conn,
    scripts,
    destSchema || null,
    Array.isArray(replacements) ? replacements : [],
    overwrite === true
  );
  res.json(result);
}

async function insertRows(req, res) {
  const { connection, tableSchema, tableName, destSchema, columns, rows } = req.body;
  if (!connection || !tableSchema || !tableName || !Array.isArray(columns) || !Array.isArray(rows)) {
    return res.status(400).json({ error: 'Faltan campos: connection, tableSchema, tableName, columns[], rows[]' });
  }
  if (rows.length === 0) {
    return res.status(400).json({ error: 'No hay filas para insertar' });
  }
  const conn = validateConn(connection);
  const result = await destinationService.insertRows(conn, tableSchema, tableName, destSchema || null, columns, rows);
  res.json(result);
}

async function runScript(req, res) {
  const { connection, script } = req.body;
  if (!connection || !script || typeof script !== 'string' || !script.trim()) {
    return res.status(400).json({ error: 'Faltan campos: connection y script' });
  }
  const conn = validateConn(connection);
  const result = await destinationService.runScript(conn, script);
  res.json(result);
}

module.exports = { testConnection, getObjects, getTableColumns, getSchemas, exportScripts, executeScripts, insertRows, runScript };
