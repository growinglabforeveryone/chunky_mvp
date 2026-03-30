import { useMemo } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  chunks: { lastReviewedAt?: string }[];
}

const WEEKS = 16;
const DAYS = 7;

function getIntensity(count: number) {
  if (count === 0) return "bg-muted/30";
  if (count <= 2) return "bg-primary/20";
  if (count <= 5) return "bg-primary/50";
  return "bg-primary";
}

function formatDateLabel(d: Date) {
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export default function ActivityHeatmap({ chunks }: Props) {
  const { grid, monthLabels } = useMemo(() => {
    // Build date->count map
    const countMap = new Map<string, number>();
    for (const c of chunks) {
      if (!c.lastReviewedAt) continue;
      const key = new Date(c.lastReviewedAt).toDateString();
      countMap.set(key, (countMap.get(key) ?? 0) + 1);
    }

    // Build grid: columns = weeks, rows = days (Mon=0 .. Sun=6)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDay = today.getDay(); // 0=Sun
    const mondayOffset = todayDay === 0 ? -6 : 1 - todayDay;

    // End of current week (Sunday)
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + mondayOffset + 6);

    const startDate = new Date(endOfWeek);
    startDate.setDate(endOfWeek.getDate() - WEEKS * 7 + 1);

    const weeks: { date: Date; count: number }[][] = [];
    const months: { label: string; col: number }[] = [];
    let lastMonth = -1;

    for (let w = 0; w < WEEKS; w++) {
      const week: { date: Date; count: number }[] = [];
      for (let d = 0; d < DAYS; d++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + w * 7 + d);
        const count = countMap.get(date.toDateString()) ?? 0;
        week.push({ date, count });

        if (d === 0 && date.getMonth() !== lastMonth) {
          lastMonth = date.getMonth();
          months.push({
            label: date.toLocaleString("en", { month: "short" }),
            col: w,
          });
        }
      }
      weeks.push(week);
    }

    return { grid: weeks, monthLabels: months };
  }, [chunks]);

  const legendLevels = ["bg-muted/30", "bg-primary/20", "bg-primary/50", "bg-primary"];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">학습 기록</span>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>적음</span>
          {legendLevels.map((cls, i) => (
            <div key={i} className={`h-[9px] w-[9px] rounded-sm ${cls}`} />
          ))}
          <span>많음</span>
        </div>
      </div>

      {/* Month labels */}
      <div className="flex" style={{ paddingLeft: 0 }}>
        {(() => {
          const cells: React.ReactNode[] = [];
          let col = 0;
          for (let i = 0; i < monthLabels.length; i++) {
            const m = monthLabels[i];
            const next = monthLabels[i + 1]?.col ?? WEEKS;
            const span = next - m.col;
            if (m.col > col) {
              cells.push(<div key={`gap-${col}`} style={{ flex: `${m.col - col} 0 0` }} />);
            }
            cells.push(
              <div key={m.label + m.col} className="text-xs text-muted-foreground" style={{ flex: `${span} 0 0` }}>
                {m.label}
              </div>
            );
            col = m.col + span;
          }
          return cells;
        })()}
      </div>

      {/* Grid */}
      <TooltipProvider delayDuration={200}>
        <div className="flex gap-[2px]">
          {grid.map((week, wi) => (
            <div key={wi} className="flex flex-1 flex-col gap-[2px]">
              {week.map(({ date, count }, di) => (
                <Tooltip key={di}>
                  <TooltipTrigger asChild>
                    <div
                      className={`aspect-square w-full rounded-sm ${getIntensity(count)}`}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {formatDateLabel(date)} · 카드 {count}개 복습
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          ))}
        </div>
      </TooltipProvider>
    </div>
  );
}
