const axios = require('axios');

const TIMEOUT_MS = 8000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000; // espera entre tentativas

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry(fn, maxRetries = MAX_RETRIES) {
    let ultimoErro;

    for (let tentativa = 1; tentativa <= maxRetries; tentativa++) {
        try {
            return await fn();
        } catch (erro) {
            ultimoErro = erro;
            console.log(`Tentativa ${tentativa}/${maxRetries} falhou: ${erro.message}`);

            // não adianta tentar de novo se o token for inválido (401)
            if (erro.response && erro.response.status === 401) {
                throw erro;
            }

            if (tentativa < maxRetries) {
                await sleep(RETRY_DELAY_MS * tentativa); // backoff crescente: 1s, 2s
            }
        }
    }

    throw ultimoErro;
}

async function sendTelegramMessage(mensagem, chat_id) {
    try {
        await withRetry(() =>
            axios.post(
                `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
                {
                    chat_id: chat_id,
                    text: mensagem,
                    parse_mode: "MarkdownV2"
                },
                { timeout: TIMEOUT_MS }
            )
        );
    } catch (erro) {
        console.log('Erro ao enviar Telegram (após retries): ' + erro.message);
    }
}

async function checkBotStatus() {
    try {
        const response = await withRetry(() =>
            axios.get(
                `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`,
                { timeout: TIMEOUT_MS }
            )
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
        if (erro.response && erro.response.status === 401) {
            return {
                success: false,
                message: 'Token inválido ou bot não existe.',
            };
        }

        return {
            success: false,
            message: `Erro ao verificar bot (após retries): ${erro.message}`,
        };
    }
}

module.exports = {
    sendTelegramMessage,
    checkBotStatus
};