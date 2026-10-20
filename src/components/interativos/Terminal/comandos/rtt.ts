import type { Contexto } from '../tipos';
import type { HostRede } from '@/schemas';

export function sortearLatencia(ctx: Contexto, faixa: [number, number], extra = 0): number {
  const [min, max] = faixa;
  return min + (max - min) * ctx.rng() + extra;
}

/** Formato do iputils: 3 casas abaixo de 1 ms, 2 abaixo de 10, 1 abaixo de 100. */
export function fmtTempo(ms: number): string {
  if (ms < 1) return ms.toFixed(3);
  if (ms < 10) return ms.toFixed(2);
  if (ms < 100) return ms.toFixed(1);
  return Math.round(ms).toString();
}

export function faixaDe(host: HostRede | undefined, local: boolean): [number, number] {
  if (local) return [0.02, 0.08];
  return host?.latenciaMs ?? [0.3, 1.2];
}
