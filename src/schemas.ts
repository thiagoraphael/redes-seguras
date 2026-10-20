/**
 * Schemas Zod dos dados dos exercícios. São usados pelo content.config.ts
 * (validação no build) e exportam os tipos que os componentes React usam.
 * Se um JSON estiver errado, o build falha com a mensagem do campo.
 */
import { z } from 'astro/zod';
import { ehEnderecoPrivado, ehIpPrivado } from './lib/ip';

const msgPrivado = 'Use só IPs privados (10/8, 172.16/12, 192.168/16) ou loopback. Nunca IPs reais da internet.';
export const ipPrivado = z.string().refine(ehIpPrivado, msgPrivado);
export const enderecoPrivado = z.string().refine(ehEnderecoPrivado, msgPrivado);
/** "ip:porta", "*:porta", "[::]:porta" ou "ip%if:porta" */
const enderecoSocket = z.string().refine((v) => {
  const host = v.slice(0, v.lastIndexOf(':')).replace(/%.*$/, '');
  return host === '*' || host === '[::]' || host === '0.0.0.0' || ehIpPrivado(host);
}, msgPrivado);

/* ---------- Respostas de missões (comum) ---------- */
export const respostaSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('exata'), valor: z.string() }),
  z.object({ tipo: z.literal('umDe'), valores: z.array(z.string()).min(1) }),
  z.object({ tipo: z.literal('regex'), padrao: z.string(), flags: z.string().optional() }),
  z.object({ tipo: z.literal('numero'), valor: z.number(), tolerancia: z.number().default(0) }),
]);
export type Resposta = z.infer<typeof respostaSchema>;

export const missaoSchema = z.object({
  id: z.string(),
  enunciado: z.string(),
  dica: z.string().optional(),
  comandosSugeridos: z.array(z.string()).default([]),
  resposta: respostaSchema,
  explicacao: z.string(),
});
export type Missao = z.infer<typeof missaoSchema>;

/* ---------- Rede fictícia (Terminal) ---------- */
const interfaceSchema = z.object({
  nome: z.string(),
  mac: z.string().regex(/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i),
  ipv4: enderecoPrivado.optional(),
  estado: z.enum(['UP', 'DOWN', 'UNKNOWN']).default('UP'),
  mtu: z.number().default(1500),
  ipv6LinkLocal: z.boolean().default(true),
});

const rotaSchema = z.object({
  destino: z.string(),
  via: ipPrivado.optional(),
  dev: z.string(),
  proto: z.string().optional(),
  scope: z.string().optional(),
  src: ipPrivado.optional(),
  metric: z.number().optional(),
});

const socketSchema = z.object({
  proto: z.enum(['tcp', 'udp']),
  estado: z.enum(['LISTEN', 'UNCONN', 'ESTAB', 'TIME-WAIT']),
  local: enderecoSocket,
  remoto: enderecoSocket.optional(),
  processo: z.string(),
  pid: z.number(),
  fd: z.number().default(3),
  dono: z.string().default('root'),
});

const hostSchema = z.object({
  hostname: z.string(),
  ip: ipPrivado,
  mac: z.string().optional(),
  respondePing: z.boolean().default(true),
  latenciaMs: z.tuple([z.number(), z.number()]).default([0.3, 1.2]),
  ttl: z.number().default(64),
  /** Caminho até o host. "*" = salto que não responde. Sem isso, é calculado. */
  saltos: z.array(z.union([ipPrivado, z.literal('*')])).optional(),
  servicos: z
    .array(z.object({ porta: z.number(), proto: z.enum(['tcp', 'udp']), nome: z.string(), produto: z.string().optional() }))
    .default([]),
});

const registroDnsSchema = z
  .object({
    nome: z.string(),
    tipo: z.enum(['A', 'CNAME', 'MX', 'TXT', 'NS', 'PTR']),
    valor: z.string(),
    ttl: z.number().default(300),
    prioridade: z.number().optional(),
  })
  .refine((r) => r.tipo !== 'A' || ehIpPrivado(r.valor), { message: msgPrivado, path: ['valor'] });

const linhaCapturaSchema = z.object({
  t: z.string(),
  proto: z.enum(['tcp', 'udp', 'icmp', 'arp']),
  src: ipPrivado.optional(),
  dst: ipPrivado.optional(),
  sport: z.number().optional(),
  dport: z.number().optional(),
  info: z.string(),
});
export type LinhaCaptura = z.infer<typeof linhaCapturaSchema>;

export const redeSchema = z.object({
  descricao: z.string(),
  dominio: z.string(),
  local: z.object({
    hostname: z.string(),
    usuario: z.string().default('aluno'),
    interfaces: z.array(interfaceSchema).min(1),
    rotas: z.array(rotaSchema),
    dnsServidores: z.array(ipPrivado).min(1),
    sockets: z.array(socketSchema).default([]),
    arquivos: z.record(z.string(), z.string()).default({}),
  }),
  hosts: z.array(hostSchema).default([]),
  dns: z.array(registroDnsSchema).default([]),
  capturas: z.array(z.object({ interface: z.string(), linhas: z.array(linhaCapturaSchema) })).default([]),
  missoes: z.array(missaoSchema).default([]),
});
export type Rede = z.infer<typeof redeSchema>;
export type HostRede = z.infer<typeof hostSchema>;
export type SocketRede = z.infer<typeof socketSchema>;

/* ---------- Pacotes (Analisador) ---------- */
const pacoteSchema = z.object({
  n: z.number(),
  t: z.number(),
  src: ipPrivado,
  dst: ipPrivado,
  proto: z.string(),
  len: z.number(),
  info: z.string(),
  stream: z.number().optional(),
  direcao: z.enum(['cliente', 'servidor']).optional(),
  camadas: z
    .object({
      eth: z.object({ src: z.string(), dst: z.string() }).partial().optional(),
      ip: z.object({ ttl: z.number() }).partial().optional(),
      tcp: z
        .object({
          srcport: z.number(),
          dstport: z.number(),
          flags: z.array(z.string()).default([]),
          seq: z.number().optional(),
          ack: z.number().optional(),
        })
        .optional(),
      udp: z.object({ srcport: z.number(), dstport: z.number() }).optional(),
      http: z
        .object({
          request: z
            .object({ method: z.string(), uri: z.string(), version: z.string().default('HTTP/1.1'), headers: z.record(z.string(), z.string()).default({}) })
            .optional(),
          response: z
            .object({ code: z.number(), phrase: z.string(), version: z.string().default('HTTP/1.1'), headers: z.record(z.string(), z.string()).default({}) })
            .optional(),
        })
        .optional(),
      dns: z
        .object({ id: z.string().optional(), query: z.string(), tipo: z.string().default('A'), respostas: z.array(z.string()).default([]) })
        .optional(),
      tls: z.object({ tipo: z.string(), sni: z.string().optional(), versao: z.string().optional() }).optional(),
      icmp: z.object({ tipo: z.string() }).optional(),
    })
    .default({}),
  /** Dados da aplicação em texto. null = cifrado. */
  payload: z.string().nullable().optional(),
});
export type Pacote = z.infer<typeof pacoteSchema>;

export const capturaSchema = z.object({
  titulo: z.string(),
  descricao: z.string(),
  pacotes: z.array(pacoteSchema).min(1),
  missoes: z.array(missaoSchema).default([]),
});
export type Captura = z.infer<typeof capturaSchema>;

/* ---------- Mensagens (Simulador) ---------- */
const blocoSchema = z.object({
  id: z.string(),
  texto: z.string(),
  rotulo: z.string().optional(),
  link: z.object({ exibido: z.string(), real: z.string() }).optional(),
  /** Comentário mostrado se o aluno marcar este bloco e ele não for sinal. */
  nota: z.string().optional(),
});

export const mensagemSchema = z.object({
  id: z.string(),
  canal: z.enum(['whatsapp', 'sms', 'email', 'pix']),
  remetente: z.object({ nome: z.string(), numero: z.string().optional(), email: z.string().optional() }),
  hora: z.string().optional(),
  assunto: z.string().optional(),
  blocos: z.array(blocoSchema).min(1),
  veredito: z.enum(['golpe', 'legitima']),
  sinais: z.array(z.object({ bloco: z.string(), titulo: z.string(), explicacao: z.string() })).default([]),
  explicacao: z.string(),
  fonte: z.object({ titulo: z.string(), url: z.url() }).optional(),
});
export type Mensagem = z.infer<typeof mensagemSchema>;

export const conjuntoMensagensSchema = z.object({
  titulo: z.string(),
  instrucoes: z.string().optional(),
  mensagens: z.array(mensagemSchema).min(1),
});
export type ConjuntoMensagens = z.infer<typeof conjuntoMensagensSchema>;

/* ---------- Cenários (Classificador) ---------- */
export const cenarioSchema = z
  .object({
    titulo: z.string(),
    contexto: z.string(),
    instrucoes: z.string().optional(),
    colunas: z.array(z.object({ id: z.string(), rotulo: z.string(), descricao: z.string().optional() })).min(2),
    itens: z.array(z.object({ id: z.string(), texto: z.string(), coluna: z.string(), explicacao: z.string() })).min(1),
  })
  .refine((c) => c.itens.every((i) => c.colunas.some((col) => col.id === i.coluna)), {
    message: 'Todo item precisa apontar para uma coluna existente.',
  });
export type Cenario = z.infer<typeof cenarioSchema>;

/* ---------- Situações (Identificador) ---------- */
export const situacoesSchema = z
  .object({
    titulo: z.string(),
    instrucoes: z.string().optional(),
    opcoes: z.array(z.object({ id: z.string(), rotulo: z.string() })).min(2),
    situacoes: z
      .array(
        z.object({
          id: z.string(),
          titulo: z.string(),
          texto: z.string(),
          resposta: z.string(),
          pistas: z.array(z.string()).default([]),
          explicacao: z.string(),
        }),
      )
      .min(1),
  })
  .refine((s) => s.situacoes.every((x) => s.opcoes.some((o) => o.id === x.resposta)), {
    message: 'A resposta de cada situação precisa ser o id de uma opção.',
  });
export type ConjuntoSituacoes = z.infer<typeof situacoesSchema>;

/* ---------- Quiz ---------- */
export const quizSchema = z.object({
  titulo: z.string().default('Revisão rápida'),
  questoes: z
    .array(
      z
        .object({
          id: z.string(),
          enunciado: z.string(),
          alternativas: z.array(z.object({ id: z.string(), texto: z.string() })).min(2),
          correta: z.string(),
          explicacao: z.string(),
        })
        .refine((q) => q.alternativas.some((a) => a.id === q.correta), { message: '"correta" precisa ser o id de uma alternativa.' }),
    )
    .min(1),
});
export type Quiz = z.infer<typeof quizSchema>;
