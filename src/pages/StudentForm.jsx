import React, { useState, useEffect } from 'react';
import { useToast } from '../App';
import ReviewForm from './ReviewForm';

export default function StudentForm({ navigate }) {
  const [loading, setLoading] = useState(true);
  const [schema, setSchema] = useState([]);
  const [collegeInfo, setCollegeInfo] = useState(null);
  const [currentStep, setCurrentStep] = useState(0); // Index of sections, last index is Review
  const [formData, setFormData] = useState({}); // { [fieldId]: value }
  const [errors, setErrors] = useState({}); // { [fieldId]: errorMessage }
  const [aadhaarChecking, setAadhaarChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { showToast } = useToast();

  // Load schema and settings
  useEffect(() => {
    const selectedCourseId = window.history.state?.courseId;
    if (!selectedCourseId) {
      showToast('Please select a course to start the application.', 'error');
      navigate('/');
      return;
    }

    Promise.all([
      fetch('/api/public/form-schema').then(res => res.json()),
      fetch('/api/public/settings').then(res => res.json())
    ])
      .then(([schemaData, settingsData]) => {
        // Filter out any course_dropdown type fields from schemaData since it is selected at the start
        const filteredSchema = schemaData.map(section => ({
          ...section,
          fields: section.fields.filter(field => field.type !== 'course_dropdown')
        })).filter(section => section.fields.length > 0); // remove empty sections

        // Initialize form fields with empty values
        const initialData = {};
        filteredSchema.forEach(section => {
          section.fields.forEach(field => {
            if (field.type === 'checkbox') {
              initialData[field.id] = [];
            } else {
              initialData[field.id] = '';
            }
          });
        });
        setFormData(initialData);
        setSchema(filteredSchema);
        setCollegeInfo(settingsData);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        showToast('Error loading form configuration. Please refresh.', 'error');
        setLoading(false);
      });
  }, [navigate]);

  if (loading) {
    return (
      <div className="main-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '2rem' }}>
        <div className="skeleton skeleton-title" style={{ width: '40%' }}></div>
        <div className="skeleton skeleton-input"></div>
        <div className="skeleton skeleton-input"></div>
        <div className="skeleton skeleton-input" style={{ height: '100px' }}></div>
      </div>
    );
  }

  // Find dynamic sections and fields
  const totalSections = schema.length;
  const isReviewStep = currentStep === totalSections;
  const currentSection = schema[currentStep];

  // Progress calculations
  const progressPercent = Math.round((currentStep / totalSections) * 100);

  // Validation function for a single field
  const validateField = (field, value) => {
    if (field.is_required && (!value || (Array.isArray(value) && value.length === 0))) {
      return `${field.label} is required.`;
    }

    if (value) {
      if (field.type === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) return 'Please enter a valid email address.';
      }

      if (field.type === 'mobile') {
        const mobileRegex = /^\d{10}$/;
        if (!mobileRegex.test(value)) return 'Please enter a valid 10-digit mobile number.';
      }

      if (field.validation_regex) {
        try {
          const customRegex = new RegExp(field.validation_regex);
          if (!customRegex.test(value)) {
            return `Please enter a valid value.`;
          }
        } catch (e) {
          console.error('Invalid regex configuration:', field.validation_regex);
        }
      }
    }
    return '';
  };

  // Handle value change
  const handleInputChange = (fieldId, value) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
    // Clear error on typing
    if (errors[fieldId]) {
      setErrors(prev => ({ ...prev, [fieldId]: '' }));
    }
  };

  // Blur validation
  const handleInputBlur = async (field, value) => {
    const errorMsg = validateField(field, value);
    setErrors(prev => ({ ...prev, [field.id]: errorMsg }));

    // Special verification: Aadhaar Number duplicate check on blur
    const isAadhaarField = field.type === 'number' && field.label.toLowerCase().includes('aadhaar');
    if (isAadhaarField && value && /^\d{12}$/.test(value) && !errorMsg) {
      setAadhaarChecking(true);
      try {
        const res = await fetch(`/api/public/check-aadhaar/${value}`);
        const data = await res.json();
        if (data.exists) {
          setErrors(prev => ({
            ...prev,
            [field.id]: `An application has already been submitted using this Aadhaar Number (${data.application_number}).`
          }));
          showToast('Duplicate Aadhaar detected.', 'error');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setAadhaarChecking(false);
      }
    }
  };

  // Validate all fields in the current section
  const validateCurrentSection = () => {
    if (!currentSection) return true;
    const newErrors = {};
    let isValid = true;

    currentSection.fields.forEach(field => {
      const value = formData[field.id];
      const errorMsg = validateField(field, value);
      if (errorMsg) {
        newErrors[field.id] = errorMsg;
        isValid = false;
      }
    });

    setErrors(prev => ({ ...prev, ...newErrors }));
    return isValid;
  };

  const handleNext = () => {
    if (validateCurrentSection()) {
      setCurrentStep(prev => prev + 1);
      window.scrollTo(0, 0);
    } else {
      showToast('Please fix validation errors before moving to the next section.', 'error');
    }
  };

  const handlePrev = () => {
    setCurrentStep(prev => Math.max(0, prev - 1));
    window.scrollTo(0, 0);
  };

  // Handle final submission
  const handleSubmit = async () => {
    const selectedCourseId = window.history.state?.courseId;
    const selectedCourseName = window.history.state?.courseName || 'Selected Course';

    if (!selectedCourseId) {
      showToast('Please select a course to start the application.', 'error');
      navigate('/');
      return;
    }

    // 1. Locate Aadhaar field dynamically
    let aadhaarField = null;

    schema.forEach(section => {
      section.fields.forEach(field => {
        if (field.type === 'number' && field.label.toLowerCase().includes('aadhaar')) {
          aadhaarField = field;
        }
      });
    });

    if (!aadhaarField) {
      showToast('Aadhaar field configuration is missing. Contact Admin.', 'error');
      return;
    }

    const aadhaarValue = formData[aadhaarField.id];

    if (!aadhaarValue || !/^\d{12}$/.test(aadhaarValue)) {
      showToast('Please enter a valid 12-digit Aadhaar Number.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/public/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: parseInt(selectedCourseId),
          aadhaar_number: aadhaarValue,
          fields: formData
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit application.');
      }

      showToast('Application submitted successfully!', 'success');
      
      // Navigate to success page with application number
      navigate('/success', {
        applicationNumber: result.applicationNumber,
        collegeName: collegeInfo?.settings?.college_name,
        collegeAddress: collegeInfo?.settings?.college_address,
        studentName: formData[schema[0].fields[0].id] || 'Student', // First field of first section is name
        courseName: selectedCourseName,
        timestamp: new Date().toLocaleString()
      });
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const renderFieldInput = (field) => {
    const value = formData[field.id];
    const hasError = !!errors[field.id];
    const inputId = `field-${field.id}`;

    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            id={inputId}
            className={`form-control ${hasError ? 'is-invalid' : ''}`}
            placeholder={field.placeholder}
            value={value}
            required={field.is_required === 1}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            onBlur={() => handleInputBlur(field, value)}
          />
        );

      case 'dropdown':
      case 'course_dropdown':
        return (
          <select
            id={inputId}
            className={`form-control ${hasError ? 'is-invalid' : ''}`}
            value={value}
            required={field.is_required === 1}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            onBlur={() => handleInputBlur(field, value)}
          >
            <option value="">{field.placeholder || '-- Select Option --'}</option>
            {field.options.map((opt, i) => (
              <option key={i} value={field.type === 'course_dropdown' ? opt.id : opt}>
                {field.type === 'course_dropdown' ? opt.name : opt}
              </option>
            ))}
          </select>
        );

      case 'radio':
        return (
          <div className="options-group-horizontal">
            {field.options.map((opt, i) => (
              <label key={i} className="custom-option-control">
                <input
                  type="radio"
                  name={`radio-group-${field.id}`}
                  value={opt}
                  checked={value === opt}
                  required={field.is_required === 1}
                  onChange={() => handleInputChange(field.id, opt)}
                  onBlur={() => handleInputBlur(field, value)}
                />
                {opt}
              </label>
            ))}
          </div>
        );

      case 'checkbox':
        return (
          <div className="options-group-vertical">
            {field.options.map((opt, i) => {
              const isChecked = Array.isArray(value) && value.includes(opt);
              return (
                <label key={i} className="custom-option-control">
                  <input
                    type="checkbox"
                    name={`checkbox-group-${field.id}`}
                    value={opt}
                    checked={isChecked}
                    onChange={(e) => {
                      let updatedVal = Array.isArray(value) ? [...value] : [];
                      if (e.target.checked) {
                        updatedVal.push(opt);
                      } else {
                        updatedVal = updatedVal.filter(v => v !== opt);
                      }
                      handleInputChange(field.id, updatedVal);
                    }}
                    onBlur={() => handleInputBlur(field, value)}
                  />
                  {opt}
                </label>
              );
            })}
          </div>
        );

      case 'email':
        return (
          <input
            id={inputId}
            type="email"
            className={`form-control ${hasError ? 'is-invalid' : ''}`}
            placeholder={field.placeholder}
            value={value}
            required={field.is_required === 1}
            autocomplete="email"
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            onBlur={() => handleInputBlur(field, value)}
          />
        );

      case 'mobile':
        return (
          <input
            id={inputId}
            type="tel"
            className={`form-control ${hasError ? 'is-invalid' : ''}`}
            placeholder={field.placeholder}
            value={value}
            required={field.is_required === 1}
            autocomplete="tel"
            inputmode="numeric"
            pattern="\d{10}"
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            onBlur={() => handleInputBlur(field, value)}
          />
        );

      case 'date':
        return (
          <input
            id={inputId}
            type="date"
            className={`form-control ${hasError ? 'is-invalid' : ''}`}
            value={value}
            required={field.is_required === 1}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            onBlur={() => handleInputBlur(field, value)}
          />
        );

      case 'number':
        return (
          <input
            id={inputId}
            type="text"
            className={`form-control ${hasError ? 'is-invalid' : ''}`}
            placeholder={field.placeholder}
            value={value}
            required={field.is_required === 1}
            inputmode="numeric"
            onChange={(e) => {
              // Ensure numeric input
              const val = e.target.value.replace(/\D/g, '');
              handleInputChange(field.id, val);
            }}
            onBlur={() => handleInputBlur(field, value)}
          />
        );

      case 'text':
      default:
        return (
          <input
            id={inputId}
            type="text"
            className={`form-control ${hasError ? 'is-invalid' : ''}`}
            placeholder={field.placeholder}
            value={value}
            required={field.is_required === 1}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            onBlur={() => handleInputBlur(field, value)}
          />
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Sticky Progress Bar */}
      <div className="sticky-progress-container">
        <div className="progress-header">
          <span className="progress-title">
            {isReviewStep ? 'Review & Verification' : `Step ${currentStep + 1} of ${totalSections}: ${currentSection.name}`}
          </span>
          <span className="progress-percent">{progressPercent}% Completed</span>
        </div>
        <div className="progress-bar-bg">
          <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }}></div>
        </div>
        
        {/* Step node indicators (hidden on small viewports) */}
        <div className="steps-tracker">
          {schema.map((sec, idx) => (
            <button
              key={sec.id}
              className={`step-node ${currentStep === idx ? 'active' : currentStep > idx ? 'completed' : ''}`}
              onClick={() => {
                // Allow jumping to steps we already completed/validated
                if (idx < currentStep) {
                  setCurrentStep(idx);
                } else if (idx === currentStep) {
                  // Do nothing
                } else {
                  // Validate current and intermediate steps
                  let canJump = true;
                  for (let i = currentStep; i < idx; i++) {
                    // Temporarily set step and check validation
                    setCurrentStep(i);
                    const isValid = validateCurrentSection();
                    if (!isValid) {
                      canJump = false;
                      showToast('Please fix errors in previous steps before jumping.', 'error');
                      break;
                    }
                  }
                  if (canJump) {
                    setCurrentStep(idx);
                  }
                }
              }}
            >
              <div className="step-circle">{idx + 1}</div>
              <span className="step-label">{sec.name}</span>
            </button>
          ))}
          <button
            className={`step-node ${isReviewStep ? 'active' : ''}`}
            onClick={() => {
              let canJump = true;
              for (let i = currentStep; i < totalSections; i++) {
                setCurrentStep(i);
                if (!validateCurrentSection()) {
                  canJump = false;
                  showToast('Please fix errors in form steps first.', 'error');
                  break;
                }
              }
              if (canJump) {
                setCurrentStep(totalSections);
              }
            }}
          >
            <div className="step-circle">✓</div>
            <span className="step-label">Review</span>
          </button>
        </div>
      </div>

      <main className="main-content">
        {isReviewStep ? (
          <div className="card">
            <h2 className="form-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Review Form Submissions</span>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-medium)', fontWeight: 'normal' }}>Double check before final submit</span>
            </h2>
            <ReviewForm schema={schema} formData={formData} onStepNavigate={(stepIdx) => setCurrentStep(stepIdx)} />
            
            <div className="form-navigation" style={{ marginTop: '3rem' }}>
              <button className="btn btn-secondary" onClick={handlePrev} disabled={submitting}>
                Back to Declaration
              </button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting || aadhaarChecking}>
                {submitting ? 'Submitting Application...' : 'Confirm & Submit Application'}
              </button>
            </div>
          </div>
        ) : (
          <div className="card">
            <h2 className="form-section-title">{currentSection.name}</h2>
            <fieldset className="form-fieldset">
              {currentSection.fields.map(field => (
                <div key={field.id} className="form-group">
                  <label htmlFor={`field-${field.id}`} className="form-label">
                    {field.label}
                    {field.is_required === 1 && <span className="required-indicator">*</span>}
                  </label>
                  
                  {renderFieldInput(field)}
                  
                  {errors[field.id] && (
                    <span className="error-message" role="alert">
                      {errors[field.id]}
                    </span>
                  )}
                  
                  {field.help_text && !errors[field.id] && (
                    <span className="form-help-text">
                      {field.help_text}
                    </span>
                  )}
                </div>
              ))}
            </fieldset>
            
            <div className="form-navigation">
              {currentStep > 0 ? (
                <button className="btn btn-secondary" onClick={handlePrev}>
                  Previous
                </button>
              ) : (
                <button className="btn btn-secondary" onClick={() => navigate('/')}>
                  Cancel
                </button>
              )}
              
              <button className="btn btn-primary" onClick={handleNext} disabled={aadhaarChecking}>
                {currentStep === totalSections - 1 ? 'Go to Review' : 'Next'}
              </button>
            </div>
          </div>
        )}
      </main>

      <footer style={{ marginTop: 'auto', backgroundColor: '#ffffff', borderTop: '1px solid var(--border-color)', padding: '1.5rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-medium)' }}>
        {collegeInfo?.settings?.footer_text || '© 2026 Gayatri Vidya Parishad. All Rights Reserved.'}
      </footer>
    </div>
  );
}
