# CinnaSense AI — Phase 1

**Smart Cinnamon Processing & Quality Intelligence Platform**  
Project: J26-IT-381  
Research title: **Smart Dehydration and Quality Preservation System for Cinnamon Processing**

## Scope and modules

1. Adaptive Dehydration Chamber with Remaining Drying Time Prediction
2. AI-Based Multi-Quality Degradation Prediction of Stored Cinnamon
3. Mobile-Based Edge AI for Cinnamon Grading
4. GIS-Based Yield and Market Value Forecasting

These labels follow the latest revised development brief. Module 02 addresses **storage**, not the earlier in-process drying scope in the proposal presentation. Team names and student IDs on the homepage come from the supplied proposal presentation; individual module ownership has not been inferred.

Phase 1 delivers the website and frontend workflows only. It adds no database migrations, hardware ingestion endpoints, sensor connectivity, chamber controls, model training, or new prediction service.

## Architecture

- `client/`: existing React 19 + Vite frontend, React Router, reusable components, plain CSS, and local SVG imagery.
- `server/`: existing Express API and MongoDB prediction history, unchanged.
- `ml-service/`: existing FastAPI price prediction service, unchanged.

Module 04's original form, results, history, and API calls are retained in `PriceDashboard.jsx`. Its original CSS is scoped to `.price-module`. The new wrapper describes future GIS and yield capabilities without displaying fabricated outputs.

## Run locally

Use Node 20.19+ or a compatible Node 22 release. From the repository root:

```powershell
npm install
npm run dev --workspace client
```

Open **http://localhost:5173**. The common website and optional Module 02 demonstration work without backend services.

For a production build and local static preview:

```powershell
npm run build
npm run preview --workspace client
```

Production hosting must rewrite page routes such as `/module-02/samples/CIN-DEMO-001` to `index.html`. Vite's development `/api` proxy forwards to port 5000; production hosting needs its own `/api` routing. Static preview does not supply that backend proxy.

### Existing Module 04 services

Start MongoDB locally on port 27017, or configure `MONGODB_URI` in `server/.env`. Existing optional server settings include `PORT=5000`, `CLIENT_URL=http://localhost:5173`, and `ML_SERVICE_URL=http://127.0.0.1:8000`.

In a second terminal:

```powershell
npm run start --workspace server
```

Or use `npm run dev` from the root to launch both Vite and the Express development server.

For the existing ML service, in another terminal:

```powershell
python -m venv ml-service/.venv
.\ml-service\.venv\Scripts\python -m pip install -r ml-service/requirements.txt
.\ml-service\.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000 --app-dir ml-service
```

See `ml-service/README.md` and `ml-service/.env.example` for the existing price-model artifact configuration. That README notes that supplied artifacts require valid binary re-exports from the training environment. A successful saved price prediction requires MongoDB and a healthy ML service with valid artifacts. No fallback prices are generated.

## Routes

| Route | Page |
| --- | --- |
| `/` | Branded research homepage, workflow, technology, objectives and team |
| `/module-01` | Adaptive dehydration workspace: telemetry, RDT, process trends and events |
| `/module-01/sessions` | Drying experiment history |
| `/module-01/sessions/:batchId` | Session conditions, weight, estimated moisture, RDT and relay history |
| `/module-01/rdt` | Experimental RDT inputs, prediction availability and evaluation placeholders |
| `/module-01/analytics` | Recorded drying trends and batch comparison |
| `/module-01/controls` | Offline settings and explicitly simulated demo relay controls |
| `/module-02` | Stored-quality overview and measurement trends |
| `/module-02/samples` | Sample list and local demo registration |
| `/module-02/samples/:id` | Sample details, measurements and image history |
| `/module-02/images` | Baseline/current image interface and screening availability |
| `/module-02/predictions` | Model status, planning horizon and future output structure |
| `/module-03` | Offline mobile edge grading overview; no web classifier |
| `/module-04` | Preserved price dashboard with planned GIS/yield wrapper |

Unknown routes show a not-found page. Sample IDs absent from the current session show a sample-not-found state after enabling demo data.

## Demonstration and scientific boundaries

**Demo data is disabled by default.** Enable the checkbox in Module 02 to display clearly labeled **DEMO DATA**. Two synthetic samples supply weight, RGB, temperature, humidity, gas resistance, and historical records. Disabling demo mode removes these records from the view. Navigating within Module 02 retains the selection and local registrations; refreshing or leaving the module resets that session.

Registration is an in-memory demonstration workflow, not a database write. New samples have baseline metadata but no invented measurements or captured images. Duplicate IDs and invalid weights are rejected.

- Weight change is calculated against the sample's initial weight.
- Storage duration is the duration at the latest measurement, not a live clock.
- Timestamps are rendered in Asia/Colombo time with an SLST label.
- Gas resistance is shown in **ohms (Ω)**. It is not direct aroma concentration, essential-oil percentage, or an inferred VOC score.
- Raw illustrative RGB values are not converted to CIELAB or ΔE. These remain unavailable pending suitable calibrated data.
- Baseline/current demo images reuse the same local botanical illustration. Metadata is synthetic; these are not ESP32-CAM photographs.
- Image defect screening is unavailable. Suspected fungal growth is distinguished from confirmed contamination; neither is inferred.
- Overall quality is not assessed. Risk, confidence, accuracy, and model-specific explanations remain unavailable.
- Low / Moderate / High are unassigned legend labels. Selecting a planning horizon does not create a forecast.
- Recommendations describe research preparation rather than model-generated advice.

## Frontend integration seam

`client/src/services/qualityService.js` exports an unconfigured adapter. It makes **zero network requests** by default. Proposed sample, measurement, image, and device-status read methods are isolated behind `createQualityService({ baseUrl, fetcher })`; no backend routes have been implemented for them. The paths and complete data schema must be agreed with the team during Phase 2 before connecting this adapter.

`QualityProvider` keeps demo fixtures separate from future remote data, supports loading/disconnected/error/empty states, forwards cancellation signals, and prevents an obsolete response from replacing newer state. The image reference structure includes sample association, role, timestamp, source, and type, ready for a future capture-data contract.

## Created and modified frontend files

- `client/src/App.jsx`: common routes and nested Module 02 routes.
- `client/src/components/Layout.jsx`: branding, navigation, mobile menu, footer, page titles and route scroll reset.
- `client/src/components/QualityLayout.jsx`, `QualityProvider.jsx`: quality subnavigation, explicit demo control and data state.
- `client/src/components/QualityUI.jsx`, `TrendChart.jsx`: reusable panels, metrics, sample selection, history, image comparison and SVG charts.
- `client/src/pages/Home.jsx`: official modules, research workflow, five technologies, objectives, team and About.
- `client/src/pages/QualityDashboard.jsx`: quality overview, sensor metrics, color, environmental trends and unavailable risk outputs.
- `client/src/pages/SampleManagement.jsx`, `SampleDetails.jsx`: demo registration and sample/history views.
- `client/src/pages/ImageAnalysis.jsx`, `QualityPredictions.jsx`: dedicated image and prediction workspaces.
- `client/src/pages/Placeholder.jsx`: preserved overview component, still used by Module 03.
- `client/src/pages/ForecastingModule.jsx`: extensible Module 04 wrapper.
- `client/src/pages/PriceDashboard.jsx`, `price-dashboard.css`: original price interface extracted and scoped during initial Phase 1; no behavior changes in the revised implementation.
- `client/src/data/modules.js`, `demoQuality.js`: official module configuration and explicitly synthetic fixtures.
- `client/src/styles.css`, `styles/research.css`, `styles/quality.css`: responsive design system and scoped additions.
- `client/src/main.jsx`: style entry points.
- `client/public/cinnamon.svg`, `client/index.html`: local illustration and metadata.
- `client/package.json`, root `package-lock.json`: React Router added during initial Phase 1; no additional UI/chart dependencies.
- Root `README.md`: setup, scope and verification.

## Verification

- **Production frontend build passed** (`npm run build`, Vite 7.3.7).
- Local Edge browser checks passed for all requested page routes, direct refreshes, not-found handling, sample/image history and prediction navigation.
- Demo opt-in/out, all five trend tabs, sample switching, demo registration and an empty newly registered sample were exercised successfully.
- Mobile checks at 390 px passed for the homepage, all four module routes, quality demo dashboard and menu navigation, with no viewport overflow or uncaught browser errors.
- Desktop and mobile screenshots were inspected.
- Targeted adapter checks passed for no network access without configuration, empty results, service errors, malformed list responses, encoded sample IDs and cancellation signal forwarding.
- A source comparison confirmed the existing price dashboard matches the original `App.jsx` after accounting for its component rename and CSS import. Server and ML source files are unchanged.
- The actual Express health endpoint responded successfully with `database: unavailable`. The price UI displayed the existing MongoDB-unavailable error. **Successful end-to-end price prediction could not be verified** because MongoDB and a healthy model service were unavailable.

## Remaining tasks — only after Phase 2 approval

- Agree sample, measurement, image, device and prediction data contracts across the team.
- Implement authenticated persistence and sample/image history APIs as appropriate.
- Integrate and calibrate ESP32-S3 sensors, ESP32-CAM capture, and device state handling.
- Establish standardized imaging and reference quality-label collection.
- Validate color conversion and gas-response interpretation protocols.
- Train and evaluate the stored-quality model before connecting risk, horizon, confidence and explanations.
- Integrate each member's chamber, offline mobile and GIS/yield implementations independently.
- Provide MongoDB and valid existing price-model artifacts for end-to-end Module 04 validation.

Phase 2 has not been started.

## Botanical UI redesign

The frontend now uses the requested Forest Green `#163B2C`, Cinnamon Brown `#A85A2A`, Warm Cream `#F6F2E9`, Sage Green `#D9E7D8`, Charcoal `#252B27`, and White design tokens.

- Photographic **Nature Meets Intelligence.** homepage with locally stored cinnamon images, image-led module cards, interactive four-stage research workflow, five technology highlights, and the existing team information.
- Modern floating header with a compact wordmark and AI badge, icon-led module navigation, clear active states, a workspace action, and a responsive mobile menu with Escape and outside-click dismissal. Full official module titles remain available as accessible link labels.
- Collapsible Module 02 desktop sidebar and a mobile drawer with focus trapping, Escape dismissal, focus restoration, scroll locking and explicit offline device indicators.
- Clear demo/historical labels, refined measurement cards, dedicated temperature/humidity/gas charts, raw RGB display swatches, unassigned risk categories, image comparisons, visual-screening status, and research-workflow recommendations.
- Shared SVG icons, purposeful empty/error states, skeleton loading cards, focus treatments and reduced-motion support. No new runtime dependency was needed for this redesign.
- Opening a sample detail carries that selection into the image and prediction workspaces.

Main redesigned files are `Home.jsx`, `Layout.jsx`, `QualityLayout.jsx`, `QualityUI.jsx`, `QualityDashboard.jsx`, `TrendChart.jsx`, `styles.css`, `styles/research.css` and `styles/quality.css`. New files are `Icon.jsx`, `AssetImage.jsx`, `ResearchWorkflow.jsx`, `styles/header.css` and the credited local assets in `client/public/images/`. Small presentation changes also affect `Placeholder.jsx`, `ImageAnalysis.jsx`, `QualityPredictions.jsx`, `SampleDetails.jsx`, `main.jsx` and page metadata.

Photo credits and source/license links are in the footer and `client/public/images/CREDITS.md`. Stock photographs are branding assets only. Existing demo sample illustrations and sensor fixtures remain demo data; no real measurements are replaced. Failed sample images display an unavailable preview instead of a substitute stock photo.

Redesign checks passed for the production build, all requested routes and 404s, demo opt-in/out, five measurement tabs, sample selection and registration, sample/image history, image failure handling, prediction-horizon controls, sidebar collapse, loading/error/empty states, and responsive layouts at 320, 390, 768 and 1440 pixels. The mobile drawer's keyboard trap and Escape/focus restoration were exercised, as was the main mobile menu. No uncaught application exceptions were observed.

The price form/result/history success contract was checked using temporary browser-only response fixtures, removed with the QA browser session. The actual API also displayed its MongoDB-unavailable error correctly. This is not a claim of a successful real model prediction: MongoDB and a healthy model service are still required. The price component and all backend/ML source files remain unchanged.

The C: drive ran out of free space during screenshot capture. Only task-owned browser profiles and screenshots were cleaned up; unrelated files were not removed. Functional browser checks and the production build completed after this cleanup.

## Modern footer refinement

The shared footer is now extracted into `client/src/components/Footer.jsx`, with isolated styles in `client/src/styles/footer.css`. It uses an inset forest-green surface, a research invitation and workspace action, the CinnaSense wordmark, icon-led module navigation, the complete project title and ID, expandable photo credits, and a reduced-motion-aware back-to-top control. Module links and all existing image credits are retained. Footer navigation to the homepage About section now preserves its hash and scrolls below the sticky header.

Production build and browser checks passed. Checks covered all four module links, the workspace action, cross-page About navigation, expandable credits, back-to-top behavior, and no horizontal overflow at 320, 390, 768 and 1440 pixels. Desktop and mobile screenshots were reviewed. The header appearance, sensor data, price prediction logic, APIs and ML services were not changed.

## Typography and readability refinement

The existing layout and botanical palette are retained. Text now uses a shared responsive scale, with locally hosted **Plus Jakarta Sans** for headings and **Inter** for body text, navigation, controls, tables and measurement data. Font files and their SIL Open Font License notices are in `client/public/fonts/`; no npm dependency or runtime third-party font request was added.

- Hero: 52–64 px desktop, 34–40 px mobile; page headings: approximately 32–40 px desktop and 26–30 px mobile.
- Section headings: 22–28 px; card headings: 18–19 px; body copy: 16–17 px with approximately 1.6 line height.
- Navigation and buttons: 15–16 px; dashboard labels and units: at least 14 px; secondary captions: at least 13 px; sensor values: approximately 26–36 px.
- Darker secondary text and a darker cinnamon **text accent** (`#8F481F`) improve contrast on white, cream and sage surfaces. The primary brand colors remain unchanged.
- Headings and statuses wrap, card content has more room, header navigation collapses before labels become cramped, and mobile sample/summary sections adapt to larger type.
- Chart axes and legends use regular HTML text instead of labels that shrink with an SVG viewBox. Measurement paths still use the same recorded values. The measurement table has a keyboard-focusable scroll region.
- Important disabled form text no longer depends on reduced opacity. Placeholders, error messages, captions, sidebar text and units have explicit readable styling.

### Files changed for this refinement

- `client/src/styles/typography.css`: new local font declarations, responsive type tokens and readable text-color tokens.
- `client/src/styles.css`, `styles/research.css`, `styles/quality.css`, `styles/header.css`, `styles/footer.css`: existing component typography updated in place, with wrapping and spacing refinements.
- `client/src/main.jsx`: loads the shared typography tokens before component styles.
- `client/src/components/TrendChart.jsx`: non-scaling HTML axis labels and legends around the existing SVG measurement plots.
- `client/src/components/QualityUI.jsx`: keyboard-accessible measurement-table scrolling.
- `client/public/fonts/`: Inter Latin/Greek and Plus Jakarta Sans Latin variable WOFF2 files, license notices and font-source documentation.
- `README.md`: scope and verification notes.

### Verification and limits

- `npm run build` passed after the final code changes.
- Rendered checks covered **52 route/state/viewport scenarios** at **1440, 768 and 375 px**, including every implemented route, default and demo states, mobile navigation/sidebar and expanded footer credits. The checked DOM text was at least 13 px, with no measured normal-text contrast failures at 4.5:1, no measured large-text contrast failures at 3:1, and no page-level horizontal overflow after fixes.
- Additional browser checks found no clipped text in the inspected page content. Deliberately scrollable tables and intentionally collapsed disclosures were treated separately. Hover contrast checks passed for the homepage, quality workspace and price page.
- The actual local fonts loaded successfully. Homepage, desktop dashboard and mobile chart screenshots were reviewed directly in memory because the C: drive was nearly full.
- The original Module 04 prediction component matches the repository's original interface after its earlier extraction. Its form/result/history contract passed with temporary browser-only response fixtures. No backend, model, sensor data, fixture or API-adapter logic was changed by this typography work.
- These are targeted rendered contrast/layout checks, not a claim of a complete WCAG conformance certification. Photographic backgrounds received additional solid text backdrops and visual review. Real end-to-end price predictions still require MongoDB and the existing ML service.

Only task-owned temporary browser profiles and QA artifacts were removed when disk space prevented saving audit screenshots/reports. Unrelated files were not removed.

## Module 01 dehydration research workspace

Module 01 now follows the existing Module 02 workspace structure and design system. The shared website header, footer, homepage workflow, other modules, server and ML services are preserved. No UI or chart dependency was added.

- `DehydrationLayout.jsx`: dehydration navigation, accessible mobile drawer, hardware availability and explicit demo opt-in.
- `DehydrationProvider.jsx`: session-scoped demo selection, isolated fixtures, simulated controls and cancellable read-only integration state.
- `DehydrationUI.jsx`: reusable telemetry, prediction, control status, charts, process information and event panels. Charts include optional exact-value tables and elapsed-time axes.
- `DehydrationDashboard.jsx`, `DryingSessions.jsx`, `DehydrationPrediction.jsx`, `DryingAnalytics.jsx`, `ChamberControls.jsx`: the five workspace views and session details.
- `demoDehydration.js`: explicitly synthetic, static experiments. Durations use seconds, weights grams, moisture percent and ISO timestamps rendered in Asia/Colombo (SLST).
- `dehydrationService.js`: an unconfigured, read-only adapter contract that returns no data and makes no network requests. A future adapter can be injected into `DehydrationProvider`; no backend endpoint or hardware command API is assumed.
- `styles/dehydration.css`: Module 01 additions using existing fonts, tokens, panels and sidebar primitives.

Demo data starts disabled on every mount or refresh. Enabling it displays synthetic snapshots, example experiment histories and a fixed simulated RDT. Disabling it clears readings and demo control events; leaving Module 01 resets the session. Hardware remains explicitly not connected in both modes. There is no running RDT model, model confidence or experimental evaluation result; MAE, RMSE and R² remain unavailable.

Controls send no hardware commands. Offline settings are disabled; demo relay switches require Manual mode. A simulated maximum-temperature interlock turns the demo heater OFF and disables its switch when the sample temperature reaches the selected maximum. Demo target changes update the progress and target-weight display, but do not recalculate the fixed illustrative RDT or fabricate new sensor observations. Target weight uses the demo dry-mass baseline; this is not calibrated moisture measurement.

### Module 01 verification

- `npm.cmd run build` passed with no added dependency.
- 85 browser layout/state checks passed across 320, 390, 768, 1100 and 1440 px, including direct route loads, session detail/not-found views, demo/offline states, desktop sidebar collapse and Module 02 regression checks. No page-level horizontal overflow was detected.
- Interaction checks passed for demo opt-in/out/reset on refresh, all sidebar destinations, session detail navigation, chart signal selection and exact-value disclosures, Manual/Automatic demo modes, relay toggles, simulated temperature protection, mobile drawer focus trapping/Escape/focus restoration, keyboard demo selection and the homepage workflow link.
- Adapter/fixture consistency checks passed: the default adapter returns no data; historical endpoints agree with telemetry/session values; duration formatting handles unavailable data.
- Desktop/mobile screenshots were reviewed. No application console errors or uncaught exceptions were observed, and no hardware/API requests were made. The pre-existing global `/favicon.ico` request returns 404; shared branding/metadata files were not changed.
- Module 02 components/styles, the shared header/footer, other research modules and backend/ML sources are unchanged. Actual hardware commands and model inference cannot be tested because neither integration is configured.


Module 02 image-condition prototype: see [training, dataset review, API and dashboard setup](ml-module02/IMAGE_CONDITION_GUIDE.md). The local data audit must be resolved before claiming a trained model.
