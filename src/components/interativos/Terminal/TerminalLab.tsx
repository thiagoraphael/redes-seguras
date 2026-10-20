import { useRef } from 'react';
import type { Rede } from '@/schemas';
import Terminal, { type TerminalHandle } from './Terminal';
import PainelMissoes from '../comum/PainelMissoes';

interface Props {
  /** JSON da rede fictícia (coleção "redes"). */
  rede: Rede;
  /** Chave do progresso no navegador, ex.: "ferramentas/02-diagnostico:terminal". */
  idAtividade: string;
  titulo?: string;
}

/** Terminal + painel de missões lado a lado (empilhados no celular). */
export default function TerminalLab({ rede, idAtividade, titulo }: Props) {
  const term = useRef<TerminalHandle>(null);
  return (
    <div className={rede.missoes.length ? 'term-lab' : 'term-lab term-lab-sozinho'}>
      <Terminal ref={term} rede={rede} titulo={titulo} />
      {rede.missoes.length > 0 && (
        <PainelMissoes
          missoes={rede.missoes}
          idAtividade={idAtividade}
          onUsarComando={(c) => term.current?.inserir(c)}
          rotuloComandos="Comandos que ajudam (clique para colar no terminal)"
        />
      )}
    </div>
  );
}
