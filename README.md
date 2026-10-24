# Asphalt Wolves — portal de recrutamento

Portal estático no GitHub Pages, com Firebase Authentication para a staff e Firebase Realtime Database para inscrições e status ao vivo. Não há etapa de compilação para desenvolver as páginas.

## Desenvolvimento e verificação

Use Node.js 24.15+ e Java 21 para o emulador.

```sh
npm ci
npm run serve
npm test
npm run test:rules
npm run build
```

O endereço local é http://127.0.0.1:4173. Os testes de regras usam exclusivamente o projeto demonstrativo `demo-asw`, sem alterar dados de produção. Os testes DOM cobrem fechamento durante preenchimento, reabertura, queda de conexão, envio repetido, resposta perdida, acompanhamento legado, conteúdo malicioso e concorrência entre decisões.

## Fonte de verdade do recrutamento

`config/status` aceita apenas `aberto` ou `fechado`. O site começa bloqueado até receber a confirmação do banco e bloqueia novamente sem conexão, em caso de erro ou configuração ausente. Fechar vagas preserva o formulário e os campos já preenchidos. Reabrir habilita o mesmo formulário sem recarregar a página.

Antes de enviar, o cliente consulta novamente o status. As regras do banco também exigem `aberto` no instante da gravação: modificar o HTML ou enviar requisições diretas não contorna o fechamento. O envio utiliza REST com prazo de 15 segundos, sem fila de gravação offline, e reaproveita o protocolo em uma nova tentativa após erro. O banco rejeita sobrescritas e aprovações forjadas.

O painel salva `config/status`, `updatedAt` (horário do servidor) e `updatedBy`. Só confirma sucesso após a resposta do servidor. Fechar vagas não altera fichas existentes nem impede sua análise. Os dados e identificadores antigos são preservados; não há migração destrutiva.

## Permissões do banco

As regras em `database.rules.json` correspondem ao UID da conta administrativa existente, confirmado no Firebase Authentication: `HZ2txmi9fPVzDKvt5f5OomAi1B42`. Esse identificador e a configuração Web Firebase são públicos por natureza; não são senhas ou credenciais de serviço. A autorização depende das regras no servidor.

- Visitantes leem a configuração e somente `aplicacoes/{protocolo}/status`, sem nomes, telefones ou conteúdo da ficha.
- Visitantes criam uma ficha completa com status `pending` apenas enquanto o recrutamento estiver aberto. A idade mínima, horas, campos, consentimento e horário do servidor são validados nas regras.
- Somente a conta administrativa existente pode listar fichas, mudar o recrutamento e decidir uma ficha pendente.
- Decisões preservam os dados originais, gravam autor e horário do servidor, e usam ETag para impedir sobrescrita por outra aba.
- O painel renderiza dados de candidatos como texto, sem `innerHTML` ou eventos montados a partir de conteúdo do banco.

Para mudar a conta administrativa no futuro, atualizar o UID nas regras e no cliente, testar e publicar ambos. Criar uma conta no Authentication não concede acesso à staff.

O acompanhamento usa o protocolo imprevisível salvo neste navegador (`asw_id`). As chaves antigas `idFichaAsphalt` e `asw_status` são compatíveis. Limpar o armazenamento, usar outro navegador ou modo privado pode perder o acompanhamento local; o candidato pode informar seu protocolo à equipe. O protocolo permite consultar apenas o resultado, nunca a ficha completa.

## Publicação

O workflow `.github/workflows/static.yml` executa testes de interface, testes no emulador e cria `dist/` com apenas as páginas e os assets públicos. O GitHub Pages publica essa pasta. Dependências, testes e arquivos operacionais não são enviados no artefato público.

As regras do Realtime Database são uma publicação separada: editar a aba **Realtime Database → Regras** no projeto `recrutamento-asw`, ou usar uma sessão Firebase CLI autorizada:

```sh
npx firebase deploy --only database --project recrutamento-asw
```

Depois de alterar o formato de dados, publique o cliente compatível antes de restringir as regras. Não exporte fichas pessoais para commits, logs ou testes. Nunca coloque uma chave de conta de serviço no repositório.

## Notificações

O webhook Discord que estava embutido no JavaScript público foi removido: ele expunha a credencial e enviava dados pessoais dos candidatos diretamente do navegador. O painel mantém o acompanhamento ao vivo. Para restaurar alertas Discord, rotacione o webhook antigo e configure um serviço de backend com segredo protegido; não recoloque o webhook no frontend.

Não há bloqueio permanente por idade ou horas em `localStorage`. O candidato pode corrigir os dados antes do envio ou voltar quando atender aos requisitos. Não se afirma coletar IP, pois o portal não implementa essa coleta.
