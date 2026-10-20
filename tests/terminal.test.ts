import { describe, expect, test } from 'vitest';
import { redeSchema } from '@/schemas';
import { executar } from '@/components/interativos/Terminal/motor';
import { respostaCorreta } from '@/components/interativos/comum/respostas';
import json from '../src/content/dados/redes/lab-encontro-02.json';

const rede = redeSchema.parse(json);
const ctx = { rede, historico: [], rng: () => 0.5, agora: () => new Date('2026-10-26T19:30:00-03:00'), root: false };
const rodar = (c: string) => executar(c, ctx).linhas.join('\n');

describe('terminal simulado, encontro 2', () => {
  test('ip a mostra o IP da enp0s3', () => expect(rodar('ip a')).toContain('inet 192.168.56.20/24 brd 192.168.56.255 scope global enp0s3'));
  test('ip r mostra o gateway', () => expect(rodar('ip r')).toMatch(/^default via 192\.168\.56\.1 dev enp0s3/));
  test('ss sem sudo esconde processos de root', () => expect(rodar('ss -tlnp')).not.toContain('nginx'));
  test('sudo ss mostra nginx na 8080', () => expect(rodar('sudo ss -tlnp')).toMatch(/0\.0\.0\.0:8080.*nginx/));
  test('ping usa nome canônico', () => expect(rodar('ping -c 1 gw')).toContain('PING gw.lab.home.arpa (192.168.56.1)'));
  test('ping em host que não responde perde 100%', () => expect(rodar('ping -c 2 10.0.0.15')).toContain('100% packet loss'));
  test('traceroute para no 10.0.0.1', () => expect(rodar('traceroute -n 10.0.0.15')).toMatch(/ 2 {2}10\.0\.0\.1 .*\n 3 {2}\* \* \*/));
  test('dig segue CNAME', () => expect(rodar('dig +short intranet.lab.home.arpa')).toBe('srv-lab.lab.home.arpa.\n192.168.56.20'));
  test('tcpdump exige sudo', () => expect(rodar('tcpdump')).toContain("You don't have permission"));
  test('tcpdump filtra porta', () => {
    const s = rodar('sudo tcpdump -n port 8080');
    expect(s).toContain('192.168.56.30.51920 > 192.168.56.20.8080: Flags [S]');
    expect(s).not.toContain('ICMP');
  });
  test('comando desconhecido', () => expect(rodar('xpto')).toBe('xpto: command not found'));
  test('pipe com grep', () => expect(rodar('ip a | grep -c inet')).toBe('4'));
  test('aspas não fechadas', () => expect(rodar("echo 'oi")).toContain('unexpected EOF'));
  test('&& não roda o segundo se o primeiro falha', () => expect(rodar('xpto && whoami')).not.toContain('aluno'));
});

describe('as 6 missões têm resposta coerente com a saída', () => {
  test.each(rede.missoes.map((m) => [m.id, m] as const))('%s', (_id, m) => {
    const saida = m.comandosSugeridos.map((c) => rodar(c)).join('\n');
    const valor = m.resposta.tipo === 'exata' ? m.resposta.valor : m.resposta.tipo === 'umDe' ? m.resposta.valores[0]! : '';
    expect(saida).toContain(valor);
    expect(respostaCorreta(m.resposta, ` ${valor.toUpperCase()} `)).toBe(true);
    expect(respostaCorreta(m.resposta, '0.0.0.0')).toBe(false);
  });
});
