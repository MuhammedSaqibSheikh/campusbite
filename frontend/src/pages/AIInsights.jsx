import { useState } from "react";
import api, { errorMessage } from "../api/client";
import Alert from "../components/Alert";
import PageHeader from "../components/PageHeader";

const EXAMPLES = [
  "Summarize my last five orders.",
  "Which of my orders are still not delivered?",
  "How much did I spend this week?",
  "Which food items have I ordered most frequently?",
];

export default function AIInsights() {
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const run = async (title, request) => {
    setLoading(true);
    setError("");
    setResult(null);
    setAsked(title);
    try {
      setResult((await request()).data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const ask = (q) => {
    setQuestion(q);
    run(q, () => api.post("/ai/ask", { question: q }));
  };

  return (
    <>
      <PageHeader
        eyebrow="✨ Powered by AI"
        title="AI order insights"
        subtitle="Ask anything about your own order history. Only your orders are ever shared with the AI."
      />

      <section className="card ai-panel">
        <div className="card-title">
          <h3>What would you like to know?</h3>
          <button
            className="btn btn-sm"
            disabled={loading}
            onClick={() => run("Summary of my recent orders", () => api.post("/ai/summary"))}
          >
            ✨ Summarize my recent orders
          </button>
        </div>
        <form
          className="ai-input"
          onSubmit={(e) => {
            e.preventDefault();
            ask(question.trim());
          }}
        >
          <input
            minLength={3}
            maxLength={500}
            required
            aria-label="Your question"
            placeholder="e.g. How much did I spend this month?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <button className="btn" disabled={loading} aria-label="Ask">
            Ask →
          </button>
        </form>
        <div className="chips">
          {EXAMPLES.map((q) => (
            <button key={q} type="button" className="chip" disabled={loading} onClick={() => ask(q)}>
              {q}
            </button>
          ))}
        </div>
      </section>

      <Alert onClose={() => setError("")}>{error}</Alert>

      {(loading || result) && (
        <section className="card" aria-live="polite">
          {asked && <p className="small muted" style={{ marginTop: 0 }}>You asked: “{asked}”</p>}
          <div className="ai-answer">
            <span className="ai-avatar" aria-hidden="true">✨</span>
            <div className="ai-bubble">
              {loading ? (
                <span className="typing" role="status" aria-label="Thinking">
                  <i />
                  <i />
                  <i />
                </span>
              ) : (
                <>
                  <p className="pre" style={{ margin: 0 }}>{result.answer}</p>
                  <small className="muted">Based on {result.orders_considered} order(s)</small>
                </>
              )}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
