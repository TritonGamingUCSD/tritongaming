"use client";

export function LetterDrop({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <span className={`letter-drop ${className ?? ""}`} aria-label={text}>
      {text.split("").map((char, i) => (
        <span key={i} aria-hidden>
          {char === " " ? " " : char}
        </span>
      ))}
    </span>
  );
}
