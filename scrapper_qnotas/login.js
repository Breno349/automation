const { formatFirstLoginMessage,escapeMarkdownV2,escapeMarkdownV2Code } = require('./formatMessage.js');

async function insertLogin(page,user,pass){
    try {

        await page.goto('https://academico.ifes.edu.br/qacademico/index.asp?t=1001', {waitUntil: 'networkidle2'});
        await page.type('input[id=txtLogin]', user);
        await page.type('input[id=txtSenha]', pass);

        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2' }),
            page.click('input[name=Submit]')
        ]);

        const title = (await page.title()).toLowerCase();
        if(title.includes('acesso negado')){
            return {
                sucess: false,
                message: 'login: acesso negado'
            }
        }

        return {
            sucess: true,
            message: 'login: login realizado com sucesso'
        }

    } catch (erro){
        return {
            sucess: false,
            message: 'login: '+erro.message
        }
    }
}
async function get_user(page){
    try {

        const dados = await page.evaluate(async (url) => {
            const response = await fetch(url);
            const data = await response.json();
            return data;
        }, 'https://academico.ifes.edu.br/webapp/api/autenticacao/usuario-autenticado');

        return {
            sucess: true,
            message: 'get_user: dados do usuário obtidos com sucesso',
            data: dados
        }            
    } catch (erro) {
        return {
            sucess: false,
            message: 'get_user: '+erro.message
        }
    }
}
async function get_periodos(page){
    try {

        const dados = await page.evaluate(async (url) => {
            const response = await fetch(url);
            const data = await response.json();
            return data;
        }, 'https://academico.ifes.edu.br/webapp/api/diarios/aluno/periodos');

        return {
            sucess: true,
            message: 'get_periodo: dados do período letivo obtidos com sucesso',
            data: dados
        }            
    } catch (erro) {
        return {
            sucess: false,
            message: 'get_periodo: '+erro.message
        }
    }
}
async function get_disciplinas(page,periodo){
    try {

        const dados = await page.evaluate(async (url) => {
            const response = await fetch(url);
            const data = await response.json();
            return data;
        }, `https://academico.ifes.edu.br/webapp/api/boletim/disciplinas?anoLetivo=${periodo.anoLetivo}&periodoLetivo=${periodo.periodoLetivo}`);

        return {
            sucess: true,
            message: 'get_disciplinas: dados das disciplinas obtidos com sucesso',
            data: dados
        }
    } catch (erro) {
        return {
            sucess: false,
            message: 'get_disciplinas: '+erro.message
        }
    }
}
async function get_notas(page,user,disciplina){
    try {

        const dados = await page.evaluate(async (url) => {
            const response = await fetch(url);
            const data = await response.json();
            return data;
        }, `https://academico.ifes.edu.br/webapp/api/diarios/aluno/diarios/${disciplina.idDiario}/avaliacoes?idMatricula=${user.idMatricula}`);
        
        let pesos = {};
        for(const nota of dados){
            if(nota.descricao === 'Média Nota do Semestre'){
                pesos = extrair_peso(nota.formula? nota.formula : '');
                break;
            }
        }

        return {
            sucess: true,
            message: 'get_notas: dados das notas obtidos com sucesso',
            data: dados,
            pesos: pesos
        }
    } catch (erro) {
        return {
            sucess: false,
            message: 'get_notas: '+erro.message
        }
    }
}
function extrair_peso(expressao) {
  const expressaoLimpa = expressao.replace(/['"()]/g, '');
  const regex = /([A-Z]+[0-9]+)(?:\*([0-9.]+))?/gi;
  const resultado = {};
  const matches = expressaoLimpa.matchAll(regex);
  for (const match of matches) {
    const multiplicadorRaw = match[2];
    const nomeAvaliacao = match[1];
    resultado[nomeAvaliacao] = multiplicadorRaw ? Number(multiplicadorRaw) : 1;
  }
  return resultado;
}
async function get_user_content(page,user,disciplinas){
    try {
        const notas_promises = disciplinas.map(async (disciplina) => {

            const avaliacoes = []
            let lancados = 0;

            const notas = await get_notas(page,user.data,disciplina);
            if(notas.sucess == false){
                console.log(notas.message)
                return
            }

            for(const pv of notas.data){
                if(pv.tipoAvaliacao == 2 || (pv.idEtapa == "3" && pv.nota == null)) continue;
                const peso = notas.pesos[pv.sigla] ?? 1

                avaliacoes.push({
                    nome: pv.descricao,
                    nota: pv.nota? pv.nota*peso : 0,
                    max: pv.notaMaxima? pv.notaMaxima*peso : 0
                })
                lancados += pv.notaMaxima? pv.notaMaxima*peso : 0
            }

            return {
                nome: disciplina.descricao,
                professor: disciplina.professor,
                nota: disciplina.avaliacao? disciplina.avaliacao : 0,
                lancados: lancados,
                faltas: disciplina.totalFaltas? disciplina.totalFaltas : 0,
                avaliacoes: avaliacoes
            }
        });
        const notas = await Promise.all(notas_promises);

        const info = {
            nome: user.data.nomePessoa,
            curso: user.data.descCurso,
            periodo: `${user.periodo.anoLetivo}/${user.periodo.periodoLetivo}`,
            disciplinas: notas
        }

        return {
            sucess: true,
            message: 'get_user_content: dados do usuário obtidos com sucesso',
            data: info
        }
    } catch (erro) {
        return {
            sucess: false,
            message: 'get_user_content: '+erro.message
        }
    }
}

//https://academico.ifes.edu.br/webapp/api/comum/foto-do-perfil


async function get_comparation(pool,user,user_content){
    try {

        const mensagens = []
        //console.log(JSON.stringify(user_content,null,0))

        const { rows: users } = await pool.query(`SELECT * FROM users_qnotas_save WHERE user_id = $1 AND user_periodo = $2`,
            [user.user_id, user_content.periodo]
        );
        if(users.length <= 0){
            // quando é a primeira vez, o usuário recebe todas as matérias que ele está cadastrados
            
            mensagens.push({
                to: user.user_chatid,
                tipo: "telegram",
                content: formatFirstLoginMessage(user_content)
            })

            const user_content_json = JSON.stringify(user_content,null,0);
            const data = Buffer.from(user_content_json,'utf-8').toString('base64');

            await pool.query(`INSERT INTO users_qnotas_save (user_id, user_periodo, user_data) VALUES ($1, $2, $3)`,
                [user.user_id, user_content.periodo, data]
            );
            console.log("ADDED USER: "+user.user_name)
        } else {
            const user0 = users[0];
            const load_content = JSON.parse(Buffer.from(user0.user_data, 'base64').toString('utf-8'));
            // verificar alterações
            //console.log(JSON.stringify(load_content,null,10))
            for(const nv_disc of user_content.disciplinas){
    const disc = load_content.disciplinas.find(item => item.nome === nv_disc.nome);
    if(disc == undefined){
        // não existe
        mensagens.push({
            to: user.user_chatid,
            tipo:'telegram',
            content:
                `📚 *Nova matéria adicionada\\!*\n\n` +
                `📘 Disciplina: \`${escapeMarkdownV2Code(nv_disc.nome)}\`\n` +
                `👤 Professor: *${escapeMarkdownV2(nv_disc.professor)}*`
        })
    } else {
        // existe a disciplina
        for(const nv_pv of nv_disc.avaliacoes){
            const pv = disc.avaliacoes.find(item => item.nome === nv_pv.nome)
            if(pv == undefined){
                // prova não existia
                mensagens.push({
                    to: user.user_chatid,
                    tipo:'telegram',
                    content:
                        `📝 *Nova avaliação lançada\\!*\n\n` +
                        `📘 Disciplina: \`${escapeMarkdownV2Code(nv_disc.nome)}\`\n` +
                        `📄 Avaliação: \`${escapeMarkdownV2Code(nv_pv.nome)}\`\n` +
                        `📊 Nota: ${nv_pv.max > 0
                            ? `||${escapeMarkdownV2(nv_pv.nota)}||/${escapeMarkdownV2(nv_pv.max)}`
                            : '_não lançado_'}`
                })
            } else {
                // prova existe
                if(nv_pv.nota != pv.nota){
                    // a nota mudou
                    if(nv_pv.nota > pv.nota){
                        // aumentou
                        mensagens.push({
                            to: user.user_chatid,
                            tipo:'telegram',
                            content:
                                `📈 *Nota atualizada\\!*\n\n` +
                                `📘 Disciplina: \`${escapeMarkdownV2Code(nv_disc.nome)}\`\n` +
                                `📄 Avaliação: \`${escapeMarkdownV2Code(nv_pv.nome)}\`\n` +
                                `📊 Nota: ||${escapeMarkdownV2(pv.nota)}|| ➡️ ||${escapeMarkdownV2(nv_pv.nota)}||/${escapeMarkdownV2(nv_pv.max)}\n` +
                                `✅ Total lançado: ||${escapeMarkdownV2(nv_disc.nota)}||/${escapeMarkdownV2(nv_disc.lancados)}`
                        })
                    } else {
                        // diminuiu
                        mensagens.push({
                            to: user.user_chatid,
                            tipo:'telegram',
                            content:
                                `📉 *Nota atualizada\\!*\n\n` +
                                `📘 Disciplina: \`${escapeMarkdownV2Code(nv_disc.nome)}\`\n` +
                                `📄 Avaliação: \`${escapeMarkdownV2Code(nv_pv.nome)}\`\n` +
                                `📊 Nota: ||${escapeMarkdownV2(pv.nota)}|| ➡️ ||${escapeMarkdownV2(nv_pv.nota)}||/${escapeMarkdownV2(nv_pv.max)}\n` +
                                `✅ Total lançado: ||${escapeMarkdownV2(nv_disc.nota)}||/${escapeMarkdownV2(nv_disc.lancados)}`
                        })
                    }
                }
                if(nv_pv.max != pv.max){
                    // o máximo mudou
                    mensagens.push({
                        to: user.user_chatid,
                        tipo:'telegram',
                        content:
                            `🔄 *Valor máximo da avaliação alterado\\!*\n\n` +
                            `📘 Disciplina: \`${escapeMarkdownV2Code(nv_disc.nome)}\`\n` +
                            `📄 Avaliação: \`${escapeMarkdownV2Code(nv_pv.nome)}\`\n` +
                            `📊 Máximo: ${escapeMarkdownV2(pv.max)} ➡️ ${escapeMarkdownV2(nv_pv.max)}\n` +
                            `✅ Total lançado: ||${escapeMarkdownV2(nv_disc.nota)}||/${escapeMarkdownV2(nv_disc.lancados)}`
                    })
                }
            }
        }
    }
}

            const user_content_json = JSON.stringify(user_content,null,0);
            //console.log('\n\nSALVO:'+user_content_json+'\n\n')
            //console.log('\n\CATRREGADO:'+JSON.stringify(load_content,null,0)+'\n\n')
            const data = Buffer.from(user_content_json,'utf-8').toString('base64');
            await pool.query(`UPDATE users_qnotas_save SET user_data = $1 WHERE user_id = $2 AND user_periodo = $3`,
                [data, user.user_id, user_content.periodo]
            );
            console.log("USER UPDATED")
        }

        return {
            sucess: true,
            message: 'get_comparation: comparação realizada com sucesso',
            mensagens: mensagens
        }

    } catch (erro) {
        return {
            sucess: false,
            message: 'get_comparation: '+erro.message
        }
    }
}


module.exports = {
    insertLogin,
    get_user,
    get_periodos,
    get_disciplinas,
    get_notas,
    get_user_content,
    get_comparation
}