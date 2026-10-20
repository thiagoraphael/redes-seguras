import { useId, useState, type SyntheticEvent } from 'react';
import type { Missao } from '@/schemas';
import { respostaCorreta } from './respostas';
import { useConcluidos } from './useProgresso';
import { BarraProgresso } from './Progresso';
import './comum.css';

interface Props {
  missoes: Missao[];
  idAtividade: string;
  /** Chamado quando o aluno clica num comando sugerido. */
  onUsarComando?: (comando: string) => void;
  rotuloComandos?: string;
}

export default function PainelMissoes({ missoes, idAtividade, onUsarComando, rotuloComandos = 'Comandos que ajudam' }: Props) {
  const { feitos, concluir, reiniciar } = useConcluidos(idAtividade, missoes.length);
  const proxima = missoes.findIndex((m) => !feitos.includes(m.id));

  return (
    <section className="missoes" aria-label="Missões">
      <div className="missoes-topo">
        <h3>Missões</h3>
        <BarraProgresso feitos={feitos.filter((f) => missoes.some((m) => m.id === f)).length} total={missoes.length} />
      </div>
      <ol className="missoes-lista">
        {missoes.map((m, i) => (
          <ItemMissao
            key={m.id}
            missao={m}
            numero={i + 1}
            feita={feitos.includes(m.id)}
            atual={i === proxima}
            onAcerto={() => concluir(m.id)}
            onUsarComando={onUsarComando}
            rotuloComandos={rotuloComandos}
          />
        ))}
      </ol>
      {feitos.length > 0 && (
        <button type="button" className="btn btn-sutil missoes-reiniciar" onClick={reiniciar}>
          Recomeçar missões
        </button>
      )}
    </section>
  );
}

interface ItemProps {
  missao: Missao;
  numero: number;
  feita: boolean;
  atual: boolean;
  onAcerto: () => void;
  onUsarComando?: (c: string) => void;
  rotuloComandos: string;
}

function ItemMissao({ missao, numero, feita, atual, onAcerto, onUsarComando, rotuloComandos }: ItemProps) {
  const id = useId();
  const [valor, setValor] = useState('');
  const [estado, setEstado] = useState<'neutro' | 'erro' | 'ok'>('neutro');
  const [tentativas, setTentativas] = useState(0);
  const [dicaAberta, setDicaAberta] = useState(false);
  const concluida = feita || estado === 'ok';

  function enviar(e: SyntheticEvent) {
    e.preventDefault();
    if (!valor.trim()) return;
    if (respostaCorreta(missao.resposta, valor)) {
      setEstado('ok');
      onAcerto();
    } else {
      setEstado('erro');
      setTentativas((t) => t + 1);
    }
  }

  return (
    <li className={`missao ${concluida ? 'missao-feita' : ''} ${atual && !concluida ? 'missao-atual' : ''}`}>
      <div className="missao-cab">
        <span className="missao-num" aria-hidden="true">
          {concluida ? '✓' : numero}
        </span>
        <p className="missao-enunciado" id={`${id}-enunciado`}>
          <span className="sr-only">Missão {numero}{concluida ? ', concluída' : ''}: </span>
          {missao.enunciado}
        </p>
      </div>

      {!concluida && (
        <form className="missao-form" onSubmit={enviar}>
          <label className="sr-only" htmlFor={`${id}-resp`}>
            Resposta da missão {numero}
          </label>
          <input
            id={`${id}-resp`}
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="Sua resposta"
            value={valor}
            aria-describedby={estado === 'erro' ? `${id}-fb` : undefined}
            aria-invalid={estado === 'erro' || undefined}
            onChange={(e) => {
              setValor(e.target.value);
              if (estado === 'erro') setEstado('neutro');
            }}
          />
          <button type="submit" className="btn btn-primario">
            Verificar
          </button>
        </form>
      )}

      <div aria-live="polite">
        {estado === 'erro' && !concluida && (
          <p className="missao-fb missao-fb-erro" id={`${id}-fb`}>
            Ainda não. {tentativas >= 2 && !dicaAberta ? 'Que tal abrir a dica?' : 'Confira a saída do comando com calma.'}
          </p>
        )}
        {concluida && (
          <div className="missao-fb missao-fb-ok">
            <p className="caixa-titulo">{estado === 'ok' ? 'Isso mesmo!' : 'Concluída'}</p>
            <p>{missao.explicacao}</p>
          </div>
        )}
      </div>

      {!concluida && (missao.dica || missao.comandosSugeridos.length > 0) && (
        <div className="missao-dica">
          <button
            type="button"
            className="btn btn-sutil btn-pequeno"
            aria-expanded={dicaAberta}
            aria-controls={`${id}-dica`}
            onClick={() => setDicaAberta((v) => !v)}
          >
            {dicaAberta ? 'Esconder dica' : 'Ver dica'}
          </button>
          <div id={`${id}-dica`} hidden={!dicaAberta}>
            {missao.dica && <p>{missao.dica}</p>}
            {missao.comandosSugeridos.length > 0 && (
              <>
                <p className="missao-dica-rotulo">{rotuloComandos}:</p>
                <ul className="missao-comandos">
                  {missao.comandosSugeridos.map((c) => (
                    <li key={c}>
                      {onUsarComando ? (
                        <button type="button" className="chip-comando" onClick={() => onUsarComando(c)} title="Colar no terminal">
                          <code>{c}</code>
                        </button>
                      ) : (
                        <code>{c}</code>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
