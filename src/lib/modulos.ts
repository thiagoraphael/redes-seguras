import { getCollection, type CollectionEntry } from 'astro:content';
import type { Disciplina } from './texto';

export type Modulo = CollectionEntry<'modulos'>;

/** "ferramentas/02-diagnostico" -> "02-diagnostico" */
export function slugDoModulo(m: Modulo): string {
  return m.id.split('/').pop()!;
}

export async function modulosDa(disciplina?: Disciplina): Promise<Modulo[]> {
  const todos = await getCollection('modulos', (m) => !disciplina || m.data.disciplina === disciplina);
  return todos.sort((a, b) => a.data.encontro - b.data.encontro);
}
