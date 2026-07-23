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
        
        let pesos;
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
                disciplina: disciplina.descricao,
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

async function get_comparation(pool,user_content){
    try {

        console.log(user_content)

        return {
            sucess: true,
            message: 'get_comparation: comparação realizada com sucesso',
            data: ''
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