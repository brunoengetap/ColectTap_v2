// ════════════════════════════════════════════════════════════════════════
// ColectTap GAS — Google Apps Script Dedicado
// Sistema de Levantamento NR-13 · Engetap Engenharia Ltda
// Versão: v1.0 — Maio/2026
//
// INSTRUÇÕES DE DEPLOY:
//   1. Abra script.google.com → Novo projeto → nomeie "ColectTap GAS"
//   2. Cole este código inteiro no editor
//   3. Edite a constante SPREADSHEET_ID abaixo com o ID da planilha criada
//   4. Clique em Implantar → Nova implantação → Tipo: App da Web
//      Executar como: Eu mesmo | Acesso: Qualquer pessoa
//   5. Copie a URL gerada e cole em ColectTap_v1_0.html na variável GAS_URL
//   6. Em Implantar → Gerenciar implantações → ao atualizar o código,
//      sempre crie Nova Versão para que o HTML receba as alterações
//
// ABAS DA PLANILHA (criadas automaticamente na primeira execução):
//   INSPETORES         — Controle de PINs e usuários
//   OS_COLECT          — Ordens de Serviço disponíveis para coleta
//   EQUIPAMENTOS_NR13  — Um registro por equipamento coletado
//   LOG                — Registro de erros e eventos
// ════════════════════════════════════════════════════════════════════════

// ── CONFIGURAÇÃO ──────────────────────────────────────────────────────────
const SPREADSHEET_ID = 'COLE_AQUI_ID_DA_PLANILHA';
const APP_VERSION    = 'ColectTap-GAS-v1.0';

// ── CONSTANTES DE ABAS ────────────────────────────────────────────────────
const ABA_INSPETORES  = 'INSPETORES';
const ABA_OS          = 'OS_COLECT';
const ABA_EQUIP       = 'EQUIPAMENTOS_NR13';
const ABA_LOG         = 'LOG';

// ── CORS / ENTRY POINT ────────────────────────────────────────────────────
function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    let action, params;

    if (e.postData && e.postData.contents) {
      // POST
      const body = JSON.parse(e.postData.contents);
      action = body.action || (e.parameter && e.parameter.action) || '';
      params = body;
    } else {
      // GET
      action = (e.parameter && e.parameter.action) || '';
      params = e.parameter || {};
    }

    let result;
    switch (action) {
      case 'healthCheck':          result = healthCheck();                      break;
      case 'validarPIN':           result = validarPIN(params);                 break;
      case 'getOSColect':          result = getOSColect(params);                break;
      case 'salvarLevantamentoNR13': result = salvarLevantamentoNR13(params);   break;
      case 'getEquipamentos':      result = getEquipamentos(params);            break;
      default:
        result = { status:'erro', mensagem:'Ação desconhecida: ' + action };
    }

    output.setContent(JSON.stringify(result));
  } catch (err) {
    logErro('handleRequest', err.message, JSON.stringify(e.parameter || {}));
    output.setContent(JSON.stringify({ status:'erro', mensagem: err.message }));
  }

  return output;
}

// ════════════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ════════════════════════════════════════════════════════════════════════
function healthCheck() {
  garantirAbas(); // cria abas se não existirem
  return { status:'ok', version: APP_VERSION, ts: new Date().toISOString() };
}

// ════════════════════════════════════════════════════════════════════════
// VALIDAR PIN
// ════════════════════════════════════════════════════════════════════════
function validarPIN(params) {
  const pin = String(params.pin || '').trim();
  if (!pin || pin.length !== 4) return { valido:false, mensagem:'PIN inválido' };

  const aba = getOuCriarAba(ABA_INSPETORES);
  const dados = aba.getDataRange().getValues();
  // Cabeçalho esperado: id_inspetor | nome | pin | ativo
  for (let i = 1; i < dados.length; i++) {
    const [id, nome, pinSalvo, ativo] = dados[i];
    if (String(pinSalvo).trim() === pin && String(ativo).trim().toLowerCase() !== 'false') {
      return { valido:true, id_inspetor: String(id), nome: String(nome) };
    }
  }
  return { valido:false, mensagem:'PIN não encontrado' };
}

// ════════════════════════════════════════════════════════════════════════
// LISTAR OS PARA COLECT
// ════════════════════════════════════════════════════════════════════════
function getOSColect(params) {
  const id_inspetor = params.id_inspetor || '';
  const aba = getOuCriarAba(ABA_OS);
  const dados = aba.getDataRange().getValues();
  // Cabeçalho: id_os | numero_os | id_cliente | cliente | descricao | data_abertura | status | id_inspetor_resp
  const os = [];
  for (let i = 1; i < dados.length; i++) {
    const [id_os, numero_os, id_cliente, cliente, descricao, data_abertura, status, resp] = dados[i];
    if (!id_os) continue;
    if (String(status).toLowerCase() !== 'ativa') continue;
    // Se resp não estiver preenchido, mostra para todos; se estiver, filtra pelo inspetor
    if (resp && String(resp).trim() && String(resp).trim() !== id_inspetor) continue;
    os.push({
      id_os: String(id_os),
      numero_os: String(numero_os),
      id_cliente: String(id_cliente),
      cliente: String(cliente),
      descricao: String(descricao),
      data_abertura: formatarData(data_abertura),
      status: String(status),
    });
  }
  return { status:'ok', os };
}

// ════════════════════════════════════════════════════════════════════════
// SALVAR LEVANTAMENTO NR-13
// Um registro por equipamento coletado
// ════════════════════════════════════════════════════════════════════════
function salvarLevantamentoNR13(params) {
  const {
    id_os, numero_os, id_cliente, cliente,
    id_inspetor, inspetor, app_version, data_coleta,
    equipamentos
  } = params;

  if (!equipamentos || !equipamentos.length) {
    return { status:'erro', mensagem:'Nenhum equipamento enviado' };
  }

  const aba = getOuCriarAba(ABA_EQUIP);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const linhas = equipamentos.map(eq => [
      // Identificação da OS
      id_os, numero_os, id_cliente, cliente,
      id_inspetor, inspetor,
      data_coleta, new Date().toISOString(), app_version,

      // A — Identificação
      eq.tag || '', eq.tipo || '', eq.fabricante || '', eq.numero_equip || '',
      eq.ano_fabricacao || '', eq.categoria || '', eq.codigo_projeto || '',
      eq.localizacao || '', eq.placa_indelevel || '', eq.necessita_tag || '',
      eq.obs_ident || '',

      // B — Projeto
      eq.pmta || '', eq.pressao_trabalho || '', eq.pressao_teste || '',
      eq.temperatura || '', eq.fluido === 'Outro' ? (eq.fluido_outro||'') : (eq.fluido||''),
      eq.classe_fluido || '', eq.ja_inspecionado || '',
      eq.ano_ultima_inspecao || '', eq.tipo_ultima_inspecao || '',

      // C — Dimensões (genérico — campos variam por tipo)
      eq.diametro || '', eq.comprimento || eq.comprimento_m || '',
      eq.altura || '', eq.volume || '', eq.espessura_parede || '',
      eq.material || eq.material_casco || '',
      // Tubulação específico
      eq.bitola === 'Outro' ? (eq.bitola_outro||'') : (eq.bitola||''),
      eq.classe_pressao || '', eq.isolamento || '',
      // Caldeira específico
      eq.capacidade_vapor || '', eq.area_aquecimento || '',
      eq.combustivel || '', eq.pressao_projeto || '',
      // Tanque específico
      eq.teto || '', eq.revestimento || '',

      // D — Dispositivos de Segurança
      eq.possui_manometro || '', eq.manometro_calibrado || '',
      eq.cert_manometro || '', eq.venc_manometro || '',
      eq.possui_valvula || '', eq.valvula_calibrada || '',
      eq.cert_valvula || '', eq.venc_valvula || '', eq.pa_valvula || '',
      eq.possui_purgador || '', eq.possui_dcbi || '',
      eq.possui_valvula_retencao || '',
      eq.possui_indicador_nivel || '', eq.possui_pressostato || '',

      // E — Documentação (lista de checkboxes marcados)
      serializarChecks(eq._checks || {}, 'doc'),

      // F — Condições de Serviço
      eq.trabalho_altura || '', eq.necessita_th || '',
      eq.espaco_confinado || '', eq.necessita_scaffold || '',
      serializarChecks(eq._checks || {}, 'end'),
      eq.processo || '', eq.risco_observado || '',

      // G — Observações
      eq.obs_gerais || '', eq.obs_inspetor || '',
    ]);

    // Verifica se cabeçalho existe
    const existentes = aba.getLastRow();
    if (existentes === 0) {
      aba.appendRow(getCabecalhoEquip());
    }

    linhas.forEach(linha => aba.appendRow(linha));

    const id_lev = 'LNR-' + Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyyMMdd-HHmmss');
    return { status:'ok', id: id_lev, registros: linhas.length };

  } finally {
    lock.releaseLock();
  }
}

// ════════════════════════════════════════════════════════════════════════
// GET EQUIPAMENTOS (para consulta futura)
// ════════════════════════════════════════════════════════════════════════
function getEquipamentos(params) {
  const id_os = params.id_os || '';
  const aba = getOuCriarAba(ABA_EQUIP);
  const dados = aba.getDataRange().getValues();
  if (dados.length < 2) return { status:'ok', equipamentos:[] };

  const header = dados[0];
  const idxOS = header.indexOf('id_os');
  if (idxOS < 0) return { status:'ok', equipamentos:[] };

  const equips = dados.slice(1)
    .filter(row => !id_os || String(row[idxOS]) === id_os)
    .map(row => {
      const obj = {};
      header.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });

  return { status:'ok', equipamentos: equips };
}

// ════════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════════
function serializarChecks(checks, prefixo) {
  return Object.entries(checks)
    .filter(([k, v]) => v && k.startsWith(prefixo))
    .map(([k]) => k.replace(prefixo+'_','').replace(/_/g,' '))
    .join(' | ');
}

function formatarData(d) {
  if (!d) return '';
  if (d instanceof Date) return Utilities.formatDate(d, 'America/Sao_Paulo', 'dd/MM/yyyy');
  return String(d);
}

function getCabecalhoEquip() {
  return [
    // OS
    'id_os','numero_os','id_cliente','cliente','id_inspetor','inspetor',
    'data_coleta','data_registro','app_version',
    // A
    'tag','tipo','fabricante','numero_equip','ano_fabricacao','categoria',
    'codigo_projeto','localizacao','placa_indelevel','necessita_tag','obs_ident',
    // B
    'pmta','pressao_trabalho','pressao_teste','temperatura','fluido',
    'classe_fluido','ja_inspecionado','ano_ultima_inspecao','tipo_ultima_inspecao',
    // C
    'diametro','comprimento','altura','volume','espessura_parede','material',
    'bitola','classe_pressao','isolamento',
    'capacidade_vapor','area_aquecimento','combustivel','pressao_projeto',
    'teto','revestimento',
    // D
    'possui_manometro','manometro_calibrado','cert_manometro','venc_manometro',
    'possui_valvula','valvula_calibrada','cert_valvula','venc_valvula','pa_valvula',
    'possui_purgador','possui_dcbi','possui_valvula_retencao',
    'possui_indicador_nivel','possui_pressostato',
    // E
    'documentos_presentes',
    // F
    'trabalho_altura','necessita_th','espaco_confinado','necessita_scaffold',
    'ensaios_nd_necessarios','processo','risco_observado',
    // G
    'obs_gerais','obs_inspetor',
  ];
}

// ════════════════════════════════════════════════════════════════════════
// ESTRUTURA DAS ABAS — CRIAÇÃO AUTOMÁTICA
// ════════════════════════════════════════════════════════════════════════
function garantirAbas() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // INSPETORES
  let aba = ss.getSheetByName(ABA_INSPETORES);
  if (!aba) {
    aba = ss.insertSheet(ABA_INSPETORES);
    aba.appendRow(['id_inspetor','nome','pin','ativo','email','cargo']);
    aba.appendRow(['INS-001','Inspetor Demo','1234','true','demo@engetap.com.br','Inspetor NR-13']);
    aba.appendRow(['INS-002','Fernando Guimarães','5678','true','fernando@engetap.com.br','Eng. Inspeção']);
    formatarCabecalho(aba);
  }

  // OS_COLECT
  aba = ss.getSheetByName(ABA_OS);
  if (!aba) {
    aba = ss.insertSheet(ABA_OS);
    aba.appendRow(['id_os','numero_os','id_cliente','cliente','descricao','data_abertura','status','id_inspetor_resp']);
    aba.appendRow(['LNR-2026-001','LNR-001','CLI-ING','Inglesa — Mineração','Levantamento NR-13 completo','2026-05-13','ativa','']);
    aba.appendRow(['LNR-2026-002','LNR-002','CLI-FAR','Farmax Farmacêutica','Inspeção inicial NR-13','2026-05-10','ativa','']);
    formatarCabecalho(aba);
  }

  // EQUIPAMENTOS_NR13
  aba = ss.getSheetByName(ABA_EQUIP);
  if (!aba) {
    aba = ss.insertSheet(ABA_EQUIP);
    aba.appendRow(getCabecalhoEquip());
    formatarCabecalho(aba);
  }

  // LOG
  aba = ss.getSheetByName(ABA_LOG);
  if (!aba) {
    aba = ss.insertSheet(ABA_LOG);
    aba.appendRow(['timestamp','funcao','erro','contexto']);
    formatarCabecalho(aba);
  }
}

function formatarCabecalho(aba) {
  try {
    const cabecalho = aba.getRange(1, 1, 1, aba.getLastColumn());
    cabecalho.setBackground('#1a3a6b');
    cabecalho.setFontColor('#ffffff');
    cabecalho.setFontWeight('bold');
    cabecalho.setFontSize(9);
    aba.setFrozenRows(1);
  } catch(e) { /* ignora se falhar */ }
}

function getOuCriarAba(nome) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let aba = ss.getSheetByName(nome);
  if (!aba) {
    garantirAbas();
    aba = ss.getSheetByName(nome);
  }
  return aba;
}

// ════════════════════════════════════════════════════════════════════════
// LOG DE ERROS
// ════════════════════════════════════════════════════════════════════════
function logErro(funcao, erro, contexto) {
  try {
    const aba = getOuCriarAba(ABA_LOG);
    aba.appendRow([new Date().toISOString(), funcao, erro, contexto || '']);
  } catch(e) { /* silencia erro no log */ }
}

// ════════════════════════════════════════════════════════════════════════
// FUNÇÃO UTILITÁRIA — executar manualmente para inicializar a planilha
// Vá em: Executar → Executar função → inicializarPlanilha
// ════════════════════════════════════════════════════════════════════════
function inicializarPlanilha() {
  garantirAbas();
  SpreadsheetApp.getUi().alert('✅ Planilha ColectTap inicializada com sucesso!\n\nAbas criadas:\n• INSPETORES\n• OS_COLECT\n• EQUIPAMENTOS_NR13\n• LOG\n\nEdite as abas para adicionar seus inspetores e OS reais.');
}
