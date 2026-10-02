// Compare logical definitions, not OIDs, generated information_schema NOT NULL
// names, or physical attribute numbers that can change during dump/restore.
export const recoverySchemaSql = String.raw`
  WITH parts AS (
    SELECT 'relation:'||c.relname::text||':'||c.relkind::text AS value
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S')
    UNION ALL
    SELECT 'column:'||c.relname::text||':'||
      row_number() OVER (PARTITION BY c.oid ORDER BY a.attnum)::text||':'||
      a.attname::text||':'||format_type(a.atttypid,a.atttypmod)||':'||
      a.attnotnull::text||':'||a.attidentity::text||':'||a.attgenerated::text||':'||
      COALESCE(pg_get_expr(d.adbin,d.adrelid),'')
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
    WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m')
      AND a.attnum>0 AND NOT a.attisdropped
    UNION ALL
    SELECT 'constraint:'||c.relname::text||':'||k.conname::text||':'||
      pg_get_constraintdef(k.oid)||':'||k.convalidated::text
    FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
    UNION ALL
    SELECT 'index:'||c.relname::text||':'||pg_get_indexdef(i.indexrelid)
    FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
    UNION ALL
    SELECT 'view:'||c.relname::text||':'||pg_get_viewdef(c.oid)
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('v','m')
    UNION ALL
    SELECT 'sequence:'||c.relname::text||':'||format_type(s.seqtypid,NULL)||':'||
      s.seqstart::text||':'||s.seqincrement::text||':'||s.seqmax::text||':'||
      s.seqmin::text||':'||s.seqcache::text||':'||s.seqcycle::text
    FROM pg_sequence s JOIN pg_class c ON c.oid=s.seqrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
  ) SELECT to_json(value)::text FROM parts ORDER BY value;
`;
