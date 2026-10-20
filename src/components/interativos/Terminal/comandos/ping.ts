/** ping (iputils). Para depois de -c N pacotes; sem -c, para em 4 (simula Ctrl+C). */
import type { Comando } from '../tipos';
import { falha, ok } from '../tipos';
import { lerOpcoes } from '../parser';
import { caminhoAte, ehLocal, hostPorIp, nomeReverso, resolver, rotaPara } from '../rede';
import { faixaDe, fmtTempo, sortearLatencia } from './rtt';

const USO = `
Usage
  ping [options] <destination>

Options:
  <destination>      DNS name or IP address
  -c <count>         stop after <count> replies
  -n                 no dns name resolution
  -q                 quiet output
  -s <size>          use <size> as number of data bytes to be sent
  -4                 use IPv4`;

export const ping: Comando = (args, ctx) => {
  const o = lerOpcoes(args, ['c', 's', 'i', 'W', 'w', 'I', 't'], 'csiWwIt4nqvhO');
  if (o.flags.has('h')) return ok(USO.trim());
  if (o.invalida) return falha(`ping: invalid option -- '${o.invalida.replace(/^-+/, '')}'${USO}`, 2);
  const destino = o.posicionais[0];
  if (!destino) return falha(`ping: usage error: Destination address required`, 1);

  let semCount = false;
  let count = 4;
  if (o.valores.has('c')) {
    count = Number(o.valores.get('c'));
    if (!Number.isInteger(count) || count < 1) return falha(`ping: invalid argument: '${o.valores.get('c')}': out of range: 1 <= value <= 9223372036854775807`, 1);
    count = Math.min(count, 20);
  } else semCount = true;
  const tamanho = o.valores.has('s') ? Number(o.valores.get('s')) : 56;
  const numerico = o.flags.has('n');
  const quieto = o.flags.has('q');

  const res = resolver(ctx.rede, destino);
  if (!res) {
    const externo = destino.includes('.') && !destino.toLowerCase().endsWith(ctx.rede.dominio.toLowerCase());
    return falha(`ping: ${destino}: ${externo ? 'Temporary failure in name resolution' : 'Name or service not known'}`, 2);
  }
  const { ip } = res;
  const local = ehLocal(ctx.rede, ip);
  const rota = local ? { dev: 'lo', src: ip } : rotaPara(ctx.rede, ip);
  if (!rota) return falha('ping: connect: Network is unreachable', 2);

  const host = hostPorIp(ctx.rede, ip);
  const responde = local || (host?.respondePing ?? false);
  const mesmaRede = !local && !('via' in rota && rota.via);
  const inexistenteNaRede = !local && !host && mesmaRede;

  const nomeCab = res.nome;
  const out: string[] = [`PING ${nomeCab} (${ip}) ${tamanho}(${tamanho + 28}) bytes of data.`];
  const saltos = caminhoAte(ctx.rede, ip).length;
  const ttl = local ? 64 : (host?.ttl ?? 64) - Math.max(0, saltos - 1);
  const nomeResp = numerico || destino === ip ? null : (nomeReverso(ctx.rede, ip) ?? (local ? ctx.rede.local.hostname : null));
  const de = nomeResp ? `${nomeResp} (${ip})` : ip;

  const tempos: number[] = [];
  let erros = 0;
  for (let seq = 1; seq <= count; seq++) {
    if (responde) {
      const t = sortearLatencia(ctx, faixaDe(host, local));
      tempos.push(t);
      if (!quieto) out.push(`${tamanho + 8} bytes from ${de}: icmp_seq=${seq} ttl=${ttl} time=${fmtTempo(t)} ms`);
    } else if (inexistenteNaRede) {
      erros++;
      if (!quieto) out.push(`From ${rota.src} icmp_seq=${seq} Destination Host Unreachable`);
    }
  }
  if (semCount && !quieto) out.push('^C');
  out.push('', `--- ${nomeCab} ping statistics ---`);
  const recebidos = tempos.length;
  const perda = Math.round(((count - recebidos) / count) * 100);
  const tempoTotal = (count - 1) * 1000 + Math.round(ctx.rng() * 40 + 2);
  out.push(
    `${count} packets transmitted, ${recebidos} received, ${erros ? `+${erros} errors, ` : ''}${perda}% packet loss, time ${tempoTotal}ms`,
  );
  if (recebidos) {
    const min = Math.min(...tempos);
    const max = Math.max(...tempos);
    const avg = tempos.reduce((a, b) => a + b, 0) / recebidos;
    const mdev = Math.sqrt(tempos.reduce((a, b) => a + (b - avg) ** 2, 0) / recebidos);
    out.push(`rtt min/avg/max/mdev = ${min.toFixed(3)}/${avg.toFixed(3)}/${max.toFixed(3)}/${mdev.toFixed(3)} ms`);
  } else if (erros) {
    out.push(`pipe ${Math.min(count, 4)}`);
  }
  if (semCount) out.push('', '(simulador: o ping real não para sozinho no Linux. Aqui paramos após 4 pacotes, como se você tivesse apertado Ctrl+C. Use -c para escolher.)');
  return { linhas: out, codigo: recebidos ? 0 : 1 };
};
