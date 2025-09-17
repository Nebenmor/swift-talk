import React from "react";
import { clsx } from "clsx";

interface AvatarProps {
  src?: string;
  alt?: string;
  size?: "sm" | "md" | "lg" | "xl";
  online?: boolean;
  className?: string;
}

const Avatar: React.FC<AvatarProps> = ({
  src,
  alt,
  size = "md",
  online,
  className,
}) => {
  const sizes = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
    xl: "h-16 w-16",
  };

  const indicatorSizes = {
    sm: "h-2 w-2",
    md: "h-2.5 w-2.5",
    lg: "h-3 w-3",
    xl: "h-4 w-4",
  };

  const getInitials = (name?: string): string => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className={clsx("relative inline-block", className)}>
      {src ? (
        <img
          src={src}
          alt={alt}
          className={clsx(sizes[size], "rounded-full object-cover")}
        />
      ) : (
        <div
          className={clsx(
            sizes[size],
            "flex items-center justify-center rounded-full bg-gray-500 text-white font-medium"
          )}
        >
          {getInitials(alt)}
        </div>
      )}

      {online !== undefined && (
        <div
          className={clsx(
            "absolute bottom-0 right-0 rounded-full border-2 border-white",
            indicatorSizes[size],
            online ? "bg-green-500" : "bg-gray-400"
          )}
        />
      )}
    </div>
  );
};

export { Button, Input, Modal, Avatar };
