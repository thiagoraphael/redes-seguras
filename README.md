# Redes Seguras

Site de estudo para o Técnico em Redes de Computadores (2º período, CTP Barbacena), com as disciplinas **Ferramentas de Segurança de Rede** e **Segurança Defensiva**.

Cada encontro é um módulo com três abas: **Teoria**, **Lab virtual** (Ferramentas) ou **Simulação** (Defensiva), e **Revisão rápida** (quiz). Tudo roda no navegador: não há backend, login ou nota. O progresso do aluno fica só no `localStorage` e o site funciona normalmente se o navegador bloquear o armazenamento.

Stack: Astro 7 + MDX, ilhas React 19 + TypeScript, CSS com variáveis (sem framework). Saída 100% estática.

## Rodando no computador

Precisa de Node.js 22 ou mais novo.

```bash
npm install
npm run dev        # http://localhost:4321, recarrega ao salvar
npm run build      # confere tipos e dados (astro check) e gera a pasta dist/
npm run preview    # serve a pasta dist/ para conferir o resultado final
npm test           # testa o motor do terminal e as respostas das missões
```

Se algum JSON ou frontmatter estiver errado, o `npm run build` falha e diz qual arquivo e qual campo. Isso vale também para IPs: a rede fictícia só aceita endereços privados (10/8, 172.16/12, 192.168/16) e loopback.

## Estrutura

```
src/
├── content.config.ts          # coleções e validação (usa src/schemas.ts)
├── schemas.ts                 # formato de cada JSON (rede, pacotes, mensagens, cenários, situações, quiz)
├── content/
│   ├── modulos/
│   │   ├── ferramentas/       # um .mdx por encontro
│   │   └── defensiva/
│   └── dados/                 # JSONs dos exercícios; o nome do arquivo é o id
│       ├── redes/  pacotes/  mensagens/  cenarios/  situacoes/  quizzes/
├── components/
│   ├── interativos/           # ilhas React (veja docs/componentes.md)
│   └── ui/                    # componentes Astro usados no MDX e no layout
├── layouts/Base.astro
├── lib/                       # storage seguro, progresso, IPs, utilitários
├── pages/
│   ├── index.astro            # início com as duas disciplinas
│   ├── [disciplina]/index.astro
│   ├── [disciplina]/[slug].astro   # página do módulo, com as abas
│   └── professor/componentes.astro # vitrine de todos os componentes
└── styles/tokens.css          # cores, fontes, espaçamentos (tema claro e escuro)
tests/terminal.test.ts         # testes do terminal e das missões
```

## Como adicionar um encontro novo

Exemplo: encontro 3 de Ferramentas, com o analisador de pacotes.

### 1. Crie (ou edite) o MDX

`src/content/modulos/ferramentas/03-captura-e-analise-de-pacotes.mdx` (já existe como rascunho com `liberado: false`):

````mdx
---
disciplina: ferramentas          # ferramentas | defensiva
encontro: 3
data: 2026-11-09                 # opcional; aparece no card
titulo: Captura e análise de pacotes
resumo: Ler uma captura, filtrar, seguir um fluxo TCP e ver por que login sem HTTPS é perigoso.
liberado: true                   # false = aparece como "Em breve" e não gera página
objetivos:
  - Filtrar pacotes por protocolo, IP e porta
  - Seguir um fluxo TCP e ler a conversa
lab:                             # uma atividade ou uma lista delas
  tipo: pacotes                  # terminal | pacotes | mensagens | cenarios | situacoes
  dados: login-clinica           # nome do JSON em src/content/dados/pacotes/ (sem .json)
  titulo: Lab virtual no analisador   # opcional
  intro: Texto curto antes do exercício.  # opcional
quiz: ferramentas-03             # nome do JSON em src/content/dados/quizzes/ (opcional)
referencias:
  - titulo: "Wireshark User's Guide"
    url: https://www.wireshark.org/docs/wsug_html_chunked/
---

import SaidaComentada from '@/components/ui/SaidaComentada.astro';
import Todo from '@/components/ui/Todo.astro';

## Primeira seção

Texto da teoria em Markdown normal.

<SaidaComentada
  comando="sudo tcpdump -n -c 2 port 80"
  notas={[
    { linha: 1, texto: 'SYN: o cliente pedindo para abrir a conexão.' },
  ]}
>
```
14:02:13.552019 IP 192.168.56.30.51920 > 192.168.56.20.80: Flags [S], length 0
14:02:13.552101 IP 192.168.56.20.80 > 192.168.56.30.51920: Flags [S.], length 0
```
</SaidaComentada>

<Todo>conferir este dado antes de liberar.</Todo>
````

O corpo do MDX vira a aba **Teoria**. As abas de lab e revisão aparecem sozinhas quando `lab` e `quiz` existem. A seção **Referências** é montada a partir do frontmatter.

Componentes disponíveis para usar no MDX:

| Componente | Para quê |
| --- | --- |
| `SaidaComentada` | Saída de terminal com linhas numeradas e notas. A saída vai num bloco de código dentro dele (assim os espaços ficam certos). |
| `CasoReal` | Caso real com fonte. Props: `titulo`, `veiculo`, `data`, `url`; o texto vai dentro. |
| `CasoFicticio` | Exemplo inventado, com selo "Exemplo fictício", para quando não há caso real com boa fonte. Prop: `titulo`. |
| `Todo` | Destaca algo para revisar. Procure por `<Todo` antes de liberar. |

### 2. Crie o JSON do exercício

`src/content/dados/pacotes/login-clinica.json`. O formato de cada tipo está em [docs/componentes.md](docs/componentes.md) e o schema completo em `src/schemas.ts`. Os arquivos existentes servem de modelo:

| Tipo | Exemplo pronto |
| --- | --- |
| terminal | `dados/redes/lab-encontro-02.json` |
| pacotes | `dados/pacotes/exemplo-login-http-https.json` |
| mensagens | `dados/mensagens/defensiva-02-mensagens.json` |
| cenarios | `dados/cenarios/exemplo-clinica-risco.json` |
| situacoes | `dados/situacoes/defensiva-02-situacoes.json` |
| quiz | `dados/quizzes/ferramentas-02.json` |

Exemplo mínimo de uma rede para o terminal, com uma missão:

```json
{
  "descricao": "Rede de exemplo",
  "dominio": "lab.home.arpa",
  "local": {
    "hostname": "srv-lab",
    "interfaces": [
      { "nome": "lo", "mac": "00:00:00:00:00:00", "ipv4": "127.0.0.1/8", "estado": "UNKNOWN", "mtu": 65536 },
      { "nome": "enp0s3", "mac": "08:00:27:3a:1c:5e", "ipv4": "192.168.56.20/24" }
    ],
    "rotas": [
      { "destino": "default", "via": "192.168.56.1", "dev": "enp0s3", "proto": "static", "metric": 100 },
      { "destino": "192.168.56.0/24", "dev": "enp0s3", "proto": "kernel", "scope": "link", "src": "192.168.56.20" }
    ],
    "dnsServidores": ["192.168.56.53"]
  },
  "hosts": [{ "hostname": "gw", "ip": "192.168.56.1" }],
  "dns": [{ "nome": "gw.lab.home.arpa", "tipo": "A", "valor": "192.168.56.1" }],
  "missoes": [
    {
      "id": "gateway",
      "enunciado": "Qual é o gateway padrão?",
      "dica": "Olhe a rota default.",
      "comandosSugeridos": ["ip r"],
      "resposta": { "tipo": "exata", "valor": "192.168.56.1" },
      "explicacao": "A rota default aponta para o gateway."
    }
  ]
}
```

A `resposta` de uma missão aceita quatro formas: `{ "tipo": "exata", "valor": "..." }`, `{ "tipo": "umDe", "valores": ["...", "..."] }`, `{ "tipo": "regex", "padrao": "..." }` e `{ "tipo": "numero", "valor": 3, "tolerancia": 0 }`. A comparação ignora maiúsculas, acentos e espaços nas pontas.

### 3. Confira e libere

1. `npm run dev` e abra a página do módulo (ou `/professor/componentes/` para testar só o componente).
2. Procure `<Todo` no MDX e resolva o que estiver marcado.
3. Mude `liberado: true` no frontmatter.
4. `npm run build` para garantir que tudo valida, e publique (abaixo).

Para mudar o id de um JSON ou o nome do arquivo MDX depois de os alunos usarem, saiba que o progresso salvo no navegador deles é ligado a esses nomes e vai zerar para aquele módulo.

## Adicionando um comando ao terminal (ex.: nmap)

1. Crie `src/components/interativos/Terminal/comandos/nmap.ts` exportando `export const nmap: Comando = (args, ctx) => ...`. Use `ctx.rede` (o JSON da rede) e devolva `ok([...linhas])` ou `falha('mensagem')`. O `ctx.root` diz se o comando veio com `sudo`.
2. Registre em `comandos/index.ts`.
3. Adicione uma linha em `AJUDA` (`comandos/builtins.ts`) e remova o `nmap` de `NAO_INSTALADOS`.
4. Escreva um teste em `tests/terminal.test.ts`.

Os hosts da rede já têm o campo `servicos` (porta, protocolo, nome, produto), pensado para o nmap.

## Deploy

### GitHub Pages

O workflow `.github/workflows/deploy.yml` já está pronto.

1. Crie o repositório no GitHub e envie o projeto.
2. Em **Settings > Pages**, em **Source**, escolha **GitHub Actions**.
3. A cada `git push` na branch `main`, o site é gerado e publicado.

O workflow detecta sozinho o endereço (`https://USUARIO.github.io/REPOSITORIO/`) e ajusta o caminho base. Se usar domínio próprio, defina a variável `BASE_PATH` como `/` no workflow.

### Vercel

1. Importe o repositório em vercel.com.
2. A Vercel detecta Astro. Comando de build: `npm run build`. Pasta de saída: `dist`.
3. Não precisa configurar `BASE_PATH`.

## Acessibilidade

- Todos os exercícios funcionam só com teclado. Abas: setas, Home e End. Terminal: Enter, setas para o histórico, Tab completa o comando (com o campo vazio, o Tab sai do terminal). Classificador: Enter seleciona o item, setas escolhem a coluna, Enter solta, Esc cancela. Analisador: setas na lista de pacotes, Enter seleciona.
- Foco visível em todos os controles, contraste AA nos dois temas (conferido com axe), textos alternativos e regiões `aria-live` para os retornos.
- O tema segue o sistema e pode ser trocado no botão do topo.

## Conteúdo e fontes

As afirmações técnicas e os casos reais têm fonte listada no fim de cada módulo. O que não consegui confirmar ficou marcado com `<Todo>` no MDX e aparece destacado em amarelo na página. Endereços, empresas e pessoas dos exercícios são fictícios: IPs privados, domínio `lab.home.arpa` (RFC 8375) e sites terminados em `.example` (RFC 2606).
