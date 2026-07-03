import React, { useState, useEffect } from 'react';
import { useAuth, useToast } from '../App';
import ConfirmModal from '../components/ConfirmModal';

export default function FormBuilder() {
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState([]);
  const [fields, setFields] = useState([]);
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  
  // Modals visibility
  const [sectionModal, setSectionModal] = useState({ open: false, editMode: false, data: { name: '', display_order: 1, is_enabled: 1 } });
  const [fieldModal, setFieldModal] = useState({ open: false, editMode: false, data: { label: '', type: 'text', placeholder: '', help_text: '', is_required: 0, validation_regex: '', options: '', display_order: 1, section_id: null } });

  // Drag state
  const [draggedFieldId, setDraggedFieldId] = useState(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmData, setConfirmData] = useState({ title: '', message: '', onConfirm: () => {}, type: 'danger' });

  const { fetchWithAuth } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    loadSchema();
  }, []);

  const loadSchema = () => {
    setLoading(true);
    Promise.all([
      fetchWithAuth('/api/admin/sections').then(res => res.json()),
      fetchWithAuth('/api/admin/fields').then(res => res.json())
    ])
      .then(([sectionsData, fieldsData]) => {
        setSections(sectionsData.sort((a,b) => a.display_order - b.display_order));
        setFields(fieldsData.sort((a,b) => a.display_order - b.display_order));
        
        if (sectionsData.length > 0 && !selectedSectionId) {
          setSelectedSectionId(sectionsData[0].id);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        showToast('Error loading form configuration.', 'error');
        setLoading(false);
      });
  };

  const getActiveSectionFields = () => {
    return fields.filter(f => f.section_id === selectedSectionId);
  };

  // --- SECTION MUTATIONS ---
  const handleSaveSection = async (e) => {
    e.preventDefault();
    const url = sectionModal.editMode 
      ? `/api/admin/sections/${sectionModal.data.id}` 
      : '/api/admin/sections';
    const method = sectionModal.editMode ? 'PUT' : 'POST';

    try {
      const res = await fetchWithAuth(url, {
        method,
        body: JSON.stringify(sectionModal.data)
      });
      if (!res.ok) throw new Error('Failed to save section.');
      showToast(`Section ${sectionModal.editMode ? 'updated' : 'created'} successfully.`, 'success');
      setSectionModal({ open: false, editMode: false, data: { name: '', display_order: 1, is_enabled: 1 } });
      loadSchema();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteSection = (sectionId, name) => {
    setConfirmData({
      title: 'Delete Section',
      message: `Are you sure you want to permanently delete section "${name}"? ALL fields in this section will be permanently deleted!`,
      type: 'danger',
      onConfirm: async () => {
        try {
          const res = await fetchWithAuth(`/api/admin/sections/${sectionId}`, {
            method: 'DELETE'
          });
          if (!res.ok) throw new Error('Failed to delete section.');
          showToast('Section deleted successfully.', 'success');
          if (selectedSectionId === sectionId) {
            setSelectedSectionId(null);
          }
          loadSchema();
        } catch (err) {
          showToast(err.message, 'error');
        }
        setConfirmOpen(false);
      }
    });
    setConfirmOpen(true);
  };

  // --- FIELD MUTATIONS ---
  const handleSaveField = async (e) => {
    e.preventDefault();
    const payload = { ...fieldModal.data };
    
    // Parse options if required
    if (['dropdown', 'radio', 'checkbox'].includes(payload.type)) {
      const opts = payload.options.split(',').map(o => o.trim()).filter(o => o.length > 0);
      payload.options = JSON.stringify(opts);
    } else {
      payload.options = null;
    }

    const url = fieldModal.editMode 
      ? `/api/admin/fields/${payload.id}` 
      : '/api/admin/fields';
    const method = fieldModal.editMode ? 'PUT' : 'POST';

    try {
      const res = await fetchWithAuth(url, {
        method,
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to save field.');
      showToast(`Field ${fieldModal.editMode ? 'updated' : 'created'} successfully.`, 'success');
      setFieldModal({ open: false, editMode: false, data: { label: '', type: 'text', placeholder: '', help_text: '', is_required: 0, validation_regex: '', options: '', display_order: 1, section_id: null } });
      loadSchema();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteField = (fieldId, label) => {
    setConfirmData({
      title: 'Delete Field',
      message: `Are you sure you want to permanently delete the field "${label}"?`,
      type: 'danger',
      onConfirm: async () => {
        try {
          const res = await fetchWithAuth(`/api/admin/fields/${fieldId}`, {
            method: 'DELETE'
          });
          if (!res.ok) throw new Error('Failed to delete field.');
          showToast('Field deleted successfully.', 'success');
          loadSchema();
        } catch (err) {
          showToast(err.message, 'error');
        }
        setConfirmOpen(false);
      }
    });
    setConfirmOpen(true);
  };

  // --- SORTING / REORDER WORKFLOW ---
  const handleDragStart = (e, fieldId) => {
    setDraggedFieldId(fieldId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e, targetFieldId) => {
    e.preventDefault();
    if (draggedFieldId === null || draggedFieldId === targetFieldId) return;

    const activeFields = getActiveSectionFields();
    const draggedIdx = activeFields.findIndex(f => f.id === draggedFieldId);
    const targetIdx = activeFields.findIndex(f => f.id === targetFieldId);

    if (draggedIdx === -1 || targetIdx === -1) return;

    // Rearrange locally
    const rearranged = [...activeFields];
    const [draggedField] = rearranged.splice(draggedIdx, 1);
    rearranged.splice(targetIdx, 0, draggedField);

    // Prepare reorder package
    const reorderPayload = rearranged.map((f, index) => ({
      id: f.id,
      display_order: index + 1,
      section_id: selectedSectionId
    }));

    // Update locally to prevent UI flicker
    const updatedFields = fields.map(f => {
      const match = reorderPayload.find(p => p.id === f.id);
      if (match) return { ...f, display_order: match.display_order };
      return f;
    });
    setFields(updatedFields.sort((a,b) => a.display_order - b.display_order));

    try {
      const res = await fetchWithAuth('/api/admin/fields/reorder', {
        method: 'POST',
        body: JSON.stringify({ order: reorderPayload })
      });
      if (!res.ok) throw new Error('Failed to save field order.');
      showToast('Field order updated.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
      loadSchema();
    } finally {
      setDraggedFieldId(null);
    }
  };

  // Arrow key move helper for mobile & keyboard accessibility
  const handleMoveField = async (fieldId, direction) => {
    const activeFields = getActiveSectionFields();
    const idx = activeFields.findIndex(f => f.id === fieldId);
    if (idx === -1) return;
    
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= activeFields.length) return;

    const rearranged = [...activeFields];
    const [field] = rearranged.splice(idx, 1);
    rearranged.splice(targetIdx, 0, field);

    const reorderPayload = rearranged.map((f, index) => ({
      id: f.id,
      display_order: index + 1,
      section_id: selectedSectionId
    }));

    try {
      const res = await fetchWithAuth('/api/admin/fields/reorder', {
        method: 'POST',
        body: JSON.stringify({ order: reorderPayload })
      });
      if (!res.ok) throw new Error('Failed to save field order.');
      showToast('Field order updated.', 'success');
      loadSchema();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="admin-page-header">
        <h2 className="admin-page-title">Dynamic Form Builder</h2>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={() => setSectionModal({ open: true, editMode: false, data: { name: '', display_order: sections.length + 1, is_enabled: 1 } })}>
            + Add Section
          </button>
          <button className="btn btn-primary" onClick={() => setFieldModal({ open: true, editMode: false, data: { label: '', type: 'text', placeholder: '', help_text: '', is_required: 0, validation_regex: '', options: '', display_order: getActiveSectionFields().length + 1, section_id: selectedSectionId } })} disabled={!selectedSectionId}>
            + Add Field
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ padding: '2rem' }}>
          <div className="skeleton skeleton-title"></div>
          <div className="skeleton skeleton-input" style={{ height: '300px' }}></div>
        </div>
      ) : (
        <div className="form-builder-layout">
          {/* Section Panel */}
          <div className="sections-panel">
            <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-medium)', marginBottom: '0.5rem', fontWeight: 700 }}>
              Form Sections
            </h4>
            {sections.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', fontStyle: 'italic' }}>No sections created yet.</p>
            ) : (
              sections.map(sec => (
                <div 
                  key={sec.id} 
                  className={`builder-section-item ${selectedSectionId === sec.id ? 'active' : ''}`}
                  onClick={() => setSelectedSectionId(sec.id)}
                >
                  <span style={{ fontSize: '0.95rem' }}>{sec.name}</span>
                  <div style={{ display: 'flex', gap: '0.25rem' }} className="no-print">
                    <button 
                      className="btn btn-secondary" 
                      style={{ minHeight: '26px', height: '26px', width: '26px', padding: 0, fontSize: '0.75rem' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSectionModal({ open: true, editMode: true, data: sec });
                      }}
                      title="Edit Section Name"
                    >
                      ✎
                    </button>
                    <button 
                      className="btn btn-secondary" 
                      style={{ minHeight: '26px', height: '26px', width: '26px', padding: 0, fontSize: '0.75rem', color: 'var(--error)' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSection(sec.id, sec.name);
                      }}
                      title="Delete Section"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Fields Panel */}
          <div className="fields-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2.5px solid var(--primary-light)', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.35rem', color: 'var(--primary)' }}>
                {sections.find(s => s.id === selectedSectionId)?.name || 'Select a Section'} Fields
              </h3>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-medium)', fontWeight: 600 }}>
                {getActiveSectionFields().length} Fields Total
              </span>
            </div>

            {selectedSectionId === null ? (
              <p style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-medium)', fontStyle: 'italic' }}>
                Please create a section in the left panel to configure fields.
              </p>
            ) : getActiveSectionFields().length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 2rem', border: '2px dashed var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                <p style={{ color: 'var(--text-medium)', marginBottom: '1rem', fontWeight: 600 }}>No fields configured in this section.</p>
                <button className="btn btn-primary" onClick={() => setFieldModal({ open: true, editMode: false, data: { label: '', type: 'text', placeholder: '', help_text: '', is_required: 0, validation_regex: '', options: '', display_order: 1, section_id: selectedSectionId } })}>
                  Add First Field
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} className="fields-list">
                <p style={{ fontSize: '0.8rem', color: 'var(--text-medium)', fontStyle: 'italic', marginBottom: '0.5rem' }}>
                  💡 Tip: Drag & drop fields or use the Up/Down arrows to reorder how fields appear on the student admission form.
                </p>
                
                {getActiveSectionFields().map((field, idx) => (
                  <div 
                    key={field.id} 
                    className={`builder-field-card ${draggedFieldId === field.id ? 'dragging' : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, field.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, field.id)}
                  >
                    <div className="drag-handle" title="Drag to reorder">☰</div>
                    
                    <div className="field-details">
                      <div className="field-name-row">
                        <span className="field-label-text">{field.label}</span>
                        <span className="field-badge">{field.type}</span>
                        {field.is_required === 1 && <span className="field-badge required">required</span>}
                        {field.is_enabled === 0 && <span className="field-badge">disabled</span>}
                      </div>
                      {field.help_text && <span className="field-help-preview">{field.help_text}</span>}
                    </div>

                    <div className="field-actions" style={{ alignItems: 'center' }}>
                      {/* Up/Down buttons for mobile accessibility */}
                      <button 
                        className="btn btn-secondary" 
                        style={{ minHeight: '32px', height: '32px', width: '32px', padding: 0 }}
                        onClick={() => handleMoveField(field.id, 'up')}
                        disabled={idx === 0}
                        title="Move Up"
                      >
                        ▲
                      </button>
                      <button 
                        className="btn btn-secondary" 
                        style={{ minHeight: '32px', height: '32px', width: '32px', padding: 0 }}
                        onClick={() => handleMoveField(field.id, 'down')}
                        disabled={idx === getActiveSectionFields().length - 1}
                        title="Move Down"
                      >
                        ▼
                      </button>

                      <button 
                        className="btn btn-secondary" 
                        style={{ minHeight: '32px', height: '32px', fontSize: '0.8rem', marginLeft: '0.5rem' }}
                        onClick={() => {
                          let optionsText = '';
                          try {
                            if (field.options) {
                              const parsed = JSON.parse(field.options);
                              optionsText = parsed.join(', ');
                            }
                          } catch (e) {}
                          setFieldModal({ open: true, editMode: true, data: { ...field, options: optionsText } });
                        }}
                      >
                        Edit
                      </button>
                      <button 
                        className="btn btn-danger" 
                        style={{ minHeight: '32px', height: '32px', width: '32px', padding: 0 }}
                        onClick={() => handleDeleteField(field.id, field.label)}
                        title="Delete Field"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT SECTION */}
      {sectionModal.open && (
        <div className="modal-overlay">
          <form onSubmit={handleSaveSection} className="modal-container">
            <div className="modal-header">
              <h3 className="modal-title">{sectionModal.editMode ? 'Edit Section' : 'Add Form Section'}</h3>
              <button type="button" className="modal-close" onClick={() => setSectionModal(prev => ({ ...prev, open: false }))}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label" htmlFor="sec-name">Section Name</label>
                <input
                  type="text"
                  id="sec-name"
                  className="form-control"
                  value={sectionModal.data.name}
                  onChange={(e) => setSectionModal(prev => ({ ...prev, data: { ...prev.data, name: e.target.value } }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="sec-order">Display Order</label>
                <input
                  type="number"
                  id="sec-order"
                  className="form-control"
                  value={sectionModal.data.display_order}
                  onChange={(e) => setSectionModal(prev => ({ ...prev, data: { ...prev.data, display_order: parseInt(e.target.value) } }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <div className="options-group-horizontal">
                  <label className="custom-option-control">
                    <input
                      type="radio"
                      checked={sectionModal.data.is_enabled === 1}
                      onChange={() => setSectionModal(prev => ({ ...prev, data: { ...prev.data, is_enabled: 1 } }))}
                    />
                    Enabled
                  </label>
                  <label className="custom-option-control">
                    <input
                      type="radio"
                      checked={sectionModal.data.is_enabled === 0}
                      onChange={() => setSectionModal(prev => ({ ...prev, data: { ...prev.data, is_enabled: 0 } }))}
                    />
                    Disabled
                  </label>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setSectionModal(prev => ({ ...prev, open: false }))}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Section</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: CREATE / EDIT FIELD */}
      {fieldModal.open && (
        <div className="modal-overlay">
          <form onSubmit={handleSaveField} className="modal-container" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 className="modal-title">{fieldModal.editMode ? 'Edit Form Field' : 'Add Form Field'}</h3>
              <button type="button" className="modal-close" onClick={() => setFieldModal(prev => ({ ...prev, open: false }))}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label" htmlFor="f-label">Field Label</label>
                <input
                  type="text"
                  id="f-label"
                  className="form-control"
                  placeholder="e.g. Mobile Number, Intermediate Percentage"
                  value={fieldModal.data.label}
                  onChange={(e) => setFieldModal(prev => ({ ...prev, data: { ...prev.data, label: e.target.value } }))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="f-type">Input Type</label>
                <select
                  id="f-type"
                  className="form-control"
                  value={fieldModal.data.type}
                  onChange={(e) => setFieldModal(prev => ({ ...prev, data: { ...prev.data, type: e.target.value } }))}
                  required
                >
                  <option value="text">Text Input</option>
                  <option value="number">Number Input</option>
                  <option value="email">Email Input</option>
                  <option value="mobile">Mobile Number Input</option>
                  <option value="date">Date Picker</option>
                  <option value="textarea">Multi-line Text Area</option>
                  <option value="dropdown">Dropdown Options</option>
                  <option value="radio">Radio Buttons Group</option>
                  <option value="checkbox">Checkboxes Group</option>
                  <option value="course_dropdown">College Course Selection Dropdown</option>
                </select>
              </div>

              {['dropdown', 'radio', 'checkbox'].includes(fieldModal.data.type) && (
                <div className="form-group">
                  <label className="form-label" htmlFor="f-options">Options List (Comma Separated)</label>
                  <input
                    type="text"
                    id="f-options"
                    className="form-control"
                    placeholder="e.g. Option A, Option B, Option C"
                    value={fieldModal.data.options}
                    onChange={(e) => setFieldModal(prev => ({ ...prev, data: { ...prev.data, options: e.target.value } }))}
                    required
                  />
                  <span className="form-help-text">Separate options with commas. Spaces are automatically trimmed.</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="f-placeholder">Placeholder Text</label>
                <input
                  type="text"
                  id="f-placeholder"
                  className="form-control"
                  placeholder="e.g. Enter your number"
                  value={fieldModal.data.placeholder || ''}
                  onChange={(e) => setFieldModal(prev => ({ ...prev, data: { ...prev.data, placeholder: e.target.value } }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="f-help">Help / Tooltip Text</label>
                <input
                  type="text"
                  id="f-help"
                  className="form-control"
                  placeholder="e.g. As shown on certificate"
                  value={fieldModal.data.help_text || ''}
                  onChange={(e) => setFieldModal(prev => ({ ...prev, data: { ...prev.data, help_text: e.target.value } }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="f-regex">Custom Validation Regex (Pattern)</label>
                <input
                  type="text"
                  id="f-regex"
                  className="form-control"
                  placeholder="e.g. ^\d{12}$ for exactly 12 digits"
                  value={fieldModal.data.validation_regex || ''}
                  onChange={(e) => setFieldModal(prev => ({ ...prev, data: { ...prev.data, validation_regex: e.target.value } }))}
                />
                <span className="form-help-text">Leave blank to skip pattern verification. Standard checks (email, phone digits) are built-in.</span>
              </div>

              <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                <div>
                  <label className="form-label">Required Field?</label>
                  <div className="options-group-horizontal">
                    <label className="custom-option-control">
                      <input
                        type="radio"
                        checked={fieldModal.data.is_required === 1}
                        onChange={() => setFieldModal(prev => ({ ...prev, data: { ...prev.data, is_required: 1 } }))}
                      />
                      Yes
                    </label>
                    <label className="custom-option-control">
                      <input
                        type="radio"
                        checked={fieldModal.data.is_required === 0}
                        onChange={() => setFieldModal(prev => ({ ...prev, data: { ...prev.data, is_required: 0 } }))}
                      />
                      No
                    </label>
                  </div>
                </div>

                {fieldModal.editMode && (
                  <div>
                    <label className="form-label">Field Status</label>
                    <div className="options-group-horizontal">
                      <label className="custom-option-control">
                        <input
                          type="radio"
                          checked={fieldModal.data.is_enabled === 1}
                          onChange={() => setFieldModal(prev => ({ ...prev, data: { ...prev.data, is_enabled: 1 } }))}
                        />
                        Enabled
                      </label>
                      <label className="custom-option-control">
                        <input
                          type="radio"
                          checked={fieldModal.data.is_enabled === 0}
                          onChange={() => setFieldModal(prev => ({ ...prev, data: { ...prev.data, is_enabled: 0 } }))}
                        />
                        Disabled
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setFieldModal(prev => ({ ...prev, open: false }))}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Field</button>
            </div>
          </form>
        </div>
      )}
      {/* CONFIRMATION DIALOG MODAL */}
      <ConfirmModal
        open={confirmOpen}
        title={confirmData.title}
        message={confirmData.message}
        type={confirmData.type}
        onConfirm={confirmData.onConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
