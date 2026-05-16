Você é um engenheiro frontend especialista em JavaScript vanilla.

Contexto: app ColectTap com seções A-G renderizadas por função renderSecao(id).
Cada seção retorna HTML como string. As fotos estão em SES.fotos[key].
Existe função renderFotoBlock(def) que renderiza um bloco de foto com legenda.

IMPLEMENTAR — entregue apenas as funções, sem reescrever o app:

1. Fotos por seção — adicionar blocos de foto a cada seção:
   Criar função getFotosSecao(secaoId, tipo) que retorna array de defs de foto
   para cada seção. Use as listas do contexto abaixo.
   
   Seção 'ident':   foto_placa, foto_tag, foto_geral_equip
   Seção 'projeto': foto_folha_dados, foto_trecho_pmta
   Seção 'dimensoes': foto_medicao, foto_corpo, foto_conexoes
   Seção 'disp':   foto_psv, foto_manometro, foto_cert_psv, foto_cert_man
   Seção 'docs':   foto_prontuario, foto_registro_seg, foto_rel_anterior, foto_cert_psv_doc
   Seção 'servico': foto_ambiente, foto_acesso, foto_risco
   Seção 'obs':    [manter as fotos gerais atuais — não remover]

   Modificar cada render[Secao]() para adicionar ao final:
   const fotosSecao = getFotosSecao(secaoId, t);
   return htmlExistente + '<p class="sec-label">📷 Fotos desta Seção</p>' 
          + fotosSecao.map(d => renderFotoBlock(d)).join('');

2. Nova seção de Enquadramento NR13 — função renderEnquadramento(t):
   Pergunta principal com 4 opções (toggle):
   - "Sim, enquadra conforme 13.2.1"
   - "Não enquadra conforme 13.2.2" 
   - "Dúvida / necessita avaliação PLH"
   - "Fora do escopo"
   
   Se Sim: mostrar checkList com motivos de enquadramento (6 opções da NR13)
   Se Não: mostrar select com motivos de não enquadramento (lista longa)
           + select de ação (formalização, sem ação, aguardar PLH, outro)
   
   Campos: enquadra_nr13, base_enquadramento, motivo_nao_enquadramento, 
           acao_nao_enquadramento, observacao_enquadramento, situacao_nr13
   
   situacao_nr13 select: Em dia | Vencida | Nunca inspecionada | 
                         Sem documentação | Fora do escopo NR13 | A classificar

   Adicionar esta seção como nova entrada no array SECS:
   { id:'enquadramento', label:'Enquadramento NR13', icon:'⚖️', pct:XX }
   Ajustar pct de todas as seções proporcionalmente (agora são 8 seções).

3. Função renderDocumentacaoInteligente(t) — substituir renderDocumentacao atual:
   Primeiro: pergunta "Existe documentação disponível?" com 6 opções
   Salvar em SES.dados.status_documentacao
   
   Se "Sim, completa" ou "Sim, parcial": mostrar checkList de documentos por tipo
   (usar as listas já existentes em renderDocumentacao)
   Se outros casos: mostrar apenas campo obs + registrar pendência automática
   
   Campos novos: status_documentacao, documentos_presentes (array), 
   documentos_ausentes (array), obs_docs, responsavel_envio_docs, prazo_envio_docs

Formato: funções completas, comentário de onde cada uma substitui ou complementa.