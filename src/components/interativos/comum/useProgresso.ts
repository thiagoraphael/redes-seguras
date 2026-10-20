import { useCallback, useEffect, useState } from 'react';
import { concluirItem, definirTotal, EVENTO, itensConcluidos, reiniciarAtividade } from '@/lib/progresso';

/**
 * Lista de itens concluídos de uma atividade, sincronizada com o localStorage.
 * Começa vazia no servidor e carrega no navegador (evita erro de hidratação).
 */
export function useConcluidos(idAtividade: string, total: number) {
  const [feitos, setFeitos] = useState<string[]>([]);

  useEffect(() => {
    setFeitos(itensConcluidos(idAtividade));
    definirTotal(idAtividade, total);
    const ouvir = () => setFeitos(itensConcluidos(idAtividade));
    window.addEventListener(EVENTO, ouvir);
    return () => window.removeEventListener(EVENTO, ouvir);
  }, [idAtividade, total]);

  const concluir = useCallback((id: string) => concluirItem(idAtividade, id), [idAtividade]);
  const reiniciar = useCallback(() => reiniciarAtividade(idAtividade), [idAtividade]);
  return { feitos, concluir, reiniciar };
}
