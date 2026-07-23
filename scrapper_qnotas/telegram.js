const axios = require('axios');

async function sendTelegramMessage(mensagem,chat_id) {
    try {
        await axios.post(
            `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
            {
                chat_id: chat_id,
                text: mensagem,
                parse_mode: "MarkdownV2"
            },
            { timeout: 30000 }
        );
    } catch (erro) {
        console.log('Erro ao enviar Telegram: ' + erro.message);
    }
}

async function checkBotStatus() {
    try {
        const response = await axios.get(
            `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`, { timeout : 30000 }
        );

        if (response.data.ok) {
            return {
                success: true,
                message: `Bot ativo: @${response.data.result.username}`,
            };
        }

        return {
            success: false,
            message: 'Bot respondeu, mas retorno inesperado.',
        };

    } catch (erro) {
        // Telegram retorna 401 se o token for inválido/revogado
        if (erro.response && erro.response.status === 401) {
            return {
                success: false,
                message: 'Token inválido ou bot não existe.',
            };
        }

        return {
            success: false,
            message: `Erro ao verificar bot: ${erro.message}`,
        };
    }
}

module.exports = {
    sendTelegramMessage,
    checkBotStatus
};