import { displayName, initials, tenantColor } from "@/lib/utils";

interface User {
  _id: string;
  name: string;
  nickname?: string | null;
  imageUrl?: string | null;
}

interface AvatarProps {
  user: User;
  size?: "sm" | "md" | "lg" | "xl";
  /** Show the user's name + admin/you flair next to the circle. */
  showName?: boolean;
  isMe?: boolean;
  isAdmin?: boolean;
}

export default function Avatar({
  user,
  size = "md",
  showName = false,
  isMe = false,
  isAdmin = false,
}: AvatarProps) {
  const cls =
    "avatar" +
    (size === "sm"
      ? " avatar-sm"
      : size === "lg"
        ? " avatar-lg"
        : size === "xl"
          ? " avatar-xl"
          : "");
  return (
    <div className="flex center gap-3" style={{ minWidth: 0 }}>
      <div className={cls} style={{ background: tenantColor(user._id) }}>
        {initials(user)}
      </div>
      {showName && (
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 500, fontSize: 14 }}>
            {displayName(user)}
            {isMe && (
              <span className="muted" style={{ fontWeight: 400 }}>
                {" "}
                (you)
              </span>
            )}
          </div>
          {isAdmin && (
            <div className="muted" style={{ fontSize: 11 }}>
              Admin
            </div>
          )}
        </div>
      )}
    </div>
  );
}
