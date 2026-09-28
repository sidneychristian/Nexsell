"use client";
import { useEffect, useState } from "react";
import { remainingSeconds, formatCountdown } from "../lib/countdown";
type Campaign = { startsAt: string; endsAt: string; serverNow: string };
export function PromotionBanner() {
  const [campaign, setCampaign] = useState<Campaign | null>(null),
    [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    let alive = true,
      deadline = 0,
      interval: ReturnType<typeof setInterval> | undefined;
    const update = async () => {
      try {
        const r = await fetch("/api/billing/promotion", { cache: "no-store" });
        if (!r.ok) return;
        const c = (await r.json()) as Campaign;
        if (!alive) return;
        setCampaign(c);
        deadline =
          performance.now() +
          Math.max(0, Date.parse(c.endsAt) - Date.parse(c.serverNow));
        const tick = () =>
          setRemaining(remainingSeconds(deadline, performance.now()));
        tick();
        if (interval) clearInterval(interval);
        interval = setInterval(tick, 1000);
      } catch {
        /* Não mostrar uma oferta com prazo desconhecido. */
      }
    };
    update();
    const visible = () => {
      if (document.visibilityState === "visible") update();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      alive = false;
      if (interval) clearInterval(interval);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  if (!campaign || remaining === null) return null;
  return (
    <aside className="nx-campaign">
      <div>
        <p className="nx-eyebrow">
          {remaining > 0 ? "Campanha · Starter e Growth" : "Campanha encerrada"}
        </p>
        <h2>
          {remaining > 0
            ? "Subscreva dentro do prazo e receba uma landing page grátis."
            : "O prazo da landing page grátis terminou."}
        </h2>
        <p>
          Na primeira subscrição elegível paga dentro do prazo. A data da
          transferência será verificada pela equipa, mesmo que a aprovação
          ocorra depois.
        </p>
        <p>A criação da página será combinada com a equipa após aprovação.</p>
      </div>
      <div>
        <div
          className="nx-clock"
          role="timer"
          aria-label="Tempo restante em horas, minutos e segundos"
        >
          {formatCountdown(remaining)}
        </div>
        <p>horas : minutos : segundos</p>
        <p>
          Até{" "}
          {new Intl.DateTimeFormat("pt-MZ", {
            timeZone: "Africa/Maputo",
            dateStyle: "short",
            timeStyle: "short",
          }).format(new Date(campaign.endsAt))}
          <br />
          Hora de Maputo
        </p>
      </div>
    </aside>
  );
}
