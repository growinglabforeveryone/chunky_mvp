import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Crown, Sparkles, BookOpen, Headphones } from "lucide-react";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  reason: "ai_limit" | "vocab_limit";
  used?: number;
  limit?: number;
}

export default function UpgradeModal({ open, onClose, reason, used, limit }: UpgradeModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Crown className="h-5 w-5 text-amber-500" />
            {reason === "ai_limit" ? "이번 달 AI 사용량을 모두 썼어요" : "단어장이 가득 찼어요"}
          </DialogTitle>
          <DialogDescription>
            {reason === "ai_limit"
              ? `이번 달 ${used ?? 0}/${limit ?? 20}회를 사용했어요. 다음 달 1일에 초기화돼요.`
              : `무료 플랜은 활성 단어 ${limit ?? 200}개까지 저장할 수 있어요.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4 dark:border-amber-800 dark:from-amber-950/30 dark:to-orange-950/30">
            <p className="mb-3 text-sm font-semibold text-foreground">
              프리미엄 플랜 — ₩4,900/월
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 shrink-0 text-amber-500" />
                AI 추출 & 교정 무제한
              </li>
              <li className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 shrink-0 text-amber-500" />
                단어장 무제한
              </li>
              <li className="flex items-center gap-2">
                <Headphones className="h-4 w-4 shrink-0 text-amber-500" />
                유튜브 자막 추출 (업데이트 예정)
              </li>
            </ul>
          </div>

          <button
            disabled
            className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-medium text-white opacity-70"
          >
            결제 기능 준비 중이에요
          </button>

          <p className="text-center text-xs text-muted-foreground">
            {reason === "ai_limit"
              ? "복습과 드래그 추가는 무제한으로 사용할 수 있어요"
              : "기존 단어를 마스터하거나 제외하면 자리가 생겨요"}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
