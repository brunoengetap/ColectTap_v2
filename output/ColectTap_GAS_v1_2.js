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
const APP_VERSION    = 'ColectTap-GAS-v1.2';

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
      case 'gerarConsultaCliente': result = gerarConsultaCliente();              break;
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
    id_visita_colect,
    equipamentos
  } = params;

  if (!equipamentos || !equipamentos.length) {
    return { status:'erro', mensagem:'Nenhum equipamento enviado' };
  }

  const aba = getOuCriarAba(ABA_EQUIP);
  garantirColunas(aba, [
    'id_visita_colect','id_equipamento_colect','status_completude','sync_status','pendencias_json',
    'status_documentacao','documentos_presentes','documentos_ausentes','documentos_a_receber',
    'enquadra_nr13','base_enquadramento','motivo_nao_enquadramento','acao_nao_enquadramento',
    'situacao_nr13','setor','descricao_equipamento','drive_folder_id','drive_folder_url',
    'primeira_foto_url','quantidade_fotos','fotos_json','data_criacao','data_atualizacao'
  ]);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    if (aba.getLastRow() === 0) {
      aba.appendRow(getCabecalhoEquip());
    }

    const resultados = [];

    equipamentos.forEach(eq => {
      const fotos = Array.isArray(eq.fotos) ? eq.fotos : [];
      const equipId = String(eq.id_equipamento_colect || ('EQ-' + Utilities.getUuid())).trim();
      const visitaId = String(eq.id_visita_colect || id_visita_colect || '').trim();

      const fotosInfo = salvarFotosDrive(visitaId, equipId, eq.tag || equipId, fotos);

      const contextoVisita = {
        id_os, numero_os, id_cliente, cliente,
        id_inspetor, inspetor, app_version, data_coleta,
        id_visita_colect: visitaId
      };

      const up = upsertEquipamentoNR13(
        Object.assign({}, eq, { id_equipamento_colect: equipId, id_visita_colect: visitaId }),
        contextoVisita,
        fotosInfo
      );
      resultados.push(up);
    });

    const id_lev = 'LNR-' + Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyyMMdd-HHmmss');
    return { status:'ok', id: id_lev, registros: resultados.length, resultados: resultados };

  } finally {
    lock.releaseLock();
  }
}

// === INSERIR APÓS função salvarLevantamentoNR13 ===
function upsertEquipamentoNR13(eq, contextoVisita, fotosInfo) {
  const aba = getOuCriarAba(ABA_EQUIP);
  const dados = aba.getDataRange().getValues();
  if (!dados.length) {
    aba.appendRow(getCabecalhoEquip());
  }

  const header = aba.getDataRange().getValues()[0] || [];
  const idxByName = {};
  header.forEach((h, i) => { idxByName[String(h)] = i; });

  const idEquip = String(eq.id_equipamento_colect || '').trim();
  if (!idEquip) throw new Error('id_equipamento_colect é obrigatório');

  const nowIso = new Date().toISOString();
  let rowIndex = -1;
  if (idxByName.id_equipamento_colect >= 0) {
    for (let i = 1; i < dados.length; i++) {
      if (String(dados[i][idxByName.id_equipamento_colect] || '').trim() === idEquip) {
        rowIndex = i + 1;
        break;
      }
    }
  }

  const rowData = new Array(header.length).fill('');
  if (rowIndex > 0) {
    const existente = aba.getRange(rowIndex, 1, 1, header.length).getValues()[0];
    for (let i = 0; i < header.length; i++) rowData[i] = existente[i];
  }

  const campos = {
    id_os: contextoVisita.id_os || '', numero_os: contextoVisita.numero_os || '',
    id_cliente: contextoVisita.id_cliente || '', cliente: contextoVisita.cliente || '',
    id_inspetor: contextoVisita.id_inspetor || '', inspetor: contextoVisita.inspetor || '',
    data_coleta: contextoVisita.data_coleta || '', data_registro: nowIso,
    app_version: contextoVisita.app_version || '',

    tag: eq.tag || '', tipo: eq.tipo || '', fabricante: eq.fabricante || '', numero_equip: eq.numero_equip || '',
    ano_fabricacao: eq.ano_fabricacao || '', categoria: eq.categoria || '', codigo_projeto: eq.codigo_projeto || '',
    localizacao: eq.localizacao || '', placa_indelevel: eq.placa_indelevel || '', necessita_tag: eq.necessita_tag || '',
    obs_ident: eq.obs_ident || '',

    pmta: eq.pmta || '', pressao_trabalho: eq.pressao_trabalho || '', pressao_teste: eq.pressao_teste || '',
    temperatura: eq.temperatura || '',
    fluido: eq.fluido === 'Outro' ? (eq.fluido_outro || '') : (eq.fluido || ''),
    classe_fluido: eq.classe_fluido || '', ja_inspecionado: eq.ja_inspecionado || '',
    ano_ultima_inspecao: eq.ano_ultima_inspecao || '', tipo_ultima_inspecao: eq.tipo_ultima_inspecao || '',

    diametro: eq.diametro || '', comprimento: eq.comprimento || eq.comprimento_m || '', altura: eq.altura || '',
    volume: eq.volume || '', espessura_parede: eq.espessura_parede || '', material: eq.material || eq.material_casco || '',
    bitola: eq.bitola === 'Outro' ? (eq.bitola_outro || '') : (eq.bitola || ''),
    classe_pressao: eq.classe_pressao || '', isolamento: eq.isolamento || '',
    capacidade_vapor: eq.capacidade_vapor || '', area_aquecimento: eq.area_aquecimento || '',
    combustivel: eq.combustivel || '', pressao_projeto: eq.pressao_projeto || '',
    teto: eq.teto || '', revestimento: eq.revestimento || '',

    possui_manometro: eq.possui_manometro || '', manometro_calibrado: eq.manometro_calibrado || '',
    cert_manometro: eq.cert_manometro || '', venc_manometro: eq.venc_manometro || '',
    possui_valvula: eq.possui_valvula || '', valvula_calibrada: eq.valvula_calibrada || '',
    cert_valvula: eq.cert_valvula || '', venc_valvula: eq.venc_valvula || '', pa_valvula: eq.pa_valvula || '',
    possui_purgador: eq.possui_purgador || '', possui_dcbi: eq.possui_dcbi || '',
    possui_valvula_retencao: eq.possui_valvula_retencao || '',
    possui_indicador_nivel: eq.possui_indicador_nivel || '', possui_pressostato: eq.possui_pressostato || '',

    documentos_presentes: serializarChecks(eq._checks || {}, 'doc'),
    trabalho_altura: eq.trabalho_altura || '', necessita_th: eq.necessita_th || '',
    espaco_confinado: eq.espaco_confinado || '', necessita_scaffold: eq.necessita_scaffold || '',
    ensaios_nd_necessarios: serializarChecks(eq._checks || {}, 'end'), processo: eq.processo || '',
    risco_observado: eq.risco_observado || '', obs_gerais: eq.obs_gerais || '', obs_inspetor: eq.obs_inspetor || '',

    id_visita_colect: eq.id_visita_colect || contextoVisita.id_visita_colect || '',
    id_equipamento_colect: idEquip,
    status_completude: eq.status_completude || '', sync_status: eq.sync_status || '',
    pendencias_json: eq.pendencias_json ? JSON.stringify(eq.pendencias_json) : '',
    status_documentacao: eq.status_documentacao || '',
    documentos_ausentes: eq.documentos_ausentes || '', documentos_a_receber: eq.documentos_a_receber || '',
    enquadra_nr13: eq.enquadra_nr13 || '', base_enquadramento: eq.base_enquadramento || '',
    motivo_nao_enquadramento: eq.motivo_nao_enquadramento || '', acao_nao_enquadramento: eq.acao_nao_enquadramento || '',
    situacao_nr13: eq.situacao_nr13 || '', setor: eq.setor || '', descricao_equipamento: eq.descricao_equipamento || '',
    drive_folder_id: (fotosInfo && fotosInfo.drive_folder_id) || '', drive_folder_url: (fotosInfo && fotosInfo.drive_folder_url) || '',
    primeira_foto_url: (fotosInfo && fotosInfo.fotos_salvas && fotosInfo.fotos_salvas[0] && fotosInfo.fotos_salvas[0].file_url) || '',
    quantidade_fotos: (fotosInfo && fotosInfo.fotos_salvas && fotosInfo.fotos_salvas.length) || 0,
    fotos_json: (fotosInfo && fotosInfo.fotos_salvas) ? JSON.stringify(fotosInfo.fotos_salvas) : '',
    data_atualizacao: nowIso
  };

  if (rowIndex < 0) campos.data_criacao = nowIso;

  Object.keys(campos).forEach(k => {
    if (idxByName[k] >= 0) rowData[idxByName[k]] = campos[k];
  });

  if (rowIndex > 0) {
    if (idxByName.data_criacao >= 0 && !rowData[idxByName.data_criacao]) rowData[idxByName.data_criacao] = nowIso;
    aba.getRange(rowIndex, 1, 1, header.length).setValues([rowData]);
    return { acao:'updated', id_equipamento_colect:idEquip, linha:rowIndex };
  }

  aba.appendRow(rowData);
  return { acao:'inserted', id_equipamento_colect:idEquip, linha:aba.getLastRow() };
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
// === INSERIR APÓS função getEquipamentos ===
function garantirColunas(aba, colunasNecessarias) {
  const ultimaColuna = Math.max(1, aba.getLastColumn());
  const headerRange = aba.getRange(1, 1, 1, ultimaColuna);
  const header = headerRange.getValues()[0].map(h => String(h).trim());
  const existentes = {};
  header.forEach(h => { if (h) existentes[h] = true; });

  const novas = [];
  (colunasNecessarias || []).forEach(c => {
    if (!existentes[c]) {
      novas.push(c);
      existentes[c] = true;
    }
  });

  if (novas.length) {
    aba.getRange(1, header.length + 1, 1, novas.length).setValues([novas]);
  }
}

// === INSERIR APÓS função garantirColunas ===
function salvarFotosDrive(idVisita, idEquip, tag, fotos) {
  const resp = { drive_folder_id:'', drive_folder_url:'', fotos_salvas:[] };
  if (!Array.isArray(fotos) || !fotos.length) return resp;

  const rootName = 'PGP_Fotos';
  const ym = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM');
  const safeVisita = String(idVisita || 'SEM_VISITA').replace(/[\/:*?"<>|]/g, '-');
  const safeTag = String(tag || idEquip || 'SEM_TAG').replace(/\s+/g, '_').replace(/[\/:*?"<>|]/g, '-');

  const getOrCreate = (parent, name) => {
    const it = parent.getFoldersByName(name);
    return it.hasNext() ? it.next() : parent.createFolder(name);
  };

  const root = getOrCreate(DriveApp.getRootFolder(), rootName);
  const mes = getOrCreate(root, ym);
  const visita = getOrCreate(mes, '[' + safeVisita + ']');

  resp.drive_folder_id = visita.getId();
  resp.drive_folder_url = visita.getUrl();

  fotos.forEach(f => {
    try {
      const key = String(f.key || 'foto');
      const secao = String(f.secao || 'geral');
      const dataUrl = String(f.dataUrl || '');
      if (!dataUrl) throw new Error('Foto sem dataUrl');

      const b64 = dataUrl.split(',').pop();
      const bytes = Utilities.base64Decode(b64);
      const nome = [safeTag, secao, key].join('_') + '.jpg';
      const blob = Utilities.newBlob(bytes, 'image/jpeg', nome);
      const arq = visita.createFile(blob);
      resp.fotos_salvas.push({ key:key, file_id:arq.getId(), file_url:arq.getUrl() });
    } catch (err) {
      logErro('salvarFotosDrive', err.message, JSON.stringify({ idVisita:idVisita, idEquip:idEquip, key:f && f.key }));
    }
  });

  return resp;
}

// === INSERIR APÓS função salvarFotosDrive ===
function gerarConsultaCliente() {
  const origem = getOuCriarAba(ABA_EQUIP);
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let destino = ss.getSheetByName('CONSULTA_CLIENTE');
  if (!destino) destino = ss.insertSheet('CONSULTA_CLIENTE');

  const headers = [
    'Cliente','OS','TAG','Tipo','Fabricante','Ano Fabricação','Local','Setor',
    'Enquadra NR13','Situação NR13','Categoria','Fluido','Classe Fluido','Volume',
    'PMTA','Última Inspeção','Próxima Insp. Externa','Próxima Insp. Interna',
    'Vencimento Manômetro','Vencimento PSV','Situação Documental',
    'Documentos Pendentes','Pendências de Campo','Observações','Link Fotos'
  ];

  const values = origem.getDataRange().getValues();
  const srcH = values.length ? values[0].map(h => String(h)) : [];
  const idx = n => srcH.indexOf(n);
  const get = (r, n) => (idx(n) >= 0 ? r[idx(n)] : '');

  const linhas = values.slice(1).map(r => [
    get(r,'cliente'), get(r,'numero_os'), get(r,'tag'), get(r,'tipo'), get(r,'fabricante'),
    get(r,'ano_fabricacao'), get(r,'localizacao'), get(r,'setor'), get(r,'enquadra_nr13'),
    get(r,'situacao_nr13'), get(r,'categoria'), get(r,'fluido'), get(r,'classe_fluido'),
    get(r,'volume'), get(r,'pmta'), get(r,'ano_ultima_inspecao'), get(r,'proxima_insp_externa'),
    get(r,'proxima_insp_interna'), get(r,'venc_manometro'), get(r,'venc_valvula'),
    get(r,'status_documentacao'), get(r,'documentos_ausentes'), get(r,'pendencias_json'),
    [get(r,'obs_gerais'), get(r,'obs_inspetor')].filter(Boolean).join(' | '), get(r,'drive_folder_url')
  ]);

  destino.clearContents();
  destino.getRange(1,1,1,headers.length).setValues([headers]);
  if (linhas.length) destino.getRange(2,1,linhas.length,headers.length).setValues(linhas);

  const cab = destino.getRange(1,1,1,headers.length);
  cab.setBackground('#1a3a6b').setFontColor('#ffffff').setFontWeight('bold');
  destino.setFrozenRows(1);
  if (destino.getFilter()) destino.getFilter().remove();
  destino.getRange(1,1,Math.max(1,linhas.length+1),headers.length).createFilter();

  return { status:'ok', registros:linhas.length, aba:'CONSULTA_CLIENTE' };
}

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
