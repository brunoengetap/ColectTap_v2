Você vai implementar uma evolução estrutural e robusta do sistema ColectTap, com máxima cautela para não quebrar funcionalidades já existentes.

Arquivos principais:
- ColectTap_v1_1.html
- ColectTap_GAS_v1_0.js
- Planilha ColectTap_NR13_v1.xlsx
- Planilha de referência relatorio_agenda_completo (12).xlsx
- NR13 atual: 2022 - NR13 - Portaria 4.219 de 20.12.2022.pdf

Contexto:
O ColectTap é o sistema de coleta de dados NR13 da Engetap. O sistema já está funcional, mas precisa evoluir em robustez, usabilidade, preservação de dados, coleta documental/campo separada, registro de fotos por seção, armazenamento das fotos no Google Drive via GAS e geração de planilha final de consulta com boa aparência para envio ao cliente.

PRIORIDADE MÁXIMA:
1. Não perder dados em caso de fechamento acidental do app.
2. Não quebrar o fluxo atual de login, seleção de OS, cadastro de equipamento, PDF, CSV e envio ao GAS.
3. Não duplicar equipamentos no Sheets em caso de reenvio.
4. Manter compatibilidade com dados já existentes.
5. Alterar o mínimo necessário na estrutura visual, preservando a identidade do ColectTap.

====================================================================
FASE 1 — VERSIONAMENTO E PREPARAÇÃO
====================================================================

Atualizar versionamento:
- HTML: ColectTap-v1.2
- GAS: ColectTap-GAS-v1.1

Criar constantes/configurações:
No HTML:
- APP_VERSION = 'ColectTap-v1.2'
- AUTOSAVE_INTERVAL_MS = 25000
- FOTO_MAX_SIZE = 800
- FOTO_JPEG_QUALITY = 0.82
- MAX_PAYLOAD_WARN_MB = 35
- MAX_FOTOS_POR_EQUIPAMENTO = sem limite rígido, mas avisar se payload ficar pesado

No GAS:
- APP_VERSION = 'ColectTap-GAS-v1.1'
- DRIVE_ROOT_FOLDER_NAME = 'PGP_Fotos'
- TIMEZONE = 'America/Sao_Paulo'

Não implementar GitHub para fotos. Fotos devem ir ao Google Drive via GAS.

====================================================================
FASE 2 — AUTOSAVE / NÃO PERDER DADOS
====================================================================

Hoje o ColectTap salva o equipamento apenas ao clicar em salvar. Corrigir isso.

Implementar autosave local robusto:
1. Criar id_visita_colect ao abrir uma OS:
   Formato sugerido:
   VIS-[numero_os]-[yyyyMMdd-HHmmss]-[random4]

2. Criar id_equipamento_colect no momento em que o técnico escolhe o tipo do equipamento ou inicia novo equipamento:
   Formato sugerido:
   EQ-[numero_os]-[yyyyMMdd-HHmmss]-[random4]

3. O rascunho do equipamento deve existir mesmo sem TAG, sem número de série e sem fabricante.

4. Implementar salvamento local automático com debounce:
   - Ao mudar seção
   - Ao clicar Próximo/Anterior
   - Ao tirar/remover foto
   - Ao editar legenda de foto
   - Ao app perder foco: window.blur
   - Ao app ficar oculto: document.visibilitychange
   - Antes de exportar
   - Antes de enviar ao GAS
   - A cada 25 segundos, somente se houver alterações pendentes

5. Criar funções:
   - ensureVisitId()
   - ensureEquipId()
   - markDirty()
   - autosaveDraft(reason)
   - loadDraftsForOS()
   - persistCurrentEquipDraft(reason)
   - restoreDraftIfExists()
   - listPendingDrafts()

6. Estrutura local sugerida:
   Chave OS:
   colect_os_[id_os]

   Conteúdo:
   {
     id_visita_colect,
     os,
     inspetor,
     equipamentos: [],
     updated_at,
     sync_status: 'local' | 'pending_sync' | 'synced' | 'sync_error',
     last_sync_at,
     app_version
   }

7. Cada equipamento deve conter:
   {
     id_equipamento_colect,
     tipo,
     dados,
     fotos,
     pendencias,
     status_secao,
     status_completude,
     created_at,
     updated_at,
     sync_status
   }

8. Ao reabrir a OS, carregar automaticamente os rascunhos locais e mostrar na tela T3.
   Cards possíveis:
   - Em andamento
   - Com pendências
   - Pronto para envio
   - Enviado
   - Erro de envio

9. Não limpar rascunhos após envio bem-sucedido. Apenas marcar como "synced".
   Criar ação opcional futura para limpar rascunhos antigos, mas não apagar automaticamente nesta versão.

====================================================================
FASE 3 — NOVA LÓGICA DE SEÇÕES: CAMPO E DOCUMENTAL SEPARADOS
====================================================================

Substituir a lógica excessivamente linear por uma "Central do Equipamento", sem quebrar o formulário atual.

Após escolher o tipo do equipamento, abrir uma tela de central do equipamento com cards de seção. O técnico decide a ordem da coleta.

Seções sugeridas:
1. Identificação / Placa
2. Enquadramento NR13
3. Coleta Documental
4. Dados de Projeto
5. Dimensões / Dados Construtivos
6. Dispositivos de Segurança
7. Condições de Instalação e Acesso
8. Ensaios / Riscos / Observações
9. Revisão e Pendências

Cada seção deve ter status:
- não_iniciada
- em_andamento
- concluida
- concluida_com_pendencia
- nao_aplicavel

Manter botões:
- Voltar para central
- Salvar rascunho
- Próximo
- Revisar pendências

Não bloquear salvamento por falta de campo. Em vez disso, registrar pendência justificada.

====================================================================
FASE 4 — CAMPOS CRÍTICOS SEM BLOQUEAR SALVAMENTO
====================================================================

Não criar obrigatoriedade rígida de campos mínimos.

Quando um campo crítico ficar vazio, o sistema deve perguntar:
"Este campo não foi preenchido. Qual o motivo?"

Opções:
- Informação não encontrada
- Placa ilegível
- Equipamento sem placa
- Documento inexistente
- Documento não disponibilizado pelo cliente
- Acesso ao equipamento não permitido
- Área de risco
- Trabalho em altura não liberado
- Espaço confinado não liberado
- Local com acesso restrito
- Não aplicável
- A verificar posteriormente
- Outro

Registrar em:
pendencias: [
  {
    secao,
    campo,
    label,
    motivo,
    observacao,
    created_at,
    inspetor,
    status: 'pendente' | 'justificada' | 'resolvida'
  }
]

O equipamento pode ser salvo mesmo com campos ausentes, mas deve ficar com status:
- completo
- completo_com_pendencias
- incompleto_justificado
- rascunho

====================================================================
FASE 5 — DOCUMENTAÇÃO INTELIGENTE
====================================================================

Na seção "Coleta Documental", antes de mostrar os campos, perguntar:

"Existe documentação anterior disponível para este equipamento?"

Opções:
1. Sim, completa
2. Sim, parcial
3. Não existe documentação
4. Existe, mas não foi disponibilizada pelo cliente
5. Cliente informou que enviará posteriormente
6. Não verificado nesta visita

Comportamento:
- Sim, completa: abrir questionário documental completo
- Sim, parcial: perguntar quais documentos existem e abrir campos relacionados
- Não existe documentação: registrar ausência documental e oferecer ação
- Existe, mas não foi disponibilizada: registrar pendência do cliente
- Cliente enviará posteriormente: registrar pendência documental futura
- Não verificado: manter pendência para revisão

Campos novos:
- status_documentacao
- documentos_presentes
- documentos_ausentes
- documentos_a_receber
- obs_docs
- responsavel_envio_docs
- prazo_envio_docs
- canal_previsto_envio_docs
- acao_documental_recomendada

Documentos por tipo:

Vaso:
- Prontuário do vaso
- Registro de segurança
- Relatórios de inspeção anteriores
- Projeto de alteração ou reparo
- Certificado de calibração da PSV
- Certificado de calibração do manômetro
- Projeto de instalação
- Comprovação de TH de fabricação, quando aplicável

Caldeira:
- Prontuário da caldeira
- Registro de segurança
- Relatórios anteriores
- Projeto de instalação
- Projeto de alteração ou reparo
- Certificado PSV
- Certificado manômetro
- Manual de operação
- Documentos de operador/treinamento, se aplicável

Tubulação:
- Especificações aplicáveis
- Fluxograma / P&ID / isométrico
- Relatórios anteriores
- Projeto de alteração ou reparo
- Certificados de dispositivos de segurança, se aplicável

Tanque:
- Folha de dados
- Registro de segurança
- Relatórios anteriores
- Projeto de alteração ou reparo
- Certificados de dispositivos de sobrepressão/vácuo, se aplicável

====================================================================
FASE 6 — ENQUADRAMENTO NR13 / NÃO ENQUADRAMENTO
====================================================================

Criar seção "Enquadramento NR13" baseada no item 13.2 da NR13.

Pergunta principal:
"O equipamento se enquadra na NR13?"

Opções:
- Sim, enquadra conforme 13.2.1
- Não enquadra conforme 13.2.2
- Dúvida / necessita avaliação do PLH
- Fora do escopo da coleta atual

Se "Sim":
Perguntar motivo do enquadramento:
- Caldeira com pressão de operação superior a 60 kPa
- Vaso com P.V superior a 8
- Vaso com fluido classe A
- Recipiente móvel com P.V superior a 8 ou fluido classe A
- Tubulação com fluido classe A ou B ligada a caldeira/vaso enquadrado
- Tanque metálico com diâmetro externo > 3 m, capacidade nominal > 20.000 L e fluido classe A ou B
- Outro / avaliar

Se "Não":
Perguntar motivo do não enquadramento:
- Recipiente transportável / vaso de transporte
- Reservatório portátil de fluido comprimido
- Extintor de incêndio
- Vaso destinado à ocupação humana
- Vaso integrante de pacote de máquinas
- Duto ou componente de duto
- Forno / serpentina / aquecedor de fluido térmico
- Vaso com diâmetro interno inferior a 150 mm
- Gerador de vapor não enquadrado
- Tubo de instrumentação
- Tubulação de rede pública de gás
- Vaso PRFV
- Caldeira com volume inferior a 100 L
- Tanque estrutural de embarcação/navio/plataforma
- Tanque enterrado ou apoiado sobre pernas/sapatas/pedestais/selas
- Panela de cocção
- Acumulador ou bloco hidráulico
- Tubulação que opera com vapor, observação item 13.6.2.6
- Trocador de calor de placas
- Vaso sujeito exclusivamente a vácuo menor ou igual a 5 kPa sem fluido classe A
- Outro

Após "Não enquadra":
Perguntar "Ação a ser tomada":
- Oferecer formalização de desenquadramento
- Cliente decidiu não tomar nenhuma ação
- Aguardar avaliação do PLH
- Incluir em relatório de recomendações
- Outro

Campos:
- enquadra_nr13
- base_enquadramento
- motivo_nao_enquadramento
- acao_nao_enquadramento
- observacao_enquadramento
- status_comercial_desenquadramento

A situação NR13 deve poder ser indicada pelo técnico:
- Em dia
- Vencida
- Nunca inspecionada
- Sem documentação para avaliar
- Fora do escopo NR13
- A classificar pelo PLH

====================================================================
FASE 7 — FOTOS POR SEÇÃO
====================================================================

Hoje as fotos ficam concentradas no final. Reorganizar fotos por seção.

Cada seção deve permitir fotos próprias, com botão:
- Tirar foto com câmera
- Escolher da galeria

Importante:
No mobile, não depender apenas de capture="environment", pois isso pode forçar câmera e dificultar escolha da galeria.

Implementar dois botões:
1. "📷 Câmera"
   input accept="image/*" capture="environment"
2. "🖼️ Galeria"
   input accept="image/*" sem capture

Cada foto deve ser redimensionada em memória:
- Lado maior máximo: 800 px
- JPEG quality: 0.82
- Salvar como dataUrl temporariamente no app
- Não gravar base64 no Sheets

Metadados de cada foto:
{
  key,
  label,
  secao,
  campo_ref,
  dataUrl,
  w,
  h,
  created_at,
  origem: 'camera' | 'galeria',
  id_equipamento_colect
}

Fotos sugeridas por seção:

Identificação / Placa:
- Foto da placa
- Foto da TAG
- Foto geral do equipamento
- Foto do número de série, se separado

Documentação:
- Foto do prontuário
- Foto do registro de segurança
- Foto do relatório anterior
- Foto do certificado PSV
- Foto do certificado manômetro
- Foto do projeto/folha de dados

Dados de projeto:
- Foto de trecho do documento onde constam PMTA, volume, código de construção, ano

Dimensões:
- Foto da medição de diâmetro/comprimento/altura
- Foto do corpo do equipamento
- Foto de conexões/bocas de visita

Dispositivos de segurança:
- Foto da PSV
- Foto do manômetro
- Foto do certificado fixado no dispositivo, se houver
- Foto do DCBI
- Foto do purgador
- Foto do indicador de nível/pressostato para caldeira

Instalação e acesso:
- Foto do ambiente
- Foto de acesso
- Foto de drenos/respiros
- Foto de obstruções
- Foto de área de risco/altura/espaço confinado, se aplicável

Riscos / anomalias:
- Corrosão
- Vazamento
- Deformação
- Suporte/base
- Isolamento deteriorado
- Falta de identificação

Manter também uma galeria geral do equipamento na revisão.

====================================================================
FASE 8 — UPLOAD DE FOTOS VIA GAS PARA GOOGLE DRIVE
====================================================================

Implementar o método abaixo:

Fluxo:
1. Campo captura ou escolhe foto da galeria.
2. HTML redimensiona para max 800 px, JPEG 0.82, mantém base64 em memória/local.
3. No envio da visita ao GAS, fotos vão junto no mesmo POST da visita.
4. GAS recebe payload com fotos em array.
5. GAS decodifica base64.
6. GAS cria pasta no Drive:
   PGP_Fotos / AAAA-MM / [ID_Visita] /
7. GAS salva cada foto como .jpg via DriveApp.createFile().
8. GAS retorna:
   - drive_folder_id
   - drive_folder_url
   - primeira_foto_url
   - quantidade_fotos
9. GAS grava no Sheets apenas URLs e IDs, nunca base64.

Payload esperado por equipamento:
equipamentos: [
  {
    id_equipamento_colect,
    ...dados,
    fotos: [
      {
        key,
        label,
        secao,
        campo_ref,
        dataUrl,
        origem,
        created_at
      }
    ]
  }
]

No HTML, alterar enviarGAS():
Hoje ele remove _fotos antes do POST. Corrigir para enviar fotos como array normalizado e leve:
- Converter SES.fotos para array
- Remover labels soltas duplicadas
- Não enviar objetos inválidos
- Não enviar fotos sem dataUrl
- Preservar label, secao e campo_ref
- Incluir id_visita_colect

Importante:
Fotos devem ir junto com o POST da visita, não em requisição separada.

No GAS, criar funções:
- salvarFotosDrive(idVisita, equipamentos)
- getOrCreateDriveFolderPath(pathParts)
- sanitizeFileName(name)
- dataUrlToBlob(dataUrl, fileName)
- criarOuObterPastaRaizFotos()
- criarOuObterPastaMes()
- criarOuObterPastaVisita()

Estrutura de pastas:
PGP_Fotos / AAAA-MM / [ID_Visita] / [TAG_ou_EQ]_[secao]_[key]_[index].jpg

Exemplo:
PGP_Fotos / 2026-05 / VIS-LNR001-20260516-1530-A7F3 / VP-01_identificacao_foto_placa_01.jpg

No Sheets, acrescentar colunas:
- drive_folder_id
- drive_folder_url
- primeira_foto_url
- quantidade_fotos
- fotos_json

fotos_json deve conter apenas metadados e URLs:
[
  {
    key,
    label,
    secao,
    campo_ref,
    file_id,
    file_url,
    file_name,
    created_at
  }
]

Nunca salvar base64 no Sheets.

Se o upload de alguma foto falhar:
- Não perder os dados textuais
- Gravar dados do equipamento
- Registrar erro no LOG
- Retornar alerta parcial ao HTML
- Marcar sync_status como "synced_with_photo_errors"
- Mostrar ao usuário: "Dados enviados, mas X foto(s) falharam. Tente reenviar depois."

====================================================================
FASE 9 — ANTIDUPLICIDADE / UPSERT NO GAS
====================================================================

Hoje o GAS usa appendRow. Implementar upsert.

Chave primária:
id_equipamento_colect

Se não existir, usar fallback:
id_os + tag + numero_equip + tipo

Mas a regra principal deve ser:
- todo equipamento novo precisa ter id_equipamento_colect
- reenvio deve atualizar a mesma linha, não duplicar

Criar função:
- upsertEquipamentoNR13(eq, contextoVisita, fotosInfo)

Fluxo:
1. Ler cabeçalho da aba EQUIPAMENTOS_NR13.
2. Encontrar índice da coluna id_equipamento_colect.
3. Procurar linha existente.
4. Se existir, atualizar linha.
5. Se não existir, appendRow.
6. Preservar data_criacao original se já existir.
7. Atualizar data_atualizacao sempre.

Adicionar colunas novas sem apagar as antigas:
- id_visita_colect
- id_equipamento_colect
- status_completude
- sync_status
- pendencias_json
- status_documentacao
- documentos_presentes
- documentos_ausentes
- documentos_a_receber
- enquadra_nr13
- base_enquadramento
- motivo_nao_enquadramento
- acao_nao_enquadramento
- situacao_nr13
- setor
- descricao_equipamento
- observacao_item
- drive_folder_id
- drive_folder_url
- primeira_foto_url
- quantidade_fotos
- fotos_json
- data_criacao
- data_atualizacao

Criar função garantirColunas(aba, colunasNecessarias):
- Se a coluna já existe, não altera.
- Se não existe, adiciona ao final.
- Não remover nem renomear colunas existentes.

====================================================================
FASE 10 — PLANILHA FINAL DE CONSULTA PARA CLIENTE
====================================================================

A planilha final não deve ser apenas CSV bruto. Deve ser uma aba/saída de consulta com boa aparência para envio ao cliente.

Criar aba:
CONSULTA_CLIENTE

Colunas recomendadas:
- Cliente
- OS
- TAG
- Tipo
- Descrição do Equipamento
- Número de Série / Nº Fabricante
- Local
- Setor
- Fabricante
- Ano Fabricação
- Enquadra NR13
- Base de Enquadramento
- Motivo de Não Enquadramento
- Ação Recomendada
- Situação NR13
- Categoria
- Grupo de Risco
- Fluido
- Classe do Fluido
- Volume
- Unidade Volume
- PMTA
- Unidade PMTA
- PTH
- Unidade PTH
- Última Inspeção
- Próxima Inspeção Externa
- Próxima Inspeção Interna
- Vencimento Manômetro
- Vencimento PSV
- Situação Documental
- Documentos Pendentes
- Pendências de Campo
- Observações
- Link Fotos
- Link Primeira Foto

Não incluir nesta versão:
- Número Tap
- Serviço
- Status genérico

Aparência:
- Cabeçalho azul Engetap
- Texto branco no cabeçalho
- Congelar primeira linha
- Filtros ativados
- Larguras ajustadas
- Quebra de texto nas colunas longas
- Coluna "Situação NR13" com destaque visual simples
- Coluna "Enquadra NR13" clara
- Link clicável para pasta de fotos

Criar função GAS:
- gerarConsultaCliente()
Ela deve montar/atualizar a aba CONSULTA_CLIENTE com base na aba EQUIPAMENTOS_NR13.

Também retornar essa informação no envio:
{
  status: 'ok',
  id: id_visita,
  registros: n,
  drive_folder_url,
  consulta_atualizada: true
}

====================================================================
FASE 11 — COLECTTAP MANAGER / BASE PARA CADASTROS
====================================================================

Preparar o GAS e a planilha para o futuro ColectTap Manager.

O ColectTap Manager deve servir para:
- Cadastro de técnicos
- Cadastro de clientes/leads
- Cadastro/consulta de OS
- Revisão de coletas
- Complementação documental pelo administrativo
- Consulta de fotos
- Geração de planilha final
- Aprovação final antes de envio ao cliente

Nesta entrega, implementar pelo menos a estrutura de dados e endpoints básicos, sem criar uma interface completa se isso aumentar muito o risco.

Abas:
- TECNICOS
- CLIENTES_LEADS
- OS_COLECT
- EQUIPAMENTOS_NR13
- CONSULTA_CLIENTE
- LOG
- CONFIG

Endpoints GAS sugeridos:
- getTecnicos
- salvarTecnico
- getClientesLeads
- salvarClienteLead
- getOSColect
- salvarOSColect
- getEquipamentos
- getConsultaCliente

Para não quebrar o login atual, manter compatibilidade com INSPETORES.
Se criar TECNICOS, pode espelhar ou migrar com cuidado, mas não remover INSPETORES nesta versão.

====================================================================
FASE 12 — AJUSTES TÉCNICOS OBRIGATÓRIOS NO HTML
====================================================================

Corrigir bug/risco de recursão na tela de exportação:
- renderExport() não deve chamar goTo('t-export') diretamente se goTo foi interceptado.
- Criar função openExportScreen():
  1. autosaveDraft('before_export')
  2. renderExport()
  3. chamar navegação real para t-export

Remover duplicidade/confusão:
- _origGoTo
- _origGoToFn
- origGoTo
- goToIntercepted

Manter uma única função de navegação segura.

Alterar botão Exportar para:
onclick="openExportScreen()"

Alterar input de foto:
- Não usar apenas um input global com capture obrigatório.
- Criar funções separadas:
  preparePhotoCamera(key, secao, campo_ref)
  preparePhotoGallery(key, secao, campo_ref)

Ou uma função:
preparePhoto(key, secao, campo_ref, origem)

Com dois inputs:
- fileInputCamera accept="image/*" capture="environment"
- fileInputGallery accept="image/*"

====================================================================
FASE 13 — PDF COM FOTOS POR SEÇÃO
====================================================================

Atualizar geração de PDF:
- Agrupar fotos por seção
- Exibir título da seção
- Exibir legenda da foto
- Exibir fotos na ordem natural da coleta
- Incluir pendências justificadas
- Incluir situação documental
- Incluir enquadramento NR13
- Incluir ação recomendada para não enquadramento

O PDF deve continuar funcionando mesmo sem Drive, pois ele usa as fotos locais/base64 antes do envio.

====================================================================
FASE 14 — TESTES OBRIGATÓRIOS
====================================================================

Ao final, testar e relatar:

1. Login com PIN
2. Carregamento de OS
3. Criar novo equipamento
4. Gerar id_visita_colect
5. Gerar id_equipamento_colect
6. Preencher parte dos campos
7. Fechar/recarregar app e recuperar rascunho
8. Tirar foto com câmera
9. Escolher foto da galeria
10. Conferir redimensionamento para max 800 px
11. Salvar foto com legenda
12. Foto aparecer na seção correta
13. Documentação completa
14. Documentação parcial
15. Documentação inexistente
16. Cliente enviará documentos posteriormente
17. Enquadramento NR13 como "Sim"
18. Enquadramento NR13 como "Não"
19. Não enquadramento com ação "oferecer formalização"
20. Campo crítico vazio com justificativa
21. Salvar equipamento com pendências
22. Exportar PDF com fotos por seção
23. Enviar ao GAS com fotos no mesmo POST
24. GAS criar pasta PGP_Fotos / AAAA-MM / ID_Visita
25. GAS salvar fotos no Drive
26. GAS gravar apenas URLs no Sheets
27. GAS não gravar base64 no Sheets
28. Reenviar a mesma visita sem duplicar equipamentos
29. Atualizar linha existente pelo id_equipamento_colect
30. Gerar/atualizar aba CONSULTA_CLIENTE
31. Simular falha em uma foto e garantir que dados textuais sejam salvos
32. Verificar LOG de erros

====================================================================
CRITÉRIOS DE ACEITAÇÃO
====================================================================

A implementação só será considerada concluída se:

- O app não perder dados ao fechar/recarregar durante a coleta.
- O técnico puder escolher a ordem das seções.
- Documentação puder ser completa, parcial, inexistente, não disponibilizada ou enviada posteriormente.
- Campos ausentes forem salvos com justificativa, não simplesmente em branco sem contexto.
- O enquadramento NR13 e o não enquadramento forem registrados.
- O fluxo de não enquadramento permitir ação comercial: oferecer formalização de desenquadramento ou cliente decidiu não tomar ação.
- Fotos puderem ser capturadas por câmera e escolhidas da galeria.
- Fotos forem organizadas por seção.
- Fotos forem enviadas no mesmo POST da visita.
- GAS salvar fotos no Google Drive.
- Sheets receber apenas links/IDs, nunca base64.
- Reenvio não duplicar equipamento.
- A planilha CONSULTA_CLIENTE ficar apresentável para envio ao cliente.
- O PDF continuar funcionando e incluir fotos por seção.
- O versionamento esteja atualizado.
- Nenhuma função atual essencial seja quebrada.

Importante:
Se alguma parte for muito grande para implementar com segurança de uma vez, priorize nesta ordem:
1. Autosave e recuperação de rascunho
2. id_visita_colect e id_equipamento_colect
3. Upsert no GAS para não duplicar
4. Upload de fotos para Drive
5. Fotos por seção
6. Documentação inteligente
7. Enquadramento NR13
8. Planilha CONSULTA_CLIENTE
9. Estrutura do ColectTap Manager

Não reescreva o sistema inteiro. Faça uma evolução cirúrgica sobre a base atual.
Explique ao final exatamente quais arquivos foram alterados, quais funções foram criadas, quais funções foram modificadas e quais testes foram executados.