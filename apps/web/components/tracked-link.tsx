"use client";

import { track } from "@vercel/analytics";
import Link, { type LinkProps } from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";

type TrackedLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    readonly eventName: string;
    readonly children: ReactNode;
  };

export function TrackedLink({
  eventName,
  children,
  onClick,
  ...props
}: TrackedLinkProps) {
  return (
    <Link
      {...props}
      onClick={(event) => {
        track(eventName);
        onClick?.(event);
      }}
    >
      {children}
    </Link>
  );
}
