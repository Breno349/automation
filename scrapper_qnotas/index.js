require('dotenv').config({quiet:true});
const { Pool } = require('pg');
const { insertLogin,get_user,get_periodos,get_disciplinas,get_notas,get_user_content } = require('./login.js');
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

        const user_diciplinas = await get_disciplinas(page,user_periodos.data[0]);
        if(user_diciplinas.sucess == false){
            return user_diciplinas;
        }

        const user_content = await get_user_content(page,user_info.data,user_diciplinas.data);
        if(user_content.sucess == false){
            return user_content;
        }

        //console.log('user_content: '+JSON.stringify(user_content.data,null,4))
        const info = JSON.stringify(user_content.data);
        const base = Buffer.from(info, 'utf-8').toString('base64');
        console.log('user_content: '+base)

        return user_content;

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