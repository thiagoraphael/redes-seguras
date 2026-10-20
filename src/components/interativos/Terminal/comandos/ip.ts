/** ip (iproute2): address, link, route, neigh. Saída no formato do iproute2 6.x. */
import type { Comando, Contexto, Resultado } from '../tipos';
import { falha, ok } from '../tipos';
import { broadcast, ehIpv4, linkLocalDeMac } from '@/lib/ip';
import { rotaPara, ehLocal } from '../rede';

type Iface = Contexto['rede']['local']['interfaces'][number];

const OBJETOS: Record<string, string> = {
  a: 'address', ad: 'address', add: 'address', addr: 'address', addre: 'address', addres: 'address', address: 'address',
  l: 'link', li: 'link', lin: 'link', link: 'link',
  r: 'route', ro: 'route', rou: 'route', rout: 'route', route: 'route',
  n: 'neigh', ne: 'neigh', nei: 'neigh', neig: 'neigh', neigh: 'neigh', neighbor: 'neigh', neighbour: 'neigh',
};

const USO = `Usage: ip [ OPTIONS ] OBJECT { COMMAND | help }
where  OBJECT := { address | link | neigh | route | ... }
       OPTIONS := { -4 | -6 | -br[ief] | -c[olor] | -s[tatistics] ... }

(simulador: objetos disponíveis aqui: address, link, route, neigh)`;

function flagsDe(i: Iface): string {
  if (i.nome === 'lo') return '<LOOPBACK,UP,LOWER_UP>';
  return i.estado === 'DOWN' ? '<BROADCAST,MULTICAST>' : '<BROADCAST,MULTICAST,UP,LOWER_UP>';
}
function estadoDe(i: Iface): string {
  return i.nome === 'lo' ? 'UNKNOWN' : i.estado;
}
function qdisc(i: Iface): string {
  return i.nome === 'lo' ? 'noqueue' : 'fq_codel';
}
function linhaLink(i: Iface): string {
  return i.nome === 'lo'
    ? '    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00'
    : `    link/ether ${i.mac.toLowerCase()} brd ff:ff:ff:ff:ff:ff`;
}
function ipv6De(i: Iface): string | null {
  if (i.nome === 'lo') return '::1/128';
  if (!i.ipv6LinkLocal || i.estado === 'DOWN') return null;
  return `${linkLocalDeMac(i.mac)}/64`;
}

function address(ifaces: Iface[], so4: boolean, so6: boolean, breve: boolean): string[] {
  const out: string[] = [];
  ifaces.forEach((i, idx) => {
    const n = idx + 1;
    const v4 = i.ipv4;
    const v6 = ipv6De(i);
    if (breve) {
      const ends = [!so6 && v4, !so4 && v6].filter(Boolean).join(' ');
      out.push(`${i.nome.padEnd(16)} ${estadoDe(i).padEnd(14)} ${ends} `);
      return;
    }
    if ((so4 && !v4) || (so6 && !v6)) return;
    out.push(`${n}: ${i.nome}: ${flagsDe(i)} mtu ${i.mtu} qdisc ${qdisc(i)} state ${estadoDe(i)} group default qlen 1000`);
    if (!so4 && !so6) out.push(linhaLink(i));
    if (v4 && !so6) {
      out.push(
        i.nome === 'lo'
          ? `    inet ${v4} scope host lo`
          : `    inet ${v4} brd ${broadcast(v4)} scope global ${i.nome}`,
      );
      out.push('       valid_lft forever preferred_lft forever');
    }
    if (v6 && !so4) {
      out.push(i.nome === 'lo' ? `    inet6 ${v6} scope host noprefixroute ` : `    inet6 ${v6} scope link `);
      out.push('       valid_lft forever preferred_lft forever');
    }
  });
  return out;
}

function link(ifaces: Iface[], breve: boolean): string[] {
  const out: string[] = [];
  ifaces.forEach((i, idx) => {
    if (breve) {
      out.push(`${i.nome.padEnd(16)} ${estadoDe(i).padEnd(14)} ${i.mac.toLowerCase()} ${flagsDe(i)} `);
      return;
    }
    out.push(`${idx + 1}: ${i.nome}: ${flagsDe(i)} mtu ${i.mtu} qdisc ${qdisc(i)} state ${estadoDe(i)} mode DEFAULT group default qlen 1000`);
    out.push(linhaLink(i));
  });
  return out;
}

function route(ctx: Contexto, args: string[]): Resultado {
  const sub = args[0] ?? 'show';
  if (['show', 'list', 'ls', 'sh', 's', 'lst'].includes(sub)) {
    return ok(
      ctx.rede.local.rotas.map((r) => {
        const partes = [r.destino];
        if (r.via) partes.push('via', r.via);
        partes.push('dev', r.dev);
        if (r.proto) partes.push('proto', r.proto);
        if (r.scope) partes.push('scope', r.scope);
        if (r.src) partes.push('src', r.src);
        if (r.metric !== undefined) partes.push('metric', String(r.metric));
        return partes.join(' ') + ' ';
      }),
    );
  }
  if (sub === 'get' || sub === 'g') {
    const alvo = args[1];
    if (!alvo) return falha('Command line is not complete. Try "ip route help".', 255);
    if (!ehIpv4(alvo)) return falha(`Error: any valid prefix is expected rather than "${alvo}".`, 1);
    const uid = ctx.root ? 0 : 1000;
    if (ehLocal(ctx.rede, alvo)) {
      return ok([`local ${alvo} dev lo table local src ${alvo} uid ${uid} `, '    cache <local> ']);
    }
    const r = rotaPara(ctx.rede, alvo);
    if (!r) return falha('RTNETLINK answers: Network is unreachable', 2);
    return ok([`${alvo} ${r.via ? `via ${r.via} ` : ''}dev ${r.dev} src ${r.src} uid ${uid} `, '    cache ']);
  }
  if (['add', 'del', 'delete', 'change', 'replace', 'flush'].includes(sub)) {
    return ctx.root
      ? falha('(simulador: alterar rotas está desativado neste lab para não quebrar as missões)')
      : falha('RTNETLINK answers: Operation not permitted', 2);
  }
  if (sub === 'help') return ok('Usage: ip route { list | get } ...\n(simulador: use "ip route" ou "ip route get IP")');
  return falha(`Command "${sub}" is unknown, try "ip route help".`, 255);
}

function neigh(ctx: Contexto): Resultado {
  const out: string[] = [];
  for (const h of ctx.rede.hosts) {
    if (!h.mac) continue;
    const r = rotaPara(ctx.rede, h.ip);
    if (!r || r.via) continue;
    out.push(`${h.ip} dev ${r.dev} lladdr ${h.mac.toLowerCase()} ${h.respondePing ? 'REACHABLE' : 'STALE'} `);
  }
  return ok(out);
}

export const ip: Comando = (args, ctx) => {
  let i = 0;
  let so4 = false;
  let so6 = false;
  let breve = false;
  while (args[i]?.startsWith('-')) {
    const o = args[i]!;
    if (o === '-4') so4 = true;
    else if (o === '-6') so6 = true;
    else if (['-br', '-brief', '-b'].includes(o)) breve = true;
    else if (['-c', '-color', '-s', '-stats', '-statistics', '-d', '-details'].includes(o) || o.startsWith('-c')) {
      /* aceitos e ignorados */
    } else if (o === '-h' || o === '-help') return ok(USO);
    else return falha(`Option "${o}" is unknown, try "ip -help".`, 255);
    i++;
  }
  const objBruto = args[i];
  if (!objBruto) return falha(USO, 255);
  if (objBruto === 'help') return ok(USO);
  const obj = OBJETOS[objBruto];
  if (!obj) return falha(`Object "${objBruto}" is unknown, try "ip help".`, 255);
  const resto = args.slice(i + 1);
  let ifaces = ctx.rede.local.interfaces;

  if (obj === 'route') return route(ctx, resto);
  if (obj === 'neigh') return neigh(ctx);

  // address / link: [show|list] [dev] NOME
  let r = resto;
  if (r[0] && ['show', 'list', 'ls', 'sh', 's', 'lst'].includes(r[0])) r = r.slice(1);
  else if (r[0] && ['add', 'del', 'delete', 'set', 'flush', 'change', 'replace'].includes(r[0])) {
    return ctx.root
      ? falha('(simulador: alterar interfaces está desativado neste lab)')
      : falha('RTNETLINK answers: Operation not permitted', 2);
  } else if (r[0] === 'help') {
    return ok(`Usage: ip ${obj} show [ dev IFNAME ]`);
  } else if (r[0] && r[0] !== 'dev') {
    return falha(`Command "${r[0]}" is unknown, try "ip ${obj} help".`, 255);
  }
  if (r[0] === 'dev') r = r.slice(1);
  if (r[0]) {
    const alvo = ifaces.filter((x) => x.nome === r[0]);
    if (!alvo.length) return falha(`Device "${r[0]}" does not exist.`, 1);
    const idx = ifaces.indexOf(alvo[0]!);
    // mantém o número de índice original
    const linhas = obj === 'address' ? address(ifaces, so4, so6, breve) : link(ifaces, breve);
    const prefixo = `${idx + 1}: ${alvo[0]!.nome}:`;
    if (breve) return ok(linhas.filter((l) => l.startsWith(alvo[0]!.nome + ' ')));
    const inicio = linhas.findIndex((l) => l.startsWith(prefixo));
    if (inicio < 0) return ok([]);
    let fim = linhas.findIndex((l, k) => k > inicio && /^\d+: /.test(l));
    if (fim < 0) fim = linhas.length;
    ifaces = alvo;
    return ok(linhas.slice(inicio, fim));
  }
  return ok(obj === 'address' ? address(ifaces, so4, so6, breve) : link(ifaces, breve));
};
