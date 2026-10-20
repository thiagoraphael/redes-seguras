import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ConjuntoMensagens, Mensagem } from '@/schemas';
import { useConcluidos } from '../comum/useProgresso';
import { BarraProgresso } from '../comum/Progresso';
import '../comum/comum.css';
import './SimuladorMensagens.css';

interface Props {
  conjunto: ConjuntoMensagens;
  idAtividade: string;
}

/**
 * Mensagens recriadas (marcas fictícias). O aluno marca os trechos suspeitos,
 * decide "golpe" ou "legítima" e recebe a explicação de cada sinal.
 */
export default function SimuladorMensagens({ conjunto, idAtividade }: Props) {
  const msgs = conjunto.mensagens;
  const { feitos, concluir } = useConcluidos(idAtividade, msgs.length);
  const [indice, setIndice] = useState(0);
  const m = msgs[indice]!;
  const totalFeitos = feitos.filter((f) => msgs.some((x) => x.id === f)).length;
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const primeira = useRef(true);

  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    tituloRef.current?.focus();
  }, [indice]);

  return (
    <div className="ativ-cartao simulador">
      <div className="sim-topo">
        <h3 ref={tituloRef} tabIndex={-1} className="ativ-contador">
          Mensagem {indice + 1} de {msgs.length}
        </h3>
        <BarraProgresso feitos={totalFeitos} total={msgs.length} rotulo="analisadas certo" />
      </div>
      {conjunto.instrucoes && <p className="sim-instrucoes">{conjunto.instrucoes}</p>}
      <Analise key={m.id} mensagem={m} onAcerto={() => concluir(m.id)} />
      <div className="ativ-acoes">
        <button type="button" className="btn" onClick={() => setIndice((i) => i - 1)} disabled={indice === 0}>
          Anterior
        </button>
        <button type="button" className="btn" onClick={() => setIndice((i) => i + 1)} disabled={indice + 1 >= msgs.length}>
          Próxima mensagem
        </button>
      </div>
    </div>
  );
}

function Analise({ mensagem: m, onAcerto }: { mensagem: Mensagem; onAcerto: () => void }) {
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [veredito, setVeredito] = useState<'golpe' | 'legitima' | null>(null);
  const [verificado, setVerificado] = useState(false);
  const [statusLink, setStatusLink] = useState<string | null>(null);
  const idsSinais = new Set(m.sinais.map((s) => s.bloco));

  function alternar(id: string) {
    if (verificado) return;
    setMarcados((atual) => {
      const n = new Set(atual);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function verificar() {
    setVerificado(true);
    if (veredito === m.veredito) onAcerto();
  }

  const acertouVeredito = veredito === m.veredito;
  const encontrados = m.sinais.filter((s) => marcados.has(s.bloco));
  const falsos = m.blocos.filter((b) => marcados.has(b.id) && !idsSinais.has(b.id));

  const blocoBotao = (b: Mensagem['blocos'][number]) => {
    const marcado = marcados.has(b.id);
    const ehSinal = idsSinais.has(b.id);
    const classe = [
      'sim-bloco',
      marcado && 'sim-marcado',
      verificado && ehSinal && 'sim-sinal',
      verificado && marcado && !ehSinal && 'sim-falso',
      b.link && 'sim-link',
    ]
      .filter(Boolean)
      .join(' ');
    return (
      <button
        key={b.id}
        type="button"
        className={classe}
        aria-pressed={marcado}
        disabled={verificado}
        onClick={() => alternar(b.id)}
        onMouseEnter={() => b.link && setStatusLink(b.link.real)}
        onMouseLeave={() => b.link && setStatusLink(null)}
        onFocus={() => b.link && setStatusLink(b.link.real)}
        onBlur={() => b.link && setStatusLink(null)}
      >
        {b.rotulo && <span className="sim-rotulo">{b.rotulo}</span>}
        <span className="sim-texto">{b.texto}</span>
        {b.link && <span className="sr-only">. Link que abre: {b.link.real}</span>}
        {verificado && ehSinal && <span className="sim-tag">sinal</span>}
      </button>
    );
  };

  return (
    <>
      <p className="sim-passo">
        <strong>1.</strong> Clique nos trechos que parecem suspeitos (clique de novo para desmarcar).
      </p>
      <div className={`sim-moldura sim-${m.canal}`}>
        <Moldura m={m}>{m.blocos.map(blocoBotao)}</Moldura>
        {m.canal === 'email' && (
          <div className="sim-status" aria-hidden="true">
            {statusLink ? `Link aponta para: ${statusLink}` : 'Passe o mouse ou o foco num link para ver o endereço real.'}
          </div>
        )}
      </div>

      <fieldset className="sim-veredito" disabled={verificado}>
        <legend>
          <strong>2.</strong> Essa mensagem é:
        </legend>
        <div className="sim-veredito-opcoes">
          {(['golpe', 'legitima'] as const).map((v) => (
            <label key={v} className={`opcao ${verificado && v === m.veredito ? 'opcao-certa' : verificado && v === veredito ? 'opcao-errada' : ''}`}>
              <input type="radio" name={`veredito-${m.id}`} checked={veredito === v} onChange={() => setVeredito(v)} />
              <span>{v === 'golpe' ? 'Golpe' : 'Legítima'}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {!verificado && (
        <div className="ativ-acoes">
          <button type="button" className="btn btn-primario" disabled={!veredito} onClick={verificar}>
            Verificar
          </button>
          {!veredito && <span className="ativ-contador">Escolha golpe ou legítima para verificar.</span>}
        </div>
      )}

      <div aria-live="polite">
        {verificado && (
          <div className={`caixa ${acertouVeredito ? 'caixa-ok' : 'caixa-erro'}`}>
            <p className="caixa-titulo">
              {acertouVeredito ? 'Acertou.' : 'Errou.'} Essa mensagem é {m.veredito === 'golpe' ? 'golpe' : 'legítima'}.
            </p>
            <p>{m.explicacao}</p>
            {m.sinais.length > 0 && (
              <>
                <p className="caixa-titulo">
                  Você marcou {encontrados.length} de {m.sinais.length} sinais:
                </p>
                <ul className="sim-lista-sinais">
                  {m.sinais.map((s) => (
                    <li key={s.bloco}>
                      <span className={marcados.has(s.bloco) ? 'etiqueta etiqueta-ok' : 'etiqueta etiqueta-neutra'}>
                        {marcados.has(s.bloco) ? 'você achou' : 'passou batido'}
                      </span>{' '}
                      <strong>{s.titulo}.</strong> {s.explicacao}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {falsos.length > 0 && (
              <>
                <p className="caixa-titulo">Trechos que você marcou mas não são sinal de golpe:</p>
                <ul>
                  {falsos.map((b) => (
                    <li key={b.id}>
                      "{b.texto}" {b.nota ? `: ${b.nota}` : ''}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {m.fonte && (
              <p className="sim-fonte">
                Para saber mais: <a href={m.fonte.url} target="_blank" rel="noopener">{m.fonte.titulo}</a>
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function Moldura({ m, children }: { m: Mensagem; children: ReactNode }) {
  if (m.canal === 'email') {
    return (
      <div className="sim-email">
        <div className="sim-email-cab">
          <p className="sim-email-assunto">{m.assunto ?? '(sem assunto)'}</p>
          <p>
            <span className="sim-email-de">De:</span> {m.remetente.nome} {m.remetente.email && <span className="sim-email-end">&lt;{m.remetente.email}&gt;</span>}
          </p>
          {m.hora && <p className="sim-hora">{m.hora}</p>}
        </div>
        <div className="sim-email-corpo">{children}</div>
      </div>
    );
  }
  if (m.canal === 'pix') {
    return (
      <div className="sim-pix">
        <p className="sim-pix-titulo">Confirme o Pix</p>
        <div className="sim-pix-campos">{children}</div>
        <div className="sim-pix-botao" aria-hidden="true">
          Confirmar pagamento
        </div>
      </div>
    );
  }
  return (
    <div className="sim-chat">
      <div className="sim-chat-cab">
        <span className="sim-avatar" aria-hidden="true">
          {m.remetente.nome.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <p className="sim-chat-nome">{m.remetente.nome}</p>
          {m.remetente.numero && <p className="sim-chat-num">{m.remetente.numero}</p>}
        </div>
        <span className="sim-canal">{m.canal === 'whatsapp' ? 'Mensageiro' : 'SMS'}</span>
      </div>
      <div className="sim-chat-corpo">
        <div className="sim-balao">
          {children}
          {m.hora && <span className="sim-hora">{m.hora}</span>}
        </div>
      </div>
    </div>
  );
}
