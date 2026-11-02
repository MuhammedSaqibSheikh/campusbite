import { initials, mediaUrl } from "../utils";

export default function Avatar({ user, size = 34, className = "" }) {
  const style = { width: size, height: size, fontSize: Math.max(11, size * 0.36) };
  if (user?.avatar_url) {
    return <img className={`avatar ${className}`} style={style} src={mediaUrl(user.avatar_url)} alt="" />;
  }
  return (
    <span className={`avatar ${className}`} style={style} aria-hidden="true">
      {initials(user?.name)}
    </span>
  );
}
