#!/usr/bin/env python3
"""Bundle the ES-module source into single-file pages without a JavaScript toolchain.

  dist/index.html     standalone page (doctype + head), same behaviour as the multi-file site
  dist/artifact.html  page body only (title/style/markup/script), for hosts that wrap it in their own document

Each module is wrapped in its own scope; local imports become references to the wrapped module's exports;
third-party imports (three, addons) are hoisted once to the top of the bundle.
"""
import re, os, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'src'
ORDER = ['data.js', 'charts.js', 'moisture.js', 'lab3d.js', 'main.js']

def mod_id(path):
    return '__' + re.sub(r'[^A-Za-z0-9]', '_', path.replace('.js', ''))

def resolve(from_path, spec):
    base = (SRC / from_path).parent
    target = (base / spec).resolve().relative_to(SRC.resolve())
    return str(target).replace(os.sep, '/')

external = []
def transform(path):
    code = (SRC / path).read_text()
    exports = []
    default = False
    lines = []
    for line in code.split('\n'):
        m = re.match(r"^import\s+\*\s+as\s+(\w+)\s+from\s+'([^']+)';?\s*$", line)
        if m:
            name, spec = m.groups()
            if spec.startswith('.'):
                lines.append(f'const {name} = {mod_id(resolve(path, spec))};')
            else:
                if line not in external: external.append(line)
            continue
        m = re.match(r"^import\s+\{([^}]*)\}\s+from\s+'([^']+)';?\s*$", line)
        if m:
            names, spec = m.groups()
            if spec.startswith('.'):
                lines.append(f'const {{{names}}} = {mod_id(resolve(path, spec))};')
            else:
                if line not in external: external.append(line)
            continue
        m = re.match(r"^import\s+(\w+)\s+from\s+'([^']+)';?\s*$", line)
        if m:
            name, spec = m.groups()
            if spec.startswith('.'):
                lines.append(f'const {name} = {mod_id(resolve(path, spec))}.default;')
            else:
                if line not in external: external.append(line)
            continue
        if line.startswith('export default '):
            default = True
            lines.append('const __default = ' + line[len('export default '):])
            continue
        m = re.match(r'^export\s+(function\*?|const|let|class)\s+(\w+)', line)
        if m:
            exports.append(m.group(2))
            lines.append(line[len('export '):])
            continue
        if line.startswith('export '):
            raise SystemExit(f'{path}: unsupported export form: {line[:60]}')
        lines.append(line)
    body = '\n'.join(lines)
    ret = '{ ' + ', '.join(exports + (['default: __default'] if default else [])) + ' }'
    return f'const {mod_id(path)} = (() => {{\n{body}\nreturn {ret};\n}})();\n'

modules = [transform(p) for p in ORDER]
bundle = '\n'.join(external) + '\n\n' + '\n'.join(modules)

html = (ROOT / 'index.html').read_text()
css = (ROOT / 'styles.css').read_text()
html = html.replace('<link rel="stylesheet" href="styles.css">', '<style>\n' + css + '\n</style>')
html = html.replace('<script type="module" src="src/main.js"></script>', '<script type="module">\n' + bundle + '\n</script>')
dist = ROOT / 'dist'; dist.mkdir(exist_ok=True)
(dist / 'index.html').write_text(html)

# artifact variant: no document skeleton; title + fonts + style + importmap + markup + script
head = re.search(r'<head>(.*?)</head>', html, re.S).group(1)
body = re.search(r'<body>(.*?)</body>', html, re.S).group(1)
keep = []
for tag in re.findall(r'<link[^>]*>|<style>.*?</style>|<script type="importmap">.*?</script>', head, re.S):
    keep.append(tag)
artifact = '<title>Basalt–Carbon Aging Lab</title>\n' + '\n'.join(keep) + '\n' + body
(dist / 'artifact.html').write_text(artifact)
print(f'dist/index.html {len(html)//1024} KB · dist/artifact.html {len(artifact)//1024} KB · modules: {len(ORDER)} · external imports: {len(external)}')
