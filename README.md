# Celso do CPM2 — Uma nova era

Site pessoal de TH no GitHub Pages. Preserva a memória da Asphalt Wolves, apresenta o personagem independente inspirado em Celso Oliveira (ETNRLZ) e publica exposições da garagem no Car Parking Multiplayer 2.

## Desenvolvimento

Node 24+, Java 21 para as regras do Firebase:

```sh
npm ci
npm run serve
npm test
npm run test:rules
npm run build
```

O site é estático. O Firebase Authentication existente controla o acesso em `adm.html`; `garagePosts` no Realtime Database armazena as exposições. Só o UID administrativo já existente pode publicar, editar e excluir. Visitantes só leem exposições. Nenhuma conta ou senha nova foi criada.

## Publicar uma exposição

Entre em `adm.html` com a conta administrativa. Preencha nome, marca e história, selecione categoria e envie de uma a quatro fotos. Escolha a capa, o enquadramento e o fundo, confira “Ver apresentação” e publique. Fotos são convertidas localmente para WebP com transparência preservada, até 1400 pixels e 420 mil caracteres por imagem. A apresentação aberta sempre mostra a imagem inteira. Não são inventados carros ou publicações iniciais.

As gravações usam REST com timeout e ETag/If-Match para evitar sobrescrita por outra sessão. A interface só confirma depois da resposta do banco. Falhas preservam os campos. Exclusão exige confirmação no painel. A lista pública tem busca, categorias e carregamento progressivo de cartões; o conjunto de registros ainda é baixado em uma consulta, indicado para uma garagem pessoal pequena. Para centenas de exposições, migrar fotos para object storage e paginar no servidor.

## Implantação

O workflow de Pages testa a interface, testa regras no emulador `demo-asw` e publica `dist/`. As regras do banco precisam ser publicadas separadamente com uma conta Firebase autorizada:

```sh
npx firebase deploy --only database --project recrutamento-asw
```

Publicar as regras junto da nova interface. Elas encerram definitivamente novas inscrições e preservam as fichas antigas como arquivo privado e imutável, acessível apenas ao administrador. Não há migração, exportação nem exclusão de fichas pessoais. `garagePosts` é público para leitura e exclusivo da conta administrativa para escrita. A configuração Firebase e o UID são identificadores públicos, não segredos.

## Personagem e imagens

As duas artes fornecidas por TH são usadas em `assets/images`. A abertura mostra o personagem original dando seu joinha característico. A apresentação 3D é uma escultura procedural estilizada feita com Three.js, com geometria real, controles de órbita, zoom, teclado e giro automático opcional; não é uma reconstrução fotorrealista do desenho. O 3D é carregado sob demanda e pausa a renderização fora da tela. Em dispositivos sem WebGL, a arte da abertura continua disponível.

Three.js 0.180.0 está incluído localmente em `assets/vendor`, com sua licença MIT. Não há dependência de CDN para o 3D. Firebase Auth e fontes usam os serviços oficiais. Nenhuma informação de patrimônio, fortuna ou biografia não verificada foi atribuída ao Celso Oliveira.

## Fontes da inspiração

- Canal de referência: https://www.youtube.com/@etnrlz
- Matéria que identifica Celso Oliveira como piloto e youtuber do canal Etnrlz: https://vivapariquera.com.br/noticia/42021/youtuber-grava-video-com-helicoptero-no-aeroporto-de-registro
- Instagram do personagem: https://www.instagram.com/celsocpm2/

Celso do CPM2 é uma criação independente de TH. Não representa o perfil pessoal de Celso Oliveira, uma parceria com ele ou uma afiliação oficial ao jogo.

## Garagem independente e métricas

A coleção fica em `garagem/index.html` (`/Asw-recrut/garagem/`), com cartões quadrados em três colunas no desktop, duas no tablet e uma coluna no celular. A página inicial não tem botões de chamada no hero nem lista de carros. A exposição aberta suporta múltiplas fotos e link direto `#carro=ID`.

O admin contém estimativas dos últimos 7 ou 30 dias: sessões de visita por aba/dia, visitas à garagem, aberturas por carro/sessão/dia, cliques no Instagram, gráfico diário e carros mais abertos. A taxa de interação é a proporção das sessões registradas que abriram um carro ou clicaram no Instagram. Isso não mede seguidores, curtidas ou dados internos do Instagram.

Os eventos contêm somente tipo, horário do servidor e ID do carro quando aplicável; uma chave aleatória em sessionStorage deduplica a sessão. Não se armazenam IP, nome, contato, localização, user-agent ou impressão digital. Navegadores automatizados, localhost e Global Privacy Control não são contados. Bloqueadores, várias abas e bots podem afetar as estimativas. Não há histórico anterior à implantação. Leituras dos eventos são exclusivas da conta administrativa; escrita anônima é validada, somente de novos eventos, sem permitir edição ou exclusão. Como toda métrica no cliente, os números não são auditáveis e podem ser manipulados por solicitações externas. Para grande tráfego, migrar coleta para um backend com limitação de taxa e retenção automática.

O personagem agora abre diretamente em 3D, com giro livre por arraste, zoom, teclado, rotação automática opcional e recentralização. As quatro poses não são exibidas como um falso giro 360. A malha foi refinada com superfícies contínuas, pregas, bolsos, calçados, cadarços, mãos, relógio e cabelo; a arte do personagem orienta a textura facial. Continua sendo um modelo estilizado, não um escaneamento 3D de uma pessoa real.
