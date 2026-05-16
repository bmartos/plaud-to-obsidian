# Boas Práticas de Transcrição e Pós-Processamento

Para obter os melhores resultados em transcrições de IA (como as do Plaud) e seu uso no Obsidian, siga estas diretrizes:

## 1. Preparação do Áudio (A Regra 3:1)
- **Distância:** Mantenha a distância entre o falante e o microfone pelo menos três vezes menor do que a distância entre o microfone e qualquer outra fonte de ruído.
- **Microfone:** Use microfones direcionais em ambientes barulhentos.

## 2. Diarização de Falantes (Identificação)
- **Priming:** No início da gravação, peça para que cada participante se apresente brevemente. Isso ajuda o modelo de IA a criar "impressões vocais" únicas para cada pessoa.
- **Evite Interrupções:** Tente evitar que várias pessoas falem ao mesmo tempo (crosstalk), pois isso é o maior desafio para a separação de vozes pela IA.

## 3. Glossários e Vocabulário Customizado
- **Jargão:** Sempre que possível, forneça à IA uma lista de siglas, nomes de produtos ou termos técnicos específicos da sua área. Isso reduz erros em termos pouco comuns.

## 4. Estrutura de Notas no Obsidian
- **YAML Frontmatter:** Inclua metadados como `date`, `plaud_id`, `tags` e `participants` no topo do arquivo.
- **Templates de Pós-Processamento:**
    - **Resumo Executivo:** Foque no "quem fez o quê" e "quais decisões foram tomadas".
    - **Itens de Ação:** Use o formato `[ ]` para que o Obsidian reconheça como tarefas.
    - **Insights/Decisões:** Destaque decisões estratégicas para consulta rápida.

## 5. Segurança e Privacidade
- **Dados Biométricos:** Voiceprints podem ser considerados dados sensíveis. Verifique a conformidade se estiver compartilhando transcrições com identificação vocal.
- **Retenção de Dados:** Verifique se o serviço (Plaud/OpenAI/etc.) possui políticas de "Zero Data Retention" (ZDR) se o conteúdo for altamente confidencial.
