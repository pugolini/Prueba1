#!/usr/bin/env node
/**
 * Preprocessor Local - Análisis de Contexto para Ahorro de Tokens
 * 
 * Este script usa Qwen Obrero (local) para:
 * 1. Leer y analizar archivos del proyecto
 * 2. Generar un brief estructurado y compacto
 * 3. Reducir el contexto enviado a Kimi/Claude en un 70-80%
 * 
 * Uso: node preprocessor.js --task "descripción de la tarea" [--path ./src] [--output brief.json]
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OLLAMA_HOST = 'localhost';
const OLLAMA_PORT = 11434;
const OLLAMA_PATH = '/api/generate';
const MODEL = 'qwen-obrero';
const CONTEXT_SIZE = 16384;
const MAX_FILE_SIZE = 50000; // 50KB max por archivo

// Extensiones de archivo relevantes por tipo de proyecto
const CODE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.cs'];
const CONFIG_EXTENSIONS = ['.json', '.yaml', '.yml', '.toml', '.ini'];
const DOC_EXTENSIONS = ['.md', '.txt', '.rst'];

class TokenSaverPreprocessor {
    constructor() {
        this.filesAnalyzed = 0;
        this.tokensSaved = 0;
        this.startTime = Date.now();
    }

    /**
     * Llama a Ollama/Qwen para generar análisis
     */
    async callOllama(prompt, options = {}) {
        const body = JSON.stringify({
            model: MODEL,
            prompt: prompt,
            stream: false,
            options: {
                num_ctx: options.context_size || CONTEXT_SIZE,
                temperature: options.temperature || 0.2,
                top_p: options.top_p || 0.8,
                num_predict: options.max_tokens || 4000,
            }
        });

        return new Promise((resolve, reject) => {
            const req = http.request({
                hostname: OLLAMA_HOST,
                port: OLLAMA_PORT,
                path: OLLAMA_PATH,
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body)
                },
                timeout: 120000,
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        resolve(result.response || '');
                    } catch (e) {
                        reject(new Error('Error parsing Ollama response: ' + e.message));
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => reject(new Error('Ollama timeout')));
            req.write(body);
            req.end();
        });
    }

    /**
     * Encuentra archivos relevantes basado en la tarea
     */
    async findRelevantFiles(taskDescription, searchPath = '.') {
        console.log('[Preprocessor] Buscando archivos relevantes...');
        
        const files = [];
        
        // 1. Buscar por palabras clave en nombres de archivo
        const keywords = this.extractKeywords(taskDescription);
        
        try {
            const allFiles = this.getAllFiles(searchPath);
            
            for (const file of allFiles) {
                const basename = path.basename(file).toLowerCase();
                const relativePath = path.relative(searchPath, file);
                
                // Puntuación de relevancia
                let score = 0;
                
                // Coincidencia con keywords
                for (const kw of keywords) {
                    if (basename.includes(kw)) score += 10;
                    if (relativePath.toLowerCase().includes(kw)) score += 5;
                }
                
                // Priorizar ciertos tipos de archivo
                const ext = path.extname(file);
                if (CODE_EXTENSIONS.includes(ext)) score += 3;
                if (basename.includes('test') || basename.includes('spec')) score += 2;
                if (basename.includes('config') || basename.includes('main')) score += 5;
                
                // Archivos de documentación importantes
                if (basename === 'readme.md' || basename === 'agents.md' || basename === 'skill.md') {
                    score += 15;
                }
                
                if (score > 0) {
                    files.push({ path: file, relative: relativePath, score, ext });
                }
            }
            
            // Ordenar por relevancia y limitar
            files.sort((a, b) => b.score - a.score);
            return files.slice(0, 20); // Top 20 archivos más relevantes
            
        } catch (e) {
            console.error('[Preprocessor] Error buscando archivos:', e.message);
            return [];
        }
    }

    /**
     * Extrae keywords de la descripción de la tarea
     */
    extractKeywords(taskDescription) {
        const stopWords = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'en', 'con', 'para', 'por', 'es', 'son', 'al', 'se', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'with', 'and', 'or', 'is', 'are']);
        
        return taskDescription
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 2 && !stopWords.has(w));
    }

    /**
     * Obtiene todos los archivos del proyecto (recursivo)
     */
    getAllFiles(dir, files = []) {
        const ignoreDirs = ['node_modules', '.git', '__pycache__', '.venv', 'venv', 'dist', 'build', '.claude', '.antigravity'];
        const ignoreExts = ['.log', '.tmp', '.cache', '.lock'];
        
        try {
            const items = fs.readdirSync(dir);
            
            for (const item of items) {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    if (!ignoreDirs.includes(item) && !item.startsWith('.')) {
                        this.getAllFiles(fullPath, files);
                    }
                } else {
                    const ext = path.extname(item);
                    if (!ignoreExts.includes(ext) && stat.size < MAX_FILE_SIZE) {
                        files.push(fullPath);
                    }
                }
            }
        } catch (e) {
            // Ignorar errores de permisos
        }
        
        return files;
    }

    /**
     * Lee el contenido de archivos relevantes
     */
    async readFilesContent(files) {
        const contents = [];
        
        for (const file of files) {
            try {
                const content = fs.readFileSync(file.path, 'utf-8');
                const lines = content.split('\n').length;
                
                contents.push({
                    path: file.relative,
                    content: this.truncateContent(content, 500), // Max 500 líneas por archivo
                    lines: lines,
                    score: file.score,
                    ext: file.ext
                });
                
                this.filesAnalyzed++;
                this.tokensSaved += content.length / 4; // Estimación aproximada
                
            } catch (e) {
                console.warn(`[Preprocessor] No se pudo leer ${file.path}`);
            }
        }
        
        return contents;
    }

    /**
     * Trunca contenido largo manteniendo las partes más importantes
     */
    truncateContent(content, maxLines) {
        const lines = content.split('\n');
        
        if (lines.length <= maxLines) {
            return content;
        }
        
        // Estrategia: mantener inicio, final, y buscar secciones importantes
        const start = lines.slice(0, Math.floor(maxLines * 0.3));
        const end = lines.slice(-Math.floor(maxLines * 0.3));
        
        // Buscar funciones/exports importantes en el medio
        const middleStart = Math.floor(lines.length / 2) - Math.floor(maxLines * 0.2);
        const middle = lines.slice(middleStart, middleStart + Math.floor(maxLines * 0.4));
        
        return [
            ...start,
            '\n\n[... contenido truncado ...]\n\n',
            ...middle,
            '\n\n[... contenido truncado ...]\n\n',
            ...end
        ].join('\n');
    }

    /**
     * Genera el brief usando Qwen local
     */
    async generateBrief(taskDescription, filesContent) {
        console.log('[Preprocessor] Generando brief con Qwen Obrero...');
        
        const prompt = this.buildAnalysisPrompt(taskDescription, filesContent);
        
        try {
            const analysis = await this.callOllama(prompt, { max_tokens: 4000 });
            return this.parseBrief(analysis, filesContent);
        } catch (e) {
            console.error('[Preprocessor] Error generando brief:', e.message);
            return this.createFallbackBrief(taskDescription, filesContent);
        }
    }

    /**
     * Construye el prompt para el análisis
     */
    buildAnalysisPrompt(taskDescription, filesContent) {
        const filesSummary = filesContent.map(f => {
            return `\n=== ${f.path} (${f.lines} líneas) ===\n${f.content.substring(0, 2000)}`;
        }).join('\n\n');
        
        return `Eres un analizador de código experto. Tu tarea es analizar archivos de un proyecto y generar un BRIEF estructurado para que un arquitecto senior (Kimi/Claude) pueda resolver la tarea sin necesidad de leer todo el código.

TAREA A RESOLVER:
"""${taskDescription}"""

ARCHIVOS RELEVANTES ANALIZADOS:
${filesSummary}

Genera un BRIEF en el siguiente formato JSON:

{\n  "task_summary": "Resumen de 1-2 líneas de la tarea",\n  "relevant_files": [\n    {\n      "path": "ruta/al/archivo",\n      "relevance": "por qué es relevante (1 línea)",\n      "key_functions": ["funcion1", "funcion2"],\n      "dependencies": ["otros archivos que importa"]\n    }\n  ],\n  "current_logic": "Descripción de la lógica actual relevante (3-5 líneas)",\n  "potential_issues": ["posible problema 1", "posible problema 2"],\n  "suggested_approach": "Enfoque sugerido para resolver (2-3 líneas)",\n  "code_snippets": {\n    "archivo.ts": "fragmento de código más relevante (máx 20 líneas)"\n  }\n}

IMPORTANTE:
- Sé conciso. El objetivo es REDUCIR tokens, no aumentarlos.
- Incluye solo la información necesaria para entender y resolver la tarea.
- Los code_snippets deben ser los mínimos indispensables.`;
    }

    /**
     * Parsea el brief generado por Qwen
     */
    parseBrief(analysis, filesContent) {
        try {
            // Intentar extraer JSON del resultado
            const jsonMatch = analysis.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const brief = JSON.parse(jsonMatch[0]);
                return {
                    ...brief,
                    _metadata: {
                        files_analyzed: this.filesAnalyzed,
                        estimated_tokens_saved: Math.floor(this.tokensSaved),
                        processing_time_ms: Date.now() - this.startTime,
                        model: MODEL,
                    }
                };
            }
        } catch (e) {
            console.warn('[Preprocessor] No se pudo parsear JSON, usando fallback');
        }
        
        return this.createFallbackBrief(analysis, filesContent);
    }

    /**
     * Brief de fallback si el análisis falla
     */
    createFallbackBrief(taskDescription, filesContent) {
        return {
            task_summary: taskDescription.substring(0, 200),
            relevant_files: filesContent.map(f => ({
                path: f.path,
                relevance: 'Archivo relevante identificado',
                key_functions: [],
                dependencies: []
            })),
            current_logic: 'No se pudo analizar automáticamente. Revisar archivos listados.',
            potential_issues: [],
            suggested_approach: 'Revisar los archivos relevantes manualmente.',
            code_snippets: {},
            _metadata: {
                files_analyzed: this.filesAnalyzed,
                estimated_tokens_saved: 0,
                processing_time_ms: Date.now() - this.startTime,
                model: MODEL,
                fallback: true,
            }
        };
    }

    /**
     * Ejecuta el preprocesamiento completo
     */
    async run(taskDescription, options = {}) {
        console.log('╔══════════════════════════════════════════════════════════╗');
        console.log('║     TOKEN SAVER - Preprocessor Local (Qwen Obrero)       ║');
        console.log('╚══════════════════════════════════════════════════════════╝');
        console.log(`\nTarea: ${taskDescription.substring(0, 100)}...\n`);
        
        // 1. Encontrar archivos relevantes
        const searchPath = options.path || '.';
        const relevantFiles = await this.findRelevantFiles(taskDescription, searchPath);
        
        if (relevantFiles.length === 0) {
            console.log('[Preprocessor] No se encontraron archivos relevantes.');
            return null;
        }
        
        console.log(`[Preprocessor] ${relevantFiles.length} archivos relevantes encontrados:`);
        relevantFiles.forEach(f => console.log(`  - ${f.relative} (score: ${f.score})`));
        
        // 2. Leer contenido
        const filesContent = await this.readFilesContent(relevantFiles);
        
        // 3. Generar brief
        const brief = await this.generateBrief(taskDescription, filesContent);
        
        // 4. Guardar o mostrar resultado
        const output = options.output || `.claude/briefs/brief-${Date.now()}.json`;
        
        // Asegurar que existe el directorio
        const outputDir = path.dirname(output);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        fs.writeFileSync(output, JSON.stringify(brief, null, 2), 'utf-8');
        
        // 5. Mostrar resumen
        console.log('\n╔══════════════════════════════════════════════════════════╗');
        console.log('║                    RESUMEN DE AHORRO                     ║');
        console.log('╠══════════════════════════════════════════════════════════╣');
        console.log(`║ Archivos analizados:     ${brief._metadata.files_analyzed.toString().padStart(6)}                    ║`);
        console.log(`║ Tokens estimados ahorrados: ~${brief._metadata.estimated_tokens_saved.toString().padStart(5)}                 ║`);
        console.log(`║ Tiempo de procesamiento: ${brief._metadata.processing_time_ms}ms              ║`);
        console.log(`║ Brief guardado en: ${output.substring(0, 30).padEnd(30)}   ║`);
        console.log('╚══════════════════════════════════════════════════════════╝\n');
        
        return { brief, output };
    }
}

// CLI
async function main() {
    const args = process.argv.slice(2);
    
    // Parsear argumentos
    const taskIndex = args.indexOf('--task');
    const pathIndex = args.indexOf('--path');
    const outputIndex = args.indexOf('--output');
    
    const task = taskIndex >= 0 ? args[taskIndex + 1] : null;
    const searchPath = pathIndex >= 0 ? args[pathIndex + 1] : '.';
    const output = outputIndex >= 0 ? args[outputIndex + 1] : null;
    
    if (!task) {
        console.log(`
Uso: node preprocessor.js --task "descripción de la tarea" [--path ./src] [--output brief.json]

Ejemplos:
  node preprocessor.js --task "Fix bug in authentication middleware"
  node preprocessor.js --task "Refactor ChartComponent to use hooks" --path ./frontend/src
  node preprocessor.js --task "Add unit tests for trading service" --output ./briefs/trading-tests.json
`);
        process.exit(1);
    }
    
    const preprocessor = new TokenSaverPreprocessor();
    
    try {
        const result = await preprocessor.run(task, { path: searchPath, output });
        if (result) {
            console.log('[Preprocessor] ✅ Brief generado exitosamente');
            console.log(`[Preprocessor] Usa este brief con Kimi/Claude para ahorrar tokens`);
            process.exit(0);
        } else {
            console.error('[Preprocessor] ❌ No se pudo generar el brief');
            process.exit(1);
        }
    } catch (e) {
        console.error('[Preprocessor] ❌ Error:', e.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { TokenSaverPreprocessor };
