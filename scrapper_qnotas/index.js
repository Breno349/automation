require('dotenv').config({quiet:true});
const { Pool } = require('pg');
const { insertLogin,get_user,get_periodos,get_disciplinas,get_notas,get_user_content,get_comparation } = require('./login.js');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function scrapper(page,pool,login,password){
    try {

        const user_login = await insertLogin(page,login,password);
        if(user_login.sucess == false){
            return user_login;
        }

        const user_info = await get_user(page);
        if(user_info.sucess == false){
            return user_info;
        }

        const user_periodos = await get_periodos(page);
        if(user_periodos.sucess == false){
            return user_periodos;
        }
        user_info.periodo = user_periodos.data[0];

        const user_diciplinas = await get_disciplinas(page,user_info.periodo);
        if(user_diciplinas.sucess == false){
            return user_diciplinas;
        }

        const user_content = await get_user_content(page,user_info,user_diciplinas.data);
        if(user_content.sucess == false){
            return user_content;
        }

        const comparar = await get_comparation(pool,user_content.data)
        if(comparar.sucess == false){
            return comparar;
        }

        return comparar;

    } catch (erro){
        return {
            sucess: false,
            message: 'scrapper: '+erro.message
        }
    }
}

async function init(){
    let browser;
    let pool;

    try {
        pool = new Pool({
            host: String(process.env.DB_HOST),
            user: String(process.env.DB_USERNAME),
            password: String(process.env.DB_PASSWORD),
            database: String(process.env.DB_NAME),
            port: process.env.DB_PORT
        });
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
            ],
        });

        const { rows:users } = await pool.query('SELECT * FROM users_qnotas');
        for(const user of users){
            const page = await browser.newPage();
            const user_info = await scrapper(page,pool,user.user_login,user.user_senha);
            if(user_info.sucess == false){
                console.log(user_info.message)
            }
            console.log('Usuário: '+user.user_login+' - '+user_info.message)
            await page.close();
        }

    } catch (erro){
        console.log('Erro: '+erro.message)
    } finally {
        await pool.end();
        await browser.close();
    }
}


init()