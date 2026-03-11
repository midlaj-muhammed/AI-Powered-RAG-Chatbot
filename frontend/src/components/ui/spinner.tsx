"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import Loader from "./loader";

export function Spinner({ className = 'size-6' }: { className?: string }) {
  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-primary/20"
        style={{ borderTopColor: "currentColor" }}
        animate={{ rotate: 360 }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: "linear"
        }}
      />
      <motion.div
        className="absolute inset-1 rounded-full border-2 border-primary/10"
        style={{ borderBottomColor: "currentColor" }}
        animate={{ rotate: -360 }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "linear"
        }}
      />
    </div>
  );
}

export function PageLoader({ title, subtitle }: { title?: string; subtitle?: string }) {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <Loader
        size="lg"
        title={title || "Initializing Workspace..."}
        subtitle={subtitle || "Preparing your intelligent workspace"}
      />
    </div>
  );
}
