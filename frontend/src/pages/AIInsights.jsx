import { useState } from "react";
import api, { errorMessage } from "../api/client";
import Alert from "../components/Alert";
import Spinner from "../components/Spinner";

const EXAMPLES = [
  "Summarize my last five orders.",
  "Which of my orders are still not delivered?",
  "How much did I spend this week?",
  "Which food items have I ordered most frequently?",
];

export default function AIInsights() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const run = async (request) => {
    setLoading(true);
    setError("");
    setResult(null);
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
    run(() => api.post("/ai/ask", { question: q }));
  };

  return (
    <>
      <h2>AI order insights</h2>
      <p className="muted">Ask about your own order history. Only your orders are ever shared with the AI.</p>

      <div className="card">
        <button className="btn" disabled={loading} onClick={() => run(() => api.post("/ai/summary"))}>
          Summarize my recent orders
        </button>
        <hr />
        <form
          className="row wrap"
          onSubmit={(e) => {
            e.preventDefault();
            ask(question.trim());
          }}
        >
          <input
            className="grow"
            minLength={3}
            maxLength={500}
            required
            placeholder="Ask a question about your orders"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <button className="btn" disabled={loading}>
            Ask
          </button>
        </form>
        <div className="row wrap chips">
          {EXAMPLES.map((q) => (
            <button key={q} className="chip" disabled={loading} onClick={() => ask(q)}>
              {q}
            </button>
          ))}
        </div>
      </div>

      {loading && <Spinner text="Thinking..." />}
      <Alert onClose={() => setError("")}>{error}</Alert>
      {result && (
        <div className="card">
          <p className="pre">{result.answer}</p>
          <small className="muted">Based on {result.orders_considered} order(s)</small>
        </div>
      )}
    </>
  );
}
