import React, { useState, useEffect } from 'react';
import { useAuth, useToast } from '../App';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    college_name: '',
    college_address: '',
    welcome_message: '',
    footer_text: '',
    admissions_open: '0'
  });
  
  // Password change state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const { fetchWithAuth } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = () => {
    setLoading(true);
    fetchWithAuth('/api/public/settings')
      .then(res => res.json())
      .then(data => {
        if (data.settings) {
          setSettings({
            college_name: data.settings.college_name || '',
            college_address: data.settings.college_address || '',
            welcome_message: data.settings.welcome_message || '',
            footer_text: data.settings.footer_text || '',
            admissions_open: data.settings.admissions_open || '0'
          });
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        showToast('Failed to load settings.', 'error');
        setLoading(false);
      });
  };

  const handleSettingsSubmit = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetchWithAuth('/api/admin/settings', {
        method: 'POST',
        body: JSON.stringify(settings)
      });
      if (!res.ok) throw new Error('Failed to save settings.');
      showToast('System settings updated successfully.', 'success');
      loadSettings();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      showToast('Passwords do not match.', 'error');
      return;
    }
    if (password.length < 6) {
      showToast('Password must be at least 6 characters long.', 'error');
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await fetchWithAuth('/api/admin/change-password', {
        method: 'POST',
        body: JSON.stringify({ new_password: password })
      });
      if (!res.ok) throw new Error('Failed to update password.');
      
      showToast('Administrator password updated successfully.', 'success');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setPasswordLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="card" style={{ padding: '2rem' }}>
        <div className="skeleton skeleton-title"></div>
        <div className="skeleton skeleton-input" style={{ height: '300px' }}></div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="admin-page-header">
        <h2 className="admin-page-title">Settings</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
        {/* Portal Customization Form */}
        <form onSubmit={handleSettingsSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ fontSize: '1.2rem', color: 'var(--primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            Portal Configuration
          </h3>

          <div className="form-group">
            <label className="form-label">Admissions Enrollment Status</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.25rem' }}>
              <button 
                type="button" 
                className={`btn ${settings.admissions_open === '1' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1 }}
                onClick={() => setSettings(prev => ({ ...prev, admissions_open: '1' }))}
              >
                Admissions Open
              </button>
              <button 
                type="button" 
                className={`btn ${settings.admissions_open === '0' ? 'btn-danger' : 'btn-secondary'}`}
                style={{ flex: 1 }}
                onClick={() => setSettings(prev => ({ ...prev, admissions_open: '0' }))}
              >
                Admissions Closed
              </button>
            </div>
            <span className="form-help-text">
              {settings.admissions_open === '1' 
                ? '🟢 Students can register new applications.' 
                : '🔴 Registrations are blocked. Visitors see a closed notice.'
              }
            </span>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="col-name">College Name</label>
            <input
              type="text"
              id="col-name"
              className="form-control"
              value={settings.college_name}
              onChange={(e) => setSettings(prev => ({ ...prev, college_name: e.target.value }))}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="col-addr">College Address</label>
            <input
              type="text"
              id="col-addr"
              className="form-control"
              value={settings.college_address}
              onChange={(e) => setSettings(prev => ({ ...prev, college_address: e.target.value }))}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="col-welcome">Welcome Message</label>
            <textarea
              id="col-welcome"
              className="form-control"
              value={settings.welcome_message}
              onChange={(e) => setSettings(prev => ({ ...prev, welcome_message: e.target.value }))}
              rows="3"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="col-foot">Footer Text</label>
            <input
              type="text"
              id="col-foot"
              className="form-control"
              value={settings.footer_text}
              onChange={(e) => setSettings(prev => ({ ...prev, footer_text: e.target.value }))}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }} disabled={savingSettings}>
            {savingSettings ? 'Saving...' : 'Save Settings'}
          </button>
        </form>

        {/* Admin Password Change Form */}
        <form onSubmit={handlePasswordSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', alignSelf: 'start' }}>
          <h3 style={{ fontSize: '1.2rem', color: 'var(--primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            Change Credentials
          </h3>

          <div className="form-group">
            <label className="form-label" htmlFor="new-pw">New Password</label>
            <input
              type="password"
              id="new-pw"
              className="form-control"
              placeholder="Min 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="conf-pw">Confirm New Password</label>
            <input
              type="password"
              id="conf-pw"
              className="form-control"
              placeholder="Re-type password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }} disabled={passwordLoading}>
            {passwordLoading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
