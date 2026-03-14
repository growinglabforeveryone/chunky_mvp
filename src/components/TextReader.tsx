import { Chunk } from "@/types/chunk";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";

interface TextReaderProps {
  text: string;
  chunks: Chunk[];
  hoveredChunkId: string | null;
  onChunkClick?: (id: string) => void;
  onAddPhrase?: (phrase: string, sentence: string) => void;
}

export default function TextReader({
  text,
  chunks,
  hoveredChunkId,
  onAddPhrase,
}: TextReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<{
    text: string;
    sentence: string;
    x: number;
    y: number;
  } | null>(null);

  const findSurroundingSentence = useCallback(
    (selectedText: string) => {
      const idx = text.indexOf(selectedText);
      if (idx === -1) return selectedText;

      // Walk backward to sentence start
      let start = idx;
      while (start > 0 && !/[.!?]\s/.test(text.slice(start - 2, start))) {
        start--;
      }

      // Walk forward to sentence end
      let end = idx + selectedText.length;
      while (end < text.length && !/[.!?]/.test(text[end])) {
        end++;
      }
      if (end < text.length) end++; // include punctuation

      return text.slice(start, end).trim();
    },
    [text]
  );

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !containerRef.current) {
      return;
    }

    const selectedText = sel.toString().trim();
    if (selectedText.length < 2) return;

    // Check selection is within our container
    const range = sel.getRangeAt(0);
    if (!containerRef.current.contains(range.commonAncestorContainer)) return;

    const rect = range.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    const sentence = findSurroundingSentence(selectedText);

    setSelection({
      text: selectedText,
      sentence,
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top - 8,
    });
  }, [findSurroundingSentence]);

  // Close popover on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (selection && containerRef.current) {
        // Small delay to allow the add button click to register
        setTimeout(() => {
          const sel = window.getSelection();
          if (!sel || sel.isCollapsed) {
            setSelection(null);
          }
        }, 100);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [selection]);

  if (!text) return null;

  const dimmed = hoveredChunkId !== null;

  const highlights: { phrase: string; id: string }[] = chunks
    .map((c) => ({ phrase: c.phrase, id: c.id }))
    .sort((a, b) => b.phrase.length - a.phrase.length);

  let parts: { text: string; chunkId?: string }[] = [{ text }];

  for (const hl of highlights) {
    const newParts: typeof parts = [];
    for (const part of parts) {
      if (part.chunkId) {
        newParts.push(part);
        continue;
      }
      const regex = new RegExp(
        `(${hl.phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
        "gi"
      );
      const splits = part.text.split(regex);
      for (const s of splits) {
        if (regex.test(s)) {
          newParts.push({ text: s, chunkId: hl.id });
        } else {
          newParts.push({ text: s });
        }
        regex.lastIndex = 0;
      }
    }
    parts = newParts;
  }

  const handleAdd = () => {
    if (selection && onAddPhrase) {
      onAddPhrase(selection.text, selection.sentence);
      setSelection(null);
      window.getSelection()?.removeAllRanges();
    }
  };

  return (
    <div ref={containerRef} className="relative font-serif text-lg leading-relaxed" onMouseUp={handleMouseUp}>
      {parts.map((part, i) => {
        if (part.chunkId) {
          const isHovered = hoveredChunkId === part.chunkId;
          return (
            <span key={i} className="relative cursor-pointer group inline">
              <span
                className={`absolute inset-x-0 -bottom-0.5 h-2 transition-colors duration-200 ${
                  isHovered ? "bg-accent/70" : "bg-accent/40"
                }`}
              />
              <span
                className={`relative font-medium transition-opacity duration-200 ${
                  dimmed && !isHovered ? "opacity-40" : "opacity-100"
                }`}
              >
                {part.text}
              </span>
            </span>
          );
        }
        return (
          <span
            key={i}
            className={`transition-opacity duration-200 ${
              dimmed ? "opacity-40" : "opacity-100"
            }`}
          >
            {part.text}
          </span>
        );
      })}

      {/* Selection Popover */}
      <AnimatePresence>
        {selection && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50"
            style={{
              left: selection.x,
              top: selection.y,
              transform: "translate(-50%, -100%)",
            }}
          >
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleAdd();
              }}
              className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-sm font-sans font-medium shadow-md hover:bg-secondary transition-colors"
            >
              <Plus className="h-3.5 w-3.5 text-primary" />
              <span className="text-foreground">표현 추가</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
