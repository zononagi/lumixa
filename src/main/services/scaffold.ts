import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { ScaffoldPlan, ScaffoldResult } from '@shared/create'

/**
 * Project scaffolder for the Project Creation Engine (spec §9). Writes a real,
 * runnable project from a built-in template. Safety (spec §35): it refuses to
 * write into a folder that already has contents, so it can never overwrite an
 * existing project. No secrets, no network, no arbitrary commands.
 */

interface FileSpec {
  path: string
  content: string
}

const GITIGNORE = ['node_modules', 'dist', 'out', '.vite', '*.log', '.DS_Store'].join('\n') + '\n'

function featuresBlock(features: string[]): string {
  if (features.length === 0) return ''
  return '\n\n## Features\n\n' + features.map((f) => `- ${f}`).join('\n') + '\n'
}

function reactTemplate(name: string, features: string[]): FileSpec[] {
  const pkg = {
    name,
    private: true,
    version: '0.1.0',
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'tsc -b && vite build',
      preview: 'vite preview',
      typecheck: 'tsc --noEmit'
    },
    dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' },
    devDependencies: {
      '@vitejs/plugin-react': '^4.3.4',
      '@types/react': '^19.0.0',
      '@types/react-dom': '^19.0.0',
      typescript: '^5.7.0',
      vite: '^6.0.0'
    }
  }
  const featureList = JSON.stringify(features)
  return [
    { path: 'package.json', content: JSON.stringify(pkg, null, 2) + '\n' },
    { path: '.gitignore', content: GITIGNORE },
    {
      path: 'index.html',
      content:
        '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n' +
        '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n' +
        `    <title>${name}</title>\n  </head>\n  <body>\n` +
        '    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n' +
        '  </body>\n</html>\n'
    },
    {
      path: 'vite.config.ts',
      content:
        "import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\n\n" +
        'export default defineConfig({ plugins: [react()] })\n'
    },
    {
      path: 'tsconfig.json',
      content:
        JSON.stringify(
          {
            compilerOptions: {
              target: 'ES2020',
              useDefineForClassFields: true,
              lib: ['ES2020', 'DOM', 'DOM.Iterable'],
              module: 'ESNext',
              skipLibCheck: true,
              moduleResolution: 'bundler',
              jsx: 'react-jsx',
              strict: true,
              noUnusedLocals: true
            },
            include: ['src']
          },
          null,
          2
        ) + '\n'
    },
    {
      path: 'src/main.tsx',
      content:
        "import { StrictMode } from 'react'\nimport { createRoot } from 'react-dom/client'\n" +
        "import App from './App'\nimport './index.css'\n\n" +
        "createRoot(document.getElementById('root')!).render(\n" +
        '  <StrictMode>\n    <App />\n  </StrictMode>\n)\n'
    },
    {
      path: 'src/App.tsx',
      content:
        "import type { JSX } from 'react'\n\n" +
        `const features: string[] = ${featureList}\n\n` +
        'export default function App(): JSX.Element {\n' +
        '  return (\n    <main className="app">\n' +
        `      <h1>${name}</h1>\n` +
        '      <p>Built with Lumixa. Start editing <code>src/App.tsx</code>.</p>\n' +
        '      {features.length > 0 && (\n' +
        '        <ul>\n          {features.map((f) => (\n            <li key={f}>{f}</li>\n          ))}\n        </ul>\n' +
        '      )}\n    </main>\n  )\n}\n'
    },
    {
      path: 'src/index.css',
      content:
        ':root { color-scheme: light dark; font-family: system-ui, sans-serif; }\n' +
        'body { margin: 0; }\n.app { max-width: 720px; margin: 0 auto; padding: 2rem; }\n'
    },
    {
      path: 'README.md',
      content:
        `# ${name}\n\nCreated with Lumixa (React + TypeScript + Vite).${featuresBlock(features)}\n` +
        '## Develop\n\n```bash\nnpm install\nnpm run dev\n```\n\n## Build\n\n```bash\nnpm run build\n```\n'
    }
  ]
}

function nodeTemplate(name: string, features: string[]): FileSpec[] {
  const pkg = {
    name,
    version: '0.1.0',
    type: 'module',
    scripts: {
      dev: 'tsx watch src/index.ts',
      build: 'tsc',
      start: 'node dist/index.js',
      typecheck: 'tsc --noEmit'
    },
    devDependencies: { '@types/node': '^22.10.0', tsx: '^4.19.0', typescript: '^5.7.0' }
  }
  return [
    { path: 'package.json', content: JSON.stringify(pkg, null, 2) + '\n' },
    { path: '.gitignore', content: GITIGNORE },
    {
      path: 'tsconfig.json',
      content:
        JSON.stringify(
          {
            compilerOptions: {
              target: 'ES2022',
              module: 'ESNext',
              moduleResolution: 'bundler',
              outDir: 'dist',
              strict: true,
              skipLibCheck: true,
              esModuleInterop: true
            },
            include: ['src']
          },
          null,
          2
        ) + '\n'
    },
    {
      path: 'src/index.ts',
      content:
        `// ${name} — created with Lumixa (Node.js + TypeScript)\n\n` +
        'function main(): void {\n' +
        `  console.log('Hello from ${name}!')\n` +
        '}\n\nmain()\n'
    },
    {
      path: 'README.md',
      content:
        `# ${name}\n\nCreated with Lumixa (Node.js + TypeScript).${featuresBlock(features)}\n` +
        '## Develop\n\n```bash\nnpm install\nnpm run dev\n```\n'
    }
  ]
}

function generate(plan: ScaffoldPlan): FileSpec[] {
  return plan.templateId === 'node-ts'
    ? nodeTemplate(plan.name, plan.features)
    : reactTemplate(plan.name, plan.features)
}

export async function scaffold(plan: ScaffoldPlan): Promise<ScaffoldResult> {
  const { targetDir } = plan
  if (!targetDir || !plan.name) {
    return { ok: false, message: 'A project name and location are required.', files: [] }
  }
  // Safety (§35): never write into a non-empty folder.
  try {
    const entries = await fs.readdir(targetDir)
    if (entries.length > 0) {
      return { ok: false, message: 'That folder already has files — choose an empty/new folder.', files: [] }
    }
  } catch {
    // Folder doesn't exist yet — that's fine; we'll create it.
  }

  const files = generate(plan)
  const written: string[] = []
  try {
    for (const f of files) {
      const abs = join(targetDir, f.path)
      await fs.mkdir(join(abs, '..'), { recursive: true })
      await fs.writeFile(abs, f.content, 'utf-8')
      written.push(f.path)
    }
  } catch (e) {
    return {
      ok: false,
      message: `Could not create the project: ${e instanceof Error ? e.message : String(e)}`,
      files: written
    }
  }
  return { ok: true, message: `Created ${written.length} files.`, root: targetDir, files: written }
}
