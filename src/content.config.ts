import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import {
  capturaSchema,
  cenarioSchema,
  conjuntoMensagensSchema,
  quizSchema,
  redeSchema,
  situacoesSchema,
} from './schemas';

/** Cada JSON em src/content/dados/<pasta>/ vira uma entrada. O id é o nome do arquivo. */
const dados = (pasta: string) => glob({ pattern: '*.json', base: `./src/content/dados/${pasta}` });

const redes = defineCollection({ loader: dados('redes'), schema: redeSchema });
const pacotes = defineCollection({ loader: dados('pacotes'), schema: capturaSchema });
const mensagens = defineCollection({ loader: dados('mensagens'), schema: conjuntoMensagensSchema });
const cenarios = defineCollection({ loader: dados('cenarios'), schema: cenarioSchema });
const situacoes = defineCollection({ loader: dados('situacoes'), schema: situacoesSchema });
const quizzes = defineCollection({ loader: dados('quizzes'), schema: quizSchema });

const atividade = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('terminal'), dados: reference('redes'), titulo: z.string().optional(), intro: z.string().optional() }),
  z.object({ tipo: z.literal('pacotes'), dados: reference('pacotes'), titulo: z.string().optional(), intro: z.string().optional() }),
  z.object({ tipo: z.literal('mensagens'), dados: reference('mensagens'), titulo: z.string().optional(), intro: z.string().optional() }),
  z.object({ tipo: z.literal('cenarios'), dados: reference('cenarios'), titulo: z.string().optional(), intro: z.string().optional() }),
  z.object({ tipo: z.literal('situacoes'), dados: reference('situacoes'), titulo: z.string().optional(), intro: z.string().optional() }),
]);

const modulos = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/modulos' }),
  schema: z.object({
    disciplina: z.enum(['ferramentas', 'defensiva']),
    encontro: z.number().int().positive(),
    /** Data do encontro. Opcional para módulos ainda sem data definida. */
    data: z.coerce.date().optional(),
    titulo: z.string(),
    resumo: z.string(),
    liberado: z.boolean().default(false),
    objetivos: z.array(z.string()).default([]),
    /** Uma atividade ou uma lista delas, mostradas na aba Lab/Simulação. */
    lab: z
      .union([atividade, z.array(atividade)])
      .optional()
      .transform((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v])),
    quiz: reference('quizzes').optional(),
    referencias: z
      .array(z.object({ titulo: z.string(), url: z.url(), nota: z.string().optional() }))
      .default([]),
  }),
});

export const collections = { modulos, redes, pacotes, mensagens, cenarios, situacoes, quizzes };
