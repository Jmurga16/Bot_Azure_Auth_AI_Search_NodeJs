// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// index.js is used to setup and configure your bot

// Import required pckages
const path = require('path');

// Read botFilePath and botFileSecret from .env file.
const ENV_FILE = path.join(__dirname, '.env');
require('dotenv').config({ path: ENV_FILE });

const restify = require('restify');

// Import required bot services.
// See https://aka.ms/bot-services to learn more about the different parts of a bot.
const {
  CloudAdapter,
  ConversationState,
  MemoryStorage,
  UserState,
  ConfigurationBotFrameworkAuthentication
} = require('botbuilder');

const { AuthBot } = require('./bots/authBot');
const { MainDialog } = require('./dialogs/mainDialog');

const botFrameworkAuthentication = new ConfigurationBotFrameworkAuthentication(process.env);
// Create adapter.
// See https://aka.ms/about-bot-adapter to learn more about adapters.
const adapter = new CloudAdapter(botFrameworkAuthentication);

adapter.onTurnError = async (context, error) => {

  console.error(`\n [onTurnError] unhandled error: ${error}`);

  // Send a trace activity, which will be displayed in Bot Framework Emulator
  await context.sendTraceActivity('OnTurnError Trace', `${error}`, 'https://www.botframework.com/schemas/error', 'TurnError');

  // Send a message to the user
  await context.sendActivity('The bot encountered an error or bug.');
  await context.sendActivity('To continue to run this bot, please fix the bot source code.');
  // Clear out state
  await conversationState.delete(context);
};

// Define the state store for your bot.
// See https://aka.ms/about-bot-state to learn more about using MemoryStorage.
// A bot requires a state storage system to persist the dialog and user state between messages.
const memoryStorage = new MemoryStorage();

// Create conversation and user state with in-memory storage provider.
const conversationState = new ConversationState(memoryStorage);
const userState = new UserState(memoryStorage);

// Create the main dialog.
const dialog = new MainDialog();

// Create the bot that will handle incoming messages.
const bot = new AuthBot(conversationState, userState, dialog);

// Create HTTP server.
const server = restify.createServer();
server.use(restify.plugins.bodyParser());

server.listen(process.env.port || process.env.PORT || 3978, function () {
  //console.log(`\n${server.name} listening to ${server.url}`);
  console.log(`\n${server.name} listening to http://localhost:3978`);
  console.log('\nGet Bot Framework Emulator: https://aka.ms/botframework-emulator');
  console.log('\nTo talk to your bot, open the emulator select "Open Bot"');
});

// HTTP / Pagina Principal
server.get('/', (req, res, next) => {

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.write(`
      
  <!DOCTYPE html>
  <html>
    <head>
      <script
        crossorigin="anonymous"
        src="https://cdn.botframework.com/botframework-webchat/latest/webchat.js"
      ></script>
      <style>
        html,
        body {
            height: 100%;
            background-image: linear-gradient( #343541,#525468);
            color: antiquewhite;
            font-family: 'Segoe UI', Calibri, sans-serif;
        }
  
        body {
          padding-left: 5px;
        }
  
        #webchat {
          height: 85%;
          width: 100%;
        }
        .webchat__stacked-layout__main{
          white-space: break-spaces;
          
        }
        .webchat__stacked-layout--from-user{
          background-color: rgba(32,33,35, .2);
        }
        
      </style>
    </head>
    <body>
      
      <h1><img src='https://logos-world.net/wp-content/uploads/2021/02/Microsoft-Azure-Emblem.png' height="40">ChatGPT - REP</h1>
      <!-- <pre>version 20231030 | model: ChatGPT (turbo) | API: Chat Completion API | max_tokens: 800 | temperature: 0.7 | Speech input enabled: false | Speech language: N/A</pre>  -->
      <div style="" id="webchat" role="main"></div>
      <script>
        // Set  the CSS rules.
        const styleSet = window.WebChat.createStyleSet({
            bubbleBackground: 'transparent',
            bubbleBorderColor: 'darkslategrey',
            bubbleBorderRadius: 5,
            bubbleBorderStyle: 'solid',
            bubbleBorderWidth: 0,
            bubbleTextColor: 'antiquewhite',
  
            userAvatarBackgroundColor: 'rgba(53, 55, 64, .3)',
            bubbleFromUserBackground: 'transparent', 
            bubbleFromUserBorderColor: '#E6E6E6',
            bubbleFromUserBorderRadius: 5,
            bubbleFromUserBorderStyle: 'solid',
            bubbleFromUserBorderWidth: 0,
            bubbleFromUserTextColor: 'antiquewhite',
  
            notificationText: 'white',
  
            bubbleMinWidth: 400,
            bubbleMaxWidth: 720,
  
            botAvatarBackgroundColor: 'antiquewhite',
            avatarBorderRadius: 2,
            avatarSize: 40,
  
            rootHeight: '100%',
            rootWidth: '100%',
            backgroundColor: 'rgba(70, 130, 180, .2)',
  
            hideUploadButton: 'true'
        });
  
        // After generated, you can modify the CSS rules.
        // Change font family and weight. 
        styleSet.textContent = {
            ...styleSet.textContent,
            fontWeight: 'regular'
        };
  
      // Set the avatar options. 
        const avatarOptions = {
            botAvatarInitials: '.',
            userAvatarInitials: 'Me',
            botAvatarImage: 'https://dwglogo.com/wp-content/uploads/2019/03/1600px-OpenAI_logo-1024x705.png',            
            };

        window.WebChat.renderWebChat(
          {
            directLine: window.WebChat.createDirectLine({
              token: '` + process.env.DIRECT_LINE_TOKEN + `'
            }),
            styleSet, styleOptions: avatarOptions
          },
          document.getElementById('webchat')
        );
      </script>
        
    </body>
  </html>
      `);
  res.end();
  return next();
});

// Enpoint Principal Azure Bot.
server.post('/api/messages', async (req, res) => {
  await adapter.process(req, res, (context) => bot.run(context));
});

// Endpoint Test
server.post('/api/test', (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
  res.writeHead(200);
  res.end('Hello Azure');
}));