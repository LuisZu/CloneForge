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
    const result = await pool.request().query('SELECT @@VERSION AS version');
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

async function getDDL(connConfig, schema, name, type, includeData = false) {
  return withPool(connConfig, async (pool) => {
    if (type === 'TABLA') {
      return buildTableDDL(pool, schema, name, includeData);
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

    // Use DROP + CREATE for all programmable objects instead of CREATE OR ALTER,
    // which causes "ALTER X must be the first statement in a query batch" on
    // some SQL Server configurations. .batch() splits on GO so each statement
    // runs as its own batch, making CREATE the clean first instruction.
    return buildDropCreate(ddl.trim(), schema, name, type);
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const DROP_TYPE = {
  VISTA:   { keyword: 'VIEW',      typeCode: "'V'" },
  SP:      { keyword: 'PROCEDURE', typeCode: "'P'" },
  FUNCION: { keyword: 'FUNCTION',  typeCode: null  }, // FN/IF/TF — skip type code
  TRIGGER: { keyword: 'TRIGGER',   typeCode: "'TR'" },
};

/**
 * Returns a DROP (if exists) + GO + CREATE script.
 * The GO separator makes .batch() send them as two independent batches so
 * CREATE is always the first statement of its batch.
 */
function buildDropCreate(ddl, schema, name, type) {
  const meta = DROP_TYPE[type];
  if (!meta) return ddl; // fallback: return as-is

  // Normalise: strip any prior CREATE OR ALTER → plain CREATE
  const cleanDdl = ddl
    .replace(/\bCREATE\s+OR\s+ALTER\s+PROCEDURE\b/gi, 'CREATE PROCEDURE')
    .replace(/\bCREATE\s+OR\s+ALTER\s+FUNCTION\b/gi,  'CREATE FUNCTION')
    .replace(/\bCREATE\s+OR\s+ALTER\s+TRIGGER\b/gi,   'CREATE TRIGGER')
    .replace(/\bCREATE\s+OR\s+ALTER\s+VIEW\b/gi,      'CREATE VIEW');

  const typeFilter = meta.typeCode ? `, ${meta.typeCode}` : '';
  const drop =
    `IF OBJECT_ID(N'[${schema}].[${name}]'${typeFilter}) IS NOT NULL\n` +
    `    DROP ${meta.keyword} [${schema}].[${name}]`;

  return `${drop}\nGO\n${cleanDdl}`;
}

/** @deprecated kept only as safety fallback — not called for any active type */
function makeIdempotent(ddl) {
  return ddl
    .replace(/\bCREATE\s+OR\s+ALTER\s+PROCEDURE\b/gi, 'CREATE OR ALTER PROCEDURE')
    .replace(/\bCREATE\s+PROCEDURE\b/gi,              'CREATE OR ALTER PROCEDURE')
    .replace(/\bCREATE\s+OR\s+ALTER\s+FUNCTION\b/gi, 'CREATE OR ALTER FUNCTION')
    .replace(/\bCREATE\s+FUNCTION\b/gi,              'CREATE OR ALTER FUNCTION')
    .replace(/\bCREATE\s+OR\s+ALTER\s+TRIGGER\b/gi,  'CREATE OR ALTER TRIGGER')
    .replace(/\bCREATE\s+TRIGGER\b/gi,               'CREATE OR ALTER TRIGGER');
}

async function buildTableDDL(pool, schema, name, includeData) {
  // ── 1. Columns ──────────────────────────────────────────────────────────────
  const colsResult = await pool.request()
    .input('schema', sql.NVarChar, schema)
    .input('name',   sql.NVarChar, name)
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
      LEFT  JOIN sys.identity_columns ic
             ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      LEFT  JOIN sys.default_constraints dc
             ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
      LEFT  JOIN sys.computed_columns cc
             ON cc.object_id = c.object_id AND cc.column_id = c.column_id
      WHERE c.object_id = OBJECT_ID(@schema + '.' + @name)
      ORDER BY c.column_id
    `);

  // ── 2. Primary Key ──────────────────────────────────────────────────────────
  const pkResult = await pool.request()
    .input('schema', sql.NVarChar, schema)
    .input('name',   sql.NVarChar, name)
    .query(`
      SELECT kc.name AS constraint_name, c.name AS column_name,
             ic.key_ordinal, ic.is_descending_key
      FROM sys.key_constraints kc
      INNER JOIN sys.index_columns ic
             ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
      INNER JOIN sys.columns c
             ON c.object_id = ic.object_id AND c.column_id = ic.column_id
      WHERE kc.type = 'PK'
        AND kc.parent_object_id = OBJECT_ID(@schema + '.' + @name)
      ORDER BY ic.key_ordinal
    `);

  // ── 3. Indexes (non-PK, non-unique-constraint) ──────────────────────────────
  const idxResult = await pool.request()
    .input('schema', sql.NVarChar, schema)
    .input('name',   sql.NVarChar, name)
    .query(`
      SELECT i.name            AS index_name,
             i.type_desc,
             i.is_unique,
             c.name            AS column_name,
             ic.key_ordinal,
             ic.is_descending_key,
             ic.is_included_column
      FROM sys.indexes i
      INNER JOIN sys.index_columns ic
             ON ic.object_id = i.object_id AND ic.index_id = i.index_id
      INNER JOIN sys.columns c
             ON c.object_id = ic.object_id AND c.column_id = ic.column_id
      WHERE i.object_id       = OBJECT_ID(@schema + '.' + @name)
        AND i.is_primary_key  = 0
        AND i.is_unique_constraint = 0
        AND i.type            > 0
      ORDER BY i.name, ic.key_ordinal
    `);

  // ── 4. Foreign Keys ─────────────────────────────────────────────────────────
  const fkResult = await pool.request()
    .input('schema', sql.NVarChar, schema)
    .input('name',   sql.NVarChar, name)
    .query(`
      SELECT fk.name                                        AS fk_name,
             c.name                                         AS column_name,
             OBJECT_SCHEMA_NAME(fk.referenced_object_id)   AS ref_schema,
             OBJECT_NAME(fk.referenced_object_id)          AS ref_table,
             rc.name                                        AS ref_column,
             fkc.constraint_column_id,
             fk.delete_referential_action_desc,
             fk.update_referential_action_desc
      FROM sys.foreign_keys fk
      INNER JOIN sys.foreign_key_columns fkc
             ON fkc.constraint_object_id = fk.object_id
      INNER JOIN sys.columns c
             ON c.object_id = fk.parent_object_id AND c.column_id = fkc.parent_column_id
      INNER JOIN sys.columns rc
             ON rc.object_id = fk.referenced_object_id AND rc.column_id = fkc.referenced_column_id
      WHERE fk.parent_object_id = OBJECT_ID(@schema + '.' + @name)
      ORDER BY fk.name, fkc.constraint_column_id
    `);

  const cols   = colsResult.recordset;
  const pkRows = pkResult.recordset;
  const idxRows = idxResult.recordset;
  const fkRows  = fkResult.recordset;

  const hasIdentity = cols.some((c) => c.is_identity);

  // ── Build CREATE TABLE ──────────────────────────────────────────────────────
  const colDefs = cols.map((col) => {
    if (col.computed_definition) {
      return `    [${col.column_name}] AS ${col.computed_definition}`;
    }
    let def = `    [${col.column_name}] ${formatType(col)}`;
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

  const parts = [];
  parts.push(
    `-- ============================================================\n` +
    `-- TABLA: [${schema}].[${name}]\n` +
    `-- ============================================================\n` +
    `IF NOT EXISTS (\n` +
    `  SELECT 1 FROM sys.objects\n` +
    `  WHERE object_id = OBJECT_ID(N'[${schema}].[${name}]') AND type = 'U'\n` +
    `)\n` +
    `CREATE TABLE [${schema}].[${name}] (\n${colDefs.join(',\n')}\n)`
  );

  // ── Indexes ─────────────────────────────────────────────────────────────────
  if (idxRows.length > 0) {
    // Group by index name
    const indexMap = new Map();
    for (const row of idxRows) {
      if (!indexMap.has(row.index_name)) {
        indexMap.set(row.index_name, { ...row, keycols: [], includedCols: [] });
      }
      const idx = indexMap.get(row.index_name);
      if (row.is_included_column) {
        idx.includedCols.push(row.column_name);
      } else {
        idx.keyols  = idx.keyols || [];
        idx.keyCols = idx.keyCols || [];
        idx.keyCols.push(`[${row.column_name}]${row.is_descending_key ? ' DESC' : ''}`);
      }
    }

    for (const [idxName, idx] of indexMap) {
      const unique = idx.is_unique ? 'UNIQUE ' : '';
      const typeDesc = idx.type_desc === 'CLUSTERED' ? 'CLUSTERED ' : 'NONCLUSTERED ';
      const keyCols = (idx.keyCols || []).join(', ');
      let stmt =
        `IF NOT EXISTS (\n` +
        `  SELECT 1 FROM sys.indexes\n` +
        `  WHERE object_id = OBJECT_ID(N'[${schema}].[${name}]') AND name = N'${idxName}'\n` +
        `)\n` +
        `CREATE ${unique}${typeDesc}INDEX [${idxName}]\n` +
        `    ON [${schema}].[${name}] (${keyCols})`;
      if (idx.includedCols.length > 0) {
        stmt += `\n    INCLUDE (${idx.includedCols.map((c) => `[${c}]`).join(', ')})`;
      }
      parts.push(stmt);
    }
  }

  // ── Foreign Keys ─────────────────────────────────────────────────────────────
  if (fkRows.length > 0) {
    // Group by FK name
    const fkMap = new Map();
    for (const row of fkRows) {
      if (!fkMap.has(row.fk_name)) {
        fkMap.set(row.fk_name, {
          ...row,
          parentCols: [],
          refCols: [],
        });
      }
      const fk = fkMap.get(row.fk_name);
      fk.parentCols.push(`[${row.column_name}]`);
      fk.refCols.push(`[${row.ref_column}]`);
    }

    for (const [fkName, fk] of fkMap) {
      const delAction = formatRefAction(fk.delete_referential_action_desc);
      const updAction = formatRefAction(fk.update_referential_action_desc);
      const stmt =
        `IF NOT EXISTS (\n` +
        `  SELECT 1 FROM sys.foreign_keys WHERE name = N'${fkName}'\n` +
        `)\n` +
        `ALTER TABLE [${schema}].[${name}]\n` +
        `    ADD CONSTRAINT [${fkName}]\n` +
        `    FOREIGN KEY (${fk.parentCols.join(', ')})\n` +
        `    REFERENCES [${fk.ref_schema}].[${fk.ref_table}] (${fk.refCols.join(', ')})` +
        (delAction !== 'NO ACTION' ? `\n    ON DELETE ${delAction}` : '') +
        (updAction !== 'NO ACTION' ? `\n    ON UPDATE ${updAction}` : '');
      parts.push(stmt);
    }
  }

  // ── Data (optional) ─────────────────────────────────────────────────────────
  if (includeData) {
    const dataStmts = await buildDataInserts(pool, schema, name, cols, hasIdentity);
    if (dataStmts) parts.push(dataStmts);
  }

  return parts.join('\n\n');
}

function formatRefAction(desc) {
  if (!desc || desc === 'NO_ACTION') return 'NO ACTION';
  return desc.replace(/_/g, ' ');
}

async function buildDataInserts(pool, schema, name, colMeta, hasIdentity) {
  const dataResult = await pool.request()
    .query(`SELECT * FROM [${schema}].[${name}] WITH (NOLOCK)`);

  if (dataResult.recordset.length === 0) return '';

  const colNames = colMeta
    .filter((c) => !c.computed_definition)
    .map((c) => c.column_name);
  const colList = colNames.map((c) => `[${c}]`).join(', ');

  const lines = [];
  lines.push(`-- DATA: ${dataResult.recordset.length} filas`);
  if (hasIdentity) {
    lines.push(`SET IDENTITY_INSERT [${schema}].[${name}] ON`);
  }

  for (const row of dataResult.recordset) {
    const values = colNames.map((c) => formatSqlValue(row[c])).join(', ');
    lines.push(`INSERT INTO [${schema}].[${name}] (${colList}) VALUES (${values})`);
  }

  if (hasIdentity) {
    lines.push(`SET IDENTITY_INSERT [${schema}].[${name}] OFF`);
  }

  return lines.join('\n');
}

function formatSqlValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean')   return val ? '1' : '0';
  if (typeof val === 'number')    return String(val);
  if (Buffer.isBuffer(val))       return '0x' + val.toString('hex');
  if (val instanceof Date)        return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
  return `N'${String(val).replace(/'/g, "''")}'`;
}

function formatType(col) {
  const t = col.data_type.toLowerCase();
  const varlen   = ['varchar', 'nvarchar', 'char', 'nchar', 'binary', 'varbinary'];
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
