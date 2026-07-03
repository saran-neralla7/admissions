import React from 'react';

export default function SuccessPage({ navigate, applicationData }) {
  // Fallback default values if state was lost (e.g. on manual page refresh)
  const {
    applicationNumber = 'GEN-000',
    collegeName = 'GAYATRI VIDYA PARISHAD COLLEGE FOR DEGREE AND PG COURSES (AUTONOMOUS)',
    collegeAddress = 'Rushikonda, Visakhapatnam - 530045',
    studentName = 'Candidate',
    courseName = 'Selected Course',
    timestamp = new Date().toLocaleString()
  } = applicationData;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Print-only CSS style injection */}
      <style>{`
        .print-receipt {
          display: none;
        }
        @media print {
          body {
            background-color: #ffffff;
            color: #000000;
          }
          .no-print {
            display: none !important;
          }
          .print-receipt {
            display: block !important;
            border: 2px solid #000000;
            padding: 2.5rem;
            margin: 1.5rem auto;
            max-width: 650px;
            border-radius: 0 !important;
            box-shadow: none !important;
          }
          .print-receipt-header {
            text-align: center;
            border-bottom: 2px solid #000000;
            padding-bottom: 1.5rem;
            margin-bottom: 2rem;
          }
          .print-title {
            font-size: 1.5rem;
            font-weight: bold;
            margin-bottom: 0.5rem;
          }
          .print-subtitle {
            font-size: 1.1rem;
            margin-bottom: 0.25rem;
          }
          .receipt-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 1.5rem;
          }
          .receipt-table td {
            padding: 0.75rem;
            border-bottom: 1px solid #dddddd;
            font-size: 1rem;
          }
          .receipt-table td.label-col {
            font-weight: bold;
            width: 40%;
          }
          .print-footer {
            margin-top: 3rem;
            text-align: center;
            font-size: 0.85rem;
            border-top: 1px dashed #666;
            padding-top: 1.5rem;
          }
        }
      `}</style>

      {/* Screen view success card */}
      <main className="main-content no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
        <div className="card success-card" style={{ maxWidth: '650px', width: '100%' }}>
          <div className="success-icon-circle">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          
          <h2 className="success-title">Application Submitted Successfully</h2>
          <p className="success-message">
            Thank you, <strong>{studentName}</strong>. Your preliminary admission details have been recorded.
          </p>

          <div className="application-num-box">
            <div className="application-num-label">Your Application Number</div>
            <div className="application-num-value">{applicationNumber}</div>
          </div>

          <div style={{ backgroundColor: 'var(--primary-light)', padding: '1.25rem', borderRadius: 'var(--radius-md)', margin: '1.5rem 0', textAlign: 'left', borderLeft: '4px solid var(--primary)' }}>
            <h4 style={{ color: 'var(--primary)', marginBottom: '0.35rem', fontWeight: 700 }}>Important Instructions:</h4>
            <ul style={{ paddingLeft: '1.25rem', fontSize: '0.9rem', color: 'var(--text-medium)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <li>Please write down or save your Application Number for future reference.</li>
              <li>Click the "Print Receipt" button below to save/print your admission receipt.</li>
              <li>Bring a copy of this receipt and original certificates for document verification at the college office when notified.</li>
            </ul>
          </div>

          <div className="success-actions">
            <button className="btn btn-secondary" onClick={handlePrint}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.5rem' }}>
                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                <rect x="6" y="14" width="12" height="8"></rect>
              </svg>
              Print Receipt
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/')}>
              Go to Home Page
            </button>
          </div>
        </div>
      </main>

      {/* Print receipt template (neatly styled when printed, visible on print only) */}
      <div className="print-receipt">
        <div className="print-receipt-header">
          <h1 className="print-title" style={{ fontSize: '1.25rem', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{collegeName}</h1>
          <p className="print-subtitle" style={{ fontSize: '0.95rem', fontWeight: 600 }}>COLLEGE FOR DEGREE AND PG COURSES (AUTONOMOUS)</p>
          <p style={{ fontSize: '0.85rem', color: '#555' }}>{collegeAddress}</p>
        </div>

        <h3 style={{ textAlign: 'center', textTransform: 'uppercase', fontSize: '1.1rem', letterSpacing: '0.05em', marginBottom: '1.5rem', textDecoration: 'underline' }}>
          Admission Registration Acknowledgement
        </h3>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: '1rem 1.5rem', border: '1px solid #ccc', margin: '1rem 0' }}>
          <div>
            <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 'bold', color: '#666', display: 'block' }}>Application Number</span>
            <strong style={{ fontSize: '1.8rem', color: '#0b57d0' }}>{applicationNumber}</strong>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 'bold', color: '#666', display: 'block' }}>Registration Date</span>
            <span style={{ fontSize: '0.95rem', fontWeight: '600' }}>{timestamp}</span>
          </div>
        </div>

        <table className="receipt-table">
          <tbody>
            <tr>
              <td className="label-col">Candidate Name</td>
              <td>{studentName}</td>
            </tr>
            <tr>
              <td className="label-col">Course Applied For</td>
              <td>{courseName}</td>
            </tr>
            <tr>
              <td className="label-col">Registration Status</td>
              <td style={{ fontWeight: 'bold' }}>PENDING VERIFICATION</td>
            </tr>
          </tbody>
        </table>

        <div className="print-footer">
          <p style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Note to Candidate:</p>
          <p style={{ color: '#555', fontSize: '0.8rem', lineHeight: '1.4' }}>
            This receipt is an acknowledgement of your preliminary admission data registration. This does NOT guarantee admission or serve as an official college roll number. Official admissions are finalized at the college campus after document verification and payment of prescribed tuition fees.
          </p>
          <p style={{ marginTop: '2rem', fontSize: '0.85rem', fontWeight: 'bold' }}>Gayatri Vidya Parishad College Admissions Office</p>
        </div>
      </div>
    </div>
  );
}
