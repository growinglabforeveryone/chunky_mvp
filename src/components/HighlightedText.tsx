import { findKoreanHighlightRange } from "@/utils/phraseMask";

interface HighlightedTextProps {
  text: string;
  highlight: string;
  className?: string;
  highlightClassName?: string;
}

/**
 * text 안에서 highlight 부분만 강조 색으로 렌더링.
 * 매칭 실패 시 하이라이트 없이 plain text 반환.
 */
export default function HighlightedText({
  text,
  highlight,
  className,
  highlightClassName = "text-primary font-semibold",
}: HighlightedTextProps) {
  const range = findKoreanHighlightRange(text, highlight);

  if (!range) {
    return <span className={className}>{text}</span>;
  }

  const [start, end] = range;
  return (
    <span className={className}>
      {text.slice(0, start)}
      <span className={highlightClassName}>{text.slice(start, end)}</span>
      {text.slice(end)}
    </span>
  );
}
