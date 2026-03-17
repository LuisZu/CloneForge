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

export function executeScripts(conn, scripts, destSchema, replacements = []) {
  return api
    .post('/destination/execute', {
      connection: conn,
      scripts,
      destSchema: destSchema || null,
      replacements,
    })
    .then((r) => r.data);
}
