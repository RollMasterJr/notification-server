# RollMaster Trade Notifier

Este projeto é um bot que se conecta à API do CS:Roll para monitorar e notificar sobre transações de trade. Ele utiliza WebSockets para receber dados em tempo real e envia notificações para um canal do Discord quando uma transação ocorre.

## 📦 Bibliotecas Requeridas

Antes de começar, você precisará instalar as seguintes bibliotecas:

npm install readline ws uuid moment-timezone axios dotenv

## ⚙️ Configuração do Ambiente

### Variáveis de Ambiente

O projeto utiliza variáveis de ambiente para armazenar informações sensíveis. Crie um arquivo .env na raiz do projeto e adicione as seguintes variáveis:

COOKIE=<seu_cookie_aqui>
DISCORD_DEPOSIT_WEBHOOK_URL=<url_do_webhook_de_deposit>
DISCORD_WITHDRAW_WEBHOOK_URL=<url_do_webhook_de_retirada>

- COOKIE: O cookie de autenticação necessário para acessar a API.
- DISCORD_DEPOSIT_WEBHOOK_URL: URL do webhook do Discord onde notificações de depósitos serão enviadas.
- DISCORD_WITHDRAW_WEBHOOK_URL: URL do webhook do Discord onde notificações de retiradas serão enviadas.

## 🛠️ Como Executar

### Clone o Repositório

Comece clonando o repositório do projeto:

git clone <url_do_repositório>
cd <nome_do_repositório>

### Instale as Dependências

Navegue até o diretório do projeto e instale as dependências:

npm install

### Configure o Arquivo .env

Crie um arquivo .env conforme descrito na seção de configuração do ambiente.

### Execute o Bot

Agora você pode executar o bot usando o Node.js:

node index.js

Substitua index.js pelo nome do arquivo que contém o código.

## 🌐 Estrutura do Código

O código é dividido em várias seções principais:

1. **Importação de Bibliotecas**

import readline from 'readline';
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import moment from "moment-timezone";
import axios from "axios";
import dotenv from 'dotenv';

2. **Configuração da API**

O bot se conecta à API do CS:Roll através de um WebSocket:

const apiUrl = 'wss://api.csgoroll.com/graphql';

3. **Interface de Leitura**

Uma interface de leitura é criada para obter entrada do usuário:

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

4. **Funções de Consulta GraphQL**

As funções de consulta são definidas para obter dados do usuário atual:

const currentUserQuery = `
  query CurrentUser {
    currentUser {
      id
      wallets {
        name
        amount
      }
    }
  }
`;

5. **Conexão e Manipulação de Trades**

A função principal connect estabelece a conexão com a API e manipula trades:

async function handleTrade(trade) {
  // Lógica para lidar com trades
}

6. **Envio de Notificações ao Discord**

As notificações de trade são enviadas para um canal do Discord usando webhooks:

async function sendToDiscord(tradeData, webhookUrl) {
  // Lógica para enviar notificações
}

## 📈 Monitoramento e Reconnect

O bot tenta se reconectar automaticamente se a conexão WebSocket for perdida.

## 🚀 Contribuindo

Sinta-se à vontade para contribuir com melhorias ou relatórios de bugs. Para isso, você pode abrir um "issue" ou enviar um "pull request".

## 📜 Licença

Este projeto está licenciado sob a MIT License.

Sinta-se à vontade para fazer qualquer modificação ou melhoria que desejar!
