# ColectTap — Instruções para o Codex

## Objetivo
Evoluir o ColectTap de v1.1 para v1.2 de forma cirúrgica, 
sem quebrar funcionalidades existentes.

## Regras obrigatórias
- NUNCA reescrever o app inteiro
- Sempre partir dos arquivos em src/ como base
- Salvar resultados em output/
- Preservar todas as funções existentes
- Adicionar funções novas sem remover as antigas
- Manter compatibilidade com localStorage chave colect_equip_[id_os]

## Arquivos de base
- src/ColectTap_v1_1.html  → base do frontend
- src/ColectTap_GAS_v1_0.js → base do backend GAS

## Arquivos de saída
- output/ColectTap_v1_2.html
- output/ColectTap_GAS_v1_1.js

## Especificação completa
Ver docs/SPEC_v1_2.md

## Ordem de implementação
1. Ler src/ completo antes de qualquer alteração
2. Implementar bloco por bloco conforme prompts/
3. Testar mentalmente cada função antes de salvar
4. Nunca salvar base64 no Sheets
5. Nunca duplicar equipamentos no Sheets