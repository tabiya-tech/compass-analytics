import { User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const uniqueId = "31ac4e7b-ef8d-47b3-8969-c3f135ea300c";

export const DATA_TEST_ID = {
  CONTAINER: `user-avatar-container-${uniqueId}`,
  FALLBACK: `user-avatar-fallback-${uniqueId}`,
};

/** "Jordan Avila" → "JA", "Jordan" → "J". Empty when the name carries no letters to take. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";

  const first = [...words[0]][0] ?? "";
  const last = words.length > 1 ? ([...words[words.length - 1]][0] ?? "") : "";
  return (first + last).toUpperCase().replace(/[^\p{L}\p{N}]/gu, "");
}

export interface UserAvatarProps {
  name: string;
  src?: string;
  size?: "sm" | "default" | "lg" | "xl";
  className?: string;
}

export function UserAvatar({ name, src, size = "default", className }: Readonly<UserAvatarProps>) {
  const initials = initialsOf(name);

  return (
    <Avatar data-slot="user-avatar" data-testid={DATA_TEST_ID.CONTAINER} size={size}>
      {src && <AvatarImage src={src} alt="" />}
      <AvatarFallback
        aria-hidden="true"
        data-testid={DATA_TEST_ID.FALLBACK}
        className={cn(
          "bg-tabiya-blue font-medium text-white group-data-[size=lg]/avatar:text-base group-data-[size=xl]/avatar:text-xl",
          className
        )}
      >
        {initials || <User className="size-1/2" />}
      </AvatarFallback>
      {/* The photo is decorative, so the name lives here and reads the same either way. */}
      <span className="sr-only">{name}</span>
    </Avatar>
  );
}
