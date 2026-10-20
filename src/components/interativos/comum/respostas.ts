import type { Resposta } from '@/schemas';
import { normalizar } from '@/lib/texto';

/** Confere a resposta digitada pelo aluno, tolerando maiúsculas, acentos e espaços. */
export function respostaCorreta(r: Resposta, digitado: string): boolean {
  const v = normalizar(digitado);
  if (!v) return false;
  switch (r.tipo) {
    case 'exata':
      return v === normalizar(r.valor);
    case 'umDe':
      return r.valores.some((x) => normalizar(x) === v);
    case 'regex':
      try {
        return new RegExp(r.padrao, r.flags ?? 'i').test(digitado.trim());
      } catch {
        return false;
      }
    case 'numero': {
      const n = Number(v.replace(',', '.'));
      return Number.isFinite(n) && Math.abs(n - r.valor) <= r.tolerancia;
    }
  }
}
