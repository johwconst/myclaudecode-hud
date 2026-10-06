# myclaudecode-hud

HUD multi-linha acima do prompt do Claude Code, com o Clawd animado em pixel art.

```
 ▐▛███▜▌    ▐ Opus ▌ │ ctx ██████▍   64% ▂▃▅ │ 5h ██  31% ↻2h │ 7d ██  12%
▝▜█████▛▘   ⎇ main ±3 │ $1.24 │ 10:42 ☀ 24°C │ ⏱ 1h12m
  ▘▘ ▝▝     ▸ Edit  ×42 tools
```

- Clawd pisca quando parado e anda/mexe os braços enquanto o modelo trabalha
- Contexto (com sparkline do histórico), limites de 5h e 7d com tempo até reset
- Branch git e arquivos modificados, custo da sessão, hora, clima ([wttr.in](https://wttr.in)) e duração
- Última ferramenta usada e contagem de tool calls
- Segmentos de menor prioridade somem quando o terminal é estreito

## Instalação

No prompt do Claude Code (terminal):

```
/plugin install status-hud --marketplace johwconst/myclaudecode-hud
```

Responda `y` para adicionar o marketplace e escolha o escopo.

## Desenvolvimento

Rodar direto desta pasta:

```
claude --plugin-dir .
```

Testes e validação:

```
claude plugin test .
claude plugin validate .
```
