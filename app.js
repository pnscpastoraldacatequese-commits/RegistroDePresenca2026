// 1. Substitua estas credenciais pelas suas do projeto "dados-catequese"
const firebaseConfig = {
    apiKey: "AIzaSyDqn5MejlYyNmXK-OZayhOZ5SrzN3YcNCM",
    authDomain: "dados-catequese.firebaseapp.com",
    projectId: "dados-catequese",
    storageBucket: "dados-catequese.firebasestorage.app",
    messagingSenderId: "420948905617",
    appId: "1:420948905617:web:b08e29cf50873ff804f930"
};

// Inicializa o Firebase
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// 2. Lógica para o "Link Próprio para Cada Turma" (Item 2)
// O ID da turma será passado pela URL (ex: index.html?turmaId=A1)
const urlParams = new URLSearchParams(window.location.search);
const turmaId = urlParams.get('turmaId');

if (!turmaId) {
    document.body.innerHTML = "<h1>Erro: ID da turma não especificado na URL.</h1>";
} else {
    document.getElementById('turma-info').innerText = `Turma ID: ${turmaId}`;
    carregarParticipantes(turmaId);
    visualizarPresencas(turmaId);
}

// 3. Funções para Registro e Visualização (Item 3)

// Carrega os participantes para o dropdown
function carregarParticipantes(turmaId) {
    db.collection("participantes").where("turma_id", "==", turmaId).get()
        .then((querySnapshot) => {
            const select = document.getElementById('participante-select');
            querySnapshot.forEach((doc) => {
                const participante = doc.data();
                const option = document.createElement('option');
                option.value = doc.id; // Usar o ID do documento como valor
                option.textContent = participante.nome;
                select.appendChild(option);
            });
        })
        .catch(error => console.error("Erro ao carregar participantes:", error));
}

// Registra a presença (Encontro ou Missa)
function registrarPresenca(tipo) {
    const participanteId = document.getElementById('participante-select').value;
    
    if (!participanteId) {
        alert("Selecione um participante.");
        return;
    }

    db.collection("presencas").add({
        participante_id: participanteId,
        turma_id: turmaId,
        tipo: tipo, // 'encontro' ou 'missa'
        data: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        alert(`Presença (${tipo}) registrada com sucesso!`);
        visualizarPresencas(turmaId); // Atualiza a lista
    })
    .catch(error => console.error("Erro ao registrar presença:", error));
}

// Visualiza os registros de presença
function visualizarPresencas(turmaId) {
    const list = document.getElementById('presencas-list');
    list.innerHTML = ''; // Limpa a lista

    db.collection("presencas").where("turma_id", "==", turmaId).orderBy("data", "desc").limit(10).get()
        .then((querySnapshot) => {
            querySnapshot.forEach((doc) => {
                const registro = doc.data();
                const item = document.createElement('li');
                
                // Busca o nome do participante (Simplificação: em um projeto real, faria um join ou armazenaria o nome)
                db.collection("participantes").doc(registro.participante_id).get().then(pDoc => {
                    const nome = pDoc.data() ? pDoc.data().nome : "Desconhecido";
                    const dataFormatada = registro.data ? new Date(registro.data.toDate()).toLocaleString() : 'N/A';
                    item.textContent = `${dataFormatada} - ${nome} (${registro.tipo})`;
                    list.appendChild(item);
                });
            });
        })
        .catch(error => console.error("Erro ao visualizar presenças:", error));
}