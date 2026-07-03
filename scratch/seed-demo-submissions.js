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

// Demo data payload
const studentsData = [
  {
    course_id: 1, // MBA
    aadhaar_number: '324589012345',
    status: 'Pending',
    fields: {
      5: 'Aarav Sharma', // Full Name
      6: '324589012345', // Aadhaar Number
      7: '9876543210', // Mobile Number
      8: 'aarav.sharma@gmail.com', // Email Address
      9: '2004-05-15', // Date of Birth
      10: 'Male', // Gender
      11: 'Rajesh Sharma', // Father's Name
      12: 'Sunita Sharma', // Mother's Name
      13: '9876543219', // Parent Mobile Number
      14: 'Flat 402, Sai Balaji Residency, MVP Colony, Visakhapatnam - 530017' // Permanent Address
    }
  },
  {
    course_id: 1, // MBA
    aadhaar_number: '542198034567',
    status: 'Completed',
    fields: {
      5: 'Kavya Reddy',
      6: '542198034567',
      7: '9123456789',
      8: 'kavya.reddy@yahoo.com',
      9: '2005-01-20',
      10: 'Female',
      11: 'Srinivas Reddy',
      12: 'Laxmi Reddy',
      13: '9123456780',
      14: 'Door No 12-4-5, Seethammadhara, Visakhapatnam - 530013'
    }
  },
  {
    course_id: 1, // MBA
    aadhaar_number: '789012345678',
    status: 'Pending',
    fields: {
      5: 'Vikram Rao',
      6: '789012345678',
      7: '8765432109',
      8: 'vikram.rao@outlook.com',
      9: '2004-11-02',
      10: 'Male',
      11: 'Satyanarayana Rao',
      12: 'Parvathi Rao',
      13: '8765432100',
      14: 'Plot 45, Gajuwaka Main Road, Visakhapatnam - 530026'
    }
  },
  {
    course_id: 1, // MBA
    aadhaar_number: '123456789012',
    status: 'Completed',
    fields: {
      5: 'Divya Nair',
      6: '123456789012',
      7: '7654321098',
      8: 'divya.nair@gmail.com',
      9: '2005-03-12',
      10: 'Female',
      11: 'Mohan Nair',
      12: 'Radha Nair',
      13: '7654321090',
      14: 'Qtr No C-12, Steel Plant Quarters, Visakhapatnam - 530031'
    }
  },
  {
    course_id: 7, // MBA-BA
    aadhaar_number: '234567890123',
    status: 'Pending',
    fields: {
      5: 'Rohan Kumar',
      6: '234567890123',
      7: '9502345678',
      8: 'rohan.kumar@gmail.com',
      9: '2004-08-25',
      10: 'Male',
      11: 'Anil Kumar',
      12: 'Manju Kumar',
      13: '9502345670',
      14: 'House No 5-98, Rushikonda Beach Road, Visakhapatnam - 530045'
    }
  },
  {
    course_id: 7, // MBA-BA
    aadhaar_number: '456789012345',
    status: 'Completed',
    fields: {
      5: 'Sneha Rao',
      6: '456789012345',
      7: '9012345678',
      8: 'sneha.rao@gmail.com',
      9: '2005-07-09',
      10: 'Female',
      11: 'Madhusudhan Rao',
      12: 'Kamala Rao',
      13: '9012345670',
      14: 'Flat 101, Sagar View Apartments, Yendada, Visakhapatnam - 530045'
    }
  },
  {
    course_id: 7, // MBA-BA
    aadhaar_number: '678901234567',
    status: 'Pending',
    fields: {
      5: 'Ananya Murthy',
      6: '678901234567',
      7: '8897123456',
      8: 'ananya.m@gmail.com',
      9: '2004-12-30',
      10: 'Female',
      11: 'Ramesh Murthy',
      12: 'Saraswathi Murthy',
      13: '8897123450',
      14: 'Door No 48-15-9, Srinagar, Visakhapatnam - 530016'
    }
  },
  {
    course_id: 7, // MBA-BA
    aadhaar_number: '890123456789',
    status: 'Completed',
    fields: {
      5: 'Kiran Varma',
      6: '890123456789',
      7: '8142345678',
      8: 'kiran.varma@gmail.com',
      9: '2004-02-14',
      10: 'Male',
      11: 'Venkata Raju',
      12: 'Padma Raju',
      13: '8142345670',
      14: 'Flat 502, Green Meadows, Madhurawada, Visakhapatnam - 530041'
    }
  }
];

const fieldLabels = {
  5: 'Full Name',
  6: 'Aadhaar Number',
  7: 'Mobile Number',
  8: 'Email Address',
  9: 'Date of Birth',
  10: 'Gender',
  11: "Father's Name",
  12: "Mother's Name",
  13: 'Parent Mobile Number',
  14: 'Permanent Address'
};

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function seedData() {
  try {
    // Get active academic year ID
    const activeYear = await getQuery("SELECT id FROM academic_years WHERE is_active = 1");
    const activeYearId = activeYear ? activeYear.id : 2;

    console.log(`Using active academic year ID: ${activeYearId}`);

    for (const student of studentsData) {
      // Check if Aadhaar already exists
      const exists = await getQuery("SELECT id FROM student_submissions WHERE aadhaar_number = ?", [student.aadhaar_number]);
      if (exists) {
        console.log(`Skipping duplicate Aadhaar submission: ${student.aadhaar_number}`);
        continue;
      }

      // Load course details
      const course = await getQuery("SELECT prefix, current_number FROM courses WHERE id = ?", [student.course_id]);
      if (!course) {
        console.log(`Course not found for ID: ${student.course_id}, skipping.`);
        continue;
      }

      // Increment course registration counter
      const nextNumber = course.current_number + 1;
      const applicationNumber = `${course.prefix}-${String(nextNumber).padStart(3, '0')}`;

      // Update course number in DB
      await runQuery("UPDATE courses SET current_number = ? WHERE id = ?", [nextNumber, student.course_id]);
      course.current_number = nextNumber; // sync local copy for immediate sequential increments

      // Insert parent submission
      const subInsert = await runQuery(
        `INSERT INTO student_submissions (application_number, aadhaar_number, course_id, academic_year_id, status)
         VALUES (?, ?, ?, ?, ?)`,
        [applicationNumber, student.aadhaar_number, student.course_id, activeYearId, student.status]
      );
      const submissionId = subInsert.lastID;
      console.log(`Seeded Submission ${applicationNumber} (ID: ${submissionId})`);

      // Insert submission values
      for (const [fieldId, value] of Object.entries(student.fields)) {
        const label = fieldLabels[fieldId] || `Custom Field ${fieldId}`;
        await runQuery(
          `INSERT INTO submission_values (submission_id, field_id, field_label, value)
           VALUES (?, ?, ?, ?)`,
          [submissionId, parseInt(fieldId), label, value]
        );
      }
    }

    console.log('Seeding completed successfully!');
  } catch (error) {
    console.error('Seeding failed with error:', error);
  } finally {
    db.close();
  }
}

seedData();
