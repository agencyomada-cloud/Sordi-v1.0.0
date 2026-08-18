import sqlite3
import re

db_path = r'C:\Users\omada production\AppData\Roaming\com.mobino.app\database.db'
rs_path = r'C:\Users\omada production\Desktop\mobinov3-main\src-tauri\src\database.rs'

conn = sqlite3.connect(db_path)
c = conn.cursor()
c.execute('SELECT key, value FROM settings')
rows = c.fetchall()

rust_code = "    // Initialize default settings if they don't exist\n"
rust_code += "    let default_settings = [\n"
for key, value in rows:
    if value is None:
        value = ""
    # Use Rust raw string literals to avoid escaping nightmares: r#"content"#
    # Wait, if the value contains r#", we'd need r##"content"##. 
    # Let's just use replace and standard string since base64 has no special chars except standard stuff.
    escaped_value = value.replace('\\', '\\\\').replace('"', '\\"')
    rust_code += f'        ("{key}", "{escaped_value}"),\n'
rust_code += "    ];\n\n"
rust_code += "    let mut stmt = conn.prepare(\"INSERT OR IGNORE INTO settings (key, value) VALUES (?1, ?2)\")?;\n"
rust_code += "    for (key, value) in default_settings.iter() {\n"
rust_code += "        stmt.execute(rusqlite::params![key, value])?;\n"
rust_code += "    }\n"

with open(rs_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Make sure we use the correct regex pattern
pattern = re.compile(r'// Initialize default settings if they don\'t exist\s+conn\.execute\(\s*"INSERT OR IGNORE INTO settings.*?\]\,\s*\)\?;', re.DOTALL)

new_content = pattern.sub(rust_code, content)

with open(rs_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Successfully injected settings into database.rs!")
