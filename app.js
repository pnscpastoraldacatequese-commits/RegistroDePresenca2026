// app.js

// Variáveis globais de controle de roteamento
const urlParams = new URLSearchParams(window.location.search);
const turmaId = urlParams.get('turmaId');
const chaveSecreta = urlParams.get('key');

// Função de inicialização
window.onload = function() {
    if (turmaId && chaveSecreta) {
        // Modo CATEQUISTA (Com ID e CHAVE na URL)
        document.getElementById('catequista-page').style.display = 'block';
        validarChaveEIniciar(turmaId, chaveSecreta);
    } else {
        // Modo ADMINISTRADOR (Sem ID/Chave na URL)
        document.getElementById('admin-panel').style.display = 'block';
        carregarTurmas(); 
        
        // Adicionar Listeners de Formulário Admin
        document.getElementById('form-turma').addEventListener('submit', (e) => {
            e.preventDefault();
            adicionarTurmaIndividual();
        });
        document.getElementById('form-participante').addEventListener('submit', (e) => {
            e.preventDefault();
            adicionarParticipanteIndividual();
        });
    }
};

// =========================================================================
//                  FUNÇÕES MODO CATEQUISTA (Registro de Presença)
// =========================================================================

/**
 * Valida a chave secreta da URL contra a chave no Firestore antes de carregar a turma.
 * @param {string} turmaId ID da turma.
 * @param {string} chaveSecreta Chave de acesso.
 */
async function validarChaveEIniciar(turmaId, chaveSecreta) {
    try {
        const turmaRef = db.collection("turmas").doc(turmaId);
        const turmaDoc = await turmaRef.get();

        if (!turmaDoc.exists) {
             document.getElementById('catequista-page').innerHTML = "<h1>Erro: Turma Inexistente.</h1>";
             return;
        }

        const data = turmaDoc.data();
        if (data.chave_secreta !== chaveSecreta) {
             document.getElementById('catequista-page').innerHTML = "<h1>Erro: Chave de Acesso Inválida.</h1>";
             return;
        }

        // Se a chave for válida, carrega a interface
        document.getElementById('turma-info').innerHTML = `Turma: ${data.nome} | Catequista: ${data.catequista}`;
        carregarParticipantes(turmaId);
        visualizarPresencas(turmaId);

    } catch (error) {
        console.error("Erro na validação da chave ou comunicação:", error);
        document.getElementById('catequista-page').innerHTML = `<h1>Erro: Falha ao carregar dados. Detalhes: ${error.message}</h1>`;
    }
}

/**
 * Carrega a lista de participantes da turma para o select.
 * @param {string} turmaId ID da turma.
 */
function carregarParticipantes(turmaId) {
    db.collection("participantes").where("turma_id", "==", turmaId).get()
        .then((querySnapshot) => {
            const select = document.getElementById('participante-select');
            select.innerHTML = '<option value="">Selecione o Catequizando</option>'; // Limpa e adiciona opção padrão
            querySnapshot.forEach((doc) => {
                const participante = doc.data();
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = participante.nome;
                select.appendChild(option);
            });
        })
        .catch(error => console.error("Erro ao carregar participantes:", error));
}

/**
 * Registra a presença (Encontro ou Missa) no Firestore.
 * Inclui a chave secreta para validação via Firestore Rules (sem Auth).
 * @param {string} tipo 'encontro' ou 'missa'.
 */
function registrarPresenca(tipo) {
    const participanteId = document.getElementById('participante-select').value;
    
    if (!participanteId) {
        alert("Selecione um catequizando para registrar a presença.");
        return;
    }

    db.collection("presencas").add({
        participante_id: participanteId,
        turma_id: turmaId,
        tipo: tipo,
        data: FieldValue.serverTimestamp(),
        key: chaveSecreta // ESSENCIAL para a regra de segurança do Firestore
    })
    .then(() => {
        alert(`Presença (${tipo}) registrada com sucesso!`);
        visualizarPresencas(turmaId); // Atualiza a lista
    })
    .catch(error => console.error("Erro ao registrar presença:", error));
}

/**
 * Visualiza os últimos 10 registros de presença.
 * @param {string} turmaId ID da turma.
 */
function visualizarPresencas(turmaId) {
    const list = document.getElementById('presencas-list');
    list.innerHTML = '<li>Carregando registros...</li>'; 

    // O uso de onSnapshot mantém a lista atualizada em tempo real
    db.collection("presencas").where("turma_id", "==", turmaId)
        .orderBy("data", "desc").limit(10).onSnapshot(async (snapshot) => {
        list.innerHTML = '';
        const presencaDocs = snapshot.docs;

        if (presencaDocs.length === 0) {
            list.innerHTML = '<li>Nenhuma presença registrada ainda.</li>';
            return;
        }

        for (const doc of presencaDocs) {
            const registro = doc.data();
            const item = document.createElement('li');
            
            // Busca o nome do participante para exibição
            const pDoc = await db.collection("participantes").doc(registro.participante_id).get();
            const nome = pDoc.data() ? pDoc.data().nome : "Participante Desconhecido";
            
            const dataObj = registro.data ? new Date(registro.data.toDate()) : new Date();
            const dataFormatada = dataObj.toLocaleDateString('pt-BR', { dateStyle: 'short' }) + ' ' + 
                                  dataObj.toLocaleTimeString('pt-BR', { timeStyle: 'short' });
            
            item.textContent = `${dataFormatada} - ${nome} (${registro.tipo.toUpperCase()})`;
            list.appendChild(item);
        }
    }, error => {
        console.error("Erro no listener de presenças:", error);
        list.innerHTML = '<li>Erro ao carregar registros.</li>';
    });
}

// =========================================================================
//                  FUNÇÕES MODO ADMINISTRADOR (CRUD e Relatórios)
// =========================================================================

/**
 * Carrega todas as turmas para as listas e selects do painel administrativo.
 */
function carregarTurmas() {
    db.collection("turmas").get().then((snapshot) => {
        const listaTurmas = document.getElementById('lista-turmas');
        const selectParticipante = document.getElementById('turma-selecionada-participante');
        const selectRelatorio = document.getElementById('turma-selecionada-relatorio');
        
        listaTurmas.innerHTML = '';
        selectParticipante.innerHTML = '<option value="">Selecione a Turma</option>';
        selectRelatorio.innerHTML = '<option value="">Selecione a Turma</option>';

        snapshot.forEach(doc => {
            const data = doc.data();
            const id = doc.id;
            
            // Lista para edição
            const li = document.createElement('li');
            li.textContent = `${id}: ${data.nome} - Catequista: ${data.catequista} (Chave: ${data.chave_secreta})`;
            li.onclick = () => preencherFormularioTurma(id, data); 
            listaTurmas.appendChild(li);

            // Selects
            const optionP = new Option(data.nome, id);
            const optionR = new Option(data.nome, id);
            selectParticipante.add(optionP);
            selectRelatorio.add(optionR);
        });
    }).catch(error => console.error("Erro ao carregar turmas:", error));
}

/**
 * Preenche o formulário de turma para edição.
 */
function preencherFormularioTurma(id, data) {
    document.getElementById('turma-id').value = id;
    document.getElementById('turma-nome').value = data.nome;
    document.getElementById('turma-catequista').value = data.catequista;
    document.getElementById('turma-chave').value = data.chave_secreta;
}

/**
 * Adiciona ou Altera uma Turma individualmente.
 */
function adicionarTurmaIndividual() {
    const id = document.getElementById('turma-id').value.trim();
    const nome = document.getElementById('turma-nome').value.trim();
    const catequista = document.getElementById('turma-catequista').value.trim();
    const chave_secreta = document.getElementById('turma-chave').value.trim();

    db.collection("turmas").doc(id).set({
        nome: nome,
        catequista: catequista,
        chave_secreta: chave_secreta
    }, { merge: true }) 
    .then(() => {
        alert(`Turma ${id} adicionada/atualizada! Chave: ${chave_secreta}`);
        document.getElementById('form-turma').reset();
        carregarTurmas();
    })
    .catch(error => console.error("Erro ao adicionar/atualizar turma:", error));
}

/**
 * Adiciona ou Altera Turmas em Lote.
 */
function adicionarTurmasEmLote() {
    const loteTexto = document.getElementById('turmas-lote').value.trim();
    if (!loteTexto) return;

    const linhas = loteTexto.split('\n');
    const batch = db.batch();

    linhas.forEach(linha => {
        const partes = linha.split(',').map(s => s.trim());
        if (partes.length === 4) {
            const [id, nome, catequista, chave_secreta] = partes;
            const turmaRef = db.collection("turmas").doc(id);
            batch.set(turmaRef, { nome, catequista, chave_secreta }, { merge: true });
        }
    });

    batch.commit()
        .then(() => {
            alert("Turmas em lote adicionadas/atualizadas!");
            document.getElementById('turmas-lote').value = '';
            carregarTurmas();
        })
        .catch(error => console.error("Erro ao adicionar turmas em lote:", error));
}

/**
 * Adiciona ou Altera um Catequizando individualmente.
 */
function adicionarParticipanteIndividual() {
    const turmaId = document.getElementById('turma-selecionada-participante').value;
    const id = document.getElementById('participante-id').value.trim();
    const nome = document.getElementById('participante-nome').value.trim();

    if (!turmaId || !id || !nome) {
        alert("Preencha todos os campos e selecione a Turma.");
        return;
    }

    db.collection("participantes").doc(id).set({
        nome: nome,
        turma_id: turmaId
    }, { merge: true })
    .then(() => {
        alert(`Catequizando ${nome} adicionado/atualizado na Turma ${turmaId}!`);
        document.getElementById('form-participante').reset();
    })
    .catch(error => console.error("Erro ao adicionar/atualizar catequizando:", error));
}

/**
 * Adiciona ou Altera Catequizandos em Lote.
 */
function adicionarParticipantesEmLote() {
    const turmaId = document.getElementById('turma-selecionada-participante').value;
    const loteTexto = document.getElementById('participantes-lote').value.trim();
    if (!turmaId || !loteTexto) {
        alert("Selecione a turma e forneça os dados em lote.");
        return;
    }

    const linhas = loteTexto.split('\n');
    const batch = db.batch();

    linhas.forEach(linha => {
        const [id, nome] = linha.split(',').map(s => s.trim());
        if (id && nome) {
            const participanteRef = db.collection("participantes").doc(id);
            batch.set(participanteRef, { nome, turma_id: turmaId }, { merge: true });
        }
    });

    batch.commit()
        .then(() => {
            alert("Catequizandos em lote adicionados/atualizados!");
            document.getElementById('participantes-lote').value = '';
        })
        .catch(error => console.error("Erro ao adicionar participantes em lote:", error));
}

/**
 * Gera o relatório de presença para a turma selecionada.
 */
async function gerarRelatorio() {
    const turmaId = document.getElementById('turma-selecionada-relatorio').value;
    const resultadoDiv = document.getElementById('resultado-relatorio');
    resultadoDiv.innerHTML = '<p>Gerando relatório...</p>';

    if (!turmaId) {
        resultadoDiv.innerHTML = 'Selecione uma turma.';
        return;
    }

    try {
        // 1. Obter participantes da turma
        const participantesSnapshot = await db.collection("participantes").where("turma_id", "==", turmaId).get();
        const participantes = {};
        participantesSnapshot.forEach(doc => {
            participantes[doc.id] = { nome: doc.data().nome, presencas: 0, faltas: 0 };
        });

        // 2. Obter todas as presenças de 'encontro' (para calcular total de encontros e presenças)
        const presencasSnapshot = await db.collection("presencas")
            .where("turma_id", "==", turmaId)
            .where("tipo", "==", "encontro") 
            .get();
        
        const datasEncontros = new Set();
        
        presencasSnapshot.forEach(doc => {
            const data = doc.data();
            
            // Conta as presenças
            if (participantes[data.participante_id]) {
                participantes[data.participante_id].presencas++;
            }
            
            // Conta as datas únicas de encontros (Total de Encontros)
            const dataObj = data.data.toDate();
            const dataStr = dataObj.toISOString().split('T')[0];
            datasEncontros.add(dataStr);
        });

        const totalEncontros = datasEncontros.size;
        
        // 3. Montar o relatório
        let relatorioHTML = `<h3>Relatório da Turma ${turmaId}</h3>`;
        relatorioHTML += `<p>Total de Encontros Registrados: <strong>${totalEncontros}</strong></p>`;
        
        relatorioHTML += '<table><thead><tr><th>Nome</th><th>Presenças</th><th>Faltas</th></tr></thead><tbody>';

        for (const id in participantes) {
            const p = participantes[id];
            const faltas = totalEncontros - p.presencas;
            p.faltas = faltas;
            relatorioHTML += `<tr><td>${p.nome}</td><td>${p.presencas}</td><td><strong>${p.faltas}</strong></td></tr>`;
        }
        
        relatorioHTML += '</tbody></table>';
        resultadoDiv.innerHTML = relatorioHTML;

    } catch (error) {
        console.error("Erro ao gerar relatório:", error);
        resultadoDiv.innerHTML = `Erro ao gerar relatório: ${error.message}`;
    }
}
