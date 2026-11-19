import fs from 'fs';
import { pool } from '../src/database/client.js';

async function generateSchemaSql() {
  const client = await pool.connect();
  try {
    let out = '';
    out += '-- =========================================================================\n';
    out += '-- ORBIX ENTERPRISE PRODUCTION DATABASE DDL SCHEMA\n';
    out += '-- System: Orbix Developer Ecosystem & Campus Platform\n';
    out += '-- Dialect: PostgreSQL (v14+ / Supabase / Neon / AWS Aurora / Cloud SQL)\n';
    out += '-- Total Tables: 131\n';
    out += '-- Generated At: ' + new Date().toISOString() + '\n';
    out += '-- Purpose: Complete, self-contained, idempotent database bootstrap script.\n';
    out += '-- =========================================================================\n\n';

    out += '-- -------------------------------------------------------------------------\n';
    out += '-- 1. POSTGRESQL EXTENSIONS\n';
    out += '-- -------------------------------------------------------------------------\n';
    out += 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";\n';
    out += 'CREATE EXTENSION IF NOT EXISTS "pgcrypto";\n';
    out += 'CREATE EXTENSION IF NOT EXISTS "pg_trgm";\n\n';

    // 2. Custom Types / Enums
    const enumsRes = await client.query(`
      SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) as values
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
      GROUP BY t.typname
      ORDER BY t.typname;
    `);
    if (enumsRes.rows.length > 0) {
      out += '-- -------------------------------------------------------------------------\n';
      out += '-- 2. CUSTOM TYPES / ENUMS\n';
      out += '-- -------------------------------------------------------------------------\n';
      for (const e of enumsRes.rows) {
        const valStr = e.values.map((v: string) => client.escapeLiteral(v)).join(', ');
        out += `DO $$ BEGIN\n    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${e.typname}') THEN\n        CREATE TYPE public.${e.typname} AS ENUM (${valStr});\n    END IF;\nEND $$;\n\n`;
      }
    }

    // 3. Tables
    const tablesRes = await client.query(`
      SELECT c.oid, c.relname as table_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname;
    `);
    const tables = tablesRes.rows;

    out += '-- -------------------------------------------------------------------------\n';
    out += '-- 3. TABLE DEFINITIONS (Columns, Primary Keys, Unique & Check Constraints)\n';
    out += '-- -------------------------------------------------------------------------\n\n';

    for (const table of tables) {
      const tableName = table.table_name;
      const tableOid = table.oid;

      // Get columns
      const colsRes = await client.query(`
        SELECT 
          a.attname as col_name,
          format_type(a.atttypid, a.atttypmod) as col_type,
          a.attnotnull as is_not_null,
          pg_get_expr(d.adbin, d.adrelid) as col_default
        FROM pg_attribute a
        LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        WHERE a.attrelid = $1 AND a.attnum > 0 AND NOT a.attisdropped
        ORDER BY a.attnum;
      `, [tableOid]);

      // Get inline non-FK constraints (Primary Key, Unique, Check)
      const consRes = await client.query(`
        SELECT 
          conname,
          contype,
          pg_get_constraintdef(oid) as def
        FROM pg_constraint
        WHERE conrelid = $1
          AND contype IN ('p', 'u', 'c')
        ORDER BY contype, conname;
      `, [tableOid]);

      out += `-- Table: ${tableName}\n`;
      out += `CREATE TABLE IF NOT EXISTS public.${tableName} (\n`;
      const colDefs: string[] = [];
      for (const col of colsRes.rows) {
        let line = `    ${col.col_name} ${col.col_type}`;
        if (col.col_default) {
          line += ` DEFAULT ${col.col_default}`;
        }
        if (col.is_not_null) {
          line += ' NOT NULL';
        }
        colDefs.push(line);
      }

      for (const con of consRes.rows) {
        colDefs.push(`    CONSTRAINT ${con.conname} ${con.def}`);
      }

      out += colDefs.join(',\n') + '\n);\n\n';
    }

    // 4. Foreign Key Constraints
    out += '-- -------------------------------------------------------------------------\n';
    out += '-- 4. FOREIGN KEY CONSTRAINTS (Referential Integrity)\n';
    out += '-- -------------------------------------------------------------------------\n\n';

    const fkRes = await client.query(`
      SELECT 
        c1.relname as table_name,
        con.conname,
        pg_get_constraintdef(con.oid) as def
      FROM pg_constraint con
      JOIN pg_class c1 ON c1.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c1.relnamespace
      WHERE con.contype = 'f' AND n.nspname = 'public'
      ORDER BY c1.relname, con.conname;
    `);

    for (const fk of fkRes.rows) {
      out += `DO $$ BEGIN\n    IF NOT EXISTS (\n        SELECT 1 FROM pg_constraint \n        WHERE conname = '${fk.conname}' AND conrelid = 'public.${fk.table_name}'::regclass\n    ) THEN\n        ALTER TABLE public.${fk.table_name} ADD CONSTRAINT ${fk.conname} ${fk.def};\n    END IF;\nEND $$;\n`;
    }
    out += '\n';

    // 5. Indexes (excluding primary key and unique constraint indexes)
    out += '-- -------------------------------------------------------------------------\n';
    out += '-- 5. PERFORMANCE AND SEARCH INDEXES\n';
    out += '-- -------------------------------------------------------------------------\n\n';

    const idxRes = await client.query(`
      SELECT i.indexname, i.indexdef
      FROM pg_indexes i
      JOIN pg_class c ON c.relname = i.indexname
      JOIN pg_index pi ON pi.indexrelid = c.oid
      LEFT JOIN pg_constraint con ON con.conindid = c.oid
      WHERE i.schemaname = 'public'
        AND con.oid IS NULL
      ORDER BY i.tablename, i.indexname;
    `);

    for (const idx of idxRes.rows) {
      let indexDef = idx.indexdef;
      if (!indexDef.includes('IF NOT EXISTS')) {
        indexDef = indexDef.replace('CREATE INDEX ', 'CREATE INDEX IF NOT EXISTS ');
        indexDef = indexDef.replace('CREATE UNIQUE INDEX ', 'CREATE UNIQUE INDEX IF NOT EXISTS ');
      }
      out += `${indexDef};\n`;
    }

    const targetPath = 'src/database/schema_production_complete.sql';
    fs.writeFileSync(targetPath, out);
    console.log(`SUCCESS: Written ${out.length} bytes to ${targetPath}`);
    console.log(`- Tables: ${tables.length}`);
    console.log(`- Foreign Keys: ${fkRes.rows.length}`);
    console.log(`- Indexes: ${idxRes.rows.length}`);
  } catch (err) {
    console.error('Error generating schema:', err);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

generateSchemaSql();
