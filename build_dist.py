import os
import re
import shutil
import hashlib


def stamp_asset_versions(dist_dir):
    """Rewrite every local script/style URL in dist/index.html so its ?v= token
    is a hash of that file's actual contents.

    These tokens were maintained by hand, and the hand step is what failed:
    lib/aro-industrial3d.js changed several times while its tag stayed at
    ?v=20260823b, so returning browsers asked for a URL they already held and
    went on running the old file. The deploy was correct and the feature was
    live, and the user still could not see it.

    Hashing removes the step instead of restating it. A file that changes gets
    a new URL; a file that does not keeps its own, so unchanged assets stay
    cached. Only the built copy is rewritten — the source index.html keeps its
    readable tokens, which is what a plain file-server run uses.
    """
    index_path = os.path.join(dist_dir, 'index.html')
    if not os.path.exists(index_path):
        return
    with open(index_path, 'r', encoding='utf-8') as fh:
        html = fh.read()

    digests = {}

    def digest(rel):
        if rel not in digests:
            path = os.path.join(dist_dir, rel)
            if not os.path.exists(path):
                digests[rel] = None
            else:
                h = hashlib.md5()
                with open(path, 'rb') as f:
                    for chunk in iter(lambda: f.read(65536), b''):
                        h.update(chunk)
                digests[rel] = h.hexdigest()[:10]
        return digests[rel]

    # src="app.js?v=x" / href="style.css" — relative paths only, so absolute
    # URLs and Firebase's own /__/ endpoints are left alone.
    pattern = re.compile(
        r'(?P<attr>\b(?:src|href)=")(?P<path>(?!https?:|//|/)[A-Za-z0-9_./-]+\.(?:js|css))'
        r'(?P<query>\?[^"]*)?"'
    )

    stamped = [0]

    def repl(m):
        rel = m.group('path')
        d = digest(rel)
        if d is None:
            return m.group(0)
        stamped[0] += 1
        return '%s%s?v=%s"' % (m.group('attr'), rel, d)

    out = pattern.sub(repl, html)
    if out != html:
        with open(index_path, 'w', encoding='utf-8') as fh:
            fh.write(out)
    missing = sorted(k for k, v in digests.items() if v is None)
    print('Stamped %d asset URLs with content hashes%s'
          % (stamped[0], (' (skipped, not in dist: %s)' % ', '.join(missing)) if missing else ''))


def build():
    dist_dir = 'dist'
    if not os.path.exists(dist_dir):
        os.makedirs(dist_dir)
    
    # Try to clean files inside dist, but handle PermissionError gracefully
    for root, dirs, files in os.walk(dist_dir, topdown=False):
        for name in files:
            filepath = os.path.join(root, name)
            try:
                os.remove(filepath)
            except Exception as e:
                print(f"Warning: Could not remove {filepath}: {e}")
        for name in dirs:
            dirpath = os.path.join(root, name)
            try:
                os.rmdir(dirpath)
            except Exception as e:
                print(f"Warning: Could not remove directory {dirpath}: {e}")

    # Copy essential files (incl. PWA manifest, service worker and app icons)
    files_to_copy = ['index.html', 'app.js', 'style.css', 'manifest.json', 'sw.js',
                     'icon-192.png', 'icon-512.png', 'icon-512-maskable.png']
    for file in files_to_copy:
        if os.path.exists(file):
            try:
                shutil.copy(file, dist_dir)
            except Exception as e:
                print(f"Error copying {file} to dist: {e}")
            
    # Copy lib and assets directories (same recursive-copy treatment for both)
    for src_dir in ('lib', 'assets'):
        if not os.path.exists(src_dir):
            continue
        dest = os.path.join(dist_dir, src_dir)
        if not os.path.exists(dest):
            os.makedirs(dest)
        for item in os.listdir(src_dir):
            s = os.path.join(src_dir, item)
            d = os.path.join(dest, item)
            if os.path.isdir(s):
                if os.path.exists(d):
                    try:
                        shutil.rmtree(d)
                    except Exception as e:
                        print(f"Warning: Could not remove {d}: {e}")
                try:
                    shutil.copytree(s, d)
                except Exception as e:
                    print(f"Error copying directory {s} to {d}: {e}")
            else:
                try:
                    shutil.copy2(s, d)
                except Exception as e:
                    print(f"Error copying file {s} to {d}: {e}")

    stamp_asset_versions(dist_dir)

    print(f'Successfully built/updated deployment directory: {os.path.abspath(dist_dir)}')

if __name__ == '__main__':
    build()
