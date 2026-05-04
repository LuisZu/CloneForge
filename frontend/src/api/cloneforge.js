import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// ── Source ───────────────────────────────────────────────────────────────────

export function testSourceConnection(conn) {
  return api.post('/source/test', conn).then((r) => r.data);
}

export function fetchObjects(conn) {
  return api.post('/source/objects', conn).then((r) => r.data.objects);
}

export function fetchDDL(conn, { schema, name, type }, includeData = false) {
  return api
    .post('/source/ddl', { connection: conn, schema, name, type, includeData })
    .then((r) => r.data.ddl);
}

// ── Destination ───────────────────────────────────────────────────────────────

export function testDestinationConnection(conn) {
  return api.post('/destination/test', conn).then((r) => r.data);
}

export function fetchTableRows(conn, schema, name, limit = 1000) {
  return api
    .post('/source/rows', { connection: conn, schema, name, limit })
    .then((r) => r.data);
}

export function insertRows(conn, tableSchema, tableName, destSchema, columns, rows) {
  return api
    .post('/destination/insert-rows', { connection: conn, tableSchema, tableName, destSchema, columns, rows })
    .then((r) => r.data);
}

export function runScript(conn, script) {
  return api
    .post('/destination/run-script', { connection: conn, script })
    .then((r) => r.data);
}

export function exportScripts(scripts, destSchema, replacements = [], overwrite = false) {
  return api
    .post('/destination/export-scripts', {
      scripts,
      destSchema: destSchema || null,
      replacements,
      overwrite,
    })
    .then((r) => r.data.sql);
}

export function executeScripts(conn, scripts, destSchema, replacements = [], overwrite = false) {
  return api
    .post('/destination/execute', {
      connection: conn,
      scripts,
      destSchema: destSchema || null,
      replacements,
      overwrite,
    })
    .then((r) => r.data);
}
