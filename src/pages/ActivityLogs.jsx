import React, { useState, useEffect } from 'react';
import { useAuth, useToast } from '../App';

export default function ActivityLogs() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);

  const { fetchWithAuth } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    fetchWithAuth('/api/admin/logs')
      .then(res => res.json())
      .then(data => {
        setLogs(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        showToast('Error loading activity logs.', 'error');
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="admin-page-header">
        <h2 className="admin-page-title">Admin Activity Log</h2>
      </div>

      {loading ? (
        <div className="card" style={{ padding: '2rem' }}>
          <div className="skeleton skeleton-title"></div>
          <div className="skeleton skeleton-input" style={{ height: '300px' }}></div>
        </div>
      ) : (
        <div className="card" style={{ padding: '1.5rem 2rem' }}>
          {logs.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-medium)', fontStyle: 'italic', fontWeight: 600 }}>
              No administrator activities recorded yet.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {logs.map((log) => (
                <div key={log.id} className="log-item">
                  <div className="log-info">
                    <span className="log-action" style={{ 
                      color: log.action.includes('Delete') ? 'var(--error)' : log.action.includes('Create') ? 'var(--success)' : 'var(--text-dark)' 
                    }}>
                      {log.action}
                    </span>
                    <span className="log-details">{log.details}</span>
                  </div>
                  <div className="log-meta">
                    <strong style={{ display: 'block', color: 'var(--text-dark)' }}>
                      admin: {log.admin_username || 'System'}
                    </strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
