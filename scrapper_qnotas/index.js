require('dotenv').config({quiet:true});
const { Pool } = require('pg');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function scrapper(page,pool,login,password){

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
        browser = await puppeteer.launch({headless:true});

        const { rows:users } = await pool.query('SELECT * FROM users_qnotas');
        for(const user of users){
            console.log(JSON.stringify(user,null,2))
        }

    } catch (erro){
        console.log('Erro: '+erro.message)
    } finally {
        await pool.end();
        await browser.close();
    }
}


init()