import React from 'react';

export default function ReviewForm({ schema, formData, onStepNavigate }) {
  
  // Format the display value based on field type
  const formatDisplayValue = (field, rawValue) => {
    if (rawValue === undefined || rawValue === null || rawValue === '') {
      return <span style={{ color: 'var(--text-light)', fontStyle: 'italic' }}>Not Provided</span>;
    }

    if (field.type === 'checkbox') {
      if (Array.isArray(rawValue)) {
        return rawValue.length > 0 ? rawValue.join(', ') : <span style={{ color: 'var(--text-light)', fontStyle: 'italic' }}>Not Provided</span>;
      }
      try {
        const parsed = JSON.parse(rawValue);
        if (Array.isArray(parsed)) return parsed.join(', ');
      } catch (e) {}
    }

    if (field.type === 'course_dropdown') {
      // Find selected course name from option array
      const selectedCourse = field.options.find(c => String(c.id) === String(rawValue));
      return selectedCourse ? selectedCourse.name : rawValue;
    }

    return String(rawValue);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginTop: '1.5rem' }}>
      {schema.map((section, secIdx) => (
        <div key={section.id} className="review-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1.5px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            <h3 className="review-section-header" style={{ margin: 0 }}>
              {section.name}
            </h3>
            <button 
              type="button" 
              className="btn btn-secondary" 
              style={{ minHeight: '32px', height: '32px', padding: '0 0.75rem', fontSize: '0.8rem' }}
              onClick={() => onStepNavigate(secIdx)}
            >
              Edit Section
            </button>
          </div>

          <div className="review-grid">
            {section.fields.map(field => (
              <div key={field.id} className="review-item">
                <span className="review-item-label">{field.label}</span>
                <div className="review-item-value">
                  {formatDisplayValue(field, formData[field.id])}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
