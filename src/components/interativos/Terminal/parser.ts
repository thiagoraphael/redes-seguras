/**
 * Divide a linha digitada em comandos e argumentos, respeitando aspas.
 * Suporta: pipes (|), sequência (; e &&).
 */

export interface Etapa {
  argv: string[];
}
export interface Sequencia {
  /** Etapas ligadas por pipe. */
  pipeline: Etapa[];
  /** Operador que liga esta sequência à anterior. */
  ligacao: ';' | '&&' | null;
}

export class ErroSintaxe extends Error {}

type Token = { tipo: 'palavra'; valor: string } | { tipo: 'op'; valor: '|' | ';' | '&&' };

export function tokenizar(linha: string): Token[] {
  const tokens: Token[] = [];
  let atual = '';
  let temPalavra = false;
  let aspas: '"' | "'" | null = null;

  const fechar = () => {
    if (temPalavra) tokens.push({ tipo: 'palavra', valor: atual });
    atual = '';
    temPalavra = false;
  };

  for (let i = 0; i < linha.length; i++) {
    const c = linha[i]!;
    if (aspas) {
      if (c === aspas) aspas = null;
      else if (c === '\\' && aspas === '"' && i + 1 < linha.length) atual += linha[++i];
      else atual += c;
      continue;
    }
    if (c === '"' || c === "'") {
      aspas = c;
      temPalavra = true;
    } else if (c === '\\' && i + 1 < linha.length) {
      atual += linha[++i];
      temPalavra = true;
    } else if (/\s/.test(c)) {
      fechar();
    } else if (c === '|' && linha[i + 1] !== '|') {
      fechar();
      tokens.push({ tipo: 'op', valor: '|' });
    } else if (c === ';') {
      fechar();
      tokens.push({ tipo: 'op', valor: ';' });
    } else if (c === '&' && linha[i + 1] === '&') {
      fechar();
      tokens.push({ tipo: 'op', valor: '&&' });
      i++;
    } else {
      atual += c;
      temPalavra = true;
    }
  }
  if (aspas) throw new ErroSintaxe(`unexpected EOF while looking for matching \`${aspas}'`);
  fechar();
  return tokens;
}

export function analisar(linha: string): Sequencia[] {
  const tokens = tokenizar(linha);
  const seqs: Sequencia[] = [];
  let pipeline: Etapa[] = [];
  let argv: string[] = [];
  let ligacao: Sequencia['ligacao'] = null;

  const fecharEtapa = (op: string) => {
    if (argv.length === 0) throw new ErroSintaxe(`syntax error near unexpected token \`${op}'`);
    pipeline.push({ argv });
    argv = [];
  };

  for (const t of tokens) {
    if (t.tipo === 'palavra') {
      argv.push(t.valor);
    } else if (t.valor === '|') {
      fecharEtapa('|');
    } else {
      fecharEtapa(t.valor);
      seqs.push({ pipeline, ligacao });
      pipeline = [];
      ligacao = t.valor;
    }
  }
  if (argv.length) pipeline.push({ argv });
  else if (pipeline.length) throw new ErroSintaxe("syntax error near unexpected token `|'");
  if (pipeline.length) seqs.push({ pipeline, ligacao });
  return seqs;
}

export interface Opcoes {
  flags: Set<string>;
  valores: Map<string, string>;
  posicionais: string[];
  invalida?: string;
}

/**
 * Lê opções curtas no estilo getopt: "-tulpn" vira t,u,l,p,n.
 * `comValor` lista as letras que recebem valor ("-c 4" ou "-c4").
 * `longas` lista opções longas aceitas sem valor (ex.: "help").
 */
export function lerOpcoes(args: string[], comValor: string[] = [], validas?: string, longas: string[] = []): Opcoes {
  const flags = new Set<string>();
  const valores = new Map<string, string>();
  const posicionais: string[] = [];
  let invalida: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === '--') {
      posicionais.push(...args.slice(i + 1));
      break;
    }
    if (a.startsWith('--') && a.length > 2) {
      const nome = a.slice(2);
      if (longas.includes(nome)) flags.add(nome);
      else invalida ??= a;
      continue;
    }
    if (a.startsWith('-') && a.length > 1 && !/^-\d/.test(a)) {
      for (let j = 1; j < a.length; j++) {
        const f = a[j]!;
        if (validas && !validas.includes(f)) {
          invalida ??= `-${f}`;
          continue;
        }
        if (comValor.includes(f)) {
          const resto = a.slice(j + 1);
          const valor = resto || args[++i];
          if (valor === undefined) invalida ??= `-${f}`;
          else valores.set(f, valor);
          break;
        }
        flags.add(f);
      }
      continue;
    }
    posicionais.push(a);
  }
  return { flags, valores, posicionais, invalida };
}
