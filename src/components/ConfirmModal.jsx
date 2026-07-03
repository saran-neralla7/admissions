import React from 'react';

export default function ConfirmModal({ 
  open, 
  title, 
  message, 
  onConfirm, 
  onCancel, 
  confirmText = 'Confirm', 
  cancelText = 'Cancel', 
  type = 'primary' 
}) {
  if (!open) return null;

  const getConfirmButtonClass = () => {
    if (type === 'danger') return 'btn btn-danger';
    return 'btn btn-primary';
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 3000 }}>
      <div className="modal-container" style={{ maxWidth: '440px', padding: '0.5rem' }}>
        <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: '0.25rem' }}>
          <h3 className="modal-title" style={{ 
            color: type === 'danger' ? 'var(--error)' : 'var(--primary)',
            fontSize: '1.25rem',
            fontFamily: 'var(--font-display)',
            fontWeight: 800
          }}>
            {title}
          </h3>
          <button type="button" className="modal-close" onClick={onCancel} style={{ display: 'none' }}>×</button>
        </div>
        <div className="modal-body" style={{ paddingBlock: '0.25rem 1rem' }}>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-medium)', lineHeight: '1.5' }}>
            {message}
          </p>
        </div>
        <div className="modal-footer" style={{ borderTop: 'none', backgroundColor: 'transparent', padding: '1rem 1.5rem', gap: '0.75rem' }}>
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={onCancel} 
            style={{ minHeight: '40px', height: '40px', paddingBlock: 0, flex: 1 }}
          >
            {cancelText}
          </button>
          <button 
            type="button" 
            className={getConfirmButtonClass()} 
            onClick={onConfirm} 
            style={{ minHeight: '40px', height: '40px', paddingBlock: 0, flex: 1 }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
