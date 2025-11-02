// Substitua pelas suas credenciais do projeto "dados-catequese"
const firebaseConfig = {
    apiKey: "AIzaSyDqn5MejlYyNmXK-OZayhOZ5SrzN3YcNCM",
    authDomain: "dados-catequese.firebaseapp.com",
    projectId: "dados-catequese", // Certifique-se de que o projectId está correto
    // ... outras configurações
};

const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Inicialização: Carrega turmas para os selects e listas
window.onload = function() {
    carregarTurmas();
    document.getElementById('form-turma').addEventListener('submit', (e) => {
        e.preventDefault();
        adicionarTurmaIndividual();
    });
    document.getElementById('form-participante').addEventListener('submit', (e) => {
        e.preventDefault();
        adicionarParticipanteIndividual();
    });
};

// --- CRUD de Turmas ---

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
            li.textContent = `${id}: ${data.nome} (${data.catequista})`;
            li.style.cursor = 'pointer';
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

// Preenche o formulário para edição
function preencherFormularioTurma(id, data) {
    document.getElementById('turma-id').value = id;
    document.getElementById('turma-nome').value = data.nome;
    document.getElementById('turma-catequista').value = data.catequista;
}

// Adiciona ou Altera uma Turma (Individual)
function adicionarTurmaIndividual() {
    const id = document.getElementById('turma-id').value.trim();
    const nome = document.getElementById('turma-nome').value.trim();
    const catequista = document.getElementById('turma-catequista').value.trim();

    db.collection("turmas").doc(id).set({
        nome: nome,
        catequista: catequista
    }, { merge: true }) // merge: true permite atualizar campos sem sobrescrever o doc inteiro
    .then(() => {
        alert(`Turma ${id} adicionada/atualizada!`);
        document.getElementById('form-turma').reset();
        carregarTurmas(); // Atualiza a lista e selects
    })
    .catch(error => console.error("Erro ao adicionar/atualizar turma:", error));
}

// Adiciona ou Altera Turmas em Lote
function adicionarTurmasEmLote() {
    const loteTexto = document.getElementById('turmas-lote').value.trim();
    if (!loteTexto) return;

    const linhas = loteTexto.split('\n');
    const batch = db.batch(); // Operação em lote

    linhas.forEach(linha => {
        const [id, nome, catequista] = linha.split(',').map(s => s.trim());
        if (id && nome && catequista) {
            const turmaRef = db.collection("turmas").doc(id);
            batch.set(turmaRef, { nome, catequista }, { merge: true });
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

// --- CRUD de Participantes ---

// Adiciona ou Altera um Catequizando (Individual)
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

// Adiciona ou Altera Catequizandos em Lote
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

// --- Relatórios ---

async function gerarRelatorio() {
    const turmaId = document.getElementById('turma-selecionada-relatorio').value;
    const resultadoDiv = document.getElementById('resultado-relatorio');
    resultadoDiv.innerHTML = 'Gerando relatório...';

    if (!turmaId) {
        resultadoDiv.innerHTML = 'Selecione uma turma.';
        return;
    }

    try {
        // 1. Obter todos os participantes da turma
        const participantesSnapshot = await db.collection("participantes").where("turma_id", "==", turmaId).get();
        const participantes = {};
        participantesSnapshot.forEach(doc => {
            participantes[doc.id] = { nome: doc.data().nome, presencas: 0 };
        });

        // 2. Obter todas as presenças de 'encontro' (para calcular total de encontros e presenças)
        const presencasSnapshot = await db.collection("presencas")
            .where("turma_id", "==", turmaId)
            .where("tipo", "==", "encontro") // Considera apenas encontros
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
            // Simplificação: usa a data (AAAA-MM-DD) para unicidade
            const dataStr = dataObj.toISOString().split('T')[0];
            datasEncontros.add(dataStr);
        });

        const totalEncontros = datasEncontros.size;
        
        // 3. Montar o relatório
        let relatorioHTML = `<h3>Relatório da Turma ${turmaId}</h3>`;
        relatorioHTML += `<p>Total de Encontros Registrados: **${totalEncontros}**</p>`;
        relatorioHTML += '<table border="1" style="width:100%; text-align:left;"><thead><tr><th>Nome</th><th>Presenças</th><th>Faltas</th></tr></thead><tbody>';

        for (const id in participantes) {
            const p = participantes[id];
            const faltas = totalEncontros - p.presencas;
            relatorioHTML += `<tr><td>${p.nome}</td><td>${p.presencas}</td><td>**${faltas}**</td></tr>`;
        }
        
        relatorioHTML += '</tbody></table>';
        resultadoDiv.innerHTML = relatorioHTML;

    } catch (error) {
        console.error("Erro ao gerar relatório:", error);
        resultadoDiv.innerHTML = `Erro: ${error.message}`;
    }
}