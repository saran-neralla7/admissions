import React, { useState, useEffect } from 'react';
import { useAuth, useToast } from '../App';
import ConfirmModal from '../components/ConfirmModal';

export default function StudentDetails({ id, onClose, onDeleteSuccess, onUpdateSuccess }) {
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editedValues, setEditedValues] = useState({}); // { [valueId]: value }
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmData, setConfirmData] = useState({ title: '', message: '', onConfirm: () => {} });

  const { fetchWithAuth } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    loadDetails();
  }, [id]);

  const loadDetails = () => {
    setLoading(true);
    fetchWithAuth(`/api/admin/submissions/${id}`)
      .then(res => res.json())
      .then(data => {
        setDetails(data);
        setStatus(data.status);
        
        // Initialize editable fields
        const vals = {};
        data.values.forEach(v => {
          vals[v.id] = v.value;
        });
        setEditedValues(vals);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        showToast(err.message || 'Error loading application details.', 'error');
        onClose();
      });
  };

  const handleStatusChange = async (newStatus) => {
    try {
      const res = await fetchWithAuth(`/api/admin/submissions/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) throw new Error('Failed to update status.');
      setStatus(newStatus);
      showToast('Status updated successfully.', 'success');
      onUpdateSuccess();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSaveEdits = async () => {
    setSubmitting(true);
    try {
      const res = await fetchWithAuth(`/api/admin/submissions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(editedValues)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update student data.');
      
      showToast('Student details updated successfully.', 'success');
      setEditMode(false);
      loadDetails();
      onUpdateSuccess();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    setConfirmData({
      title: 'Delete Application',
      message: `Are you sure you want to permanently delete application ${details?.application_number}? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          const res = await fetchWithAuth(`/api/admin/submissions/${id}`, {
            method: 'DELETE'
          });
          if (!res.ok) throw new Error('Failed to delete application.');
          showToast('Application deleted successfully.', 'success');
          onDeleteSuccess();
          onClose();
        } catch (err) {
          showToast(err.message, 'error');
        }
        setConfirmOpen(false);
      }
    });
    setConfirmOpen(true);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal-container" style={{ padding: '2rem', gap: '1rem' }}>
          <div className="skeleton skeleton-title"></div>
          <div className="skeleton skeleton-input"></div>
          <div className="skeleton skeleton-input" style={{ height: '100px' }}></div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .modal-overlay, .modal-overlay * {
            visibility: visible;
          }
          .modal-overlay {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: none !important;
            padding: 0 !important;
          }
          .modal-container {
            box-shadow: none !important;
            border: none !important;
            max-width: 100% !important;
            width: 100% !important;
            max-height: none !important;
            overflow: visible !important;
          }
          .modal-header button, .modal-footer, .no-print {
            display: none !important;
          }
          .print-title {
            text-align: center;
            font-size: 1.4rem;
            font-weight: bold;
            margin-bottom: 2rem;
            border-bottom: 2px solid #000;
            padding-bottom: 1rem;
          }
        }
      `}</style>

      <div className="modal-container" style={{ maxWidth: '800px' }}>
        <div className="modal-header">
          <h3 className="modal-title">
            Application Details: {details.application_number}
          </h3>
          <button className="modal-close no-print" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Print Title Header */}
          <div className="print-title" style={{ display: 'none' }}>
            <h2>GAYATRI VIDYA PARISHAD COLLEGE FOR DEGREE AND PG COURSES</h2>
            <p>Rushikonda, Visakhapatnam - 530045</p>
            <p style={{ marginTop: '0.5rem', fontWeight: 'bold' }}>ADMISSION REGISTRATION RECORD</p>
          </div>

          {/* Quick Stats Banner */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-main)', padding: '1rem 1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-medium)', fontWeight: 'bold', display: 'block' }}>Application Number</span>
              <strong style={{ fontSize: '1.25rem', color: 'var(--primary)' }}>{details.application_number}</strong>
            </div>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-medium)', fontWeight: 'bold', display: 'block' }}>Course & Academic Year</span>
              <span style={{ fontWeight: '600', fontSize: '0.95rem' }}>{details.course_name} ({details.academic_year_name})</span>
            </div>
            <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-medium)', fontWeight: 'bold' }}>Status</span>
              <select 
                className="form-control" 
                style={{ minHeight: '32px', height: '32px', padding: '0 0.5rem', fontSize: '0.85rem', width: '120px' }}
                value={status} 
                onChange={(e) => handleStatusChange(e.target.value)}
              >
                <option value="Pending">Pending</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
            <div style={{ display: 'none' }} className="print-status">
              <span style={{ fontSize: '0.8rem', color: '#666', fontWeight: 'bold', display: 'block' }}>Status</span>
              <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{status.toUpperCase()}</span>
            </div>
          </div>

          {/* Field Values Grid */}
          <div style={{ marginTop: '1rem' }}>
            <h4 style={{ color: 'var(--primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.25rem', marginBottom: '1rem', fontSize: '1.1rem' }}>
              Submission Data
            </h4>
            
            {editMode ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {details.values.map(v => (
                  <div key={v.id} className="form-group" style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '1rem', alignItems: 'center' }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>{v.field_label}</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editedValues[v.id] || ''}
                      onChange={(e) => setEditedValues(prev => ({ ...prev, [v.id]: e.target.value }))}
                      disabled={submitting}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
                {details.values.map(v => {
                  let displayVal = v.value;
                  if (v.field_type === 'checkbox') {
                    try {
                      const parsed = JSON.parse(v.value);
                      if (Array.isArray(parsed)) displayVal = parsed.join(', ');
                    } catch (e) {}
                  }
                  return (
                    <div key={v.id} style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-medium)', fontWeight: 'bold' }}>{v.field_label}</span>
                      <span style={{ fontSize: '0.95rem', fontWeight: '600', marginTop: '0.15rem' }}>{displayVal || '-'}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer no-print">
          <button className="btn btn-secondary" onClick={handlePrint} style={{ marginRight: 'auto' }}>
            Print Record
          </button>
          
          {editMode ? (
            <>
              <button className="btn btn-secondary" onClick={() => setEditMode(false)} disabled={submitting}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSaveEdits} disabled={submitting}>
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-danger" onClick={handleDelete} style={{ marginRight: '0.5rem' }}>
                Delete
              </button>
              <button className="btn btn-secondary" onClick={() => setEditMode(true)}>
                Edit Data
              </button>
              <button className="btn btn-primary" onClick={onClose}>
                Close
              </button>
            </>
          )}
        </div>
      </div>
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
