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


var iddoc = 0;
var iddoctext = '';

const openaiUrl = process.env.OPENAI_API_URL;
const headers = {
    'Content-Type': 'application/json',
    'api-key': process.env.OPENAI_API_KEY
};

let messageFromUser = ""

let conversation_history_array = [];

const history_length = 5;

let messages_init = {
    "role": "system",
    "content": "Assistant is a large language model trained by OpenAI and helps people find information. Assistant speaks in spanish"
};


class MainDialog extends LogoutDialog {

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

    //#region Funcion para conectarse a otros Endpoints
    async postDataToEndpoint(url, requestBody, headers) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield axios_1.default.post(url, requestBody, { headers });
                return response.data;
            }
            catch (error) {
                throw new Error(`Error de conexión con el servidor.`);
                //throw new Error(`Error posting data to ${url}: ${error}`);
            }
        });
    }
    //#endregion


    //Funcion para conectarse a OPEN AI
    async connectToAI(stepContext) {

        messageFromUser = stepContext.context.activity.text

        if (messageFromUser.length == 6) {
            try {
                if (parseInt(messageFromUser) > 0) {
                    return await stepContext.context.sendActivity("Inicio de sesión exitoso.")
                }
            } catch (error) {
                console.error(error);
                //return await stepContext.context.sendActivity(error)
            }
        }

        if (conversation_history_array.length == 0) {
            conversation_history_array.push(messages_init);
        }

        // Comprueba si el historial de conversaciones no es mayor que la longitud del historial, o elimínalo desde el principio.
        if (this.count_user_messages(conversation_history_array) > history_length) {
            console.log("Eliminando primera pregunta de usuario");
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
                    "type": "azure_search",
                    "parameters": {
                        "endpoint": process.env.SEARCH_ENDPOINT,
                        "key": process.env.SEARCH_KEY,
                        "index_name": process.env.SEARCH_INDEX_NAME,
                        "semantic_configuration": "default",
                        "query_type": "simple",
                        "fields_mapping": {
                            "content_fields_separator": "\n",
                            "content_fields": [
                                "merged_content"
                            ],
                            "filepath_field": "metadata_storage_name",
                            "title_field": null,
                            "url_field": "metadata_storage_path",
                            "vector_fields": []
                        },
                        "in_scope": true,
                        "role_information": "Eres un bot que responde en español, tus respuestas son basadas en documentos compartidos.",
                        "filter": null,
                        "strictness": 4,
                        "top_n_documents": 15,
                        "authentication": {
                            "type": "api_key",
                            "key": process.env.SEARCH_KEY
                        }
                    }
                }
            ],
            "messages": conversation_history_array,
            "temperature": 0.4,
            "top_p": 0.9,
            "frequency_penalty": 0,
            "presence_penalty": 0,
            "max_tokens": 1200,
            "stop": null
        });

        try {
            // Enviar request a OpenAI
            const data = await this.postDataToEndpoint(openaiUrl, reqBody, headers);

            // Agregar la respuesta del chatbot a "conversation history"
            conversation_history_array.push({ "role": data.choices[0].message.role, "content": data.choices[0].message.content });

            var numberReferences = 0;
            let listReferences = [];

            if (data.choices[0].message.content != null) {

                //Cantidad de referencias
                numberReferences = data.choices[0].message.context.citations.length;

                if (numberReferences > 0) {
                    data.choices[0].message.context.citations.forEach((element, index) => {
                        if (data.choices[0].message.content.includes(`[doc${index + 1}]`)) {
                            listReferences.push({ "doc": `[doc${index + 1}]`, "filepath": element.filepath })
                        }
                    });
                }

            }

            var responseBot = "";

            // Enviar respuesta a Usuario
            if (listReferences.length > 0) {
                responseBot = `${data.choices[0].message.content} \n `
                responseBot = responseBot + `\n Referencias: `
                listReferences.forEach(element => {
                    responseBot = responseBot + `\n ${element.doc} : ${element.filepath}`
                });
            }            
            else if (data.choices[0].message.content) {
                responseBot = `${data.choices[0].message.content} `
            }
            else {
                responseBot = "No se ha encontrado respuesta"
            }

            return await stepContext.context.sendActivity(responseBot)

        }
        catch (error) {
            return await stepContext.context.sendActivity(`${error} - Intente nuevamente.`)
        }
    }

}

module.exports.MainDialog = MainDialog;
