#!/usr/bin/env node
/**
 * Obrero Local - Invocación automática de Qwen Obrero
 *
 * Uso: node obrero.js "prompt para generar código"
 *
 * Este script delega tareas repetitivas al LLM local para ahorrar tokens cloud.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const OLLAMA_HOST = 'localhost';
const OLLAMA_PORT = 11434;
const OLLAMA_PATH = '/api/generate';
const MODEL = 'qwen-obrero';
const CONTEXT_SIZE = 16384;

async function generateCode(prompt, options = {}) {
    const body = JSON.stringify({
        model: MODEL,
        prompt: prompt,
        stream: false,
        options: {
            num_ctx: options.context_size || CONTEXT_SIZE,
            temperature: options.temperature || 0.3,
            top_p: options.top_p || 0.8,
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
            }
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
        req.write(body);
        req.end();
    });
}

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.error('Uso: node obrero.js "prompt" [--file path] [--output path]');
        process.exit(1);
    }

    // Parsear argumentos
    const prompt = args.find(a => !a.startsWith('--'));
    const fileArg = args.indexOf('--file');
    const outputArg = args.indexOf('--output');

    let contextPrompt = prompt;

    // Si se especifica un archivo, leer su contenido como contexto
    if (fileArg > 0 && args[fileArg + 1]) {
        const filePath = args[fileArg + 1];
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        contextPrompt = `Contexto del archivo ${path.basename(filePath)}:\n\n${fileContent}\n\n${prompt}`;
    }

    console.log('[Obrero Local] Generando código con Qwen Obrero...');

    try {
        const response = await generateCode(contextPrompt);

        // Si se especifica output, guardar en archivo
        if (outputArg > 0 && args[outputArg + 1]) {
            const outputPath = args[outputArg + 1];
            fs.writeFileSync(outputPath, response);
            console.log(`[Obrero] Código guardado en: ${outputPath}`);
        } else {
            console.log('\n--- RESULTADO OBRERO ---');
            console.log(response);
            console.log('--- FIN OBRERO ---\n');
        }
    } catch (error) {
        console.error('[Obrero] Error:', error.message);
        console.error('[Obrero] Verifica que Ollama esté corriendo: ollama list');
        process.exit(1);
    }
}

main();
