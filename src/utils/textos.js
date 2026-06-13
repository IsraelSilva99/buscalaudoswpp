// Textos Estáticos e Padronizados do HMASP
const TEXTOS = {
    SAUDACAO_NOITE: 'Olá, boa noite! Tudo bem?\n\nEu sou o assistente virtual do HMASP. Estou aqui para ajudar o senhor(a) a receber o resultado do seu exame de forma simples e segura.',
    SAUDACAO_TARDE: 'Olá, boa tarde! Tudo bem?\n\nEu sou o assistente virtual do HMASP. Estou aqui para ajudar o senhor(a) a receber o resultado do seu exame de forma simples e segura.',
    SAUDACAO_DIA: 'Olá, bom dia! Tudo bem?\n\nEu sou o assistente virtual do HMASP. Estou aqui para ajudar o senhor(a) a receber o resultado do seu exame de forma simples e segura.',
    LGPD_TERMOS: 'Para garantir a segurança dos seus dados, por favor leia nosso termo de privacidade no documento acima.',
    LGPD_PERGUNTA: 'O senhor(a) concorda com os termos para podermos continuar?',
    LGPD_BLOQUEIO: 'Compreendo. Mas, por regras de segurança, só posso enviar o exame se os termos forem aceitos. Se mudar de ideia, é só me mandar um "Oi" novamente!',
    PEDIR_DOC: 'Por favor, digite apenas os números do seu *PREC-CP/PASS*.',
    BUSCANDO: 'Só um instante, por favor. Estou buscando o seu arquivo...',
    PEDIR_CODIGO: 'Agora, para garantir que só o senhor(a) acesse o resultado, por favor, digite o seu *Nº de Atendimento*.',
    ERRO_DOC_NAO_ENCONTRADO: 'Poxa, não consegui achar nenhum exame com esse número. O senhor(a) poderia conferir e digitar os números do seu *PREC-CP/PASS* novamente, por favor?',
    ERRO_TENTATIVAS: 'Por medidas de segurança e proteção dos seus dados, este atendimento precisou ser pausado temporariamente após algumas tentativas sem sucesso.\n\nO senhor(a) poderá tentar novamente em breve mandando um "Oi". Em caso de dúvidas, nossa equipe está à disposição no telefone *(11) 3278-4010.*',
    MENSAGEM_BLOQUEADO: 'Por medidas de segurança e proteção dos seus dados, este atendimento precisou ser pausado temporariamente após algumas tentativas sem sucesso.\n\nO senhor(a) poderá tentar novamente em breve mandando um "Oi". Em caso de dúvidas, nossa equipe está à disposição no telefone *(11) 3278-4010.*',
    CODIGO_INVALIDO: 'O número não bateu. Por favor, dê uma olhadinha no seu papel de protocolo e digite o número de atendimento mais uma vez.',
    PDF_ENVIADO: 'Prontinho! Aqui está o resultado do seu exame.\nÉ só tocar no arquivo acima para abrir e ler.',
    PESQUISA_SATISFACAO: 'Sua opinião é muito importante para nós!\nDe 1 a 5, qual nota o senhor(a) daria para o nosso atendimento hoje?',
    FIM_ATENDIMENTO: 'Agradeço muito pela sua avaliação! Foi um prazer ajudar. O HMASP deseja a você muita saúde! Se precisar de mim novamente no futuro, é só mandar um "Oi".'
};

function obterSaudacao() {
    try {
        const options = { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false };
        const hora = Number(new Date().toLocaleTimeString('pt-BR', options));

        if (hora >= 5 && hora < 12) return TEXTOS.SAUDACAO_DIA;
        if (hora >= 12 && hora < 18) return TEXTOS.SAUDACAO_TARDE;
        return TEXTOS.SAUDACAO_NOITE;
    } catch (error) {
        // Fallback caso dê algum erro de fuso horário
        const horaLocal = new Date().getHours();
        if (horaLocal >= 5 && horaLocal < 12) return TEXTOS.SAUDACAO_DIA;
        if (horaLocal >= 12 && horaLocal < 18) return TEXTOS.SAUDACAO_TARDE;
        return TEXTOS.SAUDACAO_NOITE;
    }
}

module.exports = { TEXTOS, obterSaudacao };
