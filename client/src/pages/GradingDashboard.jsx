import { useMemo, useState } from 'react';
import { computeGradingStats, useGrading } from '../components/GradingProvider';
import Icon from '../components/Icon';
import {
  ALL_SUPPORTED_GRADES,
  FOUR_CLASS_GRADES,
  GRADE_COLORS,
  GRADE_DESCRIPTIONS,
  MODEL_HYBRID_7CLASS,
  MODEL_IMAGE_ONLY_4CLASS,
  SEVEN_CLASS_GRADES,
  formatGradingTimestamp,
  getRecordModelArchitecture,
  getRecordModelType,
} from '../data/demoGrading';

// Helper to determine confidence level class
function getConfidenceClass(conf) {
  if (conf == null) return '';
  if (conf >= 90) return 'confidence-high';
  if (conf >= 80) return 'confidence-med';
  return 'confidence-low';
}

// Summary Cards Component
export function GradingSummaryCards({ stats, modelFilter = 'ALL' }) {
  const { total, counts, topGrade, topGradeCount, topGradePercentage, avgConfidence, confidenceSampleCount, recentCount } = stats;

  const modelLabel =
    modelFilter === '4-CLASS'
      ? '4-Class Image-Only'
      : modelFilter === '7-CLASS'
      ? '7-Class Hybrid'
      : 'all mobile';

  return (
    <section className="grading-summary-cards" aria-label="Grading Summary Statistics">
      {/* 1. Total Graded Samples */}
      <article className="grading-card">
        <div className="grading-card-header">
          <span>Total Graded Samples</span>
          <span className="grading-card-icon"><Icon name="sample" size={20} /></span>
        </div>
        <p className="grading-card-value">
          {total > 0 ? total.toLocaleString() : '0'}
          {total > 0 && <small>quills</small>}
        </p>
        <p className="grading-card-note">
          {total > 0 ? `Evaluated across ${modelLabel} records` : 'No grading records loaded'}
        </p>
      </article>

      {/* 2. Grade Distribution (Primary Grade & Spread) */}
      <article className="grading-card">
        <div className="grading-card-header">
          <span>Grade Distribution</span>
          <span className="grading-card-icon"><Icon name="trend" size={20} /></span>
        </div>
        <p className="grading-card-value">
          {topGrade ? (
            <>
              {topGrade}
              <small>{topGradePercentage}% share</small>
            </>
          ) : (
            '—'
          )}
        </p>
        <p className="grading-card-note">
          {topGrade
            ? `${topGradeCount} of ${total} quills (${Object.keys(counts).length} grades present)`
            : 'Distribution will appear when samples are loaded'}
        </p>
      </article>

      {/* 3. Average AI Confidence */}
      <article className="grading-card">
        <div className="grading-card-header">
          <span>Average AI Confidence</span>
          <span className="grading-card-icon"><Icon name="sparkles" size={20} /></span>
        </div>
        <p className="grading-card-value">
          {avgConfidence != null ? `${avgConfidence}%` : '—'}
        </p>
        <p className="grading-card-note">
          {confidenceSampleCount > 0
            ? `Derived from ${confidenceSampleCount} samples with scores`
            : 'Confidence scores unavailable'}
        </p>
      </article>

      {/* 4. Recently Graded Samples */}
      <article className="grading-card">
        <div className="grading-card-header">
          <span>Recently Graded</span>
          <span className="grading-card-icon"><Icon name="clock" size={20} /></span>
        </div>
        <p className="grading-card-value">
          {total > 0 ? recentCount : '0'}
          {total > 0 && <small>recent</small>}
        </p>
        <p className="grading-card-note">
          {stats.latestRecord
            ? `Latest: ${stats.latestRecord.id} (${stats.latestRecord.grade})`
            : 'No recent evaluations recorded'}
        </p>
      </article>
    </section>
  );
}

// Grade Distribution Chart Component
export function GradeDistributionChart({ records, modelFilter = 'ALL', onModelFilterChange }) {
  const activeModel = modelFilter || 'ALL';

  const vocabGrades = useMemo(() => {
    if (activeModel === '4-CLASS') return FOUR_CLASS_GRADES;
    if (activeModel === '7-CLASS') return SEVEN_CLASS_GRADES;
    return ALL_SUPPORTED_GRADES;
  }, [activeModel]);

  const relevantRecords = useMemo(() => {
    if (activeModel === '4-CLASS') {
      return records.filter(r => getRecordModelType(r) === MODEL_IMAGE_ONLY_4CLASS);
    }
    if (activeModel === '7-CLASS') {
      return records.filter(r => getRecordModelType(r) === MODEL_HYBRID_7CLASS);
    }
    return records;
  }, [records, activeModel]);

  const total = relevantRecords.length;

  const distribution = useMemo(() => {
    const counts = {};
    for (const g of vocabGrades) counts[g] = 0;
    for (const record of relevantRecords) {
      if (record.grade && counts[record.grade] !== undefined) {
        counts[record.grade]++;
      }
    }
    return vocabGrades.map(grade => {
      const count = counts[grade] || 0;
      const percentage = total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
      return {
        grade,
        count,
        percentage,
        color: GRADE_COLORS[grade] || '#52624C',
        isSpecial: grade === 'Special',
      };
    });
  }, [relevantRecords, vocabGrades, total]);

  return (
    <section className="distribution-panel" aria-label="Grade Distribution Analysis">
      <div className="distribution-header">
        <div>
          <h2>Grade Distribution Analysis</h2>
          <p className="eyebrow" style={{ margin: '4px 0 0' }}>
            SUPPORTING 4-CLASS IMAGE-ONLY (ALBA, C4, C5, SPECIAL) & 7-CLASS HYBRID (ALBA, C4, C5, EXTRA, H1, H2, M4)
          </p>
        </div>
        <div className="distribution-tabs" role="tablist" aria-label="Model view">
          <button
            type="button"
            role="tab"
            aria-selected={activeModel === 'ALL'}
            className={`distribution-tab ${activeModel === 'ALL' ? 'active' : ''}`}
            onClick={() => onModelFilterChange?.('ALL')}
          >
            All Models
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeModel === '4-CLASS'}
            className={`distribution-tab ${activeModel === '4-CLASS' ? 'active' : ''}`}
            onClick={() => onModelFilterChange?.('4-CLASS')}
          >
            4-Class Image-Only
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeModel === '7-CLASS'}
            className={`distribution-tab ${activeModel === '7-CLASS' ? 'active' : ''}`}
            onClick={() => onModelFilterChange?.('7-CLASS')}
          >
            7-Class Hybrid
          </button>
        </div>
      </div>

      {total === 0 ? (
        <div className="grading-empty-state" style={{ padding: '36px 20px', margin: 0 }}>
          <p style={{ margin: 0 }}>No grading records available for this model view. Synchronize records or enable demo data.</p>
        </div>
      ) : (
        <>
          <div className="distribution-bars">
            {distribution.map(item => (
              <div key={item.grade} className="distribution-bar-row">
                <div>
                  <span
                    className={`grade-badge grade-${item.grade.toLowerCase()}`}
                    title={GRADE_DESCRIPTIONS[item.grade] || item.grade}
                  >
                    {item.isSpecial ? '★ ' : ''}
                    {item.grade}
                  </span>
                </div>
                <div className="distribution-track" title={`${item.grade}: ${item.count} quills (${item.percentage}%)`}>
                  <div
                    className="distribution-fill"
                    style={{
                      width: `${Math.max(item.percentage, item.count > 0 ? 3 : 0)}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
                <div className="distribution-stats">
                  {item.count} <small>({item.percentage.toFixed(1)}%)</small>
                </div>
              </div>
            ))}
          </div>

          <div className="distribution-legend">
            {distribution.map(item => (
              <span key={item.grade} className="distribution-legend-item">
                <i className="legend-swatch" style={{ backgroundColor: item.color }} />
                <strong>{item.grade}</strong>
                {item.isSpecial && <small style={{ color: '#92400E', fontWeight: 700 }}>(Distinct Special)</small>}
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

// Sample Details Modal Component
export function SampleDetailsModal({ record, onClose }) {
  if (!record) return null;

  const modelType = getRecordModelType(record);
  const architecture = getRecordModelArchitecture(record);

  return (
    <div
      className="modal-overlay"
      role="presentation"
      onClick={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-sample-title"
      >
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="eyebrow" style={{ margin: 0 }}>QUILLGRADE SAMPLE DETAILS</span>
            <h2 id="modal-sample-title">
              <span className="sample-id-code">{record.id}</span>
              <span className={`grade-badge grade-${record.grade?.toLowerCase()}`}>
                {record.grade === 'Special' ? '★ ' : ''}
                {record.grade || '—'}
              </span>
              <span className={`model-badge model-${modelType === MODEL_IMAGE_ONLY_4CLASS ? 'image-only' : 'hybrid'}`}>
                {modelType}
              </span>
            </h2>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close sample details dialog"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Key Sample Information Grid */}
          <div className="modal-grid">
            <div className="modal-metric-box modal-span-2">
              <span>Model Architecture</span>
              <strong style={{ fontSize: '0.92rem' }}>{architecture}</strong>
            </div>
            <div className="modal-metric-box">
              <span>Model Version</span>
              <strong className="model-version-tag">
                {record.modelVersion || (modelType === MODEL_IMAGE_ONLY_4CLASS ? 'image_only_4class_v1' : '—')}
              </strong>
            </div>
            <div className="modal-metric-box">
              <span>Predicted Grade</span>
              <strong>
                <span className={`grade-badge grade-${record.grade?.toLowerCase()}`}>
                  {record.grade === 'Special' ? '★ ' : ''}
                  {record.grade || '—'}
                </span>
              </strong>
            </div>
            <div className="modal-metric-box">
              <span>AI Confidence</span>
              <strong>{record.confidence != null ? `${record.confidence.toFixed(1)}%` : '— (Score unavailable)'}</strong>
            </div>
            <div className="modal-metric-box">
              <span>Diameter (mm)</span>
              <strong>
                {record.diameterMm != null
                  ? `${record.diameterMm.toFixed(1)} mm`
                  : modelType === MODEL_IMAGE_ONLY_4CLASS
                  ? '— (Not required for Image-Only)'
                  : '—'}
              </strong>
            </div>
            <div className="modal-metric-box">
              <span>Measurement Provenance</span>
              <strong>
                {record.diameterSource && record.diameterSource !== 'Not Available' && record.diameterSource !== 'Not Applicable' ? (
                  <span className={`source-badge source-${record.diameterSource.toLowerCase().replace(/\s+/g, '-')}`}>
                    {record.diameterSource}
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-secondary, #52624C)', fontWeight: 400 }}>
                    {modelType === MODEL_IMAGE_ONLY_4CLASS ? 'Not required (Image-Only)' : 'Not captured'}
                  </span>
                )}
              </strong>
            </div>
            <div className="modal-metric-box">
              <span>Evaluation Date & Time</span>
              <strong>{formatGradingTimestamp(record.timestamp)}</strong>
            </div>
            <div className="modal-metric-box">
              <span>Confirmed Sync Status</span>
              <strong>
                <span className={`sync-status-badge sync-${(record.syncStatus || 'local').toLowerCase().replace(/\s+/g, '-')}`}>
                  <i className="sync-dot" />
                  {record.syncStatus || '—'}
                </span>
                {record.syncTimestamp && (
                  <small style={{ display: 'block', fontWeight: 400, marginTop: '4px', fontSize: '0.78rem', color: '#52624C' }}>
                    Synced: {formatGradingTimestamp(record.syncTimestamp)}
                  </small>
                )}
              </strong>
            </div>
            <div className="modal-metric-box">
              <span>Capture Device / Engine</span>
              <strong>{record.device || '—'}</strong>
            </div>
            <div className="modal-metric-box">
              <span>Harvest Batch Code</span>
              <strong>{record.batchId || '—'}</strong>
            </div>
          </div>

          {/* Captured Photos: Side and End Views */}
          <h3 className="modal-photos-heading">
            <Icon name="camera" size={20} />
            Captured Sample Photographs
          </h3>
          <div className="modal-photos-grid">
            {/* Side Photo */}
            <figure className="modal-photo-card">
              <div className="modal-photo-img-wrap">
                {record.sideImageUrl ? (
                  <img src={record.sideImageUrl} alt={`Side photograph of quill sample ${record.id}`} />
                ) : (
                  <div className="modal-photo-placeholder">
                    <Icon name="camera" size={28} />
                    <span>No side photo recorded (Single-angle evaluation)</span>
                  </div>
                )}
              </div>
              <figcaption className="modal-photo-caption">
                <strong>Side Photo (Length & Bark Profile)</strong>
                <span>{record.sideImageUrl ? 'Optical camera capture' : 'Not captured for this evaluation'}</span>
              </figcaption>
            </figure>

            {/* End Photo */}
            <figure className="modal-photo-card">
              <div className="modal-photo-img-wrap">
                {record.endImageUrl ? (
                  <img src={record.endImageUrl} alt={`End cross-section photograph of quill sample ${record.id}`} />
                ) : (
                  <div className="modal-photo-placeholder">
                    <Icon name="camera" size={28} />
                    <span>No end photo recorded (Single-angle evaluation)</span>
                  </div>
                )}
              </div>
              <figcaption className="modal-photo-caption">
                <strong>End Photo (Cross-Section & Density)</strong>
                <span>{record.endImageUrl ? 'Optical camera capture' : 'Not captured for this evaluation'}</span>
              </figcaption>
            </figure>
          </div>

          {/* Notes */}
          {record.notes && (
            <div className="modal-notes-box">
              <strong>Sample Notes & Observations</strong>
              <p style={{ margin: '6px 0 0' }}>{record.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Main GradingDashboard Component
export default function GradingDashboard() {
  const {
    records,
    status,
    error,
    selectedRecord,
    setSelectedRecord,
    refresh,
    demoEnabled,
    setDemoEnabled,
  } = useGrading();

  // Filters and search state
  const [searchQuery, setSearchQuery] = useState('');
  const [modelFilter, setModelFilter] = useState('ALL'); // 'ALL' | '4-CLASS' | '7-CLASS'
  const [gradeFilter, setGradeFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('newest');

  // Handle model filter change and reset grade if invalid for model
  function handleModelFilterChange(newModel) {
    setModelFilter(newModel);
    if (newModel === '4-CLASS' && !FOUR_CLASS_GRADES.includes(gradeFilter)) {
      setGradeFilter('ALL');
    }
    if (newModel === '7-CLASS' && !SEVEN_CLASS_GRADES.includes(gradeFilter)) {
      setGradeFilter('ALL');
    }
  }

  // Model-filtered subset for summary cards and chart consistency
  const modelFilteredRecords = useMemo(() => {
    if (modelFilter === '4-CLASS') {
      return records.filter(r => getRecordModelType(r) === MODEL_IMAGE_ONLY_4CLASS);
    }
    if (modelFilter === '7-CLASS') {
      return records.filter(r => getRecordModelType(r) === MODEL_HYBRID_7CLASS);
    }
    return records;
  }, [records, modelFilter]);

  // Derived stats matching current model filter
  const modelStats = useMemo(() => {
    return computeGradingStats(modelFilteredRecords);
  }, [modelFilteredRecords]);

  // Filter and sort records for table display
  const filteredRecords = useMemo(() => {
    let result = [...modelFilteredRecords];

    // Search by Sample ID
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(r => r.id && r.id.toLowerCase().includes(q));
    }

    // Grade filter
    if (gradeFilter !== 'ALL') {
      result = result.filter(r => r.grade === gradeFilter);
    }

    // Date filter
    if (dateFilter !== 'ALL') {
      const now = Date.now();
      result = result.filter(r => {
        const time = new Date(r.timestamp).getTime();
        if (Number.isNaN(time)) return false;
        if (dateFilter === 'today') {
          const startOfToday = new Date();
          startOfToday.setHours(0, 0, 0, 0);
          return time >= startOfToday.getTime();
        }
        if (dateFilter === '7days') {
          return time >= now - 7 * 24 * 60 * 60 * 1000;
        }
        if (dateFilter === '30days') {
          return time >= now - 30 * 24 * 60 * 60 * 1000;
        }
        return true;
      });
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime();
      }
      if (sortBy === 'confidence-desc') {
        return (b.confidence || 0) - (a.confidence || 0);
      }
      if (sortBy === 'confidence-asc') {
        return (a.confidence || 0) - (b.confidence || 0);
      }
      if (sortBy === 'diameter-desc') {
        return (b.diameterMm || 0) - (a.diameterMm || 0);
      }
      return 0;
    });

    return result;
  }, [modelFilteredRecords, searchQuery, gradeFilter, dateFilter, sortBy]);

  const hasActiveFilters =
    searchQuery.trim() !== '' || modelFilter !== 'ALL' || gradeFilter !== 'ALL' || dateFilter !== 'ALL';

  function resetFilters() {
    setSearchQuery('');
    setModelFilter('ALL');
    setGradeFilter('ALL');
    setDateFilter('ALL');
  }

  return (
    <div className="grading-page-container">
      {/* 1. Summary Cards (consistently reflects selected model) */}
      <GradingSummaryCards stats={modelStats} modelFilter={modelFilter} />

      {/* 2. Grade Distribution Chart (synchronized with model filter) */}
      <GradeDistributionChart
        records={records}
        modelFilter={modelFilter}
        onModelFilterChange={handleModelFilterChange}
      />

      {/* 3. Filter and Search Toolbar */}
      <section className="grading-toolbar" aria-label="Results Filter and Search">
        <div className="grading-filters-group">
          {/* Search by Sample ID */}
          <div className="search-box">
            <Icon name="search" size={17} />
            <input
              type="text"
              id="grading-search-input"
              placeholder="Search by Sample ID (e.g. QG-2026)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              aria-label="Search grading results by Sample ID"
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                <Icon name="close" size={14} />
              </button>
            )}
          </div>

          {/* Model filter */}
          <select
            className="filter-select"
            value={modelFilter}
            onChange={e => handleModelFilterChange(e.target.value)}
            aria-label="Filter by AI Model"
          >
            <option value="ALL">All Models (4-Class & 7-Class)</option>
            <option value="4-CLASS">4-Class Image-Only</option>
            <option value="7-CLASS">7-Class Hybrid</option>
          </select>

          {/* Grade filter */}
          <select
            className="filter-select"
            value={gradeFilter}
            onChange={e => setGradeFilter(e.target.value)}
            aria-label="Filter by Grade"
          >
            <option value="ALL">
              {modelFilter === '4-CLASS'
                ? 'All 4-Class Grades'
                : modelFilter === '7-CLASS'
                ? 'All 7-Class Grades'
                : 'All Grades'}
            </option>
            {modelFilter === '4-CLASS' ? (
              FOUR_CLASS_GRADES.map(g => (
                <option key={g} value={g}>
                  {g === 'Special' ? 'Special (Distinct)' : g}
                </option>
              ))
            ) : modelFilter === '7-CLASS' ? (
              SEVEN_CLASS_GRADES.map(g => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))
            ) : (
              <>
                <optgroup label="4-Class Image-Only Vocabulary">
                  <option value="ALBA">ALBA</option>
                  <option value="C4">C4</option>
                  <option value="C5">C5</option>
                  <option value="Special">Special (Distinct)</option>
                </optgroup>
                <optgroup label="7-Class Hybrid Vocabulary">
                  <option value="EXTRA">EXTRA</option>
                  <option value="H1">H1</option>
                  <option value="H2">H2</option>
                  <option value="M4">M4</option>
                </optgroup>
              </>
            )}
          </select>

          {/* Date filter */}
          <select
            className="filter-select"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            aria-label="Filter by Date"
          >
            <option value="ALL">All Time</option>
            <option value="today">Today</option>
            <option value="7days">Past 7 Days</option>
            <option value="30days">Past 30 Days</option>
          </select>

          {/* Sort selector */}
          <select
            className="filter-select"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            aria-label="Sort grading records"
          >
            <option value="newest">Sort: Newest First</option>
            <option value="oldest">Sort: Oldest First</option>
            <option value="confidence-desc">Sort: Confidence (High → Low)</option>
            <option value="confidence-asc">Sort: Confidence (Low → High)</option>
            <option value="diameter-desc">Sort: Diameter (Largest First)</option>
          </select>
        </div>

        <div className="toolbar-meta">
          <span className="results-count">
            Showing <strong>{filteredRecords.length}</strong> of {records.length} samples
          </span>
          {hasActiveFilters && (
            <button type="button" className="clear-btn" onClick={resetFilters}>
              <Icon name="close" size={14} /> Clear filters
            </button>
          )}
        </div>
      </section>

      {/* 4. Results Section: Table or States */}
      <section className="grading-results-panel" aria-label="Grading Results">
        <div className="results-header">
          <div>
            <h2>Mobile Grading Results</h2>
            <p className="eyebrow" style={{ margin: '4px 0 0' }}>
              OFFLINE ON-DEVICE INFERENCE (4-CLASS IMAGE-ONLY & 7-CLASS HYBRID)
            </p>
          </div>
        </div>

        {/* Loading State */}
        {status === 'loading' && (
          <div className="grading-empty-state" role="status" aria-live="polite">
            <div className="grading-empty-icon">
              <Icon name="refresh" size={28} />
            </div>
            <h3>Checking Mobile Grading Sync...</h3>
            <p>Connecting to the grading integration boundary and checking for synchronized samples.</p>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div className="grading-empty-state" role="alert">
            <div className="grading-empty-icon" style={{ background: '#FEE2E2', color: '#DC2626' }}>
              <Icon name="info" size={28} />
            </div>
            <h3>Unable to Read Mobile Grading Data</h3>
            <p>{error || 'An unexpected error occurred while loading mobile grading records.'}</p>
            <button type="button" className="button secondary" onClick={refresh}>
              <Icon name="refresh" size={16} /> Check availability again
            </button>
          </div>
        )}

        {/* Meaningful Empty / Disconnected State */}
        {(status === 'disconnected' || status === 'empty') && (
          <div className="grading-empty-state" role="status">
            <div className="grading-empty-icon">
              <Icon name="mobile" size={28} />
            </div>
            <h3>No Mobile Grading Records Synchronized</h3>
            <p>
              The QuillGrade smartphone application performs offline AI grading in the field.
              Synchronized grading records will appear here once the mobile sync endpoint is connected.
              You can explore the complete grading interface, distribution chart, and sample details by enabling <strong>Demo data</strong> in the banner above.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button type="button" className="button secondary" onClick={refresh}>
                <Icon name="refresh" size={16} /> Refresh connection
              </button>
              <button
                type="button"
                className="button"
                id="explore-demo-btn"
                onClick={() => setDemoEnabled(true)}
              >
                Explore demo data →
              </button>
            </div>
          </div>
        )}

        {/* Active Records: Table View */}
        {(status === 'ready' || status === 'demo') && (
          <>
            {demoEnabled && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#FDF8F0',
                  border: '1px solid #F5E6D3',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  marginBottom: '16px',
                  fontSize: '0.85rem',
                  color: '#8A532B',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <span>
                  <strong>SIMULATED DEMO DATA MODE:</strong> Displaying {records.length} illustrative mobile grading samples across 4-Class Image-Only and 7-Class Hybrid models.
                </span>
                <button
                  type="button"
                  className="clear-btn"
                  style={{ background: '#FFF7ED', borderColor: '#FED7AA', color: '#9A3412', cursor: 'pointer' }}
                  onClick={() => setDemoEnabled(false)}
                >
                  Return to live sync state (empty)
                </button>
              </div>
            )}
            {filteredRecords.length === 0 ? (
              <div className="grading-empty-state" style={{ margin: '20px 0' }}>
                <div className="grading-empty-icon">
                  <Icon name="search" size={26} />
                </div>
                <h3>No Matching Samples Found</h3>
                <p>No grading samples match your current filter and search criteria.</p>
                <button type="button" className="button secondary" onClick={resetFilters}>
                  Clear all filters
                </button>
              </div>
            ) : (
              <div
                className="table-wrap"
                tabIndex={0}
                role="region"
                aria-label="Cinnamon Quill Grading Results Table"
              >
                <table className="grading-table">
                  <thead>
                    <tr>
                      <th scope="col">Sample ID</th>
                      <th scope="col">Predicted Grade</th>
                      <th scope="col">Confidence</th>
                      <th scope="col">Model Type</th>
                      <th scope="col">Diameter (mm)</th>
                      <th scope="col">Measurement Source</th>
                      <th scope="col">Date</th>
                      <th scope="col">Sync Status</th>
                      <th scope="col" style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map(record => {
                      const recModelType = getRecordModelType(record);
                      return (
                        <tr key={record.id}>
                          {/* 1. Sample ID */}
                          <td>
                            <span className="sample-id-code">{record.id}</span>
                          </td>

                          {/* 2. Predicted Grade */}
                          <td>
                            <span className={`grade-badge grade-${record.grade?.toLowerCase()}`}>
                              {record.grade === 'Special' ? '★ ' : ''}
                              {record.grade || '—'}
                            </span>
                          </td>

                          {/* 3. Confidence */}
                          <td>
                            {record.confidence != null ? (
                              <span className={`confidence-pill ${getConfidenceClass(record.confidence)}`}>
                                <i className="confidence-dot" />
                                {record.confidence.toFixed(1)}%
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-secondary, #52624C)' }}>—</span>
                            )}
                          </td>

                          {/* 4. Model Type */}
                          <td>
                            <div className="table-model-cell">
                              <span
                                className={`model-badge model-${
                                  recModelType === MODEL_IMAGE_ONLY_4CLASS ? 'image-only' : 'hybrid'
                                }`}
                              >
                                {recModelType}
                              </span>
                              <span className="table-model-version">
                                {record.modelVersion ||
                                  (recModelType === MODEL_IMAGE_ONLY_4CLASS ? 'image_only_4class_v1' : '—')}
                              </span>
                            </div>
                          </td>

                          {/* 5. Diameter (mm) - For image-only, show '—' if null */}
                          <td>
                            {record.diameterMm != null ? `${record.diameterMm.toFixed(1)} mm` : '—'}
                          </td>

                          {/* 6. Measurement Source */}
                          <td>
                            {record.diameterSource &&
                            record.diameterSource !== 'Not Available' &&
                            record.diameterSource !== 'Not Applicable' ? (
                              <span className={`source-badge source-${record.diameterSource.toLowerCase().replace(/\s+/g, '-')}`}>
                                {record.diameterSource}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-secondary, #52624C)' }}>—</span>
                            )}
                          </td>

                          {/* 7. Date */}
                          <td>
                            <span>{formatGradingTimestamp(record.timestamp)}</span>
                          </td>

                          {/* 8. Sync Status */}
                          <td>
                            {record.syncStatus ? (
                              <span className={`sync-status-badge sync-${record.syncStatus.toLowerCase().replace(/\s+/g, '-')}`}>
                                <i className="sync-dot" />
                                {record.syncStatus}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>

                          {/* 9. View Details Action */}
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="view-details-btn"
                              onClick={() => setSelectedRecord(record)}
                              aria-label={`View details for sample ${record.id}`}
                            >
                              <Icon name="eye" size={15} />
                              View Details
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      {/* 5. Details Modal (when sample selected) */}
      {selectedRecord && (
        <SampleDetailsModal
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
        />
      )}
    </div>
  );
}

