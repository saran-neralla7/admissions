import sqlite3 from 'sqlite3';
import pkg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine database mode
const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
const usePostgres = !!DATABASE_URL;

let db = null;
let pool = null;

if (usePostgres) {
  console.log('Database Mode: PostgreSQL (Supabase)');
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
} else {
  console.log('Database Mode: SQLite (Local)');
  const dbPath = path.resolve(__dirname, '../database.sqlite');
  db = new sqlite3.Database(dbPath);
  db.run('PRAGMA foreign_keys = ON;');
}

// --- HELPER WRAPPERS ---
function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function dbTransaction(fn) {
  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      db.run('BEGIN TRANSACTION', async (err) => {
        if (err) return reject(err);
        try {
          const result = await fn();
          db.run('COMMIT', (commitErr) => {
            if (commitErr) reject(commitErr);
            else resolve(result);
          });
        } catch (error) {
          db.run('ROLLBACK', () => {
            reject(error);
          });
        }
      });
    });
  });
}

// Convert SQLite ? to Postgres $1, $2
function convertQuery(sql) {
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
}

// --- AUTO INITIALIZATION FOR POSTGRES ---
export async function initDb() {
  if (!usePostgres) {
    console.log('SQLite database initialized locally.');
    return;
  }

  const client = await pool.connect();
  try {
    console.log('Verifying PostgreSQL / Supabase schema...');
    
    // Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS academic_years (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        is_active INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        prefix VARCHAR(50) UNIQUE NOT NULL,
        current_number INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS form_sections (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        display_order INTEGER NOT NULL,
        is_enabled INTEGER DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS form_fields (
        id SERIAL PRIMARY KEY,
        section_id INTEGER NOT NULL,
        type VARCHAR(50) NOT NULL,
        label VARCHAR(255) NOT NULL,
        placeholder VARCHAR(255),
        is_required INTEGER DEFAULT 0,
        validation_regex TEXT,
        help_text TEXT,
        display_order INTEGER NOT NULL,
        is_enabled INTEGER DEFAULT 1,
        options TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (section_id) REFERENCES form_sections(id) ON DELETE CASCADE
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS student_submissions (
        id SERIAL PRIMARY KEY,
        application_number VARCHAR(100) UNIQUE NOT NULL,
        aadhaar_number VARCHAR(12) UNIQUE NOT NULL,
        course_id INTEGER NOT NULL,
        academic_year_id INTEGER NOT NULL,
        status VARCHAR(50) DEFAULT 'Pending',
        submission_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (course_id) REFERENCES courses(id),
        FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS submission_values (
        id SERIAL PRIMARY KEY,
        submission_id INTEGER NOT NULL,
        field_id INTEGER,
        field_label VARCHAR(255) NOT NULL,
        value TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (submission_id) REFERENCES student_submissions(id) ON DELETE CASCADE,
        FOREIGN KEY (field_id) REFERENCES form_fields(id) ON DELETE SET NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(255) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        admin_id INTEGER,
        action VARCHAR(255) NOT NULL,
        details TEXT,
        FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
      )
    `);

    // Check if seeding is required
    const adminCheck = await client.query('SELECT id FROM admins LIMIT 1');
    if (adminCheck.rows.length === 0) {
      console.log('Seeding Supabase Postgres database...');

      const adminHash = await bcrypt.hash('admin123', 10);
      await client.query("INSERT INTO admins (username, password_hash) VALUES ($1, $2)", ['admin', adminHash]);
      await client.query("INSERT INTO academic_years (name, is_active) VALUES ($1, 1)", ['2026-27']);
      await client.query("INSERT INTO academic_years (name, is_active) VALUES ($1, 0)", ['2027-28']);

      const defaultCourses = [
        { name: 'Master of Business Administration', prefix: 'MBA' },
        { name: 'Master of Business Administration - Business Analytics', prefix: 'MBA-BA' }
      ];
      for (const c of defaultCourses) {
        await client.query("INSERT INTO courses (name, prefix, current_number) VALUES ($1, $2, 0)", [c.name, c.prefix]);
      }

      const defaultSettings = [
        { key: 'college_name', value: 'GAYATRI VIDYA PARISHAD COLLEGE FOR DEGREE AND PG COURSES (AUTONOMOUS)' },
        { key: 'college_address', value: 'Rushikonda, Visakhapatnam - 530045' },
        { key: 'welcome_message', value: 'Welcome to the Student Admission Data Collection Portal. Please complete the form with your correct academic and personal details before official roll numbers are generated.' },
        { key: 'footer_text', value: '© 2026 Gayatri Vidya Parishad College for Degree and PG Courses (Autonomous). All Rights Reserved.' },
        { key: 'admissions_open', value: '1' }
      ];
      for (const s of defaultSettings) {
        await client.query("INSERT INTO settings (key, value) VALUES ($1, $2)", [s.key, s.value]);
      }

      // Seed form sections and fields
      const sections = [
        { name: 'Personal Details', display_order: 1 },
        { name: 'Parent Details', display_order: 2 },
        { name: 'Educational Details', display_order: 3 },
        { name: 'Admission Details', display_order: 4 },
        { name: 'Declaration', display_order: 5 }
      ];

      for (const sec of sections) {
        const secRes = await client.query(
          "INSERT INTO form_sections (name, display_order, is_enabled) VALUES ($1, $2, 1) RETURNING id",
          [sec.name, sec.display_order]
        );
        const sectionId = secRes.rows[0].id;

        if (sec.name === 'Personal Details') {
          const fields = [
            { type: 'text', label: 'Full Name', placeholder: 'Enter your full name', is_required: 1, help_text: 'As per SSC/10th certificate', display_order: 1, options: null },
            { type: 'number', label: 'Aadhaar Number', placeholder: 'Enter 12-digit Aadhaar number', is_required: 1, help_text: '12-digit UIDAI number for duplicate check', display_order: 2, validation_regex: '^\\d{12}$', options: null },
            { type: 'mobile', label: 'Mobile Number', placeholder: 'Enter 10-digit mobile number', is_required: 1, help_text: 'Active mobile number for communication', display_order: 3, validation_regex: '^\\d{10}$', options: null },
            { type: 'email', label: 'Email Address', placeholder: 'Enter email address', is_required: 1, help_text: 'For correspondence', display_order: 4, options: null },
            { type: 'date', label: 'Date of Birth', placeholder: '', is_required: 1, help_text: 'Select your date of birth', display_order: 5, options: null },
            { type: 'radio', label: 'Gender', placeholder: '', is_required: 1, help_text: 'Select your gender', display_order: 6, options: '["Male", "Female", "Other"]' }
          ];
          for (const f of fields) {
            await client.query(
              "INSERT INTO form_fields (section_id, type, label, placeholder, is_required, validation_regex, help_text, display_order, options) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
              [sectionId, f.type, f.label, f.placeholder, f.is_required, f.validation_regex, f.help_text, f.display_order, f.options]
            );
          }
        } else if (sec.name === 'Parent Details') {
          const fields = [
            { type: 'text', label: "Father's Name", placeholder: "Enter father's name", is_required: 1, help_text: '', display_order: 1, options: null },
            { type: 'text', label: "Mother's Name", placeholder: "Enter mother's name", is_required: 1, help_text: '', display_order: 2, options: null },
            { type: 'mobile', label: 'Parent Mobile Number', placeholder: "Enter parent's mobile number", is_required: 0, help_text: 'Optional secondary contact', display_order: 3, validation_regex: '^\\d{10}$', options: null },
            { type: 'textarea', label: 'Permanent Address', placeholder: 'Enter permanent address details', is_required: 1, help_text: 'House No, Street, Landmark, District, State, PIN', display_order: 4, options: null }
          ];
          for (const f of fields) {
            await client.query(
              "INSERT INTO form_fields (section_id, type, label, placeholder, is_required, validation_regex, help_text, display_order, options) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
              [sectionId, f.type, f.label, f.placeholder, f.is_required, f.validation_regex, f.help_text, f.display_order, f.options]
            );
          }
        } else if (sec.name === 'Educational Details') {
          const fields = [
            { type: 'dropdown', label: 'Qualifying Exam', placeholder: 'Select exam', is_required: 1, help_text: 'Last completed course', display_order: 1, options: '["Intermediate / 12th", "Diploma", "Undergraduate Degree", "Postgraduate Degree"]' },
            { type: 'text', label: 'Stream / Branch', placeholder: 'e.g. MPC, BiPC, B.Sc (CS)', is_required: 1, help_text: 'Specialization in qualifying exam', display_order: 2, options: null },
            { type: 'number', label: 'Percentage / CGPA', placeholder: 'e.g. 85.5 or 9.2', is_required: 1, help_text: 'Aggregate percentage or CGPA obtained', display_order: 3, options: null },
            { type: 'number', label: 'Year of Passing', placeholder: 'e.g. 2026', is_required: 1, help_text: 'Passing year', display_order: 4, options: null }
          ];
          for (const f of fields) {
            await client.query(
              "INSERT INTO form_fields (section_id, type, label, placeholder, is_required, validation_regex, help_text, display_order, options) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
              [sectionId, f.type, f.label, f.placeholder, f.is_required, f.validation_regex, f.help_text, f.display_order, f.options]
            );
          }
        } else if (sec.name === 'Admission Details') {
          const fields = [
            { type: 'course_dropdown', label: 'Course Seeking Admission', placeholder: 'Select Course', is_required: 1, help_text: 'Select the course you want to enroll in', display_order: 1, options: '[]' },
            { type: 'radio', label: 'Admission Quota', placeholder: '', is_required: 1, help_text: 'Type of admission seat', display_order: 2, options: '["Convenor Seat (EAPCET / ICET)", "Management Quota"]' }
          ];
          for (const f of fields) {
            await client.query(
              "INSERT INTO form_fields (section_id, type, label, placeholder, is_required, validation_regex, help_text, display_order, options) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
              [sectionId, f.type, f.label, f.placeholder, f.is_required, f.validation_regex, f.help_text, f.display_order, f.options]
            );
          }
        } else if (sec.name === 'Declaration') {
          const fields = [
            { type: 'checkbox', label: 'Declaration', placeholder: '', is_required: 1, help_text: 'Agree to proceed', display_order: 1, options: '["I hereby declare that all the information provided above is true and correct to the best of my knowledge."]' }
          ];
          for (const f of fields) {
            await client.query(
              "INSERT INTO form_fields (section_id, type, label, placeholder, is_required, validation_regex, help_text, display_order, options) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
              [sectionId, f.type, f.label, f.placeholder, f.is_required, f.validation_regex, f.help_text, f.display_order, f.options]
            );
          }
        }
      }
      console.log('Supabase Postgres database seeded successfully.');
    } else {
      console.log('Postgres database schema is intact.');
    }
  } catch (error) {
    console.error('Postgres schema initialization failed:', error);
  } finally {
    client.release();
  }
}

// --- DB OPERATIONS ---

export async function getSettings() {
  if (usePostgres) {
    const res = await pool.query('SELECT key, value FROM settings');
    const settings = {};
    res.rows.forEach(r => { settings[r.key] = r.value; });
    return settings;
  }
  const rows = await dbAll('SELECT key, value FROM settings');
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  return settings;
}

export async function updateSettings(settingsObj, adminId) {
  if (usePostgres) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const [key, value] of Object.entries(settingsObj)) {
        await client.query(
          `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
          [key, String(value)]
        );
      }
      // Log activity
      await client.query('INSERT INTO activity_logs (admin_id, action, details) VALUES ($1, $2, $3)', 
        [adminId, 'Change Settings', `Updated settings: ${Object.keys(settingsObj).join(', ')}`]);
      await client.query('COMMIT');
      return { success: true };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
  return dbTransaction(async () => {
    for (const [key, value] of Object.entries(settingsObj)) {
      await dbRun(
        'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
        [key, String(value)]
      );
    }
    await logActivity(adminId, 'Change Settings', `Updated settings: ${Object.keys(settingsObj).join(', ')}`);
    return { success: true };
  });
}

export async function getAcademicYears() {
  if (usePostgres) {
    const res = await pool.query('SELECT * FROM academic_years ORDER BY name DESC');
    return res.rows;
  }
  return dbAll('SELECT * FROM academic_years ORDER BY name DESC');
}

export async function addAcademicYear(name, adminId) {
  if (usePostgres) {
    const res = await pool.query('INSERT INTO academic_years (name, is_active) VALUES ($1, 0) RETURNING id', [name]);
    await logActivity(adminId, 'Create Academic Year', `Created academic year: ${name}`);
    return { lastID: res.rows[0].id };
  }
  const result = await dbRun('INSERT INTO academic_years (name, is_active) VALUES (?, 0)', [name]);
  await logActivity(adminId, 'Create Academic Year', `Created academic year: ${name}`);
  return result;
}

export async function setActiveAcademicYear(id, adminId) {
  if (usePostgres) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE academic_years SET is_active = 0');
      await client.query('UPDATE academic_years SET is_active = 1 WHERE id = $1', [id]);
      const activeYearRes = await client.query('SELECT name FROM academic_years WHERE id = $1', [id]);
      const activeYearName = activeYearRes.rows[0]?.name;
      
      if (activeYearName) {
        await client.query(
          `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
          ['active_academic_year', activeYearName]
        );
      }
      
      await client.query('INSERT INTO activity_logs (admin_id, action, details) VALUES ($1, $2, $3)',
        [adminId, 'Set Active Academic Year', `Activated academic year: ${activeYearName || id}`]);
      
      await client.query('COMMIT');
      return { success: true };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
  return dbTransaction(async () => {
    await dbRun('UPDATE academic_years SET is_active = 0');
    const result = await dbRun('UPDATE academic_years SET is_active = 1 WHERE id = ?', [id]);
    const activeYear = await dbGet('SELECT name FROM academic_years WHERE id = ?', [id]);
    if (activeYear) {
      await dbRun('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)', ['active_academic_year', activeYear.name]);
    }
    await logActivity(adminId, 'Set Active Academic Year', `Activated academic year: ${activeYear ? activeYear.name : id}`);
    return result;
  });
}

export async function getActiveAcademicYear() {
  if (usePostgres) {
    const res = await pool.query('SELECT * FROM academic_years WHERE is_active = 1');
    return res.rows[0] || null;
  }
  return dbGet('SELECT * FROM academic_years WHERE is_active = 1');
}

export async function getCourses() {
  if (usePostgres) {
    const res = await pool.query('SELECT * FROM courses ORDER BY name ASC');
    return res.rows;
  }
  return dbAll('SELECT * FROM courses ORDER BY name ASC');
}

export async function addCourse(name, prefix, adminId) {
  if (usePostgres) {
    const res = await pool.query('INSERT INTO courses (name, prefix, current_number) VALUES ($1, $2, 0) RETURNING id', [name, prefix.toUpperCase()]);
    await logActivity(adminId, 'Create Course', `Created course ${name} (${prefix})`);
    return { lastID: res.rows[0].id };
  }
  const result = await dbRun('INSERT INTO courses (name, prefix, current_number) VALUES (?, ?, 0)', [name, prefix.toUpperCase()]);
  await logActivity(adminId, 'Create Course', `Created course ${name} (${prefix})`);
  return result;
}

export async function updateCourse(id, name, prefix, currentNumber, adminId) {
  if (usePostgres) {
    const oldCourseRes = await pool.query('SELECT prefix FROM courses WHERE id = $1', [id]);
    const oldCourse = oldCourseRes.rows[0];
    await pool.query(
      'UPDATE courses SET name = $1, prefix = $2, current_number = $3 WHERE id = $4',
      [name, prefix.toUpperCase(), currentNumber, id]
    );
    await logActivity(
      adminId,
      'Edit Course',
      `Updated course ${oldCourse?.prefix} to ${name} (${prefix}), starting at ${currentNumber}`
    );
    return { success: true };
  }
  const oldCourse = await dbGet('SELECT * FROM courses WHERE id = ?', [id]);
  const result = await dbRun(
    'UPDATE courses SET name = ?, prefix = ?, current_number = ? WHERE id = ?',
    [name, prefix.toUpperCase(), currentNumber, id]
  );
  await logActivity(
    adminId,
    'Edit Course',
    `Updated course ${oldCourse?.prefix} to ${name} (${prefix}), starting at ${currentNumber}`
  );
  return result;
}

export async function deleteCourse(id, adminId) {
  if (usePostgres) {
    const courseRes = await pool.query('SELECT * FROM courses WHERE id = $1', [id]);
    const course = courseRes.rows[0];
    const hasSubmissionsRes = await pool.query('SELECT id FROM student_submissions WHERE course_id = $1 LIMIT 1', [id]);
    if (hasSubmissionsRes.rows[0]) {
      throw new Error('Cannot delete course that already has student submissions.');
    }
    await pool.query('DELETE FROM courses WHERE id = $1', [id]);
    await logActivity(adminId, 'Delete Course', `Deleted course: ${course?.name} (${course?.prefix})`);
    return { success: true };
  }
  const course = await dbGet('SELECT * FROM courses WHERE id = ?', [id]);
  const hasSubmissions = await dbGet('SELECT id FROM student_submissions WHERE course_id = ? LIMIT 1', [id]);
  if (hasSubmissions) {
    throw new Error('Cannot delete course that already has student submissions.');
  }
  const result = await dbRun('DELETE FROM courses WHERE id = ?', [id]);
  await logActivity(adminId, 'Delete Course', `Deleted course: ${course?.name} (${course?.prefix})`);
  return result;
}

export async function getSections() {
  if (usePostgres) {
    const res = await pool.query('SELECT * FROM form_sections ORDER BY display_order ASC');
    return res.rows;
  }
  return dbAll('SELECT * FROM form_sections ORDER BY display_order ASC');
}

export async function addSection(name, displayOrder, adminId) {
  if (usePostgres) {
    const res = await pool.query('INSERT INTO form_sections (name, display_order, is_enabled) VALUES ($1, $2, 1) RETURNING id', [name, displayOrder]);
    await logActivity(adminId, 'Create Section', `Created form section: ${name}`);
    return { lastID: res.rows[0].id };
  }
  const result = await dbRun('INSERT INTO form_sections (name, display_order, is_enabled) VALUES (?, ?, 1)', [name, displayOrder]);
  await logActivity(adminId, 'Create Section', `Created form section: ${name}`);
  return result;
}

export async function updateSection(id, name, displayOrder, isEnabled, adminId) {
  if (usePostgres) {
    await pool.query(
      'UPDATE form_sections SET name = $1, display_order = $2, is_enabled = $3 WHERE id = $4',
      [name, displayOrder, isEnabled, id]
    );
    await logActivity(adminId, 'Edit Section', `Modified section ID ${id}: name=${name}, order=${displayOrder}, enabled=${isEnabled}`);
    return { success: true };
  }
  const result = await dbRun(
    'UPDATE form_sections SET name = ?, display_order = ?, is_enabled = ? WHERE id = ?',
    [name, displayOrder, isEnabled, id]
  );
  await logActivity(adminId, 'Edit Section', `Modified section ID ${id}: name=${name}, order=${displayOrder}, enabled=${isEnabled}`);
  return result;
}

export async function deleteSection(id, adminId) {
  if (usePostgres) {
    const secRes = await pool.query('SELECT * FROM form_sections WHERE id = $1', [id]);
    const sec = secRes.rows[0];
    await pool.query('DELETE FROM form_sections WHERE id = $1', [id]);
    await logActivity(adminId, 'Delete Section', `Deleted section: ${sec?.name}`);
    return { success: true };
  }
  const sec = await dbGet('SELECT * FROM form_sections WHERE id = ?', [id]);
  const result = await dbRun('DELETE FROM form_sections WHERE id = ?', [id]);
  await logActivity(adminId, 'Delete Section', `Deleted section: ${sec?.name}`);
  return result;
}

export async function getFields() {
  if (usePostgres) {
    const res = await pool.query('SELECT * FROM form_fields ORDER BY section_id ASC, display_order ASC');
    return res.rows;
  }
  return dbAll('SELECT * FROM form_fields ORDER BY section_id ASC, display_order ASC');
}

export async function getFieldsBySection(sectionId) {
  if (usePostgres) {
    const res = await pool.query('SELECT * FROM form_fields WHERE section_id = $1 ORDER BY display_order ASC', [sectionId]);
    return res.rows;
  }
  return dbAll('SELECT * FROM form_fields WHERE section_id = ? ORDER BY display_order ASC', [sectionId]);
}

export async function addField(fieldData, adminId) {
  const { section_id, type, label, placeholder, is_required, validation_regex, help_text, display_order, options } = fieldData;
  if (usePostgres) {
    const res = await pool.query(
      `INSERT INTO form_fields (section_id, type, label, placeholder, is_required, validation_regex, help_text, display_order, is_enabled, options)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9) RETURNING id`,
      [section_id, type, label, placeholder || null, is_required || 0, validation_regex || null, help_text || null, display_order, options || null]
    );
    await logActivity(adminId, 'Create Field', `Created field "${label}" in section ID ${section_id}`);
    return { lastID: res.rows[0].id };
  }
  const result = await dbRun(
    `INSERT INTO form_fields (section_id, type, label, placeholder, is_required, validation_regex, help_text, display_order, is_enabled, options)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [section_id, type, label, placeholder || null, is_required || 0, validation_regex || null, help_text || null, display_order, options || null]
  );
  await logActivity(adminId, 'Create Field', `Created field "${label}" in section ID ${section_id}`);
  return result;
}

export async function updateField(id, fieldData, adminId) {
  const { section_id, type, label, placeholder, is_required, validation_regex, help_text, display_order, is_enabled, options } = fieldData;
  if (usePostgres) {
    await pool.query(
      `UPDATE form_fields SET 
        section_id = $1, type = $2, label = $3, placeholder = $4, is_required = $5, 
        validation_regex = $6, help_text = $7, display_order = $8, is_enabled = $9, options = $10
       WHERE id = $11`,
      [section_id, type, label, placeholder || null, is_required || 0, validation_regex || null, help_text || null, display_order, is_enabled, options || null, id]
    );
    await logActivity(adminId, 'Edit Field', `Updated field "${label}" (ID ${id})`);
    return { success: true };
  }
  const result = await dbRun(
    `UPDATE form_fields SET 
      section_id = ?, type = ?, label = ?, placeholder = ?, is_required = ?, 
      validation_regex = ?, help_text = ?, display_order = ?, is_enabled = ?, options = ?
     WHERE id = ?`,
    [section_id, type, label, placeholder || null, is_required || 0, validation_regex || null, help_text || null, display_order, is_enabled, options || null, id]
  );
  await logActivity(adminId, 'Edit Field', `Updated field "${label}" (ID ${id})`);
  return result;
}

export async function deleteField(id, adminId) {
  if (usePostgres) {
    const fRes = await pool.query('SELECT * FROM form_fields WHERE id = $1', [id]);
    const f = fRes.rows[0];
    await pool.query('DELETE FROM form_fields WHERE id = $1', [id]);
    await logActivity(adminId, 'Delete Field', `Deleted field: "${f?.label}" (ID ${id})`);
    return { success: true };
  }
  const f = await dbGet('SELECT * FROM form_fields WHERE id = ?', [id]);
  const result = await dbRun('DELETE FROM form_fields WHERE id = ?', [id]);
  await logActivity(adminId, 'Delete Field', `Deleted field: "${f?.label}" (ID ${id})`);
  return result;
}

export async function reorderFields(fieldsOrderArray, adminId) {
  if (usePostgres) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const f of fieldsOrderArray) {
        await client.query(
          'UPDATE form_fields SET display_order = $1, section_id = $2 WHERE id = $3',
          [f.display_order, f.section_id, f.id]
        );
      }
      await client.query('INSERT INTO activity_logs (admin_id, action, details) VALUES ($1, $2, $3)', 
        [adminId, 'Reorder Fields', 'Reordered form fields']);
      await client.query('COMMIT');
      return { success: true };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
  return dbTransaction(async () => {
    for (const f of fieldsOrderArray) {
      await dbRun(
        'UPDATE form_fields SET display_order = ?, section_id = ? WHERE id = ?',
        [f.display_order, f.section_id, f.id]
      );
    }
    await logActivity(adminId, 'Reorder Fields', 'Reordered form fields');
    return { success: true };
  });
}

export async function reorderSections(sectionsOrderArray, adminId) {
  if (usePostgres) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const s of sectionsOrderArray) {
        await client.query(
          'UPDATE form_sections SET display_order = $1 WHERE id = $2',
          [s.display_order, s.id]
        );
      }
      await client.query('INSERT INTO activity_logs (admin_id, action, details) VALUES ($1, $2, $3)', 
        [adminId, 'Reorder Sections', 'Reordered form sections']);
      await client.query('COMMIT');
      return { success: true };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
  return dbTransaction(async () => {
    for (const s of sectionsOrderArray) {
      await dbRun(
        'UPDATE form_sections SET display_order = ? WHERE id = ?',
        [s.display_order, s.id]
      );
    }
    await logActivity(adminId, 'Reorder Sections', 'Reordered form sections');
    return { success: true };
  });
}

// --- STUDENT SUBMISSION OPERATORS ---

export async function checkAadhaarExists(aadhaarNumber) {
  if (usePostgres) {
    const res = await pool.query('SELECT id, application_number FROM student_submissions WHERE aadhaar_number = $1', [aadhaarNumber]);
    return res.rows[0] || null;
  }
  const row = await dbGet('SELECT id, application_number FROM student_submissions WHERE aadhaar_number = ?', [aadhaarNumber]);
  return row || null;
}

export async function submitStudentForm(submissionData) {
  if (usePostgres) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const openSettingRes = await client.query("SELECT value FROM settings WHERE key = 'admissions_open'");
      const openSetting = openSettingRes.rows[0];
      if (!openSetting || openSetting.value !== '1') {
        throw new Error('Admissions are currently closed.');
      }

      const activeYearRes = await client.query("SELECT id, name FROM academic_years WHERE is_active = 1");
      const activeYear = activeYearRes.rows[0];
      if (!activeYear) {
        throw new Error('No active academic year set by administrator.');
      }

      const existingRes = await client.query("SELECT id FROM student_submissions WHERE aadhaar_number = $1", [submissionData.aadhaar_number]);
      if (existingRes.rows[0]) {
        throw new Error(`An application has already been submitted using Aadhaar Number: ${submissionData.aadhaar_number}.`);
      }

      // Lock row to prevent duplicates in sequential counters
      const courseRes = await client.query("SELECT * FROM courses WHERE id = $1 FOR UPDATE", [submissionData.course_id]);
      const course = courseRes.rows[0];
      if (!course) {
        throw new Error('Invalid course selected.');
      }

      const nextNumber = course.current_number + 1;
      const applicationNumber = `${course.prefix}-${String(nextNumber).padStart(3, '0')}`;

      await client.query("UPDATE courses SET current_number = $1 WHERE id = $2", [nextNumber, course.id]);

      const subRes = await client.query(
        `INSERT INTO student_submissions (application_number, aadhaar_number, course_id, academic_year_id, status)
         VALUES ($1, $2, $3, $4, 'Pending') RETURNING id`,
        [applicationNumber, submissionData.aadhaar_number, course.id, activeYear.id]
      );
      const submissionId = subRes.rows[0].id;

      const activeFieldsRes = await client.query('SELECT id, label FROM form_fields');
      const fieldMap = {};
      activeFieldsRes.rows.forEach(f => {
        fieldMap[f.id] = f.label;
      });

      for (const [fieldId, val] of Object.entries(submissionData.fields)) {
        const fieldIdInt = parseInt(fieldId);
        const label = fieldMap[fieldIdInt] || `Custom Field (ID: ${fieldId})`;
        
        let stringVal = val;
        if (typeof val === 'object' && val !== null) {
          stringVal = JSON.stringify(val);
        }

        await client.query(
          `INSERT INTO submission_values (submission_id, field_id, field_label, value)
           VALUES ($1, $2, $3, $4)`,
          [submissionId, fieldIdInt, label, stringVal !== undefined ? String(stringVal) : '']
        );
      }

      await client.query('COMMIT');
      return { success: true, submissionId, applicationNumber };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  return dbTransaction(async () => {
    const openSetting = await dbGet("SELECT value FROM settings WHERE key = 'admissions_open'");
    if (!openSetting || openSetting.value !== '1') {
      throw new Error('Admissions are currently closed.');
    }

    const activeYear = await getActiveAcademicYear();
    if (!activeYear) {
      throw new Error('No active academic year set by administrator.');
    }

    const existing = await checkAadhaarExists(submissionData.aadhaar_number);
    if (existing) {
      throw new Error(`An application has already been submitted using Aadhaar Number: ${submissionData.aadhaar_number}.`);
    }

    const course = await dbGet('SELECT * FROM courses WHERE id = ?', [submissionData.course_id]);
    if (!course) {
      throw new Error('Invalid course selected.');
    }

    const nextNumber = course.current_number + 1;
    const applicationNumber = `${course.prefix}-${String(nextNumber).padStart(3, '0')}`;

    await dbRun('UPDATE courses SET current_number = ? WHERE id = ?', [nextNumber, course.id]);

    const subResult = await dbRun(
      `INSERT INTO student_submissions (application_number, aadhaar_number, course_id, academic_year_id, status)
       VALUES (?, ?, ?, ?, 'Pending')`,
      [applicationNumber, submissionData.aadhaar_number, course.id, activeYear.id]
    );
    const submissionId = subResult.lastID;

    const activeFields = await dbAll('SELECT id, label FROM form_fields');
    const fieldMap = {};
    activeFields.forEach(f => {
      fieldMap[f.id] = f.label;
    });

    for (const [fieldId, val] of Object.entries(submissionData.fields)) {
      const fieldIdInt = parseInt(fieldId);
      const label = fieldMap[fieldIdInt] || `Custom Field (ID: ${fieldId})`;
      
      let stringVal = val;
      if (typeof val === 'object' && val !== null) {
        stringVal = JSON.stringify(val);
      }

      await dbRun(
        `INSERT INTO submission_values (submission_id, field_id, field_label, value)
         VALUES (?, ?, ?, ?)`,
        [submissionId, fieldIdInt, label, stringVal !== undefined ? String(stringVal) : '']
      );
    }

    return {
      success: true,
      submissionId,
      applicationNumber
    };
  });
}

export async function getSubmissions(queryOptions = {}) {
  const {
    search = '',
    course_id = '',
    academic_year_id = '',
    status = '',
    sort_field = 'created_at',
    sort_order = 'DESC',
    page = 1,
    limit = 10
  } = queryOptions;

  const offset = (page - 1) * limit;

  if (usePostgres) {
    let whereClauses = [];
    let params = [];
    let paramCount = 1;

    if (course_id) {
      whereClauses.push(`s.course_id = $${paramCount++}`);
      params.push(course_id);
    }

    if (academic_year_id) {
      whereClauses.push(`s.academic_year_id = $${paramCount++}`);
      params.push(academic_year_id);
    }

    if (status) {
      whereClauses.push(`s.status = $${paramCount++}`);
      params.push(status);
    }

    if (search) {
      whereClauses.push(`(
        s.application_number ILIKE $${paramCount} 
        OR s.aadhaar_number ILIKE $${paramCount + 1} 
        OR s.id IN (
          SELECT submission_id FROM submission_values 
          WHERE value ILIKE $${paramCount + 2}
        )
      )`);
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
      paramCount += 3;
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const allowedSortFields = ['created_at', 'application_number', 'aadhaar_number', 'status', 'course_name', 'student_name'];
    let orderSql = 'ORDER BY s.created_at DESC';
    const actualSortField = allowedSortFields.includes(sort_field) ? sort_field : 'created_at';
    const actualSortOrder = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    if (actualSortField === 'course_name') {
      orderSql = `ORDER BY c.name ${actualSortOrder}`;
    } else if (actualSortField === 'student_name') {
      orderSql = `ORDER BY (
        SELECT value FROM submission_values 
        WHERE submission_id = s.id AND field_label = 'Full Name' LIMIT 1
      ) ${actualSortOrder}`;
    } else if (actualSortField === 'created_at') {
      orderSql = `ORDER BY s.created_at ${actualSortOrder}`;
    } else {
      orderSql = `ORDER BY s.${actualSortField} ${actualSortOrder}`;
    }

    const countRes = await pool.query(
      `SELECT COUNT(DISTINCT s.id) as total 
       FROM student_submissions s
       LEFT JOIN courses c ON s.course_id = c.id
       ${whereSql}`,
      params
    );
    const total = parseInt(countRes.rows[0]?.total || 0);

    const rowsRes = await pool.query(
      `SELECT s.*, 
              c.name as course_name, c.prefix as course_prefix,
              ay.name as academic_year_name,
              (SELECT value FROM submission_values WHERE submission_id = s.id AND field_label = 'Full Name' LIMIT 1) as student_name,
              (SELECT value FROM submission_values WHERE submission_id = s.id AND field_label = 'Mobile Number' LIMIT 1) as mobile_number,
              (SELECT value FROM submission_values WHERE submission_id = s.id AND field_label = 'Email Address' LIMIT 1) as email
       FROM student_submissions s
       LEFT JOIN courses c ON s.course_id = c.id
       LEFT JOIN academic_years ay ON s.academic_year_id = ay.id
       ${whereSql}
       ${orderSql}
       LIMIT $${paramCount++} OFFSET $${paramCount++}`,
      [...params, limit, offset]
    );

    return {
      submissions: rowsRes.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        total_pages: Math.ceil(total / limit)
      }
    };
  }

  let whereClauses = [];
  let params = [];

  if (course_id) {
    whereClauses.push('s.course_id = ?');
    params.push(course_id);
  }

  if (academic_year_id) {
    whereClauses.push('s.academic_year_id = ?');
    params.push(academic_year_id);
  }

  if (status) {
    whereClauses.push('s.status = ?');
    params.push(status);
  }

  if (search) {
    whereClauses.push(`(
      s.application_number LIKE ? 
      OR s.aadhaar_number LIKE ? 
      OR s.id IN (
        SELECT submission_id FROM submission_values 
        WHERE value LIKE ?
      )
    )`);
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const allowedSortFields = ['created_at', 'application_number', 'aadhaar_number', 'status', 'course_name', 'student_name'];
  let orderSql = 'ORDER BY s.created_at DESC';
  const actualSortField = allowedSortFields.includes(sort_field) ? sort_field : 'created_at';
  const actualSortOrder = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  if (actualSortField === 'course_name') {
    orderSql = `ORDER BY c.name ${actualSortOrder}`;
  } else if (actualSortField === 'student_name') {
    orderSql = `ORDER BY (
      SELECT value FROM submission_values 
      WHERE submission_id = s.id AND field_label = 'Full Name' LIMIT 1
    ) ${actualSortOrder}`;
  } else if (actualSortField === 'created_at') {
    orderSql = `ORDER BY s.created_at ${actualSortOrder}`;
  } else {
    orderSql = `ORDER BY s.${actualSortField} ${actualSortOrder}`;
  }

  const countRow = await dbGet(
    `SELECT COUNT(DISTINCT s.id) as total 
     FROM student_submissions s
     LEFT JOIN courses c ON s.course_id = c.id
     ${whereSql}`,
    params
  );
  const total = countRow ? countRow.total : 0;

  const rows = await dbAll(
    `SELECT s.*, 
            c.name as course_name, c.prefix as course_prefix,
            ay.name as academic_year_name,
            (SELECT value FROM submission_values WHERE submission_id = s.id AND field_label = 'Full Name' LIMIT 1) as student_name,
            (SELECT value FROM submission_values WHERE submission_id = s.id AND field_label = 'Mobile Number' LIMIT 1) as mobile_number,
            (SELECT value FROM submission_values WHERE submission_id = s.id AND field_label = 'Email Address' LIMIT 1) as email
     FROM student_submissions s
     LEFT JOIN courses c ON s.course_id = c.id
     LEFT JOIN academic_years ay ON s.academic_year_id = ay.id
     ${whereSql}
     ${orderSql}
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return {
    submissions: rows,
    pagination: {
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit)
    }
  };
}

export async function getSubmissionDetails(id) {
  if (usePostgres) {
    const submissionRes = await pool.query(
      `SELECT s.*, 
              c.name as course_name, c.prefix as course_prefix,
              ay.name as academic_year_name
       FROM student_submissions s
       LEFT JOIN courses c ON s.course_id = c.id
       LEFT JOIN academic_years ay ON s.academic_year_id = ay.id
       WHERE s.id = $1`,
      [id]
    );
    const submission = submissionRes.rows[0];
    if (!submission) return null;

    const valuesRes = await pool.query(
      `SELECT sv.*, ff.type as field_type 
       FROM submission_values sv
       LEFT JOIN form_fields ff ON sv.field_id = ff.id
       WHERE sv.submission_id = $1
       ORDER BY ff.display_order ASC, sv.id ASC`,
      [id]
    );
    submission.values = valuesRes.rows;
    return submission;
  }

  const submission = await dbGet(
    `SELECT s.*, 
            c.name as course_name, c.prefix as course_prefix,
            ay.name as academic_year_name
     FROM student_submissions s
     LEFT JOIN courses c ON s.course_id = c.id
     LEFT JOIN academic_years ay ON s.academic_year_id = ay.id
     WHERE s.id = ?`,
    [id]
  );

  if (!submission) return null;

  const values = await dbAll(
    `SELECT sv.*, ff.type as field_type 
     FROM submission_values sv
     LEFT JOIN form_fields ff ON sv.field_id = ff.id
     WHERE sv.submission_id = ?
     ORDER BY ff.display_order ASC, sv.id ASC`,
    [id]
  );

  submission.values = values;
  return submission;
}

export async function updateSubmissionStatus(id, status, adminId) {
  if (usePostgres) {
    const oldSubRes = await pool.query('SELECT application_number FROM student_submissions WHERE id = $1', [id]);
    const oldSub = oldSubRes.rows[0];
    const result = await pool.query('UPDATE student_submissions SET status = $1 WHERE id = $2', [status, id]);
    await logActivity(adminId, 'Update Student Status', `Updated status of ${oldSub?.application_number} to "${status}"`);
    return result;
  }
  const oldSub = await dbGet('SELECT application_number FROM student_submissions WHERE id = ?', [id]);
  const result = await dbRun('UPDATE student_submissions SET status = ? WHERE id = ?', [status, id]);
  await logActivity(adminId, 'Update Student Status', `Updated status of ${oldSub?.application_number} to "${status}"`);
  return result;
}

export async function deleteSubmission(id, adminId) {
  if (usePostgres) {
    const subRes = await pool.query('SELECT application_number FROM student_submissions WHERE id = $1', [id]);
    const sub = subRes.rows[0];
    const result = await pool.query('DELETE FROM student_submissions WHERE id = $1', [id]);
    await logActivity(adminId, 'Delete Student', `Deleted student application: ${sub?.application_number}`);
    return result;
  }
  const sub = await dbGet('SELECT application_number FROM student_submissions WHERE id = ?', [id]);
  const result = await dbRun('DELETE FROM student_submissions WHERE id = ?', [id]);
  await logActivity(adminId, 'Delete Student', `Deleted student application: ${sub?.application_number}`);
  return result;
}

export async function updateSubmissionData(id, updatedFields, adminId) {
  if (usePostgres) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const subRes = await client.query('SELECT application_number FROM student_submissions WHERE id = $1', [id]);
      const sub = subRes.rows[0];

      for (const [valId, val] of Object.entries(updatedFields)) {
        let stringVal = val;
        if (typeof val === 'object' && val !== null) {
          stringVal = JSON.stringify(val);
        }
        await client.query(
          'UPDATE submission_values SET value = $1 WHERE id = $2 AND submission_id = $3',
          [stringVal, valId, id]
        );
      }
      
      const aadhaarFieldRes = await client.query(
        `SELECT sv.id, sv.value FROM submission_values sv 
         JOIN form_fields ff ON sv.field_id = ff.id 
         WHERE sv.submission_id = $1 AND ff.type = 'number' AND ff.label = 'Aadhaar Number'`,
        [id]
      );
      const aadhaarField = aadhaarFieldRes.rows[0];
      if (aadhaarField && updatedFields[aadhaarField.id] !== undefined) {
        const newAadhaar = updatedFields[aadhaarField.id];
        const duplicateRes = await client.query('SELECT id FROM student_submissions WHERE aadhaar_number = $1 AND id != $2', [newAadhaar, id]);
        if (duplicateRes.rows[0]) {
          throw new Error(`Cannot update Aadhaar. Duplicate Aadhaar number ${newAadhaar} already exists.`);
        }
        await client.query('UPDATE student_submissions SET aadhaar_number = $1 WHERE id = $2', [newAadhaar, id]);
      }

      await client.query('INSERT INTO activity_logs (admin_id, action, details) VALUES ($1, $2, $3)',
        [adminId, 'Edit Student', `Edited submission details for ${sub?.application_number}`]);
      await client.query('COMMIT');
      return { success: true };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  return dbTransaction(async () => {
    const sub = await dbGet('SELECT application_number FROM student_submissions WHERE id = ?', [id]);
    for (const [valId, val] of Object.entries(updatedFields)) {
      let stringVal = val;
      if (typeof val === 'object' && val !== null) {
        stringVal = JSON.stringify(val);
      }
      await dbRun(
        'UPDATE submission_values SET value = ? WHERE id = ? AND submission_id = ?',
        [stringVal, valId, id]
      );
    }
    
    const aadhaarField = await dbGet(
      `SELECT sv.id, sv.value FROM submission_values sv 
       JOIN form_fields ff ON sv.field_id = ff.id 
       WHERE sv.submission_id = ? AND ff.type = 'number' AND ff.label = 'Aadhaar Number'`,
      [id]
    );
    if (aadhaarField && updatedFields[aadhaarField.id] !== undefined) {
      const newAadhaar = updatedFields[aadhaarField.id];
      const duplicate = await dbGet('SELECT id FROM student_submissions WHERE aadhaar_number = ? AND id != ?', [newAadhaar, id]);
      if (duplicate) {
        throw new Error(`Cannot update Aadhaar. Duplicate Aadhaar number ${newAadhaar} already exists.`);
      }
      await dbRun('UPDATE student_submissions SET aadhaar_number = ? WHERE id = ?', [newAadhaar, id]);
    }

    await logActivity(adminId, 'Edit Student', `Edited submission details for ${sub?.application_number}`);
    return { success: true };
  });
}

export async function getAdmin(username) {
  if (usePostgres) {
    const res = await pool.query('SELECT * FROM admins WHERE username = $1', [username]);
    return res.rows[0] || null;
  }
  return dbGet('SELECT * FROM admins WHERE username = ?', [username]);
}

export async function updateAdminPassword(id, newHash, adminId) {
  if (usePostgres) {
    const result = await pool.query('UPDATE admins SET password_hash = $1 WHERE id = $2', [newHash, id]);
    await logActivity(adminId, 'Change Password', 'Administrator changed their password');
    return result;
  }
  const result = await dbRun('UPDATE admins SET password_hash = ? WHERE id = ?', [newHash, id]);
  await logActivity(adminId, 'Change Password', 'Administrator changed their password');
  return result;
}

export async function getDashboardStats() {
  if (usePostgres) {
    const totalRes = await pool.query('SELECT COUNT(*) as count FROM student_submissions');
    const todayRes = await pool.query("SELECT COUNT(*) as count FROM student_submissions WHERE submission_date::date = CURRENT_DATE");
    const pendingRes = await pool.query("SELECT COUNT(*) as count FROM student_submissions WHERE status = 'Pending'");
    const completedRes = await pool.query("SELECT COUNT(*) as count FROM student_submissions WHERE status = 'Completed'");

    const recentRes = await pool.query(
      `SELECT s.id, s.application_number, s.status, s.submission_date,
              c.name as course_name, c.prefix as course_prefix,
              (SELECT value FROM submission_values WHERE submission_id = s.id AND field_label = 'Full Name' LIMIT 1) as student_name
       FROM student_submissions s
       LEFT JOIN courses c ON s.course_id = c.id
       ORDER BY s.created_at DESC
       LIMIT 5`
    );

    return {
      total: parseInt(totalRes.rows[0]?.count || 0),
      today: parseInt(todayRes.rows[0]?.count || 0),
      pending: parseInt(pendingRes.rows[0]?.count || 0),
      completed: parseInt(completedRes.rows[0]?.count || 0),
      recent: recentRes.rows
    };
  }

  const totalSubmissions = await dbGet('SELECT COUNT(*) as count FROM student_submissions');
  const todaySubmissions = await dbGet("SELECT COUNT(*) as count FROM student_submissions WHERE date(submission_date) = date('now', 'localtime')");
  const pendingSubmissions = await dbGet("SELECT COUNT(*) as count FROM student_submissions WHERE status = 'Pending'");
  const completedSubmissions = await dbGet("SELECT COUNT(*) as count FROM student_submissions WHERE status = 'Completed'");

  const recentSubmissions = await dbAll(
    `SELECT s.id, s.application_number, s.status, s.submission_date,
            c.name as course_name, c.prefix as course_prefix,
            (SELECT value FROM submission_values WHERE submission_id = s.id AND field_label = 'Full Name' LIMIT 1) as student_name
     FROM student_submissions s
     LEFT JOIN courses c ON s.course_id = c.id
     ORDER BY s.created_at DESC
     LIMIT 5`
  );

  return {
    total: totalSubmissions ? totalSubmissions.count : 0,
    today: todaySubmissions ? todaySubmissions.count : 0,
    pending: pendingSubmissions ? pendingSubmissions.count : 0,
    completed: completedSubmissions ? completedSubmissions.count : 0,
    recent: recentSubmissions
  };
}

export async function logActivity(adminId, action, details = '') {
  if (usePostgres) {
    return pool.query(
      'INSERT INTO activity_logs (admin_id, action, details) VALUES ($1, $2, $3)',
      [adminId || null, action, details]
    );
  }
  return dbRun(
    'INSERT INTO activity_logs (admin_id, action, details) VALUES (?, ?, ?)',
    [adminId || null, action, details]
  );
}

export async function getActivityLogs() {
  if (usePostgres) {
    const res = await pool.query(
      `SELECT al.*, a.username as admin_username 
       FROM activity_logs al
       LEFT JOIN admins a ON al.admin_id = a.id
       ORDER BY al.timestamp DESC
       LIMIT 100`
    );
    return res.rows;
  }
  return dbAll(
    `SELECT al.*, a.username as admin_username 
     FROM activity_logs al
     LEFT JOIN admins a ON al.admin_id = a.id
     ORDER BY al.timestamp DESC
     LIMIT 100`
  );
}
