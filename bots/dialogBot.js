// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

//const { ActivityHandler } = require('botbuilder');
const botbuilder_1 = require("botbuilder");

class DialogBot extends botbuilder_1.ActivityHandler {
    /**
     *
     * @param {ConversationState} conversationState
     * @param {UserState} userState
     * @param {Dialog} dialog
     */
    constructor(conversationState, userState, dialog) {
        super();
        if (!conversationState) throw new Error('[DialogBot]: Missing parameter. conversationState is required');
        if (!userState) throw new Error('[DialogBot]: Missing parameter. userState is required');
        if (!dialog) throw new Error('[DialogBot]: Missing parameter. dialog is required');

        this.conversationState = conversationState;
        this.userState = userState;
        this.dialog = dialog;
        this.dialogState = this.conversationState.createProperty('DialogState');


        //Paso que contesta las preguntas
        this.onMessage(async (context, next) => {
            console.log('Running dialog with Message Activity.');

            // Ejecute el diálogo con la nueva actividad de mensaje.
            await this.dialog.run(context, this.dialogState);

            await next();
        });


        /* this.onMessage((context, next) => __awaiter(this, void 0, void 0, function* () {

            console.log('Running dialog with Message Activity.');

            var _a;
            var _b;
            // check if user input is "/reset"
            if (context.activity.text == "/reset") {
                // reset conversation history
                conversation_history_dict[context.activity.conversation.id] = [];
                // send response to user
                yield context.sendActivity(botbuilder_1.MessageFactory.text("Clearing session. Starting with new context - just ask your question."));
                // By calling next() you ensure that the next BotHandler is run.
                yield next();
            }
            else {
                //construct conversation history from conversation_history_array
                let tmp_conversation_history = "";
                (_a = conversation_history_dict[_b = context.activity.conversation.id]) !== null && _a !== void 0 ? _a : (conversation_history_dict[_b] = [messages_init]);
                let conversation_history_array = conversation_history_dict[context.activity.conversation.id];

                // check if conversation history is not larger than history_length, if so remove from begining
                if (count_user_messages(conversation_history_array) > history_length) {
                    console.log("History too long - removing first element");
                    let N = 2; // removing two elements (question and answer)
                    for (let i = 0; i < N; i++) {
                        conversation_history_array.shift(); // remove the first element from the array
                    }
                    // make sure that the first element is always the initial message (system message)
                    conversation_history_array[0] = messages_init;
                }

                // Add the user input to the conversation history
                conversation_history_array.push({ "role": "user", "content": context.activity.text });

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
                    // Send request to openai
                    const data = yield postDataToEndpoint(url, reqBody, headers);
                    // Add the chatbot response to the conversation history
                    conversation_history_array.push({ "role": data.choices[0].message.role, "content": data.choices[0].message.content });
                    // Update conversation history
                    conversation_history_dict[context.activity.conversation.id] = conversation_history_array;
                    // Send response to user
                    const replyText = `${data.choices[0].message.content} \n[~  ${data.usage.total_tokens} tokens in ${conversation_history_array.length} turns]`;

                    // const replyText = `Echox: ${ context.activity.text } value: ${ context.activity.value }`;
                    yield context.sendActivity(botbuilder_1.MessageFactory.text(replyText));
                    //yield this.dialog.run(context, this.dialogState);

                    // By calling next() you ensure that the next BotHandler is run.
                    yield next();
                }
                catch (error) {
                    console.log(error);
                    yield context.sendActivity(botbuilder_1.MessageFactory.text(`${error} - try again later!`));
                    yield next();
                }
            }
        })); 
        */

    }

    /**
     * Override the ActivityHandler.run() method to save state changes after the bot logic completes.
     */
    async run(context) {
        await super.run(context);

        // Guarda los cambios de estado. La carga se produjo durante la ejecución del diálogo.
        await this.conversationState.saveChanges(context, false);
        await this.userState.saveChanges(context, false);
    }
}

module.exports.DialogBot = DialogBot;
