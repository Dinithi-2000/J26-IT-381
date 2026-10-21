// Explicitly simulated fixtures for Module 03: QuillGrade Mobile Edge AI Cinnamon Grading.
// Used only when demo mode is explicitly enabled by the user.

export const MODEL_IMAGE_ONLY_4CLASS = '4-Class Image-Only';
export const MODEL_HYBRID_7CLASS = '7-Class Hybrid';

export const FOUR_CLASS_GRADES = ['ALBA', 'C4', 'C5', 'Special'];
export const SEVEN_CLASS_GRADES = ['ALBA', 'C4', 'C5', 'EXTRA', 'H1', 'H2', 'M4'];
export const ALL_SUPPORTED_GRADES = ['ALBA', 'C4', 'C5', 'Special', 'EXTRA', 'H1', 'H2', 'M4'];

// Backwards-compatible aliases for existing references
export const NEW_MODEL_GRADES = FOUR_CLASS_GRADES;
export const LEGACY_MODEL_GRADES = SEVEN_CLASS_GRADES;

export const GRADE_COLORS = {
  ALBA: '#2D6A4F',
  C4: '#A85A2A',
  C5: '#2563EB',
  Special: '#D97706', // Distinct golden terracotta for Special
  EXTRA: '#7C3AED',
  H1: '#059669',
  H2: '#10B981',
  M4: '#9333EA',
};

export const GRADE_DESCRIPTIONS = {
  ALBA: 'Highest commercial grade. Slender, pencil-thin quills (< 6 mm diameter) with smooth pale bark.',
  C4: 'Continental medium grade. Compact quills (13–15 mm diameter) with tight rolling.',
  C5: 'Continental standard grade. Selected quills (10–12 mm diameter) with neat appearance.',
  Special: 'Continental premium selection. High-density, tight quills meeting strict export criteria.',
  EXTRA: 'Legacy premium grade with clean, select outer bark quills.',
  H1: 'Hamburg standard grade. Thicker coarse quills (up to 23 mm) suitable for grinding.',
  H2: 'Hamburg rough grade. Quills with minor blemishes and thicker bark layers.',
  M4: 'Mexican export grade. Medium thickness quills with slight rough texture.',
};

/**
 * Resolves the model type string for a given grading record.
 * Supports legacy vocabulary ('new' / 'legacy'), explicit modelType, or modelVersion tags.
 */
export function getRecordModelType(record) {
  if (!record) return 'Unknown';
  if (record.modelType) return record.modelType;
  if (
    record.vocabulary === 'new' ||
    record.vocabulary === 'image_only_4class' ||
    record.vocabulary === '4class' ||
    record.modelVersion === 'image_only_4class_v1'
  ) {
    return MODEL_IMAGE_ONLY_4CLASS;
  }
  if (
    record.vocabulary === 'legacy' ||
    record.vocabulary === 'hybrid_7class' ||
    record.vocabulary === '7class' ||
    record.modelVersion?.includes('legacy') ||
    record.modelVersion?.includes('hybrid')
  ) {
    return MODEL_HYBRID_7CLASS;
  }
  if (record.grade === 'Special') return MODEL_IMAGE_ONLY_4CLASS;
  if (['EXTRA', 'H1', 'H2', 'M4'].includes(record.grade)) return MODEL_HYBRID_7CLASS;
  return MODEL_IMAGE_ONLY_4CLASS;
}

/**
 * Returns a human-readable architecture description for modal inspection.
 */
export function getRecordModelArchitecture(record) {
  const modelType = getRecordModelType(record);
  if (modelType === MODEL_IMAGE_ONLY_4CLASS) {
    return '4-Class Image-Only (Deep Optical Surface Inspection)';
  }
  if (modelType === MODEL_HYBRID_7CLASS) {
    return '7-Class Hybrid (Multimodal Image + Caliper Feature Ingestion)';
  }
  return 'Standard Mobile Classification';
}

export const demoGradingRecords = [
  {
    id: 'QG-2026-001',
    grade: 'ALBA',
    vocabulary: 'new',
    confidence: 97.4,
    diameterMm: 5.4,
    diameterSource: 'AI',
    modelVersion: 'image_only_4class_v1',
    timestamp: '2026-10-21T06:45:00+05:30',
    syncStatus: 'Synced',
    syncTimestamp: '2026-10-21T06:46:12+05:30',
    device: 'Google Pixel 7 (TFLite FP32)',
    batchId: 'BATCH-MATARA-26A',
    sideImageUrl: '/images/cinnamon-hero.jpg',
    endImageUrl: '/images/cinnamon-botanical.jpg',
    notes: 'Slender, pencil-thin quill. Smooth pale tan surface with tight multilayer wrapping. Graded by 4-Class Image-Only model.',
  },
  {
    id: 'QG-2026-002',
    grade: 'Special',
    vocabulary: 'new',
    confidence: 94.8,
    diameterMm: 8.2,
    diameterSource: 'Caliper',
    modelVersion: 'image_only_4class_v1',
    timestamp: '2026-10-21T06:12:00+05:30',
    syncStatus: 'Synced',
    syncTimestamp: '2026-10-21T06:15:40+05:30',
    device: 'Samsung Galaxy S22',
    batchId: 'BATCH-GALLE-14C',
    sideImageUrl: '/images/cinnamon-spices.jpg',
    endImageUrl: '/images/cinnamon-hero.jpg',
    notes: 'Distinct Special grade. High density with strict Continental criteria. Caliper measurement logged as optional reference.',
  },
  {
    id: 'QG-2026-003',
    grade: 'C5',
    vocabulary: 'new',
    confidence: 91.2,
    diameterMm: null,
    diameterSource: null,
    modelVersion: 'image_only_4class_v1',
    timestamp: '2026-10-20T16:30:00+05:30',
    syncStatus: 'Synced',
    syncTimestamp: '2026-10-20T17:02:18+05:30',
    device: 'Redmi Note 12',
    batchId: 'BATCH-MATARA-26A',
    sideImageUrl: '/images/cinnamon-botanical.jpg',
    endImageUrl: null,
    notes: 'Well-rolled continental quill with uniform cylindrical shape. Graded directly from optical camera photo; diameter not required for Image-Only model.',
  },
  {
    id: 'QG-2026-004',
    grade: 'C4',
    vocabulary: 'new',
    confidence: 88.6,
    diameterMm: 14.5,
    diameterSource: 'AI',
    modelVersion: 'image_only_4class_v1',
    timestamp: '2026-10-20T14:15:00+05:30',
    syncStatus: 'Synced',
    syncTimestamp: '2026-10-20T14:22:05+05:30',
    device: 'Google Pixel 7 (TFLite FP32)',
    batchId: 'BATCH-KALUTARA-08',
    sideImageUrl: '/images/cinnamon-hero.jpg',
    endImageUrl: '/images/cinnamon-botanical.jpg',
    notes: 'Medium continental quill, clean edges with slight variation in bark hue. Graded by 4-Class Image-Only model.',
  },
  {
    id: 'QG-2026-005',
    grade: 'ALBA',
    vocabulary: 'new',
    confidence: 98.1,
    diameterMm: 5.1,
    diameterSource: 'Caliper',
    modelVersion: 'image_only_4class_v1',
    timestamp: '2026-10-20T11:05:00+05:30',
    syncStatus: 'Synced',
    syncTimestamp: '2026-10-20T11:10:00+05:30',
    device: 'Samsung Galaxy S22',
    batchId: 'BATCH-MATARA-26A',
    sideImageUrl: '/images/cinnamon-botanical.jpg',
    endImageUrl: '/images/cinnamon-spices.jpg',
    notes: 'Exemplary Alba quill. Optical inference verified; digital caliper check recorded as optional reference.',
  },
  {
    id: 'QG-2026-006',
    grade: 'Special',
    vocabulary: 'new',
    confidence: 93.5,
    diameterMm: null,
    diameterSource: null,
    modelVersion: 'image_only_4class_v1',
    timestamp: '2026-10-19T17:40:00+05:30',
    syncStatus: 'Synced',
    syncTimestamp: '2026-10-19T18:00:22+05:30',
    device: 'Redmi Note 12',
    batchId: 'BATCH-GALLE-14C',
    sideImageUrl: '/images/cinnamon-spices.jpg',
    endImageUrl: null,
    notes: 'Special selection with clean aroma and golden bark. Evaluated via 4-Class Image-Only AI without physical diameter input.',
  },
  {
    id: 'QG-2026-007',
    grade: 'EXTRA',
    vocabulary: 'legacy',
    confidence: 89.0,
    diameterMm: 12.8,
    diameterSource: 'AI',
    modelVersion: 'v1.1.0-legacy',
    timestamp: '2026-10-18T10:20:00+05:30',
    syncStatus: 'Synced',
    syncTimestamp: '2026-10-18T10:25:00+05:30',
    device: 'Pixel 6a (Legacy Mobile Model)',
    batchId: 'BATCH-LEGACY-01',
    sideImageUrl: '/images/cinnamon-hero.jpg',
    endImageUrl: '/images/cinnamon-botanical.jpg',
    notes: 'Processed using 7-Class Hybrid classification model combining optical image and quill diameter.',
  },
  {
    id: 'QG-2026-008',
    grade: 'H1',
    vocabulary: 'legacy',
    confidence: 85.2,
    diameterMm: 21.4,
    diameterSource: 'Caliper',
    modelVersion: 'v1.1.0-legacy',
    timestamp: '2026-10-17T15:50:00+05:30',
    syncStatus: 'Synced',
    syncTimestamp: '2026-10-17T16:00:00+05:30',
    device: 'Pixel 6a (Legacy Mobile Model)',
    batchId: 'BATCH-LEGACY-01',
    sideImageUrl: null,
    endImageUrl: '/images/cinnamon-spices.jpg',
    notes: 'Thick bark quill classified as Hamburg 1 by 7-Class Hybrid model.',
  },
  {
    id: 'QG-2026-009',
    grade: 'M4',
    vocabulary: 'legacy',
    confidence: 82.7,
    diameterMm: null,
    diameterSource: 'Not Available',
    modelVersion: 'v1.1.0-legacy',
    timestamp: '2026-10-16T12:10:00+05:30',
    syncStatus: 'Pending',
    syncTimestamp: null,
    device: 'Nokia G21 (Field Demo)',
    batchId: 'BATCH-LEGACY-02',
    sideImageUrl: null,
    endImageUrl: null,
    notes: 'Field estimation with single image capture; caliper measurement unavailable.',
  },
  {
    id: 'QG-2026-010',
    grade: 'H2',
    vocabulary: 'legacy',
    confidence: 79.4,
    diameterMm: 24.1,
    diameterSource: 'AI',
    modelVersion: 'v1.1.0-legacy',
    timestamp: '2026-10-15T09:30:00+05:30',
    syncStatus: 'Local Only',
    syncTimestamp: null,
    device: 'Redmi 9A (Offline Storage)',
    batchId: 'BATCH-LEGACY-02',
    sideImageUrl: '/images/cinnamon-botanical.jpg',
    endImageUrl: null,
    notes: 'Offline batch evaluation with 7-Class Hybrid model without cloud synchronization.',
  },
  {
    id: 'QG-2026-011',
    grade: 'C5',
    vocabulary: 'new',
    confidence: null,
    diameterMm: 10.8,
    diameterSource: 'Caliper',
    modelVersion: 'image_only_4class_v1',
    timestamp: '2026-10-14T14:45:00+05:30',
    syncStatus: 'Synced',
    syncTimestamp: '2026-10-14T15:00:10+05:30',
    device: 'Google Pixel 7 (TFLite FP32)',
    batchId: 'BATCH-MATARA-25',
    sideImageUrl: '/images/cinnamon-hero.jpg',
    endImageUrl: '/images/cinnamon-spices.jpg',
    notes: 'Graded by 4-Class Image-Only model with manual caliper cross-check; AI confidence score unavailable from sensor log.',
  },
  {
    id: 'QG-2026-012',
    grade: 'ALBA',
    vocabulary: 'new',
    confidence: 96.0,
    diameterMm: 5.7,
    diameterSource: 'AI',
    modelVersion: 'image_only_4class_v1',
    timestamp: '2026-10-13T11:20:00+05:30',
    syncStatus: 'Synced',
    syncTimestamp: '2026-10-13T11:22:15+05:30',
    device: 'Samsung Galaxy S22',
    batchId: 'BATCH-MATARA-25',
    sideImageUrl: '/images/cinnamon-botanical.jpg',
    endImageUrl: '/images/cinnamon-hero.jpg',
    notes: 'Superb Alba sample with smooth peel and uniform color. Graded by 4-Class Image-Only model.',
  },
];

export function formatGradingTimestamp(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Colombo',
    }).format(new Date(value)) + ' SLST';
  } catch {
    return value;
  }
}

