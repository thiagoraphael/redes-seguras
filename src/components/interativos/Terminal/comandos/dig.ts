/** dig (BIND 9). Suporta: @servidor, tipo, -x, +short, +noall +answer. */
import type { Comando, Contexto } from '../tipos';
import { falha, ok } from '../tipos';
import { ehIpv4 } from '@/lib/ip';
import { consultarDns, hostPorIp, nomeEstaNoLab } from '../rede';

const VERSAO = '9.18.30-0ubuntu0.24.04.2-Ubuntu';
const TIPOS = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'PTR', 'SOA', 'ANY'];

function fqdn(n: string) {
  return n.endsWith('.') ? n : `${n}.`;
}

function quando(d: Date): string {
  const dias = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const meses = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const p = (x: number) => String(x).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const sinal = off >= 0 ? '+' : '-';
  const tz = `${sinal}${p(Math.floor(Math.abs(off) / 60))}`;
  return `${dias[d.getDay()]} ${meses[d.getMonth()]} ${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} ${tz} ${d.getFullYear()}`;
}

function servidorResponde(ctx: Contexto, ip: string): boolean {
  if (ctx.rede.local.dnsServidores.includes(ip)) return true;
  return hostPorIp(ctx.rede, ip)?.servicos.some((s) => s.porta === 53) ?? false;
}

type Reg = { nome: string; ttl: number; tipo: string; valor: string };

export const dig: Comando = (args, ctx) => {
  let servidor = ctx.rede.local.dnsServidores[0]!;
  let curto = false;
  let soResposta = false;
  let reverso = false;
  let nome: string | undefined;
  let tipo = 'A';
  const linhaCmd = args.join(' ');

  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a.startsWith('@')) servidor = a.slice(1);
    else if (a === '+short') curto = true;
    else if (a === '+noall') soResposta = true;
    else if (a === '+answer') {
      /* usado junto com +noall */
    } else if (a.startsWith('+')) {
      /* outras opções + são aceitas e ignoradas */
    } else if (a === '-x') {
      reverso = true;
      nome = args[++i];
      tipo = 'PTR';
    } else if (a === '-t') tipo = (args[++i] ?? 'A').toUpperCase();
    else if (a === '-h') return ok('Usage:  dig [@global-server] [domain] [q-type] [q-class] {q-opt}\n        dig -x IP   (consulta reversa)\n        +short      só a resposta');
    else if (a.startsWith('-')) return falha(`Invalid option: ${a}\nUsage:  dig [@global-server] [domain] [q-type] [q-class] {q-opt}`, 1);
    else if (!nome) nome = a;
    else if (TIPOS.includes(a.toUpperCase())) tipo = a.toUpperCase();
    else if (a.toUpperCase() === 'IN') {
      /* classe padrão */
    } else nome = a;
  }

  if (!servidorResponde(ctx, servidor)) {
    const erro = `;; communications error to ${servidor}#53: ${hostPorIp(ctx.rede, servidor) ? 'connection refused' : 'timed out'}`;
    if (curto) return falha([erro, erro, erro, ';; no servers could be reached'], 9);
    return falha([erro, erro, erro, '', `; <<>> DiG ${VERSAO} <<>> ${linhaCmd}`, '; (1 server found)', ';; global options: +cmd', ';; no servers could be reached'], 9);
  }

  let pergunta = nome ? fqdn(nome.toLowerCase()) : '.';
  if (!nome) tipo = 'NS';
  let status = 'NOERROR';
  const respostas: Reg[] = [];

  if (reverso) {
    if (!nome || !ehIpv4(nome)) return falha(`dig: '${nome ?? ''}' is not a legal IPv4 address`, 1);
    pergunta = `${nome.split('.').reverse().join('.')}.in-addr.arpa.`;
    const a = ctx.rede.dns.find((r) => r.tipo === 'A' && r.valor === nome);
    if (a) respostas.push({ nome: pergunta, ttl: a.ttl, tipo: 'PTR', valor: fqdn(a.nome) });
    else status = 'NXDOMAIN';
  } else if (!nome || !nomeEstaNoLab(ctx.rede, nome)) {
    // A rede do lab é isolada: o DNS interno não alcança a internet.
    status = 'SERVFAIL';
  } else if (tipo === 'A' || tipo === 'ANY') {
    const r = consultarDns(ctx.rede, nome, 'A');
    if (r && 'cadeia' in r) {
      r.cadeia.forEach((c) => respostas.push({ nome: fqdn(c.nome), ttl: c.ttl, tipo: c.tipo, valor: c.tipo === 'CNAME' ? fqdn(c.valor) : c.valor }));
    } else {
      const existe = ctx.rede.dns.some((x) => x.nome.toLowerCase().replace(/\.$/, '') === nome!.toLowerCase().replace(/\.$/, ''));
      if (!existe) status = 'NXDOMAIN';
    }
  } else {
    const r = consultarDns(ctx.rede, nome, tipo);
    if (r && 'registros' in r) {
      r.registros.forEach((x) =>
        respostas.push({ nome: fqdn(x.nome), ttl: x.ttl, tipo: x.tipo, valor: x.tipo === 'MX' ? `${x.prioridade ?? 10} ${fqdn(x.valor)}` : x.tipo === 'TXT' ? `"${x.valor}"` : ['CNAME', 'NS', 'PTR'].includes(x.tipo) ? fqdn(x.valor) : x.valor }),
      );
    } else {
      const existe = ctx.rede.dns.some((x) => x.nome.toLowerCase().replace(/\.$/, '') === nome!.toLowerCase().replace(/\.$/, ''));
      if (!existe) status = 'NXDOMAIN';
    }
  }

  if (curto) return ok(respostas.map((r) => r.valor));

  const linhasResp = respostas.map((r) => `${r.nome}\t\t${r.ttl}\tIN\t${r.tipo}\t${r.valor}`);
  if (soResposta) return ok(linhasResp);

  const id = Math.floor(ctx.rng() * 65535);
  const tempo = status === 'SERVFAIL' ? 4 + Math.floor(ctx.rng() * 20) : Math.max(1, Math.round(ctx.rng() * 3));
  const tamanho = 12 + pergunta.length + 5 + respostas.reduce((s, r) => s + 12 + r.valor.length, 0) + 11;
  const flags = status === 'SERVFAIL' ? 'qr rd ra' : 'qr aa rd ra';

  const out = [
    '',
    `; <<>> DiG ${VERSAO} <<>> ${linhaCmd}`,
    ...(servidor !== ctx.rede.local.dnsServidores[0] ? ['; (1 server found)'] : []),
    ';; global options: +cmd',
    ';; Got answer:',
    `;; ->>HEADER<<- opcode: QUERY, status: ${status}, id: ${id}`,
    `;; flags: ${flags}; QUERY: 1, ANSWER: ${respostas.length}, AUTHORITY: 0, ADDITIONAL: 1`,
    '',
    ';; OPT PSEUDOSECTION:',
    '; EDNS: version: 0, flags:; udp: 1232',
    ';; QUESTION SECTION:',
    `;${pergunta}\t\t\tIN\t${tipo}`,
    '',
  ];
  if (respostas.length) out.push(';; ANSWER SECTION:', ...linhasResp, '');
  out.push(
    `;; Query time: ${tempo} msec`,
    `;; SERVER: ${servidor}#53(${servidor}) (UDP)`,
    `;; WHEN: ${quando(ctx.agora())}`,
    `;; MSG SIZE  rcvd: ${tamanho}`,
    '',
  );
  if (status === 'SERVFAIL') {
    out.push('(simulador: a rede do lab é isolada. O DNS interno só conhece nomes de ' + ctx.rede.dominio + '.)');
  }
  return ok(out);
};
