import { cn } from "@/lib/utils";

// Stable color palette derived from product name so avatars are consistent.
const PALETTE = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-violet-500",
  "bg-teal-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-indigo-500",
  "bg-cyan-500",
];

function colorFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function ProductAvatar({
  name,
  imageUrl,
  className,
  rounded = "rounded-lg",
}: {
  name: string;
  imageUrl?: string | null;
  className?: string;
  rounded?: string;
}) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        loading="lazy"
        className={cn("h-full w-full object-cover", rounded, className)}
      />
    );
  }
  const initial = (name?.trim()?.[0] ?? "?").toUpperCase();
  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center font-bold text-white",
        rounded,
        colorFor(name || "?"),
        className,
      )}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}
