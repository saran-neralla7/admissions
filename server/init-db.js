import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../database.sqlite');

console.log('Connecting to database at:', dbPath);
const db = new sqlite3.Database(dbPath);

db.serialize(async () => {
  console.log('Initializing database schema...');

  // 1. Admins Table
  db.run(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. Academic Years Table
  db.run(`
    CREATE TABLE IF NOT EXISTS academic_years (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      is_active INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 3. Courses Table
  db.run(`
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      prefix TEXT UNIQUE NOT NULL,
      current_number INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 4. Form Sections Table
  db.run(`
    CREATE TABLE IF NOT EXISTS form_sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      display_order INTEGER NOT NULL,
      is_enabled INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 5. Form Fields Table
  db.run(`
    CREATE TABLE IF NOT EXISTS form_fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      label TEXT NOT NULL,
      placeholder TEXT,
      is_required INTEGER DEFAULT 0,
      validation_regex TEXT,
      help_text TEXT,
      display_order INTEGER NOT NULL,
      is_enabled INTEGER DEFAULT 1,
      options TEXT, -- JSON array of strings
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (section_id) REFERENCES form_sections(id) ON DELETE CASCADE
    )
  `);

  // 6. Student Submissions Table
  db.run(`
    CREATE TABLE IF NOT EXISTS student_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_number TEXT UNIQUE NOT NULL,
      aadhaar_number TEXT NOT NULL,
      course_id INTEGER NOT NULL,
      academic_year_id INTEGER NOT NULL,
      status TEXT DEFAULT 'Pending',
      submission_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id) REFERENCES courses(id),
      FOREIGN KEY (academic_year_id) REFERENCES academic_years(id),
      UNIQUE(aadhaar_number)
    )
  `);

  // 7. Submission Values Table (EAV)
  db.run(`
    CREATE TABLE IF NOT EXISTS submission_values (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL,
      field_id INTEGER,
      field_label TEXT NOT NULL,
      value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (submission_id) REFERENCES student_submissions(id) ON DELETE CASCADE,
      FOREIGN KEY (field_id) REFERENCES form_fields(id) ON DELETE SET NULL
    )
  `);

  // 8. Settings Table
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 9. Activity Logs Table
  db.run(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      admin_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
    )
  `);

  console.log('Database tables created successfully.');

  // --- SEED DATA ---
  console.log('Seeding initial data...');

  // Seed default admin
  const adminPassword = 'admin123';
  const adminHash = await bcrypt.hash(adminPassword, 10);
  db.run(
    `INSERT OR IGNORE INTO admins (username, password_hash) VALUES (?, ?)`,
    ['admin', adminHash],
    function(err) {
      if (err) console.error('Admin seeding error:', err);
      else if (this.changes > 0) console.log('Seeded default admin (admin / admin123)');
    }
  );

  // Seed Academic Years
  db.run(`INSERT OR IGNORE INTO academic_years (name, is_active) VALUES ('2026-27', 1)`);
  db.run(`INSERT OR IGNORE INTO academic_years (name, is_active) VALUES ('2027-28', 0)`);
  console.log('Seeded academic years.');

  // Seed Courses
  const defaultCourses = [
    { name: 'Master of Business Administration', prefix: 'MBA' },
    { name: 'Master of Computer Applications', prefix: 'MCA' },
    { name: 'Bachelor of Business Administration', prefix: 'BBA' },
    { name: 'Bachelor of Computer Applications', prefix: 'BCA' },
    { name: 'Bachelor of Commerce', prefix: 'BCOM' },
    { name: 'Bachelor of Science', prefix: 'BSC' }
  ];
  defaultCourses.forEach(c => {
    db.run(`INSERT OR IGNORE INTO courses (name, prefix, current_number) VALUES (?, ?, 0)`, [c.name, c.prefix]);
  });
  console.log('Seeded courses.');

  // Seed Settings
  const defaultSettings = [
    { key: 'college_name', value: 'GAYATRI VIDYA PARISHAD COLLEGE FOR DEGREE AND PG COURSES (AUTONOMOUS)' },
    { key: 'college_address', value: 'Rushikonda, Visakhapatnam - 530045' },
    { key: 'welcome_message', value: 'Welcome to the Student Admission Data Collection Portal. Please complete the form with your correct academic and personal details before official roll numbers are generated.' },
    { key: 'footer_text', value: '© 2026 Gayatri Vidya Parishad College for Degree and PG Courses (Autonomous). All Rights Reserved.' },
    { key: 'admissions_open', value: '1' }
  ];
  defaultSettings.forEach(s => {
    db.run(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [s.key, s.value]);
  });
  console.log('Seeded settings.');

  // Seed form sections and get their IDs dynamically
  const sections = [
    { name: 'Personal Details', display_order: 1 },
    { name: 'Parent Details', display_order: 2 },
    { name: 'Educational Details', display_order: 3 },
    { name: 'Admission Details', display_order: 4 },
    { name: 'Declaration', display_order: 5 }
  ];

  sections.forEach(sec => {
    db.run(`INSERT OR IGNORE INTO form_sections (name, display_order, is_enabled) VALUES (?, ?, 1)`, [sec.name, sec.display_order], function(err) {
      if (err) {
        console.error('Section seeding error:', err);
        return;
      }
      
      const sectionName = sec.name;
      db.get(`SELECT id FROM form_sections WHERE name = ?`, [sectionName], (err, row) => {
        if (err || !row) return;
        const sectionId = row.id;

        // Seed fields for this section
        if (sectionName === 'Personal Details') {
          const fields = [
            { type: 'text', label: 'Full Name', placeholder: 'Enter your full name', is_required: 1, help_text: 'As per SSC/10th certificate', display_order: 1, options: null },
            { type: 'number', label: 'Aadhaar Number', placeholder: 'Enter 12-digit Aadhaar number', is_required: 1, help_text: '12-digit UIDAI number for duplicate check', display_order: 2, validation_regex: '^\\d{12}$', options: null },
            { type: 'mobile', label: 'Mobile Number', placeholder: 'Enter 10-digit mobile number', is_required: 1, help_text: 'Active mobile number for communication', display_order: 3, validation_regex: '^\\d{10}$', options: null },
            { type: 'email', label: 'Email Address', placeholder: 'Enter email address', is_required: 1, help_text: 'For correspondence', display_order: 4, options: null },
            { type: 'date', label: 'Date of Birth', placeholder: '', is_required: 1, help_text: 'Select your date of birth', display_order: 5, options: null },
            { type: 'radio', label: 'Gender', placeholder: '', is_required: 1, help_text: 'Select your gender', display_order: 6, options: '["Male", "Female", "Other"]' }
          ];
          fields.forEach(f => {
            db.run(`INSERT OR IGNORE INTO form_fields (section_id, type, label, placeholder, is_required, validation_regex, help_text, display_order, options) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [sectionId, f.type, f.label, f.placeholder, f.is_required, f.validation_regex || null, f.help_text, f.display_order, f.options]);
          });
        } else if (sectionName === 'Parent Details') {
          const fields = [
            { type: 'text', label: "Father's Name", placeholder: "Enter father's name", is_required: 1, help_text: '', display_order: 1, options: null },
            { type: 'text', label: "Mother's Name", placeholder: "Enter mother's name", is_required: 1, help_text: '', display_order: 2, options: null },
            { type: 'mobile', label: 'Parent Mobile Number', placeholder: "Enter parent's mobile number", is_required: 0, help_text: 'Optional secondary contact', display_order: 3, validation_regex: '^\\d{10}$', options: null },
            { type: 'textarea', label: 'Permanent Address', placeholder: 'Enter permanent address details', is_required: 1, help_text: 'House No, Street, Landmark, District, State, PIN', display_order: 4, options: null }
          ];
          fields.forEach(f => {
            db.run(`INSERT OR IGNORE INTO form_fields (section_id, type, label, placeholder, is_required, validation_regex, help_text, display_order, options) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [sectionId, f.type, f.label, f.placeholder, f.is_required, f.validation_regex || null, f.help_text, f.display_order, f.options]);
          });
        } else if (sectionName === 'Educational Details') {
          const fields = [
            { type: 'dropdown', label: 'Qualifying Exam', placeholder: 'Select exam', is_required: 1, help_text: 'Last completed course', display_order: 1, options: '["Intermediate / 12th", "Diploma", "Undergraduate Degree", "Postgraduate Degree"]' },
            { type: 'text', label: 'Stream / Branch', placeholder: 'e.g. MPC, BiPC, B.Sc (CS)', is_required: 1, help_text: 'Specialization in qualifying exam', display_order: 2, options: null },
            { type: 'number', label: 'Percentage / CGPA', placeholder: 'e.g. 85.5 or 9.2', is_required: 1, help_text: 'Aggregate percentage or CGPA obtained', display_order: 3, options: null },
            { type: 'number', label: 'Year of Passing', placeholder: 'e.g. 2026', is_required: 1, help_text: 'Passing year', display_order: 4, options: null }
          ];
          fields.forEach(f => {
            db.run(`INSERT OR IGNORE INTO form_fields (section_id, type, label, placeholder, is_required, validation_regex, help_text, display_order, options) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [sectionId, f.type, f.label, f.placeholder, f.is_required, f.validation_regex || null, f.help_text, f.display_order, f.options]);
          });
        } else if (sectionName === 'Admission Details') {
          const fields = [
            { type: 'course_dropdown', label: 'Course Seeking Admission', placeholder: 'Select Course', is_required: 1, help_text: 'Select the course you want to enroll in', display_order: 1, options: '[]' },
            { type: 'radio', label: 'Admission Quota', placeholder: '', is_required: 1, help_text: 'Type of admission seat', display_order: 2, options: '["Convenor Seat (EAPCET / ICET)", "Management Quota"]' }
          ];
          fields.forEach(f => {
            db.run(`INSERT OR IGNORE INTO form_fields (section_id, type, label, placeholder, is_required, validation_regex, help_text, display_order, options) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [sectionId, f.type, f.label, f.placeholder, f.is_required, f.validation_regex || null, f.help_text, f.display_order, f.options]);
          });
        } else if (sectionName === 'Declaration') {
          const fields = [
            { type: 'checkbox', label: 'Declaration', placeholder: '', is_required: 1, help_text: 'Agree to proceed', display_order: 1, options: '["I hereby declare that all the information provided above is true and correct to the best of my knowledge."]' }
          ];
          fields.forEach(f => {
            db.run(`INSERT OR IGNORE INTO form_fields (section_id, type, label, placeholder, is_required, validation_regex, help_text, display_order, options) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [sectionId, f.type, f.label, f.placeholder, f.is_required, f.validation_regex || null, f.help_text, f.display_order, f.options]);
          });
        }
      });
    });
  });

  console.log('Form sections and fields seeded successfully.');
});

// Close connection after seeding
setTimeout(() => {
  db.close(() => {
    console.log('Database initialization and seeding completed.');
  });
}, 2000);
