import { useRef, useState } from "react";
import api, { errorMessage } from "../api/client";
import { mediaUrl } from "../utils";
import Alert from "./Alert";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime";
const MAX_IMAGE_MB = 5;
const MAX_VIDEO_MB = 50;
const MAX_ITEMS = 8;

function problemWith(file) {
  const isVideo = file.type.startsWith("video/");
  if (!ACCEPT.split(",").includes(file.type)) return `${file.name}: unsupported type (use JPG/PNG/WEBP/GIF or MP4/WEBM/MOV)`;
  const limit = isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB;
  if (file.size > limit * 1024 * 1024) return `${file.name}: larger than ${limit} MB`;
  return "";
}

// Lets a restaurant owner upload and remove photos/videos for one dish.
export default function DishMediaManager({ dish, onChanged, onClose }) {
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const media = dish.media || [];

  const onFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    const room = MAX_ITEMS - media.length;
    if (files.length > room) return setError(`You can add ${room} more file(s) to this dish (max ${MAX_ITEMS}).`);
    const problems = files.map(problemWith).filter(Boolean);
    if (problems.length) return setError(problems.join(" · "));

    setError("");
    try {
      for (let i = 0; i < files.length; i += 1) {
        const body = new FormData();
        body.append("file", files[i]);
        await api.post(`/owner/menu/${dish.id}/media`, body, {
          onUploadProgress: (ev) => setProgress({ index: i + 1, total: files.length, pct: ev.total ? Math.round((ev.loaded / ev.total) * 100) : 0 }),
        });
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setProgress(null);
      onChanged();
    }
  };

  const remove = async (m) => {
    if (!window.confirm(`Delete this ${m.kind}?`)) return;
    try {
      await api.delete(`/owner/menu/${dish.id}/media/${m.id}`);
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <section className="card media-manager" aria-label={`Photos and videos for ${dish.name}`}>
      <div className="card-title">
        <h3>🖼️ Photos &amp; videos · {dish.name}</h3>
        <button type="button" className="icon-btn" aria-label="Close media manager" onClick={onClose}>
          ✕
        </button>
      </div>
      <p className="muted small">
        Up to {MAX_ITEMS} files. Images up to {MAX_IMAGE_MB} MB, videos up to {MAX_VIDEO_MB} MB. The first photo is used as the dish thumbnail.
      </p>
      <Alert onClose={() => setError("")}>{error}</Alert>

      <div className="media-grid">
        {media.map((m) => (
          <figure key={m.id} className="media-tile">
            {m.kind === "video" ? (
              <video src={mediaUrl(m.url)} muted playsInline preload="metadata" controls />
            ) : (
              <img src={mediaUrl(m.url)} alt={dish.name} loading="lazy" />
            )}
            {m.url === dish.image_url && <span className="tile-flag">Thumbnail</span>}
            <button type="button" className="icon-btn danger tile-delete" aria-label={`Delete ${m.kind}`} onClick={() => remove(m)}>
              🗑
            </button>
          </figure>
        ))}
        {media.length < MAX_ITEMS && (
          <button type="button" className="upload-tile" disabled={!!progress} onClick={() => inputRef.current?.click()}>
            {progress ? (
              <>
                <span className="upload-pct">{progress.pct}%</span>
                <span className="small muted">
                  Uploading {progress.index}/{progress.total}
                </span>
                <span className="bar-track" style={{ width: "80%" }}>
                  <span className="bar-fill" style={{ display: "block", width: `${progress.pct}%`, animation: "none" }} />
                </span>
              </>
            ) : (
              <>
                <span style={{ fontSize: "1.6rem" }}>＋</span>
                <span className="small">Add photos / videos</span>
              </>
            )}
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept={ACCEPT} multiple hidden onChange={onFiles} />
    </section>
  );
}
