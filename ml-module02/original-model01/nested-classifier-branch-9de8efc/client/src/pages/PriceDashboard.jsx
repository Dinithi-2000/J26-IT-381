import './price-dashboard.css';
import { useEffect, useState } from "react";

function PriceDashboard() {
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    district: "Kalutara",
    grade: "Alba"
  });
  const [prediction, setPrediction] = useState(null);
  const [history, setHistory] = useState([]);
  const [modelStatus, setModelStatus] = useState("Checking model...");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/model-info").then(async (response) => ({
        ok: response.ok,
        body: await response.json()
      })),
      fetch("/api/predictions").then(async (response) => ({
        ok: response.ok,
        body: await response.json()
      }))
    ])
      .then(([modelResponse, historyResponse]) => {
        const model = modelResponse.body;
        setModelStatus(
          modelResponse.ok
            ? `Model online · ${model.modelVersion}`
            : `Model unavailable · ${model.error?.code || "offline"}`
        );
        setHistory(historyResponse.ok && Array.isArray(historyResponse.body)
          ? historyResponse.body
          : []);
      })
      .catch(() => setModelStatus("API unavailable"));
  }, []);

  function updateForm(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function submitPrediction(event) {
    event.preventDefault();
    setError("");
    setPrediction(null);
    setLoading(true);
    try {
      const response = await fetch("/api/predictions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form)
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error?.message || body.detail || "Prediction failed");
      }
      setPrediction(body);
      setHistory([body, ...history]);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">AGRICULTURE INTELLIGENCE</p>
          <h1>Cinnamon price dashboard</h1>
          <p className="subtitle">Estimate cinnamon prices by harvest date, district, and grade.</p>
        </div>
        <span className={`status ${modelStatus.includes("online") ? "success" : "warning"}`}>{modelStatus}</span>
      </header>

      <section className="grid">
        <form className="card form-card" onSubmit={submitPrediction}>
          <h2>Make a prediction</h2>
          <label>
            Harvest date
            <input name="date" type="date" value={form.date} onChange={updateForm} required />
          </label>
          <label>
            District
            <select name="district" value={form.district} onChange={updateForm}>
              <option>Kalutara</option>
              <option>Matara</option>
            </select>
          </label>
          <label>
            Cinnamon grade
            <select name="grade" value={form.grade} onChange={updateForm}>
              {["Alba", "C-4", "C-5", "C-5 Sp", "H-1", "H-2", "H-Faq", "M-4", "M-5"].map((grade) => (
                <option key={grade}>{grade}</option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={loading}>{loading ? "Calculating..." : "Predict price"}</button>
          {error && <p className="error">{error}</p>}
        </form>

        <section className="card result-card">
          <p className="eyebrow">LATEST ESTIMATE</p>
          {prediction ? (
            <>
              <p className="price">LKR {Number(prediction.predictedPrice).toLocaleString("en-LK", { minimumFractionDigits: 2 })}</p>
              <p className="muted">per kilogram · {prediction.grade} · {prediction.district}</p>
              <p className="muted">{new Date(prediction.date).toLocaleDateString()}</p>
            </>
          ) : (
            <p className="empty">Submit the form to see a model prediction.</p>
          )}
        </section>
      </section>

      <section className="card history-card">
        <div className="section-heading">
          <h2>Prediction history</h2>
          <span className="muted">{history.length} records</span>
        </div>
        {history.length === 0 ? <p className="empty">No saved predictions yet.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>District</th><th>Grade</th><th>Estimated price</th></tr></thead>
              <tbody>{history.map((entry) => (
                <tr key={entry._id || `${entry.date}-${entry.grade}-${entry.createdAt}`}>
                  <td>{new Date(entry.date).toLocaleDateString()}</td>
                  <td>{entry.district}</td>
                  <td>{entry.grade}</td>
                  <td>LKR {Number(entry.predictedPrice).toLocaleString("en-LK", { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

export default PriceDashboard;
