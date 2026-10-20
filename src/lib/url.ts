/** Monta links respeitando o `base` do Astro (necessário no GitHub Pages). */
export function url(caminho = ''): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const limpo = caminho.replace(/^\//, '');
  return `${base}/${limpo}`;
}
