/**
 * Postgres DATE (OID 1082) is kept as the raw YYYY-MM-DD string. The default pg parser turns it
 * into a local-midnight JS Date, which shifts by a day in other server timezones (D-15, SEC-06).
 * This parser is global to the process, so every pool shares it. Imported for its side effect by
 * db/client.js.
 */

import pg from 'pg';

pg.types.setTypeParser(1082, (value) => value);
