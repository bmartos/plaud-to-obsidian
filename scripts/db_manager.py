import sqlite3
import sys
import os
import json

def init_db(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS recordings (
            id TEXT PRIMARY KEY,
            title TEXT,
            date TEXT,
            downloaded INTEGER DEFAULT 0,
            transcribed INTEGER DEFAULT 0,
            analyzed INTEGER DEFAULT 0,
            raw_path TEXT,
            final_path TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    return conn

ALLOWED_FIELDS = {'title', 'date', 'downloaded', 'transcribed', 'analyzed', 'raw_path', 'final_path'}

def update_record(conn, record):
    cursor = conn.cursor()
    id = record.get('id')
    if not id:
        return
    
    cursor.execute('SELECT id FROM recordings WHERE id = ?', (id,))
    exists = cursor.fetchone()
    
    # Whitelist fields to prevent SQL injection
    fields = [k for k in record.keys() if k != 'id' and k in ALLOWED_FIELDS]
    values = [record[k] for k in fields]
    
    if exists:
        if not fields:
            return
        set_clause = ', '.join([f'{f} = ?' for f in fields])
        cursor.execute(f'UPDATE recordings SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?', (*values, id))
    else:
        all_fields = ['id'] + fields
        placeholders = ', '.join(['?' for _ in all_fields])
        columns_clause = ', '.join(all_fields)
        cursor.execute(f'INSERT INTO recordings ({columns_clause}) VALUES ({placeholders})', (id, *values))
    conn.commit()

def get_record(conn, id):
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM recordings WHERE id = ?', (id,))
    row = cursor.fetchone()
    if row:
        columns = [column[0] for column in cursor.description]
        return dict(zip(columns, row))
    return None

if __name__ == "__main__":
    db_path = os.environ.get('DATABASE_URL', 'plaud_records.db').replace('sqlite://', '')
    conn = init_db(db_path)
    
    if len(sys.argv) < 2:
        print("[]")
        sys.exit(0)
        
    cmd = sys.argv[1]
    
    if cmd == 'update':
        record_json = sys.argv[2]
        record = json.loads(record_json)
        update_record(conn, record)
        print("Updated")
    elif cmd == 'get':
        id = sys.argv[2]
        record = get_record(conn, id)
        print(json.dumps(record))
    elif cmd == 'list':
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM recordings ORDER BY date DESC')
        rows = cursor.fetchall()
        columns = [column[0] for column in cursor.description]
        results = [dict(zip(columns, row)) for row in rows]
        print(json.dumps(results))
    
    conn.close()
