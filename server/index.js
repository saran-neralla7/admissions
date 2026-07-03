import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import {
  getSettings,
  updateSettings,
  getAcademicYears,
  addAcademicYear,
  setActiveAcademicYear,
  getActiveAcademicYear,
  getCourses,
  addCourse,
  updateCourse,
  deleteCourse,
  getSections,
  addSection,
  updateSection,
  deleteSection,
  getFields,
  addField,
  updateField,
  deleteField,
  reorderFields,
  reorderSections,
  checkAadhaarExists,
  submitStudentForm,
  getSubmissions,
  getSubmissionDetails,
  updateSubmissionStatus,
  deleteSubmission,
  updateSubmissionData,
  getAdmin,
  updateAdminPassword,
  getDashboardStats,
  logActivity,
  getActivityLogs,
  initDb
} from './database.js';

// Auto-initialize schema (especially on Supabase on first run)
initDb().catch(err => console.error('Database initialization failed:', err));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'gvp_college_admission_system_secret_key_530045';

const app = express();

app.use(cors());
app.use(express.json());

// Database Auto-Initialization Middleware (ensures tables exist before query execution)
app.use(async (req, res, next) => {
  try {
    await initDb();
    next();
  } catch (err) {
    console.error('Database initialization failed in middleware:', err);
    res.status(500).json({ error: 'Database failed to initialize: ' + err.message });
  }
});

// Logger middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Middleware to verify JWT Token for admin routes
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. Token missing.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    req.user = user;
    next();
  });
}

// --- PUBLIC ROUTE: SETTINGS & ACADEMIC YEAR ---
app.get('/api/public/settings', async (req, res) => {
  try {
    const settings = await getSettings();
    const activeYear = await getActiveAcademicYear();
    res.json({
      settings,
      active_academic_year: activeYear ? activeYear.name : 'Not Set'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- PUBLIC ROUTE: GET ACTIVE COURSES ---
app.get('/api/public/courses', async (req, res) => {
  try {
    const courses = await getCourses();
    res.json(courses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- PUBLIC ROUTE: GET DYNAMIC FORM SCHEMA ---
app.get('/api/public/form-schema', async (req, res) => {
  try {
    const sections = await getSections();
    const fields = await getFields();
    const courses = await getCourses();

    // Map active enabled sections
    const activeSections = sections
      .filter(s => s.is_enabled === 1)
      .map(s => ({
        id: s.id,
        name: s.name,
        display_order: s.display_order,
        fields: []
      }));

    // Group fields by sections
    fields.forEach(f => {
      if (f.is_enabled !== 1) return;
      const sec = activeSections.find(s => s.id === f.section_id);
      if (sec) {
        let fieldOptions = [];
        try {
          if (f.options) {
            fieldOptions = JSON.parse(f.options);
          }
        } catch (e) {
          fieldOptions = [];
        }

        // If it's a course selection dropdown, dynamically load options from courses table
        if (f.type === 'course_dropdown') {
          fieldOptions = courses.map(c => ({
            id: c.id,
            name: c.name,
            prefix: c.prefix
          }));
        }

        sec.fields.push({
          id: f.id,
          type: f.type,
          label: f.label,
          placeholder: f.placeholder,
          is_required: f.is_required,
          validation_regex: f.validation_regex,
          help_text: f.help_text,
          display_order: f.display_order,
          options: fieldOptions
        });
      }
    });

    // Sort fields in each section by display_order
    activeSections.forEach(s => {
      s.fields.sort((a, b) => a.display_order - b.display_order);
    });

    res.json(activeSections);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- PUBLIC ROUTE: AADHAAR CHECK ---
app.get('/api/public/check-aadhaar/:aadhaar', async (req, res) => {
  try {
    const aadhaar = req.params.aadhaar;
    const exists = await checkAadhaarExists(aadhaar);
    res.json({ exists: !!exists, application_number: exists ? exists.application_number : null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- PUBLIC ROUTE: SUBMIT FORM ---
app.post('/api/public/submit', async (req, res) => {
  try {
    const { course_id, aadhaar_number, fields } = req.body;

    if (!course_id) {
      return res.status(400).json({ error: 'Please select a course for admission.' });
    }
    if (!aadhaar_number || !/^\d{12}$/.test(aadhaar_number)) {
      return res.status(400).json({ error: 'Please enter a valid 12-digit Aadhaar Number.' });
    }
    if (!fields || typeof fields !== 'object') {
      return res.status(400).json({ error: 'Invalid submission fields payload.' });
    }

    const result = await submitStudentForm({ course_id, aadhaar_number, fields });
    res.json(result);
  } catch (err) {
    console.error('Submission error:', err);
    res.status(400).json({ error: err.message });
  }
});

// --- ADMIN AUTH: LOGIN & LOGOUT ---
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Please enter username and password.' });
    }

    const admin = await getAdmin(username);
    if (!admin) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const validPassword = await bcrypt.compare(password, admin.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '12h' });
    
    // Log login activity
    await logActivity(admin.id, 'Login', `Administrator logged in: ${username}`);

    res.json({ token, admin: { id: admin.id, username: admin.username } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/logout', authenticateAdmin, async (req, res) => {
  try {
    await logActivity(req.user.id, 'Logout', `Administrator logged out: ${req.user.username}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/change-password', authenticateAdmin, async (req, res) => {
  try {
    const { new_password } = req.body;
    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const hash = await bcrypt.hash(new_password, 10);
    await updateAdminPassword(req.user.id, hash, req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- PROTECTED ADMIN ROUTE: DASHBOARD STATS ---
app.get('/api/admin/dashboard', authenticateAdmin, async (req, res) => {
  try {
    const stats = await getDashboardStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- PROTECTED ADMIN ROUTE: SETTINGS UPDATE ---
app.post('/api/admin/settings', authenticateAdmin, async (req, res) => {
  try {
    const result = await updateSettings(req.body, req.user.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- PROTECTED ADMIN ROUTE: ACADEMIC YEARS ---
app.get('/api/admin/academic-years', authenticateAdmin, async (req, res) => {
  try {
    const years = await getAcademicYears();
    res.json(years);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/academic-years', authenticateAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Academic Year name is required.' });
    const result = await addAcademicYear(name, req.user.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/academic-years/activate', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Academic Year ID is required.' });
    const result = await setActiveAcademicYear(id, req.user.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- PROTECTED ADMIN ROUTE: COURSES ---
app.get('/api/admin/courses', authenticateAdmin, async (req, res) => {
  try {
    const courses = await getCourses();
    res.json(courses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/courses', authenticateAdmin, async (req, res) => {
  try {
    const { name, prefix } = req.body;
    if (!name || !prefix) return res.status(400).json({ error: 'Name and Prefix are required.' });
    const result = await addCourse(name, prefix, req.user.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/courses/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, prefix, current_number } = req.body;
    const result = await updateCourse(id, name, prefix, current_number, req.user.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/courses/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deleteCourse(id, req.user.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- PROTECTED ADMIN ROUTE: FORM BUILDER SECTIONS ---
app.get('/api/admin/sections', authenticateAdmin, async (req, res) => {
  try {
    const sections = await getSections();
    res.json(sections);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/sections', authenticateAdmin, async (req, res) => {
  try {
    const { name, display_order } = req.body;
    if (!name) return res.status(400).json({ error: 'Section name is required.' });
    const result = await addSection(name, display_order || 0, req.user.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/sections/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, display_order, is_enabled } = req.body;
    const result = await updateSection(id, name, display_order, is_enabled, req.user.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/sections/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deleteSection(id, req.user.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/sections/reorder', authenticateAdmin, async (req, res) => {
  try {
    const { order } = req.body; // Array: [{id, display_order}]
    if (!Array.isArray(order)) return res.status(400).json({ error: 'Invalid order structure.' });
    await reorderSections(order, req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- PROTECTED ADMIN ROUTE: FORM BUILDER FIELDS ---
app.get('/api/admin/fields', authenticateAdmin, async (req, res) => {
  try {
    const fields = await getFields();
    res.json(fields);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/fields', authenticateAdmin, async (req, res) => {
  try {
    const result = await addField(req.body, req.user.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/fields/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await updateField(id, req.body, req.user.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/fields/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deleteField(id, req.user.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/fields/reorder', authenticateAdmin, async (req, res) => {
  try {
    const { order } = req.body; // Array: [{id, display_order, section_id}]
    if (!Array.isArray(order)) return res.status(400).json({ error: 'Invalid order structure.' });
    await reorderFields(order, req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- PROTECTED ADMIN ROUTE: STUDENT SUBMISSIONS ---
app.get('/api/admin/submissions', authenticateAdmin, async (req, res) => {
  try {
    const result = await getSubmissions(req.query);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch all submissions for export without pagination limit
app.get('/api/admin/submissions/export', authenticateAdmin, async (req, res) => {
  try {
    const options = { ...req.query, limit: 1000000, page: 1 };
    const result = await getSubmissions(options);
    
    // For each submission, fetch full details to format columns
    const fullSubmissions = [];
    for (const sub of result.submissions) {
      const details = await getSubmissionDetails(sub.id);
      if (details) {
        fullSubmissions.push(details);
      }
    }
    res.json(fullSubmissions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/submissions/:id', authenticateAdmin, async (req, res) => {
  try {
    const details = await getSubmissionDetails(req.params.id);
    if (!details) return res.status(404).json({ error: 'Submission not found.' });
    res.json(details);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/submissions/:id/status', authenticateAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const result = await updateSubmissionStatus(req.params.id, status, req.user.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/submissions/:id', authenticateAdmin, async (req, res) => {
  try {
    const result = await updateSubmissionData(req.params.id, req.body, req.user.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/submissions/:id', authenticateAdmin, async (req, res) => {
  try {
    const result = await deleteSubmission(req.params.id, req.user.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- PROTECTED ADMIN ROUTE: ACTIVITY LOGS ---
app.get('/api/admin/logs', authenticateAdmin, async (req, res) => {
  try {
    const logs = await getActivityLogs();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- SERVE STATIC FRONTEND IN PRODUCTION ---
const distPath = path.resolve(__dirname, '../dist');
if (fs.existsSync(distPath) && !process.env.VERCEL) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(distPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('Backend API Server running in Development mode. Run npm run dev to start frontend Vite server.');
  });
}

// Start Server
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

export default app;
