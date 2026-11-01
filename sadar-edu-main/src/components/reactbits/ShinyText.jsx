import { useEffect, useRef, useState } from "react";

export default function ShinyText({
  text,
  disabled = false,
  speed = 4,
  className = "",
}) {
  const animationDuration = `${speed}s`;

  return (
    <span
      className={`inline-block ${
        disabled
          ? ""
          : "animate-shiny-text bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-emerald-600 to-slate-900 bg-[length:200%_100%]"
      } ${className}`}
      style={{
        animationDuration: animationDuration,
      }}
    >
      {text}
    </span>
  );
}
