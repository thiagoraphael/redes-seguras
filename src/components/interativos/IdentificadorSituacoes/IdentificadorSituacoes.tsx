import { useEffect, useId, useRef, useState } from 'react';
import type { ConjuntoSituacoes } from '@/schemas';
import { useConcluidos } from '../comum/useProgresso';
import { BarraProgresso } from '../comum/Progresso';
import '../comum/comum.css';
import './IdentificadorSituacoes.css';

interface Props {
  conjunto: ConjuntoSituacoes;
  idAtividade: string;
}

/** Uma situação por vez. O aluno escolhe o tipo de ataque entre opções fixas e recebe a explicação. */
export default function IdentificadorSituacoes({ conjunto, idAtividade }: Props) {
  const id = useId();
  const { situacoes, opcoes } = conjunto;
  const { feitos, concluir, reiniciar } = useConcluidos(idAtividade, situacoes.length);
  const [indice, setIndice] = useState(0);
  const [escolha, setEscolha] = useState<string | null>(null);
  const [respondida, setRespondida] = useState(false);
  const [acertos, setAcertos] = useState(0);
  const [fim, setFim] = useState(false);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const primeira = useRef(true);

  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    tituloRef.current?.focus();
  }, [indice, fim]);

  const s = situacoes[indice]!;
  const certa = escolha === s.resposta;
  const rotulo = (oid: string) => opcoes.find((o) => o.id === oid)?.rotulo ?? oid;

  function responder() {
    if (!escolha) return;
    setRespondida(true);
    if (escolha === s.resposta) {
      setAcertos((a) => a + 1);
      concluir(s.id);
    }
  }
  function proxima() {
    if (indice + 1 >= situacoes.length) return setFim(true);
    setIndice((i) => i + 1);
    setEscolha(null);
    setRespondida(false);
  }
  function recomecar() {
    setIndice(0);
    setEscolha(null);
    setRespondida(false);
    setAcertos(0);
    setFim(false);
  }

  const totalFeitos = feitos.filter((f) => situacoes.some((x) => x.id === f)).length;

  if (fim) {
    return (
      <div className="ativ-cartao">
        <div className="placar">
          <h3 ref={tituloRef} tabIndex={-1}>
            Fim das situações
          </h3>
          <p className="placar-numero">
            {acertos}/{situacoes.length}
          </p>
          <p>Acertos nesta rodada. Releia as explicações das que errou e tente de novo.</p>
          <div className="ativ-acoes" style={{ justifyContent: 'center' }}>
            <button type="button" className="btn btn-primario" onClick={recomecar}>
              Fazer de novo
            </button>
            {totalFeitos > 0 && (
              <button type="button" className="btn btn-sutil" onClick={reiniciar}>
                Zerar progresso salvo
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ativ-cartao identificador">
      <div className="ident-topo">
        <p className="ativ-contador">
          Situação {indice + 1} de {situacoes.length}
        </p>
        <BarraProgresso feitos={totalFeitos} total={situacoes.length} rotulo="já acertadas" />
      </div>
      <article className="ident-situacao">
        <h3 ref={tituloRef} tabIndex={-1}>
          {s.titulo}
        </h3>
        {s.texto.split('\n\n').map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </article>

      <fieldset className="quiz-questao" disabled={respondida}>
        <legend className="ident-pergunta">Que tipo de ataque é esse?</legend>
        <div className="opcoes-grade">
          {opcoes.map((o) => {
            const classe = !respondida ? '' : o.id === s.resposta ? 'opcao-certa' : o.id === escolha ? 'opcao-errada' : '';
            return (
              <label key={o.id} className={`opcao ${classe}`}>
                <input type="radio" name={`${id}-op`} value={o.id} checked={escolha === o.id} onChange={() => setEscolha(o.id)} />
                <span>{o.rotulo}</span>
                {respondida && o.id === s.resposta && <span className="opcao-marca">Correta</span>}
                {respondida && o.id === escolha && o.id !== s.resposta && <span className="opcao-marca">Sua resposta</span>}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div aria-live="polite">
        {respondida && (
          <div className={`caixa ${certa ? 'caixa-ok' : 'caixa-erro'}`}>
            <p className="caixa-titulo">{certa ? `Isso, é ${rotulo(s.resposta)}.` : `Não. A resposta é ${rotulo(s.resposta)}.`}</p>
            <p>{s.explicacao}</p>
            {s.pistas.length > 0 && (
              <>
                <p className="caixa-titulo">Pistas no texto:</p>
                <ul>
                  {s.pistas.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>

      <div className="ativ-acoes">
        {!respondida ? (
          <button type="button" className="btn btn-primario" onClick={responder} disabled={!escolha}>
            Confirmar
          </button>
        ) : (
          <button type="button" className="btn btn-primario" onClick={proxima}>
            {indice + 1 >= situacoes.length ? 'Ver resultado' : 'Próxima situação'}
          </button>
        )}
        <span className="empurra ativ-contador">Acertos nesta rodada: {acertos}</span>
      </div>
    </div>
  );
}
