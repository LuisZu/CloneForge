const { withPool, sql } = require('../config/db');

const TYPE_LABEL = {
  SP: 'Stored Procedure',
  VISTA: 'Vista',
  TABLA: 'Tabla',
  FUNCION: 'Función',
  TRIGGER: 'Trigger',
};

async function testConnection(connConfig) {
  return withPool(connConfig, async (pool) => {
    const result = await pool.request().query(
      "SELECT @@VERSION AS version"
    );
    const raw = result.recordset[0].version || '';
    const match = raw.match(/Microsoft SQL Server[^\n]*/);
    return { connected: true, serverVersion: match ? match[0].trim() : raw.split('\n')[0].trim() };
  });
}

async function getObjects(connConfig) {
  return withPool(connConfig, async (pool) => {
    const result = await pool.request().query(`
      SELECT
        s.name        AS [schema],
        o.name        AS [name],
        o.type        AS [rawType],
        o.modify_date AS [modifiedAt],
        CASE o.type
          WHEN 'P'  THEN 'SP'
          WHEN 'V'  THEN 'VISTA'
          WHEN 'U'  THEN 'TABLA'
          WHEN 'FN' THEN 'FUNCION'
          WHEN 'IF' THEN 'FUNCION'
          WHEN 'TF' THEN 'FUNCION'
          WHEN 'TR' THEN 'TRIGGER'
        END AS [type]
      FROM sys.objects o
      INNER JOIN sys.schemas s ON o.schema_id = s.schema_id
      WHERE o.type IN ('P','V','U','FN','IF','TF','TR')
        AND o.is_ms_shipped = 0
      ORDER BY [type], s.name, o.name
    `);

    return result.recordset.map((row) => ({
      id: `${row.schema}.${row.name}__${row.rawType.trim()}`,
      schema: row.schema,
      name: row.name,
      type: row.type,
      typeLabel: TYPE_LABEL[row.type] || row.type,
      modifiedAt: row.modifiedAt,
    }));
  });
}

async function getDDL(connConfig, schema, name, type) {
  return withPool(connConfig, async (pool) => {
    if (type === 'TABLA') {
      return buildTableDDL(pool, schema, name);
    }

    const result = await pool.request()
      .input('objName', sql.NVarChar, `${schema}.${name}`)
      .query('SELECT OBJECT_DEFINITION(OBJECT_ID(@objName)) AS ddl');

    let ddl = result.recordset[0]?.ddl;
    if (!ddl) {
      throw Object.assign(
        new Error(`No se pudo obtener el DDL de "${schema}.${name}". El objeto puede estar encriptado.`),
        { status: 422 }
      );
    }

    ddl = makeIdempotent(ddl);
    return ddl;
  });
}

/** Rewrite CREATE X → CREATE OR ALTER X for SP/View/Function/Trigger */
function makeIdempotent(ddl) {
  return ddl
    .replace(/\bCREATE\s+OR\s+ALTER\s+PROCEDURE\b/gi, 'CREATE OR ALTER PROCEDURE')
    .replace(/\bCREATE\s+PROCEDURE\b/gi,              'CREATE OR ALTER PROCEDURE')
    .replace(/\bCREATE\s+OR\s+ALTER\s+VIEW\b/gi,     'CREATE OR ALTER VIEW')
    .replace(/\bCREATE\s+VIEW\b/gi,                  'CREATE OR ALTER VIEW')
    .replace(/\bCREATE\s+OR\s+ALTER\s+FUNCTION\b/gi, 'CREATE OR ALTER FUNCTION')
    .replace(/\bCREATE\s+FUNCTION\b/gi,              'CREATE OR ALTER FUNCTION')
    .replace(/\bCREATE\s+OR\s+ALTER\s+TRIGGER\b/gi,  'CREATE OR ALTER TRIGGER')
    .replace(/\bCREATE\s+TRIGGER\b/gi,               'CREATE OR ALTER TRIGGER');
}

async function buildTableDDL(pool, schema, name) {
  // Get columns
  const colsResult = await pool.request()
    .input('schema', sql.NVarChar, schema)
    .input('name', sql.NVarChar, name)
    .query(`
      SELECT
        c.name                  AS column_name,
        tp.name                 AS data_type,
        c.max_length,
        c.precision,
        c.scale,
        c.is_nullable,
        c.is_identity,
        ic.seed_value,
        ic.increment_value,
        dc.definition           AS default_definition,
        cc.definition           AS computed_definition,
        c.column_id
      FROM sys.columns c
      INNER JOIN sys.types tp ON c.user_type_id = tp.user_type_id
      LEFT JOIN sys.identity_columns ic
        ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      LEFT JOIN sys.default_constraints dc
        ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
      LEFT JOIN sys.computed_columns cc
        ON cc.object_id = c.object_id AND cc.column_id = c.column_id
      WHERE c.object_id = OBJECT_ID(@schema + '.' + @name)
      ORDER BY c.column_id
    `);

  // Get primary key
  const pkResult = await pool.request()
    .input('schema', sql.NVarChar, schema)
    .input('name', sql.NVarChar, name)
    .query(`
      SELECT
        kc.name       AS constraint_name,
        c.name        AS column_name,
        ic.key_ordinal,
        ic.is_descending_key
      FROM sys.key_constraints kc
      INNER JOIN sys.index_columns ic
        ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
      INNER JOIN sys.columns c
        ON c.object_id = ic.object_id AND c.column_id = ic.column_id
      WHERE kc.type = 'PK'
        AND kc.parent_object_id = OBJECT_ID(@schema + '.' + @name)
      ORDER BY ic.key_ordinal
    `);

  const cols = colsResult.recordset;
  const pkRows = pkResult.recordset;

  const colDefs = cols.map((col) => {
    if (col.computed_definition) {
      return `    [${col.column_name}] AS ${col.computed_definition}`;
    }

    let typeDef = formatType(col);
    let def = `    [${col.column_name}] ${typeDef}`;

    if (col.is_identity) {
      def += ` IDENTITY(${col.seed_value ?? 1},${col.increment_value ?? 1})`;
    }
    if (col.default_definition) {
      def += ` DEFAULT ${col.default_definition}`;
    }
    def += col.is_nullable ? ' NULL' : ' NOT NULL';
    return def;
  });

  if (pkRows.length > 0) {
    const pkCols = pkRows
      .map((r) => `[${r.column_name}]${r.is_descending_key ? ' DESC' : ''}`)
      .join(', ');
    colDefs.push(`    CONSTRAINT [${pkRows[0].constraint_name}] PRIMARY KEY (${pkCols})`);
  }

  const ddl =
    `IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[${schema}].[${name}]') AND type = 'U')\n` +
    `CREATE TABLE [${schema}].[${name}] (\n${colDefs.join(',\n')}\n)`;

  return ddl;
}

function formatType(col) {
  const t = col.data_type.toLowerCase();
  const varlen = ['varchar', 'nvarchar', 'char', 'nchar', 'binary', 'varbinary'];
  const precScale = ['decimal', 'numeric'];

  if (varlen.includes(t)) {
    const len = col.max_length === -1 ? 'MAX' : (t.startsWith('n') ? col.max_length / 2 : col.max_length);
    return `[${col.data_type}](${len})`;
  }
  if (precScale.includes(t)) {
    return `[${col.data_type}](${col.precision},${col.scale})`;
  }
  return `[${col.data_type}]`;
}

module.exports = { testConnection, getObjects, getDDL };
