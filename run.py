import os
import sys
import subprocess
import threading
import time

def log_stream(stream, prefix, color_code):
    """Reads lines from a stream and prints them with a prefix and color."""
    # color_code is ANSI color code, e.g. '33' for yellow, '36' for cyan
    reset = '\033[0m'
    color = f'\033[{color_code}m'
    for line in iter(stream.readline, ''):
        if not line:
            break
        print(f"{color}{prefix}{reset} {line.strip()}")

def kill_process_on_port(port):
    """Finds and kills any processes holding connections or listening on a given port."""
    import subprocess
    import os
    
    print(f"\033[1;35m[System] Checking if port {port} is occupied...\033[0m")
    try:
        if os.name == 'nt':
            cmd = f'netstat -ano | findstr :{port}'
            output = subprocess.check_output(cmd, shell=True, text=True, stderr=subprocess.DEVNULL)
            pids = set()
            current_pid = os.getpid()
            for line in output.strip().split('\n'):
                parts = line.strip().split()
                if len(parts) >= 5:
                    pid_str = parts[-1]
                    if pid_str.isdigit():
                        pid = int(pid_str)
                        if pid > 0 and pid != current_pid:
                            pids.add(pid)
            
            for pid in pids:
                print(f"\033[1;31m[System] Port {port} is busy. Killing process with PID {pid}...\033[0m")
                subprocess.call(f'taskkill /F /PID {pid}', shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            try:
                output = subprocess.check_output(f'lsof -t -i:{port}', shell=True, text=True)
                for pid_str in output.strip().split('\n'):
                    if pid_str.strip().isdigit():
                        pid = int(pid_str.strip())
                        if pid != os.getpid():
                            print(f"\033[1;31m[System] Port {port} is busy. Killing process with PID {pid}...\033[0m")
                            subprocess.call(f'kill -9 {pid}', shell=True)
            except Exception:
                pass
    except subprocess.CalledProcessError:
        # Port is free
        pass
    except Exception as e:
        print(f"\033[1;31m[System] Error checking/killing process on port {port}: {e}\033[0m")

def main():
    # Detect the paths
    if getattr(sys, 'frozen', False):
        base_dir = os.path.dirname(sys.executable)
    else:
        base_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(base_dir, "backend")
    frontend_dir = os.path.join(base_dir, "frontend")

    # Find the python path for the backend
    if os.name == 'nt':
        venv_python = os.path.join(backend_dir, ".venv", "Scripts", "python.exe")
        import shutil
        common_npm_path = r"C:\Program Files\nodejs\npm.cmd"
        if shutil.which("npm.cmd"):
            npm_cmd = "npm.cmd"
        elif os.path.exists(common_npm_path):
            npm_cmd = common_npm_path
        else:
            npm_cmd = "npm.cmd"
    else:
        venv_python = os.path.join(backend_dir, ".venv", "bin", "python")
        npm_cmd = "npm"

    python_executable = venv_python if os.path.exists(venv_python) else "python"

    # Prepare environment variables with Node.js fallback path
    env = os.environ.copy()
    if os.name == 'nt':
        common_node_dir = r"C:\Program Files\nodejs"
        if os.path.exists(common_node_dir):
            paths = env.get("PATH", "").split(os.pathsep)
            if common_node_dir not in paths:
                paths.append(common_node_dir)
                env["PATH"] = os.pathsep.join(paths)

    # Enable color output in Windows terminal
    if os.name == 'nt':
        os.system('color')

    print("\033[1;35m[System] Starting Pooja Jewellers Day Book... Press Ctrl+C to stop.\033[0m")

    # Kill any processes occupying frontend or backend ports
    kill_process_on_port(3000)
    kill_process_on_port(8000)

    # Launch Backend
    print(f"\033[1;33m[System] Starting Backend on port 8000 using: {python_executable}\033[0m")
    backend_cmd = [python_executable, "-m", "uvicorn", "app.main:app", "--port", "8000", "--reload"]
    
    backend_proc = subprocess.Popen(
        backend_cmd,
        cwd=backend_dir,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        shell=(os.name == 'nt'),  # standard on windows for subprocess resolution
        env=env
    )

    # Launch Frontend
    print("\033[1;36m[System] Starting Frontend on port 3000 using npm\033[0m")
    frontend_cmd = [npm_cmd, "run", "dev", "--", "--port", "3000"]
    
    frontend_proc = subprocess.Popen(
        frontend_cmd,
        cwd=frontend_dir,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        shell=(os.name == 'nt'),  # standard on windows for subprocess resolution
        env=env
    )

    # Create logger threads
    backend_thread = threading.Thread(target=log_stream, args=(backend_proc.stdout, "[Backend]", "33"), daemon=True)
    frontend_thread = threading.Thread(target=log_stream, args=(frontend_proc.stdout, "[Frontend]", "36"), daemon=True)

    backend_thread.start()
    frontend_thread.start()

    # Function to terminate processes cleanly
    def cleanup():
        print("\n\033[1;31m[System] Shutting down both services gracefully...\033[0m")
        for proc, name in [(backend_proc, "Backend"), (frontend_proc, "Frontend")]:
            try:
                if os.name == 'nt':
                    # Kill child process tree on Windows to clean up sub-processes
                    subprocess.call(['taskkill', '/F', '/T', '/PID', str(proc.pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                else:
                    proc.terminate()
                print(f"[System] Stopped {name}")
            except Exception as e:
                print(f"[System] Error stopping {name}: {e}")

    try:
        # Keep running until processes finish or interrupted
        while True:
            time.sleep(1)
            # Check if either process exited unexpectedly
            b_status = backend_proc.poll()
            f_status = frontend_proc.poll()
            if b_status is not None:
                print(f"\033[1;31m[System] Backend exited with status {b_status}\033[0m")
                break
            if f_status is not None:
                print(f"\033[1;31m[System] Frontend exited with status {f_status}\033[0m")
                break
    except KeyboardInterrupt:
        pass
    finally:
        cleanup()
        print("\033[1;32m[System] Done.\033[0m")

if __name__ == "__main__":
    main()
