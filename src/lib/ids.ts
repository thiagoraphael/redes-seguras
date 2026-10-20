/** Ids estáveis para o progresso no navegador. Mudar isso zera o progresso salvo dos alunos. */
export const idAtividade = (idModulo: string, idDados: string) => `${idModulo}:${idDados}`;
export const idQuiz = (idModulo: string) => `${idModulo}:quiz`;
