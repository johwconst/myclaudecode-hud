<div align="center">

# myclaudecode-hud

**HUD multi-linha acima do prompt do Claude Code, com o Clawd animado em pixel art.**

<img src="docs/alterancia_clawd.gif" alt="Clawd animado no HUD" width="720">

</div>

```
▐ Opus ▌ │ ctx ██████▍░░░ 64% ▂▂▃▃▄▅ │ 5h █▉░░░░ 31% ↻2h14m │ 7d ▊░░░░░ 12% ↻4d3h
⎇ main ±3 │ $1.24 │ 10:42 ☀️ 24°C │ ⏱ 1h12m
▸ Edit  ×42 tools
```

## Recursos

| | |
|---|---|
| **Clawd vivo** | Pisca quando parado, anda e mexe os braços enquanto o modelo trabalha |
| **Contexto** | Barra de uso com sparkline do histórico |
| **Limites** | Janelas de 5h e 7d com tempo até o reset |
| **Git** | Branch atual e arquivos modificados |
| **Sessão** | Custo, hora, clima ([wttr.in](https://wttr.in)) e duração |
| **Ferramentas** | Última ferramenta usada e contagem de tool calls |
| **Responsivo** | Segmentos de menor prioridade somem em terminais estreitos |

## Troca de modelo

O badge do modelo acompanha o modelo ativo da sessão.

<div align="center">
<img src="docs/alternancia_model.gif" alt="Alternância de modelo no HUD" width="720">
</div>

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
