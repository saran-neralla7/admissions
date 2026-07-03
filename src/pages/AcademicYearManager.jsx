import React, { useState, useEffect } from 'react';
import { useAuth, useToast } from '../App';
import ConfirmModal from '../components/ConfirmModal';

export default function AcademicYearManager() {
  const [loading, setLoading] = useState(true);
  const [years, setYears] = useState([]);
  const [newYearName, setNewYearName] = useState('');
  const [adding, setAdding] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmData, setConfirmData] = useState({ title: '', message: '', onConfirm: () => {} });

  const { fetchWithAuth } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    loadYears();
  }, []);

  const loadYears = () => {
    setLoading(true);
    fetchWithAuth('/api/admin/academic-years')
      .then(res => res.json())
      .then(data => {
        setYears(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        showToast('Error loading academic years.', 'error');
        setLoading(false);
      });
  };

  const handleCreateYear = async (e) => {
    e.preventDefault();
    if (!newYearName.trim()) return;

    setAdding(true);
    try {
      const res = await fetchWithAuth('/api/admin/academic-years', {
        method: 'POST',
        body: JSON.stringify({ name: newYearName.trim() })
      });
      if (!res.ok) throw new Error('Failed to create academic year.');
      showToast(`Academic Year "${newYearName}" created.`, 'success');
      setNewYearName('');
      loadYears();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setAdding(false);
    }
  };

  const handleActivateYear = (id, name) => {
    setConfirmData({
      title: 'Activate Academic Year',
      message: `Are you sure you want to activate Academic Year "${name}"? All subsequent student applications will belong to this year.`,
      onConfirm: async () => {
        try {
          const res = await fetchWithAuth('/api/admin/academic-years/activate', {
            method: 'POST',
            body: JSON.stringify({ id })
          });
          if (!res.ok) throw new Error('Failed to activate academic year.');
          showToast(`Academic Year "${name}" is now active.`, 'success');
          loadYears();
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
        <h2 className="admin-page-title">Academic Year Management</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
        {/* Left pane: Add academic year */}
        <div className="card" style={{ alignSelf: 'start' }}>
          <h3 style={{ fontSize: '1.15rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1.25rem' }}>
            Add Academic Year
          </h3>
          <form onSubmit={handleCreateYear} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 1, minWidth: '220px' }}>
              <label className="form-label" htmlFor="ay-name">Academic Year Name</label>
              <input
                type="text"
                id="ay-name"
                className="form-control"
                placeholder="e.g. 2026-27"
                value={newYearName}
                onChange={(e) => setNewYearName(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={adding}>
              {adding ? 'Adding...' : 'Create Year'}
            </button>
          </form>
        </div>

        {/* Right pane: List and Activate years */}
        {loading ? (
          <div className="card" style={{ padding: '2rem' }}>
            <div className="skeleton skeleton-title"></div>
            <div className="skeleton skeleton-input"></div>
          </div>
        ) : (
          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Academic Year Name</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {years.map(y => (
                  <tr key={y.id} style={y.is_active === 1 ? { backgroundColor: 'var(--primary-light)' } : {}}>
                    <td style={{ fontWeight: '600' }}>{y.name}</td>
                    <td>
                      {y.is_active === 1 ? (
                        <span className="status-badge completed">ACTIVE</span>
                      ) : (
                        <span className="status-badge pending" style={{ backgroundColor: 'var(--text-light)' }}>INACTIVE</span>
                      )}
                    </td>
                    <td>
                      {y.is_active === 0 && (
                        <button 
                          className="btn btn-secondary" 
                          style={{ minHeight: '36px', height: '36px', fontSize: '0.85rem' }}
                          onClick={() => handleActivateYear(y.id, y.name)}
                        >
                          Activate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* CONFIRMATION DIALOG MODAL */}
      <ConfirmModal
        open={confirmOpen}
        title={confirmData.title}
        message={confirmData.message}
        type="primary"
        onConfirm={confirmData.onConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
