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
