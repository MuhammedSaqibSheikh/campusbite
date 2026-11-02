export default function Spinner({ text = "Loading..." }) {
  return (
    <div className="center muted" role="status">
      <div className="spinner" />
      {text}
    </div>
  );
}
