import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { Rede } from '@/schemas';
import { completar, executar } from './motor';
import './Terminal.css';

export interface TerminalHandle {
  /** Coloca um comando no campo de entrada e foca o terminal. */
  inserir: (comando: string) => void;
}

interface Props {
  rede: Rede;
  /** Título mostrado na barra do terminal. */
  titulo?: string;
  /** Mensagem inicial. */
  boasVindas?: string;
}

type Entrada = { tipo: 'cmd'; texto: string; root: boolean } | { tipo: 'saida'; texto: string; erro: boolean; info?: boolean };

const LIMITE = 1500;

const Terminal = forwardRef<TerminalHandle, Props>(function Terminal({ rede, titulo, boasVindas }, ref) {
  const prompt = `${rede.local.usuario}@${rede.local.hostname}:~$`;
  const inicial = useMemo<Entrada[]>(
    () => [
      {
        tipo: 'saida',
        erro: false,
        info: true,
        texto:
          boasVindas ??
          `Simulador de terminal: você está no ${rede.local.hostname}, uma máquina fictícia da rede do laboratório.\nDigite help para ver os comandos. Nada aqui sai do seu navegador.`,
      },
    ],
    [boasVindas, rede.local.hostname],
  );
  const [entradas, setEntradas] = useState<Entrada[]>(inicial);
  const [linha, setLinha] = useState('');
  const [historico, setHistorico] = useState<string[]>([]);
  const [posHist, setPosHist] = useState<number | null>(null);
  const rascunho = useRef('');
  const inputRef = useRef<HTMLInputElement>(null);
  const telaRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    inserir(c: string) {
      setLinha(c);
      setPosHist(null);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
    },
  }));

  useEffect(() => {
    const t = telaRef.current;
    if (t) t.scrollTop = t.scrollHeight;
  }, [entradas]);

  const adicionar = useCallback((novas: Entrada[]) => {
    setEntradas((atual) => [...atual, ...novas].slice(-LIMITE));
  }, []);

  function rodar() {
    const texto = linha;
    const hist = texto.trim() ? [...historico, texto] : historico;
    if (texto.trim()) setHistorico(hist);
    setPosHist(null);
    setLinha('');
    const res = executar(texto, { rede, historico: hist, rng: Math.random, agora: () => new Date(), root: false });
    if (res.limpar) {
      setEntradas([]);
      return;
    }
    const novas: Entrada[] = [{ tipo: 'cmd', texto, root: false }];
    if (res.linhas.length) novas.push({ tipo: 'saida', texto: res.linhas.join('\n'), erro: (res.codigo ?? 0) !== 0 });
    adicionar(novas);
  }

  function teclas(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      rodar();
    } else if (e.key === 'ArrowUp') {
      if (!historico.length) return;
      e.preventDefault();
      if (posHist === null) rascunho.current = linha;
      const p = posHist === null ? historico.length - 1 : Math.max(0, posHist - 1);
      setPosHist(p);
      setLinha(historico[p]!);
    } else if (e.key === 'ArrowDown') {
      if (posHist === null) return;
      e.preventDefault();
      const p = posHist + 1;
      if (p >= historico.length) {
        setPosHist(null);
        setLinha(rascunho.current);
      } else {
        setPosHist(p);
        setLinha(historico[p]!);
      }
    } else if (e.key === 'Tab') {
      // Completa só a primeira palavra. Sem nada digitado, deixa o Tab sair do campo.
      const partes = linha.split(' ');
      if (partes.length !== 1 || !linha) return;
      e.preventDefault();
      const opcoes = completar(partes[0]!);
      if (opcoes.length === 1) setLinha(`${opcoes[0]} `);
      else if (opcoes.length > 1) adicionar([{ tipo: 'cmd', texto: linha, root: false }, { tipo: 'saida', texto: opcoes.join('  '), erro: false }]);
    } else if (e.key.toLowerCase() === 'l' && e.ctrlKey) {
      e.preventDefault();
      setEntradas([]);
    } else if (e.key.toLowerCase() === 'c' && e.ctrlKey && !window.getSelection()?.toString()) {
      e.preventDefault();
      adicionar([{ tipo: 'cmd', texto: `${linha}^C`, root: false }]);
      setLinha('');
      setPosHist(null);
    }
  }

  return (
    <div className="term">
      <div className="term-barra">
        <span className="term-bolinhas" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="term-titulo">{titulo ?? `${rede.local.usuario}@${rede.local.hostname}`}</span>
        <button type="button" className="term-limpar" onClick={() => setEntradas([])}>
          Limpar
        </button>
      </div>
      <div
        className="term-tela"
        ref={telaRef}
        onMouseUp={() => {
          if (!window.getSelection()?.toString()) inputRef.current?.focus();
        }}
      >
        <div role="log" aria-live="polite" aria-label="Saída do terminal" className="term-log">
          {entradas.map((e, i) =>
            e.tipo === 'cmd' ? (
              <pre key={i} className="term-linha-cmd">
                <span className="term-prompt">{prompt}</span> {e.texto}
              </pre>
            ) : (
              <pre key={i} className={`term-saida${e.erro ? ' term-saida-erro' : ''}${e.info ? ' term-info' : ''}`}>
                {destacarDicas(e.texto)}
              </pre>
            ),
          )}
        </div>
        <div className="term-entrada">
          <label htmlFor={`term-${rede.local.hostname}`} className="term-prompt">
            {prompt}
            <span className="sr-only"> Digite um comando e aperte Enter</span>
          </label>
          <input
            id={`term-${rede.local.hostname}`}
            ref={inputRef}
            value={linha}
            onChange={(e) => setLinha(e.target.value)}
            onKeyDown={teclas}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="send"
          />
        </div>
      </div>
    </div>
  );
});

/** Linhas "(simulador: ...)" e "(dica ...)" aparecem em outro tom, para não confundir com a saída real. */
function destacarDicas(texto: string) {
  const linhas = texto.split('\n');
  return linhas.map((l, i) => {
    const fim = i < linhas.length - 1 ? '\n' : '';
    if (/^\((simulador|dica)/.test(l)) {
      return (
        <span key={i} className="term-dica">
          {l}
          {fim}
        </span>
      );
    }
    return l + fim;
  });
}

export default Terminal;
