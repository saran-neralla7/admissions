import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
});

db.serialize(() => {
  console.log('--- COURSES IN DATABASE ---');
  db.all('SELECT * FROM courses', [], (err, rows) => {
    if (err) {
      console.error(err);
      return;
    }
    console.log(JSON.stringify(rows, null, 2));

    console.log('\n--- ACADEMIC YEARS IN DATABASE ---');
    db.all('SELECT * FROM academic_years', [], (err, years) => {
      if (err) {
        console.error(err);
        return;
      }
      console.log(JSON.stringify(years, null, 2));

      console.log('\n--- FORM SECTIONS & FIELDS IN DATABASE ---');
      db.all(`
        SELECT fs.name as section_name, ff.id, ff.label, ff.type, ff.is_required 
        FROM form_fields ff 
        JOIN form_sections fs ON ff.section_id = fs.id 
        ORDER BY fs.display_order, ff.display_order
      `, [], (err, fields) => {
        if (err) {
          console.error(err);
          return;
        }
        console.log(JSON.stringify(fields, null, 2));
        db.close();
      });
    });
  });
});
