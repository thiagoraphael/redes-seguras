/** ss (iproute2): sockets TCP/UDP. Flags: -t -u -l -a -n -p -4 -6 -H. */
import type { Comando } from '../tipos';
import { falha, ok } from '../tipos';
import { lerOpcoes } from '../parser';
import { nomeServico } from './servicos';
import type { SocketRede } from '@/schemas';

function separar(end: string): [string, string] {
  const i = end.lastIndexOf(':');
  return [end.slice(0, i), end.slice(i + 1)];
}

function formatarEnd(end: string, numerico: boolean): [string, string] {
  const [host, porta] = separar(end);
  const p = porta === '*' || numerico ? porta : nomeServico(Number(porta));
  return [host, p];
}

export const ss: Comando = (args, ctx) => {
  const o = lerOpcoes(args, [], 'tulanpH46e', ['help']);
  if (o.flags.has('help')) {
    return ok(
      'Usage: ss [ OPTIONS ]\n   -t  sockets TCP\n   -u  sockets UDP\n   -l  só os que estão escutando\n   -a  todos\n   -n  não traduz portas em nomes\n   -p  mostra o processo (precisa de sudo para ver processos de outros usuários)\n   -H  sem cabeçalho',
    );
  }
  if (o.invalida) return falha(`ss: invalid option -- '${o.invalida.replace(/^-+/, '')}'\nUsage: ss [ OPTIONS ]`, 1);
  const f = o.flags;
  let protos: SocketRede['proto'][] = [];
  if (f.has('t')) protos.push('tcp');
  if (f.has('u')) protos.push('udp');
  if (!protos.length) protos = ['tcp', 'udp'];
  const numerico = f.has('n');

  const lista = ctx.rede.local.sockets.filter((s) => {
    if (!protos.includes(s.proto)) return false;
    const escutando = s.estado === 'LISTEN' || s.estado === 'UNCONN';
    if (f.has('a')) return true;
    if (f.has('l')) return escutando;
    return !escutando;
  });

  const mostrarNetid = protos.length > 1;
  const linhas = lista.map((s) => {
    const [lh, lp] = formatarEnd(s.local, numerico);
    const peer = s.remoto ?? (s.local.startsWith('[') ? '[::]:*' : '0.0.0.0:*');
    const [ph, pp] = formatarEnd(peer, numerico);
    const podeVer = ctx.root || s.dono === ctx.rede.local.usuario;
    const proc = f.has('p') && podeVer ? `users:(("${s.processo}",pid=${s.pid},fd=${s.fd}))` : '';
    return { netid: s.proto, estado: s.estado, rq: '0', sq: s.estado === 'LISTEN' ? '4096' : '0', lh, lp, ph, pp, proc };
  });

  const cab = { netid: 'Netid', estado: 'State', rq: 'Recv-Q', sq: 'Send-Q', lh: 'Local Address', lp: 'Port', ph: 'Peer Address', pp: 'Port', proc: f.has('p') ? 'Process' : '' };
  const todas = [cab, ...linhas];
  const w = (k: keyof typeof cab) => Math.max(...todas.map((l) => l[k].length));
  const wl = Math.max(w('lh'), 13);
  const wp = Math.max(w('ph'), 12);

  const montar = (l: typeof cab, ehCab: boolean) => {
    const partes: string[] = [];
    if (mostrarNetid) partes.push(l.netid.padEnd(w('netid')));
    partes.push(l.estado.padEnd(Math.max(w('estado'), 6)), l.rq.padEnd(6), l.sq.padEnd(6));
    if (ehCab) {
      partes.push(`${'Local Address'.padStart(wl)}:${'Port'.padEnd(w('lp'))}`, `${'Peer Address'.padStart(wp)}:${'Port'.padEnd(w('pp'))}`);
    } else {
      partes.push(`${l.lh.padStart(wl)}:${l.lp.padEnd(w('lp'))}`, `${l.ph.padStart(wp)}:${l.pp.padEnd(w('pp'))}`);
    }
    if (l.proc) partes.push(l.proc);
    return partes.join(' ').trimEnd();
  };

  const saida = linhas.map((l) => montar(l, false));
  if (!f.has('H')) saida.unshift(montar(cab, true));
  if (f.has('p') && !ctx.root && lista.some((s) => s.dono !== ctx.rede.local.usuario)) {
    saida.push('', '(dica do simulador: a coluna Process fica vazia para processos de outros usuários. Tente com sudo.)');
  }
  return ok(saida);
};
