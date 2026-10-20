/**
 * Utilitários de IPv4 usados pelo simulador e pela validação dos JSONs.
 * Só aceitamos faixas privadas (RFC 1918) e loopback na rede fictícia.
 */

export function ipParaNumero(ip: string): number | null {
  const partes = ip.trim().split('.');
  if (partes.length !== 4) return null;
  let n = 0;
  for (const p of partes) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return n >>> 0;
}

export function numeroParaIp(n: number): string {
  return [24, 16, 8, 0].map((s) => (n >>> s) & 255).join('.');
}

export function ehIpv4(ip: string): boolean {
  return ipParaNumero(ip) !== null;
}

export interface Cidr {
  rede: number;
  prefixo: number;
  ip: string;
}

export function parseCidr(cidr: string): Cidr | null {
  const [ip, pre] = cidr.split('/');
  const n = ipParaNumero(ip ?? '');
  const prefixo = pre === undefined ? 32 : Number(pre);
  if (n === null || !Number.isInteger(prefixo) || prefixo < 0 || prefixo > 32) return null;
  return { rede: (n & mascara(prefixo)) >>> 0, prefixo, ip: ip! };
}

export function mascara(prefixo: number): number {
  return prefixo === 0 ? 0 : (0xffffffff << (32 - prefixo)) >>> 0;
}

export function ipNaRede(ip: string, cidr: string): boolean {
  const n = ipParaNumero(ip);
  const c = parseCidr(cidr);
  if (n === null || !c) return false;
  return ((n & mascara(c.prefixo)) >>> 0) === c.rede;
}

export function broadcast(cidr: string): string {
  const c = parseCidr(cidr);
  if (!c) return '';
  return numeroParaIp((c.rede | (~mascara(c.prefixo) >>> 0)) >>> 0);
}

const FAIXAS_PERMITIDAS = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '127.0.0.0/8'];

/** true se o IP está em faixa privada (RFC 1918) ou loopback. */
export function ehIpPrivado(ip: string): boolean {
  return FAIXAS_PERMITIDAS.some((f) => ipNaRede(ip, f));
}

/** Aceita "a.b.c.d" ou "a.b.c.d/nn" e valida que é privado. */
export function ehEnderecoPrivado(valor: string): boolean {
  const [ip] = valor.split('/');
  return ehIpPrivado(ip ?? '') && (valor.includes('/') ? parseCidr(valor) !== null : true);
}

/** Endereço IPv6 link-local (EUI-64) a partir do MAC, como o kernel gera. */
export function linkLocalDeMac(mac: string): string {
  const b = mac.split(':').map((h) => parseInt(h, 16));
  if (b.length !== 6 || b.some((x) => Number.isNaN(x))) return 'fe80::1';
  b[0] = b[0]! ^ 0x02;
  const bytes = [b[0], b[1], b[2], 0xff, 0xfe, b[3], b[4], b[5]] as number[];
  const grupos: string[] = [];
  for (let i = 0; i < 8; i += 2) grupos.push(((bytes[i]! << 8) | bytes[i + 1]!).toString(16));
  return `fe80::${grupos.join(':')}`;
}
