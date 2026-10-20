import { gravarJSON, lerJSON, remover } from './storage';

/**
 * Progresso do aluno, só neste navegador. Não é nota e não sai do computador.
 * Chaves de atividade: "<idModulo>:<tipo>" (ex.: "ferramentas/02-diagnostico:terminal").
 */
export interface Progresso {
  versao: 1;
  /** idModulo -> data ISO da primeira visita */
  vistos: Record<string, string>;
  /** idAtividade -> ids de missões/itens concluídos */
  concluidos: Record<string, string[]>;
  /** idAtividade -> total de itens (para mostrar 3/6) */
  totais: Record<string, number>;
  /** idQuiz -> melhor resultado */
  quizzes: Record<string, { acertos: number; total: number; em: string }>;
}

const CHAVE = 'site-redes:progresso:v1';
export const EVENTO = 'site-redes:progresso';

const vazio = (): Progresso => ({ versao: 1, vistos: {}, concluidos: {}, totais: {}, quizzes: {} });

export function lerProgresso(): Progresso {
  return lerJSON<Progresso>(CHAVE, vazio());
}

function salvar(p: Progresso) {
  gravarJSON(CHAVE, p);
  try {
    window.dispatchEvent(new CustomEvent(EVENTO, { detail: p }));
  } catch {
    /* fora do navegador */
  }
}

export function marcarVisto(idModulo: string) {
  const p = lerProgresso();
  if (!p.vistos[idModulo]) {
    p.vistos[idModulo] = new Date().toISOString();
    salvar(p);
  }
}

export function definirTotal(idAtividade: string, total: number) {
  const p = lerProgresso();
  if (p.totais[idAtividade] !== total) {
    p.totais[idAtividade] = total;
    salvar(p);
  }
}

export function concluirItem(idAtividade: string, idItem: string) {
  const p = lerProgresso();
  const lista = new Set(p.concluidos[idAtividade] ?? []);
  if (lista.has(idItem)) return;
  lista.add(idItem);
  p.concluidos[idAtividade] = [...lista];
  salvar(p);
}

export function itensConcluidos(idAtividade: string): string[] {
  return lerProgresso().concluidos[idAtividade] ?? [];
}

export function registrarQuiz(idQuiz: string, acertos: number, total: number) {
  const p = lerProgresso();
  const atual = p.quizzes[idQuiz];
  if (!atual || acertos >= atual.acertos) {
    p.quizzes[idQuiz] = { acertos, total, em: new Date().toISOString() };
    salvar(p);
  }
}

export function reiniciarAtividade(idAtividade: string) {
  const p = lerProgresso();
  delete p.concluidos[idAtividade];
  salvar(p);
}

export function apagarTudo() {
  remover(CHAVE);
  try {
    window.dispatchEvent(new CustomEvent(EVENTO, { detail: vazio() }));
  } catch {
    /* ignora */
  }
}
