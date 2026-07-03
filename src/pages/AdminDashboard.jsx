import React, { useState, useEffect } from 'react';
import { useAuth, useToast } from '../App';
import StudentList from './StudentList';
import FormBuilder from './FormBuilder';
import CourseManager from './CourseManager';
import AcademicYearManager from './AcademicYearManager';
import SettingsPage from './SettingsPage';
import ActivityLogs from './ActivityLogs';
import StudentDetails from './StudentDetails';
import ConfirmModal from '../components/ConfirmModal';

export default function AdminDashboard({ navigate }) {
  const [activeTab, setActiveTab] = useState('overview'); // overview, students, form_builder, courses, academic_years, settings, logs
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [selectedSubId, setSelectedSubId] = useState(null);

  const { admin, logout, fetchWithAuth } = useAuth();
  const { showToast } = useToast();
  
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmData, setConfirmData] = useState({ title: '', message: '', onConfirm: () => {} });

  useEffect(() => {
    if (activeTab === 'overview') {
      loadStats();
    }
  }, [activeTab]);

  const loadStats = () => {
    setStatsLoading(true);
    fetchWithAuth('/api/admin/dashboard')
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setStatsLoading(false);
      })
      .catch(err => {
        console.error(err);
        showToast('Error loading dashboard statistics.', 'error');
        setStatsLoading(false);
      });
  };

  const handleLogoutClick = () => {
    setConfirmData({
      title: 'Confirm Logout',
      message: 'Are you sure you want to log out from the administrator portal?',
      onConfirm: async () => {
        await logout();
        showToast('Logged out successfully.', 'success');
        navigate('/');
        setConfirmOpen(false);
      }
    });
    setConfirmOpen(true);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'students':
        return <StudentList />;
      case 'form_builder':
        return <FormBuilder />;
      case 'courses':
        return <CourseManager />;
      case 'academic_years':
        return <AcademicYearManager />;
      case 'settings':
        return <SettingsPage />;
      case 'logs':
        return <ActivityLogs />;
      case 'overview':
      default:
        return renderOverview();
    }
  };

  const renderOverview = () => {
    if (statsLoading) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="stats-grid">
            <div className="skeleton" style={{ height: '110px', borderRadius: '12px' }}></div>
            <div className="skeleton" style={{ height: '110px', borderRadius: '12px' }}></div>
            <div className="skeleton" style={{ height: '110px', borderRadius: '12px' }}></div>
            <div className="skeleton" style={{ height: '110px', borderRadius: '12px' }}></div>
          </div>
          <div className="skeleton" style={{ height: '250px', borderRadius: '12px' }}></div>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* KPI Cards Grid */}
        <div className="stats-grid">
          <div className="stat-card" style={{ borderTop: '4px solid var(--primary)' }}>
            <span className="stat-label">Total Applications</span>
            <span className="stat-value">{stats?.total || 0}</span>
          </div>
          <div className="stat-card" style={{ borderTop: '4px solid var(--primary-border)' }}>
            <span className="stat-label">Today's Registrations</span>
            <span className="stat-value">{stats?.today || 0}</span>
          </div>
          <div className="stat-card" style={{ borderTop: '4px solid var(--warning)' }}>
            <span className="stat-label">Pending Reviews</span>
            <span className="stat-value">{stats?.pending || 0}</span>
          </div>
          <div className="stat-card" style={{ borderTop: '4px solid var(--success)' }}>
            <span className="stat-label">Completed Admissions</span>
            <span className="stat-value">{stats?.completed || 0}</span>
          </div>
        </div>

        {/* Recent Applications Listing */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem' }}>Recent Applications</h3>
            <button className="btn btn-secondary" style={{ minHeight: '36px', height: '36px', fontSize: '0.85rem' }} onClick={() => setActiveTab('students')}>
              View All Applications →
            </button>
          </div>

          <div className="table-container" style={{ border: 'none', boxShadow: 'none', margin: 0 }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>App Number</th>
                  <th>Student Name</th>
                  <th>Course</th>
                  <th>Status</th>
                  <th>Date Submitted</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {stats?.recent?.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-medium)', fontWeight: 600 }}>
                      No submissions recorded yet.
                    </td>
                  </tr>
                ) : (
                  stats?.recent?.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{r.application_number}</td>
                      <td style={{ fontWeight: '600' }}>{r.student_name || 'Anonymous'}</td>
                      <td>{r.course_prefix}</td>
                      <td>
                        <span className={`status-badge ${r.status.toLowerCase()}`}>
                          {r.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>{new Date(r.submission_date).toLocaleDateString()}</td>
                      <td>
                        <button 
                          className="btn btn-secondary" 
                          style={{ minHeight: '32px', height: '32px', padding: '0 0.75rem', fontSize: '0.8rem' }}
                          onClick={() => setSelectedSubId(r.id)}
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal details popup */}
        {selectedSubId && (
          <StudentDetails
            id={selectedSubId}
            onClose={() => setSelectedSubId(null)}
            onDeleteSuccess={loadStats}
            onUpdateSuccess={loadStats}
          />
        )}
      </div>
    );
  };

  return (
    <div className="admin-shell">
      {/* Admin Sidebar Navigation */}
      <aside className="admin-sidebar no-print">
        <div className="admin-sidebar-header">
          <img src="/gvpcdpgc-logo.png" alt="GVP Logo" className="admin-sidebar-logo" />
          <h2 className="admin-sidebar-title">GVP Admin Portal</h2>
        </div>

        <nav className="admin-nav">
          <button className={`admin-nav-item ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
            Dashboard Overview
          </button>
          <button className={`admin-nav-item ${activeTab === 'students' ? 'active' : ''}`} onClick={() => setActiveTab('students')}>
            Registered Students
          </button>
          <button className={`admin-nav-item ${activeTab === 'form_builder' ? 'active' : ''}`} onClick={() => setActiveTab('form_builder')}>
            Dynamic Form Builder
          </button>
          <button className={`admin-nav-item ${activeTab === 'courses' ? 'active' : ''}`} onClick={() => setActiveTab('courses')}>
            Course Management
          </button>
          <button className={`admin-nav-item ${activeTab === 'academic_years' ? 'active' : ''}`} onClick={() => setActiveTab('academic_years')}>
            Academic Years
          </button>
          <button className={`admin-nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            System Settings
          </button>
          <button className={`admin-nav-item ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>
            Audit Logs
          </button>
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-user-info">
            Logged in as: <strong>{admin?.username}</strong>
          </div>
          <button className="btn btn-danger" style={{ minHeight: '38px', height: '38px' }} onClick={handleLogoutClick}>
            Logout
          </button>
        </div>
      </aside>

      {/* Admin Page Content */}
      <main className="admin-body">
        {renderTabContent()}
      </main>

      {/* CONFIRMATION DIALOG MODAL */}
      <ConfirmModal
        open={confirmOpen}
        title={confirmData.title}
        message={confirmData.message}
        onConfirm={confirmData.onConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
