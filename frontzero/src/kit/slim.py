"""Slim a design-kit GLB: move embedded images to shared external PNGs (deduplicated by hash), optionally keep only
some nodes, and repack the binary chunk with just the buffer views still referenced.
usage: python3 -I slim.py <src.glb> <dst.glb> <texdir> [keep-node-name,...]"""
import json, struct, sys, hashlib, os

src, dst, texdir = sys.argv[1], sys.argv[2], sys.argv[3]
keep = set(sys.argv[4].split(',')) if len(sys.argv) > 4 and sys.argv[4] else None
b = open(src, 'rb').read()
jl = struct.unpack('<I', b[12:16])[0]
j = json.loads(b[20:20 + jl])
binoff = 20 + jl + 8
binlen = struct.unpack('<I', b[20 + jl:24 + jl])[0]
BIN = b[binoff:binoff + binlen]

def view_bytes(i):
    bv = j['bufferViews'][i]
    o = bv.get('byteOffset', 0)
    return BIN[o:o + bv['byteLength']]

# 1. images -> external files
os.makedirs(texdir, exist_ok=True)
for im in j.get('images', []):
    if 'bufferView' not in im:
        continue
    data = view_bytes(im['bufferView'])
    ext = {'image/png': '.png', 'image/jpeg': '.jpg'}.get(im.get('mimeType'), '.png')
    h = hashlib.md5(data).hexdigest()[:12]
    fn = h + ext
    p = os.path.join(texdir, fn)
    if not os.path.exists(p):
        open(p, 'wb').write(data)
    del im['bufferView']
    im.pop('mimeType', None)
    im['uri'] = 'tex/' + fn

# 1b. tag each material with the image files it uses, so the game can share one material/texture across files
def tex_uri(ti):
    t = j['textures'][ti]
    return j['images'][t['source']].get('uri', '') if 'source' in t else ''
for m in j.get('materials', []):
    uris = []
    pbr = m.get('pbrMetallicRoughness', {})
    for slot in (pbr.get('baseColorTexture'), pbr.get('metallicRoughnessTexture'), m.get('normalTexture'), m.get('emissiveTexture')):
        uris.append(tex_uri(slot['index']) if slot else '')
    m.setdefault('extras', {})['tex'] = '|'.join(uris)

# 2. prune nodes: keep a node if it or an ancestor/descendant is in keep (ancestors kept as transforms only)
if keep:
    nodes = j['nodes']
    parent = {}
    for i, n in enumerate(nodes):
        for c in n.get('children', []):
            parent[c] = i
    wanted = set()
    def add_sub(i):
        wanted.add(i)
        for c in nodes[i].get('children', []):
            add_sub(c)
    for i, n in enumerate(nodes):
        if n.get('name') in keep:
            add_sub(i)
            k = i
            while k in parent:
                k = parent[k]
                wanted.add(k)
    remap = {}
    newnodes = []
    for i, n in enumerate(nodes):
        if i in wanted:
            remap[i] = len(newnodes)
            newnodes.append(n)
    for n in newnodes:
        if 'children' in n:
            n['children'] = [remap[c] for c in n['children'] if c in remap]
            if not n['children']:
                del n['children']
    j['nodes'] = newnodes
    for s in j['scenes']:
        s['nodes'] = [remap[r] for r in s['nodes'] if r in remap]
    # drop unused meshes
    used_meshes = sorted({n['mesh'] for n in newnodes if 'mesh' in n})
    mremap = {m: k for k, m in enumerate(used_meshes)}
    j['meshes'] = [j['meshes'][m] for m in used_meshes]
    for n in newnodes:
        if 'mesh' in n:
            n['mesh'] = mremap[n['mesh']]

# 3. keep only accessors used by meshes (+ skins/animations if any), then only the views they use
used_acc = set()
for m in j['meshes']:
    for p in m['primitives']:
        used_acc.update(p['attributes'].values())
        if 'indices' in p:
            used_acc.add(p['indices'])
        for t in p.get('targets', []):
            used_acc.update(t.values())
assert not j.get('skins') and not j.get('animations'), 'skins/animations not handled'
aremap = {a: k for k, a in enumerate(sorted(used_acc))}
j['accessors'] = [j['accessors'][a] for a in sorted(used_acc)]
for m in j['meshes']:
    for p in m['primitives']:
        p['attributes'] = {k: aremap[v] for k, v in p['attributes'].items()}
        if 'indices' in p:
            p['indices'] = aremap[p['indices']]
        if 'targets' in p:
            p['targets'] = [{k: aremap[v] for k, v in t.items()} for t in p['targets']]
used_views = sorted({a['bufferView'] for a in j['accessors'] if 'bufferView' in a})
newbin = bytearray()
views = []
vremap = {}
for v in used_views:
    data = view_bytes(v)
    while len(newbin) % 4:
        newbin.append(0)
    bv = dict(j['bufferViews'][v])
    bv['byteOffset'] = len(newbin)
    bv['buffer'] = 0
    newbin += data
    vremap[v] = len(views)
    views.append(bv)
for a in j['accessors']:
    if 'bufferView' in a:
        a['bufferView'] = vremap[a['bufferView']]
j['bufferViews'] = views
while len(newbin) % 4:
    newbin.append(0)
j['buffers'] = [{'byteLength': len(newbin)}]
js = json.dumps(j, separators=(',', ':')).encode()
while len(js) % 4:
    js += b' '
total = 12 + 8 + len(js) + 8 + len(newbin)
out = struct.pack('<III', 0x46546C67, 2, total) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(newbin), 0x004E4942) + bytes(newbin)
os.makedirs(os.path.dirname(dst), exist_ok=True)
open(dst, 'wb').write(out)
print(os.path.basename(dst), len(b) // 1024, '->', len(out) // 1024, 'KB')
