// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { ConfirmPrompt, DialogSet, DialogTurnStatus, OAuthPrompt, WaterfallDialog } = require('botbuilder-dialogs');

const { LogoutDialog } = require('./logoutDialog');

const CONFIRM_PROMPT = 'ConfirmPrompt';
const MAIN_DIALOG = 'MainDialog';
const MAIN_WATERFALL_DIALOG = 'MainWaterfallDialog';
const OAUTH_PROMPT = 'OAuthPrompt';

class MainDialog extends LogoutDialog {

    constructor() {
        super(MAIN_DIALOG, process.env.connectionName);

        this.addDialog(new OAuthPrompt(OAUTH_PROMPT, {
            connectionName: process.env.connectionName,
            text: 'Por favor Inicia Sesión',
            title: 'Iniciar Sesión',
            timeout: 300000
        }));

        this.addDialog(new ConfirmPrompt(CONFIRM_PROMPT));

        this.addDialog(new WaterfallDialog(MAIN_WATERFALL_DIALOG, [
            this.promptStep.bind(this),
            this.loginStep.bind(this),
            this.displayTokenPhase1.bind(this),
            this.displayTokenPhase2.bind(this)
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
            await stepContext.context.sendActivity('Ya has iniciado sesión.');
            return await stepContext.prompt(CONFIRM_PROMPT, 'Quieres ver tu token?');
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

}

module.exports.MainDialog = MainDialog;
