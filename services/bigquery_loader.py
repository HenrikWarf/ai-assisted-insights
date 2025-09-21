import os
import json
import sqlite3
from typing import Dict, Any, List, Optional

def _get_bq_client(sa_json: Optional[str], project: str):
    from google.cloud import bigquery
    from google.oauth2 import service_account
    if sa_json:
        info = json.loads(sa_json)
        creds = service_account.Credentials.from_service_account_info(info, scopes=["https://www.googleapis.com/auth/cloud-platform"])
        return bigquery.Client(project=project, credentials=creds)
    # Default credentials
    return bigquery.Client(project=project)

def import_tables_to_sqlite(config: Dict[str, Any], sqlite_path: str, sa_json: Optional[str]):
    project = config["gcp_project"]
    dataset = config["bq_dataset"]
    tables: List[str] = config["bq_tables"]
    client = _get_bq_client(sa_json, project)

    # Connect to SQLite
    conn = sqlite3.connect(sqlite_path)
    conn.execute("PRAGMA journal_mode=WAL;")
    cur = conn.cursor()

    for table in tables:
        table = table.strip()
        if not table:
            continue
        full = f"`{project}`.`{dataset}`.`{table}`"
        query = f"SELECT * FROM {full} LIMIT 50000"  # MVP: cap rows
        job = client.query(query)
        results = job.result()
        # Create table schema in SQLite
        cols = [schema.name for schema in results.schema]
        col_defs = ", ".join(f'"{c}" TEXT' for c in cols)
        cur.execute(f'CREATE TABLE IF NOT EXISTS "{table}" ({col_defs})')
        # Insert rows
        placeholders = ",".join(["?"] * len(cols))
        insert_sql = f'INSERT INTO "{table}" ({", ".join(f"\"{c}\"" for c in cols)}) VALUES ({placeholders})'
        batch: List[tuple] = []
        for row in results:
            batch.append(tuple(str(row[c]) if row[c] is not None else None for c in cols))
            if len(batch) >= 1000:
                cur.executemany(insert_sql, batch)
                batch.clear()
        if batch:
            cur.executemany(insert_sql, batch)
        conn.commit()

    conn.close()


