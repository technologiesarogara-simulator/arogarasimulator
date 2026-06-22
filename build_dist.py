import os
import shutil

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

    # Copy essential files
    files_to_copy = ['index.html', 'app.js', 'style.css']
    for file in files_to_copy:
        if os.path.exists(file):
            try:
                shutil.copy(file, dist_dir)
            except Exception as e:
                print(f"Error copying {file} to dist: {e}")
            
    # Copy lib directory
    lib_dir = 'lib'
    if os.path.exists(lib_dir):
        dest_lib = os.path.join(dist_dir, lib_dir)
        if not os.path.exists(dest_lib):
            os.makedirs(dest_lib)
        for item in os.listdir(lib_dir):
            s = os.path.join(lib_dir, item)
            d = os.path.join(dest_lib, item)
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
        
    print(f'Successfully built/updated deployment directory: {os.path.abspath(dist_dir)}')

if __name__ == '__main__':
    build()
