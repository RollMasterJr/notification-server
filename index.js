// 📦 Required Libraries
import readline from 'readline';  // For user input
import WebSocket from 'ws';       // WebSocket for real-time communication
import { v4 as uuidv4 } from 'uuid'; // For unique identifiers
import moment from 'moment-timezone'; // For date formatting
import axios from 'axios';        // For making HTTP requests
import dotenv from 'dotenv';      // For loading environment variables
import http from 'http';          // HTTP server for Render integration

// Load environment variables from .env
dotenv.config();

// 🌐 API Configuration
const apiUrl = 'wss://api.csgoroll.com/graphql';
let sockets = [];
let socket;
let pingInterval;
let reconnectAttempts = 0;

// 🖥️ Readline Interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 📋 Prompt Function
function prompt(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

// 🧩 GraphQL Queries
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

// 🔍 Fetch Current User Data
async function fetchCurrentUser(cookie) {
  try {
    const response = await axios({
      method: "post",
      url: "https://api.csgoroll.com/graphql",
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0',
      },
      data: {
        query: currentUserQuery,
        variables: {}
      }
    });

    if (response.data && response.data.data && response.data.data.currentUser) {
      const userData = response.data.data.currentUser;
      console.log('✅ User data fetched:', userData);

      // Set userId dynamically
      const userId = userData.id || null;

      // Get the main wallet balance or fallback to another wallet
      const wallets = userData.wallets || [];
      const mainWallet = wallets.find(wallet => wallet.name === "MAIN") || wallets[0];
      const mainWalletBalance = mainWallet ? mainWallet.amount : null;

      return { userId, mainWalletBalance };
    } else {
      console.error('❌ Invalid response format:', response.data);
      return { userId: null, mainWalletBalance: null };
    }
  } catch (error) {
    console.error("🚫 Error fetching current user:", error);
    return { userId: null, mainWalletBalance: null };
  }
}

// 📌 HTTP Server for Render Integration
const port = process.env.PORT || 4000;
const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Application is running and connected to WebSocket!\n');
});

server.listen(port, () => {
  console.log(`HTTP server listening on port ${port}. This is required by Render.`);
});

// 🛠️ Main Function
(async function() {
  // Read cookie from .env
  const cookie = process.env.COOKIE;

  if (!cookie) {
    console.error("❌ COOKIE is not defined in .env");
    return;
  }

  const { userId, mainWalletBalance } = await fetchCurrentUser(cookie);

  if (!userId) {
    console.error("❌ Failed to fetch user ID.");
    return;
  }

  // 📌 Configuration
  const config = {
    cookie: cookie,
    userId: userId,
    discordDepositWebhookUrl: process.env.DISCORD_DEPOSIT_WEBHOOK_URL,
    discordWithdrawWebhookUrl: process.env.DISCORD_WITHDRAW_WEBHOOK_URL
  };

  // 📈 Subscription Payloads
  const createTradePayload = {
    id: uuidv4(),
    type: "subscribe",
    payload: {
      query: `subscription OnCreateTrade {
        createTrade {
          trade {
            id
            status
            depositor {
              id
              steamId
              displayName
              __typename
            }
            withdrawer {
              id
              steamId
              displayName
              __typename
            }
            tradeItems {
              marketName
              value
              markupPercent
              stickers {
                wear
                value
                name
                color
              }
              __typename
            }
            __typename
          }
          __typename
        }
      }`
    }
  };

  const updateTradePayload = {
    id: uuidv4(),
    type: "subscribe",
    payload: {
      query: `subscription OnUpdateTrade {
        updateTrade {
          trade {
            id
            status
            depositor {
              id
              steamId
              displayName
              __typename
            }
            withdrawer {
              id
              steamId
              displayName
              __typename
            }
            tradeItems {
              marketName
              value
              markupPercent
              stickers {
                wear
                value
                name
                color
              }
              __typename
            }
            __typename
          }
          __typename
        }
      }`
    }
  };

  // 💰 Calculate Total Sticker Value
  function calculateTotalStickerValue(stickers) {
    return stickers.reduce((total, sticker) => total + (sticker.wear === 0 ? sticker.value || 0 : 0), 0);
  }

  // 🎨 Format Stickers for Display
  function formatStickers(stickers) {
    return stickers.map(sticker => {
      const stickerInfo = sticker.color ? `${sticker.color} ${sticker.name}` : `${sticker.name}`;
      return sticker.wear === 0 ? `${stickerInfo} Value: ${sticker.value}` : `${stickerInfo} (scraped) Value: ${sticker.value}`;
    }).join('\n');
  }

 // 📡 Send Data to Discord
 async function sendToDiscord(tradeData, webhookUrl) {
  const { tradeType, status, marketName, value, markup, totalStickerValue, coinBalance, stickers } = tradeData;
  const timestamp = moment().tz('America/Sao_Paulo').format('DD-MM-YYYY HH:mm:ss');

  // Emojis for better visuals
  const tradeTypeEmoji = tradeType === 'Deposit' ? '🔴' : '🟢';
  const statusEmoji = getStatusEmoji(status); 
  const embedColor = tradeType === 'Deposit' ? 0xF04747 : 0x43B581;

  // Format values for display
  const formattedCoinBalance = coinBalance !== null && coinBalance !== undefined ? coinBalance.toFixed(2) : 'N/A';
  const formattedValue = value !== null && value !== undefined ? value.toFixed(2) : 'N/A';

  // Se o coinBalance for null, notifica sobre o cookie expirado
  if (coinBalance === null) {
      const expiredEmbed = {
          embeds: [{
              author: {
                  name: `${tradeTypeEmoji} Cookie Expirado!`,
                  icon_url: 'https://cdn-icons-png.flaticon.com/128/9260/9260717.png'
              },
              description: `O cookie usado para a autenticação expirou, e o saldo não pôde ser recuperado.`,
              color: 0xFF0000,
              fields: [
                  { name: 'Item', value: marketName || 'Unknown', inline: true },
                  { name: 'Trade Type', value: tradeType, inline: true },
                  { name: 'Status', value: status, inline: true },
                  { name: 'Timestamp', value: timestamp, inline: false }
              ],
              footer: {
                  text: `📅 Timestamp: ${timestamp} | Powered by RollMaster`
              }
          }]
      };

      try {
          const response = await fetch(webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(expiredEmbed)
          });

          if (!response.ok) {
              throw new Error(`Error: ${response.status} ${response.statusText}`);
          }

          const responseBody = await response.text();
          if (responseBody) {
              const data = JSON.parse(responseBody);
              console.log('✅ Notificação de cookie expirado enviada para o Discord:', data);
          } else {
              console.warn('⚠️ Resposta vazia ao notificar sobre o cookie expirado.');
          }
      } catch (error) {
          console.error('🚫 Falha ao enviar notificação de cookie expirado para o Discord:', error);
      }
      return; // Para não continuar processando trades sem saldo
  }

  const embed = {
      embeds: [{
          author: {
              name: `${tradeTypeEmoji} ${tradeType} Trade Notification`,
              icon_url: 'https://cdn-icons-png.flaticon.com/128/9260/9260717.png'
          },
          title: `${statusEmoji} Trade Status: ${status}`,
          color: embedColor,
          fields: [
              { name: 'Item', value: marketName || 'Unknown', inline: true },
              { name: 'Value', value: `$${formattedValue}`, inline: false },
              { name: 'Markup', value: `${markup !== null && markup !== undefined ? `${markup}%` : '0%'}`, inline: false },
              { name: 'Total Sticker Value', value: `$${totalStickerValue !== null && totalStickerValue !== undefined ? totalStickerValue.toFixed(2) : '0'}`, inline: false },
              { name: 'Balance', value: `$${formattedCoinBalance}`, inline: false },
              { name: 'Applied Stickers', value: formatStickers(stickers) || 'None' }
          ],
          footer: {
              text: `📅 Timestamp: ${timestamp} | Powered by RollMaster`,
          }
      }]
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(embed)
  });

  if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : 10000; // 10s como fallback
      console.warn(`⚠️ Too Many Requests. Waiting for ${waitTime / 1000} seconds.`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return sendToDiscord(tradeData, webhookUrl); // Tentar novamente após a espera
  }

  if (!response.ok) {
      throw new Error(`Error: ${response.status} ${response.statusText}`);
  }

      // Verificar se a resposta tem um corpo e se é um JSON válido
      const responseBody = await response.text();
      if (responseBody) {
          const data = JSON.parse(responseBody);
          console.log('✅ Successfully sent to Discord:', data);
      } else {
          console.warn('⚠️ Empty response from Discord.');
      }
  } catch (error) {
      console.error('🚫 Failed to send to Discord:', error);
  }
}

  // Function to get the appropriate emoji for the status
function getStatusEmoji(status) {
  switch (status) {
    case 'COMPLETED':
      return '✅';
    case 'CANCELLED':
      return '❌';
    case 'LISTED':
      return '📰';
    case 'PROCESSING':
      return '⏳';
    case 'JOINED':
      return '🤝';
    default:
      return '❓';
  }
}

  // 🛠️ Handle Trade Logic
  async function handleTrade(trade) {
    const depositor = trade.depositor || {};
    const withdrawer = trade.withdrawer || {};
    const item = trade.tradeItems && trade.tradeItems[0];

    // Skip "listed" trades (trades that are just listed but not completed)
    if (trade.status === 'listed') {
      return; // Ignore trades in the "listed" status
    }

    let tradeType = '';
    let webhookUrl = '';

    // Log both deposits and withdrawals, but ignore irrelevant trades
    if (depositor.id === config.userId) {
      tradeType = 'Deposit';
      webhookUrl = config.discordDepositWebhookUrl;
    } else if (withdrawer.id === config.userId) {
      tradeType = 'Withdraw';
      webhookUrl = config.discordWithdrawWebhookUrl;
    } else {
      return; // Not relevant for logging
    }

    const marketName = item ? item.marketName : '-';
    const value = item ? item.value : '-';
    const markup = item ? item.markupPercent : '-';
    const stickers = item ? item.stickers || [] : [];
    const totalStickerValue = calculateTotalStickerValue(stickers);
    const coinBalance = await fetchCurrentUser(config.cookie).then(result => result.mainWalletBalance);

    const tradeData = {
      tradeType,
      status: trade.status,
      marketName,
      value,
      markup,
      totalStickerValue,
      stickers,
      coinBalance
    };

    console.log(`[${moment().tz('Europe/Berlin').format('HH:mm:ss')}] [${tradeType}] Status: ${trade.status}, Item: ${marketName}, Value: ${value}, Markup: ${markup}%, Total Sticker Value: ${totalStickerValue}, Coin Balance: ${coinBalance}`);
    await sendToDiscord(tradeData, webhookUrl);
  }

  // 🔄 Self-Ping Interval to Keep Render Active
const keepAliveInterval = 14 * 60 * 1000; // 14 minutos em milissegundos

// Função para enviar a requisição HTTP para manter o servidor ativo
  setInterval(() => {
    console.log('🔄 Enviando uma requisição para manter o servidor ativo...');
   http.get(`http://localhost:${port}/`, (res) => {
    console.log(`🟢 Keep-alive request status code: ${res.statusCode}`);
   }).on('error', (err) => {
     console.error('❌ Erro na requisição de keep-alive:', err.message);
    });
  }, keepAliveInterval);

   // 🔗 WebSocket Connection
   function connect(config) {
    socket = new WebSocket(apiUrl, 'graphql-transport-ws', {
      headers: {
        'Cookie': config.cookie,
        "Sec-WebSocket-Protocol": "graphql-transport-ws",
        "Sec-WebSocket-Version": 13,
        "Upgrade": "websocket",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 OPR/100.0.0.0"
      }
    });

    let isAlive = true;

    // Handle pong responses to verify connection
    socket.on('pong', () => {
      isAlive = true; // Reset the isAlive flag when pong is received
      console.log('🔄 Pong received. Connection is alive.');
    });

    socket.on('open', () => {
      console.log("✅ WebSocket opened");
      reconnectAttempts = 0;
      socket.send(JSON.stringify({ type: 'connection_init' }));
      socket.send(JSON.stringify(createTradePayload));
      socket.send(JSON.stringify(updateTradePayload));
      sockets.push(socket);
      clearInterval(pingInterval);
  
      // Start ping-pong mechanism with 14-minute interval
      pingInterval = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          if (!isAlive) {
            console.warn('⚠️ No pong received, reconnecting...');
            socket.terminate(); // Close the socket and trigger reconnect
          } else {
            isAlive = false; // Expect pong in the next interval
            socket.ping();   // Send a ping frame
          }
        }
      }, 840000); // Ping every 14 minutes for more frequent checking
    });
  
    socket.on('message', async (data) => {
      const message = JSON.parse(data);
    
      // Verifique se a mensagem é uma confirmação de conexão
      if (message.type === 'connection_ack') {
        console.log('✅ Conexão estabelecida com sucesso.');
        return; // Ignorar confirmação de conexão
      }
    
      const trade = message.payload?.data?.createTrade?.trade || message.payload?.data?.updateTrade?.trade;
    
      // Verificação se o trade é válido
      if (!trade) {
        console.warn('⚠️ Trade inválido ou vazio recebido:', message);
        return; // Ignorar mensagem inválida
      }
    
      await handleTrade(trade);
    });
    
  
    socket.on('error', (err) => {
      console.error('🚫 WebSocket error:', err.message);
      clearInterval(pingInterval);
    });
  
    socket.on('close', () => {
      console.log('⚠️ WebSocket closed. Attempting to reconnect...');
      clearInterval(pingInterval);
      sockets = sockets.filter(s => s !== socket);
      if (reconnectAttempts < 5) {
        reconnectAttempts++;
        setTimeout(() => connect(config), 1000);
      } else {
        console.error('❌ Failed to reconnect after multiple attempts.');
      }
    });
  }

  connect(config); // 🔗 Start WebSocket Connection
})();
