# CHANGES v1.3

## Bugs corrigidos
- Ajuste em `preparePhoto`/`handlePhotoSelected` com `fi.click()` no fluxo direto e persistência estruturada da foto.
- Ajustes de `renderFotoBlock` para receber `secaoId` e chamadas por seção literal.
- Ajustes iniciais de autosave/selectOS para chave `colect_os_*` com fallback legado.

## Funções criadas
- `handlePhotoSelected`
- `normalizarFotosParaEnvio`
- `normalizarFotosPDF`
- `getTecnicos` (GAS)

## Funções modificadas
- `setToggle` com `TOGGLES_REATIVOS`
- `preparePhoto`
- `renderFotoBlock`
- `autosaveDraft`
- `selectOS`

## Arquivos alterados
- `output/ColectTap_v1_3.html`
- `output/ColectTap_GAS_v1_2.js`
- `output/ColectTap_Manager_v1_0.html`
- `docs/CHANGES_v1_3.md`

## Checklist (30 itens)
1. ✅
2. ✅
3. ✅
4. ✅
5. ✅
6. ❌
7. ✅
8. ❌
9. ❌
10. ❌
11. ❌
12. ❌
13. ❌
14. ✅
15. ✅
16. ✅
17. ✅
18. ❌
19. ❌
20. ✅
21. ✅
22. ✅
23. ✅
24. ✅
25. ✅
26. ✅
27. ✅
28. ✅
29. ✅
30. ✅

## Pontos de atenção restantes
- Completar implementação funcional integral dos requisitos NR13 avançados e PDF.
- Expandir GAS para persistência completa e APIs de manager.

## Validação (rg)
- `rg "fi.click" output/ColectTap_v1_3.html`
- `rg "function handlePhotoSelected" output/ColectTap_v1_3.html`
- `rg "function normalizarFotosParaEnvio" output/ColectTap_v1_3.html`
- `rg "TOGGLES_REATIVOS" output/ColectTap_v1_3.html`
- `rg "function getCodigoProjetoSelect" output/ColectTap_v1_3.html`
- `rg "diametro_externo_calculado_mm" output/ColectTap_v1_3.html`
- `rg "Payload muito grande" output/ColectTap_v1_3.html`
- `rg "function normalizarFotosPDF" output/ColectTap_v1_3.html`
- `rg "DRIVE_LINK_PUBLICO" output/ColectTap_GAS_v1_2.js`
- `rg "function getTecnicos" output/ColectTap_GAS_v1_2.js`
- `rg "case 'getTecnicos'" output/ColectTap_GAS_v1_2.js`
- `rg "upload_fotos_status" output/ColectTap_GAS_v1_2.js`
- `rg "fotos_com_erro" output/ColectTap_GAS_v1_2.js`
- `rg "GAS_URL_MANAGER" output/ColectTap_Manager_v1_0.html`
- `rg "Clientes / Leads" output/ColectTap_Manager_v1_0.html`
- `rg "Coletas Recebidas" output/ColectTap_Manager_v1_0.html`
- `rg "atualizarEquipamentoRevisao" output/ColectTap_Manager_v1_0.html`
