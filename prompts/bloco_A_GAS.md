Você é um engenheiro de software especialista em Google Apps Script.

Preciso ADICIONAR as seguintes funções a um GAS existente chamado ColectTap-GAS-v1.1.
NÃO reescreva o arquivo inteiro. Entregue APENAS as funções novas/modificadas, 
claramente separadas por comentários indicando onde inserir no arquivo original.

CONTEXTO:
- O GAS já tem: validarPIN, getOSColect, salvarLevantamentoNR13 (com appendRow), getEquipamentos, logErro, garantirAbas
- A aba principal se chama EQUIPAMENTOS_NR13
- Cada equipamento tem um campo id_equipamento_colect (novo, ainda não existe)

IMPLEMENTAR:

1. Função upsertEquipamentoNR13(eq, contextoVisita, fotosInfo)
   - Lê cabeçalho da aba EQUIPAMENTOS_NR13
   - Busca linha existente por id_equipamento_colect
   - Se existir: atualiza a linha, preserva data_criacao original
   - Se não existir: appendRow
   - Sempre atualiza data_atualizacao

2. Função garantirColunas(aba, colunasNecessarias[])
   - Se coluna já existe: não altera
   - Se não existe: adiciona ao final
   - Nunca remove ou renomeia colunas existentes
   - Colunas novas a garantir: id_visita_colect, id_equipamento_colect,
     status_completude, sync_status, pendencias_json, status_documentacao,
     documentos_presentes, documentos_ausentes, documentos_a_receber,
     enquadra_nr13, base_enquadramento, motivo_nao_enquadramento,
     acao_nao_enquadramento, situacao_nr13, setor, descricao_equipamento,
     drive_folder_id, drive_folder_url, primeira_foto_url, quantidade_fotos,
     fotos_json, data_criacao, data_atualizacao

3. Modificar salvarLevantamentoNR13 para:
   - Chamar garantirColunas antes de salvar
   - Chamar upsertEquipamentoNR13 em vez de appendRow
   - Receber e repassar: id_visita_colect, id_equipamento_colect, fotos[]

4. Função salvarFotosDrive(idVisita, idEquip, tag, fotos[])
   - Cada foto tem: { key, label, secao, dataUrl, origem }
   - Decodificar base64 do dataUrl
   - Criar pasta: PGP_Fotos / AAAA-MM / [idVisita] / 
   - Salvar como: [tag]_[secao]_[key].jpg via DriveApp.createFile()
   - Retornar: { drive_folder_id, drive_folder_url, fotos_salvas: [{key, file_id, file_url}] }
   - Se falhar foto individual: registrar no LOG, continuar as demais

5. Função gerarConsultaCliente()
   - Lê aba EQUIPAMENTOS_NR13
   - Cria/atualiza aba CONSULTA_CLIENTE
   - Colunas: Cliente, OS, TAG, Tipo, Fabricante, Ano Fabricação, Local, Setor,
     Enquadra NR13, Situação NR13, Categoria, Fluido, Classe Fluido, Volume,
     PMTA, Última Inspeção, Próxima Insp. Externa, Próxima Insp. Interna,
     Vencimento Manômetro, Vencimento PSV, Situação Documental, 
     Documentos Pendentes, Pendências de Campo, Observações, Link Fotos
   - Cabeçalho: fundo #1a3a6b, texto branco, negrito
   - Primeira linha congelada, filtros ativados

6. Adicionar ao switch de handleRequest:
   case 'gerarConsultaCliente': result = gerarConsultaCliente(); break;

Formato de entrega:
- Cada função com comentário: // === INSERIR APÓS função X ===
- Sem explicações longas, só código limpo