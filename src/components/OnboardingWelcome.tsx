import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Sparkles } from "lucide-react";

const ONBOARDING_SAMPLE_TEXT = `Hi team,

Just a quick heads-up — the deadline for the project proposal has been moved up to Friday. I know it's tight, but let's try to wrap things up by end of day Thursday so we have time to review. Feel free to reach out if you need a hand with anything.

Also, I'd like to set up a quick sync tomorrow morning to go over the key takeaways from last week's meeting.

Thanks for staying on top of this!`;

export const ONBOARDING_KEY = "chunky_onboarding_completed";

export default function OnboardingWelcome({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center">
            <img
              src="/chunky/lv2.png"
              alt="Chunky"
              className="h-14 w-14 object-contain"
            />
          </div>
          <DialogTitle className="text-xl">Chunky에 오신 걸 환영해요!</DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-relaxed">
            영어 텍스트를 붙여넣으면 AI가 실전 표현을 자동으로 뽑아줘요.
            <br />
            뽑은 표현은 매일 조금씩 복습하면 자연스럽게 기억돼요.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 rounded-xl border bg-muted/30 p-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            예시 — 업무 이메일
          </p>
          <p className="text-sm leading-relaxed text-foreground/80 line-clamp-4">
            {ONBOARDING_SAMPLE_TEXT.slice(0, 160)}...
          </p>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <button
            onClick={() => {
              localStorage.setItem(ONBOARDING_KEY, "true");
              onClose();
              navigate("/extract", {
                state: { sampleText: ONBOARDING_SAMPLE_TEXT, isOnboarding: true },
              });
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Sparkles className="h-4 w-4" />
            예시 텍스트로 체험해보기
          </button>
          <button
            onClick={() => {
              localStorage.setItem(ONBOARDING_KEY, "true");
              onClose();
            }}
            className="w-full rounded-xl px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary"
          >
            건너뛰기
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
