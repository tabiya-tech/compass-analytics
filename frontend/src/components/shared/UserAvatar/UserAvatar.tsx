import { User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const uniqueId = "31ac4e7b-ef8d-47b3-8969-c3f135ea300c";

export const DATA_TEST_ID = {
  CONTAINER: `user-avatar-container-${uniqueId}`,
  FALLBACK: `user-avatar-fallback-${uniqueId}`,
};

export interface UserAvatarProps {
  name: string;
  src?: string;
  size?: "sm" | "default" | "lg";
  className?: string;
}

export function UserAvatar({ name, src, size = "default", className }: Readonly<UserAvatarProps>) {
  return (
    <Avatar data-slot="user-avatar" data-testid={DATA_TEST_ID.CONTAINER} size={size}>
      {src && <AvatarImage src={src} alt="" />}
      <AvatarFallback
        aria-hidden="true"
        data-testid={DATA_TEST_ID.FALLBACK}
        className={cn("bg-tabiya-blue text-white", className)}
      >
        <User className="size-1/2" />
      </AvatarFallback>
      {/* The photo is decorative, so the name lives here and reads the same either way. */}
      <span className="sr-only">{name}</span>
    </Avatar>
  );
}
