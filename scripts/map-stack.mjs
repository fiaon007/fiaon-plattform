#!/usr/bin/env node
/**
 * ARAS Stack Trace Mapper
 * Maps minified stack traces back to original source using sourcemaps
 * 
 * Usage:
 *   VITE_DEBUG_SOURCEMAP=true npm run build
 *   node scripts/map-stack.mjs dashboard-XYZ.js 139 221
 * 
 * Or with full path:
 *   node scripts/map-stack.mjs dist/public/assets/dashboard-XYZ.js 139 221
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { SourceMapConsumer } from 'source-map';

const DIST_ASSETS = 'dist/public/assets';

async function main() {
  const [,, fileArg, lineArg, colArg] = process.argv;
  
  if (!fileArg || !lineArg) {
    console.log(`
ARAS Stack Trace Mapper
=======================
Usage: node scripts/map-stack.mjs <file> <line> [column]

Examples:
  node scripts/map-stack.mjs dashboard-BsVfug-b.js 139 221
  node scripts/map-stack.mjs dist/public/assets/dashboard-XYZ.js 139 221

Note: Run with VITE_DEBUG_SOURCEMAP=true npm run build first
`);
    process.exit(1);
  }
  
  const line = parseInt(lineArg, 10);
  const column = colArg ? parseInt(colArg, 10) : 0;
  
  // Find the file
  let jsPath = fileArg;
  if (!existsSync(jsPath)) {
    // Try in dist/public/assets
    jsPath = join(DIST_ASSETS, basename(fileArg));
  }
  
  if (!existsSync(jsPath)) {
    // Try to find by partial name
    const files = existsSync(DIST_ASSETS) ? readdirSync(DIST_ASSETS) : [];
    const match = files.find(f => f.includes(fileArg.replace('.js', '')) && f.endsWith('.js'));
    if (match) {
      jsPath = join(DIST_ASSETS, match);
    }
  }
  
  if (!existsSync(jsPath)) {
    console.error(`❌ Could not find file: ${fileArg}`);
    console.log(`\nAvailable files in ${DIST_ASSETS}:`);
    if (existsSync(DIST_ASSETS)) {
      readdirSync(DIST_ASSETS)
        .filter(f => f.endsWith('.js'))
        .forEach(f => console.log(`  ${f}`));
    }
    process.exit(1);
  }
  
  const mapPath = jsPath + '.map';
  if (!existsSync(mapPath)) {
    console.error(`❌ Sourcemap not found: ${mapPath}`);
    console.log('\nRun with sourcemaps enabled:');
    console.log('  VITE_DEBUG_SOURCEMAP=true npm run build');
    process.exit(1);
  }
  
  console.log(`\n📍 Mapping ${basename(jsPath)}:${line}:${column}\n`);
  
  try {
    const mapContent = readFileSync(mapPath, 'utf8');
    const consumer = await new SourceMapConsumer(JSON.parse(mapContent));
    
    const original = consumer.originalPositionFor({ line, column });
    
    if (original.source) {
      console.log(`✅ Original Location:`);
      console.log(`   File:   ${original.source}`);
      console.log(`   Line:   ${original.line}`);
      console.log(`   Column: ${original.column}`);
      console.log(`   Name:   ${original.name || '(anonymous)'}`);
      
      // Try to show source context
      const sourceContent = consumer.sourceContentFor(original.source);
      if (sourceContent) {
        const lines = sourceContent.split('\n');
        const startLine = Math.max(0, original.line - 4);
        const endLine = Math.min(lines.length, original.line + 3);
        
        console.log(`\n📄 Source Context:`);
        console.log('─'.repeat(60));
        for (let i = startLine; i < endLine; i++) {
          const lineNum = i + 1;
          const marker = lineNum === original.line ? '>>>' : '   ';
          console.log(`${marker} ${lineNum.toString().padStart(4)}: ${lines[i]}`);
        }
        console.log('─'.repeat(60));
      }
    } else {
      console.log('❌ Could not map position to original source');
      console.log('   This might be generated code or the sourcemap is incomplete');
    }
    
    consumer.destroy();
  } catch (err) {
    console.error('❌ Error parsing sourcemap:', err.message);
    process.exit(1);
  }
}

main().catch(console.error);
