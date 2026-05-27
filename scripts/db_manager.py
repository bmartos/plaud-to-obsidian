import sqlite3
import sys
import os
import json

def init_db(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    # Drops and recreates for the new schema during this refinement phase
    cursor.execute('DROP TABLE IF EXISTS recordings')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS recordings (
            id TEXT PRIMARY KEY,
            fullname TEXT,
            filesize_mb REAL DEFAULT 0.0,
            duration TEXT,
            start_time TEXT,
            is_trash INTEGER,
            is_trans INTEGER,
            is_summary INTEGER,
            downloaded INTEGER DEFAULT 0,
            downloaded_at TEXT,
            transcribed INTEGER DEFAULT 0,
            transcribed_at TEXT,
            analyzed INTEGER DEFAULT 0,
            analyzed_at TEXT,
            raw_path TEXT,
            final_path TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    return conn

ALLOWED_FIELDS = {
    'fullname', 'filesize_mb', 'duration', 'start_time', 
    'is_trash', 'is_trans', 'is_summary', 
    'downloaded', 'downloaded_at', 'transcribed', 'transcribed_at', 
    'analyzed', 'analyzed_at', 'raw_path', 'final_path'
}

def format_duration(seconds):
    """Converts seconds to HH:MM:SS string."""
    try:
        h = seconds // 3600
        m = (seconds % 3600) // 60
        s = seconds % 60
        return f"{h:02d}:{m:02d}:{s:02d}"
    except:
        return "00:00:00"

def format_record(record):
    """Formats raw Plaud payload to match database schema."""
    formatted = record.copy()
    
    # Filesize to MB - Ensure it's handled, but Plaud CLI might not provide it yet
    if 'filesize' in record:
        formatted['filesize_mb'] = round(record['filesize'] / (1024 * 1024), 2)
        del formatted['filesize']
    elif 'filesize_mb' not in formatted:
        formatted['filesize_mb'] = 0.0
        
    # Duration to HH:MM:SS
    if 'duration' in record and isinstance(record['duration'], int):
        formatted['duration'] = format_duration(record['duration'])
        
    # Start time to UTC-3 string
    if 'start_time' in record and isinstance(record['start_time'], (int, float)):
        from datetime import datetime, timedelta, timezone
        dt = datetime.fromtimestamp(record['start_time'], tz=timezone.utc)
        dt_brazil = dt - timedelta(hours=3)
        formatted['start_time'] = dt_brazil.strftime('%Y-%m-%d %H:%M:%S')
        
    # Auto-fill timestamps for flags
    for flag, ts_field in [('downloaded', 'downloaded_at'), 
                           ('transcribed', 'transcribed_at'), 
                           ('analyzed', 'analyzed_at')]:
        if formatted.get(flag) == 1 and not formatted.get(ts_field):
            formatted[ts_field] = get_now_utc3()
            
    return formatted

def update_record(conn, record):
    cursor = conn.cursor()
    
    # Format the record before processing
    record = format_record(record)
    
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
    # Get the project root directory (one level up from scripts/)
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    default_db = os.path.join(project_root, 'data', 'plaud_records.db')
    
    db_path = os.environ.get('DATABASE_URL', default_db).replace('sqlite://', '')
    
    # Ensure data directory exists
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    
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
        cursor.execute('SELECT * FROM recordings ORDER BY start_time DESC')
        rows = cursor.fetchall()
        columns = [column[0] for column in cursor.description]
        results = [dict(zip(columns, row)) for row in rows]
        print(json.dumps(results))
    
    conn.close()
