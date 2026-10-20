# Componentes interativos

Todos ficam em `src/components/interativos/` e são ilhas React. Nos módulos, você não precisa importá-los: basta declarar a atividade no frontmatter (`lab:`) e o `Atividade.astro` escolhe o componente certo. Importe diretamente só se quiser usar um componente numa página própria, como em `src/pages/professor/componentes.astro`.

Os tipos de cada JSON estão em `src/schemas.ts`. Campos com valor padrão podem ser omitidos.

Toda atividade recebe um `idAtividade` (ou `idQuiz`), que é a chave do progresso no navegador. Nos módulos ele é gerado sozinho como `"<pasta>/<arquivo-do-mdx>:<nome-do-json>"`.

Para testar um JSON novo sem mexer num módulo, abra `/professor/componentes/` ou copie uma seção daquela página.

---

## TerminalLab

Terminal Linux simulado + painel de missões. No celular, o painel vai para baixo do terminal.

```tsx
<TerminalLab client:visible rede={dados} idAtividade="ferramentas/02-diagnostico:lab-encontro-02" />
```

| Prop | Tipo | Obrigatória | Descrição |
| --- | --- | --- | --- |
| `rede` | `Rede` | sim | JSON da coleção `redes` |
| `idAtividade` | `string` | sim | Chave do progresso das missões |
| `titulo` | `string` | não | Texto da barra do terminal. Padrão: `usuario@hostname` |

Comandos simulados: `ip` (address, link, route, neigh, `route get`), `ss`, `ping`, `traceroute`, `dig`, `tcpdump`, `cat` (`/etc/resolv.conf`, `/etc/hosts`, `/etc/hostname` e o que houver em `local.arquivos`), `hostname`, `whoami`, `id`, `pwd`, `date`, `echo`, `history`, `help`, `man`, `clear`. Funciona `sudo` na frente, pipes para `grep`, `head`, `tail`, `wc` e `sort`, e sequências com `;` e `&&`. Comando desconhecido devolve `NOME: command not found`.

Comportamentos que imitam o Linux real e servem de aula:

- `tcpdump` sem `sudo` dá erro de permissão.
- `ss -p` sem `sudo` não mostra processos de outros usuários (campo `dono` do socket).
- `ping` sem `-c` para em 4 pacotes e avisa que o real continuaria.
- Nomes fora do domínio do lab não resolvem (`SERVFAIL` no `dig`, `Temporary failure in name resolution` no `ping`).
- `nmap`, `ifconfig`, `netstat` e `route` respondem como no Ubuntu sem o pacote instalado.

### Formato do JSON (`src/content/dados/redes/*.json`)

```jsonc
{
  "descricao": "texto livre",
  "dominio": "lab.home.arpa",              // domínio de busca e dos registros DNS
  "local": {                                // a máquina onde o aluno está logado
    "hostname": "srv-lab",
    "usuario": "aluno",                     // padrão "aluno"
    "interfaces": [
      { "nome": "enp0s3", "mac": "08:00:27:3a:1c:5e", "ipv4": "192.168.56.20/24", "estado": "UP", "mtu": 1500 }
      // estado: UP | DOWN | UNKNOWN. Sem ipv4 = interface sem endereço.
    ],
    "rotas": [
      { "destino": "default", "via": "192.168.56.1", "dev": "enp0s3", "proto": "static", "metric": 100 }
    ],
    "dnsServidores": ["192.168.56.53"],
    "sockets": [
      // estado: LISTEN | UNCONN | ESTAB | TIME-WAIT; dono padrão "root"
      { "proto": "tcp", "estado": "LISTEN", "local": "0.0.0.0:22", "processo": "sshd", "pid": 801, "fd": 3, "dono": "root" },
      { "proto": "tcp", "estado": "ESTAB", "local": "192.168.56.20:22", "remoto": "192.168.56.30:51888", "processo": "sshd", "pid": 1320 }
    ],
    "arquivos": { "/etc/motd": "texto do arquivo" }   // opcional, para o cat
  },
  "hosts": [
    {
      "hostname": "srv-legado",
      "ip": "10.0.0.15",
      "mac": "08:00:27:aa:bb:cc",           // opcional; aparece no ip neigh
      "respondePing": false,                 // padrão true
      "latenciaMs": [0.3, 1.2],              // faixa sorteada no ping/traceroute
      "ttl": 64,                             // TTL de partida; o simulador desconta os saltos
      "saltos": ["192.168.56.1", "10.0.0.1", "*", "*"],  // opcional; sem isso é calculado pela rota
      "servicos": [{ "porta": 80, "proto": "tcp", "nome": "http", "produto": "nginx 1.24.0" }]
    }
  ],
  "dns": [
    { "nome": "srv-lab.lab.home.arpa", "tipo": "A", "valor": "192.168.56.20", "ttl": 300 },
    { "nome": "intranet.lab.home.arpa", "tipo": "CNAME", "valor": "srv-lab.lab.home.arpa" }
    // tipos: A, CNAME, MX (com "prioridade"), TXT, NS, PTR. O reverso (dig -x) sai dos registros A.
  ],
  "capturas": [
    {
      "interface": "enp0s3",
      "linhas": [
        // proto: tcp | udp | icmp | arp. Escreva src/dst/portas numéricos; o tcpdump converte em nomes quando não há -n.
        { "t": "14:02:11.104233", "proto": "udp", "src": "192.168.56.20", "sport": 41022, "dst": "192.168.56.53", "dport": 53, "info": "4821+ A? intranet.lab.home.arpa. (40)" },
        { "t": "14:02:10.881204", "proto": "arp", "info": "Request who-has 192.168.56.1 tell 192.168.56.20, length 28" }
      ]
    }
  ],
  "missoes": [ /* veja "Missões" abaixo */ ]
}
```

Regras validadas no build: todo IP precisa ser privado (10/8, 172.16/12, 192.168/16) ou loopback; MAC no formato `aa:bb:cc:dd:ee:ff`.

---

## AnalisadorPacotes

Lista de pacotes no estilo Wireshark, filtro de exibição, detalhe por camadas e "Seguir fluxo TCP". Pode ter missões.

```tsx
<AnalisadorPacotes client:visible captura={dados} idAtividade="..." />
```

| Prop | Tipo | Obrigatória | Descrição |
| --- | --- | --- | --- |
| `captura` | `Captura` | sim | JSON da coleção `pacotes` |
| `idAtividade` | `string` | sim | Chave do progresso das missões |

Filtros aceitos: `ip.addr`, `ip.src`, `ip.dst` (aceitam CIDR: `ip.addr == 192.168.56.0/24`), `tcp.port`, `tcp.srcport`, `tcp.dstport`, `udp.port`, `udp.srcport`, `udp.dstport`, `tcp.stream`, `http.request.method`, `http.request.uri`, `http.host`, `http.response.code`, `dns.qry.name`, `frame.len`. Protocolos sozinhos: `ip`, `tcp`, `udp`, `http`, `http.request`, `http.response`, `dns`, `tls`, `icmp`, `arp`. Operadores: `== != > < >= <= contains`, `&& || !` (ou `and or not`) e parênteses. Filtro inválido fica vermelho com a explicação.

### Formato do JSON (`src/content/dados/pacotes/*.json`)

```jsonc
{
  "titulo": "Login na intranet: HTTP x HTTPS",
  "descricao": "texto livre",
  "pacotes": [
    {
      "n": 6, "t": 0.002210,                       // número e tempo em segundos
      "src": "192.168.56.30", "dst": "192.168.56.20",
      "proto": "HTTP", "len": 512, "info": "POST /login HTTP/1.1",
      "stream": 0,                                 // mesmo número = mesma conversa TCP
      "direcao": "cliente",                        // cliente | servidor (cor no "Seguir fluxo")
      "camadas": {
        "tcp": { "srcport": 51520, "dstport": 80, "flags": ["PSH", "ACK"], "seq": 1, "ack": 1 },
        "http": { "request": { "method": "POST", "uri": "/login", "headers": { "Host": "intranet.lab.home.arpa" } } }
        // também: eth, ip { ttl }, udp, dns { query, tipo, respostas[] }, tls { tipo, sni, versao }, icmp { tipo },
        // http.response { code, phrase, headers }
      },
      "payload": "usuario=recepcao&senha=Gato%402026"   // texto da aplicação; null = cifrado
    }
  ],
  "missoes": [ /* veja "Missões"; comandosSugeridos aqui são filtros */ ]
}
```

---

## SimuladorMensagens

Mensagens recriadas (mensageiro, SMS, e-mail, tela de Pix). O aluno marca os trechos suspeitos, decide golpe ou legítima e recebe o retorno de cada sinal.

```tsx
<SimuladorMensagens client:visible conjunto={dados} idAtividade="..." />
```

| Prop | Tipo | Obrigatória | Descrição |
| --- | --- | --- | --- |
| `conjunto` | `ConjuntoMensagens` | sim | JSON da coleção `mensagens` |
| `idAtividade` | `string` | sim | Chave do progresso |

Use sempre marcas e pessoas fictícias e endereços terminados em `.example`.

### Formato do JSON (`src/content/dados/mensagens/*.json`)

```jsonc
{
  "titulo": "Golpe ou legítima?",
  "instrucoes": "opcional",
  "mensagens": [
    {
      "id": "taxa-entrega",
      "canal": "sms",                        // whatsapp | sms | email | pix
      "remetente": { "nome": "29110", "numero": "SMS curto", "email": "opcional" },
      "hora": "10:42",                       // opcional
      "assunto": "só para e-mail",
      "blocos": [                            // cada bloco é um trecho clicável
        { "id": "b1", "texto": "Pague a taxa até HOJE" },
        { "id": "b2", "texto": "clique aqui", "link": { "exibido": "loja.example", "real": "loja-pagamento.example/x" } },
        { "id": "b3", "rotulo": "Para", "texto": "M. R. SILVA" },          // rotulo: usado na tela de Pix
        { "id": "b4", "texto": "Equipe X", "nota": "Mostrada se o aluno marcar este bloco e ele não for sinal." }
      ],
      "veredito": "golpe",                   // golpe | legitima
      "sinais": [ { "bloco": "b1", "titulo": "Urgência", "explicacao": "..." } ],   // vazio em mensagem legítima
      "explicacao": "Explicação geral, mostrada depois de verificar.",
      "fonte": { "titulo": "opcional", "url": "https://..." }
    }
  ]
}
```

No e-mail, passar o mouse ou o foco num bloco com `link` mostra o endereço real numa barra de status, como no navegador.

---

## ClassificadorCenarios

Arrastar e soltar itens de um cenário em colunas (Ativo, Ameaça, Vulnerabilidade, Risco; ou Confidencialidade, Integridade, Disponibilidade; ou o que você definir). Teclado e toque: selecione o item, depois escolha a coluna. Corrige item por item.

```tsx
<ClassificadorCenarios client:visible cenario={dados} idAtividade="..." />
```

| Prop | Tipo | Obrigatória | Descrição |
| --- | --- | --- | --- |
| `cenario` | `Cenario` | sim | JSON da coleção `cenarios` |
| `idAtividade` | `string` | sim | Chave do progresso (marca concluído quando acerta tudo) |

### Formato do JSON (`src/content/dados/cenarios/*.json`)

```jsonc
{
  "titulo": "Clínica Patas & Cia",
  "contexto": "Descrição do cenário",
  "instrucoes": "opcional",
  "colunas": [
    { "id": "c", "rotulo": "Confidencialidade", "descricao": "opcional" },
    { "id": "i", "rotulo": "Integridade" },
    { "id": "d", "rotulo": "Disponibilidade" }
  ],
  "itens": [
    { "id": "i1", "texto": "Prontuário vazado na internet", "coluna": "c", "explicacao": "..." }
  ]
}
```

O build falha se algum item apontar para uma coluna que não existe.

---

## IdentificadorSituacoes

Uma situação por vez, com opções fixas (por exemplo, os 8 tipos de ataque). Mostra a explicação e as pistas depois de confirmar.

```tsx
<IdentificadorSituacoes client:visible conjunto={dados} idAtividade="..." />
```

| Prop | Tipo | Obrigatória | Descrição |
| --- | --- | --- | --- |
| `conjunto` | `ConjuntoSituacoes` | sim | JSON da coleção `situacoes` |
| `idAtividade` | `string` | sim | Chave do progresso |

### Formato do JSON (`src/content/dados/situacoes/*.json`)

```jsonc
{
  "titulo": "Que ataque é esse?",
  "instrucoes": "opcional",
  "opcoes": [ { "id": "worm", "rotulo": "Worm" }, { "id": "virus", "rotulo": "Vírus" } ],
  "situacoes": [
    {
      "id": "s1",
      "titulo": "O escritório que ficou lento",
      "texto": "Parágrafo 1.\n\nParágrafo 2 (separe parágrafos com linha em branco).",
      "resposta": "worm",                 // id de uma opção
      "pistas": ["Espalhou sozinho"],     // opcional
      "explicacao": "..."
    }
  ]
}
```

---

## Quiz

Múltipla escolha, uma questão por vez, explicação depois de responder, placar só na tela. Guarda o melhor resultado no navegador.

```tsx
<Quiz client:visible quiz={dados} idQuiz="..." embaralhar />
```

| Prop | Tipo | Obrigatória | Descrição |
| --- | --- | --- | --- |
| `quiz` | `Quiz` | sim | JSON da coleção `quizzes` |
| `idQuiz` | `string` | sim | Chave do melhor resultado |
| `embaralhar` | `boolean` | não | Embaralha a ordem das questões ao refazer. Padrão `false` |

### Formato do JSON (`src/content/dados/quizzes/*.json`)

```jsonc
{
  "titulo": "Revisão rápida: ...",
  "questoes": [
    {
      "id": "q1",
      "enunciado": "Pergunta?",
      "alternativas": [ { "id": "a", "texto": "..." }, { "id": "b", "texto": "..." } ],
      "correta": "b",
      "explicacao": "Por que b está certa."
    }
  ]
}
```

---

## Missões (Terminal e Analisador)

```jsonc
{
  "id": "gateway",                         // único dentro do JSON; é a chave do progresso
  "enunciado": "Qual é o gateway padrão?",
  "dica": "opcional",
  "comandosSugeridos": ["ip r"],           // no terminal, viram botões que colam o comando
  "resposta": { "tipo": "exata", "valor": "192.168.56.1" },
  "explicacao": "Mostrada quando o aluno acerta."
}
```

Tipos de `resposta`:

| Tipo | Exemplo | Observação |
| --- | --- | --- |
| `exata` | `{ "tipo": "exata", "valor": "192.168.56.1" }` | Ignora maiúsculas, acentos e espaços nas pontas |
| `umDe` | `{ "tipo": "umDe", "valores": ["8080", "tcp/8080"] }` | Qualquer uma das opções |
| `regex` | `{ "tipo": "regex", "padrao": "^8080$", "flags": "i" }` | Para casos mais livres |
| `numero` | `{ "tipo": "numero", "valor": 3, "tolerancia": 0 }` | Aceita vírgula decimal |

`tests/terminal.test.ts` roda os comandos sugeridos de cada missão e confere se a resposta aparece na saída. Vale fazer o mesmo quando criar uma rede nova.

---

## Componentes de conteúdo (Astro, para o MDX)

| Componente | Props | Uso |
| --- | --- | --- |
| `SaidaComentada` | `comando`, `notas?: { linha, texto }[]`, `prompt?`, `saida?` | Saída de terminal numerada. Coloque a saída num bloco de código dentro do componente. `texto` aceita HTML simples (`<code>`, `<strong>`). |
| `CasoReal` | `titulo`, `veiculo`, `data`, `url` | Caso real com fonte; o texto vai dentro. |
| `CasoFicticio` | `titulo` | Exemplo inventado, visualmente diferente do caso real; o texto vai dentro. |
| `Todo` | nenhuma | Marca algo para revisar. |
| `AvisoEtico` | nenhuma | Já entra sozinho no topo de todo lab de Ferramentas. |
