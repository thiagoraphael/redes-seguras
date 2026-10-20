/** Consultas sobre a rede fictícia: resolução de nomes, rotas e hosts. */
import type { HostRede, Rede } from '@/schemas';
import { ehIpv4, ehIpPrivado, ipNaRede, parseCidr } from '@/lib/ip';

export function ipsLocais(rede: Rede): string[] {
  return rede.local.interfaces.filter((i) => i.ipv4).map((i) => i.ipv4!.split('/')[0]!);
}

export function ehLocal(rede: Rede, ip: string): boolean {
  return ip.startsWith('127.') || ipsLocais(rede).includes(ip);
}

export function hostPorIp(rede: Rede, ip: string): HostRede | undefined {
  return rede.hosts.find((h) => h.ip === ip);
}

function semPonto(n: string) {
  return n.replace(/\.$/, '').toLowerCase();
}

export interface Resolucao {
  ip: string;
  /** Nome canônico (depois de seguir CNAME). */
  nome: string;
  /** Cadeia de CNAMEs percorrida, incluindo o nome consultado. */
  cadeia: { nome: string; tipo: 'CNAME' | 'A'; valor: string; ttl: number }[];
}

/** Resolve só pelo DNS do lab (sem /etc/hosts). */
export function consultarDns(rede: Rede, nome: string, tipo = 'A'): Resolucao | { registros: Rede['dns'] } | null {
  const alvo = semPonto(nome);
  if (tipo !== 'A') {
    const regs = rede.dns.filter((r) => semPonto(r.nome) === alvo && r.tipo === tipo);
    return regs.length ? { registros: regs } : null;
  }
  const cadeia: Resolucao['cadeia'] = [];
  let atual = alvo;
  for (let i = 0; i < 8; i++) {
    const cname = rede.dns.find((r) => semPonto(r.nome) === atual && r.tipo === 'CNAME');
    if (cname) {
      cadeia.push({ nome: atual, tipo: 'CNAME', valor: semPonto(cname.valor), ttl: cname.ttl });
      atual = semPonto(cname.valor);
      continue;
    }
    const a = rede.dns.find((r) => semPonto(r.nome) === atual && r.tipo === 'A');
    if (!a) return null;
    cadeia.push({ nome: atual, tipo: 'A', valor: a.valor, ttl: a.ttl });
    return { ip: a.valor, nome: atual, cadeia };
  }
  return null;
}

export function nomeEstaNoLab(rede: Rede, nome: string): boolean {
  const n = semPonto(nome);
  const d = semPonto(rede.dominio);
  return n === d || n.endsWith(`.${d}`) || !n.includes('.');
}

/** Resolve como um programa comum: /etc/hosts, depois DNS com domínio de busca. */
export function resolver(rede: Rede, alvo: string): { ip: string; nome: string } | null {
  if (ehIpv4(alvo)) return { ip: alvo, nome: alvo };
  const n = semPonto(alvo);
  if (n === 'localhost') return { ip: '127.0.0.1', nome: 'localhost' };
  if (n === rede.local.hostname.toLowerCase()) return { ip: '127.0.1.1', nome: rede.local.hostname };
  const direto = consultarDns(rede, n);
  if (direto && 'ip' in direto) return { ip: direto.ip, nome: direto.nome };
  if (!n.includes('.')) {
    const comDominio = consultarDns(rede, `${n}.${semPonto(rede.dominio)}`);
    if (comDominio && 'ip' in comDominio) return { ip: comDominio.ip, nome: comDominio.nome };
  }
  return null;
}

/** Nome reverso de um IP (PTR implícito a partir dos registros A). */
export function nomeReverso(rede: Rede, ip: string): string | null {
  if (ip === '127.0.0.1') return 'localhost';
  const a = rede.dns.find((r) => r.tipo === 'A' && r.valor === ip);
  return a ? semPonto(a.nome) : null;
}

export interface RotaEscolhida {
  dev: string;
  via?: string;
  src?: string;
}

/** Longest prefix match nas rotas da máquina local. */
export function rotaPara(rede: Rede, ip: string): RotaEscolhida | null {
  let melhor: { prefixo: number; rota: Rede['local']['rotas'][number] } | null = null;
  for (const r of rede.local.rotas) {
    const cidr = r.destino === 'default' ? '0.0.0.0/0' : r.destino.includes('/') ? r.destino : `${r.destino}/32`;
    const c = parseCidr(cidr);
    if (!c) continue;
    if (ipNaRede(ip, cidr) && (!melhor || c.prefixo > melhor.prefixo)) melhor = { prefixo: c.prefixo, rota: r };
  }
  if (!melhor) return null;
  const iface = rede.local.interfaces.find((i) => i.nome === melhor!.rota.dev);
  return {
    dev: melhor.rota.dev,
    via: melhor.rota.via,
    src: melhor.rota.src ?? iface?.ipv4?.split('/')[0],
  };
}

/** Caminho de saltos até o destino (para traceroute e cálculo de TTL). */
export function caminhoAte(rede: Rede, ip: string): (string | '*')[] {
  if (ehLocal(rede, ip)) return [ip];
  const host = hostPorIp(rede, ip);
  if (host?.saltos) return host.saltos;
  const rota = rotaPara(rede, ip);
  if (!rota) return [];
  if (!rota.via) return host ? [ip] : ['*'];
  if (host) return [rota.via, ip];
  // Destino desconhecido: o gateway responde e depois nada.
  return [rota.via, '*', '*', '*'];
}

export function ehPrivadoOuLocal(ip: string) {
  return ehIpPrivado(ip);
}
