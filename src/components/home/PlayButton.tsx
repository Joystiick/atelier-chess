"use client";

import { playSound } from "@/lib/chess/sound";
import { useRouter } from "next/navigation";

type PlayButtonProps = {
  href?: string;
};

export function PlayButton({ href = "/play" }: PlayButtonProps) {
  const router = useRouter();

  return (
    <button
      type="button"
      className="play-btn group relative mt-10 inline-flex h-[4.5rem] min-w-[14rem] items-center justify-center rounded-[1.25rem] px-12 text-2xl font-semibold tracking-wide text-[var(--ink)] transition-transform duration-150 ease-out will-change-transform active:translate-y-[6px] active:scale-[0.98]"
      onClick={() => {
        playSound("click");
        router.push(href);
      }}
    >
      <span className="play-btn-face absolute inset-0 rounded-[1.25rem]" aria-hidden />
      <span className="play-btn-edge absolute inset-x-0 bottom-0 h-[10px] translate-y-[8px] rounded-b-[1.25rem]" aria-hidden />
      <span className="relative z-[1] font-[family-name:var(--font-display)] text-[1.65rem] tracking-[0.04em]">
        Play
      </span>
    </button>
  );
}
