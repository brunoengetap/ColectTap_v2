PROMPT CODEX — ColectTap v1.3 · GAS v1.2 · Manager v1.0
Implementação cirúrgica com emenda de correções complementares
---
PASSO 0 — LEITURA OBRIGATÓRIA ANTES DE QUALQUER ALTERAÇÃO
Antes de escrever uma linha de código, leia integralmente:
`output/ColectTap_v1_2.html` — app field atual (1994 linhas)
`output/ColectTap_GAS_v1_1.js` — GAS atual (563 linhas)
`prompts/bloco_A_GAS.md`
`prompts/bloco_B_HTML_autosave.md`
`prompts/bloco_C_HTML_fotos_nr13.md`
`docs/SPEC_v1_2.md`
Só após leitura completa, iniciar as alterações.
---
ESTRUTURA DO REPOSITÓRIO — RESPEITAR OBRIGATORIAMENTE
```
ColectTap_v2/
├── src/          ← versões anteriores/base (não alterar)
│   ├── ColectTap_v1_1.html
│   └── ColectTap_GAS_v1_0.js
├── output/       ← versões entregáveis (trabalhar aqui)
│   ├── ColectTap_v1_2.html      ← input
│   ├── ColectTap_GAS_v1_1.js    ← input
│   ├── ColectTap_v1_3.html      ← output a criar
│   ├── ColectTap_GAS_v1_2.js    ← output a criar
│   └── ColectTap_Manager_v1_0.html ← output a criar
├── prompts/      ← blocos auxiliares (só leitura)
├── docs/         ← especificações (só leitura)
├── Agents.md
└── README.md
```
NÃO criar arquivos soltos na raiz nem em pastas erradas.
Todos os outputs vão em `output/`.
---
PRIORIDADE DE ENTREGA
`output/ColectTap_v1_3.html` — PRIORIDADE MÁXIMA
`output/ColectTap_GAS_v1_2.js` — PRIORIDADE ALTA
`output/ColectTap_Manager_v1_0.html` — PRIORIDADE NORMAL
Se houver risco de quebrar Field ou GAS ao implementar Manager, entregar os dois primeiros primeiro.
---
VERSIONAMENTO
No HTML:
```javascript
const APP_VERSION = 'ColectTap-v1.3';
```
No GAS:
```javascript
const APP_VERSION = 'ColectTap-GAS-v1.2';
```
---
PARTE 1 — BUGS CRÍTICOS CONFIRMADOS (corrigir primeiro)
BUG 1 — `preparePhoto` nunca chama `fi.click()` [BLOQUEANTE]
Localização: `ColectTap_v1_2.html` linha ~1264
Problema: A função configura o `onchange` mas nunca abre a câmera/galeria.
Causa secundária: `_photoTarget` é salvo como string simples, não como objeto.
Substituir integralmente:
```javascript
let _photoTarget = null;

function preparePhoto(key, secao, campo_ref, origem) {
  const fi = document.getElementById(
    origem === 'camera' ? 'fileInputCamera' : 'fileInputGallery'
  );
  if (!fi) { showToast('Input de foto não encontrado', 'err'); return; }
  _photoTarget = { key, secao, campo_ref, origem };
  fi.value = '';
  fi.onchange = handlePhotoSelected;
  fi.click(); // ← LINHA QUE FALTAVA — deve estar no mesmo callstack do evento de click
}

function handlePhotoSelected(event) {
  const file = (event.target.files || [])[0];
  if (!file || !_photoTarget) return;
  const { key, secao, campo_ref, origem } = _photoTarget;
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const MAX = 800;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w >= h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      SES.fotos[key] = {
        key,
        label: SES.fotos[key + '_label'] || key.replace('foto_', '').replace(/_/g, ' '),
        secao: secao || SECS[SES.secAtual].id,
        campo_ref: campo_ref || key,
        dataUrl, w, h, origem,
        created_at: new Date().toISOString(),
        id_equipamento_colect: SES.dados.id_equipamento_colect || ''
      };
      markDirty();
      salvarCampos(SECS[SES.secAtual].id);
      const body = document.getElementById('t5-body');
      body.innerHTML = renderSecao(SECS[SES.secAtual].id);
      restaurarCampos(SECS[SES.secAtual].id);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
```
IMPORTANTE: `fi.click()` deve ser chamado diretamente no handler do botão, não dentro de Promise ou setTimeout. O navegador mobile rejeita `click()` programático em contexto assíncrono para acesso a câmera.
---
BUG 2 — `renderFotoBlock` com `'obs'` hardcoded e sem parâmetro de seção
Substituir a assinatura e todas as chamadas:
```javascript
function renderFotoBlock(def, secaoId) {
  const key = def.key;
  const secao = secaoId || SECS[SES.secAtual].id;
  // ... resto da função
  // Nos botões de câmera/galeria, usar secao (não 'obs')
  `onclick="preparePhoto('${key}','${secao}','${key}','camera')"`
  `onclick="preparePhoto('${key}','${secao}','${key}','galeria')"`
}
```
Regra de chamada — usar ID literal, NÃO `sec.id` se `sec` não estiver no escopo:
Função chamadora	Segundo argumento
`renderIdentificacao`	`'ident'`
`renderProjeto`	`'projeto'`
`renderDimensoes`	`'dimensoes'`
`renderDispositivos`	`'disp'`
`renderDocumentacao` / `renderDocumentacaoInteligente`	`'docs'`
`renderServico`	`'servico'`
`renderObs`	`'obs'`
`renderEnquadramento`	`'enquadramento'`
Nunca escrever `renderFotoBlock(d, sec.id)` se `sec` não estiver declarado no escopo local.
---
BUG 3 — `enviarGAS` descarta `_fotos` explicitamente
Localização: linha ~1925
Problema: `const {_fotos, ...rest} = eq; return rest;` — as fotos são jogadas fora.
Substituir o map de equipamentos em `enviarGAS`:
```javascript
equipamentos: SES.equipamentos.map(eq => {
  const { _fotos, _salvo, _ts, ...rest } = eq;
  return { ...rest, fotos: normalizarFotosParaEnvio(eq) };
})
```
Criar função `normalizarFotosParaEnvio`:
```javascript
function normalizarFotosParaEnvio(eq) {
  const fotos = [];
  const fonte = eq._fotos || {};
  Object.entries(fonte).forEach(([k, v]) => {
    if (k.endsWith('_label')) return;          // ignorar legendas soltas
    if (!v || typeof v !== 'object') return;   // ignorar valores primitivos
    if (!v.dataUrl) return;                    // sem imagem = inválido
    const fotoKey = v.key || k;               // EMENDA: não descartar se v.key ausente
    fotos.push({
      key: fotoKey,
      label: fonte[k + '_label'] || v.label || fotoKey,
      secao: v.secao || '',
      campo_ref: v.campo_ref || k,
      dataUrl: v.dataUrl,
      origem: v.origem || 'galeria',
      created_at: v.created_at || new Date().toISOString(),
      id_equipamento_colect: v.id_equipamento_colect || eq.id_equipamento_colect || ''
    });
  });
  return fotos;
}
```
EMENDA: Não usar `if (!v.dataUrl || !v.key) return;` — fotos antigas sem `v.key` ainda devem ser enviadas usando a chave `k` do objeto pai.
---
BUG 4 — `setToggle` não re-renderiza a seção para campos reativos
Substituir `setToggle`:
```javascript
const TOGGLES_REATIVOS = [
  'status_documentacao', 'enquadra_nr13',
  'possui_manometro', 'possui_valvula', 'valvula_adequada',
  'modo_medicao_diametro'
];

function setToggle(id, val, el, cls) {
  const row = el.closest('.toggle-row');
  row.querySelectorAll('.toggle-opt').forEach(b => b.className = 'toggle-opt');
  el.classList.add(cls);
  SES.dados[id] = val;
  if (TOGGLES_REATIVOS.includes(id)) {
    salvarCampos(SECS[SES.secAtual].id);
    const body = document.getElementById('t5-body');
    body.innerHTML = renderSecao(SECS[SES.secAtual].id);
    restaurarCampos(SECS[SES.secAtual].id);
  }
}
```
Nota: `codigo_projeto` foi removido dos TOGGLES_REATIVOS porque é um `<select>`, não um toggle. Tratar via `onchange` no select (ver item 5 da emenda).
---
BUG 5 — `SECS` tem enquadramento na posição 7 (penúltima)
Substituir o array `SECS` completo:
```javascript
const SECS = [
  { id:'enquadramento', label:'A — Enquadramento NR13',      icon:'⚖️',  pct:12  },
  { id:'ident',         label:'B — Identificação / Placa',   icon:'🏷️',  pct:24  },
  { id:'docs',          label:'C — Documentação',            icon:'📁',  pct:36  },
  { id:'projeto',       label:'D — Dados de Projeto',        icon:'📐',  pct:48  },
  { id:'dimensoes',     label:'E — Dimensões',               icon:'📏',  pct:60  },
  { id:'disp',          label:'F — Dispositivos de Seg.',    icon:'🔒',  pct:72  },
  { id:'servico',       label:'G — Instalação e Acesso',     icon:'⚠️',  pct:84  },
  { id:'obs',           label:'H — Obs / Fotos / Revisão',   icon:'📷',  pct:100 },
];
```
Remover ou substituir `getSecoes()` por:
```javascript
function getSecoes(tipo) { return SECS; }
```
(evitar duplicidade e divergência)
---
BUG 6 — `.toggle-row` sem `flex-wrap` no CSS
Localizar a definição existente de `.toggle-row` e ATUALIZAR (não duplicar):
```css
.toggle-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.toggle-opt {
  flex: 1 1 calc(50% - 8px);
  min-width: 130px;
  max-width: 100%;
  background: var(--surf2);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 8px;
  text-align: center;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: var(--text2);
  transition: background .15s, border-color .15s;
  user-select: none;
}
```
NÃO adicionar bloco CSS duplicado no final do arquivo — atualizar a definição existente.
---
PARTE 2 — IMPLEMENTAÇÕES NOVAS
2.1 — NOVA ORDEM DAS SEÇÕES (já coberto no BUG 5)
2.2 — `renderEnquadramento` COMPLETO
```javascript
function renderEnquadramento(t) {
  const enquadra = SES.dados.enquadra_nr13 || '';

  const motivosNaoEnquadramento = [
    'Recipiente transportável, vaso para transporte, reservatório portátil ou extintor de incêndio',
    'Vaso de pressão destinado à ocupação humana',
    'Vaso integrante de sistema auxiliar de pacote de máquinas',
    'Duto ou componente de duto',
    'Forno, serpentina de troca térmica ou aquecedor de fluido térmico',
    'Vaso com diâmetro interno inferior a 150 mm',
    'Gerador de vapor não enquadrado em código de vaso ou caldeira',
    'Tubo de sistema de instrumentação',
    'Tubulação de rede pública de distribuição de gás',
    'Vaso de pressão em PRFV',
    'Caldeira com volume inferior a 100 litros',
    'Tanque estrutural de embarcação, navio ou plataforma marítima',
    'Vaso ou acumulador de equipamento submarino',
    'Tanque enterrado ou apoiado sobre pernas, sapatas, pedestais ou selas',
    'Panela de cocção',
    'Acumulador ou bloco hidráulico',
    'Tubulação que opera com vapor, observado item 13.6.2.6',
    'Trocador de calor de placas corrugadas gaxetadas ou brasadas',
    'Vaso sujeito exclusivamente a vácuo ≤ 5 kPa, sem fluido classe A',
    'Outro motivo — avaliar com PLH',
  ];

  const acoesNaoEnquadramento = [
    'Oferecer formalização de desenquadramento',
    'Cliente decidiu não tomar nenhuma ação',
    'Aguardar avaliação do PLH',
    'Incluir como observação no relatório',
    'Outro',
  ];

  let html = toggle('enquadra_nr13', 'Enquadramento do item', [
    'Sim, enquadra conforme 13.2.1',
    'Não enquadra conforme 13.2.2',
    'Dúvida / necessita avaliação PLH',
    'Fora do escopo da coleta atual'
  ]);

  if (enquadra === 'Não enquadra conforme 13.2.2') {
    html += `<div class="warn-box">⚠️ Não enquadramento NR13 item 13.2.2. Preencha os campos abaixo.</div>`;
    html += campo('motivo_nao_enquadramento', 'Motivo de não enquadramento (NR13 13.2.2)', 'select',
      { options: motivosNaoEnquadramento });
    html += campo('descricao_nao_enquadramento', 'Descrição livre / observação técnica', 'textarea',
      { placeholder: 'Descreva a condição observada em campo que justifica o não enquadramento.' });
    html += campo('acao_nao_enquadramento', 'Ação recomendada', 'select',
      { options: acoesNaoEnquadramento });
    html += '<p class="sec-label">📷 Fotos de evidência</p>';
    [
      { key: 'foto_geral_equip', defaultLabel: 'Foto Geral do Equipamento' },
      { key: 'foto_placa', defaultLabel: 'Foto da Placa de Identificação (se existir)' },
      { key: 'foto_condicao_nao_enq', defaultLabel: 'Foto da Condição que Justifica Não Enquadramento' },
      { key: 'foto_complementar_nao_enq', defaultLabel: 'Foto Complementar' },
    ].forEach(d => { html += renderFotoBlock(d, 'enquadramento'); });
    return html;
  }

  html += campo('base_enquadramento', 'Base de enquadramento', 'textarea',
    { placeholder: 'Fundamente com base normativa (NR13 13.2.1 a/b/c...) e evidências de campo.' });

  if (enquadra === 'Dúvida / necessita avaliação PLH') {
    html += `<div class="info-box">ℹ️ Status: "A classificar pelo PLH". O fluxo técnico continua normalmente.</div>`;
    html += campo('situacao_nr13', 'Situação NR13', 'select',
      { options: ['A classificar pelo PLH', 'Em dia', 'Vencida', 'Nunca inspecionada', 'Sem documentação'] });
  } else if (enquadra === 'Fora do escopo da coleta atual') {
    html += campo('descricao_nao_enquadramento', 'Descrição / observação', 'textarea',
      { placeholder: 'Descreva por que está fora do escopo.' });
    [
      { key: 'foto_geral_equip', defaultLabel: 'Foto Geral do Equipamento' },
      { key: 'foto_complementar_nao_enq', defaultLabel: 'Foto Complementar' },
    ].forEach(d => { html += renderFotoBlock(d, 'enquadramento'); });
    return html;
  } else if (enquadra === 'Sim, enquadra conforme 13.2.1') {
    html += campo('situacao_nr13', 'Situação NR13', 'select',
      { options: ['Em dia', 'Vencida', 'Nunca inspecionada', 'Sem documentação', 'A classificar'] });
  } else {
    html += campo('situacao_nr13', 'Situação NR13', 'select',
      { options: ['Em dia', 'Vencida', 'Nunca inspecionada', 'Sem documentação', 'Fora do escopo NR13', 'A classificar'] });
  }

  html += campo('observacao_enquadramento', 'Observações de enquadramento', 'textarea',
    { placeholder: 'Complementos, restrições e recomendações.' });
  html += '<p class="sec-label">📷 Fotos desta Seção</p>';
  [
    { key: 'foto_geral_equip', defaultLabel: 'Foto Geral do Equipamento' },
    { key: 'foto_placa', defaultLabel: 'Foto da Placa de Identificação' },
  ].forEach(d => { html += renderFotoBlock(d, 'enquadramento'); });
  return html;
}
```
---
2.3 — `renderDispositivos` CONDICIONAL COMPLETO
```javascript
function renderDispositivos(t) {
  const posMan = SES.dados.possui_manometro || '';
  const posPSV = SES.dados.possui_valvula || '';
  const valvAdequada = SES.dados.valvula_adequada || '';

  let html = '<p class="sec-label">Manômetro / Indicador de Pressão</p>';
  html += toggle('possui_manometro', 'Possui manômetro / indicador de pressão?', ['Sim', 'Não', 'N/A']);

  if (posMan === 'Sim') {
    html += toggle('manometro_calibrado', 'Manômetro calibrado?', ['Sim', 'Não', 'N/A']);
    html += campo('cert_manometro', 'Nº Certificado de Calibração (Manômetro)', 'text',
      { placeholder: 'CAL-2026-001' });
    html += campo('venc_manometro', 'Vencimento da Calibração', 'date', {});
    html += '<p class="sec-label">📷 Fotos — Manômetro</p>';
    html += renderFotoBlock({ key: 'foto_manometro', defaultLabel: 'Foto do Manômetro / Indicador de Pressão' }, 'disp');
    html += renderFotoBlock({ key: 'foto_cert_man', defaultLabel: 'Foto do Certificado de Calibração do Manômetro' }, 'disp');
  } else if (posMan === 'Não' || posMan === 'N/A') {
    html += campo('obs_manometro', 'Observação sobre manômetro', 'textarea',
      { placeholder: 'Justifique ausência ou N/A.' });
  }

  html += '<p class="sec-label">Válvula de Segurança / Alívio (PSV)</p>';
  html += toggle('possui_valvula', 'Possui válvula de segurança / alívio?', ['Sim', 'Não', 'N/A']);

  if (posPSV === 'Sim') {
    // pa_valvula aparece SEMPRE que possui = Sim, independente de calibração
    html += campo('pa_valvula', 'Pressão de Abertura da PSV (kgf/cm²)', 'number',
      { placeholder: 'Ex: 11' });
    html += toggle('valvula_calibrada', 'PSV calibrada?', ['Sim', 'Não', 'N/A']);
    html += campo('cert_valvula', 'Nº Certificado de Calibração (PSV)', 'text',
      { placeholder: 'CAL-2026-002' });
    html += campo('venc_valvula', 'Vencimento da Calibração', 'date', {});
    html += toggle('valvula_adequada', 'A válvula de segurança é adequada?',
      ['Sim', 'Não', 'Não foi possível avaliar', 'N/A']);

    if (valvAdequada === 'Não') {
      html += campo('motivo_valvula_inadequada', 'Motivo de inadequação da válvula', 'textarea',
        { placeholder: 'Descreva por que a válvula não é adequada.' });
    }
    if (valvAdequada === 'Não foi possível avaliar') {
      html += campo('motivo_nao_avaliacao_valvula', 'Motivo da não avaliação', 'textarea',
        { placeholder: 'Ex: válvula inacessível, sem certificado disponível...' });
    }
    html += '<p class="sec-label">📷 Fotos — PSV</p>';
    html += renderFotoBlock({ key: 'foto_psv', defaultLabel: 'Foto da Válvula de Segurança / Alívio' }, 'disp');
    html += renderFotoBlock({ key: 'foto_cert_psv', defaultLabel: 'Foto do Certificado de Calibração da PSV' }, 'disp');
  } else if (posPSV === 'Não' || posPSV === 'N/A') {
    html += campo('obs_valvula', 'Observação sobre PSV', 'textarea',
      { placeholder: 'Justifique ausência ou N/A.' });
  }

  html += '<p class="sec-label">Outros Dispositivos</p>';
  html += toggle('possui_purgador', 'Possui purgador?', ['Sim', 'Não', 'N/A']);
  html += toggle('possui_dcbi', 'Possui DCBI?', ['Sim', 'Não', 'N/A']);
  html += toggle('possui_valvula_retencao', 'Possui válvula de retenção?', ['Sim', 'Não', 'N/A']);
  if (t === 'caldeira') {
    html += toggle('possui_indicador_nivel', 'Possui indicador de nível?', ['Sim', 'Não']);
    html += toggle('possui_pressostato', 'Possui pressostato de segurança?', ['Sim', 'Não']);
  }
  return html;
}
```
---
2.4 — DOCUMENTAÇÃO RESPONSIVA E INTERATIVA — `renderDocumentacaoInteligente`
Status suportados:
`Física completa`, `Física parcial`, `Digital completa`, `Digital parcial`
`Não localizada`, `Documentação extraviada`, `Aguardando envio pelo cliente`
`Não se aplica`, `Não verificada nesta visita`
Documentos por tipo (exatos):
```javascript
const docsTipo = {
  vaso: [
    'Prontuário do vaso (fabricante)',
    'Registro de segurança',
    'Relatórios de inspeção anteriores',
    'Projeto de Alteração e Reparo (PAR)',
    'Certificado de calibração da PSV',
    'Certificado de calibração do manômetro',
    'Projeto de instalação',
    'Comprovação de TH de fabricação (se aplicável)',
  ],
  caldeira: [
    'Prontuário da caldeira (fabricante)',
    'Registro de segurança',
    'Relatórios de inspeção anteriores',
    'Projeto de Alteração e Reparo (PAR)',
    'Certificado de calibração da PSV',
    'Certificado de calibração do manômetro',
    'Projeto de instalação',
    'Manual de operação',
    'Documentação de operador (se aplicável)',
  ],
  tubulacao: [
    'Especificação da linha / sistema',
    'Fluxograma / P&ID / isométrico',
    'Relatórios de inspeção anteriores',
    'Projeto de Alteração e Reparo (PAR)',
    'Certificado de dispositivo de segurança (se aplicável)',
  ],
  tanque: [
    'Folha de dados',
    'Registro de segurança',
    'Relatórios de inspeção anteriores',
    'Projeto de Alteração e Reparo (PAR)',
    'Certificado de dispositivo de sobrepressão / vácuo (se aplicável)',
  ],
};
```
Comportamento condicional:
```javascript
function renderDocumentacaoInteligente(t) {
  const docs = docsTipo[t] || docsTipo.vaso;
  const statusOpts = [
    'Física completa', 'Física parcial',
    'Digital completa', 'Digital parcial',
    'Não localizada', 'Documentação extraviada',
    'Aguardando envio pelo cliente',
    'Não se aplica', 'Não verificada nesta visita'
  ];
  const status = SES.dados.status_documentacao || '';
  const comDocumento = ['Física completa','Física parcial','Digital completa','Digital parcial'].includes(status);
  const digital = status.startsWith('Digital');
  const semDoc = ['Não localizada','Documentação extraviada','Não se aplica','Não verificada nesta visita'].includes(status);
  const aguardando = status === 'Aguardando envio pelo cliente';

  let html = toggle('status_documentacao', 'Situação da documentação?', statusOpts);

  if (comDocumento) {
    if (digital) {
      html += `<div class="info-box">📱 Documentação digital: anexar ou registrar evidência do documento digital, se disponível.</div>`;
    }
    html += checkList('doc', 'Documentos presentes', docs);
    html += campo('obs_docs', 'Observações sobre documentação', 'textarea',
      { placeholder: 'Prontuário incompleto, RS desatualizado…' });
    html += campo('responsavel_envio_docs', 'Responsável pelo envio de documentos', 'text',
      { placeholder: 'Nome e contato' });
    html += campo('prazo_envio_docs', 'Prazo para envio', 'date', {});
    html += '<p class="sec-label">📷 Fotos da Documentação</p>';
    [
      { key: 'foto_prontuario', defaultLabel: 'Foto do Prontuário / Folha de Dados' },
      { key: 'foto_registro_seg', defaultLabel: 'Foto do Registro de Segurança' },
      { key: 'foto_rel_anterior', defaultLabel: 'Foto do Relatório de Inspeção Anterior' },
      { key: 'foto_cert_psv_doc', defaultLabel: 'Foto do Certificado de Calibração da PSV' },
    ].forEach(d => { html += renderFotoBlock(d, 'docs'); });
  } else if (aguardando) {
    html += campo('obs_docs', 'Observações', 'textarea',
      { placeholder: 'Descreva o status e a pendência documental.' });
    html += campo('responsavel_envio_docs', 'Responsável pelo envio', 'text',
      { placeholder: 'Nome e contato' });
    html += campo('prazo_envio_docs', 'Prazo para envio', 'date', {});
    html += campo('canal_previsto_envio_docs', 'Canal previsto de envio', 'select',
      { options: ['E-mail', 'WhatsApp', 'Portal do cliente', 'Correio', 'Outro'] });
    html += `<div class="warn-box">📋 Documentação não disponível no momento da coleta. Fotos documentais desativadas.</div>`;
  } else if (semDoc) {
    html += campo('obs_docs', 'Observações sobre documentação', 'textarea',
      { placeholder: 'Descreva o status e a pendência documental.' });
    html += `<div class="warn-box">📋 Documentação não disponível no momento da coleta. Fotos documentais desativadas para esta seção.</div>`;
    if (!SES.dados.documentos_ausentes) SES.dados.documentos_ausentes = docs;
  } else {
    html += campo('obs_docs', 'Observações sobre documentação', 'textarea',
      { placeholder: 'Descreva o status e a pendência documental.' });
  }
  return html;
}
const renderDocumentacao = renderDocumentacaoInteligente;
```
---
2.5 — CÓDIGO DE PROJETO — SELECT INTELIGENTE POR TIPO (EMENDA: nome corrigido)
Nome correto da função: `getCodigoProjetoSelect` (não `getCodiguoProjetoSelect`)
```javascript
function getCodigoProjetoSelect(t) {
  const opcoes = {
    vaso:      ['ASME BPVC Section VIII Div. 1','ASME BPVC Section VIII Div. 2',
                'ASME BPVC Section VIII Div. 3','ASME BPVC Section X',
                'Código não identificado','Outro'],
    caldeira:  ['ASME BPVC Section I','ASME BPVC Section IV',
                'ASME BPVC Section VIII (se aplicável)','Código não identificado','Outro'],
    tubulacao: ['ASME B31.1','ASME B31.3','ASME B31.9','API 570',
                'Código não identificado','Outro'],
    tanque:    ['API 650','API 653','ASME Section VIII (se pressurizado)',
                'Código não identificado','Outro'],
  };
  const opts = opcoes[t] || ['Código não identificado','Outro'];
  const codigoProjeto = SES.dados.codigo_projeto || '';

  // onchange: salvar, markDirty, re-renderizar seção para exibir campo Outro
  let html = `
    <div class="field">
      <label>Código de Projeto</label>
      <select id="f_codigo_projeto"
        onchange="SES.dados.codigo_projeto=this.value; salvarCampos(SECS[SES.secAtual].id); markDirty();
          const body=document.getElementById('t5-body');
          body.innerHTML=renderSecao(SECS[SES.secAtual].id);
          restaurarCampos(SECS[SES.secAtual].id);">
        <option value="">— Selecionar —</option>
        ${opts.map(o => `<option value="${o}"${codigoProjeto===o?' selected':''}>${o}</option>`).join('')}
      </select>
    </div>`;

  if (codigoProjeto === 'Outro') {
    html += campo('codigo_projeto_outro', 'Especificar código de projeto', 'text',
      { placeholder: 'Ex: NR-12, código próprio, sem código...' });
  }
  return html;
}
```
Em `renderIdentificacao`, substituir a linha do `campo('codigo_projeto',...)` por `getCodigoProjetoSelect(t)`.
Compatibilidade com dados antigos: se `SES.dados.codigo_projeto` contiver um valor não listado nas opções, adicionar `<option value="${codigoProjeto}" selected>${codigoProjeto}</option>` dinamicamente para não perder o dado.
---
2.6 — TEMPERATURA — REMOVER DO FORMULÁRIO E PDF
Em `renderProjeto`: remover o campo `temperatura`.
No `gerarPDFEquips`: remover a linha:
```javascript
y = row2(y,[{l:'Pressao de Teste Hidro. (kgf/cm2)',v:d.pressao_teste},{l:'Temperatura de Operacao (oC)',v:d.temperatura}]);
```
Substituir por:
```javascript
y = row1(y,'Pressao de Teste Hidrostático (kgf/cm2)', d.pressao_teste, false);
```
NÃO remover coluna do GAS. NÃO marcar como pendência. Manter legado.
---
2.7 — DIÂMETRO EXTERNO OU CIRCUNFERÊNCIA (EMENDA: cálculo em tempo real)
Em `renderDimensoes`, bloco `vaso`:
```javascript
if (t === 'vaso') {
  html += `<div class="warn-box">Preencha as dimensões conforme placa ou prontuário do equipamento.</div>`;
  html += toggle('modo_medicao_diametro', 'Modo de medição do diâmetro',
    ['Diâmetro externo medido', 'Circunferência medida', 'Não medido']);

  const modoDiam = SES.dados.modo_medicao_diametro || '';

  if (modoDiam === 'Diâmetro externo medido' || modoDiam === '') {
    html += campo('diametro_externo_mm', 'Diâmetro Externo (mm)', 'number',
      { placeholder: 'Ex: 600' });
  }

  if (modoDiam === 'Circunferência medida') {
    const circ = parseFloat(SES.dados.circunferencia_mm) || 0;
    const dCalc = circ > 0 ? (circ / Math.PI).toFixed(1) : '—';
    // EMENDA: onchange em tempo real, não depende de re-render de seção
    html += `
      <div class="field">
        <label>Circunferência medida (mm)</label>
        <input type="number" id="f_circunferencia_mm"
          placeholder="Ex: 1885"
          oninput="
            const v=parseFloat(this.value)||0;
            SES.dados.circunferencia_mm=this.value;
            SES.dados.diametro_externo_calculado_mm=v>0?(v/Math.PI).toFixed(1):'';
            const el=document.getElementById('diam_calc_result');
            if(el) el.textContent=v>0?'Ø externo calculado: '+(v/Math.PI).toFixed(1)+' mm':'—';
            markDirty();">
      </div>
      <div class="info-box" id="diam_calc_result">
        ${circ > 0 ? 'Ø externo calculado: ' + dCalc + ' mm' : '—'}
      </div>`;
  }

  html += campo('comprimento', 'Comprimento / Altura (mm)', 'number', { placeholder: 'Ex: 2000' });
  html += campo('volume', 'Volume (litros)', 'number', { placeholder: 'Ex: 500' });
  html += campo('espessura_parede', 'Espessura de Parede (mm)', 'number', { placeholder: 'Ex: 10' });
  html += campo('material_casco', 'Material do Casco', 'text',
    { placeholder: 'Ex: Aço carbono ASTM A516 Gr.70' });
}
```
No PDF, exibir os três campos separados se existirem.
---
2.8 — AUTOSAVE E RASCUNHO — CORRIGIR `selectOS` (EMENDA)
Regra de carregamento ao selecionar OS:
```javascript
function selectOS(id) {
  SES.os = SES._osList.find(o => o.id_os === id);
  if (!SES.os) return;

  // EMENDA: carregar rascunho na nova chave primeiro, fallback para legado
  const chaveNova = 'colect_os_' + id;
  const chaveLegado = 'colect_equip_' + id;

  try {
    const dadosNovos = localStorage.getItem(chaveNova);
    if (dadosNovos) {
      const draft = JSON.parse(dadosNovos);
      SES.equipamentos = draft.equipamentos || [];
      SES.id_visita_colect = draft.id_visita_colect || '';
    } else {
      // fallback legado
      SES.equipamentos = JSON.parse(localStorage.getItem(chaveLegado) || '[]');
      SES.id_visita_colect = '';
    }
  } catch {
    SES.equipamentos = [];
    SES.id_visita_colect = '';
  }
  renderT3();
}
```
Regra de salvamento — `autosaveDraft` deve usar a nova chave:
```javascript
function autosaveDraft(motivo) {
  if (!SES.os || !SES._dirty) return;
  const chave = 'colect_os_' + SES.os.id_os;
  const draft = {
    id_visita_colect: SES.id_visita_colect || '',
    equipamentos: SES.equipamentos,
    updated_at: new Date().toISOString(),
    motivo
  };
  try { localStorage.setItem(chave, JSON.stringify(draft)); SES._dirty = false; }
  catch(e) { console.warn('autosave falhou', e); }
}
```
NÃO limpar rascunho após envio GAS. Apenas marcar `sync_status = 'synced'`.
---
2.9 — `salvarEquipamento` CORRIGIDO (EMENDA)
```javascript
function salvarEquipamento() {
  // EMENDA: executar antes de salvar
  ensureVisitId();
  ensureEquipId();
  salvarCampos(SECS[SES.secAtual].id);

  const equip = {
    ...SES.dados,
    id_visita_colect: SES.id_visita_colect || SES.dados.id_visita_colect || '',
    id_equipamento_colect: SES.dados.id_equipamento_colect || '',
    _nao_enquadrado: SES.dados.enquadra_nr13 === 'Não enquadra conforme 13.2.2',
    _fotos: { ...SES.fotos },
    _salvo: true,
    sync_status: SES.dados.sync_status === 'synced' ? 'synced' : 'pending',
    updated_at: new Date().toISOString(),
    _ts: Date.now()
  };

  if (SES.equipEdit !== null) {
    // EMENDA: não duplicar — atualizar no mesmo índice
    SES.equipamentos[SES.equipEdit] = equip;
  } else {
    // EMENDA: verificar se já existe pelo id_equipamento_colect antes de push
    const idxExistente = SES.equipamentos.findIndex(
      e => e.id_equipamento_colect && e.id_equipamento_colect === equip.id_equipamento_colect
    );
    if (idxExistente >= 0) {
      SES.equipamentos[idxExistente] = equip;
    } else {
      SES.equipamentos.push(equip);
    }
  }

  markDirty();
  autosaveDraft('salvar_equipamento');
  showToast('✓ Equipamento salvo localmente');
  renderT3();
}
```
Garantir que `ensureVisitId` e `ensureEquipId` existam:
```javascript
function ensureVisitId() {
  if (!SES.id_visita_colect) {
    SES.id_visita_colect = 'VIS-' + Date.now() + '-' + Math.random().toString(36).substr(2,6).toUpperCase();
  }
}

function ensureEquipId() {
  if (!SES.dados.id_equipamento_colect) {
    SES.dados.id_equipamento_colect = 'EQ-' + Date.now() + '-' + Math.random().toString(36).substr(2,6).toUpperCase();
  }
}
```
---
2.10 — PAYLOAD SIZE CHECK — EMENDA
Antes do `gasPost` em `enviarGAS`, adicionar verificação:
```javascript
async function enviarGAS() {
  if (!SES.equipamentos.length) { showToast('Nenhum equipamento', 'err'); return; }
  if (DEMO_MODE) { showToast('Modo demo — GAS não configurado', 'warn'); return; }

  salvarCampos(SECS[SES.secAtual].id);
  autosaveDraft('before_send');
  ensureVisitId();

  const payload = {
    id_visita_colect: SES.id_visita_colect,
    id_os: SES.os.id_os,
    numero_os: SES.os.numero_os,
    id_cliente: SES.os.id_cliente,
    cliente: SES.os.cliente,
    id_inspetor: SES.inspetor.id_inspetor,
    inspetor: SES.inspetor.nome,
    app_version: APP_VERSION,
    data_coleta: new Date().toISOString(),
    equipamentos: SES.equipamentos.map(eq => {
      const { _fotos, _salvo, _ts, ...rest } = eq;
      return { ...rest, fotos: normalizarFotosParaEnvio(eq) };
    })
  };

  // EMENDA: verificar tamanho antes de enviar
  const payloadStr = JSON.stringify(payload);
  const tamanhoMB = (new Blob([payloadStr]).size / 1024 / 1024).toFixed(1);
  if (parseFloat(tamanhoMB) > 35) {
    showToast(`⚠️ Payload muito grande (${tamanhoMB} MB). Reduza fotos ou envie em partes.`, 'warn');
    hideLoading();
    return;
  }

  showLoading('Enviando ao servidor… ' + tamanhoMB + ' MB');
  try {
    const r = await gasPost('salvarLevantamentoNR13', payload);
    hideLoading();
    if (r.status === 'ok') {
      // EMENDA: marcar synced sem apagar rascunho
      if (r.resultados) {
        r.resultados.forEach(res => {
          const eq = SES.equipamentos.find(e => e.id_equipamento_colect === res.id_equipamento_colect);
          if (eq) {
            eq.sync_status = 'synced';
            if (res.drive_folder_url) eq._drive_folder_url = res.drive_folder_url;
            if (res.quantidade_fotos !== undefined) eq._qtd_fotos_drive = res.quantidade_fotos;
          }
        });
      }
      autosaveDraft('after_send_ok');
      document.getElementById('tc-summary').textContent =
        SES.equipamentos.length + ' equipamento(s) registrado(s).';
      document.getElementById('tc-id').textContent = r.id || 'LNR-' + Date.now();
      showToast('✅ Dados enviados com sucesso!');
      goTo('tc');
    } else {
      showToast('Erro GAS: ' + (r.mensagem || 'falha desconhecida'), 'err');
    }
  } catch (e) {
    hideLoading();
    showToast('Falha ao enviar: ' + e.message, 'err');
  }
}
```
---
2.11 — PDF: FOTOS AGRUPADAS POR SEÇÃO + NÃO ENQUADRAMENTO
Adicionar helpers:
```javascript
const LEGENDAS_TECNICAS_PDF = {
  foto_placa: 'Foto da Placa de Identificacao Indelevel',
  foto_tag: 'Foto da TAG / Codigo de Identificacao',
  foto_geral_equip: 'Foto Geral do Equipamento',
  foto_psv: 'Foto da Valvula de Seguranca / Alivio',
  foto_manometro: 'Foto do Manometro / Indicador de Pressao',
  foto_cert_psv: 'Foto do Certificado de Calibracao da PSV',
  foto_cert_man: 'Foto do Certificado de Calibracao do Manometro',
  foto_prontuario: 'Foto do Prontuario / Folha de Dados',
  foto_registro_seg: 'Foto do Registro de Seguranca',
  foto_rel_anterior: 'Foto do Relatorio de Inspecao Anterior',
  foto_medicao: 'Foto da Medicao Realizada em Campo',
  foto_ambiente: 'Foto do Ambiente de Instalacao',
  foto_acesso: 'Foto das Condicoes de Acesso',
  foto_risco: 'Foto de Risco, Restricao ou Anomalia Observada',
  foto_condicao_nao_enq: 'Foto da Condicao que Justifica Nao Enquadramento',
  foto_complementar_nao_enq: 'Foto Complementar',
};

const GRUPOS_FOTO_PDF = [
  { id:'enquadramento', titulo:'Enquadramento NR13' },
  { id:'ident',         titulo:'Identificacao / Placa' },
  { id:'docs',          titulo:'Documentacao' },
  { id:'projeto',       titulo:'Dados de Projeto' },
  { id:'dimensoes',     titulo:'Dimensoes / Dados Construtivos' },
  { id:'disp',          titulo:'Dispositivos de Seguranca' },
  { id:'servico',       titulo:'Condicoes de Instalacao e Acesso' },
  { id:'obs',           titulo:'Observacoes / Gerais' },
];

function normalizarFotosPDF(eq) {
  const fotos = [];
  const fonte = eq._fotos || {};
  Object.entries(fonte).forEach(([k, v]) => {
    if (k.endsWith('_label')) return;
    if (!v || !v.dataUrl) return;
    const fotoKey = v.key || k;
    fotos.push({
      key: fotoKey,
      label: fonte[k + '_label'] || v.label || LEGENDAS_TECNICAS_PDF[fotoKey] || fotoKey.replace('foto_','').replace(/_/g,' '),
      secao: v.secao || 'obs',
      dataUrl: v.dataUrl,
      w: v.w || 800,
      h: v.h || 600
    });
  });
  return fotos;
}
```
No loop de fotos do PDF, substituir o bloco existente por:
```javascript
// FOTOS — agrupadas por seção
const todasFotos = normalizarFotosPDF(eq);

if (todasFotos.length) {
  y = newPage();

  // Se não enquadrado: título especial
  const titulo = (eq._nao_enquadrado || eq.enquadra_nr13 === 'Não enquadra conforme 13.2.2')
    ? 'REGISTRO DE NAO ENQUADRAMENTO NR13 - Fotos de Evidencia'
    : 'REGISTRO FOTOGRAFICO';
  y = secTit(y, '📷', titulo);
  y += 3;

  GRUPOS_FOTO_PDF.forEach(grupo => {
    const fotosGrupo = todasFotos.filter(f => f.secao === grupo.id);
    if (!fotosGrupo.length) return;

    y = ck(y, 10);
    // Subtítulo do grupo
    doc.setFillColor(46, 91, 168);
    doc.rect(ML, y, CW, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(limparTxtPDF('Registro Fotografico — ' + grupo.titulo), ML + 3, y + 4.2);
    y += 8;

    const COLS = 2, GAP = 4;
    const PW2 = (CW - GAP * (COLS - 1)) / COLS;
    const MAX_H = 65;
    const CAP_H = 10;
    let col = 0, rowY = y, rowMaxH = 0;

    fotosGrupo.forEach(ph => {
      const ratio = (ph.h || 600) / (ph.w || 800);
      const imgH = Math.min(MAX_H, PW2 * ratio);
      const blockH = imgH + CAP_H + 4;
      if (!rowMaxH) rowMaxH = blockH;
      y = ck(rowY, blockH);
      if (y !== rowY && col !== 0) { col = 0; rowY = y; rowMaxH = blockH; }
      const x = ML + col * (PW2 + GAP);
      doc.setFillColor(240, 245, 255);
      doc.rect(x, y, PW2, blockH, 'F');
      doc.setDrawColor(200, 210, 225);
      doc.setLineWidth(0.3);
      doc.rect(x, y, PW2, blockH, 'S');
      try {
        let w2 = PW2 - 2, h2 = imgH - 2;
        const r2 = (ph.w || 800) / (ph.h || 600);
        if (w2 / r2 > h2) { w2 = h2 * r2; } else { h2 = w2 / r2; }
        doc.addImage(ph.dataUrl, 'JPEG', x + 1, y + 1, w2, h2);
      } catch (e) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text('Foto nao carregada', x + 2, y + imgH / 2);
      }
      const legTxt = limparTxtPDF(ph.label);
      const legLines = doc.splitTextToSize(legTxt, PW2 - 4);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6.5);
      doc.setTextColor(80, 100, 130);
      doc.text(legLines[0], x + PW2 / 2, y + imgH + 6, { align: 'center' });
      col++;
      if (col >= COLS) { col = 0; rowY += rowMaxH + GAP; rowMaxH = 0; y = rowY; }
    });
    y = rowY + (rowMaxH || 0) + GAP;
  });
}
```
PDF simplificado para não enquadramento: quando `eq._nao_enquadrado === true`, pular seções D (dispositivos), B (projeto técnico), categorias. Exibir apenas: enquadramento, identificação básica, motivo, ação, fotos de evidência, observações.
---
PARTE 3 — GAS v1.2
3.1 — `salvarFotosDrive` MELHORADO
```javascript
const DRIVE_LINK_PUBLICO = true; // EMENDA: constante controlável

function sanitizeFileName(nome) {
  return String(nome || '').replace(/\s+/g, '_').replace(/[\/:*?"<>|\\]/g, '-').substring(0, 80);
}

function getOrCreateFolder(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function getOrCreateDrivePath(parts) {
  let folder = DriveApp.getRootFolder();
  parts.forEach(p => { folder = getOrCreateFolder(folder, sanitizeFileName(p)); });
  return folder;
}

function salvarFotosDrive(idVisita, idEquip, tag, fotos) {
  const resp = {
    drive_folder_id: '', drive_folder_url: '', primeira_foto_url: '',
    quantidade_fotos: 0, fotos_salvas: [], fotos_com_erro: []
  };
  if (!Array.isArray(fotos) || !fotos.length) return resp;

  const ym = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM');
  const safeVisita = sanitizeFileName(idVisita || 'SEM_VISITA');

  const folder = getOrCreateDrivePath(['PGP_Fotos', ym, safeVisita]);
  resp.drive_folder_id = folder.getId();
  resp.drive_folder_url = folder.getUrl();

  fotos.forEach((f, idx) => {
    try {
      const key = sanitizeFileName(f.key || ('foto_' + idx));
      const secao = sanitizeFileName(f.secao || 'geral');
      const safeTag = sanitizeFileName(tag || idEquip || 'SEM_TAG');
      const dataUrl = String(f.dataUrl || '');
      if (!dataUrl || !dataUrl.startsWith('data:')) throw new Error('dataUrl inválida');

      const b64 = dataUrl.split(',').pop();
      const bytes = Utilities.base64Decode(b64);
      const nome = [safeTag, secao, key, String(idx + 1).padStart(2, '0')].join('_') + '.jpg';
      const blob = Utilities.newBlob(bytes, 'image/jpeg', nome);
      const arq = folder.createFile(blob);

      // EMENDA: controle de visibilidade via constante
      if (DRIVE_LINK_PUBLICO) {
        arq.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      }

      const fotoMeta = {
        key: f.key || key,
        label: f.label || '',
        secao: f.secao || '',
        campo_ref: f.campo_ref || key,
        file_id: arq.getId(),
        file_url: arq.getUrl(),
        file_name: nome,
        origem: f.origem || '',
        created_at: f.created_at || new Date().toISOString()
        // EMENDA: NUNCA incluir dataUrl aqui — Sheets não recebe base64
      };
      resp.fotos_salvas.push(fotoMeta);
      if (!resp.primeira_foto_url) resp.primeira_foto_url = arq.getUrl();
    } catch (err) {
      logErro('salvarFotosDrive', err.message,
        JSON.stringify({ idVisita, idEquip, key: f && f.key }));
      resp.fotos_com_erro.push({ key: f && f.key, erro: err.message });
    }
  });

  resp.quantidade_fotos = resp.fotos_salvas.length;
  return resp;
}
```
3.2 — `garantirColunas` — adicionar campos novos
Em `salvarLevantamentoNR13`, incluir na lista de `garantirColunas`:
```javascript
garantirColunas(aba, [
  // ... campos existentes ...
  'upload_fotos_status', 'upload_fotos_erros',
  'valvula_adequada', 'motivo_valvula_inadequada', 'motivo_nao_avaliacao_valvula',
  'modo_medicao_diametro', 'diametro_externo_mm', 'circunferencia_mm',
  'diametro_externo_calculado_mm', 'descricao_nao_enquadramento',
  'obs_manometro', 'obs_valvula', 'canal_previsto_envio_docs',
  '_nao_enquadrado', 'revisao_engenharia', 'pendencia_resolvida',
  'situacao_documental_revisada', 'obs_revisao'
]);
```
3.3 — `upsertEquipamentoNR13` — campos novos no mapa
Adicionar ao objeto `campos`:
```javascript
valvula_adequada: eq.valvula_adequada || '',
motivo_valvula_inadequada: eq.motivo_valvula_inadequada || '',
motivo_nao_avaliacao_valvula: eq.motivo_nao_avaliacao_valvula || '',
modo_medicao_diametro: eq.modo_medicao_diametro || '',
diametro_externo_mm: eq.diametro_externo_mm || '',
circunferencia_mm: eq.circunferencia_mm || '',
diametro_externo_calculado_mm: eq.diametro_externo_calculado_mm || '',
descricao_nao_enquadramento: eq.descricao_nao_enquadramento || '',
obs_manometro: eq.obs_manometro || '',
obs_valvula: eq.obs_valvula || '',
canal_previsto_envio_docs: eq.canal_previsto_envio_docs || '',
nao_enquadrado: eq._nao_enquadrado ? 'Sim' : '',
upload_fotos_status: (fotosInfo && fotosInfo.fotos_com_erro && fotosInfo.fotos_com_erro.length > 0)
  ? 'ok_with_photo_errors'
  : (fotosInfo && fotosInfo.quantidade_fotos > 0 ? 'ok' : 'sem_fotos'),
upload_fotos_erros: (fotosInfo && fotosInfo.fotos_com_erro)
  ? JSON.stringify(fotosInfo.fotos_com_erro) : '',
```
3.4 — Switch de ações — adicionar SEM duplicar
EMENDA: Não duplicar `case 'getOSColect'` que já existe. Adicionar apenas o que não existe:
```javascript
// Já existem: healthCheck, validarPIN, getOSColect, salvarLevantamentoNR13, getEquipamentos, gerarConsultaCliente
// Adicionar apenas:
case 'getTecnicos':                 result = getTecnicos();                          break;
case 'salvarTecnico':               result = salvarTecnico(params);                  break;
case 'getClientesLeads':            result = getClientesLeads();                     break;
case 'salvarClienteLead':           result = salvarClienteLead(params);              break;
case 'salvarOSColect':              result = salvarOSColect(params);                 break;
case 'atualizarEquipamentoRevisao': result = atualizarEquipamentoRevisao(params);    break;
case 'getConsultaCliente':          result = getConsultaCliente(params);             break;
```
3.5 — Novas abas e funções do Manager
```javascript
const ABA_TECNICOS       = 'TECNICOS';
const ABA_CLIENTES_LEADS = 'CLIENTES_LEADS';

// Adicionar a garantirAbas():
getOuCriarAba(ABA_TECNICOS);
getOuCriarAba(ABA_CLIENTES_LEADS);
garantirColunas(getOuCriarAba(ABA_TECNICOS),
  ['id_tecnico','nome','pin','email','cargo','ativo','criado_em']);
garantirColunas(getOuCriarAba(ABA_CLIENTES_LEADS),
  ['id_cliente','razao_social','nome_fantasia','cnpj_cpf','unidade',
   'cidade','uf','contato','telefone','email','status','observacoes','criado_em']);

function getTecnicos() {
  const aba = getOuCriarAba(ABA_TECNICOS);
  const dados = aba.getDataRange().getValues();
  if (dados.length < 2) return { status:'ok', tecnicos:[] };
  const header = dados[0];
  return { status:'ok', tecnicos: dados.slice(1).filter(r=>r[0]).map(r=>{
    const o={};header.forEach((h,i)=>{o[h]=r[i];});
    delete o.pin; // nunca retornar PIN
    return o;
  })};
}

function salvarTecnico(params) {
  const aba = getOuCriarAba(ABA_TECNICOS);
  const dados = aba.getDataRange().getValues();
  const header = dados[0] || [];
  const idxId = header.indexOf('id_tecnico');
  const id = String(params.id_tecnico || ('TEC-' + Utilities.getUuid())).trim();
  let rowIndex = -1;
  for (let i=1;i<dados.length;i++) {
    if (String(dados[i][idxId]||'').trim()===id) { rowIndex=i+1; break; }
  }
  const campos = {
    id_tecnico: id, nome: params.nome||'', pin: params.pin||'',
    email: params.email||'', cargo: params.cargo||'',
    ativo: params.ativo!==undefined?String(params.ativo):'true',
    criado_em: rowIndex>0 ? (dados[rowIndex-1][header.indexOf('criado_em')]||new Date().toISOString()) : new Date().toISOString()
  };
  const rowData = header.map(h=>campos[h]!==undefined?campos[h]:'');
  if (rowIndex>0) { aba.getRange(rowIndex,1,1,header.length).setValues([rowData]); }
  else { aba.appendRow(rowData); }
  return { status:'ok', id_tecnico: id };
}

function getClientesLeads() {
  const aba = getOuCriarAba(ABA_CLIENTES_LEADS);
  const dados = aba.getDataRange().getValues();
  if (dados.length<2) return {status:'ok',clientes:[]};
  const header = dados[0];
  return {status:'ok',clientes:dados.slice(1).filter(r=>r[0]).map(r=>{
    const o={};header.forEach((h,i)=>{o[h]=r[i];});return o;
  })};
}

function salvarClienteLead(params) {
  const aba = getOuCriarAba(ABA_CLIENTES_LEADS);
  const dados = aba.getDataRange().getValues();
  const header = dados[0]||[];
  const idxId = header.indexOf('id_cliente');
  const id = String(params.id_cliente||('CLI-'+Utilities.getUuid())).trim();
  let rowIndex=-1;
  for(let i=1;i<dados.length;i++){
    if(String(dados[i][idxId]||'').trim()===id){rowIndex=i+1;break;}
  }
  const campos={
    id_cliente:id, razao_social:params.razao_social||'',
    nome_fantasia:params.nome_fantasia||'', cnpj_cpf:params.cnpj_cpf||'',
    unidade:params.unidade||'', cidade:params.cidade||'', uf:params.uf||'',
    contato:params.contato||'', telefone:params.telefone||'',
    email:params.email||'', status:params.status||'lead',
    observacoes:params.observacoes||'',
    criado_em:rowIndex>0?(dados[rowIndex-1][header.indexOf('criado_em')]||new Date().toISOString()):new Date().toISOString()
  };
  const rowData=header.map(h=>campos[h]!==undefined?campos[h]:'');
  if(rowIndex>0){aba.getRange(rowIndex,1,1,header.length).setValues([rowData]);}
  else{aba.appendRow(rowData);}
  return {status:'ok',id_cliente:id};
}

function salvarOSColect(params) {
  const aba = getOuCriarAba(ABA_OS);
  const dados = aba.getDataRange().getValues();
  const header = dados[0]||[];
  const idxId = header.indexOf('id_os');
  const id = String(params.id_os||('OS-'+Utilities.getUuid())).trim();
  let rowIndex=-1;
  for(let i=1;i<dados.length;i++){
    if(String(dados[i][idxId]||'').trim()===id){rowIndex=i+1;break;}
  }
  const campos={
    id_os:id, numero_os:params.numero_os||'', id_cliente:params.id_cliente||'',
    cliente:params.cliente||'', descricao:params.descricao||'',
    data_abertura:params.data_abertura||new Date().toISOString().split('T')[0],
    status:params.status||'ativa', id_inspetor_resp:params.id_inspetor_resp||''
  };
  const rowData=header.map(h=>campos[h]!==undefined?campos[h]:'');
  if(rowIndex>0){aba.getRange(rowIndex,1,1,header.length).setValues([rowData]);}
  else{aba.appendRow(rowData);}
  return {status:'ok',id_os:id};
}

function atualizarEquipamentoRevisao(params) {
  const aba = getOuCriarAba(ABA_EQUIP);
  const dados = aba.getDataRange().getValues();
  const header = dados[0]||[];
  const idxId = header.indexOf('id_equipamento_colect');
  const id = String(params.id_equipamento_colect||'').trim();
  if(!id) return {status:'erro',mensagem:'id_equipamento_colect obrigatório'};
  for(let i=1;i<dados.length;i++){
    if(String(dados[i][idxId]||'').trim()===id){
      const campos={
        revisao_engenharia:params.revisao_engenharia||'',
        pendencia_resolvida:params.pendencia_resolvida||'',
        situacao_documental_revisada:params.situacao_documental_revisada||'',
        obs_revisao:params.obs_revisao||'',
        data_atualizacao:new Date().toISOString()
      };
      const rowData=aba.getRange(i+1,1,1,header.length).getValues()[0];
      Object.keys(campos).forEach(k=>{
        const idx=header.indexOf(k);
        if(idx>=0) rowData[idx]=campos[k];
      });
      aba.getRange(i+1,1,1,header.length).setValues([rowData]);
      return {status:'ok',id_equipamento_colect:id};
    }
  }
  return {status:'erro',mensagem:'Equipamento não encontrado'};
}

function getConsultaCliente(params) {
  const id_cliente = params.id_cliente||'';
  const aba = getOuCriarAba(ABA_EQUIP);
  const dados = aba.getDataRange().getValues();
  if(dados.length<2) return {status:'ok',equipamentos:[]};
  const header=dados[0];
  const idxCli=header.indexOf('id_cliente');
  const equips=dados.slice(1)
    .filter(r=>!id_cliente||String(r[idxCli])===id_cliente)
    .map(r=>{
      const o={};
      header.forEach((h,i)=>{
        if(h!=='fotos_json') o[h]=r[i]; // não retornar fotos_json na consulta (pode ser pesado)
      });
      return o;
    });
  return {status:'ok',equipamentos:equips};
}
```
---
PARTE 4 — COLECTTAP MANAGER v1.0
Arquivo: `output/ColectTap_Manager_v1_0.html`
Cabeçalho:
```html
<!-- ColectTap Manager v1.0 — Engetap Engenharia Ltda -->
<!-- Painel administrativo desktop para gestão de coletas NR-13 -->
<!-- NÃO altera nem apaga dados do Field (ColectTap_v1_3.html) -->
```
Variável GAS no topo:
```javascript
const GAS_URL_MANAGER = 'COLE_AQUI_A_URL_DO_GAS';
const DEMO_MODE_MANAGER = !GAS_URL_MANAGER || GAS_URL_MANAGER.includes('COLE_AQUI');
const PIN_ADMIN_DEMO = '9999'; // PIN de acesso ao Manager em modo demo
```
Layout: sidebar fixa 240px + área principal. Dark theme com mesmas CSS vars do Field.
Telas na sidebar:
📊 Dashboard
👥 Clientes / Leads
🔧 Técnicos
📋 Ordens de Serviço
📡 Coletas Recebidas
⚠️ Pendências Documentais
📁 Fotos / Drive
Login: PIN de 4 dígitos. Em demo, aceitar `9999`. Em produção, validar via GAS `validarPIN`.
Dashboard: cards com contagem de OS, equipamentos, técnicos, clientes, pendências.
Clientes/Leads: tabela + modal de cadastro com todos os campos. Status: lead | cliente | inativo.
Técnicos: tabela + modal. Campo PIN visível apenas no cadastro (não retornado pelo GAS).
OS: tabela + modal. Cliente via select dos cadastrados.
Coletas recebidas:
Tabela com colunas: TAG, Tipo, Cliente, OS, Enquadramento NR13, Status Docs, Qtd Fotos, Drive, Data
Filtros: cliente, OS, técnico, enquadramento
Ações por linha:
🔍 Detalhes (modal com todos os campos)
📁 Drive (abrir `drive_folder_url` em nova aba)
📷 1ª Foto (abrir `primeira_foto_url` em nova aba)
✏️ Revisar (modal com campos: revisão engenharia, pendência resolvida, situação documental, obs revisão)
Pendências Documentais: listar equipamentos com status_documentacao diferente de "Física completa" ou "Digital completa". Colunas: TAG, Cliente, OS, Status Docs, Responsável, Prazo.
Fotos/Drive: listar equipamentos com `drive_folder_url` preenchida. Colunas: TAG, Cliente, OS, Qtd Fotos, Link Drive, 1ª Foto.
EMENDA — Manager não altera nem apaga dados do Field:
O Manager só chama `atualizarEquipamentoRevisao` (campos complementares)
Nunca chama `salvarLevantamentoNR13` ou qualquer função de escrita do Field
Modal de revisão deixa claro: "Campos de revisão administrativa — não sobrescreve dados de campo"
---
PARTE 5 — CHECKLIST DE VERIFICAÇÃO FINAL
Antes de commitar, verificar cada item:
#	Verificação	Status
1	`preparePhoto` chama `fi.click()`	✅/❌
2	`handlePhotoSelected` existe como função separada	✅/❌
3	`_photoTarget` é objeto `{key, secao, campo_ref, origem}`	✅/❌
4	`renderFotoBlock(d, 'ident')` — ID literal, nunca `sec.id` sem `sec` no escopo	✅/❌
5	`SECS[0].id === 'enquadramento'`	✅/❌
6	`setToggle` re-renderiza para os 5 campos reativos listados	✅/❌
7	`.toggle-row` tem `flex-wrap: wrap` — definição ATUALIZADA, não duplicada	✅/❌
8	`enviarGAS` inclui `fotos: normalizarFotosParaEnvio(eq)`	✅/❌
9	`normalizarFotosParaEnvio` usa `fotoKey = v.key || k` (não descarta fotos sem v.key)	✅/❌
10	`salvarFotosDrive` chama `arq.setSharing` quando `DRIVE_LINK_PUBLICO=true`	✅/❌
11	`fotos_json` no Sheets não contém `dataUrl`	✅/❌
12	PDF agrupa fotos por seção com subtítulos	✅/❌
13	Campo `temperatura` removido do formulário e do PDF	✅/❌
14	`circunferencia_mm` calcula `diametro_externo_calculado_mm` via `oninput` (tempo real)	✅/❌
15	`possui_manometro = 'Não'` oculta cert/vencimento	✅/❌
16	`possui_valvula = 'Sim'` mostra `pa_valvula` SEMPRE	✅/❌
17	`valvula_adequada = 'Não'` mostra `motivo_valvula_inadequada`	✅/❌
18	`selectOS` carrega `colect_os_[id]` primeiro, fallback `colect_equip_[id]`	✅/❌
19	`salvarEquipamento` chama `ensureVisitId()` e `ensureEquipId()`	✅/❌
20	`enviarGAS` avisa se payload > 35 MB	✅/❌
21	`enviarGAS` NÃO apaga rascunho — apenas marca `sync_status = 'synced'`	✅/❌
22	`codigo_projeto = 'Outro'` abre campo livre (via onchange no select)	✅/❌
23	Reenvio da mesma OS não duplica equipamento (upsert por `id_equipamento_colect`)	✅/❌
24	`enquadra_nr13 = 'Não enquadra'` → PDF simplificado com título especial	✅/❌
25	Manager tem 7 telas na sidebar	✅/❌
26	Manager lista coletas com links Drive e 1ª Foto	✅/❌
27	Manager não chama `salvarLevantamentoNR13`	✅/❌
28	GAS switch não tem `case 'getOSColect'` duplicado	✅/❌
29	Arquivos gerados em `output/`, não na raiz	✅/❌
30	`getSecoes()` não conflita com `SECS`	✅/❌
---
ENTREGÁVEIS FINAIS
```
output/
├── ColectTap_v1_3.html
├── ColectTap_GAS_v1_2.js
└── ColectTap_Manager_v1_0.html
```
E um arquivo `docs/CHANGES_v1_3.md` com:
Bugs corrigidos (lista numerada)
Funções criadas (lista)
Funções modificadas (lista com descrição da mudança)
Verificações: cada item do checklist acima com ✅ ou ❌
Pontos de atenção restantes para próxima iteração
