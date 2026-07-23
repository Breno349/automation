function formatFirstLoginMessage(userContent) {
    const { nome, curso, periodo, disciplinas } = userContent;

    let mensagem = `👋 *Olá, ${escapeMarkdownV2(nome)}\\!*\n\n`;
    mensagem += `🎓 *Curso:* ${escapeMarkdownV2(curso)}\n`;
    mensagem += `📅 *Período:* ${escapeMarkdownV2(periodo)}\n\n`;
    mensagem += `Encontramos *${disciplinas.length}* disciplina\\(s\\) já disponíveis no seu histórico:\n\n`;

    disciplinas.forEach((disciplina) => {
        mensagem += `📘 *${escapeMarkdownV2(disciplina.nome)}*\n`;
        mensagem += `   👤 ${escapeMarkdownV2(disciplina.professor)}\n`;
        mensagem += disciplina.lancados > 0
            ? `   📊 Nota atual: ||${escapeMarkdownV2(disciplina.nota)}||/${escapeMarkdownV2(disciplina.lancados)}\n\n`
            : `   📊 Nada lançado\\!\n\n`;
    });

    mensagem += `_A partir de agora, você será notificado sempre que houver alterações\\._`;

    return mensagem;
}

function escapeMarkdownV2(texto) {
    return String(texto).replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

module.exports = { formatFirstLoginMessage };