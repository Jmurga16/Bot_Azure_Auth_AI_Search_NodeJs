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

var counterSent = 0;

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

    // Función que itera a través del historial de conversaciones y cuenta la cantidad de mensajes de "usuario" que aparecen
    count_user_messages(conversation_history_array) {
        let count = 0;
        for (let i = 0; i < conversation_history_array.length; i++) {
            if (conversation_history_array[i].role == "user") {
                count = count + 1;
            }
        }
        return count;
    }

    //Funcion para conectarse a otros Endpoints
    async postDataToEndpoint(url, requestBody, headers) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield axios_1.default.post(url, requestBody, { headers });
                return response.data;
            }
            catch (error) {
                throw new Error(`Error posting data to ${url}: ${error}`);
            }
        });
    }

    //Funcion para conectarse a OPEN AI
    async connectToAI(stepContext) {

        messageFromUser = stepContext.context.activity.text

        counterSent++

        if (messageFromUser.length == 6 && counterSent == 1) {
            return await stepContext.context.sendActivity("Inició sesión exitoso.")
        }

        //await stepContext.context.sendActivity(`Consulta numero ${counterSent}`)

        let conversation_history_array = [{ "role": "user", "content": "Contestar en español" }];

        // Comprueba si el historial de conversaciones no es mayor que la longitud del historial, o elimínalo desde el principio.
        if (this.count_user_messages(conversation_history_array) > history_length) {
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
        });

        try {
            // Enviar request a OpenAI
            const data = await this.postDataToEndpoint(url, reqBody, headers);

            // Agregar la respuesta del chatbot a "conversation history"
            conversation_history_array.push({ "role": data.choices[0].message.role, "content": data.choices[0].message.content });
            // Actualizar "conversation history"
            conversation_history_dict[stepContext.context.activity.conversation.id] = conversation_history_array;
            // Enviar respuesta a Usuario
            const responseBot = `${data.choices[0].message.content} \n[~  ${data.usage.total_tokens} tokens in ${conversation_history_array.length} turns]`;

            return await stepContext.context.sendActivity(responseBot)

        }
        catch (error) {
            return await stepContext.context.sendActivity(`${error} - try again later!`)
        }
    }

}

module.exports.MainDialog = MainDialog;
