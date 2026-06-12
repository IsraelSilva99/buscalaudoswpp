const axios = require('axios');
const https = require('https');
const NodeCache = require('node-cache');
require('dotenv').config();

const { BL_BASE_URL, BL_API_KEY, SKIP_SSL } = process.env;
const tokenCache = new NodeCache({ stdTTL: 1500 }); // 25 minutos

const httpsAgent = new https.Agent({
    rejectUnauthorized: SKIP_SSL !== 'true'
});

// O manual diz que as chamadas devem ter Content-Type: application/json
const defaultHeaders = {
    'Content-Type': 'application/json'
};

// 1. Autenticação para obter o Token
async function login(documento) {
    try {
        const cachedToken = tokenCache.get(documento);
        if (cachedToken) {
            return cachedToken;
        }

        const url = `${BL_BASE_URL}/login/${BL_API_KEY}`;
        const response = await axios.post(url, { doc: documento }, { headers: defaultHeaders, httpsAgent });
        if (response.data && response.data.success && response.data.data) {
            const token = response.data.data;
            tokenCache.set(documento, token);
            return token; // Retorna o token
        }
        return null;
    } catch (err) {
        console.error(`Erro ao fazer login na API Busca Laudos (doc: ${documento}):`, err.response?.data || err.message);
        return null;
    }
}

// 2. Consultar Exames (Atendimentos)
async function consultarExames(documento) {
    try {
        const token = await login(documento);
        if (!token) return null;

        const url = `${BL_BASE_URL}/atendimento`;
        const response = await axios.get(url, {
            headers: {
                ...defaultHeaders,
                'APP-LAUDOS-AUTH': token
            },
            httpsAgent
        });

        if (response.data && response.data.success && response.data.data) {
            return response.data.data; // Array de atendimentos
        }
        return null;
    } catch (err) {
        if (err.response && err.response.status === 204) {
            // 204 NO CONTENT -> Sem exames
            return [];
        }
        console.error('Erro ao consultar exames:', err.response?.data || err.message);
        return null;
    }
}

// 3. Obter PDF do Laudo
async function obterPdfLaudo(documento, codigo) {
    try {
        const token = await login(documento);
        if (!token) return null;

        // Precisamos encontrar o ID do arquivo (resultado) para o código de atendimento informado
        // Para isso, buscamos os atendimentos primeiro
        const atendimentosUrl = `${BL_BASE_URL}/atendimento`;
        const atendimentosRes = await axios.get(atendimentosUrl, {
            headers: {
                ...defaultHeaders,
                'APP-LAUDOS-AUTH': token
            },
            httpsAgent
        });

        if (!atendimentosRes.data || !atendimentosRes.data.success || !atendimentosRes.data.data) {
            return null;
        }

        const atendimentos = atendimentosRes.data.data;
        const atendimentoEncontrado = atendimentos.find(a => a.codigoAtendimento === codigo);

        if (!atendimentoEncontrado) {
            console.error('Atendimento não encontrado para o código:', codigo);
            return { error: 'INVALID_CODE' };
        }

        if (!atendimentoEncontrado.resultados || atendimentoEncontrado.resultados.length === 0) {
            console.log('Exame ainda em análise para o código:', codigo);
            return { error: 'EM_ANALISE' };
        }

        // Pega o ID do arquivo do primeiro resultado disponível
        const idArquivo = atendimentoEncontrado.resultados[0].id;

        // Faz a requisição para obter o PDF
        const arquivoUrl = `${BL_BASE_URL}/arquivo/${idArquivo}/?codigoAtendimento=${codigo}`;
        const arquivoRes = await axios.get(arquivoUrl, {
            headers: {
                ...defaultHeaders,
                'APP-LAUDOS-AUTH': token
            },
            httpsAgent
        });

        if (arquivoRes.data && arquivoRes.data.success && arquivoRes.data.data) {
            return { base64: arquivoRes.data.data };
        }
        return null;
    } catch (err) {
        console.error('Erro ao obter PDF do laudo:', err.response?.data || err.message);
        return null;
    }
}

module.exports = { consultarExames, obterPdfLaudo };
