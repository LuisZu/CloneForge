function escapeIdent(id) {
  return id.replace(/]/g, ']]');
}

/**
 * Generates one ALTER TABLE ... ADD statement per missing column (guarded by
 * IF NOT EXISTS), separated by GO so they run as independent batches and
 * report per-column results via runScript().
 */
export function generateAddColumnsScript(table, destSchema, columns) {
  const targetSchema = destSchema || table.schema;
  const s = escapeIdent(targetSchema);
  const t = escapeIdent(table.name);
  const fullTable = `[${s}].[${t}]`;

  const stmts = columns.map((col) => {
    const colName = escapeIdent(col.name);
    let def;
    if (col.computedDefinition) {
      def = `[${colName}] AS ${col.computedDefinition}`;
    } else {
      def = `[${colName}] ${col.dataType}`;
      if (col.isIdentity) {
        def += ` IDENTITY(${col.seedValue ?? 1},${col.incrementValue ?? 1})`;
      }
      def += col.isNullable ? ' NULL' : ' NOT NULL';
      if (col.defaultValue) {
        def += ` DEFAULT ${col.defaultValue}`;
      }
    }

    return (
      `IF NOT EXISTS (\n` +
      `  SELECT 1 FROM sys.columns\n` +
      `  WHERE object_id = OBJECT_ID(N'${fullTable}') AND name = N'${col.name.replace(/'/g, "''")}'\n` +
      `)\n` +
      `ALTER TABLE ${fullTable} ADD ${def}`
    );
  });

  return stmts.join('\nGO\n\n') + '\nGO';
}
