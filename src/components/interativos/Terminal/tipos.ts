import type { Rede } from '@/schemas';

export interface Contexto {
  rede: Rede;
  historico: string[];
  /** Gerador aleatório (injetável para testes). */
  rng: () => number;
  agora: () => Date;
  /** true quando o comando veio depois de "sudo". */
  root: boolean;
}

export interface Resultado {
  linhas: string[];
  /** Pede para limpar a tela (clear, Ctrl+L). */
  limpar?: boolean;
  /** Código de saída, como no bash. 0 = sucesso. */
  codigo?: number;
}

export type Comando = (args: string[], ctx: Contexto) => Resultado;

export const ok = (linhas: string[] | string = []): Resultado => ({
  linhas: Array.isArray(linhas) ? linhas : linhas.split('\n'),
  codigo: 0,
});

export const falha = (linhas: string[] | string, codigo = 1): Resultado => ({
  linhas: Array.isArray(linhas) ? linhas : linhas.split('\n'),
  codigo,
});
