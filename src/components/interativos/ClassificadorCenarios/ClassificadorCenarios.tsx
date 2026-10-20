import { useId, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import type { Cenario } from '@/schemas';
import { useConcluidos } from '../comum/useProgresso';
import '../comum/comum.css';
import './ClassificadorCenarios.css';

interface Props {
  cenario: Cenario;
  idAtividade: string;
}

/**
 * Arrastar e soltar itens em colunas. Alternativa por teclado e toque:
 * selecione o item (Enter ou toque), depois escolha a coluna (setas + Enter, ou toque).
 * Esc cancela a seleção.
 */
export default function ClassificadorCenarios({ cenario, idAtividade }: Props) {
  const id = useId();
  const { feitos, concluir } = useConcluidos(idAtividade, 1);
  const ordemInicial = useMemo(() => embaralhar(cenario.itens.map((i) => i.id)), [cenario.itens]);
  const [posicao, setPosicao] = useState<Record<string, string | null>>(() => Object.fromEntries(cenario.itens.map((i) => [i.id, null])));
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [verificado, setVerificado] = useState(false);
  const [aviso, setAviso] = useState('');
  const [sobre, setSobre] = useState<string | null>(null);
  const alvosRef = useRef<(HTMLButtonElement | null)[]>([]);

  const itemPorId = (iid: string) => cenario.itens.find((i) => i.id === iid)!;
  const colunaPorId = (cid: string) => cenario.colunas.find((c) => c.id === cid)!;
  const soltos = ordemInicial.filter((iid) => posicao[iid] === null);
  const naColuna = (cid: string) => ordemInicial.filter((iid) => posicao[iid] === cid);
  const acertos = cenario.itens.filter((i) => posicao[i.id] === i.coluna).length;

  function mover(iid: string, cid: string | null) {
    setPosicao((p) => ({ ...p, [iid]: cid }));
    setSelecionado(null);
    setAviso(cid ? `"${itemPorId(iid).texto}" foi para ${colunaPorId(cid).rotulo}.` : `"${itemPorId(iid).texto}" voltou para a lista.`);
  }

  function selecionar(iid: string) {
    if (verificado) return;
    if (selecionado === iid) {
      setSelecionado(null);
      setAviso('Seleção cancelada.');
      return;
    }
    setSelecionado(iid);
    setAviso(`Selecionado: "${itemPorId(iid).texto}". Agora escolha a coluna com Tab ou setas e aperte Enter. Esc cancela.`);
    requestAnimationFrame(() => alvosRef.current[0]?.focus());
  }

  function teclaAlvo(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const n = cenario.colunas.length;
    let alvo = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') alvo = (i + 1) % n;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') alvo = (i - 1 + n) % n;
    else if (e.key === 'Escape') {
      setSelecionado(null);
      setAviso('Seleção cancelada.');
    }
    if (alvo >= 0) {
      e.preventDefault();
      alvosRef.current[alvo]?.focus();
    }
  }

  function aoSoltar(e: DragEvent, cid: string | null) {
    e.preventDefault();
    setSobre(null);
    const iid = e.dataTransfer.getData('text/plain');
    if (iid && iid in posicao && !verificado) mover(iid, cid);
  }

  function verificar() {
    setVerificado(true);
    setSelecionado(null);
    if (acertos === cenario.itens.length) concluir('completo');
    setAviso(`Correção: ${acertos} de ${cenario.itens.length} itens na coluna certa.`);
  }

  function recomecar() {
    setPosicao(Object.fromEntries(cenario.itens.map((i) => [i.id, null])));
    setVerificado(false);
    setAviso('Tudo voltou para a lista.');
  }

  const cartao = (iid: string) => {
    const it = itemPorId(iid);
    const col = posicao[iid];
    const certo = verificado && col === it.coluna;
    const errado = verificado && col !== it.coluna;
    return (
      <li key={iid} className={`cls-item ${selecionado === iid ? 'cls-item-sel' : ''} ${certo ? 'cls-certo' : ''} ${errado ? 'cls-errado' : ''}`}>
        <button
          type="button"
          className="cls-item-btn"
          draggable={!verificado}
          aria-pressed={selecionado === iid}
          aria-disabled={verificado || undefined}
          onClick={() => selecionar(iid)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setSelecionado(null);
          }}
          onDragStart={(e) => {
            e.dataTransfer.setData('text/plain', iid);
            e.dataTransfer.effectAllowed = 'move';
          }}
        >
          <span aria-hidden="true" className="cls-alca">
            ⠿
          </span>
          {it.texto}
          {verificado && <span className="sr-only">{certo ? ' (correto)' : ` (errado, o certo é ${colunaPorId(it.coluna).rotulo})`}</span>}
        </button>
        {col && !verificado && (
          <button type="button" className="cls-voltar" onClick={() => mover(iid, null)} aria-label={`Tirar "${it.texto}" de ${colunaPorId(col).rotulo}`}>
            ×
          </button>
        )}
        {verificado && (
          <p className="cls-explicacao">
            <strong>{certo ? 'Certo.' : `O certo é ${colunaPorId(it.coluna).rotulo}.`}</strong> {it.explicacao}
          </p>
        )}
      </li>
    );
  };

  return (
    <div className="ativ-cartao classificador">
      <h3>{cenario.titulo}</h3>
      <p>{cenario.contexto}</p>
      <p className="cls-instrucoes" id={`${id}-instr`}>
        {cenario.instrucoes ??
          'Arraste cada item para a coluna certa. Sem mouse: selecione o item com Enter (ou toque nele) e depois escolha a coluna.'}
        {feitos.includes('completo') && <span className="etiqueta etiqueta-ok cls-ja"> Você já acertou tudo uma vez</span>}
      </p>

      <div
        className={`cls-origem ${sobre === '__origem' ? 'cls-sobre' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setSobre('__origem');
        }}
        onDragLeave={() => setSobre(null)}
        onDrop={(e) => aoSoltar(e, null)}
      >
        <p className="cls-coluna-titulo">Itens para classificar ({soltos.length})</p>
        {soltos.length ? <ul className="cls-lista">{soltos.map(cartao)}</ul> : <p className="cls-vazio">Todos os itens foram colocados.</p>}
      </div>

      <div className="cls-colunas" style={{ ['--n-colunas' as string]: cenario.colunas.length }}>
        {cenario.colunas.map((c, i) => (
          <section
            key={c.id}
            className={`cls-coluna ${sobre === c.id ? 'cls-sobre' : ''}`}
            aria-labelledby={`${id}-${c.id}`}
            onDragOver={(e) => {
              e.preventDefault();
              setSobre(c.id);
            }}
            onDragLeave={() => setSobre(null)}
            onDrop={(e) => aoSoltar(e, c.id)}
          >
            <p className="cls-coluna-titulo" id={`${id}-${c.id}`}>
              {c.rotulo}
            </p>
            {c.descricao && <p className="cls-coluna-desc">{c.descricao}</p>}
            {selecionado && (
              <button
                type="button"
                ref={(el) => {
                  alvosRef.current[i] = el;
                }}
                className="cls-alvo"
                onClick={() => mover(selecionado, c.id)}
                onKeyDown={(e) => teclaAlvo(e, i)}
              >
                Colocar aqui
                <span className="sr-only"> em {c.rotulo}</span>
              </button>
            )}
            <ul className="cls-lista">{naColuna(c.id).map(cartao)}</ul>
          </section>
        ))}
      </div>

      <p className="sr-only" aria-live="polite">
        {aviso}
      </p>

      {verificado && (
        <div className={`caixa ${acertos === cenario.itens.length ? 'caixa-ok' : 'caixa-alerta'}`}>
          <p className="caixa-titulo">
            {acertos} de {cenario.itens.length} na coluna certa.
          </p>
          <p>Leia a explicação embaixo de cada item. Os errados mostram onde deveriam estar.</p>
        </div>
      )}

      <div className="ativ-acoes">
        {!verificado ? (
          <button type="button" className="btn btn-primario" onClick={verificar} disabled={soltos.length > 0}>
            Corrigir
          </button>
        ) : (
          <button type="button" className="btn btn-primario" onClick={recomecar}>
            Tentar de novo
          </button>
        )}
        {!verificado && soltos.length > 0 && <span className="ativ-contador">Coloque todos os itens para corrigir.</span>}
      </div>
    </div>
  );
}

function embaralhar<T>(lista: T[]): T[] {
  // Embaralhamento determinístico (mesma ordem no servidor e no navegador).
  const a = [...lista];
  let s = a.length * 7919;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
