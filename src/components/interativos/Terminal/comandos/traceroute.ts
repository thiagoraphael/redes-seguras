/** traceroute (UDP, 30 saltos, 3 sondas por salto). */
import type { Comando } from '../tipos';
import { falha } from '../tipos';
import { lerOpcoes } from '../parser';
import { caminhoAte, ehLocal, hostPorIp, nomeReverso, resolver, rotaPara } from '../rede';
import { fmtTempo } from './rtt';

export const traceroute: Comando = (args, ctx) => {
  const o = lerOpcoes(args, ['m', 'q', 'w', 'p', 'f'], 'mqwpfnI4ITU', ['help']);
  if (o.flags.has('help')) {
    return { linhas: ['Usage: traceroute [ -n ] [ -I ] [ -m max_ttl ] host', '  -n  não converte IPs em nomes', '  -I  usa ICMP ECHO em vez de UDP'], codigo: 0 };
  }
  if (o.invalida) return falha(`Bad option \`${o.invalida}' (argc 1)`, 2);
  const destino = o.posicionais[0];
  if (!destino) return falha('Usage: traceroute [ -46dFITnreAUDV ] [ -f first_ttl ] [ -m max_ttl ] host [ packetlen ]', 2);
  const res = resolver(ctx.rede, destino);
  if (!res) return falha([`${destino}: Name or service not known`, `Cannot handle "host" cmdline arg \`${destino}' on position 1 (argc 1)`], 2);
  const max = o.valores.has('m') ? Number(o.valores.get('m')) : 30;
  const numerico = o.flags.has('n');
  const { ip } = res;

  if (!ehLocal(ctx.rede, ip) && !rotaPara(ctx.rede, ip)) {
    return falha(['connect: Network is unreachable'], 1);
  }

  const out = [`traceroute to ${destino} (${ip}), ${max} hops max, 60 byte packets`];
  const caminho = caminhoAte(ctx.rede, ip).slice(0, max);
  let acumulado = 0;
  caminho.forEach((salto, i) => {
    const n = String(i + 1).padStart(2);
    if (salto === '*') {
      out.push(`${n}  * * *`);
      return;
    }
    const h = hostPorIp(ctx.rede, salto);
    const faixa = ehLocal(ctx.rede, salto) ? ([0.02, 0.06] as [number, number]) : (h?.latenciaMs ?? [0.3, 0.9]);
    acumulado += faixa[0];
    const tempos = [0, 1, 2].map(() => fmtTempo(acumulado + (faixa[1] - faixa[0]) * ctx.rng()) + ' ms');
    const nome = numerico ? null : nomeReverso(ctx.rede, salto);
    const rotulo = numerico ? salto : `${nome ?? salto} (${salto})`;
    out.push(`${n}  ${rotulo}  ${tempos.join('  ')}`);
  });
  if (caminho[caminho.length - 1] === '*') {
    out.push('', `(simulador: o traceroute real continuaria mostrando * * * até o salto ${max}. Paramos aqui para não encher a tela.)`);
  }
  return { linhas: out, codigo: 0 };
};
