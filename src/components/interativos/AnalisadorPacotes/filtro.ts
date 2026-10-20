/**
 * Filtro de exibição no estilo Wireshark (subconjunto).
 * Campos: ip.addr ip.src ip.dst tcp.port tcp.srcport tcp.dstport udp.port udp.srcport udp.dstport
 *         tcp.stream http.request.method http.request.uri http.host http.response.code dns.qry.name frame.len
 * Protocolos sozinhos: eth ip tcp udp http dns tls icmp arp http.request http.response
 * Operadores: == != > < >= <= contains, && || ! and or not, parênteses. IP aceita CIDR (ip.addr == 192.168.56.0/24).
 */
import type { Pacote } from '@/schemas';
import { ehIpv4, ipNaRede } from '@/lib/ip';

export class ErroFiltro extends Error {}
export type Predicado = (p: Pacote) => boolean;

type Valor = string | number;

function valores(p: Pacote, campo: string): Valor[] | null {
  const c = p.camadas;
  const tcp = c.tcp;
  const udp = c.udp;
  switch (campo) {
    case 'ip.addr':
      return [p.src, p.dst];
    case 'ip.src':
      return [p.src];
    case 'ip.dst':
      return [p.dst];
    case 'tcp.port':
      return tcp ? [tcp.srcport, tcp.dstport] : [];
    case 'tcp.srcport':
      return tcp ? [tcp.srcport] : [];
    case 'tcp.dstport':
      return tcp ? [tcp.dstport] : [];
    case 'udp.port':
      return udp ? [udp.srcport, udp.dstport] : [];
    case 'udp.srcport':
      return udp ? [udp.srcport] : [];
    case 'udp.dstport':
      return udp ? [udp.dstport] : [];
    case 'tcp.stream':
      return p.stream !== undefined && tcp ? [p.stream] : [];
    case 'http.request.method':
      return c.http?.request ? [c.http.request.method] : [];
    case 'http.request.uri':
      return c.http?.request ? [c.http.request.uri] : [];
    case 'http.host':
      return c.http?.request?.headers.Host ? [c.http.request.headers.Host] : [];
    case 'http.response.code':
      return c.http?.response ? [c.http.response.code] : [];
    case 'dns.qry.name':
      return c.dns ? [c.dns.query] : [];
    case 'frame.len':
      return [p.len];
    default:
      return null;
  }
}

function temProtocolo(p: Pacote, nome: string): boolean | null {
  const pr = p.proto.toLowerCase();
  switch (nome) {
    case 'eth':
    case 'frame':
      return true;
    case 'ip':
      return pr !== 'arp';
    case 'tcp':
      return !!p.camadas.tcp;
    case 'udp':
      return !!p.camadas.udp;
    case 'http':
      return !!p.camadas.http;
    case 'http.request':
      return !!p.camadas.http?.request;
    case 'http.response':
      return !!p.camadas.http?.response;
    case 'dns':
      return !!p.camadas.dns;
    case 'tls':
    case 'ssl':
      return !!p.camadas.tls;
    case 'icmp':
      return !!p.camadas.icmp || pr === 'icmp';
    case 'arp':
      return pr === 'arp';
    default:
      return null;
  }
}

type Tok = { t: 'id' | 'str' | 'num' | 'op' | 'p'; v: string };

function lexer(s: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '(' || c === ')') {
      toks.push({ t: 'p', v: c });
      i++;
      continue;
    }
    if (c === '"') {
      const fim = s.indexOf('"', i + 1);
      if (fim < 0) throw new ErroFiltro('Aspas sem fechar.');
      toks.push({ t: 'str', v: s.slice(i + 1, fim) });
      i = fim + 1;
      continue;
    }
    const dois = s.slice(i, i + 2);
    if (['==', '!=', '>=', '<=', '&&', '||'].includes(dois)) {
      toks.push({ t: 'op', v: dois });
      i += 2;
      continue;
    }
    if (['>', '<', '!'].includes(c)) {
      toks.push({ t: 'op', v: c });
      i++;
      continue;
    }
    const m = /^[A-Za-z0-9_.:/-]+/.exec(s.slice(i));
    if (!m) throw new ErroFiltro(`Caractere inesperado: "${c}"`);
    const w = m[0];
    const baixo = w.toLowerCase();
    if (['and', 'or', 'not', 'contains', 'eq', 'ne', 'gt', 'lt', 'ge', 'le'].includes(baixo)) {
      const mapa: Record<string, string> = { and: '&&', or: '||', not: '!', eq: '==', ne: '!=', gt: '>', lt: '<', ge: '>=', le: '<=', contains: 'contains' };
      toks.push({ t: 'op', v: mapa[baixo]! });
    } else if (/^\d+$/.test(w)) toks.push({ t: 'num', v: w });
    else toks.push({ t: 'id', v: w });
    i += w.length;
  }
  return toks;
}

function comparar(a: Valor, op: string, b: string): boolean {
  if (op === 'contains') return String(a).toLowerCase().includes(b.toLowerCase());
  if (typeof a === 'string' && ehIpv4(a)) {
    if (op === '==') return b.includes('/') ? ipNaRede(a, b) : a === b;
    if (op === '!=') return b.includes('/') ? !ipNaRede(a, b) : a !== b;
  }
  const na = Number(a);
  const nb = Number(b);
  const numerico = !Number.isNaN(na) && !Number.isNaN(nb) && b !== '';
  switch (op) {
    case '==':
      return numerico ? na === nb : String(a).toLowerCase() === b.toLowerCase();
    case '!=':
      return numerico ? na !== nb : String(a).toLowerCase() !== b.toLowerCase();
    case '>':
      return numerico && na > nb;
    case '<':
      return numerico && na < nb;
    case '>=':
      return numerico && na >= nb;
    case '<=':
      return numerico && na <= nb;
  }
  return false;
}

export function compilar(expr: string): Predicado {
  const toks = lexer(expr);
  let pos = 0;
  const ver = () => toks[pos];
  const prox = () => toks[pos++];

  function primario(): Predicado {
    const t = prox();
    if (!t) throw new ErroFiltro('Expressão incompleta.');
    if (t.t === 'p' && t.v === '(') {
      const e = ou();
      const f = prox();
      if (!f || f.v !== ')') throw new ErroFiltro('Faltou fechar parêntese.');
      return e;
    }
    if (t.t === 'op' && t.v === '!') {
      const e = primario();
      return (p) => !e(p);
    }
    if (t.t !== 'id') throw new ErroFiltro(`Esperava um campo, encontrei "${t.v}".`);
    const campo = t.v.toLowerCase();
    const op = ver();
    if (op && op.t === 'op' && ['==', '!=', '>', '<', '>=', '<=', 'contains'].includes(op.v)) {
      prox();
      const v = prox();
      if (!v || v.t === 'op' || v.t === 'p') throw new ErroFiltro(`Faltou o valor depois de "${op.v}".`);
      const teste: Pacote = { n: 0, t: 0, src: '10.0.0.1', dst: '10.0.0.1', proto: '', len: 0, info: '', camadas: {} };
      if (valores(teste, campo) === null) throw new ErroFiltro(`"${t.v}" não é um campo conhecido neste analisador.`);
      return (p) => (valores(p, campo) ?? []).some((x) => comparar(x, op.v, v.v));
    }
    const teste: Pacote = { n: 0, t: 0, src: '10.0.0.1', dst: '10.0.0.1', proto: '', len: 0, info: '', camadas: {} };
    if (temProtocolo(teste, campo) === null && valores(teste, campo) === null) {
      throw new ErroFiltro(`"${t.v}" não é um campo ou protocolo conhecido.`);
    }
    return (p) => {
      const tem = temProtocolo(p, campo);
      if (tem !== null) return tem;
      return (valores(p, campo) ?? []).length > 0;
    };
  }
  function e(): Predicado {
    let esq = primario();
    while (ver()?.v === '&&') {
      prox();
      const a = esq;
      const b = primario();
      esq = (p) => a(p) && b(p);
    }
    return esq;
  }
  function ou(): Predicado {
    let esq = e();
    while (ver()?.v === '||') {
      prox();
      const a = esq;
      const b = e();
      esq = (p) => a(p) || b(p);
    }
    return esq;
  }

  if (!toks.length) return () => true;
  const pred = ou();
  if (pos < toks.length) throw new ErroFiltro(`Sobrou "${toks[pos]!.v}" no fim do filtro.`);
  return pred;
}
