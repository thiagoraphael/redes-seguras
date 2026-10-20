/** Executa uma linha digitada: sudo, pipes (grep/head/tail/wc), ; e &&. */
import { COMANDOS } from './comandos';
import { NAO_INSTALADOS } from './comandos/builtins';
import { analisar, ErroSintaxe, lerOpcoes } from './parser';
import type { Contexto, Resultado } from './tipos';
import { falha } from './tipos';

type Filtro = (entrada: string[], args: string[]) => Resultado;

const FILTROS: Record<string, Filtro> = {
  grep: (entrada, args) => {
    const o = lerOpcoes(args, ['e'], 'ivcne');
    if (o.invalida) return falha(`grep: invalid option -- '${o.invalida.replace(/^-+/, '')}'\nUsage: grep [OPTION]... PATTERNS [FILE]...`, 2);
    const padrao = o.valores.get('e') ?? o.posicionais[0];
    if (padrao === undefined) return falha("Usage: grep [OPTION]... PATTERNS [FILE]...\nTry 'grep --help' for more information.", 2);
    let re: RegExp;
    try {
      re = new RegExp(padrao, o.flags.has('i') ? 'i' : '');
    } catch {
      re = new RegExp(padrao.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), o.flags.has('i') ? 'i' : '');
    }
    const inv = o.flags.has('v');
    const res = entrada
      .map((l, i) => ({ l, i }))
      .filter(({ l }) => re.test(l) !== inv)
      .map(({ l, i }) => (o.flags.has('n') ? `${i + 1}:${l}` : l));
    if (o.flags.has('c')) return { linhas: [String(res.length)], codigo: res.length ? 0 : 1 };
    return { linhas: res, codigo: res.length ? 0 : 1 };
  },
  head: (entrada, args) => {
    const n = numeroLinhas(args);
    return { linhas: entrada.slice(0, n), codigo: 0 };
  },
  tail: (entrada, args) => {
    const n = numeroLinhas(args);
    return { linhas: n === 0 ? [] : entrada.slice(-n), codigo: 0 };
  },
  wc: (entrada, args) => {
    if (args.includes('-l')) return { linhas: [String(entrada.length)], codigo: 0 };
    const palavras = entrada.join(' ').split(/\s+/).filter(Boolean).length;
    const bytes = entrada.reduce((s, l) => s + l.length + 1, 0);
    return { linhas: [`${String(entrada.length).padStart(7)} ${String(palavras).padStart(7)} ${String(bytes).padStart(7)}`], codigo: 0 };
  },
  sort: (entrada) => ({ linhas: [...entrada].sort(), codigo: 0 }),
};

function numeroLinhas(args: string[]): number {
  const o = lerOpcoes(args, ['n']);
  const curto = args.find((a) => /^-\d+$/.test(a));
  if (curto) return Number(curto.slice(1));
  return o.valores.has('n') ? Number(o.valores.get('n')) : 10;
}

function rodarSimples(argv: string[], ctx: Contexto, entrada?: string[]): Resultado {
  let [nome, ...args] = argv as [string, ...string[]];
  let root = ctx.root;
  if (nome === 'sudo') {
    if (!args.length) return falha('usage: sudo [-h] command', 1);
    if (args[0] === '-i' || args[0] === '-s' || args[0] === 'su') {
      return falha('(simulador: não abrimos shell de root aqui. Use sudo na frente de cada comando, ex.: sudo tcpdump)');
    }
    [nome, ...args] = args as [string, ...string[]];
    root = true;
  }
  if (entrada && FILTROS[nome]) return FILTROS[nome]!(entrada, args);
  if (FILTROS[nome]) return falha(`(simulador: ${nome} só funciona depois de um pipe, ex.: ip a | ${nome} ...)`);
  const cmd = COMANDOS[nome];
  if (cmd) {
    try {
      return cmd(args, { ...ctx, root });
    } catch (e) {
      console.error(e);
      return falha(`(simulador: erro interno ao rodar ${nome}. Avise o professor.)`);
    }
  }
  if (NAO_INSTALADOS[nome]) return falha(NAO_INSTALADOS[nome]!, 127);
  return falha(`${nome}: command not found`, 127);
}

export function executar(linha: string, ctx: Contexto): Resultado {
  const texto = linha.trim();
  if (!texto || texto.startsWith('#')) return { linhas: [], codigo: 0 };
  let seqs;
  try {
    seqs = analisar(texto);
  } catch (e) {
    if (e instanceof ErroSintaxe) return falha(`bash: ${e.message}`, 2);
    throw e;
  }
  const saida: string[] = [];
  let ultimo: Resultado = { linhas: [], codigo: 0 };
  for (const seq of seqs) {
    if (seq.ligacao === '&&' && ultimo.codigo !== 0) break;
    let atual: Resultado | undefined;
    for (const etapa of seq.pipeline) {
      atual = rodarSimples(etapa.argv, ctx, atual?.linhas);
      if (atual.limpar) return atual;
    }
    ultimo = atual!;
    saida.push(...ultimo.linhas);
  }
  return { linhas: saida, codigo: ultimo.codigo };
}

export function completar(prefixo: string): string[] {
  const nomes = Object.keys(COMANDOS).filter((n) => n !== 'ajuda');
  return nomes.filter((n) => n.startsWith(prefixo)).sort();
}
