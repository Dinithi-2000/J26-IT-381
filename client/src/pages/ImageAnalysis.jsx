import { LocalPhotoPreview } from '../components/ImageClassifierPanel';
import { Panel } from '../components/QualityUI';

// Standalone Model 01 photo check, separate from stored-sample monitoring and Model 02.
export default function ImageAnalysis() {
  return <Panel title="Cinnamon photo check" eyebrow="MODEL 01 / GOOD QUALITY VS SUSPECTED MOLD" className="classifier-panel">
    <p>Upload a cinnamon photo to check whether it looks good quality or shows suspected mold.</p>
    <LocalPhotoPreview />
  </Panel>;
}
