"use client";

import { useEffect, useMemo, useState } from "react";

function remainingLabel(milliseconds: number): string {
  if (milliseconds <= 0) return "終了";
  const totalSeconds = Math.floor(milliseconds / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const clock = [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
  return days > 0 ? `${days}日 ${clock}` : clock;
}

export function TimeSaleCountdown({
  endAt,
  multipleEndTimes,
}: {
  endAt: string;
  multipleEndTimes: boolean;
}) {
  const endTime = useMemo(() => new Date(endAt).getTime(), [endAt]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!Number.isFinite(endTime) || endTime <= now) return null;

  const formattedEnd = new Date(endTime).toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <div className="time-sale-countdown" title={`終了予定: ${formattedEnd}`}>
      <span>{multipleEndTimes ? "タイムセール 最短終了まで" : "タイムセール終了まで"}</span>
      <strong>{remainingLabel(endTime - now)}</strong>
      <small>{formattedEnd}</small>
    </div>
  );
}
