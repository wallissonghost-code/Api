# TikAnalise

Aplicação experimental para analisar **vídeos públicos do TikTok adicionados manualmente por URL**.

## Fluxo atual

1. O usuário cola uma URL pública de vídeo do TikTok.
2. O servidor valida/resolução a URL e identifica o vídeo e o perfil.
3. O provider público tenta coletar o payload exposto pelas páginas públicas do TikTok.
4. O vídeo é normalizado e devolvido pela API.
5. A interface salva localmente os vídeos analisados e compara somente essa amostra.
6. Dados públicos do perfil, quando disponíveis, são exibidos separadamente das métricas somadas dos vídeos analisados.

## Rodar

Requer Node.js 20+.

```bash
npm start
```

Rotas atuais:

```text
GET /
GET /health
GET /api/video?url=<url-publica-do-video>
GET /app-icon.png
```

## Estrutura atual

- `src/providers/tiktok-public.js`: coleta e normalização de dados públicos do TikTok.
- `src/core/analyze.js`: métricas derivadas reutilizáveis.
- `src/server.js`: servidor HTTP e interface web atual.
- `src/version.js`: versão visível do motor.
- `public/app-icon.png`: ícone da aplicação.

## Persistência

A interface usa `localStorage` (`tikanalise:v1`). Portanto, o histórico salvo atualmente é **por navegador/dispositivo**; ainda não existe conta ou banco central sincronizando Windows e celular.

## Métricas

Para cada vídeo, o provider tenta retornar:

- ID e URL;
- legenda/descrição e hashtags;
- data/hora de publicação;
- duração e capa;
- visualizações;
- curtidas;
- comentários;
- compartilhamentos;
- favoritos/salvamentos quando expostos publicamente.

A aplicação calcula engajamento sobre os vídeos analisados usando:

```text
(curtidas + comentários + compartilhamentos + salvos) / visualizações
```

Os contadores públicos do perfil (como seguidores, seguindo e curtidas totais) são tratados como dados do **perfil**, não como soma da amostra de vídeos.

## Limites

Sem autenticação e sem analytics privados do TikTok, a aplicação não afirma possuir:

- tempo médio assistido;
- curva de retenção;
- taxa real de conclusão;
- fontes de tráfego;
- comportamento minuto a minuto.

Esses dados não devem ser estimados e apresentados como métricas reais.

## Arquitetura

A coleta do TikTok permanece isolada em um provider porque HTML e payloads públicos podem mudar ou sofrer bloqueios. A interface ainda está concentrada em `src/server.js`; a separação futura de HTML/CSS/JS deve ser feita incrementalmente, preservando o comportamento já validado.
