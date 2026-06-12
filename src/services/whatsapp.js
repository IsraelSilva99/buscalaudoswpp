const axios = require('axios');
require('dotenv').config();

const { META_TOKEN, PHONE_NUMBER_ID } = process.env;
const API_VERSION = process.env.API_VERSION || 'v20.0';
const META_URL = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;

const headers = {
    Authorization: `Bearer ${META_TOKEN}`,
    'Content-Type': 'application/json'
};

// Envia mensagem de texto simples
async function enviarTexto(to, text) {
    try {
        await axios.post(META_URL, {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: 'text',
            text: { body: text }
        }, { headers });
    } catch (err) {
        console.error('Erro ao enviar texto:', err.response?.data || err.message);
    }
}

// Ativa o efeito "digitando..." (requer v21.0 e message_id)
async function enviarDigitando(messageId) {
    if (!messageId) return;
    try {
        const URL_V21 = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`;
        await axios.post(URL_V21, {
            messaging_product: 'whatsapp',
            status: 'read',
            message_id: messageId,
            typing_indicator: {
                type: 'text'
            }
        }, { headers });
    } catch (err) {
        console.error('Erro ao enviar typing_indicator:', err.response?.data || err.message);
    }
}


// Envia botões interativos (ex: SIM/NÃO para LGPD)
async function enviarBotoes(to, text, buttons) {
    const formattedButtons = buttons.map((btn, index) => ({
        type: 'reply',
        reply: { id: btn, title: btn }
    }));

    try {
        await axios.post(META_URL, {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: 'interactive',
            interactive: {
                type: 'button',
                body: { text },
                action: { buttons: formattedButtons }
            }
        }, { headers });
    } catch (err) {
        console.error('Erro ao enviar botões:', err.response?.data || err.message);
    }
}

// Envia uma lista interativa
async function enviarLista(to, bodyText, buttonText, sections) {
    try {
        await axios.post(META_URL, {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: 'interactive',
            interactive: {
                type: 'list',
                body: { text: bodyText },
                action: {
                    button: buttonText,
                    sections: sections
                }
            }
        }, { headers });
    } catch (err) {
        console.error('Erro ao enviar lista:', err.response?.data || err.message);
    }
}

// Envia o arquivo PDF do laudo
async function enviarDocumento(to, pdfBase64, filename, caption) {
    const FormData = require('form-data');
    try {
        // 1. Converte o base64 para Buffer e cria o FormData
        const buffer = Buffer.from(pdfBase64, 'base64');
        const formData = new FormData();
        formData.append('messaging_product', 'whatsapp');
        formData.append('type', 'application/pdf');
        formData.append('file', buffer, { filename: filename, contentType: 'application/pdf' });

        // 2. Faz o upload da mídia para a Meta
        const uploadUrl = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/media`;
        const uploadRes = await axios.post(uploadUrl, formData, {
            headers: {
                Authorization: `Bearer ${META_TOKEN}`,
                ...formData.getHeaders()
            }
        });

        const mediaId = uploadRes.data.id;

        // 3. Envia a mensagem usando o mediaId
        await axios.post(META_URL, {
            messaging_product: 'whatsapp',
            to,
            type: 'document',
            document: {
                id: mediaId,
                filename: filename,
                ...(caption ? { caption } : {})
            }
        }, { headers });
    } catch (err) {
        console.error('Erro ao enviar laudo PDF:', err.response?.data || err.message);
    }
}

// Envia uma imagem a partir de um link público (URL)
async function enviarImagemUrl(to, url, caption) {
    if (!url) return;
    try {
        await axios.post(META_URL, {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: 'image',
            image: {
                link: url,
                ...(caption ? { caption } : {})
            }
        }, { headers });
    } catch (err) {
        console.error('Erro ao enviar imagem:', err.response?.data || err.message);
    }
}

// Envia um botão interativo que abre um link (CTA URL)
async function enviarBotaoLink(to, text, buttonTitle, url) {
    try {
        await axios.post(META_URL, {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: 'interactive',
            interactive: {
                type: 'cta_url',
                body: { text },
                action: {
                    name: 'cta_url',
                    parameters: {
                        display_text: buttonTitle,
                        url: url
                    }
                }
            }
        }, { headers });
    } catch (err) {
        console.error('Erro ao enviar CTA URL:', err.response?.data || err.message);
    }
}

// Envia botão interativo para laudo pronto
async function enviarBotaoPDF(to, documento, codigoAtendimento) {
    const text = `Boas notícias! O laudo do seu exame (Protocolo: ${codigoAtendimento}) acabou de ficar pronto.\n\nPosso te enviar o PDF agora?`;
    const payload = `SEND_PDF_${documento}_${codigoAtendimento}`;
    
    try {
        await axios.post(META_URL, {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: 'interactive',
            interactive: {
                type: 'button',
                body: { text },
                action: { 
                    buttons: [
                        {
                            type: 'reply',
                            reply: { id: payload, title: 'Sim, pode enviar' }
                        }
                    ]
                }
            }
        }, { headers });
    } catch (err) {
        console.error('Erro ao enviar botão de PDF:', err.response?.data || err.message);
    }
}

module.exports = { enviarTexto, enviarBotoes, enviarLista, enviarDocumento, enviarDigitando, enviarImagemUrl, enviarBotaoLink, enviarBotaoPDF };
