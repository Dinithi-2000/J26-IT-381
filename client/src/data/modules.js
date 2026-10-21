// Official labels from the revised Phase 1 brief. Shared copy stays here.
export const modules = [
  {
    id: '01', title: 'Adaptive Dehydration Chamber with Remaining Drying Time Prediction',
    short: 'Adaptive dehydration', icon: '◉', stage: 'Monitor & dehydrate',
    description: 'Investigate sensor-guided drying, remaining drying time, and adaptive heater and fan control.',
    status: 'Integration-ready overview',
    features: ['Temperature, humidity & moisture monitoring', 'Remaining drying time prediction', 'Heater & fan operating status', 'Target moisture & drying progress', 'Historical drying charts', 'Automatic control status'],
  },
  {
    id: '02', title: 'AI-Based Multi-Quality Degradation Prediction of Stored Cinnamon',
    short: 'Stored quality', icon: '⌁', stage: 'Understand stored quality',
    description: 'Study stored cinnamon through weight, color, environmental sensing, and image observations.',
    status: 'Frontend with optional demo data',
  },
  {
    id: '03', title: 'Mobile-Based Edge AI for Cinnamon Grading',
    short: 'Mobile edge grading', icon: '◇', stage: 'Grade in the field',
    description: 'Support offline smartphone research into quill grade classification and thickness estimation.',
    status: 'QuillGrade dashboard with optional demo data',
    features: ['Cinnamon quill grade classification', 'Thickness estimation in millimeters', 'Image-based analysis', 'On-device AI inference', 'Offline smartphone operation', 'Field grading history & synchronization'],
  },
  {
    id: '04', title: 'GIS-Based Yield and Market Value Forecasting',
    short: 'GIS & market forecasts', icon: '↗', stage: 'Plan ahead',
    description: 'Connect future district-level yield research with the existing cinnamon price prediction workflow.',
    status: 'Price interface · GIS & yield planned',
  },
];
export const researchTitle = 'Smart Dehydration and Quality Preservation System for Cinnamon Processing';
