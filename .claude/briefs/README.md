# Briefs Directory

Este directorio contiene los briefs generados por el **Token Saver**.

## Estructura de archivos

- `brief-*.json` - Briefs estructurados generados por el análisis local
- `prompt-*.md` - Prompts optimizados listos para usar con Kimi/Claude

## Cómo usar

1. Ejecuta el análisis local:
   ```bash
   .claude\analyze-issue "Fix bug in ChartComponent"
   ```

2. El brief se guarda automáticamente aquí

3. Copia el contenido del brief o del prompt generado

4. Pégalo en tu conversación con Kimi/Claude

## Beneficios

- **70-80% menos tokens** consumidos en modelos cloud
- **Mismo resultado** de calidad
- **Análisis local gratuito** usando tu GPU (RTX 4060 Ti)
