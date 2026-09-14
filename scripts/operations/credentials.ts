import { assertDatabase, assertOperationTransport, requireCondition } from "./guards";

export const OPERATION_ROLES = {
  production: "pubquiz_backup_reader",
  preview: "pubquiz_preview_refresher",
} as const;

export const MEDIA_STORES = {
  production: "bIx6H2j23vJzi240",
  nonproduction: "VzfNwjccgkzhc9bi",
  backup: "BVRjATGCRBW0fBeF",
} as const;

// Return the URL only to the connection layer. Never log it or pass it as argv.
export function operationConnection(value: string | undefined, environment: keyof typeof OPERATION_ROLES) {
  const identity = assertDatabase(value, environment);
  const url = new URL(value!);
  assertOperationTransport(url);
  requireCondition(decodeURIComponent(url.username) === OPERATION_ROLES[environment] && !!url.password, "DEDICATED_OPERATION_ROLE_REQUIRED");
  url.hostname = identity.host;
  url.searchParams.delete("schema");
  return { identity, connectionString: url.toString() };
}

export function assertStoreToken(token: string | undefined, store: keyof typeof MEDIA_STORES) {
  const id = /^vercel_blob_rw_([A-Za-z0-9]+)_[A-Za-z0-9_-]+$/.exec(token ?? "")?.[1];
  requireCondition(id === MEDIA_STORES[store], "BLOB_TOKEN_STORE_MISMATCH");
  return { store: `store_${id}`, access: store === "backup" ? "private" : "public" };
}

export type ReaderPrivileges = {
  privileged_role: boolean;
  role_membership: boolean;
  persistent_write: boolean;
  sequence_write: boolean;
  schema_create: boolean;
  database_create: boolean;
  executable_definer: boolean;
  missing_read: boolean;
};

export function assertReaderPrivileges(result: ReaderPrivileges | undefined) {
  const keys: (keyof ReaderPrivileges)[] = ["privileged_role", "role_membership", "persistent_write", "sequence_write", "schema_create", "database_create", "executable_definer", "missing_read"];
  requireCondition(result && keys.every(key => result[key] === false), "PRODUCTION_READER_PRIVILEGES_REJECTED");
}

export const READER_PRIVILEGES_SQL = `
SELECT
  EXISTS (SELECT 1 FROM pg_roles WHERE rolname=current_user
    AND (rolsuper OR rolcreaterole OR rolcreatedb OR rolreplication OR rolbypassrls)) AS privileged_role,
  EXISTS (SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=current_user)) AS role_membership,
  EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
    AND c.relkind IN ('r','p','v','m','f') AND
    (pg_has_role(c.relowner,'USAGE') OR has_table_privilege(c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))) AS persistent_write,
  EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind='S' AND n.nspname NOT LIKE 'pg_%'
    AND (pg_has_role(c.relowner,'USAGE') OR has_sequence_privilege(c.oid,'USAGE,UPDATE'))) AS sequence_write,
  EXISTS (SELECT 1 FROM pg_namespace WHERE nspname NOT LIKE 'pg_%'
    AND nspname <> 'information_schema' AND has_schema_privilege(oid,'CREATE')) AS schema_create,
  has_database_privilege(current_database(),'CREATE') AS database_create,
  EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
    AND p.prosecdef AND has_function_privilege(p.oid,'EXECUTE')) AS executable_definer,
  EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN ('public','pubquiz') AND
    ((c.relkind IN ('r','p','v','m','f') AND NOT has_table_privilege(c.oid,'SELECT'))
    OR (c.relkind='S' AND NOT has_sequence_privilege(c.oid,'SELECT')))) AS missing_read
`;
