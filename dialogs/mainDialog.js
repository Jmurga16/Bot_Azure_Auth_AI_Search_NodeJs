// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const botbuilder_1 = require("botbuilder");
const axios_1 = require("axios");

const { ConfirmPrompt, DialogSet, DialogTurnStatus, OAuthPrompt, WaterfallDialog } = require('botbuilder-dialogs');
const { LogoutDialog } = require('./logoutDialog');

const CONFIRM_PROMPT = 'ConfirmPrompt';
const MAIN_DIALOG = 'MainDialog';
const MAIN_WATERFALL_DIALOG = 'MainWaterfallDialog';
const OAUTH_PROMPT = 'OAuthPrompt';
var b = 1;

const url = process.env.OPENAI_API_URL;
const headers = {
    'Content-Type': 'application/json',
    'api-key': process.env.OPENAI_API_KEY
};
let messageFromUser = ""

let conversation_history_dict = {};
const history_length = 3;
let messages_init = {
    "role": "system",
    "content": "As an advanced chatbot, your primary goal is to assist users to the best of your ability. This may involve answering questions, providing helpful information, or completing tasks based on user input. In order to effectively assist users, it is important to be detailed and thorough in your responses. Use examples and evidence to support your points and justify your recommendations or solutions."
};


class MainDialog extends LogoutDialog {

    url1 = process.env.OPENAI_API_URL;

    constructor() {
        super(MAIN_DIALOG, process.env.connectionName);

        this.addDialog(new OAuthPrompt(OAUTH_PROMPT, {
            connectionName: process.env.connectionName,
            text: 'Por favor Inicia Sesión y digite el código de validación',
            title: 'Iniciar Sesión',
            timeout: 300000
        }));

        this.addDialog(new ConfirmPrompt(CONFIRM_PROMPT));

        //stepContext = this
        this.addDialog(new WaterfallDialog(MAIN_WATERFALL_DIALOG, [
            this.promptStep.bind(this),
            this.loginStep.bind(this),
            //this.displayTokenPhase1.bind(this),
            //this.displayTokenPhase2.bind(this)
        ]));

        this.initialDialogId = MAIN_WATERFALL_DIALOG;
    }

    /**
     * The run method handles the incoming activity (in the form of a DialogContext) and passes it through the dialog system.
     * If no dialog is active, it will start the default dialog.
     * @param {*} dialogContext
     */
    async run(context, accessor) {
        const dialogSet = new DialogSet(accessor);
        dialogSet.add(this);

        const dialogContext = await dialogSet.createContext(context);
        const results = await dialogContext.continueDialog();
        if (results.status === DialogTurnStatus.empty) {
            await dialogContext.beginDialog(this.id);
        }
    }

    async promptStep(stepContext) {
        return await stepContext.beginDialog(OAUTH_PROMPT);
    }

    //Paso despues de digitar el token
    async loginStep(stepContext) {
        //Obtenga el token del paso anterior. Tenga en cuenta que también podríamos haber obtenido el token directamente desde el propio mensaje.
        const tokenResponse = stepContext.result;
        if (tokenResponse) {
            return await this.connectToAI(stepContext)
        }

        await stepContext.context.sendActivity('El inicio de sesión no fue exitoso, por favor intente nuevamente.');
        return await stepContext.endDialog();
    }

    //Paso si pones "No" despues de login
    async displayTokenPhase1(stepContext) {
        await stepContext.context.sendActivity('Gracias.');

        const result = stepContext.result;
        if (result) {
            //Llamamos al mensaje nuevamente porque necesitamos el token.
            //Si el usuario ya inició sesión, no necesitamos almacenar el token localmente en el bot y preocuparnos por actualizarlo            
            return await stepContext.beginDialog(OAUTH_PROMPT);
        }
        return await stepContext.endDialog();
    }

    //Paso si pones "Si" despues de login
    async displayTokenPhase2(stepContext) {
        const tokenResponse = stepContext.result;
        if (tokenResponse) {
            await stepContext.context.sendActivity(`Tu token ${tokenResponse.token}`);
        }
        return await stepContext.endDialog();
    }

    async connectToAI(stepContext) {
        //const tokenResponse = stepContext.result;
        let response = "Response";

        //messageFromUser = stepContext.context.activity.text

        let tmp_conversation_history = "";
        let conversation_history_array = [];


        //return await stepContext.context.sendActivity(stepContext.context.activity.text)

        // check if conversation history is not larger than history_length, if so remove from begining
        /* if (this.count_user_messages(conversation_history_array) > history_length) {
            console.log("history too long - removing first element");
            let N = 2;
            for (let i = 0; i < N; i++) {
                conversation_history_array.shift();
            }
            conversation_history_array[0] = messages_init;
        }
        conversation_history_array.push({ "role": "user", "content": messageFromUser });

        let reqBody = JSON.stringify({
            "data_sources": [
                {
                    "type": "AzureCognitiveSearch",
                    "parameters": {
                        "endpoint": process.env.SEARCH_ENDPOINT,
                        "key": process.env.SEARCH_KEY,
                        "index_name": process.env.SEARCH_INDEX_NAME
                    }
                }
            ],
            "messages": conversation_history_array,
            "temperature": 0.7,
            "top_p": 0.95,
            "frequency_penalty": 0,
            "presence_penalty": 0,
            "max_tokens": 800,
            "stop": null
        }); */

        return await stepContext.context.sendActivity(response)

        /* try {
            // send request to openai
            const data = await this.postDataToEndpoint(url, reqBody, headers);
            // add the chatbot response to the conversation history
            conversation_history_array.push({ "role": data.choices[0].message.role, "content": data.choices[0].message.content });
            // update conversation history
            conversation_history_dict[context.activity.conversation.id] = conversation_history_array;
            // send response to user
            const replyText = `${data.choices[0].message.content} \n[~  ${data.usage.total_tokens} tokens in ${conversation_history_array.length} turns]`;
            // const replyText = `Echox: ${ context.activity.text } value: ${ context.activity.value }`;
            //await context.sendActivity(botbuilder_1.MessageFactory.text(replyText));
            return await stepContext.context.sendActivity(replyText)
            // By calling next() you ensure that the next BotHandler is run.
            await next();
        }
        catch (error) {
            console.log(error);
            await context.sendActivity(botbuilder_1.MessageFactory.text(`${error} - try again later!`));
            await next();
        } */
    }

    postDataToEndpoint(url, requestBody, headers) {
        return (async () => {
            try {
                const response = await axios_1.default.post(url, requestBody, { headers });
                return response.data;
            }
            catch (error) {
                throw new Error(`Error posting data to ${url}: ${error}`);
            }
        });
    }

    // function that iterates through the conversation history and counts number of occurance "user" messages
    count_user_messages(conversation_history_array) {
        let count = 0;
        for (let i = 0; i < conversation_history_array.length; i++) {
            if (conversation_history_array[i].role == "user") {
                count = count + 1;
            }
        }
        return count;
    }

}

module.exports.MainDialog = MainDialog;
