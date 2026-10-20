interface Props {
  feitos: number;
  total: number;
  rotulo?: string;
}

/** Barra de progresso simples, só visual. Não é nota. */
export function BarraProgresso({ feitos, total, rotulo = 'concluídas' }: Props) {
  const pct = total ? Math.round((feitos / total) * 100) : 0;
  return (
    <div className="barra-progresso">
      <div
        className="barra-trilho"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={feitos}
        aria-label={`${feitos} de ${total} ${rotulo}`}
      >
        <div className="barra-preenchida" style={{ width: `${pct}%` }} />
      </div>
      <span className="barra-texto">
        {feitos} de {total} {rotulo}
      </span>
    </div>
  );
}
