export default function Spinner({ text = "Loading..." }) {
  return (
    <div className="spinner-wrap" role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      {text}
    </div>
  );
}
