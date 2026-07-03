import React, { useState, useEffect } from 'react';
import { useAuth, useToast } from '../App';
import ConfirmModal from '../components/ConfirmModal';

export default function CourseManager() {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [modal, setModal] = useState({ open: false, editMode: false, data: { name: '', prefix: '', current_number: 0 } });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmData, setConfirmData] = useState({ title: '', message: '', onConfirm: () => {} });

  const { fetchWithAuth } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = () => {
    setLoading(true);
    fetchWithAuth('/api/admin/courses')
      .then(res => res.json())
      .then(data => {
        setCourses(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        showToast('Error loading courses.', 'error');
        setLoading(false);
      });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = modal.editMode 
      ? `/api/admin/courses/${modal.data.id}` 
      : '/api/admin/courses';
    const method = modal.editMode ? 'PUT' : 'POST';

    try {
      const res = await fetchWithAuth(url, {
        method,
        body: JSON.stringify(modal.data)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save course.');
      
      showToast(`Course ${modal.editMode ? 'updated' : 'created'} successfully.`, 'success');
      setModal({ open: false, editMode: false, data: { name: '', prefix: '', current_number: 0 } });
      loadCourses();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = (courseId, prefix) => {
    setConfirmData({
      title: 'Delete Course',
      message: `Are you sure you want to permanently delete course "${prefix}"? This will not remove students if they have registered, but it will block new submissions.`,
      onConfirm: async () => {
        try {
          const res = await fetchWithAuth(`/api/admin/courses/${courseId}`, {
            method: 'DELETE'
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to delete course.');
          
          showToast('Course deleted successfully.', 'success');
          loadCourses();
        } catch (err) {
          showToast(err.message, 'error');
        }
        setConfirmOpen(false);
      }
    });
    setConfirmOpen(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="admin-page-header">
        <h2 className="admin-page-title">Course Management</h2>
        <button className="btn btn-primary" onClick={() => setModal({ open: true, editMode: false, data: { name: '', prefix: '', current_number: 0 } })}>
          + Add New Course
        </button>
      </div>

      {loading ? (
        <div className="card" style={{ padding: '2rem' }}>
          <div className="skeleton skeleton-title"></div>
          <div className="skeleton skeleton-input" style={{ height: '200px' }}></div>
        </div>
      ) : (
        <div className="table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Course Name</th>
                <th>Prefix</th>
                <th>Current Auto Number</th>
                <th>Next Code Preview</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {courses.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-medium)', fontWeight: 600 }}>
                    No courses configured. Add a course to start collecting admissions.
                  </td>
                </tr>
              ) : (
                courses.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: '600' }}>{c.name}</td>
                    <td style={{ fontWeight: '700', color: 'var(--primary)' }}>{c.prefix}</td>
                    <td>{c.current_number}</td>
                    <td style={{ fontWeight: 'bold' }}>
                      {c.prefix}-{String(c.current_number + 1).padStart(3, '0')}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-secondary" style={{ minHeight: '36px', height: '36px', fontSize: '0.85rem' }} onClick={() => setModal({ open: true, editMode: true, data: c })}>
                          Edit
                        </button>
                        <button className="btn btn-danger" style={{ minHeight: '36px', height: '36px', width: '36px', padding: 0, fontSize: '0.9rem' }} onClick={() => handleDelete(c.id, c.prefix)}>
                          ×
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE / EDIT COURSE MODAL */}
      {modal.open && (
        <div className="modal-overlay">
          <form onSubmit={handleSubmit} className="modal-container">
            <div className="modal-header">
              <h3 className="modal-title">{modal.editMode ? 'Edit Course' : 'Create Course'}</h3>
              <button type="button" className="modal-close" onClick={() => setModal(prev => ({ ...prev, open: false }))}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label" htmlFor="c-name">Course Name</label>
                <input
                  type="text"
                  id="c-name"
                  className="form-control"
                  placeholder="e.g. Master of Computer Applications"
                  value={modal.data.name}
                  onChange={(e) => setModal(prev => ({ ...prev, data: { ...prev.data, name: e.target.value } }))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="c-prefix">Application Prefix</label>
                <input
                  type="text"
                  id="c-prefix"
                  className="form-control"
                  placeholder="e.g. MCA"
                  value={modal.data.prefix}
                  onChange={(e) => setModal(prev => ({ ...prev, data: { ...prev.data, prefix: e.target.value } }))}
                  disabled={modal.editMode} // Lock prefix if editing to avoid code corruption
                  required
                />
                <span className="form-help-text">This will prefix application codes (e.g. MBA, MCA). Lockable once created.</span>
              </div>

              {modal.editMode && (
                <div className="form-group">
                  <label className="form-label" htmlFor="c-num">Current Sequence Counter</label>
                  <input
                    type="number"
                    id="c-num"
                    className="form-control"
                    value={modal.data.current_number}
                    onChange={(e) => setModal(prev => ({ ...prev, data: { ...prev.data, current_number: parseInt(e.target.value) || 0 } }))}
                    min="0"
                    required
                  />
                  <span className="form-help-text">WARNING: Lowering this value might cause sequential duplicate collision key errors.</span>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setModal(prev => ({ ...prev, open: false }))}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Course</button>
            </div>
          </form>
        </div>
      )}

      {/* CONFIRMATION DIALOG MODAL */}
      <ConfirmModal
        open={confirmOpen}
        title={confirmData.title}
        message={confirmData.message}
        type="danger"
        onConfirm={confirmData.onConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
