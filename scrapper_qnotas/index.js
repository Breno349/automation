require('dotenv').config({quiet:true});
const express = require('express');
const { Pool } = require('pg');
const { insertLogin, get_user, get_periodos, get_disciplinas, get_notas, get_user_content, get_comparation } = require('./login.js');
const { sendTelegramMessage, checkBotStatus } = require('./telegram.js');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3000; // Render injeta PORT automaticamente

// ... suas funções scrapper() e send_all() continuam iguais ...

async function init(){
    let browser;
    let pool;

    try {
        const status = await checkBotStatus();
        console.log(status.message);

        pool = new Pool({
            host: String(process.env.DB_HOST),
            user: String(process.env.DB_USERNAME),
            password: String(process.env.DB_PASSWORD),
            database: String(process.env.DB_NAME),
            port: process.env.DB_PORT
        });

        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        });

        const { rows: users } = await pool.query('SELECT * FROM users_qnotas');
        if(users.length == 0){
            console.log("Não há usuários.");
        }

        for(const user of users){
            const page = await browser.newPage();
            const user_info = await scrapper(page, pool, user, user.user_login, user.user_senha);
            if(user_info.sucess == false){
                console.log(user_info.message);
            } else {
                console.log(`mensagens associadas à ${user.user_id}: ${user_info.mensagens.length}`);
                await send_all(user_info.mensagens);
            }
            await page.close();
        }

        return { success: true, message: 'Execução concluída.' };

    } catch (erro){
        console.log('Erro: '+erro.message);
        return { success: false, message: erro.message };
    } finally {
        if (pool) await pool.end();
        if (browser) await browser.close();
    }
}

// Rota que o GitHub Actions/cron externo vai chamar de hora em hora
app.get('/run-scraper', async (req, res) => {
    const resultado = await init();
    res.status(resultado.success ? 200 : 500).json(resultado);
});

// Rota raiz, só pra health check da Render e pra "acordar" o serviço
app.get('/', (req, res) => {
    res.status(200).send('OK');
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});