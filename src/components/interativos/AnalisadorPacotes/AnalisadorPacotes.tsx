import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { Captura, Pacote } from '@/schemas';
import PainelMissoes from '../comum/PainelMissoes';
import { compilar, ErroFiltro } from './filtro';
import '../comum/comum.css';
import './AnalisadorPacotes.css';

interface Props {
  captura: Captura;
  idAtividade: string;
}

const EXEMPLOS = ['http', 'dns', 'tcp.port == 443', 'ip.addr == 192.168.56.30', 'http.request.method == "POST"'];

export default function AnalisadorPacotes({ captura, idAtividade }: Props) {
  const [texto, setTexto] = useState('');
  const [aplicado, setAplicado] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<number | null>(null);
  const [fluxo, setFluxo] = useState<number | null>(null);
  const linhasRef = useRef<Record<number, HTMLTableRowElement | null>>({});
  const filtroRef = useRef<HTMLInputElement>(null);

  const visiveis = useMemo(() => {
    try {
      const p = compilar(aplicado);
      return captura.pacotes.filter(p);
    } catch {
      return captura.pacotes;
    }
  }, [aplicado, captura.pacotes]);

  function aplicar(valor = texto) {
    try {
      compilar(valor);
      setErro(null);
      setAplicado(valor);
      setTexto(valor);
    } catch (e) {
      setErro(e instanceof ErroFiltro ? e.message : 'Filtro inválido.');
    }
  }

  const pacote = captura.pacotes.find((p) => p.n === selecionado) ?? null;

  function teclaLinha(e: KeyboardEvent<HTMLTableRowElement>, idx: number) {
    let alvo = -1;
    if (e.key === 'ArrowDown') alvo = Math.min(idx + 1, visiveis.length - 1);
    else if (e.key === 'ArrowUp') alvo = Math.max(idx - 1, 0);
    else if (e.key === 'Home') alvo = 0;
    else if (e.key === 'End') alvo = visiveis.length - 1;
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelecionado(visiveis[idx]!.n);
      return;
    }
    if (alvo >= 0) {
      e.preventDefault();
      const n = visiveis[alvo]!.n;
      setSelecionado(n);
      linhasRef.current[n]?.focus();
    }
  }

  return (
    <div className={captura.missoes.length ? 'pk-lab' : 'pk-lab pk-lab-sozinho'}>
      <div className="pk">
        <div className="pk-barra">
          <form
            className="pk-filtro"
            onSubmit={(e) => {
              e.preventDefault();
              aplicar();
            }}
          >
            <label htmlFor="pk-filtro-campo" className="pk-filtro-rotulo">
              Filtro de exibição
            </label>
            <div className="pk-filtro-linha">
              <input
                id="pk-filtro-campo"
                ref={filtroRef}
                className={`campo ${erro ? 'pk-filtro-erro' : aplicado ? 'pk-filtro-ok' : ''}`}
                value={texto}
                onChange={(e) => {
                  setTexto(e.target.value);
                  setErro(null);
                }}
                placeholder="ex.: http ou ip.addr == 192.168.56.30"
                spellCheck={false}
                autoComplete="off"
                aria-invalid={!!erro || undefined}
                aria-describedby="pk-filtro-msg"
              />
              <button type="submit" className="btn btn-primario">
                Aplicar
              </button>
              {aplicado && (
                <button type="button" className="btn" onClick={() => aplicar('')}>
                  Limpar
                </button>
              )}
            </div>
            <p id="pk-filtro-msg" className={erro ? 'pk-msg pk-msg-erro' : 'pk-msg'} aria-live="polite">
              {erro ?? `${visiveis.length} de ${captura.pacotes.length} pacotes exibidos.`}
            </p>
            <p className="pk-exemplos">
              Experimente:{' '}
              {EXEMPLOS.map((ex) => (
                <button key={ex} type="button" className="chip-comando" onClick={() => aplicar(ex)}>
                  <code>{ex}</code>
                </button>
              ))}
            </p>
          </form>
        </div>

        <div className="pk-tabela-caixa" role="region" aria-label="Lista de pacotes" tabIndex={-1}>
          <table className="pk-tabela">
            <caption className="sr-only">
              Pacotes capturados. Use as setas para navegar e Enter para ver detalhes.
            </caption>
            <thead>
              <tr>
                <th scope="col">No.</th>
                <th scope="col">Tempo</th>
                <th scope="col">Origem</th>
                <th scope="col">Destino</th>
                <th scope="col">Protocolo</th>
                <th scope="col">Tam.</th>
                <th scope="col">Info</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((p, idx) => (
                <tr
                  key={p.n}
                  ref={(el) => {
                    linhasRef.current[p.n] = el;
                  }}
                  tabIndex={selecionado === p.n || (selecionado === null && idx === 0) ? 0 : -1}
                  aria-selected={selecionado === p.n}
                  className={`pk-proto-${classeProto(p)} ${selecionado === p.n ? 'pk-sel' : ''}`}
                  onClick={() => setSelecionado(p.n)}
                  onKeyDown={(e) => teclaLinha(e, idx)}
                >
                  <td>{p.n}</td>
                  <td>{p.t.toFixed(6)}</td>
                  <td>{p.src}</td>
                  <td>{p.dst}</td>
                  <td>{p.proto}</td>
                  <td>{p.len}</td>
                  <td className="pk-info">{p.info}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visiveis.length && <p className="pk-vazio">Nenhum pacote bate com esse filtro.</p>}
        </div>

        <div className="pk-detalhe" aria-live="polite">
          {pacote ? (
            <Detalhe pacote={pacote} onSeguir={() => setFluxo(pacote.stream ?? null)} />
          ) : (
            <p className="pk-vazio">Clique num pacote (ou use as setas e Enter) para ver as camadas.</p>
          )}
        </div>

        {fluxo !== null && <Fluxo pacotes={captura.pacotes.filter((p) => p.stream === fluxo)} stream={fluxo} onFechar={() => setFluxo(null)} />}
      </div>

      {captura.missoes.length > 0 && <PainelMissoes missoes={captura.missoes} idAtividade={idAtividade} rotuloComandos="Filtros que ajudam" />}
    </div>
  );
}

function classeProto(p: Pacote) {
  if (p.camadas.http) return 'http';
  if (p.camadas.tls) return 'tls';
  if (p.camadas.dns) return 'dns';
  if (p.camadas.icmp) return 'icmp';
  if (p.proto === 'ARP') return 'arp';
  return 'tcp';
}

function Detalhe({ pacote: p, onSeguir }: { pacote: Pacote; onSeguir: () => void }) {
  const c = p.camadas;
  return (
    <div>
      <div className="pk-detalhe-topo">
        <h4>Pacote {p.n}</h4>
        {p.stream !== undefined && c.tcp && (
          <button type="button" className="btn btn-pequeno" onClick={onSeguir}>
            Seguir fluxo TCP
          </button>
        )}
      </div>
      <details open>
        <summary>Quadro {p.n}: {p.len} bytes</summary>
        <p>Tempo desde o início da captura: {p.t.toFixed(6)} s</p>
      </details>
      {c.eth && (
        <details>
          <summary>Ethernet II</summary>
          <p>Origem: {c.eth.src} | Destino: {c.eth.dst}</p>
        </details>
      )}
      {p.proto !== 'ARP' && (
        <details open>
          <summary>
            Internet Protocol versão 4, Src: {p.src}, Dst: {p.dst}
          </summary>
          {c.ip?.ttl !== undefined && <p>Time to live: {c.ip.ttl}</p>}
        </details>
      )}
      {c.tcp && (
        <details open>
          <summary>
            Transmission Control Protocol, Src Port: {c.tcp.srcport}, Dst Port: {c.tcp.dstport}
          </summary>
          <p>
            Flags: {c.tcp.flags.join(', ') || 'nenhuma'}
            {c.tcp.seq !== undefined && ` | Seq: ${c.tcp.seq}`}
            {c.tcp.ack !== undefined && ` | Ack: ${c.tcp.ack}`}
          </p>
        </details>
      )}
      {c.udp && (
        <details open>
          <summary>
            User Datagram Protocol, Src Port: {c.udp.srcport}, Dst Port: {c.udp.dstport}
          </summary>
        </details>
      )}
      {c.dns && (
        <details open>
          <summary>Domain Name System</summary>
          <p>
            Consulta: {c.dns.query} ({c.dns.tipo})
          </p>
          {c.dns.respostas.length > 0 && <p>Respostas: {c.dns.respostas.join(', ')}</p>}
        </details>
      )}
      {c.tls && (
        <details open>
          <summary>Transport Layer Security</summary>
          <p>
            Tipo: {c.tls.tipo}
            {c.tls.versao && ` | Versão: ${c.tls.versao}`}
            {c.tls.sni && ` | Servidor (SNI): ${c.tls.sni}`}
          </p>
          <p>O conteúdo está cifrado. Dá para ver quem fala com quem, mas não o que foi dito.</p>
        </details>
      )}
      {c.http && (
        <details open>
          <summary>Hypertext Transfer Protocol</summary>
          {c.http.request && (
            <pre className="pk-http">
              {`${c.http.request.method} ${c.http.request.uri} ${c.http.request.version}\n`}
              {Object.entries(c.http.request.headers)
                .map(([k, v]) => `${k}: ${v}`)
                .join('\n')}
            </pre>
          )}
          {c.http.response && (
            <pre className="pk-http">
              {`${c.http.response.version} ${c.http.response.code} ${c.http.response.phrase}\n`}
              {Object.entries(c.http.response.headers)
                .map(([k, v]) => `${k}: ${v}`)
                .join('\n')}
            </pre>
          )}
        </details>
      )}
      {p.payload !== undefined && (
        <details open>
          <summary>Dados da aplicação</summary>
          {p.payload === null ? <p className="pk-cifrado">[dados cifrados]</p> : <pre className="pk-http">{p.payload}</pre>}
        </details>
      )}
    </div>
  );
}

function Fluxo({ pacotes, stream, onFechar }: { pacotes: Pacote[]; stream: number; onFechar: () => void }) {
  const comDados = pacotes.filter((p) => p.payload !== undefined || p.camadas.http);
  const primeiro = pacotes[0];
  return (
    <section className="pk-fluxo" aria-label={`Fluxo TCP ${stream}`}>
      <div className="pk-detalhe-topo">
        <h4>
          Seguir fluxo TCP (stream {stream})
          {primeiro?.camadas.tcp && (
            <span className="pk-fluxo-sub">
              {' '}
              {primeiro.src}:{primeiro.camadas.tcp.srcport} ↔ {primeiro.dst}:{primeiro.camadas.tcp.dstport}
            </span>
          )}
        </h4>
        <button type="button" className="btn btn-pequeno" onClick={onFechar} autoFocus>
          Fechar
        </button>
      </div>
      <p className="pk-legenda">
        <span className="pk-chip pk-cli">Cliente</span> <span className="pk-chip pk-srv">Servidor</span>
      </p>
      {comDados.length === 0 && <p className="pk-vazio">Este fluxo não tem dados de aplicação, só controle (SYN, ACK, FIN).</p>}
      {comDados.map((p) => {
        const http = p.camadas.http;
        let corpo = '';
        if (http?.request) corpo += `${http.request.method} ${http.request.uri} ${http.request.version}\n${Object.entries(http.request.headers).map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n`;
        if (http?.response) corpo += `${http.response.version} ${http.response.code} ${http.response.phrase}\n${Object.entries(http.response.headers).map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n`;
        const cifrado = p.payload === null;
        if (p.payload) corpo += p.payload;
        const lado = p.direcao ?? 'cliente';
        return (
          <pre key={p.n} className={`pk-fluxo-msg ${lado === 'cliente' ? 'pk-cli' : 'pk-srv'}`}>
            <span className="sr-only">{lado === 'cliente' ? 'Cliente: ' : 'Servidor: '}</span>
            {cifrado ? '[dados cifrados: impossível ler sem a chave]' : corpo.trimEnd()}
          </pre>
        );
      })}
    </section>
  );
}
