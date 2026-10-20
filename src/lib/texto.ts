/** Normaliza respostas digitadas: sem acento, minúsculas, espaços colapsados. */
export function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.;]$/, '');
}

export const DISCIPLINAS = {
  ferramentas: {
    nome: 'Ferramentas de Segurança de Rede',
    curto: 'Ferramentas',
    descricao: 'Você opera as ferramentas e interpreta o resultado.',
    aba: 'Lab virtual',
  },
  defensiva: {
    nome: 'Segurança Defensiva',
    curto: 'Defensiva',
    descricao: 'Você decide o que proteger, como e por quê.',
    aba: 'Simulação',
  },
} as const;

export type Disciplina = keyof typeof DISCIPLINAS;

export function formatarData(d: Date): string {
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });
}
