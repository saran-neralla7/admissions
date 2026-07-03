import React, { useState, useEffect } from 'react';
import { useAuth, useToast } from '../App';
import StudentDetails from './StudentDetails';
import * as XLSX from 'xlsx';

export default function StudentList() {
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState([]);
  const [courses, setCourses] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, total_pages: 1 });
  
  // Filters state
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortField, setSortField] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('DESC');
  const [page, setPage] = useState(1);

  // Modal detail state
  const [selectedSubId, setSelectedSubId] = useState(null);

  const { fetchWithAuth } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    // Load courses and academic years for filter dropdowns
    Promise.all([
      fetchWithAuth('/api/admin/courses').then(res => res.json()),
      fetchWithAuth('/api/admin/academic-years').then(res => res.json())
    ])
      .then(([coursesData, yearsData]) => {
        setCourses(coursesData);
        setAcademicYears(yearsData);
      })
      .catch(err => console.error(err));
  }, []);

  useEffect(() => {
    loadSubmissions();
  }, [search, courseFilter, yearFilter, statusFilter, sortField, sortOrder, page]);

  const loadSubmissions = () => {
    setLoading(true);
    const queryParams = new URLSearchParams({
      search,
      course_id: courseFilter,
      academic_year_id: yearFilter,
      status: statusFilter,
      sort_field: sortField,
      sort_order: sortOrder,
      page: String(page),
      limit: '10'
    });

    fetchWithAuth(`/api/admin/submissions?${queryParams.toString()}`)
      .then(res => res.json())
      .then(data => {
        setSubmissions(data.submissions);
        setPagination(data.pagination);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        showToast('Error loading student registrations.', 'error');
        setLoading(false);
      });
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      setSortField(field);
      setSortOrder('ASC');
    }
    setPage(1);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.total_pages) {
      setPage(newPage);
    }
  };

  const handleExcelExport = async () => {
    showToast('Preparing Excel export data...', 'info');
    try {
      const queryParams = new URLSearchParams({
        search,
        course_id: courseFilter,
        academic_year_id: yearFilter,
        status: statusFilter,
        sort_field: sortField,
        sort_order: sortOrder
      });

      const response = await fetchWithAuth(`/api/admin/submissions/export?${queryParams.toString()}`);
      const students = await response.json();

      if (students.length === 0) {
        showToast('No applications found to export.', 'warning');
        return;
      }

      // Group students by course prefix
      const groupedByCourse = {};
      students.forEach(student => {
        const prefix = student.course_prefix || 'General';
        if (!groupedByCourse[prefix]) {
          groupedByCourse[prefix] = [];
        }
        groupedByCourse[prefix].push(student);
      });

      const workbook = XLSX.utils.book_new();

      // Create a worksheet for each course group
      Object.entries(groupedByCourse).forEach(([prefix, courseStudents]) => {
        // Collect dynamic fields labels specifically for this course
        const dynamicFieldLabels = new Set();
        courseStudents.forEach(student => {
          student.values.forEach(val => {
            dynamicFieldLabels.add(val.field_label);
          });
        });

        // Build data rows for this sheet
        const rows = courseStudents.map(student => {
          // Base columns
          const rowData = {
            'Application Number': student.application_number,
            'Aadhaar Number': student.aadhaar_number,
            'Selected Course': student.course_name,
            'Academic Year': student.academic_year_name,
            'Registration Date': new Date(student.submission_date).toLocaleString(),
            'Status': student.status
          };

          // Inject dynamic field columns
          dynamicFieldLabels.forEach(label => {
            const match = student.values.find(v => v.field_label === label);
            let value = match ? match.value : '';
            
            // Format checkboxes representation
            if (match?.field_type === 'checkbox') {
              try {
                const parsed = JSON.parse(value);
                if (Array.isArray(parsed)) value = parsed.join(', ');
              } catch (e) {}
            }
            rowData[label] = value;
          });

          return rowData;
        });

        // Create Worksheet
        const worksheet = XLSX.utils.json_to_sheet(rows);

        // Autofit columns helper specifically for this sheet
        const maxLens = {};
        rows.forEach(r => {
          Object.keys(r).forEach(k => {
            const valLen = String(r[k] || '').length;
            const keyLen = k.length;
            maxLens[k] = Math.max(maxLens[k] || 0, valLen, keyLen);
          });
        });
        worksheet['!cols'] = Object.keys(maxLens).map(k => ({ wch: maxLens[k] + 3 }));

        // Append worksheet to workbook with course prefix (max 31 characters required by Excel)
        const sheetName = prefix.substring(0, 31);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      });

      // Trigger download file
      const filename = `GVP_Admissions_Export_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, filename);
      showToast('Excel file downloaded successfully!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Excel export failed. Please try again.', 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="admin-page-header">
        <h2 className="admin-page-title">Registered Students</h2>
        <button className="btn btn-primary" onClick={handleExcelExport} style={{ gap: '0.5rem' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Export to Excel (.xlsx)
        </button>
      </div>

      {/* Filter and Search controls */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: 0 }}>
        <div className="filters-bar">
          <div className="search-input-wrapper">
            <input
              type="text"
              className="form-control"
              placeholder="Search by Name, Aadhaar, Mobile, Email, App Number..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          <div className="filter-select-wrapper">
            <select className="form-control" value={courseFilter} onChange={(e) => { setCourseFilter(e.target.value); setPage(1); }}>
              <option value="">All Courses</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.prefix}</option>
              ))}
            </select>
          </div>

          <div className="filter-select-wrapper">
            <select className="form-control" value={yearFilter} onChange={(e) => { setYearFilter(e.target.value); setPage(1); }}>
              <option value="">All Academic Years</option>
              {academicYears.map(y => (
                <option key={y.id} value={y.id}>{y.name}</option>
              ))}
            </select>
          </div>

          <div className="filter-select-wrapper">
            <select className="form-control" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table view */}
      {loading ? (
        <div className="table-container" style={{ padding: '2rem' }}>
          <div className="skeleton skeleton-title" style={{ width: '100%' }}></div>
          <div className="skeleton skeleton-input" style={{ height: '250px' }}></div>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('application_number')}>
                    App Number {sortField === 'application_number' ? (sortOrder === 'ASC' ? '▲' : '▼') : ''}
                  </th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('student_name')}>
                    Student Name {sortField === 'student_name' ? (sortOrder === 'ASC' ? '▲' : '▼') : ''}
                  </th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('course_name')}>
                    Course {sortField === 'course_name' ? (sortOrder === 'ASC' ? '▲' : '▼') : ''}
                  </th>
                  <th>Mobile</th>
                  <th>Aadhaar</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('status')}>
                    Status {sortField === 'status' ? (sortOrder === 'ASC' ? '▲' : '▼') : ''}
                  </th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('created_at')}>
                    Date {sortField === 'created_at' ? (sortOrder === 'ASC' ? '▲' : '▼') : ''}
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {submissions.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-medium)', fontWeight: 600 }}>
                      No admission registrations found matching the criteria.
                    </td>
                  </tr>
                ) : (
                  submissions.map(sub => (
                    <tr key={sub.id}>
                      <td style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{sub.application_number}</td>
                      <td style={{ fontWeight: '600' }}>{sub.student_name || 'Anonymous'}</td>
                      <td>{sub.course_prefix}</td>
                      <td>{sub.mobile_number || '-'}</td>
                      <td>{sub.aadhaar_number}</td>
                      <td>
                        <span className={`status-badge ${sub.status.toLowerCase()}`}>
                          {sub.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>{new Date(sub.submission_date).toLocaleDateString()}</td>
                      <td>
                        <button 
                          className="btn btn-secondary" 
                          style={{ minHeight: '36px', height: '36px', padding: '0 1rem', fontSize: '0.85rem', fontWeight: 700 }}
                          onClick={() => setSelectedSubId(sub.id)}
                        >
                          View details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {pagination.total_pages > 1 && (
            <div className="pagination-container">
              <span className="pagination-info">
                Showing Page <strong>{pagination.page}</strong> of <strong>{pagination.total_pages}</strong> ({pagination.total} total submissions)
              </span>
              <div className="pagination-controls">
                <button 
                  className="btn btn-secondary" 
                  onClick={() => handlePageChange(page - 1)} 
                  disabled={page === 1}
                  style={{ minHeight: '38px', height: '38px' }}
                >
                  Previous
                </button>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => handlePageChange(page + 1)} 
                  disabled={page === pagination.total_pages}
                  style={{ minHeight: '38px', height: '38px' }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Details modal popup */}
      {selectedSubId && (
        <StudentDetails
          id={selectedSubId}
          onClose={() => setSelectedSubId(null)}
          onDeleteSuccess={loadSubmissions}
          onUpdateSuccess={loadSubmissions}
        />
      )}
    </div>
  );
}
