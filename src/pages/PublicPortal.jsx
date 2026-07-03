import React, { useState, useEffect } from 'react';
import { useToast } from '../App';

export default function PublicPortal({ navigate }) {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const { showToast } = useToast();

  useEffect(() => {
    Promise.all([
      fetch('/api/public/settings').then(res => {
        if (!res.ok) throw new Error('Failed to load portal configuration.');
        return res.json();
      }),
      fetch('/api/public/courses').then(res => {
        if (!res.ok) throw new Error('Failed to load courses.');
        return res.json();
      })
    ])
      .then(([settingsData, coursesData]) => {
        setSettings(settingsData);
        setCourses(coursesData);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        showToast('Error connecting to portal. Please try again.', 'error');
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="main-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '2rem' }}>
        <div className="skeleton skeleton-title" style={{ alignSelf: 'center', width: '300px' }}></div>
        <div className="skeleton skeleton-input" style={{ height: '200px', borderRadius: '12px' }}></div>
        <div className="skeleton skeleton-input" style={{ height: '300px', borderRadius: '12px' }}></div>
      </div>
    );
  }

  const collegeName = settings?.settings?.college_name || 'GAYATRI VIDYA PARISHAD';
  const collegeAddress = settings?.settings?.college_address || 'Rushikonda, Visakhapatnam - 530045';
  const welcomeMessage = settings?.settings?.welcome_message || 'Welcome to the Student Admission Data Collection Portal.';
  const footerText = settings?.settings?.footer_text || '© 2026 Gayatri Vidya Parishad. All Rights Reserved.';
  const admissionsOpen = settings?.settings?.admissions_open === '1';
  const activeYear = settings?.active_academic_year || '2026-27';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Premium Header */}
      <header className="branding-header">
        <div className="branding-logo-area">
          <img src="/gvpcdpgc-logo.png" alt="GVP Logo" className="branding-logo" onError={(e) => {
            e.target.style.display = 'none';
            e.target.parentNode.innerHTML = '<span class="branding-logo-placeholder">GVP</span>';
          }} />
        </div>
        <h1 className="branding-title">{collegeName}</h1>
        <h2 className="branding-subtitle">COLLEGE FOR DEGREE AND PG COURSES (AUTONOMOUS)</h2>
        <p className="branding-address">{collegeAddress}</p>
      </header>

      {/* Hero Welcome Panel */}
      <main className="main-content" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', borderLeft: '6px solid var(--primary)' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 800 }} className="text-gradient">
            Student Admission Data Collection ({activeYear})
          </h2>
          <p style={{ fontSize: '1.1rem', color: 'var(--text-medium)', lineHeight: '1.6' }}>
            {welcomeMessage}
          </p>
          <div style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--primary-light)', borderLeft: '4px solid var(--primary)', borderRadius: 'var(--radius-sm)', fontWeight: 600, fontSize: '0.95rem' }}>
            Academic Year: {activeYear} (Admission Registration Open)
          </div>
        </section>

        {/* Selection of Course at start */}
        {admissionsOpen && (
          <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              Select Course for Admission
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-medium)', margin: 0 }}>
              Please select the academic course you wish to enroll in before starting the application form:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginTop: '0.5rem' }}>
              {courses.map(c => {
                const isSelected = String(selectedCourse) === String(c.id);
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCourse(c.id)}
                    style={{
                      border: isSelected ? '2.5px solid var(--primary)' : '1.5px solid var(--border-color)',
                      backgroundColor: isSelected ? 'var(--primary-light)' : '#ffffff',
                      borderRadius: 'var(--radius-md)',
                      padding: '1.5rem',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all var(--transition-fast)',
                      boxShadow: isSelected ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem',
                      justifyContent: 'center',
                      minHeight: '110px'
                    }}
                  >
                    <strong style={{ fontSize: '1.4rem', color: isSelected ? 'var(--primary)' : 'var(--text-dark)', fontFamily: 'var(--font-display)', fontWeight: 800 }}>
                      {c.prefix}
                    </strong>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-medium)', fontWeight: 600, lineHeight: 1.3 }}>
                      {c.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Instructions */}
        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            Application Steps
          </h3>
          <ul style={{ listStyleType: 'none', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <li style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', fontWeight: '700', flexShrink: 0 }}>1</div>
              <div>
                <strong style={{ display: 'block', fontSize: '1rem' }}>Choose Your Course</strong>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-medium)' }}>Select the course from the options grid above.</span>
              </div>
            </li>
            <li style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', fontWeight: '700', flexShrink: 0 }}>2</div>
              <div>
                <strong style={{ display: 'block', fontSize: '1rem' }}>Provide Aadhaar & Personal Info</strong>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-medium)' }}>Each candidate must provide a unique 12-digit Aadhaar Number. Duplicate submissions are strictly blocked.</span>
              </div>
            </li>
            <li style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', fontWeight: '700', flexShrink: 0 }}>3</div>
              <div>
                <strong style={{ display: 'block', fontSize: '1rem' }}>Verify & Complete Submissions</strong>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-medium)' }}>Review all form steps and click submit to generate your unique sequential Application ID.</span>
              </div>
            </li>
          </ul>
        </section>

        {/* Action Button / Closed Banner */}
        <section style={{ textAlign: 'center', marginTop: '1rem' }}>
          {admissionsOpen ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
              <button 
                className="btn btn-primary" 
                style={{ paddingInline: '4rem', fontSize: '1.1rem', minHeight: '52px' }} 
                onClick={() => {
                  const courseObj = courses.find(c => String(c.id) === String(selectedCourse));
                  navigate('/apply', { 
                    courseId: selectedCourse,
                    courseName: courseObj ? courseObj.name : 'Selected Course',
                    coursePrefix: courseObj ? courseObj.prefix : ''
                  });
                }}
                disabled={!selectedCourse}
              >
                Start Application
              </button>
              {!selectedCourse && (
                <span style={{ fontSize: '0.85rem', color: 'var(--text-medium)', fontWeight: 600 }}>
                  ⚠️ Please select a course from the grid above to unlock the application form.
                </span>
              )}
            </div>
          ) : (
            <div style={{ backgroundColor: 'var(--error-light)', border: '1px solid var(--error)', padding: '2rem', borderRadius: 'var(--radius-lg)', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
              <h3 style={{ color: 'var(--error)', marginBottom: '0.5rem', fontSize: '1.25rem' }}>Admissions Closed</h3>
              <p style={{ color: 'var(--text-medium)', fontSize: '0.95rem', fontWeight: 600 }}>
                Admissions are currently closed. Thank you for your interest. Please contact the Admission Office for further information.
              </p>
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer style={{ marginTop: 'auto', backgroundColor: '#ffffff', borderTop: '1px solid var(--border-color)', padding: '1.5rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-medium)' }}>
        {footerText}
      </footer>
    </div>
  );
}
