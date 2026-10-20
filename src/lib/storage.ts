/**
 * Acesso seguro ao localStorage. Se o navegador bloquear (modo privado,
 * política do laboratório, cota cheia), cai para memória e o site segue
 * funcionando. Nada aqui é obrigatório para usar o site.
 */
const memoria = new Map<string, string>();

function disponivel(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const teste = '__site_redes_teste__';
    window.localStorage.setItem(teste, '1');
    window.localStorage.removeItem(teste);
    return window.localStorage;
  } catch {
    return null;
  }
}

export function lerJSON<T>(chave: string, padrao: T): T {
  try {
    const s = disponivel();
    const bruto = s ? s.getItem(chave) : memoria.get(chave) ?? null;
    if (!bruto) return padrao;
    return { ...padrao, ...(JSON.parse(bruto) as T) };
  } catch {
    return padrao;
  }
}

export function gravarJSON(chave: string, valor: unknown): void {
  const texto = JSON.stringify(valor);
  memoria.set(chave, texto);
  try {
    disponivel()?.setItem(chave, texto);
  } catch {
    /* sem storage: fica só em memória nesta aba */
  }
}

export function remover(chave: string): void {
  memoria.delete(chave);
  try {
    disponivel()?.removeItem(chave);
  } catch {
    /* ignora */
  }
}
