Você é um engenheiro frontend especialista em JavaScript vanilla e PWA mobile.

Preciso ADICIONAR código a um app HTML single-page chamado ColectTap.
NÃO reescreva o app inteiro. Entregue APENAS os blocos novos, com comentários 
indicando exatamente onde inserir (ex: "// INSERIR no bloco CONFIG, após APP_VERSION").

CONTEXTO DO APP:
- Estado global: objeto SES com SES.os, SES.inspetor, SES.equipamentos, SES.dados, SES.fotos
- localStorage atual usa chave: colect_equip_[id_os]  
- Navegação por função goTo(id)
- Seções do formulário em array SECS[7]
- Fotos em SES.fotos[key] = { dataUrl, w, h }

IMPLEMENTAR:

1. CONSTANTES (inserir no bloco CONFIG):
const APP_VERSION = 'ColectTap-v1.2';
const AUTOSAVE_INTERVAL_MS = 25000;
const FOTO_MAX_SIZE = 800;
const FOTO_JPEG_QUALITY = 0.82;

2. FUNÇÕES DE ID (inserir após bloco CONFIG):
- ensureVisitId(): gera SES.id_visita_colect se não existir
  Formato: VIS-[numero_os]-[yyyyMMdd-HHmmss]-[random4hex]
- ensureEquipId(): gera SES.id_equipamento_colect se não existir
  Formato: EQ-[numero_os]-[yyyyMMdd-HHmmss]-[random4hex]
- gerarId4(): retorna 4 chars hex aleatórios

3. FUNÇÕES DE AUTOSAVE (inserir após funções de ID):
- markDirty(): seta flag _dirty = true
- persistCurrentEquipDraft(reason): 
  serializa SES.dados + SES.fotos no objeto de rascunho
  salva em colect_os_[id_os] no localStorage
  Estrutura: { id_visita_colect, os, inspetor, equipamentos[], updated_at, sync_status, app_version }
  Cada equipamento: { id_equipamento_colect, tipo, dados, fotos, pendencias[], status_completude, created_at, updated_at, sync_status }
- autosaveDraft(reason): só salva se _dirty === true, depois seta _dirty = false
- loadDraftsForOS(id_os): carrega colect_os_[id_os], faz merge com colect_equip_[id_os] legado
- restoreDraftIfExists(): chamado ao entrar na T3, restaura equipamentos salvos

4. LISTENERS DE AUTOSAVE (inserir no final do script, antes do init):
- window.addEventListener('blur', () => autosaveDraft('blur'))
- document.addEventListener('visibilitychange', () => { if(document.hidden) autosaveDraft('hidden') })
- setInterval(() => autosaveDraft('interval'), AUTOSAVE_INTERVAL_MS)
- Chamar markDirty() em: secNext(), secBack(), clearFoto(), e no oninput de fotos

5. MODAL DE PENDÊNCIA (novo elemento HTML + função JS):
HTML: um dialog-overlay com id="modal-pendencia"
  - Título: "Campo não preenchido"
  - Subtítulo dinâmico com o nome do campo
  - Lista de motivos como radio buttons:
    Informação não encontrada | Placa ilegível | Equipamento sem placa |
    Documento inexistente | Documento não disponibilizado pelo cliente |
    Acesso não permitido | Área de risco | Trabalho em altura não liberado |
    Espaço confinado não liberado | Não aplicável | A verificar posteriormente | Outro
  - Campo textarea para observação livre
  - Botões: Cancelar | Registrar Pendência

JS: 
- function abrirModalPendencia(secao, campo, label, onConfirm)
- function registrarPendencia(secao, campo, label, motivo, obs)
  Salva em SES.pendencias[] = [{ secao, campo, label, motivo, observacao, created_at, inspetor, status:'pendente' }]

6. CORREÇÃO DO BUG goTo (substituir o bloco existente "INTERCEPT goTo"):
Remover todas as variáveis: _origGoTo, _origGoToFn, origGoTo, goToIntercepted
Substituir por função única:
function openExportScreen() {
  autosaveDraft('before_export');
  renderExport();
  // chamar navegação real diretamente
  const prev = document.getElementById('scr-' + currentScreen);
  const next = document.getElementById('scr-t-export');
  if (prev) prev.classList.add('out');
  setTimeout(() => {
    if (prev) { prev.classList.add('hidden'); prev.classList.remove('out'); }
    next.classList.remove('hidden');
    currentScreen = 't-export';
  }, 220);
}
Alterar o botão em T3 de onclick="goTo('t-export')" para onclick="openExportScreen()"

7. DOIS INPUTS DE FOTO (substituir o único input existente):
<input type="file" id="fileInputCamera" accept="image/*" capture="environment" style="display:none">
<input type="file" id="fileInputGallery" accept="image/*" style="display:none">

Funções:
- preparePhoto(key, secao, campo_ref, origem)
  origem: 'camera' | 'galeria'
  usa fileInputCamera se camera, fileInputGallery se galeria
  redimensiona para FOTO_MAX_SIZE px no lado maior, quality FOTO_JPEG_QUALITY
  salva metadados: { dataUrl, w, h, secao, campo_ref, origem, created_at, key }

Formato de entrega:
- Blocos numerados, cada um com comentário de onde inserir
- Sem explicações longas, só código
- HTML dos dialogs em bloco separado, indicando onde inserir no body