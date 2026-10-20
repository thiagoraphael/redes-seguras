/** Comandos de apoio: help, clear, history, echo, whoami, hostname, cat, etc. */
import type { Comando, Contexto } from '../tipos';
import { falha, ok } from '../tipos';
import { ipsLocais } from '../rede';

export const AJUDA: Record<string, string> = {
  ip: 'mostra endereços (ip a), rotas (ip r) e vizinhos (ip n)',
  ss: 'lista conexões e portas abertas (ss -tulpn)',
  ping: 'testa se um host responde (ping -c 4 HOST)',
  traceroute: 'mostra o caminho até um host (traceroute -n HOST)',
  dig: 'consulta o DNS (dig NOME, dig +short NOME, dig -x IP)',
  tcpdump: 'captura pacotes, precisa de sudo (sudo tcpdump -n -i enp0s3)',
  cat: 'mostra arquivos: /etc/resolv.conf, /etc/hosts, /etc/hostname',
  hostname: 'nome da máquina (hostname -I mostra os IPs)',
  history: 'comandos digitados nesta sessão',
  clear: 'limpa a tela (ou Ctrl+L)',
};

function arquivos(ctx: Contexto): Record<string, string> {
  const l = ctx.rede.local;
  const padrao: Record<string, string> = {
    '/etc/hostname': l.hostname,
    '/etc/resolv.conf': [
      '# Gerado para o laboratório (rede isolada)',
      ...l.dnsServidores.map((s) => `nameserver ${s}`),
      `search ${ctx.rede.dominio}`,
    ].join('\n'),
    '/etc/hosts': [
      '127.0.0.1 localhost',
      `127.0.1.1 ${l.hostname}`,
      '',
      '# The following lines are desirable for IPv6 capable hosts',
      '::1     ip6-localhost ip6-loopback',
      'ff02::1 ip6-allnodes',
      'ff02::2 ip6-allrouters',
    ].join('\n'),
  };
  return { ...padrao, ...l.arquivos };
}

const help: Comando = () => {
  const largura = Math.max(...Object.keys(AJUDA).map((k) => k.length));
  return ok([
    'Comandos disponíveis neste simulador:',
    '',
    ...Object.entries(AJUDA).map(([k, v]) => `  ${k.padEnd(largura)}  ${v}`),
    '',
    'Também funcionam: whoami, pwd, echo, date, sudo, man, exit.',
    'Pipes simples: | grep TEXTO, | head -n N, | tail -n N, | wc -l',
    'Teclas: seta para cima/baixo navega no histórico, Tab completa o comando, Ctrl+L limpa.',
    '',
    'A rede é fictícia e isolada. Nada sai do seu navegador.',
  ]);
};

const history: Comando = (_a, ctx) =>
  ok(ctx.historico.map((c, i) => `${String(i + 1).padStart(5)}  ${c}`));

const cat: Comando = (args, ctx) => {
  if (!args.length) return falha('(simulador: o cat sem arquivo ficaria esperando você digitar. Passe um arquivo, ex.: cat /etc/resolv.conf)');
  const arqs = arquivos(ctx);
  const out: string[] = [];
  let codigo = 0;
  for (const a of args) {
    const caminho = a.startsWith('/') ? a : `/home/${ctx.rede.local.usuario}/${a}`;
    if (caminho in arqs) out.push(...arqs[caminho]!.split('\n'));
    else if (caminho === '/etc/shadow' && !ctx.root) {
      out.push('cat: /etc/shadow: Permission denied');
      codigo = 1;
    } else {
      out.push(`cat: ${a}: No such file or directory`);
      codigo = 1;
    }
  }
  return { linhas: out, codigo };
};

const hostname: Comando = (args, ctx) => {
  if (args.includes('-I')) return ok(ipsLocais(ctx.rede).filter((i) => !i.startsWith('127.')).join(' ') + ' ');
  if (args.includes('-f')) return ok(`${ctx.rede.local.hostname}.${ctx.rede.dominio}`);
  return ok(ctx.rede.local.hostname);
};

const date: Comando = (_a, ctx) => {
  const d = ctx.agora();
  return ok(
    d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, year: 'numeric' }).replace(/,/g, ''),
  );
};

const man: Comando = (args) => {
  const c = args[0];
  if (!c) return falha('What manual page do you want?\nFor example, try \'man man\'.');
  if (AJUDA[c]) return ok([`${c}: ${AJUDA[c]}`, '', `(simulador: o manual completo está na aba Teoria e em https://man7.org/linux/man-pages/ . Tente também "${c} --help".)`]);
  return falha(`No manual entry for ${c}`, 16);
};

export const builtins: Record<string, Comando> = {
  help,
  ajuda: help,
  history,
  clear: () => ({ linhas: [], limpar: true, codigo: 0 }),
  echo: (args) => ok(args.join(' ')),
  whoami: (_a, ctx) => ok(ctx.root ? 'root' : ctx.rede.local.usuario),
  id: (_a, ctx) =>
    ok(ctx.root ? 'uid=0(root) gid=0(root) groups=0(root)' : `uid=1000(${ctx.rede.local.usuario}) gid=1000(${ctx.rede.local.usuario}) groups=1000(${ctx.rede.local.usuario}),27(sudo)`),
  pwd: (_a, ctx) => ok(ctx.root ? '/root' : `/home/${ctx.rede.local.usuario}`),
  ls: () => ok([]),
  cd: () => ok([]),
  date,
  cat,
  hostname,
  man,
  uname: (args) => ok(args.includes('-a') ? 'Linux srv-lab 6.8.0-45-generic #45-Ubuntu SMP PREEMPT_DYNAMIC x86_64 x86_64 x86_64 GNU/Linux' : 'Linux'),
  exit: () => ok('(simulador: não dá para sair. Feche a aba ou continue as missões.)'),
  logout: () => ok('(simulador: não dá para sair. Feche a aba ou continue as missões.)'),
};

/** Comandos que existem no Ubuntu mas ainda não foram simulados. */
export const NAO_INSTALADOS: Record<string, string> = {
  nmap: "Command 'nmap' not found, but can be installed with:\nsudo apt install nmap\n\n(simulador: o nmap entra num próximo encontro.)",
  ifconfig: "Command 'ifconfig' not found, but can be installed with:\nsudo apt install net-tools\n\n(dica: o substituto moderno é o ip a)",
  netstat: "Command 'netstat' not found, but can be installed with:\nsudo apt install net-tools\n\n(dica: o substituto moderno é o ss -tulpn)",
  nslookup: "(simulador: use o dig, que mostra mais detalhes da resposta DNS.)",
  route: "Command 'route' not found, but can be installed with:\nsudo apt install net-tools\n\n(dica: o substituto moderno é o ip r)",
};
