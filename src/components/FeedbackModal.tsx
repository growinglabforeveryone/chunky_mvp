import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabaseClient";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
}

const CATEGORIES = [
  { value: "bug", label: "버그 신고" },
  { value: "feature", label: "기능 제안" },
  { value: "question", label: "질문" },
];

export default function FeedbackModal({ open, onClose }: FeedbackModalProps) {
  const [category, setCategory] = useState("feature");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("로그인이 필요합니다");
        return;
      }

      const { error } = await supabase.from("feedback").insert({
        user_id: user.id,
        category,
        content: content.trim(),
        device_info: {
          userAgent: navigator.userAgent,
          screenSize: `${window.innerWidth}x${window.innerHeight}`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      });

      if (error) throw error;

      toast.success("피드백이 전달되었습니다. 감사합니다!");
      setContent("");
      setCategory("feature");
      onClose();
    } catch {
      toast.error("전송에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>피드백 보내기</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Category */}
          <div className="flex gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  category === c.value
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-border text-muted-foreground hover:border-primary/40"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            placeholder="어떤 점을 개선하면 좋을까요?"
            className="w-full resize-none rounded-xl border bg-card p-4 text-sm leading-relaxed placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting || !content.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "전송 중..." : "보내기"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
