// ==========================
// script.js - Versão completa (Fly Mídia)
// ==========================

// Inicialização automática
document.addEventListener('DOMContentLoaded', () => {
    console.log("🔥 script.js carregado");
    checkAuthState();
});

// --------------------------
// Utilitários
// --------------------------
function formatarCPF(cpf) {
    cpf = String(cpf || '').replace(/\D/g, "");
    if (cpf.length === 11) return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,"$1.$2.$3-$4");
    return cpf;
}

function formatarData(data) {
    const d = new Date(data);
    if (isNaN(d)) return data;
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function formatarValor(v) {
    const n = parseFloat(v) || 0;
    return new Intl.NumberFormat('pt-BR',{ style:'currency', currency:'BRL' }).format(n);
}

// copia para clipboard
async function copiarParaClipboard(texto) {
    try {
        await navigator.clipboard.writeText(texto);
        alert("Copiado para a área de transferência.");
    } catch (e) {
        prompt("Copie manualmente:", texto);
    }
}

// --------------------------
// Auth / UI Admin
// --------------------------
async function loginAdmin(event) {
    event.preventDefault();
    const email = document.getElementById("emailLogin").value;
    const senha = document.getElementById("senhaLogin").value;
    const err = document.getElementById("loginError");
    try {
        await auth.signInWithEmailAndPassword(email, senha);
        mostrarPainel();
    } catch (e) {
        console.error(e);
        if (err) {
            err.textContent = "Email ou senha incorretos.";
            err.style.display = "block";
        }
    }
}

function logoutAdmin() {
    auth.signOut();
    if (document.getElementById("loginSection")) document.getElementById("loginSection").style.display = "block";
    if (document.getElementById("adminSection")) document.getElementById("adminSection").style.display = "none";
    if (document.getElementById("graficosSection")) document.getElementById("graficosSection").style.display = "none";
    if (document.getElementById("navbar")) document.getElementById("navbar").style.display = "none";
}

function checkAuthState() {
    if (typeof auth === 'undefined') {
        console.warn("Auth não definido — verifique ordem dos scripts.");
        return;
    }
    auth.onAuthStateChanged(user => {
        if (user) mostrarPainel();
        else if (document.getElementById("loginSection")) document.getElementById("loginSection").style.display = "block";
    });
}

function mostrarPainel() {
    if (document.getElementById("loginSection")) document.getElementById("loginSection").style.display = "none";
    if (document.getElementById("adminSection")) document.getElementById("adminSection").style.display = "block";
    if (document.getElementById("graficosSection")) document.getElementById("graficosSection").style.display = "none";
    if (document.getElementById("navbar")) document.getElementById("navbar").style.display = "block";
    carregarTabela();
}

// --------------------------
// CRUD Contratos
// --------------------------
async function salvarContrato(event) {
    event.preventDefault();
    const id = document.getElementById("editId").value || "";

    // coletar itens
    const itens = [];
    const itensEls = document.querySelectorAll('#itensContainer .item');
    let total = 0;
    itensEls.forEach(it => {
        const select = it.querySelector('.tipoItem');
        const qtd = parseInt(it.querySelector('.quantidadeItem').value || 1);
        const nome = select.options[select.selectedIndex].text;
        const preco = parseFloat(select.selectedOptions[0]?.dataset.preco || 0);
        const subtotal = preco * qtd;
        total += subtotal;
        itens.push({ nome, quantidade: qtd, preco, subtotal });
    });

    const desconto = parseFloat(document.getElementById('desconto').value || 0);
    if (desconto > 0) total = total - (total * desconto/100);

    const contrato = {
        nome_empresa: document.getElementById("nomeEmpresa").value,
        cpf_cliente: formatarCPF(document.getElementById("cpfCliente").value),
        telefone: (document.getElementById("telefoneCliente").value || "").replace(/\D/g,''),
        itens_contrato: itens,
        valor_contrato: parseFloat(total.toFixed(2)),
        data_vencimento: document.getElementById("dataVencimento").value,
        cidade: document.getElementById("cidade").value,
        admin_responsavel: document.getElementById("adminResponsavel").value || '',
        status_pagamento: !!document.getElementById("statusPagamento").checked,
        observacoes: document.getElementById("observacoes").value || '',
        atualizado_em: new Date().toISOString()
    };

    try {
        if (id) {
            await db.collection("contratos").doc(id).update(contrato);
            alert("✅ Contrato atualizado.");
        } else {
            await db.collection("contratos").add(contrato);
            alert("✅ Contrato cadastrado.");
        }
        limparFormulario();
        carregarTabela();
    } catch (err) {
        console.error("Erro salvarContrato:", err);
        alert("Erro ao salvar (veja console).");
    }
}

function limparFormulario() {
    const f = document.getElementById("contractForm");
    if (f) f.reset();
    if (document.getElementById("editId")) document.getElementById("editId").value = "";
    const c = document.getElementById('itensContainer');
    if (c) {
        c.innerHTML = `<div class="item">
            <select class="tipoItem" onchange="calcularTotal()" required>
                <option value="">Selecione...</option>
                <option value="banner" data-preco="59.99">Banner (R$59,99)</option>
                <option value="videoGif" data-preco="79.99">Vídeo GIF (R$79,99)</option>
                <option value="videoEmpresarial" data-preco="99.99">Vídeo Empresarial (R$99,99)</option>
            </select>
            <input type="number" class="quantidadeItem" min="1" value="1" onchange="calcularTotal()" style="width:80px; margin-left:8px;">
            <button type="button" class="btn btn-secondary" onclick="removerItem(this)" style="margin-left:8px;">🗑️</button>
        </div>`;
    }
    calcularTotal();
}

async function carregarTabela() {
    const tbody = document.getElementById("contractsTableBody");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center">Carregando...</td></tr>`;

    try {
        const snapshot = await db.collection("contratos").orderBy("data_vencimento","asc").get();
        tbody.innerHTML = "";
        if (snapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align:center">Nenhum contrato cadastrado.</td></tr>`;
        } else {
            snapshot.forEach(doc => {
                const c = doc.data();
                const produtos = (c.itens_contrato || []).map(i => `${i.nome} (x${i.quantidade})`).join(", ");
                const telefoneFmt = c.telefone ? c.telefone : '—';
                const tr = document.createElement('tr');
                const statusHtml = c.status_pagamento ? `<span class="status-pago">Pago</span>` : `<span class="status-pendente">Pendente</span>`;
                tr.innerHTML = `
                    <td>${c.nome_empresa}</td>
                    <td>${c.cpf_cliente || '—'}</td>
                    <td>${telefoneFmt}</td>
                    <td>${produtos || '—'}</td>
                    <td>${formatarValor(c.valor_contrato || 0)}</td>
                    <td>${formatarData(c.data_vencimento || '')}</td>
                    <td>${c.cidade || '—'}</td>
                    <td>${statusHtml}</td>
                    <td>
                        <button class="btn btn-secondary" onclick="editarContrato('${doc.id}')">Editar</button>
                        <button class="btn btn-danger" onclick="excluirContrato('${doc.id}')">Excluir</button>
                        ${!c.status_pagamento ? `<button class="btn btn-success" onclick="marcarPago('${doc.id}')">💰 Marcar como Pago</button>` : ''}
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
        gerarRelatorios();
    } catch (err) {
        console.error("Erro carregarTabela:", err);
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:red;">Erro ao carregar contratos.</td></tr>`;
    }
}

async function marcarPago(id) {
    try {
        await db.collection("contratos").doc(id).update({ status_pagamento: true });
        alert("✅ Contrato marcado como pago.");
        carregarTabela();
    } catch (err) {
        console.error("Erro marcarPago:", err);
        alert("Erro ao marcar como pago.");
    }
}

// --------------------------
// Itens dinâmicos e cálculo
// --------------------------
function adicionarItem() {
    const container = document.getElementById('itensContainer');
    const novo = document.createElement('div');
    novo.classList.add('item');
    novo.style.marginBottom = '6px';
    novo.innerHTML = `
        <select class="tipoItem" onchange="calcularTotal()" required>
            <option value="">Selecione...</option>
            <option value="banner" data-preco="59.99">Banner (R$59,99)</option>
            <option value="videoGif" data-preco="79.99">Vídeo GIF (R$79,99)</option>
            <option value="videoEmpresarial" data-preco="99.99">Vídeo Empresarial (R$99,99)</option>
        </select>
        <input type="number" class="quantidadeItem" min="1" value="1" onchange="calcularTotal()" style="width:80px; margin-left:8px;">
        <button type="button" class="btn btn-secondary" onclick="removerItem(this)" style="margin-left:8px;">🗑️</button>
    `;
    container.appendChild(novo);
    calcularTotal();
}

function removerItem(btn) {
    btn.parentElement.remove();
    calcularTotal();
}

function calcularTotal() {
    let total = 0;
    const itens = document.querySelectorAll('#itensContainer .item');
    itens.forEach(it => {
        const sel = it.querySelector('.tipoItem');
        const qtd = parseInt(it.querySelector('.quantidadeItem').value || 1);
        const preco = parseFloat(sel.selectedOptions[0]?.dataset.preco || 0);
        total += preco * qtd;
    });
    const desconto = parseFloat(document.getElementById('desconto').value || 0);
    if (!isNaN(desconto) && desconto > 0) total = total - (total * desconto / 100);
    if (document.getElementById('valorContrato')) document.getElementById('valorContrato').value = total.toFixed(2);
}

// --------------------------
// CLIENTE - Consultar CPF com botão WhatsApp
// --------------------------
async function consultarCPF() {
    const raw = document.getElementById("cpfInput").value || '';
    const cpf = formatarCPF(raw.trim());
    const err = document.getElementById("errorMessage");
    const loginCard = document.getElementById("loginCard");
    const clientArea = document.getElementById("clientArea");
    const contractsList = document.getElementById("contractsList");

    if (err) err.style.display = "none";
    if (contractsList) contractsList.innerHTML = `<div class="loading">Carregando...</div>`;

    if (!cpf || cpf.replace(/\D/g, '').length < 11) {
        if (err) { err.textContent = "CPF inválido."; err.style.display = 'block'; }
        if (contractsList) contractsList.innerHTML = '';
        return;
    }

    try {
        const snap = await db.collection("contratos").where("cpf_cliente", "==", cpf).get();
        if (snap.empty) {
            if (err) { err.textContent = "Nenhum contrato encontrado."; err.style.display = 'block'; }
            if (contractsList) contractsList.innerHTML = '';
            return;
        }

        if (loginCard) loginCard.style.display = 'none';
        if (clientArea) clientArea.style.display = 'block';
        if (contractsList) contractsList.innerHTML = '';

        snap.forEach(doc => {
            const c = doc.data();
            const dataV = new Date(c.data_vencimento);
            const hoje = new Date();
            const dias = Math.ceil((dataV - hoje) / (1000 * 60 * 60 * 24));
            const status = c.status_pagamento ? 'Pago' : (dias < 0 ? 'Vencido' : 'Pendente');
            const statusClass = c.status_pagamento ? 'status-pago' : (dias < 0 ? 'status-pendente' : 'status-vencer');

            const produtosText = (c.itens_contrato || []).map(i => `${i.nome} (x${i.quantidade})`).join(", ") || '—';
            const msgPix = `Olá, aqui é ${c.nome_empresa}. Quero regularizar a pendência do meu contrato de ${produtosText} no valor de ${formatarValor(c.valor_contrato)}. Poderiam me enviar o PIX?`;

            const card = document.createElement('div');
            card.classList.add('contract-card');
            card.innerHTML = `
                <p><strong>Cliente:</strong> ${c.nome_empresa}</p>
                <p><strong>Produtos:</strong> ${produtosText}</p>
                <p><strong>Valor:</strong> ${formatarValor(c.valor_contrato)}</p>
                <p><strong>Vencimento:</strong> ${formatarData(c.data_vencimento)}</p>
                <p><strong>Status:</strong> <span class="${statusClass}">${status}</span></p>
                ${!c.status_pagamento ? `
                    <button class="btn btn-pix"
                        onclick="abrirWhatsApp('5575998713085','${msgPix.replace(/'/g,"\\'").replace(/\n/g,' ')}')">
                        💰 Fazer pagamento via WhatsApp
                    </button>
                ` : '<p class="status-pago">✅ Pagamento confirmado</p>'}
            `;
            contractsList.appendChild(card);
        });

    } catch (e) {
        console.error("Erro consultarCPF:", e);
        if (err) { err.textContent = "Erro ao consultar."; err.style.display = 'block'; }
        if (contractsList) contractsList.innerHTML = '';
    }
}

// --------------------------
// WhatsApp / Mensagens
// --------------------------
function abrirWhatsApp(telefone, mensagem) {
    const raw = String(telefone || '').replace(/\D/g, '');
    if (!raw) return alert("Telefone não fornecido.");
    const encoded = encodeURIComponent(String(mensagem || ''));
    const url = `https://wa.me/${raw}?text=${encoded}`;
    window.open(url, '_blank');
}

// --------------------------
// Relatórios
// --------------------------
async function gerarRelatorios() {
    try {
        const snapshot = await db.collection("contratos").get();
        const docs = [];
        snapshot.forEach(d => docs.push({ id: d.id, ...d.data() }));

        // clientes por admin
        const byAdmin = {};
        docs.forEach(d => {
            const a = d.admin_responsavel || 'Sem admin';
            byAdmin[a] = (byAdmin[a] || 0) + 1;
        });

        // clientes por cidade
        const byCity = {};
        docs.forEach(d => {
            const city = d.cidade || 'Sem cidade';
            byCity[city] = (byCity[city] || 0) + 1;
        });

        // faturamento por cidade
        const revenueCity = {};
        docs.forEach(d => {
            const city = d.cidade || 'Sem cidade';
            revenueCity[city] = (revenueCity[city] || 0) + (parseFloat(d.valor_contrato)||0);
        });

        // lista de pendentes
        const pendentes = docs.filter(d => !d.status_pagamento);

        return { byAdmin, byCity, revenueCity, pendentes };
    } catch (e) {
        console.error("Erro gerarRelatorios:", e);
    }
}

// --------------------------
// Gráficos (Chart.js)
// --------------------------
function atualizarGrafico(pagos, pendentes, vencidos) {
    const ctx = document.getElementById("contratosChart").getContext("2d");

    if (window.contratosChart && typeof window.contratosChart.destroy === "function") {
        window.contratosChart.destroy();
    }

    window.contratosChart = new Chart(ctx, {
        type: "pie",
        data: {
            labels: ["Pagos", "Pendentes", "Vencidos"],
            datasets: [{
                data: [pagos, pendentes, vencidos],
                backgroundColor: ["#2ecc71", "#f39c12", "#e74c3c"]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: "bottom"
                }
            }
        }
    });
}

function mostrarGraficos() {
    const section = document.getElementById('graficosSection');
    const admin = document.getElementById('adminSection');

    if(admin) admin.style.display = 'none';
    if(section) section.style.display = 'block';

    // só chama depois que o canvas está visível
    carregarGraficos();
}
