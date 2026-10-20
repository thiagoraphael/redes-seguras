/**
 * tcpdump com saída pré-gravada (definida no JSON da rede).
 * Flags: -i IF, -n/-nn, -c N, -D, -q, -v (ignorado). Filtros: host, net, port,
 * src/dst, tcp/udp/icmp/arp/ip, and/or/not e parênteses.
 */
import type { Comando, Contexto } from '../tipos';
import { falha, ok } from '../tipos';
import { lerOpcoes } from '../parser';
import { ehIpv4, ipNaRede } from '@/lib/ip';
import { nomeReverso, resolver } from '../rede';
import { nomeServico } from './servicos';
import type { LinhaCaptura } from '@/schemas';

type Pred = (l: LinhaCaptura) => boolean;
class ErroFiltro extends Error {}

const PROTOS = ['tcp', 'udp', 'icmp', 'arp', 'ip'];

function protoBate(p: string, l: LinhaCaptura) {
  return p === 'ip' ? l.proto !== 'arp' : l.proto === p;
}

/** Converte a expressão de filtro em predicado. Gramática bem menor que BPF, mas cobre o uso da aula. */
export function compilarFiltro(tokens: string[], ctx: Contexto): Pred {
  let pos = 0;
  const ver = () => tokens[pos];
  const prox = () => tokens[pos++];

  function valorIp(v: string): string {
    if (ehIpv4(v)) return v;
    const r = resolver(ctx.rede, v);
    if (!r) throw new ErroFiltro(`can't resolve ${v}`);
    return r.ip;
  }

  function primitivo(): Pred {
    let proto: string | undefined;
    let dir: 'src' | 'dst' | undefined;
    if (ver() && PROTOS.includes(ver()!)) proto = prox();
    if (ver() === 'src' || ver() === 'dst') dir = prox() as 'src' | 'dst';
    let tipo: string | undefined = ver();
    if (tipo === 'host' || tipo === 'net' || tipo === 'port') prox();
    else if (tipo !== undefined && !['and', 'or', '&&', '||', ')', '(', 'not', '!'].includes(tipo)) tipo = 'host';
    else if (dir) throw new ErroFiltro('syntax error');
    else tipo = undefined;

    if (!tipo) {
      if (!proto) throw new ErroFiltro('syntax error');
      const p = proto;
      return (l) => protoBate(p, l);
    }
    const valor = prox();
    if (valor === undefined) throw new ErroFiltro('syntax error');
    const base: Pred = proto ? (l) => protoBate(proto!, l) : () => true;

    if (tipo === 'port') {
      const porta = Number(valor);
      if (!Number.isInteger(porta)) throw new ErroFiltro(`illegal port number ${valor}`);
      return (l) =>
        base(l) && (dir === 'src' ? l.sport === porta : dir === 'dst' ? l.dport === porta : l.sport === porta || l.dport === porta);
    }
    if (tipo === 'net') {
      if (!valor.includes('/')) throw new ErroFiltro('syntax error');
      return (l) => {
        const s = !!l.src && ipNaRede(l.src, valor);
        const d = !!l.dst && ipNaRede(l.dst, valor);
        return base(l) && (dir === 'src' ? s : dir === 'dst' ? d : s || d);
      };
    }
    const ip = valorIp(valor);
    return (l) => {
      // ARP: o IP aparece no texto (who-has X tell Y)
      const s = l.src === ip || (l.proto === 'arp' && l.info.includes(`tell ${ip}`));
      const d = l.dst === ip || (l.proto === 'arp' && l.info.includes(`who-has ${ip}`));
      return base(l) && (dir === 'src' ? s : dir === 'dst' ? d : s || d);
    };
  }

  function fator(): Pred {
    const t = ver();
    if (t === 'not' || t === '!') {
      prox();
      const f = fator();
      return (l) => !f(l);
    }
    if (t === '(') {
      prox();
      const e = expr();
      if (prox() !== ')') throw new ErroFiltro('syntax error');
      return e;
    }
    return primitivo();
  }
  function termo(): Pred {
    let esq = fator();
    while (ver() === 'and' || ver() === '&&') {
      prox();
      const a = esq;
      const b = fator();
      esq = (l) => a(l) && b(l);
    }
    return esq;
  }
  function expr(): Pred {
    let esq = termo();
    while (ver() === 'or' || ver() === '||') {
      prox();
      const a = esq;
      const b = termo();
      esq = (l) => a(l) || b(l);
    }
    return esq;
  }

  if (!tokens.length) return () => true;
  const p = expr();
  if (pos < tokens.length) throw new ErroFiltro('syntax error');
  return p;
}

function separarTokens(args: string[]): string[] {
  return args.join(' ').replace(/\(/g, ' ( ').replace(/\)/g, ' ) ').split(/\s+/).filter(Boolean);
}

function formatar(l: LinhaCaptura, ctx: Contexto, numerico: boolean): string {
  if (l.proto === 'arp') return `${l.t} ARP, ${l.info}`;
  const host = (ip?: string) => (ip ? (numerico ? ip : nomeReverso(ctx.rede, ip) ?? ip) : '?');
  const porta = (p?: number) => (p === undefined ? '' : `.${numerico ? p : nomeServico(p)}`);
  if (l.proto === 'icmp') return `${l.t} IP ${host(l.src)} > ${host(l.dst)}: ${l.info}`;
  return `${l.t} IP ${host(l.src)}${porta(l.sport)} > ${host(l.dst)}${porta(l.dport)}: ${l.info}`;
}

export const tcpdump: Comando = (args, ctx) => {
  const o = lerOpcoes(args, ['i', 'c', 'w', 'r', 's'], 'icwrsnDqvAXeltS', ['help', 'list-interfaces']);
  if (o.flags.has('help')) {
    return ok('Usage: tcpdump [-Dnqv] [-c count] [-i interface] [ expression ]\n(simulador: a captura é pré-gravada. Exemplos: "sudo tcpdump -n -i enp0s3 port 53", "sudo tcpdump -n icmp")');
  }
  if (o.invalida) return falha(`tcpdump: invalid option -- '${o.invalida.replace(/^-+/, '')}'`, 1);
  const ifaces = ctx.rede.local.interfaces;
  if (o.flags.has('D') || o.flags.has('list-interfaces')) {
    const lista = ifaces.filter((i) => i.nome !== 'lo').map((i, k) => `${k + 1}.${i.nome} ${i.estado === 'DOWN' ? '[none]' : '[Up, Running, Connected]'}`);
    lista.push(`${lista.length + 1}.any (Pseudo-device that captures on all interfaces) [Up, Running]`);
    lista.push(`${lista.length + 1}.lo [Up, Running, Loopback]`);
    return ok(lista);
  }
  const nomeIf = o.valores.get('i') ?? ifaces.find((i) => i.nome !== 'lo' && i.estado === 'UP')?.nome ?? 'lo';
  if (nomeIf !== 'any' && !ifaces.some((i) => i.nome === nomeIf)) {
    return falha([`tcpdump: ${nomeIf}: No such device exists`, '(SIOCGIFHWADDR: No such device)'], 1);
  }
  if (!ctx.root) {
    return falha([
      `tcpdump: ${nomeIf}: You don't have permission to perform this capture on that device`,
      '(socket: Operation not permitted)',
      '',
      '(dica do simulador: capturar pacotes exige privilégio de administrador. Use sudo.)',
    ], 1);
  }
  if (o.valores.has('w') || o.valores.has('r')) {
    return falha('(simulador: ler ou gravar arquivos .pcap não está disponível aqui. Rode sem -w/-r.)', 1);
  }

  let filtro: Pred;
  try {
    filtro = compilarFiltro(separarTokens(o.posicionais), ctx);
  } catch (e) {
    return falha(`tcpdump: ${e instanceof ErroFiltro && e.message !== 'syntax error' ? e.message : 'syntax error in filter expression: syntax error'}`, 1);
  }

  const capturas = ctx.rede.capturas.filter((c) => nomeIf === 'any' || c.interface === nomeIf);
  let linhas = capturas.flatMap((c) => c.linhas).sort((a, b) => a.t.localeCompare(b.t));
  const total = linhas.length;
  linhas = linhas.filter(filtro);
  const limite = o.valores.has('c') ? Number(o.valores.get('c')) : undefined;
  if (limite !== undefined) linhas = linhas.slice(0, limite);

  const numerico = o.flags.has('n');
  const linkType = nomeIf === 'any' ? 'LINUX_SLL2 (Linux cooked v2)' : nomeIf === 'lo' ? 'EN10MB (Ethernet)' : 'EN10MB (Ethernet)';
  const out = [
    'tcpdump: verbose output suppressed, use -v[v]... for full protocol decode',
    `listening on ${nomeIf}, link-type ${linkType}, snapshot length 262144 bytes`,
    ...linhas.map((l) => formatar(l, ctx, numerico)),
  ];
  if (limite === undefined) out.push('^C');
  out.push(
    `${linhas.length} packet${linhas.length === 1 ? '' : 's'} captured`,
    `${limite === undefined ? total : linhas.length} packets received by filter`,
    '0 packets dropped by kernel',
  );
  if (limite === undefined) out.push('', '(simulador: fim da captura gravada, como se você tivesse apertado Ctrl+C.)');
  if (!capturas.length) out.push('(simulador: não há captura gravada para esta interface.)');
  return ok(out);
};
