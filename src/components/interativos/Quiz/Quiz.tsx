import { useEffect, useId, useRef, useState } from 'react';
import type { Quiz as QuizDados } from '@/schemas';
import { registrarQuiz } from '@/lib/progresso';
import '../comum/comum.css';

interface Props {
  quiz: QuizDados;
  /** Chave para guardar o melhor resultado no navegador. */
  idQuiz: string;
  /** Embaralhar a ordem das questões a cada tentativa. Padrão: false. */
  embaralhar?: boolean;
}

function misturar<T>(lista: T[]): T[] {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export default function Quiz({ quiz, idQuiz, embaralhar = false }: Props) {
  const id = useId();
  const [ordem, setOrdem] = useState(quiz.questoes);
  const [indice, setIndice] = useState(0);
  const [escolha, setEscolha] = useState<string | null>(null);
  const [respondida, setRespondida] = useState(false);
  const [acertos, setAcertos] = useState(0);
  const [fim, setFim] = useState(false);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const primeiraRender = useRef(true);

  useEffect(() => {
    if (primeiraRender.current) {
      primeiraRender.current = false;
      return;
    }
    tituloRef.current?.focus();
  }, [indice, fim]);

  const q = ordem[indice]!;
  const certa = escolha === q.correta;

  function responder() {
    if (!escolha) return;
    setRespondida(true);
    if (escolha === q.correta) setAcertos((a) => a + 1);
  }

  function proxima() {
    if (indice + 1 >= ordem.length) {
      registrarQuiz(idQuiz, acertos, ordem.length);
      setFim(true);
      return;
    }
    setIndice((i) => i + 1);
    setEscolha(null);
    setRespondida(false);
  }

  function refazer() {
    setOrdem(embaralhar ? misturar(quiz.questoes) : quiz.questoes);
    setIndice(0);
    setEscolha(null);
    setRespondida(false);
    setAcertos(0);
    setFim(false);
  }

  if (fim) {
    const msg =
      acertos === ordem.length
        ? 'Gabaritou. Você está pronto para a próxima aula.'
        : acertos >= ordem.length * 0.6
          ? 'Bom resultado. Releia a teoria das questões que errou.'
          : 'Vale voltar na aba Teoria e tentar de novo. Errar aqui não conta nada.';
    return (
      <div className="ativ-cartao quiz">
        <div className="placar">
          <h3 ref={tituloRef} tabIndex={-1} className="sr-only">
            Resultado do quiz
          </h3>
          <p className="placar-numero" aria-label={`${acertos} acertos de ${ordem.length}`}>
            {acertos}/{ordem.length}
          </p>
          <p>{msg}</p>
          <p className="ativ-contador">O placar fica só na sua tela. Não vale nota.</p>
          <button type="button" className="btn btn-primario" onClick={refazer}>
            Refazer o quiz
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ativ-cartao quiz">
      <p className="ativ-contador">
        Questão {indice + 1} de {ordem.length}
      </p>
      <fieldset className="quiz-questao" disabled={respondida}>
        <legend>
          <h3 ref={tituloRef} tabIndex={-1} className="quiz-enunciado">
            {q.enunciado}
          </h3>
        </legend>
        <div className="opcoes-grade opcoes-lista">
          {q.alternativas.map((a) => {
            const marcar = respondida && (a.id === q.correta || a.id === escolha);
            const classe = !respondida ? '' : a.id === q.correta ? 'opcao-certa' : a.id === escolha ? 'opcao-errada' : '';
            return (
              <label key={a.id} className={`opcao ${classe}`}>
                <input
                  type="radio"
                  name={`${id}-q`}
                  value={a.id}
                  checked={escolha === a.id}
                  onChange={() => setEscolha(a.id)}
                />
                <span>{a.texto}</span>
                {marcar && <span className="opcao-marca">{a.id === q.correta ? 'Correta' : 'Sua resposta'}</span>}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div aria-live="polite">
        {respondida && (
          <div className={`caixa ${certa ? 'caixa-ok' : 'caixa-erro'}`}>
            <p className="caixa-titulo">{certa ? 'Acertou!' : 'Não foi dessa vez.'}</p>
            <p>{q.explicacao}</p>
          </div>
        )}
      </div>

      <div className="ativ-acoes">
        {!respondida ? (
          <button type="button" className="btn btn-primario" onClick={responder} disabled={!escolha}>
            Responder
          </button>
        ) : (
          <button type="button" className="btn btn-primario" onClick={proxima}>
            {indice + 1 >= ordem.length ? 'Ver resultado' : 'Próxima questão'}
          </button>
        )}
        <span className="empurra ativ-contador">Acertos: {acertos}</span>
      </div>
    </div>
  );
}
