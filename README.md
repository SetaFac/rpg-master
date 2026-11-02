# RPG Master — Mesa online

O mestre liga um pequeno servidor no próprio PC. Os jogadores se conectam pelo endereço dele, veem o mapa, movem os personagens que o mestre liberar, conversam e rolam dados no chat.

Funciona em **rede local** ou por **VPN** (Radmin VPN, Hamachi, ZeroTier, Tailscale…).

## Estrutura do projeto

```
RPG-Master/
├─ servidor/
│  ├─ servidor.js            # servidor da mesa online (Node.js, sem dependências)
│  ├─ Iniciar-Servidor.bat   # atalho para iniciar no Windows
│  └─ Iniciar-Servidor.sh    # atalho para iniciar no Mac/Linux
└─ app/
   ├─ RPG-Master.html        # página principal (só a estrutura)
   ├─ css/                   # estilos (temas, base, ficha, componentes, impressão, mesa virtual)
   └─ js/
      ├─ nucleo/             # motor de fórmulas, utilidades e traduções
      ├─ dados/              # dados de regras (Haki, técnicas, traços, antecedentes)
      ├─ modelos/            # sistemas de ficha (OP RPG, D&D 5e)
      ├─ ficha/              # runtime da ficha e renderização dos blocos
      ├─ casca/              # início, ficha, menus, importar/exportar, mesa do mestre
      ├─ app/                # editor de layout, Forja Texto e importador de .xlsx
      └─ mesa/               # som, terreno, Mesa virtual e mesa online (cliente)
```

> **Atenção:** a ordem dos `<script>` no `app/RPG-Master.html` importa, porque um arquivo depende do anterior. Mantenha também o atributo `data-app` em cada `<link>` e `<script>`: a prévia da Forja Texto usa esses arquivos para se montar.

## Passo a passo — Mestre

1. Instale o **Node.js** (gratuito, versão LTS): <https://nodejs.org>
2. Mantenha as pastas `servidor/` e `app/` lado a lado, como na estrutura acima.
3. Inicie o servidor, de acordo com o seu sistema:

   | Sistema       | Como iniciar                                                                 |
   | ------------- | ---------------------------------------------------------------------------- |
   | **Windows**   | Dê dois cliques em `servidor/Iniciar-Servidor.bat`.                           |
   | **Mac/Linux** | No terminal, rode `./servidor/Iniciar-Servidor.sh`.                           |
   | **Qualquer um** | Dentro da pasta `servidor/`, rode `node servidor.js`.                      |

   - Se o Node.js não estiver instalado, os dois atalhos (`.bat` e `.sh`) avisam e indicam onde baixar.
   - No Windows, se o Firewall perguntar, clique em **Permitir acesso**.
   - No Mac/Linux, se aparecer "permissão negada", dê permissão uma vez com `chmod +x servidor/Iniciar-Servidor.sh` (ou rode com `sh servidor/Iniciar-Servidor.sh`).
   - Os dois atalhos entram na própria pasta antes de iniciar, então funcionam de qualquer lugar.
4. A janela mostra a **chave do mestre** e os **endereços** (ex.: `http://26.1.2.3:3000`). Se você usa Radmin VPN, o endereço que começa com `26.` é o que seus amigos devem usar.
5. No RPG Master: **Mesa virtual → 🌐 Online** → cole o endereço (ou `http://localhost:3000`) e a chave → **Conectar**.
6. Clique num token → **Controlado por** → escolha o jogador (ou "Qualquer jogador").

## Passo a passo — Jogadores

1. Entrem na mesma rede VPN do mestre (ex.: Radmin VPN, com a rede e a senha que o mestre passar).
2. Abram o endereço que o mestre passou direto no navegador (ex.: `http://26.1.2.3:3000`), ou abram o RPG Master e usem **Entrar numa mesa online** → endereço + seu nome.
3. Movam só os personagens liberados. As rolagens de dados vão para o chat.

> **Sobre as fichas:** elas ficam guardadas no navegador **por endereço**. Quem entra pelo endereço do mestre e quem abre o arquivo `app/RPG-Master.html` direto do computador terá fichas separadas. Para manter as suas fichas de sempre, abra o arquivo local e use a opção de entrar numa mesa online. Esse arquivo só funciona com as pastas `css/` e `js/` ao lado dele, então quem for usá-lo precisa da pasta `app/` inteira.

## Opções do servidor

```bash
node servidor.js --porta 3000 --chave minhachave --senha segredo
```

| Opção       | O que faz                                                                          | Padrão                   |
| ----------- | ---------------------------------------------------------------------------------- | ------------------------ |
| `--porta`   | Porta em que o servidor escuta.                                                    | `3000`                   |
| `--chave`   | Chave do mestre, usada para conectar na Mesa virtual.                              | gerada aleatoriamente    |
| `--senha`   | Exige que os jogadores digitem uma senha para entrar.                              | sem senha                |
| `--arquivo` | Caminho do HTML a ser servido. As pastas `css/` e `js/` são buscadas ao lado dele. | `../app/RPG-Master.html` |

Para usar essas opções com os atalhos, rode o comando acima direto no terminal, dentro de `servidor/`.

## O que os jogadores veem

Só o que está visível: o que está sob névoa e os itens/tokens "ocultos" **nunca** são enviados a eles.

Efeitos e ambientes do painel de som podem tocar para eles (opção no diálogo Online). Músicas do seu computador **não** são transmitidas; use a call de voz (Discord) para isso.

## Cuidados

- O servidor é para jogar entre amigos. **Não abra a porta para a internet inteira sem VPN.** A chave do mestre só vale enquanto o servidor estiver ligado.
- Se o mestre fechar a janela do servidor, a mesa cai (o mapa continua salvo no navegador do mestre).
- Feche o servidor com `Ctrl+C` quando acabar a sessão.
