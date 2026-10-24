import postgres from 'postgres';
import { config } from './config.js';

const DATE_OID = 1082;
const JSON_OIDS = [114, 3802]; // json, jsonb

// Queries pass JSON already stringified (`$1::jsonb`, as with node-postgres). The driver would stringify it again.
const jsonType = (oid) => ({
  to: oid,
  from: [oid],
  serialize: (v) => (typeof v === 'string' ? v : JSON.stringify(v)),
  parse: (v) => JSON.parse(v),
});

// One small pool per function instance. prepare: false keeps it working through Supabase's pooler.
const sql = postgres(config.databaseUrl, {
  max: 3,
  prepare: false,
  idle_timeout: 20,
  onnotice: () => {},
  // Return DATE columns as 'YYYY-MM-DD' strings. A Date at local midnight shifts the day in UTC.
  types: {
    date: { to: DATE_OID, from: [DATE_OID], serialize: (v) => v, parse: (v) => v },
    json: jsonType(JSON_OIDS[0]),
    jsonb: jsonType(JSON_OIDS[1]),
  },
});

// The same shape node-postgres returns ({ rows, rowCount }), so queries read the same everywhere.
const run = (conn) => async (text, params = []) => {
  const rows = await conn.unsafe(text, params);
  return { rows: [...rows], rowCount: rows.count };
};

export const query = run(sql);
export const db = { query };

/** Run `fn` inside a transaction. Rolls back if it throws. */
export const withTransaction = (fn) => sql.begin((tx) => fn({ query: run(tx) }));

export const closeDb = () => sql.end({ timeout: 5 });
